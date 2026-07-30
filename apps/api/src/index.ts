import { createApp } from "./app";
import { loadConfig } from "./config";
import { assertProductionGuards } from "./lib/production-guards";
import { startTimeoutWorker } from "./workers/timeout";
import { startChainDepositWorker } from "./workers/chain-deposit";
import { APP_NAME } from "@xs-share/shared";

const config = loadConfig();
assertProductionGuards(config);
const app = createApp(config);

if (process.env.DISABLE_WORKERS !== "true") {
  startTimeoutWorker();
  startChainDepositWorker();
}

app.listen(config.API_PORT);

console.log(
  `${APP_NAME} API listening on http://localhost:${config.API_PORT}`,
);

export type App = typeof app;
