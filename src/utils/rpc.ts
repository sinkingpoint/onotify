import { trace } from "@opentelemetry/api";
import { runInSpan } from "./observability";

export const rpc = <In, Out>(
	wrap: (arg: In) => Out | Response | void | Promise<Out> | Promise<Response> | Promise<void>,
	ths: any
) => {
	return async (r: Request) => {
		const inData = await r.json<In>();
		let response = wrap.call(ths, inData);
		if (response instanceof Promise) {
			response = await response;
		}

		if (typeof response === "undefined") {
			return new Response(undefined, { status: 404 });
		}

		if (response instanceof Response) {
			return response;
		}

		return new Response(JSON.stringify(response));
	};
};

export const callRPC = async <In, Out>(
	durable: DurableObjectStub,
	functionName: string,
	inData: In
): Promise<Out | undefined> => {
	const request = new Request(`https://do/${functionName}`, {
		method: "POST",
		body: JSON.stringify(inData),
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!durable.fetch) {
		throw new Error("Durable object does not support fetch");
	}

	try {
		let response = await durable.fetch(request);

		if (response.status === 404) {
			return Promise.resolve(undefined);
		}

		return response.json<Out>();
	} catch (e) {
		if (e instanceof Error) {
			throw new Error(`Error calling ${functionName}: ${e.message}`);
		}

		throw new Error(`Error calling ${functionName}: ${String(e)}`);
	}
};

export const rpcFetch = async (ths: any, request: Request, methods: Record<string, any>) => {
	const tracer = trace.getTracer("DO RPC Fetch Handler");
	const rpcName = new URL(request.url).pathname.substring(1);
	const method = methods[rpcName];
	if (!method) {
		throw `Undefined RPC Method: ${rpcName}`;
	}

	return runInSpan(tracer, `rpc call ${rpcName}`, {}, async () => {
		return rpc(method, ths)(request);
	});
};
