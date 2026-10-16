#!/usr/bin/env python3
"""
Universal Test Case Parser (Markdown & Excel)
For browser-qa-execution skill.
Prioritizes Markdown (.md) for lightweight, token-efficient parsing,
while fully supporting Excel (.xlsx) via openpyxl.
Outputs normalized JSON format.
"""

import sys
import os
import re
import json

def parse_markdown(md_path):
    """Parse a Markdown test case file into normalized JSON."""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    testcases = []
    
    # 1. Try regex pattern matching structured testcase blocks (e.g. ### TC-...)
    pattern = re.compile(
        r'(?:^|\n)#{2,4}\s*(?:Test Case\s*:?\s*)?([A-Za-z0-9_-]+)\s*[:\-–]?\s*([^\n]+)([\s\S]*?)(?=(?:\n#{2,4}\s*(?:Test Case|\b[A-Za-z0-9_-]+[:\-–])|\Z))',
        re.MULTILINE
    )
    matches = pattern.findall(content)

    if matches:
        for match in matches:
            tc_id = match[0].strip()
            title = match[1].strip()
            body = match[2].strip()

            # Extract role
            role_match = re.search(r'\*{0,2}(?:Role|Actor|Aktor)\*{0,2}\s*[:\-]\s*([^\n]+)', body, re.IGNORECASE)
            if role_match:
                role = role_match.group(1).replace('*', '').strip()
            else:
                title_role = re.search(r'\b(?:sebagai|as)\s+([A-Za-z0-9_-]+)', title, re.IGNORECASE)
                role = title_role.group(1).strip() if title_role else "owner"

            # Extract steps
            steps_match = re.search(r'\*{0,2}(?:Steps?|Langkah(?:-langkah)?)\*{0,2}\s*[:\-]\s*([\s\S]*?)(?=(?:\n\s*[-*]?\s*\*{0,2}(?:Expected(?:\s+Results?)?|Hasil|Data|Precondition)\*{0,2}\s*[:\-]|\Z))', body, re.IGNORECASE)
            steps_raw = steps_match.group(1).strip() if steps_match else body

            # Extract expected result
            expected_match = re.search(r'\*{0,2}(?:Expected Result|Expected|Ekspektasi|Hasil yang Diharapkan)\*{0,2}\s*[:\-]\s*([\s\S]*?)(?=(?:\n\s*[-*]\s*\*{0,2}(?:Data|Notes|Catatan|Precondition|Steps?)\*{0,2}\s*[:\-]|\Z))', body, re.IGNORECASE)
            expected = expected_match.group(1).strip() if expected_match else ""

            # Extract priority
            prio_match = re.search(r'\*{0,2}(?:Priority|Prioritas)\*{0,2}\s*[:\-]\s*([^\n]+)', body, re.IGNORECASE)
            priority = prio_match.group(1).replace('*', '').strip() if prio_match else "P1"

            # Split numbered/bullet steps accurately even with indentation or leading spaces
            raw_splits = re.split(r'(?:^|\n)\s*(?:\d+[\.\)]|[-*])\s*', steps_raw)
            clean_steps = [s.strip() for s in raw_splits if s.strip()]

            testcases.append({
                "id": tc_id,
                "title": title,
                "role": role,
                "priority": priority,
                "steps": clean_steps,
                "expected": expected
            })

    # 2. If no ### blocks, check for markdown tables (| ID | Title | Role | ...)
    if not testcases:
        lines = content.split('\n')
        table_lines = [l for l in lines if l.strip().startswith('|') and l.strip().endswith('|')]
        if len(table_lines) >= 3:
            header_cols = [c.strip().lower() for c in table_lines[0].split('|')[1:-1]]
            for row_line in table_lines[2:]:
                cols = [c.strip() for c in row_line.split('|')[1:-1]]
                if len(cols) == len(header_cols):
                    row_dict = dict(zip(header_cols, cols))
                    tc_id = row_dict.get('id') or row_dict.get('test id') or row_dict.get('testcase id') or row_dict.get('tc id') or f"TC-{len(testcases)+1:03d}"
                    title = row_dict.get('title') or row_dict.get('test title') or row_dict.get('scenario') or row_dict.get('nama skenario') or "-"
                    role = row_dict.get('role') or row_dict.get('actor') or "owner"
                    steps = row_dict.get('steps') or row_dict.get('test steps') or row_dict.get('langkah') or ""
                    expected = row_dict.get('expected result') or row_dict.get('expected') or row_dict.get('hasil') or ""
                    testcases.append({
                        "id": tc_id,
                        "title": title,
                        "role": role,
                        "priority": "P1",
                        "steps": [s.strip() for s in re.split(r'\n|;\s*', steps) if s.strip()],
                        "expected": expected
                    })

    return {
        "source_type": "markdown",
        "file_path": md_path,
        "total_testcases": len(testcases),
        "testcases": testcases
    }

