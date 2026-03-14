import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT || 3001);
const app = createApp();

serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
});
