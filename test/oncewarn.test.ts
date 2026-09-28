import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as ow from "../src/index";

beforeEach(() => {
  ow.reset();
  ow.configure({ output: "buffer" });
});

afterEach(() => {
  ow.resetBuffer();
  ow.configure({ output: "console" });
});

function take(): string[] {
  const w = ow.bufferWarnings();
  ow.resetBuffer();
  return w;
}

describe("oncewarn", () => {
  it("stays silent on first execution", () => {
    ow.onceWarn("load-user", () => 1);
    expect(take()).toHaveLength(0);
    expect(ow.getCount("load-user")).toBe(1);
  });

  it("warns on every execution past one", () => {
    ow.onceWarn("load-user", () => 1);
    ow.onceWarn("load-user", () => 2);
    ow.onceWarn("load-user", () => 3);
    const warned = take();
    expect(warned).toHaveLength(2);
    expect(warned[0]).toContain('"load-user" executed 2 times (threshold 1)');
    expect(warned[1]).toContain('"load-user" executed 3 times (threshold 1)');
  });

  it("once() only runs fn once and warns about repeats", () => {
    let runs = 0;
    ow.once("app-init", () => {
      runs += 1;
    });
    ow.once("app-init", () => {
      runs += 1;
    });
    ow.once("app-init", () => {
      runs += 1;
    });
    expect(runs).toBe(1);
    const warned = take();
    expect(warned).toHaveLength(2);
    expect(warned[0]).toContain('"app-init (once)" executed 2 times');
  });

  it("limit() keeps running but warns on every call past the threshold", () => {
    let sent = 0;
    for (let i = 0; i < 3; i++) ow.limit("email-send", 3, () => (sent += 1));
    expect(sent).toBe(3);
    expect(take()).toHaveLength(0); // threshold not reached yet

    ow.limit("email-send", 3, () => 1); // 4 -> warn
    ow.limit("email-send", 3, () => 1); // 5 -> warn
    ow.limit("email-send", 3, () => 1); // 6 -> warn
    const warned = take();
    expect(warned).toHaveLength(3);
    expect(warned[2]).toContain('"email-send" executed 6 times (threshold 3)');
  });

  it("rateLimitWarn warns inside the sliding window", () => {
    let t = 0;
    ow.configure({ now: () => t });
    for (let i = 0; i < 10; i++) ow.rateLimitWarn("search", { max: 10, window: 1000 });
    expect(take()).toHaveLength(0);

    // 11th call inside the same window breaches the cap
    ow.rateLimitWarn("search", { max: 10, window: 1000 });
    expect(take()).toHaveLength(1);
  });

  it("rateLimitWarn warning allowed only once per breach, resets after drain", () => {
    let t = 0;
    ow.configure({ now: () => t });
    for (let i = 0; i < 40; i++) ow.rateLimitWarn("search", { max: 10, window: 1000 });
    expect(take()).toHaveLength(1);

    t += 3000; // window drains, breach resets
    ow.rateLimitWarn("search", { max: 2, window: 1000 });
    expect(take()).toHaveLength(0);
  });

  it("count() increments and getCount() reads", () => {
    ow.count("db");
    ow.count("db");
    ow.count("db");
    expect(ow.getCount("db")).toBe(3);
    const rec = ow.counters().find((r) => r.label === "db");
    expect(rec?.count).toBe(3);
  });

  it("wrap() returns a callable that warns past threshold", () => {
    let times = 0;
    const query = ow.wrap("user-query", () => (times += 1));
    query();
    expect(take()).toHaveLength(0);
    expect(times).toBe(1);
    query();
    expect(times).toBe(2);
    expect(take()).toHaveLength(1);
  });

  it("captures source call sites", () => {
    ow.onceWarn("with-sources", () => 1);
    ow.onceWarn("with-sources", () => 2);
    take();
    const rec = ow.counters().find((r) => r.label === "with-sources");
    expect(rec?.first?.file).toContain(".ts");
    expect(rec?.latest?.text).toContain(".ts");
  });

  it("reset clears the requested label only", () => {
    ow.count("a");
    ow.count("b");
    ow.reset("a");
    expect(ow.getCount("a")).toBe(0);
    expect(ow.getCount("b")).toBe(1);
  });

  it("reset with no argument clears everything", () => {
    ow.count("a");
    ow.count("b");
    ow.reset();
    expect(ow.counters()).toHaveLength(0);
  });

  it("functions still return their results", async () => {
    const value = await ow.onceWarn("async", async () => "hello");
    expect(value).toBe("hello");
  });
});
