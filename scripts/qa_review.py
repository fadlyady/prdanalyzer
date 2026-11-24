#!/usr/bin/env python3
"""Review run (M5, keputusan D7): terapkan koreksi reviewer, hitung ulang verdict, bangkitkan ulang laporan.

Pemakaian:
  python3 scripts/qa_review.py <folder-run> --init          # buat review.json kerangka dari hasil run
  python3 scripts/qa_review.py <folder-run>                 # terapkan review.json -> report_data.json + DOCX baru
  python3 scripts/qa_review.py <folder-run> --check         # tampilkan verdict hasil hitung ulang tanpa menulis

review.json (di folder run):
  {"reviewer": "<nama user yang menjalankan>", "reviewed_at": "<ISO>",
   "corrections": [{"id": "TC-1", "status": "FAILED", "failure_category": "product", "reason": "..."}],
   "decision": null | "GO" | "CONDITIONAL GO" | "NO-GO", "decision_reason": "", "notes": ""}
- Koreksi hanya untuk TC yang statusnya berubah atau failure_category perlu diisi. Status sebelum dicatat otomatis.
- decision = null -> verdict hasil hitung modul. Override wajib decision_reason; keduanya tampil di laporan.
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'lib'))
from verdict import compute_verdict, verdict_summary  # noqa: E402

GEN = os.path.join(ROOT, '.agents', 'skills', 'browser-qa-execution', 'scripts', 'generate_docx_report.py')


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    run = os.path.abspath(sys.argv[1]); rd = os.path.join(run, 'report_data.json'); rv = os.path.join(run, 'review.json')
    if not os.path.isfile(rd):
        sys.exit(f'report_data.json tidak ada di {run}')
    data = load(rd)
    items = [sc for scs in (data.get('roles') or {}).values() for sc in scs]

    if '--init' in sys.argv:
        if os.path.exists(rv):
            sys.exit('review.json sudah ada; edit file itu.')
        need = [{'id': s['id'], 'status': s.get('status'), 'failure_category': s.get('failure_category') or '',
                 'reason': ''} for s in items if str(s.get('status', '')).upper().startswith(('FAILED', 'PASSED (LOW', 'PARTIAL', 'BLOCKED'))]
        json.dump({'reviewer': '', 'reviewed_at': '', 'corrections': need, 'decision': None, 'decision_reason': '', 'notes': ''},
                  open(rv, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
        print(f'review.json dibuat ({len(need)} TC perlu dicek: FAILED/LOW/PARTIAL/BLOCKED). Isi reviewer, cek screenshot, koreksi, lalu jalankan tanpa --init.')
        return

    review = load(rv) if os.path.isfile(rv) else None
    if review is None and '--check' not in sys.argv:
        sys.exit('review.json belum ada. Jalankan dengan --init dulu.')
    if review and not str(review.get('reviewer') or '').strip():
        sys.exit('review.json: isi "reviewer" (user yang menjalankan workflow, D7).')

    applied = []
    byid = {s['id']: s for s in items}
    for c in (review or {}).get('corrections', []):
        s = byid.get(c.get('id'))
        if not s:
            print(f"[WARN] TC {c.get('id')} tidak ada di hasil run — dilewati."); continue
        before = {'status': s.get('status'), 'failure_category': s.get('failure_category')}
        if c.get('status'): s['status'] = c['status']
        if c.get('failure_category'): s['failure_category'] = c['failure_category']
        if str(s.get('status', '')).upper().startswith('FAILED') and not s.get('failure_category'):
            print(f"[WARN] {s['id']} FAILED tanpa failure_category — tetap dianggap product.")
        after = {'status': s.get('status'), 'failure_category': s.get('failure_category')}
        if before != after:
            s['notes'] = (str(s.get('notes') or '-') + f" | Review: {before['status']} -> {after['status']}"
                          + (f" ({after['failure_category']})" if after['failure_category'] else '') + (f": {c.get('reason')}" if c.get('reason') else ''))
            applied.append({'id': s['id'], 'before': before, 'after': after, 'reason': c.get('reason', '')})

    v = compute_verdict(items, data.get('risks'), reviewed=bool(review))
    decision = (review or {}).get('decision')
    if decision and decision != v['verdict'] and not str(review.get('decision_reason') or '').strip():
        sys.exit(f"Override verdict {v['verdict']} -> {decision} wajib diisi decision_reason.")
    print(verdict_summary(v))
    if '--check' in sys.argv:
        return

    data['verdict'] = v
    data['release_recommendation'] = decision or v['verdict']
    data['review_status'] = 'REVIEWED'
    data['reviewer'] = review['reviewer']
    reason = verdict_summary(v)
    if decision and decision != v['verdict']:
        reason = f"Keputusan reviewer: {decision} (hasil hitung: {v['verdict']}). Alasan: {review['decision_reason']}. " + reason
    data['recommendation_reason'] = reason
    data['qa_lead'] = f"{review['reviewer']} (reviewer)"
    review['reviewed_at'] = review.get('reviewed_at') or datetime.now(timezone.utc).isoformat()
    review['applied'] = applied
    review['computed_verdict'] = v['verdict']
    json.dump(review, open(rv, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    json.dump(data, open(rd, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

    # laporan baru di reports/ fitur (bila run berada di work/<ALIAS>/<fitur>/runs/), selain itu di folder run
    parent = os.path.dirname(run)
    rep_dir = os.path.join(os.path.dirname(parent), 'reports') if os.path.basename(parent) == 'runs' else run
    os.makedirs(rep_dir, exist_ok=True)
    out = os.path.join(rep_dir, f"Report_{os.path.basename(run)}_REVIEWED.docx")
    subprocess.run([sys.executable, GEN, rd, out], check=True, stdout=subprocess.DEVNULL)
    print(f'{len(applied)} koreksi diterapkan. Laporan: {os.path.relpath(out, ROOT)}')

    # perbarui runs/index.json bila ada
    try:
        node = ("const Q=require(process.argv[1]);const L=Q.resolveRunLocation(process.argv[2],process.argv[3],process.argv[4],process.argv[4]);"
                "Q.registerRun(process.argv[2],L,JSON.parse(process.argv[5]));")
        if os.path.basename(parent) == 'runs':
            feature = os.path.basename(os.path.dirname(parent))
            entry = {'run_id': os.path.basename(run), 'review_status': 'REVIEWED', 'reviewer': review['reviewer'],
                     'verdict': data['release_recommendation'], 'report_reviewed': os.path.relpath(out, ROOT)}
            subprocess.run(['node', '-e', node, os.path.join(HERE, 'lib', 'qa-env.cjs'), ROOT, feature, run, json.dumps(entry)],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:  # noqa: BLE001
        print(f'[WARN] runs/index.json belum diperbarui: {e}')


if __name__ == '__main__':
    main()
