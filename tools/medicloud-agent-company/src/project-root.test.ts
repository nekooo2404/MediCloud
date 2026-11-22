import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareCliResult, resolveProjectRoot, validateProjectRoot } from "./project-root.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("resolveProjectRoot", () => {
  it("uses the current working directory when no root is requested", () => {
    expect(resolveProjectRoot("/clone/MediCloud")).toBe(resolve("/clone/MediCloud"));
  });

  it("uses the requested root exactly and does not search its parents", async () => {
    const parent = await mkdtemp(join(tmpdir(), "medicloud-parent-"));
    const project = join(parent, "project");
    temporaryDirectories.push(parent);

    expect(resolveProjectRoot(join(parent, "nested", "cwd"), project)).toBe(resolve(project));
    expect(resolveProjectRoot(project)).toBe(resolve(project));
  });

  it("rejects a selected root without the local framework directory", () => {
    const selectedRoot = resolve("/clone/other-project");

    expect(validateProjectRoot(selectedRoot, false)).toEqual([{
      code: "PROJECT_ROOT_INVALID",
      message: `Selected root does not contain .medicloud/agent-company: ${selectedRoot}`,
    }]);
  });

  it("prepares a fail-closed CLI result for the selected invalid root", () => {
    const result = prepareCliResult(["validate-config", "--root", "/clone/other-project"], "/clone/MediCloud", false);

    expect(result.exitCode).toBe(1);
    expect(result.diagnostics[0]?.code).toBe("PROJECT_ROOT_INVALID");
    expect(result.options.root).toBe("/clone/other-project");
  });
});
