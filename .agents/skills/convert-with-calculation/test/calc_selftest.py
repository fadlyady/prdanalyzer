"""Selftest calc_engine dengan data sintetis (tanpa data aplikasi). Jalankan: python3 calc_selftest.py"""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts'))
from calc_engine import compute_metrics  # noqa: E402

ANALYSIS = """# Analisa ZZ
| AC-ID | Aktor/Role | Precondition | Pemicu | Expected per layer | Sumber | Risiko | Prioritas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AC-01 | role:a | - | x | [UI] y | [PRD §1] | ZZ-RSK-001 | P1 |
| AC-02 | role:a | - | x | [UI] y | [PRD §1] | ZZ-RSK-002 | P2 |
## 4. Risk Register
| Risk ID | Failure → Chain → Impact | Impact | Likelihood | Risk Level | Weight | Pillar | Mitigation | Covered by (AC) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ZZ-RSK-001 | data flow lambat → low conversion | High | High | Critical | 4 | Financial | TC | AC-01 |
| ZZ-RSK-002 | x | High | Low | Medium | 2 | Financial | TC | AC-02 |
| ZZ-RSK-003 | x | Low | Low | Low | 1 | Customer | TC POS-009 | |
| ZZ-RSK-004 | x | Medium | Medium | Medium | 2 | Customer | TC NEG-001/002 | |
"""
TCS = """### ALL-ZZ-POS-001: a
- **Covers**: AC-01
### ALL-ZZ-POS-002: b
- **Covers**: AC-02
### ALL-ZZ-NEG-002: c
- **Covers**: -
"""
results = []


def check(name, cond):
    results.append(cond)
    print(('PASS ' if cond else 'FAIL ') + name)


with tempfile.TemporaryDirectory() as d:
    a = os.path.join(d, '01-analysis.md')
    open(a, 'w').write(ANALYSIS)
    m = compute_metrics(ANALYSIS, a)
    check('tanpa test case -> INSUFFICIENT DATA, tanpa angka default', m['readiness'] == 'INSUFFICIENT DATA' and m['weighted_risk_coverage'] is None)
    check('level dari kolom Risk Level, bukan substring ("flow"/"low" di deskripsi)', m['risks'][0]['level'] == 'critical')
    check('peringatan matriks D5 pilar ketat (High×Low Financial = High)', any('ZZ-RSK-002' in w and 'pilar ketat' in w for w in m['warnings']))
    open(os.path.join(d, '02-testcases.md'), 'w').write(TCS)
    m = compute_metrics(ANALYSIS, a)
    by = {k['id']: k for k in m['risks']}
    check('cakupan via AC (tabel AC + Covered by)', by['ZZ-RSK-001']['covered'] and by['ZZ-RSK-002']['covered'])
    check('mitigasi ID pendek "NEG-001/002" cocok ke TC yang ada', by['ZZ-RSK-004']['tc_ids'] == ['ALL-ZZ-NEG-002'])
    check('mitigasi menyebut TC yang tidak ada -> tidak tercakup', not by['ZZ-RSK-003']['covered'])
    check('weighted coverage dihitung (8/9 = 88.9%)', m['weighted_risk_coverage'] == 88.9)
    check('readiness READY WITH GAPS (weighted < 90)', m['readiness'] == 'READY WITH GAPS')
    r = os.path.join(d, 'r.json')
    json.dump({'roles': {'x': [{'id': 'ALL-ZZ-POS-001', 'status': 'PARTIAL', 'priority': 'P1'},
                               {'id': 'ALL-ZZ-POS-002', 'status': 'PASSED', 'priority': 'P2'}]}}, open(r, 'w'))
    m = compute_metrics(ANALYSIS, a, results_path=r)
    check('risiko Critical tanpa TC PASSED -> verdict eksekusi NO-GO', m['execution']['verdict'] == 'NO-GO')
    m = compute_metrics('# kosong\nteks saja\n', os.path.join(d, 'x', 'x.md'))
    check('tanpa risk register -> INSUFFICIENT DATA, 0 risiko', m['readiness'] == 'INSUFFICIENT DATA' and m['total_risks'] == 0)

print(f"\n{sum(results)} PASS, {len(results) - sum(results)} FAIL")
sys.exit(0 if all(results) else 1)
