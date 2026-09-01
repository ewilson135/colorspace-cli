// Core color math: hex <-> rgb <-> hsl. No dependencies, no DOM/canvas tricks,
// just the arithmetic, so it can run in Node or be dropped into anything else.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export type ColorFormat = "hex" | "rgb" | "hsl";

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function hexToRgb(input: string): RGB {
  const hex = input.trim().replace(/^#/, "");
  let expanded: string;
  if (hex.length === 3) {
    expanded = hex
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (hex.length === 6) {
    expanded = hex;
  } else {
    throw new Error(`not a valid hex color: "${input}"`);
  }
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`not a valid hex color: "${input}"`);
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: RGB): string {
  const toPair = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${toPair(rgb.r)}${toPair(rgb.g)}${toPair(rgb.b)}`;
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
    return { h: 0, s: 0, l: l * 100 };
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

  return { h, s: s * 100, l: l * 100 };
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
    return { r: v, g: v, b: v };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: clampByte(hueToChannel(p, q, h + 1 / 3) * 255),
    g: clampByte(hueToChannel(p, q, h) * 255),
    b: clampByte(hueToChannel(p, q, h - 1 / 3) * 255),
  };
}

const RGB_PATTERN = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i;
const HSL_PATTERN = /^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*(?:,\s*[\d.]+\s*)?\)$/i;
const HEX_PATTERN = /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/;

// Accepts whatever form a color shows up in and normalizes it to RGB,
// which is the pivot format every conversion in this library goes through.
export function parseColor(input: string): RGB {
  const text = input.trim();

  const rgbMatch = text.match(RGB_PATTERN);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return {
      r: clampByte(Number(r)),
      g: clampByte(Number(g)),
      b: clampByte(Number(b)),
    };
  }

  const hslMatch = text.match(HSL_PATTERN);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return hslToRgb({ h: Number(h), s: Number(s), l: Number(l) });
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
      return `rgb(${clampByte(rgb.r)}, ${clampByte(rgb.g)}, ${clampByte(rgb.b)})`;
    case "hsl": {
      const hsl = rgbToHsl(rgb);
      return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
    }
  }
}
