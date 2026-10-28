// Framework-neutral request/response shapes. The same handlers run under Azure Functions
// (functions/flights.ts) and the local dev server (dev-server.ts).

export interface ApiRequest {
  method: string;
  params: Record<string, string>;
  query: URLSearchParams;
  headers: Headers;
  /** Parsed JSON body, or undefined when there is none. */
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

/** An expected failure with a message that is safe to show the user. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const ok = (body: unknown): ApiResponse => ({ status: 200, body });
export const created = (body: unknown): ApiResponse => ({ status: 201, body });
export const noContent = (): ApiResponse => ({ status: 204 });

/** Turns any thrown error into a response, without leaking internals for unexpected ones. */
export function toErrorResponse(err: unknown): ApiResponse {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  console.error(err);
  return { status: 500, body: { error: "Something went wrong. Please try again." } };
}
