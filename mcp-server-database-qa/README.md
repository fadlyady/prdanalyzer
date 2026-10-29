# Database QA Guard MCP Server (`mcp-server-database-qa`)

> **PostgreSQL Model Context Protocol (MCP) Server for Deterministic, 4-Tier Security-Guarded Database QA Validation.**  
> Berfungsi sebagai **Security Gateway / Bastion Proxy** antara AI Agent (Cursor, Antigravity, Claude) dan basis data PostgreSQL staging (`DEV_everpro` & `DEV_db-external-dev`). Menjamin **100% Read-Only (Zero Mutation)** dan **Zero Credential Exposure** ke AI context window.

---

## 1. Arsitektur Keamanan 4 Lapis (*4-Tier Read-Only Guard*)

Server ini mengadopsi dan memperkuat mesin keamanan AST Go dari `postgre-mcp-go` (Dhafin / CrystalDBA) dengan 4 lapis pertahanan mutlak:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        4-TIER SECURITY GUARD                           │
├────────────────────────────────────────────────────────────────────────┤
│ LAPIS 1: ENGINE-LEVEL IMMUTABILITY                                     │
│ • Setiap koneksi TCP pool mengunci parameter kernel Postgres:          │
│   default_transaction_read_only = "on".                                │
│ • Postgres engine menolak DDL, DML (INSERT/UPDATE/DELETE), temp table, │
│   dan SELECT INTO di level kernel database.                            │
├────────────────────────────────────────────────────────────────────────┤
│ LAPIS 2: WIRE PROTOCOL ANTI-CHAINING                                   │
│ • Menggunakan Extended Query Protocol via jackc/pgx/v5.                │
│ • Menolak eksekusi multi-statement yang dipisahkan titik koma (;)      │
│   pada level pesan Parse protokol kawat PostgreSQL.                    │
├────────────────────────────────────────────────────────────────────────┤
│ LAPIS 3: C-PARSER AST ALLOWLIST (Fail-Closed Architecture)             │
│ • Menggunakan C-parser resmi PostgreSQL via pganalyze/pg_query_go/v6.  │
│ • Membedah SQL menjadi pohon Google Protobuf AST secara rekursif.      │
│ • Hanya 28 statement legal (SelectStmt, ExplainStmt, VariableShowStmt).│
│ • Mutlak Ditolak: InsertStmt, UpdateStmt, DeleteStmt, DropStmt,        │
│   AlterTableStmt, TruncateStmt, VariableSetStmt, CopyStmt, CreateStmt. │
├────────────────────────────────────────────────────────────────────────┤
│ LAPIS 4: ATURAN KHUSUS & 494 FUNCTION ALLOWLIST                        │
│ • Blokir klausa kunci baris: SELECT ... FOR UPDATE / FOR SHARE.        │
│ • Blokir EXPLAIN ANALYZE (karena mengeksekusi statement nyata).        │
│ • Blokir Parameterized LIKE (hanya menerima literal constant string).  │
│ • 494 Function Allowlist: Memblokir fungsi DoS & filesystem seperti    │
│   pg_sleep, pg_read_file, pg_write_file, lo_import, dblink_connect,   │
│   set_config, pg_terminate_backend, dan seluruh UDF bocor.             │
│ • Strict SafeIdentifier Regex: Semua nama tabel dan kolom WAJIB lolos │
│   validasi ^[A-Za-z_][A-Za-z0-9_$]*$ dan dibungkus QuoteIdent().      │
│ • Engine-Level PII Masking: Kolom password, hash, token, secret, otp,  │
│   dan credit_card otomatis disamarkan menjadi [REDACTED_PII].          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pilihan Model Eksekusi: Docker Gateway vs Local Runner

Server ini mendukung 2 mode pengoperasian yang **100% portabel (tanpa path hardcoded)**:

### Mode A: Docker / OrbStack Gateway (Sangat Direkomendasikan) ⭐
Pada mode ini, server berjalan di dalam kontainer Distroless di latar belakang via **OrbStack / Docker**.

```
┌─────────────────┐       Streamable HTTP       ┌───────────────────────────┐         TCP 5432         ┌─────────────────┐
│ AI Agent / Host │ ──────────────────────────> │ Docker/OrbStack Container │ ───────────────────────> │ Staging DB      │
│ (Zero Password) │   localhost:8081 / 8082     │ (Kredensial Terisolasi)   │   (Read-Only Session)    │ (Cloud Staging) │
└─────────────────┘                             └───────────────────────────┘                          └─────────────────┘
```

**Kelebihan Mode Gateway**:
- **Zero Credential Leakage**: Workspace project Anda 100% bersih dari password database. Password hanya hidup di memori kontainer Docker.
- **Dua Gateway Terisolasi**:
  - `http://localhost:8081` ➔ Terhubung ke `DEV_everpro`
  - `http://localhost:8082` ➔ Terhubung ke `DEV_db-external-dev`
- **Distroless Container**: Tidak ada shell (`/bin/sh`), tidak ada `curl`, dan berjalan sebagai user non-root.

