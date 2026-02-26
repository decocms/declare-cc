import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI = join(__dirname, "../../src/cli/index.ts");
const TMP = join(__dirname, "../../test-results/cli-test");

function run(cmd: string, cwd?: string): string {
  return execSync(`bun run ${CLI} ${cmd}`, {
    cwd: cwd ?? TMP,
    env: { ...process.env, DCL_PROJECT_ROOT: cwd ?? TMP },
    timeout: 10_000,
  }).toString();
}

test.describe("CLI", () => {
  test.beforeAll(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
    mkdirSync(TMP, { recursive: true });
  });

  test.afterAll(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  });

  test("dcl init scaffolds .planning/", () => {
    const output = run("init");
    expect(output).toContain("Initialized");
    expect(existsSync(join(TMP, ".planning", "FUTURE.md"))).toBe(true);
    expect(existsSync(join(TMP, ".planning", "MILESTONES.md"))).toBe(true);
    expect(existsSync(join(TMP, ".planning", "config.json"))).toBe(true);
  });

  test("dcl init is idempotent", () => {
    const output = run("init");
    expect(output).toContain("already");
  });

  test("dcl status shows graph info", () => {
    const output = run("status");
    expect(output).toContain("Project:");
    expect(output).toContain("Graph:");
    expect(output).toContain("Validation:");
  });

  test("dcl unknown command shows error", () => {
    try {
      run("nonexistent");
      expect(true).toBe(false); // should not reach
    } catch (err: any) {
      expect(err.stderr?.toString() || err.message).toContain("Unknown command");
    }
  });
});
