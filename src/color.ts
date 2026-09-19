// Core color math: hex <-> rgb <-> hsl. No dependencies, no DOM/canvas tricks,
// just the arithmetic, so it can run in Node or be dropped into anything else.

export interface RGB {
  r: number;
  g: number;
  b: number;
  // Alpha is 0..1, and left undefined for opaque colors that never
  // mentioned an alpha channel, so formatColor can tell "fully opaque"
  // apart from "caller didn't specify" and skip the a-suffix for the latter.
  a?: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
  a?: number;
}

// Lightness is 0..1 (not 0..100, unlike HSL) to match the CSS oklch()
// syntax; chroma is unitless and unbounded above, hue is degrees.
export interface OKLCH {
  l: number;
  c: number;
  h: number;
  a?: number;
}

// CIE Lab, 0..100 lightness, unbounded a/b (roughly -125..125 for sRGB
// colors). The channel named "a" is Lab's green-red axis, so alpha lives
// in "alpha" instead of the "a" every other interface here uses.
export interface Lab {
  l: number;
  a: number;
  b: number;
  alpha?: number;
}

export type ColorFormat = "hex" | "rgb" | "hsl" | "oklch" | "lab";

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function clampUnit(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clampAlpha(n: number): number {
  return clampUnit(n);
}

function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

// Also collapses "-0" (from toFixed rounding a tiny negative float, which
// floating-point rounding produces often for channels that are
// mathematically zero, e.g. a/b for a gray color run through Lab) down to
// "0", so output never shows a minus sign in front of nothing.
function trimTrailingZeros(s: string): string {
  const trimmed = s.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed === "-0" ? "0" : trimmed;
}

// Renders alpha the way browsers do: as few decimal places as it takes to
// round-trip a byte value (max 3), so 0.5 stays "0.5" instead of "0.500".
function formatAlpha(a: number): string {
  return trimTrailingZeros(clampAlpha(a).toFixed(3));
}

export function hexToRgb(input: string): RGB {
  const hex = input.trim().replace(/^#/, "");
  let expanded: string;
  let hasAlpha: boolean;
  if (hex.length === 3) {
    expanded = hex
      .split("")
      .map((c) => c + c)
      .join("");
    hasAlpha = false;
  } else if (hex.length === 4) {
    expanded = hex
      .split("")
      .map((c) => c + c)
      .join("");
    hasAlpha = true;
  } else if (hex.length === 6) {
    expanded = hex;
    hasAlpha = false;
  } else if (hex.length === 8) {
    expanded = hex;
    hasAlpha = true;
  } else {
    throw new Error(`not a valid hex color: "${input}"`);
  }
  if (!new RegExp(`^[0-9a-fA-F]{${expanded.length}}$`).test(expanded)) {
    throw new Error(`not a valid hex color: "${input}"`);
  }
  const rgb: RGB = {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
  if (hasAlpha) {
    rgb.a = parseInt(expanded.slice(6, 8), 16) / 255;
  }
  return rgb;
}

export function rgbToHex(rgb: RGB): string {
  const toPair = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  const base = `#${toPair(rgb.r)}${toPair(rgb.g)}${toPair(rgb.b)}`;
  if (rgb.a === undefined || rgb.a === 1) {
    return base;
  }
  return `${base}${toPair(clampAlpha(rgb.a) * 255)}`;
}

// Standard RGB<->HSL conversion (Smith, 1978). Working in 0..1 space
// throughout keeps the hue arithmetic simple, converting to the
// public 0..255 / 0..360 / 0..100 ranges only at the edges.
export function rgbToHsl(rgb: RGB): HSL {
  const r = clampByte(rgb.r) / 255;
  const g = clampByte(rgb.g) / 255;
  const b = clampByte(rgb.b) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return rgb.a === undefined ? { h: 0, s: 0, l: l * 100 } : { h: 0, s: 0, l: l * 100, a: rgb.a };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  h *= 60;

  return rgb.a === undefined ? { h, s: s * 100, l: l * 100 } : { h, s: s * 100, l: l * 100, a: rgb.a };
}

function hueToChannel(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function hslToRgb(hsl: HSL): RGB {
  const h = wrapHue(hsl.h) / 360;
  const s = clampPercent(hsl.s) / 100;
  const l = clampPercent(hsl.l) / 100;

  if (s === 0) {
    const v = clampByte(l * 255);
    return hsl.a === undefined ? { r: v, g: v, b: v } : { r: v, g: v, b: v, a: hsl.a };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const rgb: RGB = {
    r: clampByte(hueToChannel(p, q, h + 1 / 3) * 255),
    g: clampByte(hueToChannel(p, q, h) * 255),
    b: clampByte(hueToChannel(p, q, h - 1 / 3) * 255),
  };
  if (hsl.a !== undefined) {
    rgb.a = hsl.a;
  }
  return rgb;
}

function srgbToLinear(c: number): number {
  const cs = clampByte(c) / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
  return v * 255;
}

// Coefficients from Björn Ottosson's OKLab reference implementation
// (https://bottosson.github.io/posts/oklab/). OKLab is the intermediate,
// Cartesian form; OKLCH is just OKLab read back in polar coordinates,
// which is what CSS's oklch() actually exposes.
export function rgbToOklch(rgb: RGB): OKLCH {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bLab = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.sqrt(a * a + bLab * bLab);
  const h = c === 0 ? 0 : wrapHue((Math.atan2(bLab, a) * 180) / Math.PI);

  return rgb.a === undefined ? { l: L, c, h } : { l: L, c, h, a: rgb.a };
}

export function oklchToRgb(oklch: OKLCH): RGB {
  const L = clampUnit(oklch.l);
  const c = Math.max(0, oklch.c);
  const h = (wrapHue(oklch.h) * Math.PI) / 180;

  const a = c * Math.cos(h);
  const bLab = c * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * bLab;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bLab;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bLab;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const rgb: RGB = {
    r: clampByte(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clampByte(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clampByte(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  };
  if (oklch.a !== undefined) {
    rgb.a = oklch.a;
  }
  return rgb;
}

// D65 reference white, and the sRGB<->XYZ matrices that go with it
// (IEC 61966-2-1). XYZ itself isn't exposed as a format here, just the
// pivot between linear sRGB and Lab, same role OKLab plays for oklch.
const D65 = { x: 0.95047, y: 1, z: 1.08883 };

function rgbToXyz(rgb: RGB): { x: number; y: number; z: number } {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    y: 0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    z: 0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  };
}

function xyzToRgbChannels(x: number, y: number, z: number): { r: number; g: number; b: number } {
  return {
    r: clampByte(linearToSrgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z)),
    g: clampByte(linearToSrgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z)),
    b: clampByte(linearToSrgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z)),
  };
}

// CIE standard constants for the Lab piecewise cube root, not just
// arbitrary tolerances: epsilon is (6/29)^3 and kappa is (29/3)^3.
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

function labForward(t: number): number {
  return t > LAB_EPSILON ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116;
}

function labInverse(t: number): number {
  const t3 = t ** 3;
  return t3 > LAB_EPSILON ? t3 : (116 * t - 16) / LAB_KAPPA;
}

export function rgbToLab(rgb: RGB): Lab {
  const { x, y, z } = rgbToXyz(rgb);
  const fx = labForward(x / D65.x);
  const fy = labForward(y / D65.y);
  const fz = labForward(z / D65.z);

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return rgb.a === undefined ? { l, a, b } : { l, a, b, alpha: rgb.a };
}

export function labToRgb(lab: Lab): RGB {
  const fy = (lab.l + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;

  const x = D65.x * labInverse(fx);
  const y = D65.y * labInverse(fy);
  const z = D65.z * labInverse(fz);

  const rgb = xyzToRgbChannels(x, y, z);
  return lab.alpha === undefined ? rgb : { ...rgb, a: lab.alpha };
}

const RGB_PATTERN = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const HSL_PATTERN = /^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const HEX_PATTERN = /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{4}$|^#?[0-9a-fA-F]{6}$|^#?[0-9a-fA-F]{8}$/;
// oklch(L C H) or oklch(L C H / A). L and A may carry a trailing "%".
const OKLCH_PATTERN =
  /^oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+(-?[\d.]+)\s*(?:\/\s*([\d.]+)(%)?\s*)?\)$/i;
// lab(L a b) or lab(L a b / A). L may carry a trailing "%", but a plain
// 0..100 number and "0%..100%" mean the same thing for lab()'s L, so
// there's nothing to rescale - the "%" only needs to be accepted, not read.
const LAB_PATTERN = /^lab\(\s*(-?[\d.]+)%?\s+(-?[\d.]+)\s+(-?[\d.]+)\s*(?:\/\s*([\d.]+)(%)?\s*)?\)$/i;

function parseRgbFunction(text: string): RGB | null {
  const match = text.match(RGB_PATTERN);
  if (!match) {
    return null;
  }
  const [, r, g, b, a] = match;
  const rgb: RGB = {
    r: clampByte(Number(r)),
    g: clampByte(Number(g)),
    b: clampByte(Number(b)),
  };
  if (a !== undefined) {
    rgb.a = clampAlpha(Number(a));
  }
  return rgb;
}

function parseHslFunction(text: string): RGB | null {
  const match = text.match(HSL_PATTERN);
  if (!match) {
    return null;
  }
  const [, h, s, l, a] = match;
  const hsl: HSL = { h: Number(h), s: Number(s), l: Number(l) };
  if (a !== undefined) {
    hsl.a = clampAlpha(Number(a));
  }
  return hslToRgb(hsl);
}

function parseOklchFunction(text: string): RGB | null {
  const match = text.match(OKLCH_PATTERN);
  if (!match) {
    return null;
  }
  const [, l, lPercent, c, h, a, aPercent] = match;
  const oklch: OKLCH = {
    l: lPercent ? Number(l) / 100 : Number(l),
    c: Number(c),
    h: Number(h),
  };
  if (a !== undefined) {
    oklch.a = aPercent ? clampAlpha(Number(a) / 100) : clampAlpha(Number(a));
  }
  return oklchToRgb(oklch);
}

function parseLabFunction(text: string): RGB | null {
  const match = text.match(LAB_PATTERN);
  if (!match) {
    return null;
  }
  const [, l, a, b, alpha, alphaPercent] = match;
  const lab: Lab = { l: Number(l), a: Number(a), b: Number(b) };
  if (alpha !== undefined) {
    lab.alpha = alphaPercent ? clampAlpha(Number(alpha) / 100) : clampAlpha(Number(alpha));
  }
  return labToRgb(lab);
}

function parseHexFunction(text: string): RGB | null {
  return HEX_PATTERN.test(text) ? hexToRgb(text) : null;
}

// Accepts whatever form a color shows up in and normalizes it to RGB,
// which is the pivot format every conversion in this library goes through.
export function parseColor(input: string): RGB {
  const text = input.trim();

  const rgb =
    parseRgbFunction(text) ??
    parseHslFunction(text) ??
    parseOklchFunction(text) ??
    parseLabFunction(text) ??
    parseHexFunction(text);
  if (rgb) {
    return rgb;
  }

  throw new Error(`unrecognized color format: "${input}"`);
}

// Same as parseColor, but insists the input actually be the named format
// instead of guessing. Useful when a caller already knows the format and
// wants a syntax error surfaced instead of a silent misparse (each format's
// syntax is distinct enough that auto-detect never actually picks the wrong
// one, but "insist" is still worth having for validation and clearer errors).
export function parseColorAs(input: string, format: ColorFormat): RGB {
  const text = input.trim();
  const rgb =
    format === "hex"
      ? parseHexFunction(text)
      : format === "rgb"
        ? parseRgbFunction(text)
        : format === "hsl"
          ? parseHslFunction(text)
          : format === "oklch"
            ? parseOklchFunction(text)
            : parseLabFunction(text);
  if (rgb) {
    return rgb;
  }
  throw new Error(`not a valid ${format} color: "${input}"`);
}

export function formatColor(rgb: RGB, format: ColorFormat): string {
  switch (format) {
    case "hex":
      return rgbToHex(rgb);
    case "rgb":
      if (rgb.a === undefined) {
        return `rgb(${clampByte(rgb.r)}, ${clampByte(rgb.g)}, ${clampByte(rgb.b)})`;
      }
      return `rgba(${clampByte(rgb.r)}, ${clampByte(rgb.g)}, ${clampByte(rgb.b)}, ${formatAlpha(rgb.a)})`;
    case "hsl": {
      const hsl = rgbToHsl(rgb);
      if (hsl.a === undefined) {
        return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
      }
      return `hsla(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%, ${formatAlpha(hsl.a)})`;
    }
    case "oklch": {
      const oklch = rgbToOklch(rgb);
      const l = trimTrailingZeros(oklch.l.toFixed(3));
      const c = trimTrailingZeros(oklch.c.toFixed(4));
      const h = trimTrailingZeros(oklch.h.toFixed(1));
      if (oklch.a === undefined) {
        return `oklch(${l} ${c} ${h})`;
      }
      return `oklch(${l} ${c} ${h} / ${formatAlpha(oklch.a)})`;
    }
    case "lab": {
      const lab = rgbToLab(rgb);
      const l = trimTrailingZeros(lab.l.toFixed(2));
      const a = trimTrailingZeros(lab.a.toFixed(2));
      const b = trimTrailingZeros(lab.b.toFixed(2));
      if (lab.alpha === undefined) {
        return `lab(${l} ${a} ${b})`;
      }
      return `lab(${l} ${a} ${b} / ${formatAlpha(lab.alpha)})`;
    }
  }
}
