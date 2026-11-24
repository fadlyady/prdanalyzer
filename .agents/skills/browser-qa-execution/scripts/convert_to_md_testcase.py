#!/usr/bin/env python3
"""Konversi Test Case Excel (.xlsx) -> Markdown standar (.agents/shared/standards/testcase.md), TANPA kehilangan data.

- Kolom dibaca lewat header: 15 kolom lama (D6) + 6 kolom baru di kanan (platforms, layers, role, covers, blocked_by,
  test_data) + variasi umum (Test Steps, Expected Result, Prioritas, Role/Aktor, Target URL, ...).
- Tidak mengarang isi: precondition/steps/expected/prioritas yang kosong TIDAK diisi teks generik. TC yang kurang
  field wajib tetap ditulis dengan penanda [PERLU DILENGKAPI] dan dilaporkan — tidak dibuang diam-diam.
- Kolom yang tidak dikenali disimpan di field "Catatan Excel" agar tidak hilang.
- Setelah menulis, hasil diverifikasi ulang (jumlah TC & ID sama dengan baris Excel).

  python3 convert_to_md_testcase.py <file.xlsx> [output.md] [--sheet <nama>]
"""
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'scripts', 'lib')))
from tc_parser import parse as parse_md  # noqa: E402

COLS = {  # kunci kanonik -> nama header yang diterima (huruf kecil, spasi dinormalkan)
    'id': ['unique_id', 'id', 'tc id', 'test case id', 'testcase id', 'no tc'],
    'title': ['title', 'judul', 'test case', 'scenario', 'skenario', 'test case title'],
    'description': ['decription', 'description', 'deskripsi'],
    'precondition': ['precondition', 'pre-condition', 'prasyarat', 'pre kondisi'],
    'priority': ['priority', 'prioritas', 'test priority'],
    'type': ['type', 'tipe', 'test type'],
    'status': ['status'],
    'tags': ['tags', 'tag'],
    'steps': ['step_desc', 'test steps', 'steps', 'langkah', 'langkah-langkah'],
    'expected': ['expected_desc', 'expected result', 'expected results', 'expected', 'ekspektasi', 'expected result (ui)', 'hasil yang diharapkan'],
    'automated': ['is_automated', 'automated'],
    'user_story': ['user_story', 'user story'],
    'platforms': ['platforms', 'platform'],
    'layers': ['layers', 'layer'],
    'role': ['role', 'aktor', 'actor', 'user role'],
    'covers': ['covers', 'covers (ac/risk)'],
    'blocked_by': ['blocked_by', 'blocked by'],
    'test_data': ['test_data', 'test data', 'data uji'],
    'target_url': ['target_url', 'target url', 'url', 'path'],
    'deeplink': ['deeplink', 'deep link'],
}
IGNORE = {'project_id', 'suite_id', 'steps_count', 'no', 'no.'}
WORD_TO_P = {'critical': 'P1', 'high': 'P2', 'normal': 'P3', 'medium': 'P3', 'low': 'P4'}


def norm(h):
    return re.sub(r'\s+', ' ', str(h or '').strip().lower())


def items(text):
    """Pecah sel multi-baris bernomor/berbutir menjadi daftar, tanpa mengubah isi."""
    text = str(text or '').strip()
    if not text:
        return []
    parts = re.split(r'(?:^|\n)\s*(?:\d+[.)]|[-*•])\s+', text)
    out = [p.strip().replace('\n', ' ') for p in parts if p.strip()]
    return out if out else [text]


def read_rows(path, sheet=None):
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet] if sheet else wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], {}, []
    hdr_idx = next((i for i, r in enumerate(rows[:10]) if any(norm(c) in sum(COLS.values(), []) for c in r)), 0)
    header = [norm(c) for c in rows[hdr_idx]]
    mapping = {}
    for key, names in COLS.items():  # pilih kolom sesuai urutan prioritas nama (mis. step_desc sebelum steps)
        for n in names:
            if n in header:
                mapping[key] = header.index(n)
                break
    used_cols = set(mapping.values())
    if 'step_desc' in header and 'steps' in header:
        used_cols.add(header.index('steps'))  # kolom 'steps' format lama = jumlah langkah, bukan isi
    unknown = [(ci, h) for ci, h in enumerate(header) if h and ci not in used_cols and h not in IGNORE]
    data = []
    for r in rows[hdr_idx + 1:]:
        if not any(c not in (None, '') for c in r):
            continue
        rec = {k: (r[ci] if ci < len(r) and r[ci] is not None else '') for k, ci in mapping.items()}
        rec['_extra'] = {h: r[ci] for ci, h in unknown if ci < len(r) and r[ci] not in (None, '')}
        data.append(rec)
    return data, mapping, [h for _, h in unknown]


def priority_code(v):
    s = str(v or '').strip()
    m = re.search(r'P\s*([1-4])', s, re.I)
    if m:
        return f'P{m.group(1)}'
    return WORD_TO_P.get(s.lower(), s)


