#!/usr/bin/env node

/**
 * Database QA Guard MCP Runner
 * Spawns the self-contained Go binary with automated .env resolution for DEV_everpro and DEV_db-external-dev.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const binaryPath = path.resolve(__dirname, 'bin/postgres-mcp-go');
const args = process.argv.slice(2);

const child = spawn(binaryPath, args, {
  stdio: 'inherit',
  env: process.env
});

child.on('error', (err) => {
  console.error(`[MCP Database QA Guard Error]: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
