// This is a wholesale copy of ConsoleSpanExporter from @opentelemetry/exporter-collector (https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-sdk-trace-base/src/export/ConsoleSpanExporter.ts#L93)
// with the incredibly small change of swapping console.dir to console.log.
// This can be rm'd once https://github.com/cloudflare/workerd/issues/2247 is resolved.

import { ResolveConfigFn } from "@microlabs/otel-cf-workers";
import { Span, SpanOptions, Tracer } from "@opentelemetry/api";
import { ExportResult, ExportResultCode, hrTimeToMicroseconds } from "@opentelemetry/core";
import { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { Bindings } from "../types/internal";

/**
 * This is implementation of {@link SpanExporter} that prints spans to the
 * console. This class can be used for diagnostic purposes.
 *
 * NOTE: This {@link SpanExporter} is intended for diagnostics use only, output rendered to the console may change at any time.
 */

/* eslint-disable no-console */
export class ConsoleSpanExporter implements SpanExporter {
	/**
	 * Export spans.
	 * @param spans
	 * @param resultCallback
	 */
	export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
		return this._sendSpans(spans, resultCallback);
	}

	/**
	 * Shutdown the exporter.
	 */
	shutdown(): Promise<void> {
		this._sendSpans([]);
		return this.forceFlush();
	}

	/**
	 * Exports any pending spans in exporter
	 */
	forceFlush(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * converts span info into more readable format
	 * @param span
	 */
	private _exportInfo(span: ReadableSpan) {
		return {
			resource: {
				attributes: span.resource.attributes,
			},
			instrumentationScope: span.instrumentationLibrary,
			traceId: span.spanContext().traceId,
			parentSpanContext: span.parentSpanId,
			traceState: span.spanContext().traceState?.serialize(),
			name: span.name,
			id: span.spanContext().spanId,
			kind: span.kind,
			timestamp: hrTimeToMicroseconds(span.startTime),
			duration: hrTimeToMicroseconds(span.duration),
			attributes: span.attributes,
			status: span.status,
			events: span.events,
			links: span.links,
		};
	}

	/**
	 * Showing spans in console
	 * @param spans
	 * @param done
	 */
	private _sendSpans(spans: ReadableSpan[], done?: (result: ExportResult) => void): void {
		for (const span of spans) {
			console.log(this._exportInfo(span), { depth: 3 });
		}
		if (done) {
			return done({ code: ExportResultCode.SUCCESS });
		}
	}
}

export const OTelConfFn: ResolveConfigFn = (env: Bindings) => {
	const exporter = env.HONEYCOMB_API_KEY
		? {
				url: "https://api.honeycomb.io/v1/traces",
				headers: {
					"x-honeycomb-team": env.HONEYCOMB_API_KEY,
					"x-honeycomb-dataset": env.HONEYCOMB_DATASET ?? "onotify-prod",
				},
		  }
		: new ConsoleSpanExporter();
	return {
		exporter,
		service: { name: "onotify" },
	};
};

export const runInSpan = <T>(tracer: Tracer, spanName: string, attributes: SpanOptions, fn: (span: Span) => T) => {
	return tracer.startActiveSpan(spanName, attributes, (span) => {
		const ret = fn(span);
		span.end();
		return ret;
	});
};
