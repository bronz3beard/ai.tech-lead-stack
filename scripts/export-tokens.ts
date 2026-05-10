#!/usr/bin/env ts-node
/**
 * @desc Reads the target project's tailwind.config.ts and exports design tokens
 * in Tokens Studio v2 (JSON) format, compatible with Tailwind v3.4 and Figma.
 *
 * @usage npx ts-node scripts/export-tokens.ts --project <ABSOLUTE_PATH_TO_PROJECT>
 * @example npx ts-node scripts/export-tokens.ts --project /Users/dev/repos/gilly/client
 *
 * Output: <project_root>/figma-tokens.json
 */

import * as path from 'path';
import * as fs from 'fs';

// ─── CLI Args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const projectFlagIndex = args.indexOf('--project');
const projectRoot = projectFlagIndex !== -1 ? args[projectFlagIndex + 1] : process.cwd();

if (!projectRoot || !fs.existsSync(projectRoot)) {
  console.error(`❌ Project root not found: "${projectRoot}"`);
  process.exit(1);
}

// ─── Locate Tailwind Config ────────────────────────────────────────────────────
const candidates = [
  path.join(projectRoot, 'tailwind.config.ts'),
  path.join(projectRoot, 'tailwind.config.js'),
  path.join(projectRoot, 'tailwind.config.mjs'),
];
const tailwindConfigPath = candidates.find((p) => fs.existsSync(p));

if (!tailwindConfigPath) {
  console.error('❌ No tailwind.config.ts/js found in project root.');
  process.exit(1);
}

console.log(`📂 Found config: ${tailwindConfigPath}`);

// ─── Load Tailwind Config ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require(tailwindConfigPath);
const theme = tailwindConfig?.default?.theme?.extend ?? tailwindConfig?.theme?.extend ?? {};

// ─── Token Builders ────────────────────────────────────────────────────────────

/** Recursively converts a flat/nested color object to Tokens Studio format */
function buildColorTokens(
  colors: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const tokens: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(colors)) {
    const tokenKey = prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'string') {
      tokens[tokenKey] = { value, type: 'color' };
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(tokens, buildColorTokens(value as Record<string, unknown>, tokenKey));
    }
  }
  return tokens;
}

/** Converts a scale object (spacing, fontSize, etc.) to Tokens Studio format */
function buildScaleTokens(
  scale: Record<string, unknown>,
  type: string
): Record<string, unknown> {
  const tokens: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(scale)) {
    let resolvedValue = value;
    // fontSize can be [size, lineHeight] — take the first element
    if (Array.isArray(value)) resolvedValue = value[0];
    tokens[key] = { value: resolvedValue, type };
  }
  return tokens;
}

// ─── Extract Tokens ────────────────────────────────────────────────────────────
const tokensOutput: Record<string, unknown> = {
  global: {
    ...(theme.colors ? buildColorTokens(theme.colors as Record<string, unknown>) : {}),
    ...(theme.spacing
      ? Object.fromEntries(
          Object.entries(buildScaleTokens(theme.spacing as Record<string, unknown>, 'spacing')).map(
            ([k, v]) => [`spacing-${k}`, v]
          )
        )
      : {}),
    ...(theme.fontSize
      ? Object.fromEntries(
          Object.entries(buildScaleTokens(theme.fontSize as Record<string, unknown>, 'fontSize')).map(
            ([k, v]) => [`fontSize-${k}`, v]
          )
        )
      : {}),
    ...(theme.fontFamily
      ? Object.fromEntries(
          Object.entries(theme.fontFamily as Record<string, unknown>).map(([k, v]) => [
            `fontFamily-${k}`,
            { value: Array.isArray(v) ? v.join(', ') : v, type: 'fontFamilies' },
          ])
        )
      : {}),
    ...(theme.borderRadius
      ? Object.fromEntries(
          Object.entries(
            buildScaleTokens(theme.borderRadius as Record<string, unknown>, 'borderRadius')
          ).map(([k, v]) => [`radius-${k}`, v])
        )
      : {}),
  },
  $metadata: {
    tokenSetOrder: ['global'],
  },
};

// ─── Write Output ──────────────────────────────────────────────────────────────
const outputPath = path.join(projectRoot, 'figma-tokens.json');
fs.writeFileSync(outputPath, JSON.stringify(tokensOutput, null, 2), 'utf-8');

console.log(`\n✅ Tokens exported to: ${outputPath}`);
console.log(`   Token count: ${Object.keys(tokensOutput.global as object).length}`);
console.log(`\n💡 Import figma-tokens.json into Figma via Tokens Studio → Load from file.`);
