import { z } from "zod";

const InternalServerError = {
	description: "Internal Server Error",
	"text/plain": {
		schema: z.string(),
	},
};

const BadRequest = {
	description: "Bad Request",
	"text/plain": {
		schema: z.string(),
	},
};

const Unauthorized = {
	description: "Unauthorized",
	"text/plain": {
		schema: z.string(),
	},
};

export const Errors = {
	"400": BadRequest,
	"401": Unauthorized,
	"500": InternalServerError,
};

export enum HTTPResponses {
	OK = 200,
	BadRequest = 400,
	Unauthorized = 401,
	NotFound = 404,
	InternalServerError = 500,
}
