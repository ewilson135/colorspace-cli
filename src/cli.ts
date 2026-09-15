#!/usr/bin/env node
// Thin CLI over color.ts. Reads one color per line, from a file argument
// or from stdin when no file is given, and prints each converted to
// the requested format on its own line.

import { readFileSync } from "node:fs";
import { parseColor, parseColorAs, formatColor, type ColorFormat } from "./color.js";

type FromFormat = ColorFormat | "auto";

function isColorFormat(value: string): value is ColorFormat {
  return value === "hex" || value === "rgb" || value === "hsl" || value === "oklch";
}

function isFromFormat(value: string): value is FromFormat {
  return value === "auto" || isColorFormat(value);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

function printUsage(): void {
  console.error("usage: colorspace --to <hex|rgb|hsl|oklch> [--from <hex|rgb|hsl|oklch|auto>] [file]");
  console.error();
  console.error("  reads colors, one per line, from FILE or from stdin if no");
  console.error("  file is given, and prints each one converted to --to");
  console.error();
  console.error("  --from defaults to auto, which detects each line's format");
  console.error("  by its syntax. Pass an explicit format to reject any line");
  console.error("  that isn't that format, instead of silently trying others.");
  console.error();
  console.error("  examples:");
  console.error("    colorspace --to hsl palette.txt");
  console.error("    echo '#ff8800' | colorspace --to rgb");
  console.error("    colorspace --to hex --from rgb rgb-only.txt");
}

interface Args {
  to: ColorFormat;
  from: FromFormat;
  file: string | null;
}

function parseArgs(argv: string[]): Args {
  let to: ColorFormat | null = null;
  let from: FromFormat = "auto";
  let file: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--to") {
      const value = argv[i + 1];
      if (!value || !isColorFormat(value)) {
        throw new Error(`--to requires one of: hex, rgb, hsl, oklch (got "${value ?? ""}")`);
      }
      to = value;
      i++;
    } else if (arg === "--from") {
      const value = argv[i + 1];
      if (!value || !isFromFormat(value)) {
        throw new Error(`--from requires one of: hex, rgb, hsl, oklch, auto (got "${value ?? ""}")`);
      }
      from = value;
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    } else if (file !== null) {
      throw new Error(`unexpected extra argument: ${arg}`);
    } else {
      file = arg;
    }
  }

  if (!to) {
    throw new Error("missing required option: --to <hex|rgb|hsl|oklch>");
  }

  return { to, from, file };
}

async function main(): Promise<void> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    printUsage();
    process.exit(1);
  }

  const raw = args.file ? readFileSync(args.file, "utf8") : await readStdin();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    console.error(`no colors found in ${args.file ?? "stdin"}`);
    process.exit(1);
  }

  let hadError = false;
  for (const line of lines) {
    try {
      const rgb = args.from === "auto" ? parseColor(line) : parseColorAs(line, args.from);
      console.log(`${line} -> ${formatColor(rgb, args.to)}`);
    } catch (err) {
      hadError = true;
      console.error(`skipping "${line}": ${(err as Error).message}`);
    }
  }

  process.exit(hadError ? 1 : 0);
}

main();
