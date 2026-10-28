import { app } from "@azure/functions";
import { health } from "../health.js";
import { storeKind } from "../routes.js";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async () => health(new Date(), storeKind),
});
