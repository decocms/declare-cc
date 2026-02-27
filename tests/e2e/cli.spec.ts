import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI = join(__dirname, "../../src/cli/index.ts");
const PROJECT_ROOT = join(__dirname, "../..");

function run(cmd: string, cwd: string): string {
  if (!existsSync(cwd)) mkdirSync(cwd, { recursive: true });
  return execSync(`bun run ${CLI} ${cmd}`, {
    cwd,
    env: { ...process.env, DCL_PROJECT_ROOT: cwd },
    timeout: 10_000,
  }).toString();
}

test.describe("CLI", () => {
  test("dcl init scaffolds .planning/", () => {
    const tmp = join(PROJECT_ROOT, "test-results/cli-init");
    if (existsSync(tmp)) rmSync(tmp, { recursive: true });
    mkdirSync(tmp, { recursive: true });

    const output = run("init", tmp);
    expect(output).toContain("Initialized");
    expect(existsSync(join(tmp, ".planning", "FUTURE.md"))).toBe(true);
    expect(existsSync(join(tmp, ".planning", "MILESTONES.md"))).toBe(true);
    expect(existsSync(join(tmp, ".planning", "config.json"))).toBe(true);

    // Idempotent re-run
    const output2 = run("init", tmp);
    expect(output2).toContain("already exists");

    rmSync(tmp, { recursive: true });
  });

  test("dcl status shows graph info", () => {
    // Run against the actual project root which has .planning/
    const output = run("status", PROJECT_ROOT);
    expect(output).toContain("Project:");
    expect(output).toContain("Graph:");
    expect(output).toContain("Validation:");
  });

  test("dcl unknown command shows error", () => {
    try {
      run("nonexistent", PROJECT_ROOT);
      expect(true).toBe(false); // should not reach
    } catch (err: any) {
      expect(err.stderr?.toString() || err.message).toContain("Unknown command");
    }
  });
});
