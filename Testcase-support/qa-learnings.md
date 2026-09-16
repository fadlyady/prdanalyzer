# Continuous QA Learnings & Knowledge Base (`qa-learnings.md`)

File ini berfungsi sebagai **Single Source of Truth (SSOT) untuk Continuous Learning & Retrospective Review**. Setiap kali dokumen analisis atau test case selesai dievaluasi oleh tim (PO, Dev, QA Lead) atau terjadi bug escape di staging/production, temuan dan pelajaran baru dicatat di sini agar seluruh skill AI selalu ter-update dan semakin tajam.

---

## 📚 Daftar Pola Pembelajaran & Guardrails Baru

### [2026-09-09] - Framework Upgrade: Universal Multi-Platform & 3-Tier Coverage
- **Kategori Gap**: Architecture & Methodology Standardization
- **Temuan / Feedback**: Skill awal terlalu terikat pada satu domain aplikasi web, minim NFR/Idempotency, dan assertion hanya berfokus pada UI visual.
- **Root Cause**: Keterbatasan heuristik awal yang belum mengintegrasikan standar pengujian enterprise (SFDIPOT, Triple-Layer Assertions, Exploratory Charters).
- **Action Item & Guardrail Baru**:
  - Mewajibkan *Interactive Clarification Gate* dengan 7 Dimensi Checklist sebelum analisis difinalisasi (zero-assumption).
  - Menerapkan *Triple-Layer Assertions* (UI State + API Contract + DB Persistence).
  - Menyediakan *3-Tier Coverage Matrix* (Happy Path, Boundary/Systemic Edge Cases, Heuristic Exploratory Charters).
  - Mengabstraksi format ID menjadi `<PLATFORM>-<MODULE>-<SUBMODULE>-<TYPE>-<SEQ>`.

---

### [2026-09-16] - Strict Zero-Wild-Guess: Larangan Asumsi Rute Endpoint API & Penegakan Narasi Fungsional
- **Kategori Gap**: Technical Accuracy & Zero-Hallucination Guardrails
- **Temuan / Feedback**: Terdapat penulisan path endpoint API tiruan (misal: `GET /api/v1/pricing/resolve`, `/api/v1/sessions/...`) yang tidak ada di dokumen PRD maupun file OpenAPI/TRD resmi.
- **Root Cause**: Upaya memodelkan layer API Contract pada Triple-Layer Assertions secara berlebihan (over-specification) tanpa dasar dokumen resmi di `./adhoc-document/`.
- **Action Item & Guardrail Baru**:
  - **Dilarang Keras Mengarang Endpoint/Schema**: Hanya gunakan path URL / endpoint API jika tercantum secara eksplisit pada berkas OpenAPI / TRD resmi di `./adhoc-document/` (seperti `POST /v1/chat/webhook/process/dropped-message`).
  - **Penegakan Narasi Pendekatan Fungsional**: Jika spesifikasi teknis API belum dirilis, deskripsikan layer API/Service menggunakan **narasi pendekatan kontrak fungsional** yang netral (misal: `[Service/Contract] Pricing Engine Service memvalidasi parameter...`).
  - Dokumen analisis dan test case harus bersih dari asumsi liar agar tidak menyesatkan tim Dev dan Manual/Automation QA.

---

### [2026-09-16] - Grounding Alur UI & Navigasi Menu Berbasis Berkas `./strukturmenu/`
- **Kategori Gap**: UI Navigation & Test Step Precision
- **Temuan / Feedback**: Penulisan alur navigasi menu pada precondition dan step harus diverifikasi terhadap screen capture di `./strukturmenu/` dan teks PRD.
- **Root Cause**: Pembuatan hierarki menu yang tidak grounded pada bukti visual antarmuka yang sudah disediakan.
- **Action Item & Guardrail Baru**:
  - **Wajib Validasi `./strukturmenu/`**: Sebelum menyusun langkah UI (*steps*), periksa seluruh gambar tangkapan layar di `./strukturmenu/` (seperti `chatroom-web/`, `dashboard-crm/`, `customer-dashboard/`).
  - **Alur Menu Terbukti Ada**: Jika menu/elemen UI ada di `./strukturmenu/` (contoh: menu `WhatsApp Credit`, icon `Setting Panel` chatroom, modal `Pop up limit chatroom`, modal `Pop up top up chatroom limit`), gunakan penamaan menu, tombol CTA, dan urutan klik (Klik Menu A $\rightarrow$ Submenu B $\rightarrow$ CTA C) persis sesuai bukti visual.
  - **Menu Internal / Non-Terdokumentasi**: Jika modul UI tidak terdapat di `./strukturmenu/` dan PRD tidak melampirkan mockup (misal portal internal Biz Ops Admin), gunakan penamaan modul fungsional resmi PRD (misal `[Credit Management - Admin]`) tanpa mengarang pohon hierarki menu fiktif.

---

### [2026-09-16] - Preventative Ambiguity Clarification Gate & Default Fallback Handling
- **Kategori Gap**: Ambiguity Management & User Decision Control
- **Temuan / Feedback**: Jika informasi masih abu-abu (requirement bisnis atau keberadaan menu UI), Agent harus proaktif bertanya. Jika user menunda/skip, pertanyaan dicatat terpisah dan sistem menerapkan standar default netral.
- **Root Cause**: Ketiadaan opsi terstruktur saat menghadapi gap data antara langsung mengasumsikan atau memblokir eksekusi.
- **Action Item & Guardrail Baru**:
  - **Wajib Bertanya pada Area Abu-Abu**: Identifikasi area yang ambigu (aturan kalkulasi, limit, atau keberadaan menu UI) dan ajukan ke user secara terstruktur sebelum eksekusi.
  - **Opsi User**:
    1. *Melengkapi Data*: Digunakan langsung pada analisis dan test case.
    2. *Skip / Ditunda*: Disimpan ke berkas terpisah `./result-testcase/questions-for-pm-<feature_name>.md` dan ditandai `[PENDING PM CLARIFICATION]`.
    3. *Gunakan Default*: Terapkan format netral `[Nama Modul - Role]` untuk UI dan `[Service/Contract] <Service>...` untuk API tanpa mengarang entitas fiktif.


---


