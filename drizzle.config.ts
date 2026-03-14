import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./apps/api/src/schema.ts",
  dbCredentials: {
    url: "./var/virellio.sqlite",
  },
});
