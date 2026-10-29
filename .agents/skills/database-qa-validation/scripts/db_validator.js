#!/usr/bin/env node

/**
 * Senior QA Database Validation Engine (`db_validator.js`)
 * 
 * Implements the standard operating procedure for database-qa-validation:
 * - 4-Tier Read-Only Security Mandate via Go MCP Server (postgres-mcp-go)
 * - Target Database Resolution (DEV_everpro vs DEV_db-external-dev)
 * - 4 Search Scenarios (Single Table, Table List, Partial, Non-Full-Scan Discovery)
 * - 2 Evaluation Modes: Data Inspection (Preview) vs Direct Assertion (Expected Match)
 * - Optional Handoff from browser-qa-execution (execution_context.json)
 * - Knowledge Cheatsheet Recipe Integration (db-validation-cheatsheet.md)
 * - Automatic PII Masking ([REDACTED_PII])
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const BINARY_PATH = path.join(REPO_ROOT, 'mcp-server-database-qa/bin/postgres-mcp-go');
const CHEATSHEET_PATH = path.join(REPO_ROOT, 'knowledge-review/db-validation-cheatsheet.md');
const AUTOMATE_RESULT_DIR = path.join(REPO_ROOT, 'browser-execution/automate-result');

// ANSI Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

// Sensitive field keys for PII masking
const SENSITIVE_KEYS = [
  'password', 'password_hash', 'passwd', 'secret', 'secret_key',
  'token', 'access_token', 'refresh_token', 'auth_token',
  'api_key', 'apikey', 'otp', 'pin', 'credit_card', 'cvv'
];

function maskPII(row) {
  if (!row || typeof row !== 'object') return row;
  const masked = { ...row };
  for (const key of Object.keys(masked)) {
    const lk = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lk.includes(sk))) {
      masked[key] = '[REDACTED_PII]';
    }
  }
  return masked;
}

/**
 * Universal Database Discovery from .env and .env.docker
 */
