import type { CallSite, OnceWarnConfig } from "./types";

const isNode =
  typeof process !== "undefined" && typeof process.stdout !== "undefined";

/** Simple ANSI helpers. Colors auto-disable when not writing to a TTY. */
export const supportsColor: boolean =
  isNode ? Boolean((process.stderr as { isTTY?: boolean }).isTTY) : false;

export const c = {
  gray: (s: string) => (supportsColor ? `\x1b[90m${s}\x1b[0m` : s),
  yellow: (s: string) => (supportsColor ? `\x1b[33m${s}\x1b[0m` : s),
} as const;

const thisModuleDir = "oncewarn";

/**
 * Extract the first meaningful call site from an Error stack.
 * Skips internal frames (node internals + this package's own files).
 */
export function getCallSite(): CallSite | undefined {
  const err = new Error();
  const lines = (err.stack ?? "").split("\n").slice(1);
  for (const line of lines) {
    if (!line.includes("at ")) continue;
    if (line.includes("node:internal")) continue;
    if (line.includes("oncewarn/src/") || line.includes("oncewarn/dist/")) continue;
    if (line.includes("node_modules")) continue;
    if (line.includes("<anonymous>")) continue;

    const match = line.match(
      /at\s+(?:.*?\s)?\(?([^\s()]+\.(?:ts|tsx|js|jsx|mjs|cjs))(?:\?[^\s()]*)?:(\d+):(\d+)\)?/,
    );
    if (match) {
      const file = match[1];
      const lineNo = Number(match[2]);
      const col = Number(match[3]);
      return { file, line: lineNo, column: col, text: `${file}:${lineNo}:${col}` };
    }
  }
  return undefined;
}

let output: OnceWarnConfig["output"] = "console";
const buffer: string[] = [];

export function configureOutput(next: OnceWarnConfig["output"]) {
  output = next;
}

export function emitWarning(message: string): void {
  if (output === "console") {
    // eslint-disable-next-line no-console
    console.warn(`\n${message}`);
  } else if (output === "buffer") {
    buffer.push(message);
  } else if (typeof output === "function") {
    output(message);
  }
}

export function readBuffer(): string[] {
  return buffer.slice();
}

export function clearBuffer(): void {
  buffer.length = 0;
}

/**
 * Human friendly formatting of a "ran too often" warning:
 *
 *   ⚠ "load-user" executed 47 times
 *      First:  UserProvider.tsx:31:5
 *      Latest: Dashboard.tsx:81:11
 */
export function formatRepeatedWarning(
  label: string,
  count: number,
  threshold: number,
  first?: CallSite,
  latest?: CallSite,
): string {
  const lines: string[] = [];
  lines.push(c.yellow(`⚠ ${JSON.stringify(label)} executed ${count} times (threshold ${threshold})`));
  if (first) lines.push(`   First:  ${first.text}`);
  if (latest && first?.text !== latest?.text) lines.push(`   Latest: ${latest.text}`);
  return lines.join("\n");
}

export function formatRateWarning(
  label: string,
  actual: number,
  max: number,
  windowMs: number,
  where?: CallSite,
): string {
  const lines: string[] = [];
  lines.push(
    c.yellow(`⚠ rate: ${JSON.stringify(label)} fired ${actual} times in ${windowMs}ms (max ${max})`),
  );
  if (where) lines.push(`   At: ${where.text}`);
  return lines.join("\n");
}
