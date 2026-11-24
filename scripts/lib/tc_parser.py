#!/usr/bin/env python3
"""Parser test case Markdown bersama (kontrak .agents/shared/standards/testcase.md), toleran format lama."""
import re

ID_RE = re.compile(r'^#{2,4}\s*([A-Za-z][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)*-\d+[A-Za-z0-9_-]*)\s*[:\-–]\s*(.+?)\s*$')
FIELD_RE = re.compile(r'^\s*[-*]\s*\*\*([^*]+?)\*\*\s*:?\s*(.*)$')
ITEM_RE = re.compile(r'^\s*(?:\d+[.)]|[-*])\s+(.*)$')

KEYMAP = [
    (r'^(test steps|steps?|langkah)', 'steps'), (r'^(expected|ekspektasi|hasil yang diharapkan)', 'expected'),
    (r'^(precondition|prasyarat|pre-?kondisi)', 'precondition'), (r'^(role|actor|aktor)', 'role'),
    (r'^platform', 'platforms'), (r'^layers?', 'layers'), (r'^covers?', 'covers'), (r'^blocked', 'blocked_by'),
    (r'^test data|^data uji', 'test_data'), (r'^capture', 'capture'), (r'^db ?check', 'db_check'),
    (r'^tags', 'tags'), (r'^user story', 'user_story'), (r'^(deskripsi|description)', 'description'),
    (r'^(priority|prioritas)', 'priority'), (r'^(type|tipe)', 'type'), (r'^status', 'status'), (r'^deep ?link', 'deeplink'),
]

def _key(name):
    n = name.strip().lower()
    for rx, k in KEYMAP:
        if re.match(rx, n):
            return k
    return None

def _inline(line, tc):
    # "- **Priority**: P1 | **Type**: Functional | **Status**: Ready" (juga format lama Tipe/Prioritas)
    for part in re.findall(r'\*\*([^*]+?)\*\*\s*:\s*([^|]+)', line):
        k = _key(part[0])
        if k:
            tc[k] = part[1].strip().strip('`')

def parse(text):
    tcs, cur, field = [], None, None
    for raw in text.splitlines():
        m = ID_RE.match(raw)
        if m:
            cur = {'id': m.group(1), 'title': re.sub(r'\s*`\[[^\]]*\]`', '', m.group(2)).strip(), 'steps': [], 'expected': [], 'precondition': []}
            tcs.append(cur); field = None; continue
        if cur is None:
            continue
        if raw.startswith('#'):
            cur, field = None, None; continue
        fm = FIELD_RE.match(raw)
        if fm and not raw.startswith('    '):
            k = _key(fm.group(1)); val = fm.group(2).strip()
            if '|' in raw and raw.count('**') >= 4:
                _inline(raw, cur); field = None; continue
            if k in ('steps', 'expected', 'precondition'):
                field = k
                if val:
                    cur[k].append(val)
            elif k:
                cur[k] = val.strip('`'); field = None
            else:
                field = None
            continue
        im = ITEM_RE.match(raw)
        if field and im:
            cur[field].append(im.group(1).strip())
    return tcs

def priority_word(p):
    p = (p or '').upper()
    return {'P1': 'Critical', 'P2': 'High', 'P3': 'Normal', 'P4': 'Low'}.get(p[:2], p.title() if p else '')
