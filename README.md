# colorspace-cli

A small library and CLI for converting colors between hex, `rgb()`,
`hsl()`, and `oklch()` notation.

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
`rgb(r, g, b)`, `hsl(h, s%, l%)`, and `oklch(l c h)`, and normalizes all
of them to an `{ r, g, b }` object. `formatColor` goes the other way,
rendering that object as hex, rgb, hsl, or oklch text.

Alpha is supported everywhere: `#f808` and `#ff880080` (4- and 8-digit
hex), `rgba(r, g, b, a)`, `hsla(h, s%, l%, a)`, and `oklch(l c h / a)`
all parse into an `{ r, g, b, a }` object with `a` in the 0..1 range.
`formatColor` only adds the alpha suffix when the input actually carried
one, so converting an opaque color never adds a stray `, 1` or `ff`.

`oklch(l c h)` follows the CSS syntax: lightness as a plain 0..1 number
or a percentage (`70%`), chroma as a unitless number, and hue in degrees.
The conversion goes through linear sRGB and OKLab, using the matrices
from Björn Ottosson's OKLab writeup — the same math browsers use for
`oklch()` colors in CSS.

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

```
$ echo '#000000' | node dist/cli.js --to oklch
#000000 -> oklch(0 0 0)
```

Lines that don't parse are reported on stderr and skipped, so one bad line
in a large palette file doesn't stop the rest from converting.

## Tests

```
npm test
```

Runs the conversion tests in `src/color.test.ts` through Node's built-in
test runner (`node --test`), after compiling with `tsc`.

## Status

Handles hex, rgb, hsl, and oklch, including alpha. No support for Lab or
XYZ yet — see the roadmap in the project notes for what's planned.
