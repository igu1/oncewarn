import * as ow from "../src/index";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[90m${s}\x1b[0m`;

console.log(dim("$ npm i oncewarn\n"));
console.log(dim("// examples/example.ts\n"));

console.log(green("1. once() — initialization should be rare:"));
let ran = 0;
ow.once("app-init", () => {
  ran++;
});
console.log(dim("// runs once, no warnings\n"));

console.log(green("2. call it twice — see the warning appear\n"));
ow.once("app-init", () => {
  ran++;
});

console.log(green("3. onceWarn() — warn when an action repeats\n"));
for (let i = 1; i <= 4; i++) {
  ow.onceWarn("load-user", () => i);
}
console.log(dim("(nothing on run 1; warnings from run 2 onward)\n"));

console.log(green("4. count + report for a label\n"));
const viewport = ow.counters().find((c) => c.label === "load-user");
console.log(viewport);

console.log(green("\n5. rateLimitWarn() — sliding window\n"));
let t = 0;
ow.configure({ now: () => t });
for (let i = 0; i < 12; i++) {
  ow.rateLimitWarn("search", { max: 10, window: 1000 });
  t += 50;
}

console.log(green("\n6. all counters\n"));
console.table(
  ow.counters().map((c) => ({ label: c.label, count: c.count, warnings: c.warnings })),
);
