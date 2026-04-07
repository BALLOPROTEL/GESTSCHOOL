const fs = require("fs");
const path = require("path");

const systemEnvKeys = new Set(Object.keys(process.env));

function loadEnvFile(filePath, options = {}) {
  const { override = false } = options;

  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const hasExistingValue = Object.prototype.hasOwnProperty.call(process.env, key);
    const protectedByShellEnv = systemEnvKeys.has(key);
    if (hasExistingValue && (!override || protectedByShellEnv)) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadGestSchoolEnv(appDir) {
  const repoDir = path.resolve(appDir, "..", "..");

  loadEnvFile(path.join(repoDir, ".env.example"));
  loadEnvFile(path.join(appDir, ".env.example"), { override: true });
  loadEnvFile(path.join(repoDir, ".env"), { override: true });
  loadEnvFile(path.join(appDir, ".env"), { override: true });

  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}

module.exports = {
  loadGestSchoolEnv
};
