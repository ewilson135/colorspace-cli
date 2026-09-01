# colorspace-cli

A small library and CLI for converting colors between hex, `rgb()`, and
`hsl()` notation.

The usual reason I need this: a design tool exports a palette as hex codes,
but the CSS or config I'm writing wants `hsl()` so I can tweak lightness by
hand. Doing that conversion by eye is error-prone past the first two colors,
so this does the arithmetic instead.

## Library

```ts
import { parseColor, formatColor } from "./src/color.js";

const rgb = parseColor("#ff8800");
formatColor(rgb, "hsl"); // "hsl(32, 100%, 50%)"
```

`parseColor` accepts hex (`#f80`, `#ff8800`, with or without the `#`),
`rgb(r, g, b)`, and `hsl(h, s%, l%)`, and normalizes all of them to an
`{ r, g, b }` object. `formatColor` goes the other way, rendering that
object as hex, rgb, or hsl text.

## CLI

Build first (requires the TypeScript compiler):

```
tsc
```

Then run it against a file, one color per line:

```
$ cat palette.txt
#ff8800
rgb(20, 20, 20)
hsl(210, 50%, 40%)
$ node dist/cli.js --to hsl palette.txt
#ff8800 -> hsl(32, 100%, 50%)
rgb(20, 20, 20) -> hsl(0, 0%, 8%)
hsl(210, 50%, 40%) -> hsl(210, 50%, 40%)
```

Or pipe colors in instead of naming a file:

```
$ echo '#336699' | node dist/cli.js --to rgb
#336699 -> rgb(51, 102, 153)
```

Lines that don't parse are reported on stderr and skipped, so one bad line
in a large palette file doesn't stop the rest from converting.

## Status

Handles hex, rgb, and hsl. No test suite yet, no alpha channel support, no
support for other color spaces (Lab, XYZ, oklch) — see the roadmap in the
project notes for what's planned.
