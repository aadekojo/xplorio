import { createApiClient } from "@xplorio/api-client";

/**
 * EXPO_PUBLIC_API_URL is baked in at build time. Locally it defaults to the dev server
 * (`pnpm dev` starts both); the deploy workflow sets it to the Function App's URL.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:7071/api";

// No sign-in yet (build step 4); every request is the demo user.
export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: async () => undefined,
});