function discoverDatabasesFromEnv() {
  const envFiles = [
    path.join(REPO_ROOT, '.env'),
    path.join(REPO_ROOT, 'mcp-server-database-qa/.env.docker'),
    path.join(REPO_ROOT, '.env.docker'),
  ];
  const combinedEnv = {};
  for (const ef of envFiles) {
    if (fs.existsSync(ef)) {
      const content = fs.readFileSync(ef, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...v] = trimmed.split('=');
        const key = k.trim();
        const val = v.join('=').trim().replace(/^["']|["']$/g, '');
        if (key && !combinedEnv[key]) combinedEnv[key] = val;
      }
    }
  }

  const discovered = {};
  for (const [k, v] of Object.entries(combinedEnv)) {
    if (k === 'DATABASE_URL' && v && !v.includes('xxx')) {
      discovered['DATABASE_URL'] = { type: 'URL', HOST: 'Direct URL' };
    } else if (k.startsWith('DB_')) {
      const sub = k.substring(3);
      const lastUnderscore = sub.lastIndexOf('_');
      if (lastUnderscore > 0) {
        const prefix = sub.substring(0, lastUnderscore);
        const suffix = sub.substring(lastUnderscore + 1);
        if (['HOST', 'URL', 'NAME', 'DATABASE', 'USER'].includes(suffix)) {
          if (!discovered[prefix]) discovered[prefix] = {};
          discovered[prefix][suffix] = v;
        }
      }
    }
  }

  // Filter out dummy/empty placeholders like "url.xxx"
  const valid = {};
  for (const [pfx, conf] of Object.entries(discovered)) {
    const isDummy = (conf.HOST && conf.HOST.includes('xxx')) || (conf.URL && conf.URL.includes('xxx'));
    if (!isDummy && (conf.HOST || conf.URL)) {
      valid[pfx] = conf;
    }
  }
  return valid;
}

/**
 * Lightweight JSON-RPC Client for postgres-mcp-go over stdio
 */
class MCPPostgresClient {
  constructor(targetDB = 'everpro', dbName = null) {
    this.targetDB = targetDB;
    this.dbName = dbName;
    this.proc = null;
    this.requestId = 0;
    this.pending = new Map();
    this.ready = false;
  }

  async start() {
    if (!fs.existsSync(BINARY_PATH)) {
      throw new Error(`MCP Go binary not found at ${BINARY_PATH}. Please run: npm run mcp:db:build`);
    }

    return new Promise((resolve, reject) => {
      const procEnv = { ...process.env };
      if (this.dbName) {
        const pfx = this.targetDB.toUpperCase().replace(/-/g, '_').replace(/^DEV_/, '');
        procEnv[`DB_${pfx}_NAME`] = this.dbName;
        procEnv.DB_TARGET_NAME = this.dbName;
      }

      this.proc = spawn(BINARY_PATH, [`-target-db=${this.targetDB}`], {
        cwd: REPO_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: procEnv,
      });

      this.proc.on('error', (err) => reject(err));

      const rl = readline.createInterface({ input: this.proc.stdout });
      let stderrBuffer = '';

      this.proc.stderr.on('data', (d) => {
        stderrBuffer += d.toString();
      });

      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line);
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve: reqResolve, reject: reqReject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) {
              reqReject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              reqResolve(msg.result);
            }
          }
        } catch {
          // ignore non-json
        }
      });

      // Send MCP initialize handshake
      this.callRaw('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'qa-database-validator', version: '1.0' }
      }).then(() => {
        this.ready = true;
        resolve(this);
      }).catch((err) => {
        reject(new Error(`Failed to initialize MCP: ${err.message}. Stderr: ${stderrBuffer}`));
      });
    });
  }

  callRaw(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pending.set(id, { resolve, reject });
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      this.proc.stdin.write(payload);
    });
  }

  async callTool(name, args = {}) {
    const res = await this.callRaw('tools/call', { name, arguments: args });
    if (res && res.content && Array.isArray(res.content)) {
      const textItem = res.content.find(c => c.type === 'text');
      if (textItem && textItem.text) {
        try {
          return JSON.parse(textItem.text);
        } catch {
          return textItem.text;
        }
      }
    }
    return res;
  }

  async executeSQL(sql) {
    return this.callTool('execute_sql', { sql });
  }

  async listSchemas() {
    return this.callTool('list_schemas');
  }

  async listObjects(schema = 'public', type = 'table') {
    return this.callTool('list_objects', { schema_name: schema, object_type: type });
  }

  async describeTable(table, schema = 'public') {
    return this.callTool('get_object_details', { schema_name: schema, object_name: table, object_type: 'table' });
  }

  async close() {
    if (this.proc) {
      this.proc.kill();
    }
  }
}

/**
 * Format records as a Markdown Table
 */
function formatMarkdownTable(records) {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return `${C.yellow}(Tidak ada data ditemukan / 0 baris)${C.reset}`;
  }

  const maskedRecords = records.map(maskPII);
  const headers = Object.keys(maskedRecords[0]);
  const colWidths = {};

  for (const h of headers) {
    colWidths[h] = Math.max(h.length, ...maskedRecords.map(r => String(r[h] ?? '').length));
    colWidths[h] = Math.min(colWidths[h], 40); // Cap width at 40 chars
  }

  const headerRow = '| ' + headers.map(h => h.padEnd(colWidths[h])).join(' | ') + ' |';
  const sepRow = '| ' + headers.map(h => '-'.repeat(colWidths[h])).join(' | ') + ' |';
  const dataRows = maskedRecords.map(r => {
    return '| ' + headers.map(h => {
      let val = String(r[h] ?? '');
      if (val.length > 40) val = val.substring(0, 37) + '...';
      return val.padEnd(colWidths[h]);
    }).join(' | ') + ' |';
  });

  return [headerRow, sepRow, ...dataRows].join('\n');
}

