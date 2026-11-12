/* OVEREO backend — start: `node dist/server.js` (see README.md). */
import http from "node:http";
import { checkConfig, config } from "./config.js";
import { openDb, closeDb } from "./db/db.js";
import { migrate } from "./migrate.js";
import { buildApp } from "./app.js";

const problems = checkConfig();
if (problems.length) {
  console.error("OVEREO backend can't start:\n - " + problems.join("\n - "));
  process.exit(1);
}

const d = await openDb(config.databaseUrl);
if (config.autoMigrate) await migrate();
const server = http.createServer(buildApp());
server.headersTimeout = 20_000;
server.requestTimeout = 60_000;
server.keepAliveTimeout = 65_000;
server.listen(config.port, config.host, () => console.log(JSON.stringify({ level: "info", msg: `OVEREO backend on :${config.port}`, db: d.name })));

const stop = (sig: string) => {
  console.log(JSON.stringify({ level: "info", msg: `${sig}: shutting down` }));
  server.close(() => void closeDb().then(() => process.exit(0)));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));
