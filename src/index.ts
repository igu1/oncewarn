import {
  clearBuffer,
  configureOutput,
  emitWarning,
  formatRateWarning,
  formatRepeatedWarning,
  getCallSite,
  readBuffer,
} from "./format";
import type {
  CallSite,
  CounterReport,
  OnceWarnConfig,
  OnceWarnStatsSnapshot,
  RateOptions,
} from "./types";

interface CounterState {
  count: number;
  warnings: number;
  first?: CallSite;
  latest?: CallSite;
}

interface RateState {
  timestamps: number[];
  /** set while a breach is open; the next warning waits until the window drains */
  warnedThisBreach: boolean;
}

const countersMap = new Map<string, CounterState>();
const rates = new Map<string, RateState>();

type NowFn = () => number;
let now: NowFn = () => Date.now();

/** Configure output / test hooks. */
export function configure(options: OnceWarnConfig & { now?: NowFn } = {}) {
  if (options.output !== undefined) configureOutput(options.output);
  if (options.now) now = options.now;
}

function counterFor(label: string): CounterState {
  let state = countersMap.get(label);
  if (!state) {
    state = { count: 0, warnings: 0 };
    countersMap.set(label, state);
  }
  return state;
}

/**
 * Record that the labelled event happened, returning the new count.
 * Never warns — this is the raw counter behind every mode.
 */
export function count(label: string): number {
  const s = counterFor(label);
  s.count += 1;
  return s.count;
}

/** Read the current count without incrementing. */
export function getCount(label: string): number {
  return countersMap.get(label)?.count ?? 0;
}

/** Snapshot of every label seen so far. */
export function counters(): CounterReport[] {
  return [...countersMap.entries()].map(([label, s]) => ({
    label,
    count: s.count,
    warnings: s.warnings,
    first: s.first,
    latest: s.latest,
  }));
}

/** Warnings collected in "buffer" output mode (useful in tests). */
export function bufferWarnings(): string[] {
  return readBuffer();
}

export function resetBuffer(): void {
  clearBuffer();
}

/**
 * Warn every time `label` runs past `threshold` (throttled: at threshold
 * crossings). `fn` still runs on every call — this is visibility, not
 * enforcement. Returns the result of `fn`.
 */
export function warnAfter<T>(label: string, threshold: number, fn: () => T): T {
  const s = counterFor(label);
  s.count += 1;
  s.latest = getCallSite() ?? s.latest;
  if (s.count === 1) s.first = s.latest;

  if (s.count > threshold) {
    s.warnings += 1;
    emitWarning(formatRepeatedWarning(label, s.count, threshold, s.first, s.latest));
  }
  return fn();
}

/**
 * Warn once a labelled action runs more than once.
 * ```ts
 * onceWarn("load-user", () => loadUser());
 * ```
 */
export function onceWarn<T>(label: string, fn: () => T): T {
  return warnAfter(label, 1, fn);
}

/**
 * Warn when calls exceed `threshold` — a friendlier name for warn-after.
 * ```ts
 * limit("email-send", 5, sendEmail);
 * ```
 */
export function limit<T>(label: string, threshold: number, fn: () => T): T {
  return warnAfter(label, threshold, fn);
}

/**
 * Run `fn` exactly once. Later invocations are ignored (and warned about).
 * ```ts
 * once("app-init", initializeApp);
 * ```
 */
export function once<T>(label: string, fn: () => T): T {
  const s = counterFor(label);
  s.count += 1;
  const site = getCallSite();
  s.latest = site ?? s.latest;
  if (s.count === 1) s.first = s.latest;

  if (s.count > 1) {
    s.warnings += 1;
    emitWarning(formatRepeatedWarning(`${label} (once)`, s.count, 1, s.first, s.latest));
    return undefined as T;
  }  return fn();
}

/**
 * Warn when more than `options.max` calls happen inside `options.window` ms.
 * ```ts
 * rateLimitWarn("search-request", { max: 10, window: 1000 });
 * ```
 */
export function rateLimitWarn(label: string, options: RateOptions = {}): void {
  const max = options.max ?? 5;
  const window = options.window ?? 1000;
  const t = now();

  let r = rates.get(label);
  if (!r) {
    r = { timestamps: [], warnedThisBreach: false };
    rates.set(label, r);
  }
  r.timestamps = r.timestamps.filter((ts) => t - ts <= window);
  r.timestamps.push(t);

  if (r.timestamps.length > max) {
    if (!r.warnedThisBreach) {
      r.warnedThisBreach = true;
      emitWarning(formatRateWarning(label, r.timestamps.length, max, window, getCallSite()));
    }
  } else {
    r.warnedThisBreach = false;
  }
}

/**
 * Wrap a function so every call is counted and warned past a threshold.
 * ```ts
 * const query = onceWarn.wrap("user-query", getUser);
 * ```
 */
export function wrap<T extends (...args: never[]) => unknown>(
  label: string,
  fn: T,
  threshold = 1,
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>) =>
    warnAfter(label, threshold, () => fn(...args)) as ReturnType<T>;
}

export function reset(label?: string): void {
  if (label === undefined) {
    countersMap.clear();
    rates.clear();
  } else {
    countersMap.delete(label);
    rates.delete(label);
  }
}

export function snapshot(): OnceWarnStatsSnapshot {
  return { counters: counters(), buffer: readBuffer() };
}