/**
 * Perform Direct Assertion Mode
 */
function evaluateAssertion(actualRows, expectedObj, targetDesc) {
  console.log(`\n${C.bold}${C.cyan}--- EVALUASI ASERSI DATABASE (${targetDesc}) ---${C.reset}`);
  if (!actualRows || actualRows.length === 0) {
    console.log(`${C.red}❌ [FAILED] Database Assertion Mismatch: Data tidak ditemukan pada database!${C.reset}`);
    return { passed: false, reason: 'Record not found in database' };
  }

  const targetRow = actualRows[0];
  let allMatched = true;
  const comparisonResults = [];

  for (const [key, expVal] of Object.entries(expectedObj)) {
    const actVal = targetRow[key];
    const isMatch = String(actVal) === String(expVal);
    if (!isMatch) allMatched = false;
    comparisonResults.push({
      column: key,
      expected: expVal,
      actual: actVal,
      matched: isMatch
    });
  }

  if (allMatched) {
    console.log(`${C.green}✅ [PASSED] Database Assertion Match${C.reset}`);
    for (const r of comparisonResults) {
      console.log(`   - ${C.bold}${r.column}${C.reset}: Expected="${r.expected}" | Actual="${r.actual}" (${C.green}MATCH${C.reset})`);
    }
    return { passed: true, comparisons: comparisonResults };
  } else {
    console.log(`${C.red}❌ [FAILED] Database Assertion Mismatch${C.reset}`);
    for (const r of comparisonResults) {
      const matchText = r.matched ? `${C.green}MATCH${C.reset}` : `${C.red}MISMATCH${C.reset}`;
      console.log(`   - ${C.bold}${r.column}${C.reset}: Expected="${r.expected}" | Actual="${r.actual}" (${matchText})`);
    }
    return { passed: false, comparisons: comparisonResults };
  }
}

/**
 * Scenario 1: Single Table Query
 */
async function runSingleTableScenario(client, table, query, whereClause, limit = 10) {
  console.log(`\n${C.cyan}[Skenario 1: Single Table] Memeriksa tabel: ${C.bold}${table}${C.reset}`);
  
  let sql = `SELECT * FROM "${table}"`;
  if (whereClause) {
    sql += ` WHERE ${whereClause}`;
  } else if (query) {
    sql += ` WHERE (id::text ILIKE '%${query}%' OR name::text ILIKE '%${query}%')`;
  }
  sql += ` LIMIT ${limit};`;

  console.log(`${C.gray}Executing Query: ${sql}${C.reset}`);
  const result = await client.executeSQL(sql);
  return result;
}

/**
 * Scenario 2: Table List Query
 */
async function runTableListScenario(client, tables, keyword) {
  console.log(`\n${C.cyan}[Skenario 2: Table List] Memeriksa ${tables.length} tabel dengan keyword: "${keyword}"${C.reset}`);
  const resultsByTable = {};

  for (const table of tables) {
    const cleanTable = table.trim();
    if (!cleanTable) continue;
    console.log(`\n🔍 Memeriksa tabel: ${C.bold}${cleanTable}${C.reset}`);
    try {
      const sql = `SELECT * FROM "${cleanTable}" WHERE (id::text ILIKE '%${keyword}%' OR code::text ILIKE '%${keyword}%' OR name::text ILIKE '%${keyword}%') LIMIT 5;`;
      const rows = await client.executeSQL(sql);
      resultsByTable[cleanTable] = rows;
      console.log(formatMarkdownTable(rows));
    } catch (err) {
      console.log(`${C.yellow}Tabel ${cleanTable} dilewati / error: ${err.message}${C.reset}`);
    }
  }
  return resultsByTable;
}

/**
 * Scenario 4: Non-Full-Scan Keyword Discovery
 */