def to_markdown(rows, source_name):
    lines = [f'# Test Case Suite — dikonversi dari `{source_name}`', '',
             'Dikonversi otomatis tanpa menambah isi. Field yang kosong di Excel tidak diisi; TC bertanda **[PERLU DILENGKAPI]** wajib dilengkapi sebelum dieksekusi.', '', '---', '']
    incomplete, used = [], set()
    for i, r in enumerate(rows, 1):
        tc_id = str(r.get('id') or '').strip() or f'TC-IMPORT-{i:03d}'
        if tc_id in used:
            tc_id = f'{tc_id}-DUP{i}'
        used.add(tc_id)
        title = str(r.get('title') or '').strip()
        steps, expected, pre = items(r.get('steps')), items(r.get('expected')), items(r.get('precondition'))
        missing = [n for n, v in (('title', title), ('steps', steps), ('expected', expected)) if not v]
        if not str(r.get('id') or '').strip():
            missing.append('id (dibuat otomatis)')
        if missing:
            incomplete.append((tc_id, missing))
        lines.append(f"### {tc_id}: {title or '(judul kosong)'}" + (' `[PERLU DILENGKAPI]`' if missing else ''))
        if r.get('covers'):
            lines.append(f"- **Covers**: {r['covers']}")
        inline = [f"**Priority**: {priority_code(r.get('priority'))}" if r.get('priority') else '**Priority**: (belum diisi)']
        if r.get('type'):
            inline.append(f"**Type**: {r['type']}")
        if r.get('status'):
            inline.append(f"**Status**: {r['status']}")
        lines.append('- ' + ' | '.join(inline))
        for key, label in (('platforms', 'Platforms'), ('layers', 'Layers')):
            if r.get(key):
                lines.append(f'- **{label}**: {r[key]}')
        if r.get('role'):
            role = str(r['role']).strip()
            lines.append(f"- **Role**: {role if role.startswith('{{') else '{{role:' + role + '}}'}")
        for key, label in (('blocked_by', 'Blocked by'), ('test_data', 'Test data'), ('target_url', 'Target URL'),
                           ('deeplink', 'Deeplink'), ('tags', 'Tags'), ('user_story', 'User Story'), ('description', 'Description')):
            if r.get(key):
                lines.append(f"- **{label}**: {str(r[key]).strip()}")
        if r.get('automated') not in ('', None):
            lines.append(f"- **Automated**: {r['automated']}")
        if pre:
            lines.append('- **Precondition**:')
            lines += [f'  {n}. {s}' for n, s in enumerate(pre, 1)]
        lines.append('- **Steps**:')
        lines += [f'  {n}. {s}' for n, s in enumerate(steps, 1)] or ['  1. [PERLU DILENGKAPI] langkah belum ada di Excel']
        lines.append('- **Expected Results**:')
        lines += [f'  - {s}' for s in expected] or ['  - [PERLU DILENGKAPI] expected belum ada di Excel']
        if r.get('_extra'):
            lines.append('- **Catatan Excel**: ' + '; '.join(f'{k}={v}' for k, v in r['_extra'].items()))
        lines.append('')
    return '\n'.join(lines) + '\n', incomplete


def convert_to_markdown(source_file, output_md_path=None, sheet=None):
    if not os.path.exists(source_file):
        raise FileNotFoundError(f'Source file not found: {source_file}')
    rows, mapping, unknown = read_rows(source_file, sheet)
    if not rows:
        raise ValueError('Tidak ada baris test case di Excel.')
    if not output_md_path:
        output_md_path = os.path.join(os.path.dirname(os.path.abspath(source_file)), '02-testcases.md')
        if os.path.exists(output_md_path):
            output_md_path = os.path.splitext(os.path.abspath(source_file))[0] + '.md'
    md, incomplete = to_markdown(rows, os.path.basename(source_file))
    os.makedirs(os.path.dirname(os.path.abspath(output_md_path)), exist_ok=True)
    with open(output_md_path, 'w', encoding='utf-8') as f:
        f.write(md)
    # verifikasi 1-ke-1
    back = parse_md(md)
    ok = len(back) == len(rows)
    print(f"[{'SUCCESS' if ok else 'WARNING'}] {len(rows)} baris Excel -> {len(back)} TC Markdown: {output_md_path}")
    print(f"  Kolom terbaca: {', '.join(sorted(mapping))}")
    if unknown:
        print(f"  Kolom lain disimpan di 'Catatan Excel': {', '.join(unknown)}")
    for tc_id, miss in incomplete:
        print(f"  [PERLU DILENGKAPI] {tc_id}: {', '.join(miss)}")
    if not ok:
        sys.exit(2)
    return output_md_path


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__)
        sys.exit(1)
    sh = sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None
    if sh in args:
        args.remove(sh)
    convert_to_markdown(args[0], args[1] if len(args) > 1 else None, sh)
