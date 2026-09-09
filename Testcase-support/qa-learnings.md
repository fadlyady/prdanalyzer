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
