const path = require("path");
const { loadGestSchoolEnv } = require("./load-env.cjs");

const appDir = path.resolve(__dirname, "..");
loadGestSchoolEnv(appDir);

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error("Missing TypeScript script path.");
  process.exit(1);
}

require("ts-node/register/transpile-only");
require(path.resolve(appDir, scriptPath));
