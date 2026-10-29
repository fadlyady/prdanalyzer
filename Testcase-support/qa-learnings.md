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
    2. *Skip / Ditunda*: Disimpan ke berkas terpisah `./doc-analyzer/result-testcase/questions-for-pm-<feature_name>.md` dan ditandai `[PENDING PM CLARIFICATION]`.
    3. *Gunakan Default*: Terapkan format netral `[Nama Modul - Role]` untuk UI dan `[Service/Contract] <Service>...` untuk API tanpa mengarang entitas fiktif.


---

### [2026-09-18] - Exhaustive Document Ingestion & Zero-Omission Dissection Protocol
- **Kategori Gap**: Document Parsing Depth & Complete Coverage Ingestion
- **Temuan / Feedback**: Informasi penting di dalam dokumen teknis (seperti tabel skenario pengujian, sampel kasus transisi status, dan detail arsitektural) sempat terlewat pada iterasi awal analisis. Ini bukan tentang membuat aturan kaku pada judul section tertentu, melainkan keharusan untuk membedah dokumen input secara mendalam dan menyeluruh (*exhaustive*) agar tidak ada informasi berharga yang terabaikan.
- **Root Cause**: Pola pemrosesan dokumen yang masih bersifat selektif (*skimming* / *surface-level parsing*), di mana agen terlalu cepat menarik kesimpulan konseptual tingkat tinggi tanpa menginventarisasi seluruh tabel teknis dan sampel kasus yang sudah disediakan di dokumen sumber.
- **Action Item & Guardrail Baru**:
  1. **Exhaustive Document Traversal (Bedah Total)**: Sebelum menyusun analisis, agen wajib membaca dan memetakan seluruh isi dokumen dari awal hingga akhir tanpa melewatkan tabel data, diagram, sampel skenario teknis, atau lampiran.
  2. **Inventory & Anchor of Source Scenarios**: Jika dokumen input sudah memuat contoh skenario atau tabel transisi status, seluruh butir tersebut wajib diinventarisasi sebagai baseline pengujian, kemudian dikembangkan secara proaktif ke skenario kombinatorial yang lebih luas (*extended permutations*, *race conditions*, *rate changes*, dan *error boundaries*).
  3. **Strict Grep-Before-Answer Communication**: Dilarang menyebutkan kode Test Case ID, nomor baris, atau nama tabel dalam percakapan tanpa melakukan pencarian eksak (`grep_search` / `view_file`) ke file fisik terlebih dahulu untuk mencegah halusinasi penamaan.
  4. **Strict Isolation of Pending PM Questions**: Pertanyaan klarifikasi yang belum dijawab resmi oleh Product Manager dilarang keras dijawab secara sepihak; wajib dipertahankan dengan label `[PENDING PM CLARIFICATION]`.

---

### [2026-10-19] - Tab Cleanup, Role Batching & Clean Session Reset (Anti-RBAC Contamination)
- **Kategori Gap**: Multi-Role Test Execution, Browser State Hygiene & RBAC Integrity
- **Temuan / Feedback**: Ketika menjalankan test case yang memiliki berbagai role berbeda di tiap baris (misal Owner, CS, Admin), eksekusi tanpa manajemen sesi menimbulkan *Role Bleed / RBAC Contamination* (skenario CS dijalankan dengan akun Owner). Selain itu, tab browser bertumpuk jika dibuka tanpa penutupan tab sisa sebelumnya.
- **Root Cause**:
  1. Flat sequential execution loop pada satu tab tanpa deteksi perubahan role antar baris.
  2. Ketiadaan mekanisme *Tab Cleanup* pada inisialisasi browser sehingga tab pengujian lama menumpuk.
  3. Ketiadaan *Clean Session Reset* (`clearCookies`, clear `localStorage`/`sessionStorage`) sebelum berpindah ke role lain.
- **Action Item & Guardrail Baru**:
  1. **Tab Cleanup & Single Work Tab Mandate**: Saat menghubungkan runner ke Chrome CDP, runner mendeteksi seluruh tab terbuka dan secara otomatis menutup tab-tab sisa pengujian sebelumnya, menyisakan tepat **1 tab kerja aktif**. Seluruh skenario dalam suite dieksekusi pada tab tersebut tanpa membuka tab baru sembarangan.
  2. **Role Batching Protocol (Zero-Repeated Login)**:
     - Skenario pengujian dikelompokkan secara otomatis berdasarkan Role (`groupedByRole`).
     - Login hanya dieksekusi **satu kali per batch role** (mengeliminasi overhead waktu login-logout bolak-balik di setiap baris).
  3. **Clean Session Reset on Role Switch**: Saat runner berpindah dari satu role batch ke role batch berikutnya, runner secara otomatis membersihkan seluruh cookies dan storage sesi (`await context.clearCookies()`, `localStorage.clear()`, `sessionStorage.clear()`), lalu melakukan login dengan kredensial role baru dari `.env`.
  4. **Multi-Role RBAC Report Isolation**: Laporan Word (`.docx`) otomatis memisahkan tabel pengujian ke dalam sub-bagian masing-masing role secara terisolasi dan rapi.