def parse_excel(xlsx_path):
    """Parse an Excel (.xlsx) testcase file using openpyxl."""
    import openpyxl
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"source_type": "excel", "file_path": xlsx_path, "total_testcases": 0, "testcases": []}

    # Find header row
    header_idx = 0
    headers = []
    for idx, r in enumerate(rows[:5]):
        str_row = [str(c).lower().strip() for c in r if c is not None]
        if any("id" in c or "title" in c or "test" in c for c in str_row):
            header_idx = idx
            headers = [str(c).lower().strip() if c is not None else f"col_{i}" for i, c in enumerate(r)]
            break

    testcases = []
    for r in rows[header_idx + 1:]:
        if not any(r):
            continue
        row_dict = {}
        for h, val in zip(headers, r):
            row_dict[h] = str(val).strip() if val is not None else ""

        # Map typical column names
        tc_id = (
            row_dict.get("unique_id") or row_dict.get("test case id") or row_dict.get("test id") or
            row_dict.get("id") or f"TC-{len(testcases)+1:03d}"
        )
        title = (
            row_dict.get("title") or row_dict.get("test title / summary") or row_dict.get("test title") or
            row_dict.get("scenario") or row_dict.get("decription") or "-"
        )
        # Determine role from role column or title or precondition
        role_raw = row_dict.get("role / actor") or row_dict.get("role") or row_dict.get("actor") or ""
        if not role_raw:
            title_role = re.search(r'\b(?:sebagai|as)\s+([A-Za-z0-9_-]+)', title, re.IGNORECASE)
            role = title_role.group(1).strip() if title_role else "owner"
        else:
            role = role_raw

        step_desc = row_dict.get("step_desc") or row_dict.get("test steps") or row_dict.get("steps") or ""
        precond = row_dict.get("precondition") or ""

        # Check if precondition contains actual numbered action steps (e.g. Tekan, Klik, Akses, Pilih)
        action_in_precond = re.findall(r'(?:\d+[\.\)]\s*)(?:Akses|Tekan|Klik|Pilih|Input|Masukkan|Checklist|Centang)[^\n]+', precond, re.IGNORECASE)
        
        if action_in_precond and (len(step_desc.strip()) < 35 or not re.search(r'klik|tekan|akses|pilih|input', step_desc, re.IGNORECASE)):
            # Smart-merge: Precondition has the actual action steps!
            steps_raw = "\n".join(action_in_precond)
        else:
            steps_raw = step_desc if step_desc.strip() else precond

        expected = row_dict.get("expected_desc") or row_dict.get("expected result (ui)") or row_dict.get("expected result") or row_dict.get("expected") or ""
        priority = row_dict.get("test priority") or row_dict.get("priority") or "P1"

        raw_splits = re.split(r'(?:^|\n)\s*(?:\d+[\.\)]|[-*])\s*', steps_raw)
        clean_steps = [s.strip() for s in raw_splits if s.strip()]

        testcases.append({
            "id": tc_id,
            "title": title,
            "role": role,
            "priority": priority,
            "steps": clean_steps,
            "expected": expected
        })

    return {
        "source_type": "excel",
        "file_path": xlsx_path,
        "total_testcases": len(testcases),
        "testcases": testcases
    }

def parse_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".md":
        return parse_markdown(file_path)
    elif ext in [".xlsx", ".xlsm"]:
        return parse_excel(file_path)
    else:
        raise ValueError(f"Unsupported test case format: {ext}. Only .md and .xlsx are supported.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 parse_testcase.py <testcase_file.md|xlsx>")
        sys.exit(1)
    result = parse_file(sys.argv[1])
    print(json.dumps(result, indent=2))
