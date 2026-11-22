import { statSync } from "node:fs";
import { join } from "node:path";
import { formatCliOutput } from "./index.js";
import { prepareCliResult, resolveProjectRoot } from "./project-root.js";

const cwd = process.cwd();
const rootOptionIndex = process.argv.indexOf("--root", 2);
const requestedRoot = rootOptionIndex < 0 ? undefined : process.argv[rootOptionIndex + 1];
const selectedRoot = resolveProjectRoot(cwd, requestedRoot);
let hasFrameworkDirectory = false;
try {
  hasFrameworkDirectory = statSync(join(selectedRoot, ".medicloud", "agent-company")).isDirectory();
} catch {
  hasFrameworkDirectory = false;
}
const result = prepareCliResult(process.argv.slice(2), cwd, hasFrameworkDirectory);
process.stdout.write(`${formatCliOutput(result)}\n`);
process.exitCode = result.exitCode;
