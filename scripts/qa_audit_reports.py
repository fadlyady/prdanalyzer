#!/usr/bin/env python3
"""Audit laporan/run lama terhadap cacat yang sudah diperbaiki di P0 (tanpa mengubah evidence asli).

Deteksi:
  charter_hardcoded  report_data.json memuat teks charter PASS bawaan runner lama (charter tidak pernah dijalankan)
  charter_default    DOCX memuat isi charter default generator lama (5 PASS) — umumnya karena data charter kosong
  verdict_mismatch   verdict tertulis berbeda dengan hitung ulang modul tunggal scripts/lib/verdict.py
                     (FAILED tanpa failure_category dianggap product; prioritas kosong dianggap P1)

Hasil: work/<ALIAS>/_audit/report-audit-<tanggal>.json & .md (lokal, tidak di-commit) dan penanda "audit" pada entri
runs/index.json fitur terkait. Laporan lama tidak diubah; buat ulang lewat review (scripts/qa_review.py).

Pemakaian: python3 scripts/qa_audit_reports.py [--no-index]
"""
import glob
import json
import os
import re
import subprocess
import sys
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'lib'))
from verdict import compute_verdict  # noqa: E402

HARDCODED = [  # runner browser lama (universal_executor) — selalu PASS
    'Debounce UI menahan submit ganda tanpa race condition',
    'Sanitasi berjalan aman tanpa layout overflow atau script execution',
    'Aplikasi memuat ulang halaman secara konsisten tanpa React hydration crash',
    'Modal tertutup seketika dan fokus kembali ke halaman dengan mulus',
    'Tabel memulihkan daftar data default secara lengkap',
]
DOCX_DEFAULT = [  # generate_docx_report lama — diisi bila exploratory_scenarios kosong
    'Tombol berhasil ter-disable saat request berlangsung, mencegah duplikasi submit',
    'Input dipotong rapi sesuai max-length tanpa merusak layout',
    'Aplikasi kembali ke state aman tanpa error React hydration',
    'Modal tertutup dengan mulus tanpa memicu aksi form submit',
    'Session tetap valid dan data sinkron dengan benar',
]
RUN_ROOTS = ['browser-execution/automate-result', 'mobile-execution/automate-result', 'work/*/*/runs']
REPORT_ROOTS = ['browser-execution/automate-result', 'mobile-execution/automate-result', 'work/*/*/reports', 'work/*/*/runs/*']


def rel(p):
    return os.path.relpath(p, ROOT)


def docx_text(p):
    try:
        import docx  # python-docx
        d = docx.Document(p)
        parts = [x.text for x in d.paragraphs]
        for t in d.tables:
            for r in t.rows:
                parts.extend(c.text for c in r.cells)
        return '\n'.join(parts)
    except Exception as e:  # noqa: BLE001
        return f'__ERROR__ {e}'


def audit_run(run):
    f = os.path.join(run, 'report_data.json')
    try:
        data = json.load(open(f, encoding='utf-8'))
    except Exception as e:  # noqa: BLE001
        return {'run': rel(run), 'error': f'report_data.json tidak terbaca: {e}', 'issues': []}
    issues = []
    ex = data.get('exploratory_scenarios') or []
    txt = ' '.join(str(c.get('observed', '')) for c in ex)
    hits = [h for h in HARDCODED if h in txt]
    if hits:
        issues.append({'type': 'charter_hardcoded', 'detail': f'{len(hits)} charter PASS bawaan runner lama (tidak pernah dijalankan)'})
    items = [sc for scs in (data.get('roles') or {}).values() for sc in scs]
    stated = data.get('release_recommendation')
    if items and stated:
        v = compute_verdict(items, None, reviewed=False)
        only_prio = all('prioritas tidak tercatat' in x for x in v['reasons'] + v['conditions'])
        if v['verdict'] != stated and only_prio:
            info = {'type': 'priority_missing', 'detail': f"verdict tertulis {stated}; tidak bisa diverifikasi karena prioritas TC tidak tercatat (dianggap P1 → {v['verdict']})"}
            return {'run': rel(run), 'feature': data.get('feature_name'), 'stated_verdict': stated, 'charters': len(ex),
                    'reviewed': os.path.isfile(os.path.join(run, 'review.json')), 'issues': issues, 'info': [info]}
        if v['verdict'] != stated:
            issues.append({'type': 'verdict_mismatch', 'detail': f"tertulis {stated}, hitung ulang {v['verdict']}",
                           'stated': stated, 'recomputed': v['verdict'], 'reasons': (v['reasons'] + v['conditions'])[:5]})
    return {'run': rel(run), 'feature': data.get('feature_name'), 'stated_verdict': stated, 'charters': len(ex),
            'reviewed': os.path.isfile(os.path.join(run, 'review.json')), 'issues': issues}


