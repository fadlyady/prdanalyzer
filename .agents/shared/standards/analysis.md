# Standar Analisa (M1) — Definition of Done

Analisa selesai bila setiap klaim bersumber, 14 dimensi tersentuh, dan setiap AC bisa langsung diturunkan ke test case
jenis apa pun (UI, API, DB, mobile).

## 1. Label sumber (wajib pada setiap aturan, angka, alur, nama menu/field)

| Label | Arti | Boleh jadi dasar expected? |
| --- | --- | --- |
| `[PRD §x]` / `[TRD §x]` | Kutipan/turunan langsung dokumen awal | Ya |
| `[UI-LIVE <run>]` | Hasil crawl/probe build tertentu (`profiles/<ALIAS>/knowledge/...`) | Ya, untuk build itu |
| `[UI-SHOT <file>]` | Screenshot/mockup manual bertanggal | Ya, bila tidak bertentangan dengan UI-LIVE |
| `[API <spec#op>]` / `[DB <schema>]` | Kontrak/skema resmi di `knowledge/api|db` | Ya |
| `[PM Q-xx]` | Jawaban PM/stakeholder tercatat | Ya |
| `[ASUMSI]` | Disimpulkan analis, belum dikonfirmasi | Tidak — TC turunan ditandai `Blocked by: assumption` |
| `[PENDING Q-xx]` | Pertanyaan terbuka | Tidak — TC turunan `Blocked by: Q-xx` |

## 2. Dimensi wajib (isi, atau `N/A — <alasan>`)

1. Scope: in-scope, out-of-scope, perubahan dari versi sebelumnya.
2. Aktor & otorisasi: role, hak per aksi, akses langsung URL/API.
3. Aturan bisnis & alur: decision table untuk logika multi-kondisi.
4. State & invariant: transisi valid dan yang dilarang.
5. Data: tipe, batas (BVA/EP), format, siklus hidup, PII.
6. Integrasi & kontrak: API, event/queue, pihak ketiga, async & waktu tunggu.
7. Error & fallback: kegagalan dependensi, timeout, offline.
8. Concurrency & idempotency.
9. Platform & environment: web/mobile/OS/browser, feature flag, konfigurasi.
10. Non-fungsional: keamanan, performa yang terlihat user, aksesibilitas.
11. Risiko bisnis: rantai konsekuensi, 6 pilar, level dari matriks (bagian 4).
12. Dampak regresi: fitur, modul, data terdampak.
13. Observability per layer: di mana hasil teramati — UI (layar/elemen), API (operasi/event), DB (tabel/kolom), LOG.
14. Kebutuhan data uji: akun per role (alias), data awal, data negatif, penyiap data.

## 3. Format AC yang dapat diturunkan

```markdown
| AC-ID | Aktor/Role | Precondition | Pemicu | Expected per layer | Sumber | Risiko | Prioritas |
| AC-03 | role:buyer | saldo cukup | konfirmasi bayar | [UI] status sukses + nomor order; [DB] order lunas | [PRD §4.2] | RSK-002 | P1 |
```
Hanya tulis layer yang relevan; layer tanpa observability ditulis `N/A` dengan alasan.

## 4. Matriks level risiko (D5) & bobot

| Impact \ Likelihood | Low | Medium | High |
| --- | --- | --- | --- |
| High | Medium | High | Critical |
| Medium | Low | Medium | High |
| Low | Low | Low | Medium |

- Pilar Financial, Compliance, atau keamanan/otorisasi dengan Impact High → minimal **High**.
- Bobot: Critical 4, High 3, Medium 2, Low 1. Prioritas TC: Critical→P1, High→P2, Medium→P3, Low→P4.
- Tabel risk register wajib memakai kolom `Risk ID | Failure → Chain → Impact | Impact | Likelihood | Risk Level | Weight | Pillar | Mitigation | Covered by (AC)`.

## 5. Gate sebelum M2

- [ ] Tidak ada aturan/angka/menu tanpa label sumber.
- [ ] 14 dimensi terisi atau N/A beralasan.
- [ ] Setiap AC punya expected teramati di minimal satu layer.
- [ ] Setiap risiko Critical/High terhubung ke minimal satu AC.
- [ ] Pertanyaan terbuka tercatat dengan dampak dan AC yang terblokir (`01-questions.md`).
- [ ] Konflik antar sumber (PRD vs UI-LIVE vs screenshot) diputuskan user atau dicatat sebagai Q.

## 6. Format `01-questions.md`

| Q-ID | Dimensi | AC/Section | Pertanyaan & konteks | Dampak bila tidak dijawab | AC terblokir | Status | Jawaban | Tanggal jawab |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
Status: `Open` / `Answered` / `Waived`. Saat dijawab: perbarui analisa (label `[PM Q-xx]`) dan tandai TC yang `Covers` Q itu `needs-update`.

## 7. Header versi (wajib di awal `01-analysis.md`)

```
> Versi: 1.0 | Sumber: <nama file> (versi/tanggal/hash) | Alias: <ALIAS> | Penulis: <runner> | Tanggal: YYYY-MM-DD
```
