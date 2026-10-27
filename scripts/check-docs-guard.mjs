import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ALLOWED_DOCS_FILES = new Set(["docs/DESIGN.md"]);

export function findBlockedDocsPaths(paths) {
  return [...new Set(paths)]
    .filter((file) => file.startsWith("docs/"))
    .filter((file) => !file.startsWith("docs/as-built/"))
    .filter((file) => !file.startsWith("docs/reference/"))
    .filter((file) => !file.startsWith("docs/releases/"))
    .filter((file) => !ALLOWED_DOCS_FILES.has(file))
    .sort();
}

export function listTrackedDocsPaths(exec = execFileSync) {
  const output = exec("git", ["ls-files", "-z", "docs/**"], { encoding: "utf8" });
  return output
    .split("\0")
    .filter(Boolean);
}

export function buildDocsGuardMessage(blockedPaths) {
  const lines = [
    "Blocked tracked docs paths detected outside docs/as-built/, docs/reference/, and docs/releases/:",
    ...blockedPaths.map((file) => `- ${file}`),
    "",
    "Only docs/as-built/, docs/reference/, and docs/releases/ are allowed to be tracked.",
    "Keep plans and local notes untracked under docs/ or move durable docs into docs/as-built/, docs/reference/, or docs/releases/ if they truly belong in git.",
  ];
  return lines.join("\n");
}

export function main() {
  const blockedPaths = findBlockedDocsPaths(listTrackedDocsPaths());
  if (blockedPaths.length === 0) return;
  console.error(buildDocsGuardMessage(blockedPaths));
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
