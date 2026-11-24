"""Modul verdict tunggal (Python) — kembaran scripts/lib/verdict.cjs.

Implementasi .agents/shared/standards/status-verdict-evidence.md §1 & §3. Diuji dengan scripts/lib/verdict_cases.json.
"""
import re

_NORM = [
    (re.compile(r'^PASSED\s*\(LOW', re.I), 'PASSED_LOW'),
    (re.compile(r'^PASS(ED)?$', re.I), 'PASSED'),
    (re.compile(r'^PARTIAL', re.I), 'PARTIAL'),
    (re.compile(r'^FAIL', re.I), 'FAILED'),
    (re.compile(r'^BLOCKED', re.I), 'BLOCKED'),
    (re.compile(r'^NOT IN SCOPE', re.I), 'NOT_IN_SCOPE'),
    (re.compile(r'^SKIP', re.I), 'SKIP'),
]


def norm_status(s):
    t = str(s or '').strip()
    for rx, v in _NORM:
        if rx.search(t):
            return v
    return 'UNKNOWN'


def norm_priority(p):
    m = re.search(r'P\s*([1-4])', str(p or ''), re.I)
    return f'P{m.group(1)}' if m else None


def compute_verdict(results=None, risks=None, reviewed=False):
    results, risks = results or [], risks or []
    reasons, conditions = [], []
    counts = dict(total=len(results), passed=0, passed_low=0, partial=0, failed_product=0, failed_other=0,
                  blocked=0, skip=0, not_in_scope=0, unknown=0)
    passed_ids, executed = set(), 0
    high = lambda p: p in ('P1', 'P2')

    for r in results:
        rid = r.get('id')
        st = norm_status(r.get('status'))
        pr = norm_priority(r.get('priority'))
        if not pr and st not in ('SKIP', 'NOT_IN_SCOPE'):
            pr = 'P1'
            conditions.append(f'{rid}: prioritas tidak tercatat, diperlakukan P1 (konservatif).')
        if st == 'PASSED':
            counts['passed'] += 1; executed += 1; passed_ids.add(rid)
        elif st == 'PASSED_LOW':
            counts['passed_low'] += 1; executed += 1
            if high(pr): conditions.append(f'{rid} ({pr}) PASSED LOW CONFIDENCE — konfirmasi visual/screenshot.')
        elif st == 'PARTIAL':
            counts['partial'] += 1; executed += 1
            if high(pr): conditions.append(f'{rid} ({pr}) PARTIAL — layer belum tuntas.')
        elif st == 'FAILED':
            executed += 1
            cat = str(r.get('failure_category') or '').lower()
            if cat and cat != 'product':
                counts['failed_other'] += 1
                if high(pr): conditions.append(f'{rid} ({pr}) FAILED {cat} — perbaiki & jalankan ulang (dihitung BLOCKED).')
            else:
                counts['failed_product'] += 1
                note = '' if cat else ' [failure_category belum diisi → dianggap product sampai direview]'
                if high(pr): reasons.append(f'{rid} ({pr}) FAILED product{note}.')
                else: conditions.append(f'{rid} ({pr}) FAILED product{note} — defect prioritas rendah, butuh mitigasi & pemilik.')
        elif st == 'BLOCKED':
            counts['blocked'] += 1
            if high(pr): conditions.append(f'{rid} ({pr}) BLOCKED.')
        elif st == 'SKIP':
            counts['skip'] += 1
        elif st == 'NOT_IN_SCOPE':
            counts['not_in_scope'] += 1
        else:
            counts['unknown'] += 1
            conditions.append(f'{rid}: status "{r.get("status") or "-"}" tidak dikenal.')

    for k in risks:
        lvl = str(k.get('level') or '').lower()
        if lvl in ('critical', 'high') and not any(t in passed_ids for t in (k.get('tc_ids') or [])):
            reasons.append(f'Risiko {k.get("id")} ({k.get("level")}) belum punya satu pun TC PASSED dalam scope.')

    if not executed:
        verdict = 'INSUFFICIENT DATA'
        reasons.append('Tidak ada TC yang benar-benar dieksekusi (semua BLOCKED/SKIP/NOT IN SCOPE atau kosong).')
    elif reasons:
        verdict = 'NO-GO'
    elif conditions:
        verdict = 'CONDITIONAL GO'
    else:
        verdict = 'GO'
        conditions.append('Pastikan exit criteria 03-plan.md terpenuhi sebelum GO final.')
    return dict(verdict=verdict, draft=not reviewed, reasons=reasons, conditions=conditions, counts=counts)


def verdict_summary(v):
    c = v['counts']
    head = (f"{'[DRAFT — belum direview] ' if v['draft'] else ''}{v['verdict']}: {c['passed']} passed, "
            f"{c['passed_low']} low-confidence, {c['partial']} partial, {c['failed_product']} failed (product), "
            f"{c['failed_other']} failed (non-product), {c['blocked']} blocked, {c['skip']} skip.")
    why = ' '.join((v['reasons'] + v['conditions'])[:8])
    return f'{head} {why}' if why else head
