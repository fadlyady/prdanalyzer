#!/usr/bin/env python3
"""
Mobile Test Case Parser (Markdown) — skill mobile-qa-execution (Gate 1).

Format yang didukung (output generate-testcase):
  ### <TC-ID>: <judul>
  - **Tipe**: Functional | **Prioritas**: Critical | **Status**: Ready
  - **Tags**: `Smoke, Mobile, Android, iOS`
  - **Role**: Owner                      (opsional; fallback "login sebagai X" di precondition/steps)
  - **Platform**: Android                (opsional; fallback dari Tags)
  - **Deeplink**: https://...            (opsional, hanya route yang dikonfirmasi dev)
  - **Data Setup (API/DB)**: ...         (opsional, informasi saja — tidak dieksekusi)
  - **Precondition**: 1. ... 2. ...
  - **Test Steps**: 1. ... 2. ... (tambahkan [MUTATION] pada langkah create/edit/delete/kirim)
  - **Expected Results (apa pun)**: 1. [UI] ... 2. [Network] ... 3. [DB/Persistence] ...

Usage: python3 parse_mobile_testcase.py <file.md> [--platform android|ios]
Output: JSON (contract_status, testcases, invalid_testcases, skipped_platform, lint)
"""
import sys, re, json

ID_RE = re.compile(r'^#{2,4}\s*(?:Test Case\s*:?\s*)?([A-Za-z][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*-\d+[A-Za-z0-9_-]*)\s*[:\-–]\s*(.+)$')
FIELD_RE = re.compile(r'^\s*[-*]\s*\*\*([^*]+?)\*\*\s*:?\s*(.*)$')
ITEM_RE = re.compile(r'^\s*(?:\d+[.)]|[-*])\s+(.*)$')
MUT_KW = re.compile(r'\b(hapus|delete|buat|create|tambah|add|edit|ubah|update|simpan|save|kirim|send|submit|bayar|checkout|aktifkan|nonaktifkan|assign|alihkan|handover|takeover|tutup percakapan|broadcast)\b', re.I)
LAYER_RE = re.compile(r'^\[([^\]]+)\]\s*(.*)$')

def field_key(name):
    n = name.strip().lower()
    if re.match(r'^(test steps|steps?|langkah)', n): return 'steps'
    if re.match(r'^(expected|ekspektasi|hasil yang diharapkan)', n): return 'expected'
    if re.match(r'^(precondition|prasyarat|pre-?kondisi)', n): return 'precondition'
    if re.match(r'^(role|actor|aktor)', n): return 'role'
    if n.startswith('platform'): return 'platform'
    if re.match(r'^deep ?link', n): return 'deeplink'
    if n.startswith('data setup'): return 'data_setup'
    if n.startswith('tags'): return 'tags'
    if n.startswith('tipe') or n.startswith('type'): return 'inline'
    if n.startswith('user story'): return 'user_story'
    if n.startswith('deskripsi') or n.startswith('description'): return 'description'
    if n.startswith('automated'): return 'automated'
    return None

def parse_inline(text, tc):
    for part in text.split('|'):
        m = re.match(r'\s*\**([^:*]+?)\**\s*:\s*(.+)', part.replace('**', ''))
        if m:
            k, v = m.group(1).strip().lower(), m.group(2).strip()
            if k in ('prioritas', 'priority'): tc['priority'] = v
            elif k in ('tipe', 'type'): tc['type'] = v
            elif k == 'status': tc['status'] = v

def derive_role(texts):
    for t in texts:
        m = re.search(r'\b(?:log\s?in|masuk)\s+sebagai\s+([A-Za-z][\w /-]*?)(?=\s+(?:pada|di|dan|yang|untuk|dengan)\b|[,.;(]|$)', t, re.I) or \
            re.search(r'\blog(?:ged)?\s*in\s+as\s+([A-Za-z][\w /-]*?)(?=\s+(?:on|in|and)\b|[,.;(]|$)', t, re.I)
        if m: return m.group(1).strip()
    return ''

