import { describe, expect, it } from "vitest";
import { formatCliOutput, parseCliArgs } from "./index.js";

describe("parseCliArgs", () => {
  it("returns a stable usage diagnostic when no command is provided", () => {
    const result = parseCliArgs([]);

    expect(result.exitCode).toBe(1);
    expect(result.command).toBe("help");
    expect(result.diagnostics[0]?.code).toBe("CLI_USAGE");
  });

  it("returns a stable usage diagnostic for an unknown command", () => {
    const result = parseCliArgs(["unknown"]);

    expect(result.exitCode).toBe(1);
    expect(result.diagnostics[0]?.code).toBe("CLI_UNKNOWN_COMMAND");
  });

  it("rejects options or arguments before the command", () => {
    expect(parseCliArgs(["--root", ".", "validate-config"]).diagnostics[0]?.code)
      .toBe("CLI_COMMAND_REQUIRED");
    expect(parseCliArgs(["unexpected", "validate-config"]).diagnostics[0]?.code)
      .toBe("CLI_UNKNOWN_COMMAND");
  });

  it("accepts help without error", () => {
    expect(parseCliArgs(["help"])).toMatchObject({
      exitCode: 0,
      command: "help",
      diagnostics: [],
    });
  });

  it("renders help as deterministic machine-readable JSON", () => {
    const result = parseCliArgs(["help"]);
    const output = formatCliOutput(result);

    expect(output).toBe(formatCliOutput(result));
    expect(JSON.parse(output)).toMatchObject({
      exitCode: 0,
      command: "help",
      diagnostics: [],
      usage: expect.stringContaining("Usage:"),
    });
  });

  it("renders diagnostics as JSON rather than human-only stderr text", () => {
    const output = formatCliOutput(parseCliArgs(["unknown"]));

    expect(JSON.parse(output).diagnostics[0].code).toBe("CLI_UNKNOWN_COMMAND");
  });

  it("parses validation arguments and fails closed until validation is implemented", () => {
    expect(parseCliArgs(["validate-task", "--file", "task.yaml", "--root", "."])).toMatchObject({
      exitCode: 1,
      command: "validate-task",
      options: { file: "task.yaml", root: "." },
      diagnostics: [{ code: "NOT_IMPLEMENTED" }],
    });
  });
});
