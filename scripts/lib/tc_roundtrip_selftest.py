"""Selftest pulang-pergi test case: MD -> XLSX (tc_export_xlsx) -> MD (convert_to_md_testcase) tanpa kehilangan data."""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from tc_parser import parse  # noqa: E402

MD = """# Suite ZZ
### ALL-ZZ-CART-POS-001: Tambah item ke keranjang
- **Covers**: AC-01, ZZ-RSK-001
- **Priority**: P1 | **Type**: Functional | **Status**: Ready
- **Platforms**: web, android
- **Layers**: UI, DB
- **Role**: {{role:buyer}}
- **Test data**: {{data.product_a}}
- **Precondition**:
  1. Keranjang kosong
- **Steps**:
  1. Buka halaman produk
  2. Klik tambah [MUTATION:create]
- **Expected Results**:
  - [UI] Badge keranjang 1 [PRD §2]
  - [DB] baris cart_items bertambah
### API-ZZ-CART-NEG-002: Tambah item stok habis
- **Covers**: AC-02
- **Priority**: P3 | **Type**: Negative | **Status**: Draft
- **Platforms**: api
- **Steps**:
  1. POST /cart dengan produk stok 0
- **Expected Results**:
  - [API] 409 OUT_OF_STOCK
"""


def main():
    ok = []
    with tempfile.TemporaryDirectory() as d:
        src, xl, back = (os.path.join(d, n) for n in ('src.md', 'tc.xlsx', 'back.md'))
        open(src, 'w').write(MD)
        subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'tc_export_xlsx.py'), src, '--out', xl], check=True, stdout=subprocess.DEVNULL)
        subprocess.run([sys.executable, os.path.join(ROOT, '.agents', 'skills', 'browser-qa-execution', 'scripts', 'convert_to_md_testcase.py'), xl, back],
                       check=True, stdout=subprocess.DEVNULL)
        a, b = parse(open(src).read()), parse(open(back).read())
        ok.append(('jumlah & ID TC sama', [x['id'] for x in a] == [x['id'] for x in b]))
        for k in ('title', 'steps', 'expected', 'precondition', 'covers', 'platforms', 'layers', 'role', 'test_data'):
            ok.append((f'field {k} sama', all((x.get(k) or None) == (y.get(k) or None) for x, y in zip(a, b))))
        ok.append(('prioritas tidak berubah', [x.get('priority') for x in b] == ['P1', 'P3']))
        ok.append(('tidak ada teks generik ditambahkan', 'Pengguna telah login' not in open(back).read()))
    for name, v in ok:
        print(('PASS ' if v else 'FAIL ') + name)
    n = sum(v for _, v in ok)
    print(f'\n{n} PASS, {len(ok) - n} FAIL')
    sys.exit(0 if n == len(ok) else 1)


if __name__ == '__main__':
    main()