async function runDiscoveryScenario(client, keyword) {
  console.log(`\n${C.cyan}[Skenario 4: Discovery Guard] Menemukan tabel relevan untuk keyword: "${keyword}"${C.reset}`);
  
  // 1. Search candidate columns
  const metaSql = `
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (column_name IN ('id', 'code', 'ref_id', 'room_id', 'channel_id', 'identifier', 'email', 'phone', 'name')
           OR column_name ILIKE '%id' OR column_name ILIKE '%no')
    LIMIT 30;
  `;
  const metaCols = await client.executeSQL(metaSql);
  if (!metaCols || metaCols.length === 0) {
    console.log(`${C.yellow}Tidak dapat membaca metadata skema.${C.reset}`);
    return [];
  }

  // Group columns by table
  const tableColMap = {};
  for (const row of metaCols) {
    if (!tableColMap[row.table_name]) tableColMap[row.table_name] = [];
    tableColMap[row.table_name].push(row.column_name);
  }

  const candidateTables = Object.keys(tableColMap).slice(0, 5); // Max 5 candidate tables
  console.log(`${C.gray}Tabel kandidat terpilih (maks 5): ${candidateTables.join(', ')}${C.reset}\n`);

  const discoveryHits = [];
  for (const table of candidateTables) {
    const cols = tableColMap[table].slice(0, 3);
    const conds = cols.map(c => `"${c}"::text ILIKE '%${keyword}%'`).join(' OR ');
    const sql = `SELECT * FROM "${table}" WHERE (${conds}) LIMIT 5;`;
    try {
      const rows = await client.executeSQL(sql);
      if (rows && rows.length > 0) {
        console.log(`🎯 ${C.green}Ditemukan data pada tabel: ${C.bold}${table}${C.reset}`);
        console.log(formatMarkdownTable(rows));
        discoveryHits.push({ table, rows });
      }
    } catch {
      // ignore table query error
    }
  }

  if (discoveryHits.length === 0) {
    console.log(`${C.yellow}Tidak ditemukan data yang cocok pada 5 tabel kandidat.${C.reset}`);
  }
  return discoveryHits;
}

/**
 * Read Knowledge Cheatsheet Recipe
 */
function readCheatsheetRecipe(commandKey) {
  if (!fs.existsSync(CHEATSHEET_PATH)) {
    console.log(`${C.red}Cheatsheet file tidak ditemukan di: ${CHEATSHEET_PATH}${C.reset}`);
    return null;
  }
  const content = fs.readFileSync(CHEATSHEET_PATH, 'utf-8');
  console.log(`\n${C.magenta}📖 [Knowledge Review] Membaca Alur Cheatsheet: ${commandKey}${C.reset}`);
  
  const sections = content.split('###');
  for (const sec of sections) {
    if (sec.toLowerCase().includes(commandKey.toLowerCase())) {
      console.log(`\n${C.bold}--- RECIPE DITEMUKAN ---${C.reset}\n###${sec.trim()}\n`);
      return sec.trim();
    }
  }

  console.log(`${C.yellow}Alur untuk '${commandKey}' tidak ditemukan dalam cheatsheet.${C.reset}`);
  console.log(`🛑 ${C.bold}MANDATE: AI dilarang mengarang cheatsheet. Silakan tambah alur secara manual di ${CHEATSHEET_PATH}${C.reset}\n`);
  return null;
}

/**
 * Handoff Continuation from browser-qa-execution
 */
