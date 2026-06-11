import { spawn, spawnSync } from "node:child_process";

const migration = spawnSync(
  process.execPath,
  ["./node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit" },
);

if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

const port =
  process.env.PORT ||
  (process.env.RAILWAY_ENVIRONMENT ? "3000" : "3100");
const server = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "start", "--port", port],
  { stdio: "inherit" },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", code => process.exit(code ?? 1));
