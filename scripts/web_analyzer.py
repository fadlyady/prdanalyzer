#!/usr/bin/env python3
"""
Web Analyzer & Scraper Tool using Firecrawl
Mengonversi website / web app / dokumentasi web menjadi dokumen Markdown bersih
yang siap dianalisis oleh AI Agent (prd-qa-analyzer, generate-testcase, dll.)
"""

import os
import sys
import argparse
import re
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def sanitize_filename(url: str) -> str:
    """Mengubah URL menjadi nama file yang valid."""
    cleaned = re.sub(r"^https?://", "", url)
    cleaned = re.sub(r"[/\\?%*:|\"<>]", "_", cleaned)
    cleaned = cleaned.strip("_")
    return cleaned[:80] or "scraped_web"

def main():
    parser = argparse.ArgumentParser(
        description="Scrape atau crawl halaman web ke format Markdown bersih menggunakan Firecrawl."
    )
    parser.add_argument("url", help="URL website target yang ingin dianalisis")
    parser.add_argument(
        "--mode",
        choices=["scrape", "crawl", "map"],
        default="scrape",
        help="Mode operasi: 'scrape' (1 halaman), 'crawl' (seluruh sub-halaman), 'map' (daftar URL). Default: scrape",
    )
    parser.add_argument(
        "--output-dir",
        default="adhoc-document",
        help="Direktori penyimpanan output file Markdown (default: adhoc-document/)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Batas halaman saat mode 'crawl' (default: 10)",
    )

    args = parser.parse_args()

    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key or api_key == "fc-your_api_key_here":
        print("\n❌ [ERROR] FIRECRAWL_API_KEY belum disetel!")
        print("💡 Silakan isi API key di file `.env`:")
        print("   FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxx\n")
        print("Daftar akun dan dapatkan API key gratis di: https://www.firecrawl.dev/\n")
        sys.exit(1)

    try:
        from firecrawl import FirecrawlApp
    except ImportError:
        print("\n❌ [ERROR] Paket `firecrawl-py` belum terinstal.")
        print("Jalankan: pip3 install firecrawl-py python-dotenv\n")
        sys.exit(1)

    app = FirecrawlApp(api_key=api_key)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    base_name = sanitize_filename(args.url)

    if args.mode == "scrape":
        print(f"🌐 [Scraping single URL]: {args.url} ...")
        result = app.scrape_url(
            args.url,
            params={
                "formats": ["markdown"],
            },
        )

        markdown_content = result.get("markdown", "") if isinstance(result, dict) else getattr(result, "markdown", "")
        metadata = result.get("metadata", {}) if isinstance(result, dict) else getattr(result, "metadata", {})

        title = metadata.get("title") if isinstance(metadata, dict) else getattr(metadata, "title", base_name)
        file_path = output_dir / f"{base_name}.md"

        header = f"# {title or base_name}\n\n> **Source URL:** {args.url}\n> **Scraped via Firecrawl**\n\n---\n\n"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(header + (markdown_content or "Tidak ada konten markdown yang diekstraksi."))

        print(f"✅ [Sukses] Halaman berhasil di-scrape ke: {file_path}")
        print(f"📄 Siap dianalisis oleh AI Agent menggunakan skill `prd-qa-analyzer`.")

    elif args.mode == "crawl":
        print(f"🕷️ [Crawling website]: {args.url} (limit: {args.limit} pages) ...")
        crawl_result = app.crawl_url(
            args.url,
            params={
                "limit": args.limit,
                "scrapeOptions": {"formats": ["markdown"]},
            },
            poll_interval=5,
        )

        file_path = output_dir / f"{base_name}_crawl.md"
        data_list = crawl_result.get("data", []) if isinstance(crawl_result, dict) else getattr(crawl_result, "data", [])

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"# Crawl Report: {args.url}\n\n> Total Pages: {len(data_list)}\n\n---\n\n")
            for idx, item in enumerate(data_list, 1):
                item_dict = item if isinstance(item, dict) else getattr(item, "__dict__", {})
                item_url = item_dict.get("metadata", {}).get("sourceURL", f"Page {idx}")
                item_md = item_dict.get("markdown", "")
                f.write(f"\n## [{idx}] Source: {item_url}\n\n{item_md}\n\n---\n")

        print(f"✅ [Sukses] Crawl selesai! Hasil tersimpan di: {file_path}")

    elif args.mode == "map":
        print(f"🗺️ [Mapping URL domain]: {args.url} ...")
        map_result = app.map_url(args.url)
        links = map_result.get("links", []) if isinstance(map_result, dict) else getattr(map_result, "links", [])

        file_path = output_dir / f"{base_name}_sitemap.md"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"# Sitemap Map: {args.url}\n\n> Total Links: {len(links)}\n\n")
            for link in links:
                f.write(f"- {link}\n")

        print(f"✅ [Sukses] Sitemap links berhasil disimpan di: {file_path}")

if __name__ == "__main__":
    main()
