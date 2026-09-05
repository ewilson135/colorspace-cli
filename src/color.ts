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

export type ColorFormat = "hex" | "rgb" | "hsl";

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function clampAlpha(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Renders alpha the way browsers do: as few decimal places as it takes to
// round-trip a byte value (max 3), so 0.5 stays "0.5" instead of "0.500".
function formatAlpha(a: number): string {
  return clampAlpha(a)
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
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
  const h = ((hsl.h % 360) + 360) % 360 / 360;
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

const RGB_PATTERN = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const HSL_PATTERN = /^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const HEX_PATTERN = /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{4}$|^#?[0-9a-fA-F]{6}$|^#?[0-9a-fA-F]{8}$/;

// Accepts whatever form a color shows up in and normalizes it to RGB,
// which is the pivot format every conversion in this library goes through.
export function parseColor(input: string): RGB {
  const text = input.trim();

  const rgbMatch = text.match(RGB_PATTERN);
  if (rgbMatch) {
    const [, r, g, b, a] = rgbMatch;
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

  const hslMatch = text.match(HSL_PATTERN);
  if (hslMatch) {
    const [, h, s, l, a] = hslMatch;
    const hsl: HSL = { h: Number(h), s: Number(s), l: Number(l) };
    if (a !== undefined) {
      hsl.a = clampAlpha(Number(a));
    }
    return hslToRgb(hsl);
  }

  if (HEX_PATTERN.test(text)) {
    return hexToRgb(text);
  }

  throw new Error(`unrecognized color format: "${input}"`);
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
  }
}
