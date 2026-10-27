import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildDocsGuardMessage, findBlockedDocsPaths, listTrackedDocsPaths } from "./check-docs-guard.mjs";

test("findBlockedDocsPaths allows durable docs folders and rejects other docs paths", () => {
  const blocked = findBlockedDocsPaths([
    "docs/as-built/architecture.md",
    "docs/reference/rig-spec.md",
    "docs/releases/v0.1.12.md",
    "docs/plans/2026-04-10-thing.md",
    "docs/local/notes.md",
    "README.md",
    "docs/plans/2026-04-10-thing.md",
  ]);

  assert.deepEqual(blocked, [
    "docs/local/notes.md",
    "docs/plans/2026-04-10-thing.md",
  ]);
});

test("buildDocsGuardMessage explains the policy and offending files", () => {
  const message = buildDocsGuardMessage([
    "docs/plans/example.md",
  ]);

  assert.match(message, /Blocked tracked docs paths/);
  assert.match(message, /docs\/plans\/example\.md/);
  assert.match(message, /docs\/as-built\/, docs\/reference\/, and docs\/releases\//);
});

test("findBlockedDocsPaths allows the ratified docs/DESIGN.md root placement", () => {
  assert.deepEqual(findBlockedDocsPaths(["docs/DESIGN.md"]), []);
});

test("the DESIGN.md exception is exact-path — sibling root docs and plan/note folders stay blocked", () => {
  assert.deepEqual(
    findBlockedDocsPaths([
      "docs/OTHER.md",
      "docs/plans/example.md",
      "docs/notes/scratch.md",
    ]),
    ["docs/OTHER.md", "docs/notes/scratch.md", "docs/plans/example.md"],
  );
});

test("the real check-docs-guard.mjs exits 0 against the actual repository", () => {
  const result = execFileSync(process.execPath, ["scripts/check-docs-guard.mjs"], {
    encoding: "utf8",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.trim(), "");
});

// Git quotes non-ASCII, tabs and newlines in its default line-based output.
test("the real tracked-path reader preserves unusual documentation filenames", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const repo = mkdtempSync(join(tmpdir(), "openrig-docs-guard-"));
  try {
    const blockedUnusual = process.platform === "win32" ? "docs/notes-éxtra.md" : "docs/notes\nextra.md";
    const allowedUnusual = process.platform === "win32" ? "docs/reference/topic — name.md" : "docs/reference/topic\tname.md";
    const paths = [blockedUnusual, "docs/équipe.md", allowedUnusual];
    execFileSync("git", ["init", "--quiet", repo]);
    mkdirSync(join(repo, "docs/reference"), { recursive: true });
    if (process.platform !== "win32") {
      mkdirSync(join(repo, "docs"), { recursive: true });
    }
    for (const file of paths) writeFileSync(join(repo, file), "fixture");
    execFileSync("git", ["add", "--", "docs"], { cwd: repo });
    const tracked = listTrackedDocsPaths((command, args, options) =>
      execFileSync(command, args, { ...options, cwd: repo }));
    assert.deepEqual([...tracked].sort(), [...paths].sort());
    assert.deepEqual(findBlockedDocsPaths(tracked), [blockedUnusual, "docs/équipe.md"].sort());
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
