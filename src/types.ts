/** A recorded call-site extracted from a stack trace. */
export interface CallSite {
  file: string;
  line: number;
  column: number;
  /** Rendered as `file:line:column`. */
  text: string;
}

export interface CounterReport {
  label: string;
  count: number;
  /** How many times a warning has been emitted for this label. */
  warnings: number;
  /** First recorded call site. */
  first?: CallSite;
  /** Most recent call site. */
  latest?: CallSite;
}

export interface RateListEntry {
  ts: number;
}

export interface RateOptions {
  /** Maximum allowed calls inside the sliding window (default 5). */
  max?: number;
  /** Sliding window in milliseconds (default 1000). */
  window?: number;
}

export interface OnceWarnConfig {
  /**
   * Where warnings go. `silent` keeps counters without printing; `buffer`
   * collects warning strings for tests; anything else is treated as a logger.
   * Defaults to `console.warn`.
   */
  output?: "console" | "silent" | "buffer" | ((message: string) => void);
  /** Capture call sites from stack traces (default: true). */
  sources?: boolean;
}

export interface OnceWarnStatsSnapshot {
  counters: CounterReport[];
  buffer: string[];
}