def parse(md_path, platform=None):
    lines = open(md_path, encoding='utf-8').read().split('\n')
    tcs, cur, key = [], None, None
    def close():
        if cur: tcs.append(cur)
    for raw in lines:
        h = ID_RE.match(raw.strip())
        if h:
            close(); cur = {'id': h.group(1), 'title': re.sub(r'\s*`[^`]*`', '', h.group(2)).strip(), 'tags_title': re.findall(r'`\[([^\]]+)\]`', h.group(2)),
                           'steps': [], 'expected_raw': [], 'precondition': [], 'role': '', 'platform_raw': '', 'deeplink': '', 'data_setup': '', 'tags': '', 'priority': 'P1'}
            key = None; continue
        if cur is None: continue
        if re.match(r'^#{1,3}\s', raw) or raw.strip() == '---':
            if re.match(r'^#{1,3}\s', raw): close(); cur = None
            key = None; continue
        f = FIELD_RE.match(raw)
        if f and field_key(f.group(1)):
            key = field_key(f.group(1)); val = f.group(2).strip()
            if key == 'inline': parse_inline(f.group(1) + ': ' + val, cur); key = None
            elif key in ('steps', 'expected', 'precondition'):
                if val: cur[{'steps': 'steps', 'expected': 'expected_raw', 'precondition': 'precondition'}[key]].append(val)
            elif key in ('role', 'deeplink', 'data_setup', 'tags', 'user_story', 'description', 'automated'):
                cur[key if key != 'platform' else 'platform_raw'] = val.strip('` '); key = key if key == 'data_setup' else None
            elif key == 'platform': cur['platform_raw'] = val; key = None
            continue
        it = ITEM_RE.match(raw)
        if it and key in ('steps', 'expected', 'precondition'):
            cur[{'steps': 'steps', 'expected': 'expected_raw', 'precondition': 'precondition'}[key]].append(it.group(1).strip())
        elif it and key == 'data_setup':
            cur['data_setup'] = (cur['data_setup'] + ' ' + it.group(1)).strip()
    close()

    valid, invalid, skipped = [], [], []
    for i, tc in enumerate(tcs, 1):
        layers = {'ui': [], 'network': [], 'db': [], 'other': []}
        for e in tc.pop('expected_raw'):
            m = LAYER_RE.match(e); tag = (m.group(1).lower() if m else 'ui'); text = m.group(2) if m else e
            lay = 'ui' if tag.startswith('ui') else 'network' if re.search(r'network|api|payload|contract', tag) else 'db' if re.search(r'db|persist|database|cache', tag) else 'other'
            layers[lay].append(text.strip())
        tc['expected'] = layers
        ptxt = (tc.pop('platform_raw') or tc['tags']).lower()
        plats = [p for p in ('android', 'ios') if p in ptxt] or ['android', 'ios']
        tc['platforms'] = plats
        if not tc['role']: tc['role'] = derive_role(tc['precondition'] + tc['steps'])
        tc['mutation_steps'] = [n for n, s in enumerate(tc['steps'], 1) if '[MUTATION]' in s.upper()]
        tc['suspected_mutation_steps'] = [n for n, s in enumerate(tc['steps'], 1) if n not in tc['mutation_steps'] and MUT_KW.search(s)]
        tc['needs_manual_data'] = bool(tc['precondition'])
        errs = []
        if not tc['title']: errs.append("Field 'title' kosong.")
        if not tc['steps']: errs.append("Field 'Test Steps' kosong.")
        if not any(layers.values()): errs.append("Field 'Expected Results' kosong.")
        if errs: invalid.append({'index': i, 'id': tc['id'], 'title': tc['title'], 'reasons': errs}); continue
        if platform and platform.lower() not in plats:
            skipped.append({'id': tc['id'], 'title': tc['title'], 'status': 'SKIP WITH REASON', 'reason': f"Test case khusus {', '.join(plats)}; run ini platform {platform}."}); continue
        valid.append(tc)

    lint = {
        'no_role': [t['id'] for t in valid if not t['role']],
        'ui_assertion_missing': [t['id'] for t in valid if not t['expected']['ui']],
        'has_network_or_db_layer': [t['id'] for t in valid if t['expected']['network'] or t['expected']['db']],
        'suspected_mutation_without_marker': [t['id'] for t in valid if t['suspected_mutation_steps']],
        'needs_manual_data': [t['id'] for t in valid if t['needs_manual_data']],
        'with_deeplink': [t['id'] for t in valid if t['deeplink']],
    }
    return {
        'source_type': 'markdown', 'file_path': md_path, 'platform_filter': platform,
        'contract_status': 'PASSED' if not invalid else ('PARTIAL' if valid else 'FAILED'),
        'total_testcases': len(tcs), 'valid_count': len(valid), 'invalid_count': len(invalid), 'skipped_platform_count': len(skipped),
        'testcases': valid, 'invalid_testcases': invalid, 'skipped_platform': skipped, 'lint': lint,
    }

if __name__ == '__main__':
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    plat = sys.argv[sys.argv.index('--platform') + 1] if '--platform' in sys.argv else None
    print(json.dumps(parse(sys.argv[1], plat), indent=2, ensure_ascii=False))
