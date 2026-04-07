const path = require("path");
const { spawn } = require("child_process");
const { loadGestSchoolEnv } = require("./load-env.cjs");

const appDir = path.resolve(__dirname, "..");
loadGestSchoolEnv(appDir);

const prismaCliPath = require.resolve("prisma/build/index.js", {
  paths: [appDir]
});
const child = spawn(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  cwd: appDir,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Unable to start Prisma CLI.", error);
  process.exit(1);
});
