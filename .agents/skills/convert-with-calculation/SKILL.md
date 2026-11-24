---
name: convert-with-calculation
description: >-
  Standard operating procedure for converting QA PRD analysis, test matrices, and test walkthrough documentation
  from markdown (.md) format into professional Word (.docx / .doc) or PDF (.pdf) documents matching executive corporate TIW standards.
  Integrates an automated quantitative calculation engine that computes Basic Risk Coverage (%),
  Weighted Risk Coverage (%) with weights 4/3/2/1, Requirements Coverage (%), and enforces strict mathematical Go / Conditional Go / No-Go
  Release Recommendation logic embedded directly into executive scorecards.
  Activate when the user asks to convert, export, or generate docx/doc/pdf files with calculated quality metrics and release gates.
---

# Universal Document Conversion with Calculation Skill (`convert-with-calculation`)

> [!IMPORTANT]
> **Kepatuhan Pondasi (wajib dibaca sebelum menjalankan skill ini):** `.agents/shared/FOUNDATION.md` adalah acuan tertinggi; bila ada aturan di bawah yang bertentangan, Pondasi yang berlaku.
> - **Profil aktif:** jalankan `python3 scripts/qa_feature.py where` untuk mengetahui alias `<ALIAS>`; artefak fitur ada di `work/<ALIAS>/<fitur>/` (buat dengan `python3 scripts/qa_feature.py init <fitur>` bila belum ada). Bila fitur sudah punya `00-scope.md`, alias di file itu yang dipakai.
> - **Kerahasiaan:** nilai asli (URL, package, akun, DSN) hanya dibaca server/runner dari `.secrets/<ALIAS>.env`; AI tidak membuka file itu dan tidak menulis nama aplikasi, host, package, atau akun asli di artefak — pakai alias (`<ALIAS>`, `{{role:owner}}`, `db:main`).
> - **Verdict & metrik:** `.agents/shared/standards/status-verdict-evidence.md` dan matriks risiko di `.agents/shared/standards/analysis.md`. Metrik dihitung dari TC yang dijalankan & lulus dalam scope; data kurang → `INSUFFICIENT DATA`.
> - **Status engine:** `calc_engine.py` dijadwalkan diperbaiki pada fase P0 (lihat analisa workflow). Sampai saat itu, scorecard wajib dicek manual terhadap risk register sebelum dibagikan; jangan menyatakan GO hanya dari angka engine.


Skill ini digunakan untuk mengonversi dokumen hasil analisa PRD, Test Matrix, dan Test Execution Walkthrough (`.md`) menjadi format dokumen korporat profesional (**Word `.docx` / `.doc`** dan **PDF `.pdf`**) yang dilengkapi dengan **Perhitungan Kuantitatif Otomatis (Weighted Risk Coverage Math Engine)** dan **Rekomendasi Keputusan Rilis Objektif (Go / Conditional Go / No-Go Decision Logic)** berstandar **TIW (Test Idea & Walkthrough)**.

---

## 1. Lokasi Berkas & Skrip Pendukung Dinamis

- **Dokumen Sumber (Markdown)**: 
  - `work/<ALIAS>/<fitur>/01-analysis.md` (atau path berkas `.md` kustom).
- **Skrip Konverter & Engine Perhitungan**:
  - Calculation Engine: `.agents/skills/convert-with-calculation/scripts/calc_engine.py`
  - Word Converter: `.agents/skills/convert-with-calculation/scripts/md_to_docx.py`
  - PDF Converter: `.agents/skills/convert-with-calculation/scripts/md_to_pdf.py`
- **Target Output**:
  - `work/<ALIAS>/<fitur>/01-analysis.docx`
  - `work/<ALIAS>/<fitur>/01-analysis.pdf`

---

## 2. Model Perhitungan Metrik & Formula Bobot (Weighted Risk Math)

Skrip konversi secara otomatis mengekstraksi dan menghitung metrik berikut dari dokumen input:

### 1. Formula Cakupan Risiko Berbobot (Weighted Risk Coverage)

$$\text{Basic Coverage} = \frac{\text{Risiko Tercover}}{\text{Total Risiko}} \times 100\%$$

$$\text{Weighted Coverage} = \frac{\sum (\text{Bobot Risiko Tercover})}{\sum (\text{Total Bobot Risiko})} \times 100\%$$

| Level Risiko | Bobot Skor | Kriteria Bobot |
| :--- | :---: | :--- |
| **Critical** | **4** | Alur transaksi inti, kepatuhan finansial/regulasi, data security/BOLA. |
| **High** | **3** | Fitur sekunder terdampak tinggi, kegagalan kalkulasi, disrupsi operasional. |
| **Medium** | **2** | Reporting minor, sorting/filter lambat, terdapat workaround. |
| **Low** | **1** | Isu visual/kosmetik, alignment UI, tooltip hilang. |

### 2. Logika Keputusan Rilis Objektif (Go / No-Go Gate)

