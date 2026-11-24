#!/usr/bin/env python3
"""
Ekspor 02-testcases.md -> 02-testcases.xlsx (D6): 15 kolom lama TIDAK diubah + 6 kolom baru di kanan.

  python3 scripts/tc_export_xlsx.py work/<ALIAS>/<fitur>/02-testcases.md [--out file.xlsx] [--project <kode>]
  python3 scripts/tc_export_xlsx.py work/<ALIAS>/<fitur>/02-testcases.md --verify   # cek Excel vs Markdown 1-ke-1
Kolom 16-21 (platforms, layers, role, covers, blocked_by, test_data) boleh dihapus untuk tools yang hanya menerima 15 kolom.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lib'))
from tc_parser import parse, priority_word

LEGACY = [('project_id', 12), ('suite_id', 12), ('unique_id', 22), ('title', 45), ('decription', 45), ('precondition', 45),
          ('priority', 15), ('type', 15), ('status', 12), ('tags', 15), ('steps', 10), ('step_desc', 50), ('expected_desc', 50),
          ('is_automated', 14), ('user_story', 45)]
EXTRA = [('platforms', 16), ('layers', 14), ('role', 16), ('covers', 22), ('blocked_by', 16), ('test_data', 30)]
WRAP = {'title', 'decription', 'precondition', 'step_desc', 'expected_desc', 'user_story', 'covers', 'test_data'}

def numbered(items):
    return '\n'.join(f'{i}. {s}' for i, s in enumerate(items, 1))

def rows(tcs, project):
    out = []
    for t in tcs:
        parts = t['id'].split('-')
        out.append({
            'project_id': project, 'suite_id': parts[1] if len(parts) > 1 else '', 'unique_id': t['id'], 'title': t['title'],
            'decription': t.get('description') or t['title'], 'precondition': numbered(t['precondition']),
            'priority': priority_word(t.get('priority')), 'type': t.get('type', ''), 'status': t.get('status', 'Draft'),
            'tags': t.get('tags', ''), 'steps': len(t['steps']), 'step_desc': numbered(t['steps']),
            'expected_desc': numbered(t['expected']), 'is_automated': 'TRUE' if t.get('platforms') else 'FALSE',
            'user_story': t.get('user_story') or t.get('covers', ''),
            'platforms': t.get('platforms', ''), 'layers': t.get('layers', ''), 'role': t.get('role', ''),
            'covers': t.get('covers', ''), 'blocked_by': t.get('blocked_by', ''), 'test_data': t.get('test_data', ''),
        })
    return out

def write(path, data):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
    wb = Workbook(); ws = wb.active; ws.title = 'Test Cases'
    cols = LEGACY + EXTRA; thin = Side(style='thin', color='D3D3D3')
    for c, (name, width) in enumerate(cols, 1):
        cell = ws.cell(row=1, column=c, value=name)
        cell.fill = PatternFill('solid', start_color='1F4E78', end_color='1F4E78')
        cell.font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
        ws.column_dimensions[get_column_letter(c)].width = width
    for r, row in enumerate(data, 2):
        for c, (name, _) in enumerate(cols, 1):
            cell = ws.cell(row=r, column=c, value=row[name])
            cell.alignment = Alignment(vertical='top', wrap_text=name in WRAP)
            cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
    ws.freeze_panes = 'A2'
    wb.save(path)

def verify(md_rows, xlsx):
    from openpyxl import load_workbook
    ws = load_workbook(xlsx, data_only=True)['Test Cases']
    head = [c.value for c in ws[1]]
    expect = [n for n, _ in LEGACY + EXTRA]
    errs = [] if head[:21] == expect else [f'header berbeda: {head}']
    xl = {r[2]: dict(zip(head, r)) for r in ws.iter_rows(min_row=2, values_only=True) if r and r[2]}
    for row in md_rows:
        x = xl.pop(row['unique_id'], None)
        if not x:
            errs.append(f"{row['unique_id']}: tidak ada di Excel"); continue
        for k in ('title', 'priority', 'type', 'steps', 'step_desc', 'expected_desc', 'platforms', 'layers', 'covers'):
            if str(x.get(k) or '') != str(row[k] or ''):
                errs.append(f"{row['unique_id']}: kolom {k} berbeda")
    errs += [f'{k}: hanya ada di Excel (orphan)' for k in xl]
    return errs

def main(argv):
    if not argv or argv[0].startswith('--'):
        print(__doc__); return 1
    md = argv[0]; out = argv[argv.index('--out') + 1] if '--out' in argv else os.path.splitext(md)[0] + '.xlsx'
    project = argv[argv.index('--project') + 1] if '--project' in argv else (os.environ.get('QA_ACTIVE_PROFILE') or 'PROJECT')
    data = rows(parse(open(md, encoding='utf-8').read()), project)
    if not data:
        print('Tidak ada test case terbaca (cek heading "### <ID>: <judul>").'); return 1
    if '--verify' in argv:
        errs = verify(data, out)
        print('VERIFY OK: Excel identik dengan Markdown.' if not errs else 'VERIFY GAGAL:\n  ' + '\n  '.join(errs)); return 1 if errs else 0
    write(out, data)
    print(f'{len(data)} TC diekspor ke {out} (15 kolom lama + 6 kolom baru).'); return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
