import { resolve } from "node:path";
import { parseCliArgs, type CliParseResult, type Diagnostic } from "./index.js";

export function resolveProjectRoot(cwd: string, requestedRoot?: string): string {
  return resolve(cwd, requestedRoot ?? ".");
}

export function validateProjectRoot(root: string, hasFrameworkDirectory: boolean): Diagnostic[] {
  if (hasFrameworkDirectory) return [];
  return [{
    code: "PROJECT_ROOT_INVALID",
    message: `Selected root does not contain .medicloud/agent-company: ${root}`,
  }];
}

export function prepareCliResult(
  argv: string[],
  cwd: string,
  hasFrameworkDirectory: boolean,
): CliParseResult {
  const result = parseCliArgs(argv);
  if (result.command === "help" || result.diagnostics.some(({ code }) => code !== "NOT_IMPLEMENTED")) {
    return result;
  }

  const root = resolveProjectRoot(cwd, result.options.root);
  const diagnostics = validateProjectRoot(root, hasFrameworkDirectory);
  if (diagnostics.length === 0) return result;
  return { ...result, exitCode: 1, diagnostics };
}
