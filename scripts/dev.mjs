import { spawn } from "node:child_process";

const server = spawn("npx", ["tsx", "watch", "server/index.ts"], { stdio: "inherit" });
const client = spawn("npx", ["vite"], { stdio: "inherit" });

function stop() {
  server.kill("SIGTERM");
  client.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
