# PRD Analyzer & QA Automation Framework 🚀

Repository ini berisi toolset dan custom skills **Google Antigravity (AGY)** untuk mempercepat analisis Product Requirement Documents (PRD), perancangan test matrix, pembuatan test case berstandar industri, serta konversi dokumen hasil analisa ke format Word (`.docx`) dan PDF (`.pdf`) berstandar Everpro TIW (Test Idea & Walkthrough).

---

## 📦 Fitur & Agent Skills

Workspace ini dilengkapi dengan 3 custom skills terintegrasi di folder `.agents/skills/`:

### 1. 🔍 `prd-qa-analyzer`
- **Lokasi**: [`.agents/skills/prd-qa-analyzer/SKILL.md`](.agents/skills/prd-qa-analyzer/SKILL.md)
- **Fungsi**:
  - Mengekstraksi requirement bisnis dan teknis dari dokumen PRD (`.docx` / `.md`).
  - Memetakan matriks hak akses pengguna (RBAC) berdasarkan SSOT.
  - Memvalidasi konsistensi alur UI dengan screenshot di `strukturmenu/`.
  - Menyusun Decision Table, Boundary Value Analysis (BVA), dan State Transition.
  - Menghasilkan dokumen analisis standar di `result-testcase/PRD_Analysis_<Feature_Name>.md`.

### 2. 📝 `generate-testcase`
- **Lokasi**: [`.agents/skills/generate-testcase/SKILL.md`](.agents/skills/generate-testcase/SKILL.md)
- **Fungsi**:
  - Menghasilkan test suite komprehensif (Positive, Negative, Boundary, Security/RBAC, Failure Recovery).
  - Format output ganda:
    - **Markdown Format**: Siap untuk otomatisasi testing / tracking.
    - **Excel (.xlsx) Format**: Terstruktur dengan tab Test Suite, Coverage Summary, dan Test Runs.

### 3. 📄 `convert-document`
- **Lokasi**: [`.agents/skills/convert-document/SKILL.md`](.agents/skills/convert-document/SKILL.md)
- **Fungsi**:
  - Mengonversi dokumen hasil analisa (`.md`) menjadi format dokumen resmi Word (`.docx`) dan PDF (`.pdf`).
  - Menerapkan template standar **Everpro TIW (Test Idea & Walkthrough)** lengkap dengan tabel metadata, changelog, status approval, aksen tabel Decision Table Cyan (`#00FFFF`), dan tabel feedback.
  - Skrip konverter otomatis:
    - `python3 .agents/skills/convert-document/scripts/md_to_docx.py`
    - `python3 .agents/skills/convert-document/scripts/md_to_pdf.py`

---

## 🗂️ Struktur Direktori

```text
├── .agents/skills/           # Custom AI Agent Skills (prd-qa-analyzer, generate-testcase, convert-document)
├── Testcase-support/         # SSOT RBAC & Template Acuan TIW
├── strukturmenu/             # Pengetahuan Screenshot & Struktur UI Menu per Domain
│   ├── chatroom-web/
│   ├── customer-dashboard/
│   └── dashboard-crm/
├── adhoc-document/           # Dokumen Teknis Ad-hoc (Swagger, API contract, Architecture)
├── result-testcase/          # Hasil Analisis PRD (.md, .docx, .pdf) & Test Suites (.xlsx)
├── [PB & PRD] *.docx         # Berkas PRD Input
└── README.md
```

---

## 🚀 Panduan Penggunaan

### 1. Menjalankan Analisis PRD
Cukup berikan instruksi kepada AI Agent:
> *"Tolong lakukan analisis PRD untuk file [PB & PRD] Everpro Chat Meta New Pricing 2026.docx"*

### 2. Mengonversi Hasil Analisis ke DOCX / PDF
> *"Tolong konversikan dokumen hasil analisis result-testcase/PRD_Analysis_Meta_New_Pricing_2026.md menjadi format docx dan pdf"*

Atau jalankan skrip langsung:
```bash
# Export ke Word (.docx)
python3 .agents/skills/convert-document/scripts/md_to_docx.py \
  result-testcase/PRD_Analysis_Meta_New_Pricing_2026.md \
  result-testcase/PRD_Analysis_Meta_New_Pricing_2026.docx

# Export ke PDF (.pdf)
python3 .agents/skills/convert-document/scripts/md_to_pdf.py \
  result-testcase/PRD_Analysis_Meta_New_Pricing_2026.md \
  result-testcase/PRD_Analysis_Meta_New_Pricing_2026.pdf
```

---

## 👤 Author
- **Eldo Fadlyady** (QA Engineer)
