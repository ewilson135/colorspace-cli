# colorspace-cli

A small library and CLI for converting colors between hex, `rgb()`,
`hsl()`, `oklch()`, and `lab()` notation.

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
`rgb(r, g, b)`, `hsl(h, s%, l%)`, `oklch(l c h)`, and `lab(l a b)`, and
normalizes all of them to an `{ r, g, b }` object. `formatColor` goes
the other way, rendering that object as hex, rgb, hsl, oklch, or lab text.

Alpha is supported everywhere: `#f808` and `#ff880080` (4- and 8-digit
hex), `rgba(r, g, b, a)`, `hsla(h, s%, l%, a)`, `oklch(l c h / a)`, and
`lab(l a b / a)` all parse into an `{ r, g, b, a }` object with `a` in
the 0..1 range. `formatColor` only adds the alpha suffix when the input
actually carried one, so converting an opaque color never adds a stray
`, 1` or `ff`.

`oklch(l c h)` follows the CSS syntax: lightness as a plain 0..1 number
or a percentage (`70%`), chroma as a unitless number, and hue in degrees.
The conversion goes through linear sRGB and OKLab, using the matrices
from Björn Ottosson's OKLab writeup — the same math browsers use for
`oklch()` colors in CSS.

`lab(l a b)` is CIE Lab: lightness 0..100 (as a plain number or a
percentage — they mean the same thing for `lab()`), and `a`/`b` as
unitless numbers along the green-red and blue-yellow axes, roughly
-125..125 for colors that fit in sRGB. The conversion pivots through
CIE XYZ (D65 white point), which this library doesn't expose as its
own format since nothing outside the Lab conversion needs it.

`parseColorAs(input, format)` skips the auto-detection and insists the
input be that one format, throwing instead of falling through to another
format's parser. Useful when you already know what a file contains and
want a bad line to fail loudly rather than get reinterpreted.

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

By default `--from` is `auto`: each line's format is detected from its
syntax. Pass `--from` explicitly to require every line be that one format
instead — a typo that would otherwise parse as some other format gets
reported as an error rather than silently converted wrong:

```
$ node dist/cli.js --to hex --from rgb rgb-only.txt
```

By default `--output` is `text`, printing the `input -> output` lines shown
above. Pass `--output json` to get one JSON array on stdout instead, which is
easier for another program to consume than scraping text. Lines that failed
to parse show up as `{ "input", "error" }` elements in the same array rather
than only going to stderr:

```
$ node dist/cli.js --to hsl --output json palette.txt
[
  {
    "input": "#ff8800",
    "output": "hsl(32, 100%, 50%)"
  },
  {
    "input": "not-a-color",
    "error": "unrecognized color format: \"not-a-color\""
  }
]
```

## Tests

```
npm test
```

Runs the conversion tests in `src/color.test.ts` through Node's built-in
test runner (`node --test`), after compiling with `tsc`.

## Status

Handles hex, rgb, hsl, oklch, and lab, including alpha, with either
auto-detected or explicit (`--from`) input format, and either text or
JSON (`--output`) results.
