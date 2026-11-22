export interface Diagnostic {
  code: string;
  message: string;
}

export type CliCommand =
  | "help"
  | "validate-config"
  | "validate-task"
  | "validate-gates";

export interface CliParseResult {
  exitCode: number;
  command: CliCommand;
  options: Record<string, string>;
  diagnostics: Diagnostic[];
}

const usage =
  "Usage: medicloud-agent-company <validate-config|validate-task|validate-gates|help> [options]";
const commands = new Set<CliCommand>([
  "help",
  "validate-config",
  "validate-task",
  "validate-gates",
]);

export function parseCliArgs(argv: string[]): CliParseResult {
  const commandArg = argv[0];
  if (commandArg === undefined) {
    return result("help", 1, {}, [{ code: "CLI_USAGE", message: usage }]);
  }
  if (commandArg.startsWith("-")) {
    return result("help", 1, {}, [{ code: "CLI_COMMAND_REQUIRED", message: usage }]);
  }
  if (!commands.has(commandArg as CliCommand)) {
    return result("help", 1, {}, [{ code: "CLI_UNKNOWN_COMMAND", message: usage }]);
  }
  const command = commandArg as CliCommand;
  if (command === "help") {
    return argv.length === 1
      ? result(command, 0)
      : result(command, 1, {}, [{ code: "CLI_UNEXPECTED_ARGUMENT", message: "The help command does not accept arguments." }]);
  }

  const options: Record<string, string> = {};
  const args = argv.slice(1);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      return result(command, 1, options, [{ code: "CLI_UNEXPECTED_ARGUMENT", message: `Unexpected argument: ${arg}` }]);
    }
    const name = arg.slice(2);
    const value = args[index + 1];
    if (!name || !value || value.startsWith("--")) {
      return result(command, 1, options, [{ code: "CLI_OPTION_VALUE_MISSING", message: `Option --${name} requires a value.` }]);
    }
    if (name !== "root" && name !== "file" && name !== "task" && name !== "evidence") {
      return result(command, 1, options, [{ code: "CLI_UNKNOWN_OPTION", message: `Unknown option: --${name}` }]);
    }
    if (options[name] !== undefined) {
      return result(command, 1, options, [{ code: "CLI_DUPLICATE_OPTION", message: `Option --${name} was provided more than once.` }]);
    }
    options[name] = value;
    index += 1;
  }

  const required = command === "validate-task" ? ["file"] : command === "validate-gates" ? ["task", "evidence"] : [];
  const missing = required.find((name) => options[name] === undefined);
  if (missing) {
    return result(command, 1, options, [{ code: "CLI_OPTION_REQUIRED", message: `Option --${missing} is required.` }]);
  }

  return result(command, 1, options, [{
    code: "NOT_IMPLEMENTED",
    message: `${command} validation is implemented in a later framework task.`,
  }]);
}

export function formatCliOutput(result: CliParseResult): string {
  const output = {
    exitCode: result.exitCode,
    command: result.command,
    options: result.options,
    diagnostics: result.diagnostics,
    ...(result.command === "help" ? { usage } : {}),
  };
  return JSON.stringify(output);
}

function result(
  command: CliCommand,
  exitCode: number,
  options: Record<string, string> = {},
  diagnostics: Diagnostic[] = [],
): CliParseResult {
  return { exitCode, command, options, diagnostics };
}