async function runHandoffContinuation(targetRunDir) {
  let runDir = targetRunDir;
  if (!runDir) {
    if (!fs.existsSync(AUTOMATE_RESULT_DIR)) {
      console.log(`${C.red}Direktori ${AUTOMATE_RESULT_DIR} belum ada.${C.reset}`);
      return;
    }
    const entries = fs.readdirSync(AUTOMATE_RESULT_DIR)
      .filter(f => f.startsWith('run_') && fs.statSync(path.join(AUTOMATE_RESULT_DIR, f)).isDirectory())
      .sort().reverse();
    
    if (entries.length === 0) {
      console.log(`${C.yellow}Tidak ditemukan folder hasil run browser sebelumnya di ${AUTOMATE_RESULT_DIR}.${C.reset}`);
      return;
    }
    runDir = path.join(AUTOMATE_RESULT_DIR, entries[0]);
  }

  const contextFile = path.join(runDir, 'execution_context.json');
  if (!fs.existsSync(contextFile)) {
    console.log(`${C.yellow}File execution_context.json tidak ditemukan di ${runDir}.${C.reset}`);
    return;
  }

  console.log(`\n${C.bold}${C.cyan}======================================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}🔄 HANDOFF PROTOCOL: MELANJUTKAN VALIDASI DATABASE DARI BROWSER QA${C.reset}`);
  console.log(`${C.gray}Folder Run: ${runDir}${C.reset}`);
  console.log(`${C.bold}${C.cyan}======================================================================${C.reset}\n`);

  const ctx = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
  console.log(`Total Partial Scenarios: ${C.bold}${ctx.total_partial_scenarios}${C.reset}`);

  const evidenceRecords = [];

  for (const item of ctx.partial_scenarios) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`📌 Skenario: ${C.bold}${item.id}${C.reset} - ${item.title}`);
    console.log(`   Expected Col: "${item.expected}"`);
    console.log(`   Captured Runtime Inputs:`, item.captured_inputs);

    // Gate 2 & Gate 4: Dynamic DB resolution from discovered databases
    const discovered = discoverDatabasesFromEnv();
    const dbKeys = Object.keys(discovered);
    let targetDB = dbKeys.length > 0 ? dbKeys[0].toLowerCase() : 'primary';
    
    // Check if expected text mentions any discovered DB key
    const expLower = (item.expected || '').toLowerCase();
    for (const k of dbKeys) {
      if (expLower.includes(k.toLowerCase())) {
        targetDB = k.toLowerCase();
        break;
      }
    }

    console.log(`   Resolved Target DB: ${C.bold}${targetDB}${C.reset}`);
    
    // Connect to target DB
    const client = new MCPPostgresClient(targetDB);
    try {
      await client.start();

      // Extract table candidate from expected or captured inputs
      let tableFound = null;
      const expectedWords = item.expected.split(/\s+/);
      for (const w of expectedWords) {
        const clean = w.replace(/[^a-zA-Z0-9_]/g, '');
        if (clean.length > 3 && ['order', 'user', 'channel', 'customer', 'workflow', 'message'].some(k => clean.includes(k))) {
          tableFound = clean;
          break;
        }
      }

      if (!tableFound) {
        console.log(`${C.yellow}⚠️ Skenario ${item.id} belum mencantumkan nama tabel yang jelas pada 'expected'.${C.reset}`);
        console.log(`   Menjalankan Discovery Guard menggunakan captured inputs...`);
        const searchVal = Object.values(item.captured_inputs || {})[0] || '1';
        const hits = await runDiscoveryScenario(client, searchVal);
        evidenceRecords.push({
          scenario_id: item.id,
          target_db: targetDB,
          status: hits.length > 0 ? 'VERIFIED_VIA_DISCOVERY' : 'PARTIAL_UNVERIFIED',
          hits
        });
      } else {
        const searchVal = Object.values(item.captured_inputs || {})[0] || '';
        const rows = await runSingleTableScenario(client, tableFound, searchVal, null, 5);
        console.log(formatMarkdownTable(rows));
        evidenceRecords.push({
          scenario_id: item.id,
          target_db: targetDB,
          table: tableFound,
          status: rows && rows.length > 0 ? 'PASSED_DB_PERSISTED' : 'FAILED_NO_RECORD',
          rows_count: rows ? rows.length : 0
        });
      }
    } catch (err) {
      console.log(`${C.red}Error validasi DB: ${err.message}${C.reset}`);
    } finally {
      await client.close();
    }
  }

  // Save evidence
  const evidencePath = path.join(runDir, 'db_validation_evidence.json');
  fs.writeFileSync(evidencePath, JSON.stringify({
    run_id: ctx.run_id,
    validation_timestamp: new Date().toISOString(),
    evidence: evidenceRecords
  }, null, 2));

  console.log(`\n${C.green}✅ Bukti validasi database berhasil disimpan di:${C.reset}\n   ${evidencePath}\n`);
}

