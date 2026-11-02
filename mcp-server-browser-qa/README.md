# Browser QA Guard MCP Server (`browser-qa-guard`)

> **Model Context Protocol (MCP) Server untuk Pengujian QA Browser yang Aman, Terisolasi, dan Deterministik.**
> Dibangun untuk menegakkan 6 Gerbang Validasi Kualitas (*6 Mandatory QA Gates*) dari skill `browser-qa-execution` langsung pada level eksekusi kode (bukan sekadar instruksi teks AI).

---

## 1. Ikhtisar & Tujuan

Saat menjalankan pengujian UI staging dengan AI, pendekatan berbasis prompt biasa memiliki risiko:
1. **Risiko Mutasi Destruktif**: AI bisa tidak sengaja mengklik tombol *Delete/Drop/Bayar* di database staging jika salah paham instruksi.
2. **Kebocoran Kredensial**: AI membaca file `.env` dan password plaintext masuk ke dalam prompt/log context chat.
3. **Tab & Domain Hijacking**: AI bisa saja beralih ke tab produksi atau tautan phishing eksternal.

`browser-qa-guard` hadir sebagai **middleware pengaman (Hard Guardrail)** antara AI Agent dan Google Chrome (via Playwright / Chrome DevTools Protocol port 9222).

---

## 2. Pemetaan 6 Mandatory QA Gates ke MCP Tools

| QA Gate | Tantangan di Prompt-Only | Solusi Deterministik MCP Tool |
| :--- | :--- | :--- |
| **Gate 2: Target URL & Tab Protection** | AI bisa salah navigasi ke tab produksi atau URL asing. | `qa_check_browser_state` & `qa_init_browser`: Menerapkan `DomainGuard` whitelist dan menutup tab sisa pengujian lain. |
| **Gate 3: Credential Verification & Zero Leak** | Password staging terbaca di prompt chat. | `qa_list_available_roles` & `qa_login_role`: Password diinjeksi langsung ke DOM form browser dari server lokal; **password tidak pernah dikirim ke LLM**. |
| **Gate 4: Pre-flight Action Permission** | AI bisa lupa konfirmasi izin mutasi sebelum create/edit/delete. | `qa_set_mutation_permission` & `qa_execute_action`: Jika `allow_mutation = false`, selector bertema destruktif otomatis diblokir di runtime dan menghasilkan status `PARTIAL TEST WITH REASON`. |
| **Gate 5: Transparent Status Flagging** | Penamaan status dan screenshot tidak konsisten. | `qa_assert_element` & `qa_capture_evidence`: Otomatis menyimpan screenshot ke `browser-execution/automate-result/run_<Feature>_<timestamp>/` dengan format standar. |
| **Gate 6: RBAC Session Reset** | Cookies akun sebelumnya menempel dan mencemari pengujian role berikutnya. | `qa_reset_session`: Pembersihan menyeluruh pada cookies, localStorage, dan sessionStorage antar role. |

---

## 3. Daftar Tools yang Disediakan

1. `qa_check_browser_state`: Memeriksa port CDP 9222 dan mendaftar tab terbuka.
2. `qa_init_browser`: Membuka/menyambungkan Chrome dengan `--start-maximized` dan validasi URL domain.
3. `qa_list_available_roles`: Mendeteksi role dari `.env` dengan password 100% ter-masking.
4. `qa_set_mutation_permission`: Mengaktifkan/menonaktifkan Safe Mode mutasi data.
5. `qa_login_role`: Login otomatis tanpa kebocoran plaintext password.
6. `qa_execute_action`: Eksekusi aksi klik/ketik/pilih dengan interceptor mutasi otomatis.
7. `qa_assert_element`: Evaluasi status UI (visible, hidden, contains_text, url_contains).
8. `qa_capture_evidence`: Pengambilan screenshot evidence terstruktur per langkah.
9. `qa_reset_session`: Isolasi session storage antar pergantian role RBAC.
10. `qa_close_browser`: Penutupan browser yang bersih setelah pengujian selesai.

---

## 4. Cara Konfigurasi (Jika Nanti Ingin Diterapkan)

Server MCP ini **belum diaktifkan secara default** agar tidak mengganggu alur kerja saat ini.

Jika nanti Anda ingin mengaktifkannya, cukup daftarkan server ini ke konfigurasi MCP AI Anda (misalnya di file `mcp_config.json`):

```json
{
  "mcpServers": {
    "browser-qa-guard": {
      "command": "node",
      "args": [
        "${workspaceFolder}/mcp-server-browser-qa/src/index.js"
      ],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

---

## 5. Menjalankan Uji Coba Mandiri (Standalone Test)

Untuk memverifikasi bahwa server MCP merespons dengan benar tanpa melibatkan AI:

```bash
cd mcp-server-browser-qa
node src/index.js
```
Server akan berjalan di stdio dan siap menerima payload JSON-RPC dari client MCP standar.
