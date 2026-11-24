#!/usr/bin/env node

/**
 * Database QA Guard MCP Runner
 * Spawns the self-contained Go binary with automated .env resolution for DEV_primary and DEV_db-external-dev.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const binaryPath = path.resolve(__dirname, 'bin/postgres-mcp-go');
const args = process.argv.slice(2);

// Pondasi P8: kredensial DB diambil dari .secrets/<QA_ACTIVE_PROFILE>.env lewat qa-env (nilai proses tetap menang).
const ROOT = path.resolve(__dirname, '..');
let qaEnv = {};
try { qaEnv = createRequire(import.meta.url)('../scripts/lib/qa-env.cjs').readQaEnv(ROOT); }
catch (e) { console.error(`[MCP Database QA Guard] ${e.message}`); }

const child = spawn(binaryPath, args, {
  stdio: 'inherit',
  env: { ...qaEnv, ...process.env }
});

child.on('error', (err) => {
  console.error(`[MCP Database QA Guard Error]: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
