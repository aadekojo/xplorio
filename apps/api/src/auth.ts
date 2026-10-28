import type { ApiRequest } from "./http.js";

/**
 * Who is calling. Until sign-in lands (build step 4) every caller is the same demo user.
 *
 * Step 4 replaces this with Entra External ID token validation. The rule stays the same:
 * handlers only ever get the user ID from here, never from the request body or query.
 */
export function resolveUserId(_req: ApiRequest): string {
  return "demo-user";
}
