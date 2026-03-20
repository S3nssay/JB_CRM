/**
 * fix-zod-resolution.cjs
 *
 * The @openai/agents SDK depends on zod v4 via @modelcontextprotocol/sdk -> zod-to-json-schema@3.25+
 * which requires the `zod/v3` subpath (a zod v4 backwards-compat feature).
 * This project uses zod v3 at root, which doesn't have that subpath.
 *
 * Fix: copy the nested zod v4 (installed by @openai/agents-core) into
 * zod-to-json-schema/node_modules/zod so it resolves the right version.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const zodV4Source = path.join(root, 'node_modules', '@openai', 'agents-core', 'node_modules', 'zod');
const zodTarget = path.join(root, 'node_modules', 'zod-to-json-schema', 'node_modules', 'zod');

if (!fs.existsSync(zodV4Source)) {
  console.log('[fix-zod-resolution] No nested zod v4 found in agents-core, skipping.');
  process.exit(0);
}

if (fs.existsSync(zodTarget)) {
  console.log('[fix-zod-resolution] zod already nested in zod-to-json-schema, skipping.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(zodTarget), { recursive: true });
fs.cpSync(zodV4Source, zodTarget, { recursive: true });
console.log('[fix-zod-resolution] Copied zod v4 into zod-to-json-schema/node_modules/zod');
