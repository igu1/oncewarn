# oncewarn

**Warn when something that should be rare happens too often.**

> One small problem. One obvious API. Very little setup. Immediate value.

---

## Problem

Many application bugs come from actions unexpectedly running repeatedly:

- initialization called many times
- API request inside a rerender loop
- duplicate event listeners
- analytics event firing repeatedly
- database call inside a loop

`oncewarn` is a tiny, zero-dependency runtime that counts labelled actions and
warns — with `first: file:line` and `latest: file:line` — when those counts go
past the thresholds you choose.

## Install

```bash
npm i oncewarn
```

## Usage

```ts
import { onceWarn, once, limit, rateLimitWarn } from "oncewarn";

// runs every time, but warns once the same thing runs twice or more
onceWarn("load-user", () => loadUser());

// runs exactly once; warns that initialization ran again
once("app-init", () => initializeApp());

// warn once every call past the threshold
limit("email-send", 5, sendEmail);

// sliding-window rate guard
rateLimitWarn("search-request", { max: 10, window: 1000 });
```

### Default output

```
⚠ "load-user" executed 47 times (threshold 1)
   First:  UserProvider.tsx:31:5
   Latest: Dashboard.tsx:81:11

⚠ rate: "search-request" fired 11 times in 1000ms (max 10)
   At: Dashboard.tsx:42:1
```

## API

```ts
import * as ow from "oncewarn";

ow.onceWarn(label, fn)          // warn from the 2nd execution onward
ow.once(label, fn)              // actually run fn once; later calls warn + are ignored
ow.limit(label, threshold, fn)  // warn past threshold, keep running
ow.warnAfter(label, t, fn)      // alias for limit
ow.rateLimitWarn(label, opts)   // sliding-window rate warnings
ow.wrap(label, fn, t?)          // decorator form returning a callable
ow.count(label)                 // plain counter
ow.counters()                   // snapshot of all labels
ow.snapshot()                   // counters + buffered warnings
ow.reset(label?)                // clear counters (all, if no label)
ow.bufferWarnings()             // list warnings collected in "buffer" mode
ow.configure({ output, now })   // output: "console" | "silent" | "buffer" | logger
```

### Modes

| mode | behavior |
|---|---|
| `"console"` (default) | pass messages to `console.warn` |
| `"silent"` | keep counters but suppress printing |
| `"buffer"` | stash warning strings in a list, good for tests: `ow.bufferWarnings()` |
| function | custom logger |

## Notes

- Zero dependencies. ESM + CJS + `.d.ts` via tsup.
- Node >= 18.

## License

MIT
