#!/usr/bin/env python3
"""
Convert Test Case Excel (.xlsx) to Standard Markdown (.md)
For browser-qa-execution skill.
Enforces strict Markdown input requirement by facilitating automatic conversion.
"""

import sys
import os
import re
import json

# Import the existing parser
from parse_testcase import parse_file

def convert_to_markdown(source_file, output_md_path=None):
    if not os.path.exists(source_file):
        raise FileNotFoundError(f"Source file not found: {source_file}")

    parsed = parse_file(source_file)
    testcases = parsed.get("testcases", [])

    base_name = os.path.splitext(os.path.basename(source_file))[0]
    feature_title = base_name.replace("Test_Cases_", "").replace("test-cases-", "").replace("_", " ").title()

    if not output_md_path:
        out_dir = os.path.dirname(os.path.abspath(source_file))
        clean_name = base_name.lower().replace("test_cases_", "test-cases-").replace("_", "-")
        if not clean_name.startswith("test-cases-"):
            clean_name = f"test-cases-{clean_name}"
        output_md_path = os.path.join(out_dir, f"{clean_name}.md")

    lines = []
    lines.append(f"# Test Case Suite: {feature_title}\n")
    lines.append(f"Dokumen ini dikonversi secara otomatis dari `{os.path.basename(source_file)}` untuk mematuhi standar input Markdown skill `browser-qa-execution`.\n")
    lines.append("---\n")

    for idx, tc in enumerate(testcases, 1):
        tc_id = tc.get("id") or f"TC_{idx:03d}"
        title = tc.get("title", "Untitled Scenario")
        role = tc.get("role", "Owner")
        priority = tc.get("priority", "P1 - Critical")
        steps = tc.get("steps", [])
        expected = tc.get("expected", "")

        lines.append(f"### {tc_id}: {title}")
        lines.append(f"- **Role**: {role}")
        lines.append(f"- **Priority**: {priority}")
        lines.append(f"- **Precondition**:")
        lines.append(f"  1. Pengguna telah login dengan hak akses `{role}`.")
        lines.append(f"  2. Halaman aplikasi target telah dimuat dengan normal.")
        lines.append(f"- **Steps**:")
        if steps:
            for s_i, step in enumerate(steps, 1):
                clean_step = step.strip()
                clean_step = re.sub(r'^\d+[\.\)]\s*', '', clean_step)
                lines.append(f"  {s_i}. {clean_step}")
        else:
            lines.append("  1. Lakukan aksi navigasi dan pengujian sesuai kebutuhan fitur.")
        lines.append(f"- **Expected Result**:")
        if expected:
            lines.append(f"  {expected}")
        else:
            lines.append("  1. Aksi berhasil diproses oleh sistem tanpa pesan error.")
        lines.append("\n")

    content = "\n".join(lines)
    os.makedirs(os.path.dirname(os.path.abspath(output_md_path)), exist_ok=True)
    with open(output_md_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[SUCCESS] Berhasil mengonversi {len(testcases)} testcase ke Markdown: {output_md_path}")
    return output_md_path

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 convert_to_md_testcase.py <source_file.xlsx> [output_file.md]")
        sys.exit(1)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else None
    convert_to_markdown(src, out)
