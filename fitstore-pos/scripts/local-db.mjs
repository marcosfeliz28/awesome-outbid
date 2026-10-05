import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const dbDir = new URL("../.local-db", import.meta.url).pathname;
const database = new EmbeddedPostgres({
  databaseDir: dbDir,
  user: "fitstore",
  password: "fitstore_local",
  port: 5434,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: [
    "-c",
    "listen_addresses=127.0.0.1",
    "-c",
    `unix_socket_directories=${dbDir}`,
  ],
  onLog: () => {},
  onError: (error) => console.error(String(error)),
});
if (!existsSync(dbDir + "/PG_VERSION")) await database.initialise();
await database.start();
try {
  await database.createDatabase("fitstore");
} catch (e) {
  if (!String(e).includes("already exists")) throw e;
}
console.log("PostgreSQL listo en 127.0.0.1:5434. Ctrl+C para detener.");
process.on("SIGINT", async () => {
  await database.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await database.stop();
  process.exit(0);
});
setInterval(() => {}, 30000);