| Keputusan Rilis | Kriteria Logis Kuantitatif |
| :--- | :--- |
| **GO** | • Critical & High Risk Coverage = **100%**<br>• Requirements (Happy Path) Coverage = **100%**<br>• Weighted Risk Coverage $\ge$ **90%** |
| **CONDITIONAL GO** | • Critical & High Risk Coverage = **100%**<br>• Requirements Coverage $\ge$ **80%**<br>• Weighted Risk Coverage $\ge$ **85%**<br>• Seluruh celah terbuka hanya pada level Medium / Low |
| **NO-GO** | • Terdapat risiko Critical / High yang belum tercover (**< 100%**), ATAU<br>• Requirements Coverage **< 80%**, ATAU<br>• Weighted Risk Coverage **< 85%** |

---

## 3. Standar Struktur & Formatting TIW

Dokumen Word dan PDF yang dihasilkan secara otomatis menyertakan:

1. **Executive Metadata Box**:
   - Judul Dokumen TIW (`[TIW] <Judul Analisis>`).
   - Tabel Atribut (Product Name, Supporting Docs, Contributor, Approver, Informed).
2. **Changelog & Approval Table**:
   - Status reviewer (`Pending`, `Approved`, `Changes Requested`), tanggal review, dan catatan approval.
3. **Executive Quality Gate & Scorecard Table (Calculated)**:
   - Tabel ringkasan metrik kuantitatif terukur (Requirements Coverage, Critical/High Risk Coverage, Basic Coverage, Weighted Coverage).
   - Badge dan paragraf ringkasan status keputusan rilis: `[GO]`, `[CONDITIONAL GO]`, atau `[NO-GO]`.
4. **Isi Analisis Terstruktur**:
   - Heading hierarkis dengan typography bersih (Arial / Helvetica).
   - Bullet points & penomoran terstruktur.
   - Tabel Decision Matrix & Test Cases dengan aksen header **Cyan** (`#00FFFF`).
   - Tabel RBAC, BVA & NFR dengan aksen header **Gray** (`#CCCCCC`).
5. **Feedbacks & Review Log**:
   - Tabel pencatatan log review meeting dan tindak lanjut perbaikan.

---

## 4. Cara Menjalankan Konversi

### A. Konversi ke DOCX / DOC
```bash
python3 .agents/skills/convert-with-calculation/scripts/md_to_docx.py \
  `work/<ALIAS>/<fitur>/01-analysis.md` \
  `work/<ALIAS>/<fitur>/01-analysis.docx`
```

### B. Konversi ke PDF
```bash
python3 .agents/skills/convert-with-calculation/scripts/md_to_pdf.py \
  `work/<ALIAS>/<fitur>/01-analysis.md` \
  `work/<ALIAS>/<fitur>/01-analysis.pdf`
```

### C. Eksekusi Engine Perhitungan Mandiri (JSON Output)
```bash
python3 .agents/skills/convert-with-calculation/scripts/calc_engine.py \
  `work/<ALIAS>/<fitur>/01-analysis.md`
```

---

## 5. Alur Kerja Eksekusi (Execution Workflow)

```mermaid
graph TD
    A["1. Terima permintaan ekspor dari User (docx / pdf / all)"] --> B["2. Identifikasi file input .md di `work/<ALIAS>/<fitur>/`"]
    B --> C["3. Eksekusi calc_engine.py (Hitung Basic & Weighted Coverage + Go/No-Go)"]
    C --> D{"4. Format Tujuan?"}
    D -- "docx / doc" --> E["Eksekusi md_to_docx.py dengan Embedded Scorecard"]
    D -- "pdf" --> F["Eksekusi md_to_pdf.py dengan Embedded Scorecard"]
    D -- "Keduanya" --> G["Eksekusi md_to_docx.py & md_to_pdf.py"]
    E --> H["5. Verifikasi file hasil di `work/<ALIAS>/<fitur>/`"]
    F --> H
    G --> H
    H --> I["6. Berikan link berkas terhitung langsung ke User"]
```

---

## 6. Protokol Anti-Regresi & Pencegahan Konflik Aturan (Universal Guardrail)

> [!CAUTION]
> **PRINSIP KEKEBALAN DAN KONSISTENSI SKILL (ANTI-REGRESSION POLICY):**
> 1. **Dilarang Mengubah/Menghapus Rule Tanpa Persetujuan**: Seluruh aturan fundamental yang sudah stabil pada skill ini **TIDAK BOLEH diubah, diganti, atau dihapus sepihak oleh AI**, kecuali penambahan aturan baru tersebut terbukti objektif lebih baik dan telah disetujui oleh User.
> 2. **Pre-Calibration Sanity & Conflict Check**: Setiap pembaruan atau penambahan aturan baru harus dipastikan **TIDAK BERTENTANGAN** dengan formula pembobotan kuantitatif (4/3/2/1), logika matematis Go/Conditional Go/No-Go, dan visual scorecard TIW. Aturan baru harus bersifat memperketat / melengkapi (*additive/enriching*), bukan membatalkan aturan dasar.