/**
 * Main CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const getArg = (prefix) => {
    const found = args.find(a => a.startsWith(prefix));
    return found ? found.substring(prefix.length) : null;
  };

  const help = args.includes('--help') || args.includes('-h');
  if (help) {
    console.log(`
${C.bold}Senior QA Database Validator (db_validator.js)${C.reset}

Usage:
  node db_validator.js [options]

Options:
  --target-db=<everpro|external>  Target database (default: everpro)
  --scenario=<single|table_list|partial|discovery>  Search scenario
  --table=<table_name>            Table name for single table scenario
  --tables=<t1,t2,t3>             Comma-separated tables for table_list scenario
  --query=<keyword>               Search keyword / identifier value
  --where="<where_clause>"        Custom safe WHERE condition
  --mode=<inspect|assert>         Evaluation mode (default: inspect)
  --expected='{"col":"val"}'      Expected JSON values for assert mode
  --recipe="<command_key>"        Read multi-table narrative from cheatsheet
  --handoff                       Run continuation for latest browser-qa run
  --from-run=<path>               Run continuation for specific run folder
  --list-schemas                  List all schemas in target DB
  --list-tables                   List tables in public schema
  --help, -h                      Show this help message

Examples:
  node db_validator.js --target-db=external --list-tables
  node db_validator.js --target-db=external --scenario=single --table=user --query=123
  node db_validator.js --target-db=external --scenario=discovery --query=customer
  node db_validator.js --handoff
`);
    process.exit(0);
  }

  // Check Handoff
  if (args.includes('--handoff') || getArg('--from-run=')) {
    await runHandoffContinuation(getArg('--from-run='));
    process.exit(0);
  }

  // Check Cheatsheet Recipe
  const recipeKey = getArg('--recipe=');
  if (recipeKey) {
    readCheatsheetRecipe(recipeKey);
  }

  // Resolve Target DB (Gate 2 - Dynamic Agnostic Discovery)
  const discoveredDBs = discoverDatabasesFromEnv();
  const availableDBKeys = Object.keys(discoveredDBs);
  const targetDBArg = getArg('--target-db=');
  let targetDB = null;

  if (targetDBArg) {
    const rawTarget = targetDBArg.trim();
    const cleanTarget = rawTarget.toUpperCase().replace(/-/g, '_').replace(/^DEV_/, '');
    
    // Check direct prefix match in discovered
    const matchedKey = availableDBKeys.find(k => k === cleanTarget || k.includes(cleanTarget) || cleanTarget.includes(k));
    if (matchedKey) {
      targetDB = matchedKey.toLowerCase();
    } else {
      // Pass raw target directly so Go binary can attempt resolution
      targetDB = rawTarget.toLowerCase();
    }
  } else {
    // If no targetDB is specified:
    if (availableDBKeys.length === 1) {
      targetDB = availableDBKeys[0].toLowerCase();
      console.log(`\x1b[32m[GATE 2 AUTO-RESOLVE] Hanya 1 database terdaftar di environment [${availableDBKeys[0]}], otomatis digunakan.\x1b[0m`);
    } else if (availableDBKeys.length > 1) {
      console.log(`${C.red}🛑 [GATE 2: TARGET DATABASE RESOLUTION GATE]${C.reset}`);
      console.log(`Ditemukan ${availableDBKeys.length} database terdaftar di file environment:`);
      availableDBKeys.forEach((k, idx) => {
        const info = discoveredDBs[k];
        console.log(`  (${idx + 1}) --target-db=${k.toLowerCase()} (Host: ${info.HOST || info.URL || 'Configured'})`);
      });
      console.log(`\nSilakan pilih salah satu target menggunakan flag: ${C.bold}--target-db=<target_name>${C.reset}\n`);
      process.exit(1);
    } else {
      targetDB = 'everpro';
    }
  }
  const dbName = getArg('--db-name=');

  const dbDisplay = dbName ? `${targetDB}.${dbName}` : targetDB;
  console.log(`\n${C.bold}${C.cyan}======================================================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}🛡️  SENIOR QA DATABASE VALIDATOR - TARGET: DEV_${dbDisplay}${C.reset}`);
  console.log(`${C.bold}${C.cyan}======================================================================${C.reset}\n`);

  const client = new MCPPostgresClient(targetDB, dbName);
  try {
    await client.start();

    // Check list schemas
    if (args.includes('--list-schemas')) {
      const schemas = await client.listSchemas();
      console.log(`\n${C.bold}Daftar Schema pada DEV_${targetDB}:${C.reset}`);
      console.log(formatMarkdownTable(schemas));
      return;
    }

    // Check list tables
    if (args.includes('--list-tables')) {
      const tables = await client.listObjects('public', 'table');
      console.log(`\n${C.bold}Daftar Tabel pada DEV_${targetDB} (schema: public):${C.reset}`);
      console.log(formatMarkdownTable(tables));
      return;
    }

    // Determine Scenario
    const scenario = getArg('--scenario=') || 'single';
    const table = getArg('--table=');
    const tablesArg = getArg('--tables=');
    const query = getArg('--query=') || '';
    const where = getArg('--where=');
    const mode = getArg('--mode=') || 'inspect';
    const expectedRaw = getArg('--expected=');

    let rowsResult = [];

    if (scenario === 'single') {
      if (!table) {
        console.log(`${C.red}Parameter --table=<nama_tabel> wajib diisi untuk skenario single table.${C.reset}`);
        process.exit(1);
      }
      rowsResult = await runSingleTableScenario(client, table, query, where);
      console.log(`\n${C.bold}Hasil Data:${C.reset}`);
      console.log(formatMarkdownTable(rowsResult));
    } else if (scenario === 'table_list') {
      if (!tablesArg) {
        console.log(`${C.red}Parameter --tables=<t1,t2,...> wajib diisi untuk skenario table_list.${C.reset}`);
        process.exit(1);
      }
      const tablesList = tablesArg.split(',');
      await runTableListScenario(client, tablesList, query);
      return;
    } else if (scenario === 'discovery') {
      if (!query) {
        console.log(`${C.red}Parameter --query=<keyword> wajib diisi untuk skenario discovery.${C.reset}`);
        process.exit(1);
      }
      await runDiscoveryScenario(client, query);
      return;
    } else {
      console.log(`${C.yellow}Skenario '${scenario}' tidak dikenali. Gunakan single, table_list, atau discovery.${C.reset}`);
      return;
    }

    // Evaluation Mode
    if (mode === 'assert') {
      if (!expectedRaw) {
        console.log(`${C.yellow}Mode assert membutuhkan parameter --expected='{"col":"val"}'${C.reset}`);
      } else {
        try {
          const expectedObj = JSON.parse(expectedRaw);
          evaluateAssertion(rowsResult, expectedObj, `DEV_${targetDB}.${table}`);
        } catch (e) {
          console.log(`${C.red}Format --expected harus JSON valid: ${e.message}${C.reset}`);
        }
      }
    }

  } catch (err) {
    console.error(`\n${C.red}[ERROR DATABASE QA]: ${err.message}${C.reset}\n`);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
