import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const EXPECTED_GITHUB_OWNER = "CWE-119";
const EXPECTED_GITHUB_REPO = "focus-flow-dashboard";
const EXPECTED_REPOSITORY_URL = `https://github.com/${EXPECTED_GITHUB_OWNER}/${EXPECTED_GITHUB_REPO}.git`;
const WINDOWS_RELEASE_WORKFLOW = ".github/workflows/release-windows.yml";

const fail = (message) => {
  console.error(`release-check: ${message}`);
  process.exitCode = 1;
};

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const trackedDbFiles = git("ls-files")
  .split("\n")
  .filter((file) => /(^|\/).+\.(db|sqlite3?|db-wal|db-shm|sqlite3?-wal|sqlite3?-shm)$/i.test(file));

if (trackedDbFiles.length) {
  fail(`SQLite runtime files are tracked: ${trackedDbFiles.join(", ")}`);
}

const statusLines = git("status", "--short")
  .split("\n")
  .filter(Boolean);
const dbStatus = statusLines.filter((line) => {
  if (!/\.(db|sqlite3?|db-wal|db-shm|sqlite3?-wal|sqlite3?-shm)$/i.test(line)) return false;
  const status = line.slice(0, 2);
  return !status.includes("D");
});

if (dbStatus.length) {
  fail(`SQLite runtime files are dirty/untracked: ${dbStatus.join("; ")}`);
}

const backendPackage = JSON.parse(readFileSync("backend/package.json", "utf8"));
if (backendPackage.main !== "index.js") {
  fail("backend/package.json main must be index.js");
}

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
for (const script of ["test", "build", "build:electron", "publish:electron:win", "release:check"]) {
  if (!rootPackage.scripts?.[script]) {
    fail(`missing package script: ${script}`);
  }
}

const repositoryUrl =
  typeof rootPackage.repository === "string"
    ? rootPackage.repository
    : rootPackage.repository?.url;
if (repositoryUrl !== EXPECTED_REPOSITORY_URL) {
  fail(`package.json repository must be ${EXPECTED_REPOSITORY_URL}`);
}

const windowsPublishScript = rootPackage.scripts?.["publish:electron:win"] || "";
for (const commandPart of ["electron-builder --win", "--publish always"]) {
  if (!windowsPublishScript.includes(commandPart)) {
    fail(`publish:electron:win must include: ${commandPart}`);
  }
}

const builderConfig = JSON.parse(readFileSync("electron-builder.json", "utf8"));
const githubPublish = Array.isArray(builderConfig.publish)
  ? builderConfig.publish[0]
  : builderConfig.publish;

if (githubPublish?.provider !== "github") {
  fail("electron-builder publish provider must be github");
}
if (githubPublish?.owner !== EXPECTED_GITHUB_OWNER) {
  fail(`electron-builder publish owner must be ${EXPECTED_GITHUB_OWNER}`);
}
if (githubPublish?.repo !== EXPECTED_GITHUB_REPO) {
  fail(`electron-builder publish repo must be ${EXPECTED_GITHUB_REPO}`);
}
if (githubPublish?.releaseType !== "draft") {
  fail("electron-builder GitHub releases must remain draft until all assets upload");
}
if (/your[-_ ]?(user)?name|change[-_ ]?me|example/i.test(JSON.stringify(githubPublish))) {
  fail("electron-builder publish config still contains placeholder metadata");
}
if (builderConfig.win?.signAndEditExecutable === false) {
  fail("win.signAndEditExecutable must not disable executable metadata or signing");
}

if (!existsSync(WINDOWS_RELEASE_WORKFLOW)) {
  fail(`missing Windows release workflow: ${WINDOWS_RELEASE_WORKFLOW}`);
} else {
  const workflow = readFileSync(WINDOWS_RELEASE_WORKFLOW, "utf8");
  const requiredWorkflowParts = [
    "contents: write",
    "windows-latest",
    "npm ci",
    "npm run release:check",
    "electron-builder --win --publish always",
    "GITHUB_REF_NAME",
    "secrets.GITHUB_TOKEN",
    "gh release edit",
    "--draft=false",
  ];

  for (const workflowPart of requiredWorkflowParts) {
    if (!workflow.includes(workflowPart)) {
      fail(`${WINDOWS_RELEASE_WORKFLOW} must include: ${workflowPart}`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("release-check: static release guards passed");
