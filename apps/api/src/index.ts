import { createApp } from "./app";
import { loadConfig } from "./config";
import { startTimeoutWorker } from "./workers/timeout";
import { APP_NAME } from "@xs-share/shared";

const config = loadConfig();
const app = createApp(config);

if (process.env.DISABLE_WORKERS !== "true") {
  startTimeoutWorker();
}

app.listen(config.API_PORT);

console.log(
  `${APP_NAME} API listening on http://localhost:${config.API_PORT}`,
);

export type App = typeof app;