#### Cara Menjalankan Mode A (Docker/OrbStack):
1. **Salin template kredensial kontainer**:
   ```bash
   cp mcp-server-database-qa/.env.docker.example mcp-server-database-qa/.env.docker
   ```
2. **Isi kredensial database staging di `mcp-server-database-qa/.env.docker`**:
   *(File ini sudah masuk `.gitignore` sehingga aman dan tidak akan pernah ter-commit).*
3. **Nyalakan Gateway**:
   ```bash
   npm run mcp:db:docker:up
   ```
   *Atau langsung via Docker CLI:*
   ```bash
   docker compose -f mcp-server-database-qa/docker-compose.yml up -d
   ```
4. **Cek Log / Matikan Gateway**:
   ```bash
   npm run mcp:db:docker:logs   # Melihat status traffic
   npm run mcp:db:docker:down   # Mematikan gateway
   ```

---

### Mode B: Local Stdio Process (Fallback)
Jika tidak ingin menggunakan Docker, server dapat dijalankan langsung di host machine menggunakan binary Go lokal via `runner.js`.

1. **Compile binary Go**:
   ```bash
   npm run mcp:db:build
   ```
2. **Isi kredensial di file `.env` root project** (mendukung format terpisah `HOST`, `PORT`, `USER`, `PASS`, `NAME` atau `URL`).
3. **Jalankan**:
   ```bash
   npm run mcp:db:everpro    # Jalankan instance everpro
   npm run mcp:db:external   # Jalankan instance external
   ```

---

## 3. Konfigurasi MCP Client (`.agents/mcp_config.json`)

Daftarkan server ke konfigurasi AI Agent Anda (Cursor, Claude Desktop, Antigravity) menggunakan relative path:

### Jika Menggunakan Mode A (Docker / OrbStack HTTP Gateway):
```json
{
  "mcpServers": {
    "browser-qa-guard": {
      "command": "node",
      "args": ["mcp-server-browser-qa/src/index.js"]
    },
    "database-qa-everpro": {
      "url": "http://localhost:8081/mcp"
    },
    "database-qa-external": {
      "url": "http://localhost:8082/mcp"
    }
  }
}
```

### Jika Menggunakan Mode B (Local Stdio Process):
```json
{
  "mcpServers": {
    "browser-qa-guard": {
      "command": "node",
      "args": ["mcp-server-browser-qa/src/index.js"]
    },
    "database-qa-everpro": {
      "command": "node",
      "args": ["mcp-server-database-qa/runner.js", "-target-db=everpro"]
    },
    "database-qa-external": {
      "command": "node",
      "args": ["mcp-server-database-qa/runner.js", "-target-db=external"]
    }
  }
}
```

---

## 4. Daftar Tools yang Disediakan

| Tool | Deskripsi | Input Utama |
| :--- | :--- | :--- |
| `assert_record` | **QA Deterministik Assertion**: Memeriksa record di tabel berdasarkan filter key-value. Jika `expected` diberikan, membandingkan expected vs actual (PASSED/FAILED). Jika tidak, bertindak sebagai data inspector. | `table`, `filter`, `expected` (opsional) |
| `search_tables` | **Pencarian Daftar Tabel Terbatas**: Mencari keyword/ID hanya pada daftar tabel yang ditentukan (`table_list`) dengan `LIMIT 5` untuk mencegah *full table scan*. | `tables` (array), `keyword` |
| `execute_sql` | Menjalankan satu pernyataan SQL read-only yang divalidasi 100% oleh parser AST C Postgres. | `sql` |
| `list_schemas` | Mendaftar semua skema database beserta pemiliknya. | *(none)* |
| `list_objects` | Mendaftar tabel, view, sequence, atau ekstensi dalam skema. | `schema_name`, `object_type` |
| `get_object_details` | Menampilkan skema DDL tabel: kolom, tipe data, default, foreign key, dan indeks. | `schema_name`, `object_name` |
| `explain_query` | Mendapatkan query plan `EXPLAIN (FORMAT JSON)` secara aman tanpa eksekusi. | `sql` |
| `get_top_queries` | Menampilkan ranking performa query dari `pg_stat_statements`. | `sort_by`, `limit` |
| `analyze_db_health` | Melakukan audit kesehatan database (koneksi, indeks bloat, vacuum, dsb). | `health_type` |

---

## 5. Pengujian & Verifikasi Unit Test

Seluruh *security boundary tests* diverifikasi menggunakan Go test suite bawaan:
```bash
cd mcp-server-database-qa
go test ./...
# ok  github.com/dhafinrizqullah/postgre-mcp-go/internal/safesql   (PASSED)
# ok  github.com/dhafinrizqullah/postgre-mcp-go/internal/pg        (PASSED)
# ok  github.com/dhafinrizqullah/postgre-mcp-go/internal/index     (PASSED)
```
Semua mutasi (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `SELECT INTO`, `FOR UPDATE`, `EXPLAIN ANALYZE`, dan injeksi fungsi berbahaya) diuji secara otomatis dan terbukti **100% tertolak**.