def main():
    runs = sorted({os.path.dirname(p) for r in RUN_ROOTS for p in glob.glob(os.path.join(ROOT, r, 'run_*', 'report_data.json'))})
    run_res = [audit_run(r) for r in runs]
    reports = sorted({p for r in REPORT_ROOTS for p in glob.glob(os.path.join(ROOT, r, '*.docx'))})
    rep_res = []
    for p in reports:
        t = docx_text(p)
        hits = [h for h in DOCX_DEFAULT if h in t] + [h for h in HARDCODED if h in t]
        m = re.search(r'RELEASE VERDICT[^\[]*\[([A-Z \-]+)\]', t)
        iss = []
        if t.startswith('__ERROR__'):
            iss.append({'type': 'unreadable', 'detail': t})
        elif hits:
            iss.append({'type': 'charter_default', 'detail': f'{len(hits)} teks charter PASS bawaan (bukan hasil nyata)'})
        rep_res.append({'report': rel(p), 'verdict_in_doc': m.group(1).strip() if m else None, 'reviewed_name': '_REVIEWED' in p, 'issues': iss})

    try:
        alias = json.loads(subprocess.run([sys.executable, os.path.join(HERE, 'qa_feature.py'), 'where'], capture_output=True, text=True).stdout)['alias']
    except Exception:  # noqa: BLE001
        alias = 'UNKNOWN'
    out_dir = os.path.join(ROOT, 'work', alias, '_audit')
    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d')
    summary = {
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'runs_checked': len(run_res), 'runs_flagged': sum(1 for r in run_res if r['issues']),
        'reports_checked': len(rep_res), 'reports_flagged': sum(1 for r in rep_res if r['issues']),
        'by_type': {},
    }
    for r in run_res + rep_res:
        for i in r['issues']:
            summary['by_type'][i['type']] = summary['by_type'].get(i['type'], 0) + 1
    json.dump({'summary': summary, 'runs': run_res, 'reports': rep_res}, open(os.path.join(out_dir, f'report-audit-{stamp}.json'), 'w'), indent=2, ensure_ascii=False)

    lines = [f'# Audit laporan lama ({summary["generated_at"]})', '',
             'Laporan/run di bawah dibuat sebelum perbaikan P0 dan memuat cacat yang sudah diketahui. Evidence asli tidak diubah.',
             'Jangan dipakai sebagai dasar keputusan rilis sebelum di-review ulang (`python3 scripts/qa_review.py <folder-run> --init`).', '',
             f"Run diperiksa {summary['runs_checked']}, ditandai {summary['runs_flagged']} · Laporan DOCX diperiksa {summary['reports_checked']}, ditandai {summary['reports_flagged']} · Per jenis: {summary['by_type']}", '',
             '## Run', '', '| Run | Verdict tertulis | Temuan |', '| --- | --- | --- |']
    for r in run_res:
        if r['issues']:
            lines.append(f"| `{r['run']}` | {r.get('stated_verdict') or '-'} | " + '; '.join(f"{i['type']}: {i['detail']}" for i in r['issues']) + ' |')
    info = [r for r in run_res if r.get('info')]
    if info:
        lines += ['', '## Info (bukan cacat)', '']
        lines += [f"- `{r['run']}`: {r['info'][0]['detail']}" for r in info]
    lines += ['', '## Laporan DOCX', '', '| Laporan | Verdict di dokumen | Temuan |', '| --- | --- | --- |']
    for r in rep_res:
        if r['issues']:
            lines.append(f"| `{r['report']}` | {r.get('verdict_in_doc') or '-'} | " + '; '.join(f"{i['type']}: {i['detail']}" for i in r['issues']) + ' |')
    open(os.path.join(out_dir, f'report-audit-{stamp}.md'), 'w').write('\n'.join(lines) + '\n')

    flagged_idx = 0
    if '--no-index' not in sys.argv:
        flagged = {r['run']: r['issues'] for r in run_res if r['issues']}
        rep_flag = {r['report']: r['issues'] for r in rep_res if r['issues']}
        for idx in glob.glob(os.path.join(ROOT, 'work', '*', '*', 'runs', 'index.json')):
            d = json.load(open(idx, encoding='utf-8'))
            changed = False
            for e in d.get('runs', []):
                p = e.get('path') or ''
                iss = flagged.get(p.rstrip('/'))
                ts = '_'.join(os.path.basename(p).split('_')[-2:]) if p else ''
                rp = [k for k in rep_flag if re.search(r'\d{8}_\d{6}$', ts) and ts in k]
                if iss or rp:
                    e['audit'] = {'tainted': True, 'checked_at': summary['generated_at'],
                                  'issues': [i['type'] for i in (iss or [])] + (['charter_default_docx'] if rp else []),
                                  'note': 'Dibuat sebelum perbaikan P0; review ulang sebelum dipakai.'}
                    changed = True
                    flagged_idx += 1
            if changed:
                json.dump(d, open(idx, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    print(json.dumps(summary, ensure_ascii=False))
    print(f'Entri runs/index.json ditandai: {flagged_idx}')
    print(f'Hasil: {rel(os.path.join(out_dir, "report-audit-" + stamp + ".md"))}')


if __name__ == '__main__':
    main()
