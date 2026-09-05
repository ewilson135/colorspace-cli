import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  parseColor,
  formatColor,
} from "./color.js";

test("hexToRgb expands 3-digit shorthand", () => {
  assert.deepEqual(hexToRgb("#f80"), { r: 255, g: 136, b: 0 });
});

test("hexToRgb parses 6-digit hex with or without leading #", () => {
  assert.deepEqual(hexToRgb("#ff8800"), { r: 255, g: 136, b: 0 });
  assert.deepEqual(hexToRgb("ff8800"), { r: 255, g: 136, b: 0 });
});

test("hexToRgb rejects malformed input", () => {
  assert.throws(() => hexToRgb("#ff88"), /not a valid hex color/);
  assert.throws(() => hexToRgb("#gggggg"), /not a valid hex color/);
  assert.throws(() => hexToRgb(""), /not a valid hex color/);
});

test("rgbToHex pads and lowercases", () => {
  assert.equal(rgbToHex({ r: 0, g: 0, b: 0 }), "#000000");
  assert.equal(rgbToHex({ r: 255, g: 136, b: 0 }), "#ff8800");
});

test("rgbToHex clamps out-of-range channels", () => {
  assert.equal(rgbToHex({ r: -10, g: 300, b: 128 }), "#00ff80");
});

test("rgbToHsl handles grayscale (zero saturation)", () => {
  assert.deepEqual(rgbToHsl({ r: 20, g: 20, b: 20 }), {
    h: 0,
    s: 0,
    l: (20 / 255) * 100,
  });
});

test("rgbToHsl matches known conversions", () => {
  const hsl = rgbToHsl({ r: 255, g: 136, b: 0 });
  assert.equal(Math.round(hsl.h), 32);
  assert.equal(Math.round(hsl.s), 100);
  assert.equal(Math.round(hsl.l), 50);
});

test("hslToRgb handles zero saturation as gray", () => {
  assert.deepEqual(hslToRgb({ h: 210, s: 0, l: 50 }), {
    r: 128,
    g: 128,
    b: 128,
  });
});

test("hslToRgb wraps hue outside 0..360", () => {
  assert.deepEqual(hslToRgb({ h: 720, s: 100, l: 50 }), hslToRgb({ h: 0, s: 100, l: 50 }));
  assert.deepEqual(hslToRgb({ h: -30, s: 100, l: 50 }), hslToRgb({ h: 330, s: 100, l: 50 }));
});

test("rgb -> hsl -> rgb round-trips within rounding error", () => {
  const original = { r: 51, g: 102, b: 153 };
  const roundTripped = hslToRgb(rgbToHsl(original));
  assert.equal(roundTripped.r, original.r);
  assert.equal(roundTripped.g, original.g);
  assert.equal(roundTripped.b, original.b);
});

test("parseColor accepts hex, rgb(), and hsl() forms", () => {
  assert.deepEqual(parseColor("#336699"), { r: 51, g: 102, b: 153 });
  assert.deepEqual(parseColor("rgb(51, 102, 153)"), { r: 51, g: 102, b: 153 });
  assert.deepEqual(parseColor("hsl(210, 50%, 40%)"), hslToRgb({ h: 210, s: 50, l: 40 }));
});

test("parseColor captures alpha from rgba() and hsla()", () => {
  assert.deepEqual(parseColor("rgba(51, 102, 153, 0.5)"), { r: 51, g: 102, b: 153, a: 0.5 });
  const withAlpha = parseColor("hsla(210, 50%, 40%, 0.25)");
  assert.equal(withAlpha.a, 0.25);
  assert.deepEqual({ r: withAlpha.r, g: withAlpha.g, b: withAlpha.b }, hslToRgb({ h: 210, s: 50, l: 40 }));
});

test("parseColor clamps out-of-range alpha", () => {
  assert.equal(parseColor("rgba(0, 0, 0, 2)").a, 1);
  assert.equal(parseColor("rgba(0, 0, 0, -1)").a, 0);
});

test("hexToRgb parses 4- and 8-digit hex with alpha", () => {
  assert.deepEqual(hexToRgb("#f808"), { r: 255, g: 136, b: 0, a: 8 / 15 });
  assert.deepEqual(hexToRgb("#ff880080"), { r: 255, g: 136, b: 0, a: 128 / 255 });
});

test("rgbToHex adds an alpha suffix only when alpha is set and not opaque", () => {
  assert.equal(rgbToHex({ r: 255, g: 136, b: 0 }), "#ff8800");
  assert.equal(rgbToHex({ r: 255, g: 136, b: 0, a: 1 }), "#ff8800");
  assert.equal(rgbToHex({ r: 255, g: 136, b: 0, a: 0.5 }), "#ff880080");
});

test("formatColor renders rgba()/hsla() only when alpha is present", () => {
  const rgb = { r: 51, g: 102, b: 153, a: 0.5 };
  assert.equal(formatColor(rgb, "rgb"), "rgba(51, 102, 153, 0.5)");
  assert.equal(formatColor(rgb, "hsl"), "hsla(210, 50%, 40%, 0.5)");
  assert.equal(formatColor({ r: 51, g: 102, b: 153 }, "rgb"), "rgb(51, 102, 153)");
});

test("parseColor rejects unrecognized formats", () => {
  assert.throws(() => parseColor("not-a-color"), /unrecognized color format/);
  assert.throws(() => parseColor("cmyk(0, 0, 0, 0)"), /unrecognized color format/);
});

test("formatColor renders each supported format", () => {
  const rgb = { r: 255, g: 136, b: 0 };
  assert.equal(formatColor(rgb, "hex"), "#ff8800");
  assert.equal(formatColor(rgb, "rgb"), "rgb(255, 136, 0)");
  assert.equal(formatColor(rgb, "hsl"), "hsl(32, 100%, 50%)");
});
