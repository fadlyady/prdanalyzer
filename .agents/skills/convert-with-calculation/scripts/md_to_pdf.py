import os
import sys
import re
import argparse
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)

# Import calculation engine
try:
    from calc_engine import parse_markdown_metrics
except ImportError:
    from .calc_engine import parse_markdown_metrics

def clean_for_reportlab(text):
    if not text:
        return ""
    # Standardize br tags
    t = re.sub(r'<br\s*/?>', '<br/>', str(text), flags=re.IGNORECASE)
    # Math symbols cleanup
    t = t.replace(r'\longrightarrow', ' &rarr; ').replace(r'\ge', ' &ge; ').replace(r'\le', ' &le; ')
    t = t.replace('$', '')
    # Markdown formatting
    t = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'_(.*?)_', r'<i>\1</i>', t)
    # Escape naked &
    t = re.sub(r'&(?!(amp|lt|gt|quot|apos|bull|rarr|ge|le|#\d+);)', '&amp;', t)
    return t

def convert_md_to_pdf(md_path, pdf_path, contributor=None, approver=None, informed=None):
    with open(md_path, "r", encoding="utf-8") as f:
        full_text = f.read()
        lines = full_text.splitlines()

    # Calculate metrics
    metrics = parse_markdown_metrics(full_text)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#000000'),
        spaceAfter=10
    )
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    h3_style = ParagraphStyle(
        'Heading3_Custom',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#333333'),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#222222'),
        spaceAfter=4
    )
    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#111111')
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=table_cell_style,
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#000000')
    )

    story = []

    title_text = ""
    for line in lines:
        if line.strip().startswith("# "):
            title_text = line.strip()[2:].strip()
            break
    if not title_text:
        title_text = os.path.basename(md_path).replace(".md", "")

    story.append(Paragraph(f"<b>[TIW] {title_text}</b>", title_style))

    # Dynamic Metadata Box
    feature_name = title_text.replace("Analisis PRD & Perancangan Test Matrix:", "").strip()
    author = contributor or "QA Lead / QA Engineer"
    reviewers = approver or "Product Manager, Engineering Lead, QA Lead"
    stakeholders = informed or "Product Management, Engineering Core Team, Operations"
    current_date = datetime.now().strftime("%B %d, %Y")

    meta_data = [
        [Paragraph("<b>Product/Feature Name</b>", table_cell_style), Paragraph(feature_name, table_cell_style)],
        [Paragraph("<b>Supporting Docs</b>", table_cell_style), Paragraph("PRD, Figma / UI References, OpenAPI / Technical Specs, RBAC SSOT", table_cell_style)],
        [Paragraph("<b>Contributor</b>", table_cell_style), Paragraph(author, table_cell_style)],
        [Paragraph("<b>Approver</b>", table_cell_style), Paragraph(reviewers, table_cell_style)],
        [Paragraph("<b>Informed</b>", table_cell_style), Paragraph(stakeholders, table_cell_style)]
    ]
    meta_tbl = Table(meta_data, colWidths=[150, 365])
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#CCCCCC')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 10))

    # Changelog
    story.append(Paragraph("Changelog", h2_style))
    changelog_data = [
        [Paragraph("<b>Version</b>", table_header_style), Paragraph("<b>Date</b>", table_header_style), Paragraph("<b>Description</b>", table_header_style), Paragraph("<b>Update By</b>", table_header_style), Paragraph("<b>Color Mark</b>", table_header_style)],
        [Paragraph("1.0.0", table_cell_style), Paragraph(current_date, table_cell_style), Paragraph("Initial Document Analysis with Calculated Quality Gate Matrix", table_cell_style), Paragraph(author, table_cell_style), Paragraph("", table_cell_style)]
    ]
    cl_tbl = Table(changelog_data, colWidths=[60, 90, 205, 110, 50])
    cl_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#CCCCCC')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(cl_tbl)
    story.append(Spacer(1, 10))

    # Approval
    story.append(Paragraph("Approval", h2_style))
    approval_data = [
        [Paragraph("<b>Name / Role</b>", table_header_style), Paragraph("<b>Status</b>", table_header_style), Paragraph("<b>Date</b>", table_header_style), Paragraph("<b>Notes</b>", table_header_style)],
        [Paragraph("Product Manager", table_cell_style), Paragraph("Pending", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("Engineering Lead", table_cell_style), Paragraph("Pending", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("QA Lead", table_cell_style), Paragraph("Pending", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)]
    ]
    app_tbl = Table(approval_data, colWidths=[140, 90, 100, 185])
    app_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#CCCCCC')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(app_tbl)
    story.append(Spacer(1, 10))

    # Executive Calculated Quality Gate Scorecard
    story.append(Paragraph("Executive Quality Gate & Release Scorecard (Calculated)", h2_style))
    scorecard_data = [
        [Paragraph("<b>Quality Gate Metric</b>", table_header_style), Paragraph("<b>Measured Value</b>", table_header_style), Paragraph("<b>Target Standard</b>", table_header_style), Paragraph("<b>Compliance Status</b>", table_header_style)],
        [Paragraph("Requirements Coverage (Happy Path)", table_cell_style), Paragraph(f"{metrics['req_coverage']}%", table_cell_style), Paragraph("100%", table_cell_style), Paragraph("Met" if metrics['req_coverage']>=100 else "Not Met", table_cell_style)],
        [Paragraph("Critical & High Risk Coverage", table_cell_style), Paragraph(f"{metrics['crit_high_coverage']}%", table_cell_style), Paragraph("100%", table_cell_style), Paragraph("Met" if metrics['crit_high_coverage']>=100 else "Not Met", table_cell_style)],
        [Paragraph("Basic Risk Coverage", table_cell_style), Paragraph(f"{metrics['basic_risk_coverage']}% ({metrics['covered_risks']}/{metrics['total_risks']} Risks)", table_cell_style), Paragraph("≥ 80%", table_cell_style), Paragraph("Met" if metrics['basic_risk_coverage']>=80 else "Not Met", table_cell_style)],
        [Paragraph("Weighted Risk Coverage (Bobot 4/3/2/1)", table_cell_style), Paragraph(f"{metrics['weighted_risk_coverage']}% ({metrics['covered_weight']}/{metrics['total_weight']} Pts)", table_cell_style), Paragraph("≥ 90% (Min 85%)", table_cell_style), Paragraph("Met" if metrics['weighted_risk_coverage']>=85 else "Not Met", table_cell_style)],
        [Paragraph("<b>Release Recommendation Verdict</b>", table_header_style), Paragraph(f"<b>[{metrics['verdict']}]</b>", table_header_style), Paragraph("<b>GO / CONDITIONAL GO</b>", table_header_style), Paragraph(f"<b>{metrics['verdict']}</b>", table_header_style)]
    ]
    sc_tbl = Table(scorecard_data, colWidths=[180, 140, 110, 85])
    sc_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#00FFFF')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E6F7FF')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(sc_tbl)
    story.append(Spacer(1, 6))

    verdict_text = f"<b>Release Verdict Summary:</b> <font color='{metrics['verdict_color']}'><b>[{metrics['verdict']}]</b></font> — {metrics['verdict_desc']}"
    story.append(Paragraph(verdict_text, body_style))
    story.append(Spacer(1, 10))

    def render_pdf_table(headers, rows):
        if not headers and not rows:
            return
        all_rows = [headers] + rows if headers else rows
        num_cols = max(len(r) for r in all_rows)
        
        col_w = 515.0 / num_cols
        widths = [col_w] * num_cols

        if num_cols == 5:
            widths = [135, 75, 95, 105, 105]
        elif num_cols == 6:
            widths = [140, 75, 75, 75, 75, 75]
        elif num_cols == 3:
            widths = [200, 115, 200]
        elif num_cols == 2:
            widths = [160, 355]

        table_data = []
        is_cyan = any(w in " ".join(headers).lower() for w in ["scenario", "test case", "rule", "fep", "decision", "kondisi", "skenario", "assertion"])
        header_color = colors.HexColor('#00FFFF') if is_cyan else colors.HexColor('#CCCCCC')

        for r_idx, row in enumerate(all_rows):
            r_data = []
            is_hdr = (r_idx == 0)
            st = table_header_style if is_hdr else table_cell_style
            for c_idx, val in enumerate(row):
                val_str = str(val).strip()
                val_html = clean_for_reportlab(val_str)
                r_data.append(Paragraph(val_html, st))
            while len(r_data) < num_cols:
                r_data.append(Paragraph("", st))
            table_data.append(r_data)

        t = Table(table_data, colWidths=widths)
        t_style = [
            ('BACKGROUND', (0, 0), (-1, 0), header_color),
            ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]
        t.setStyle(TableStyle(t_style))
        story.append(t)
        story.append(Spacer(1, 8))

    in_table = False
    table_headers = []
    table_rows = []

    for line in lines:
        s = line.strip()

        if s.startswith("|") and s.endswith("|"):
            cells = [c.strip() for c in s[1:-1].split("|")]
            if all(re.match(r'^:?-+:?$', c) for c in cells if c):
                continue
            if not in_table:
                in_table = True
                table_headers = cells
                table_rows = []
            else:
                table_rows.append(cells)
            continue
        else:
            if in_table:
                render_pdf_table(table_headers, table_rows)
                in_table = False
                table_headers = []
                table_rows = []

        if not s:
            continue

        if s.startswith("# "):
            continue
        elif s.startswith("## "):
            story.append(Paragraph(s[3:].strip(), h2_style))
        elif s.startswith("### "):
            story.append(Paragraph(s[4:].strip(), h3_style))
        elif s.startswith("---"):
            story.append(Spacer(1, 6))
        elif s.startswith("- ") or s.startswith("* "):
            content = s[2:].strip()
            content_html = clean_for_reportlab(content)
            story.append(Paragraph(f"&bull; {content_html}", bullet_style))
        elif re.match(r'^\d+\.\s+', s):
            content_html = clean_for_reportlab(s)
            story.append(Paragraph(content_html, body_style))
        else:
            content_html = clean_for_reportlab(s)
            story.append(Paragraph(content_html, body_style))

    if in_table:
        render_pdf_table(table_headers, table_rows)

    # Feedbacks Table
    story.append(Paragraph("Feedbacks & Review Log", h2_style))
    feedback_headers = ["Reviewer and Description", "Type", "Action"]
    feedback_rows = [["", "", ""], ["", "", ""]]
    render_pdf_table(feedback_headers, feedback_rows)

    os.makedirs(os.path.dirname(os.path.abspath(pdf_path)), exist_ok=True)
    doc.build(story)
    print(f"Successfully converted MD to PDF with calculations: {pdf_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert Markdown QA Analysis to Standard PDF with Calculations")
    parser.add_argument("input_md", help="Path to input markdown file")
    parser.add_argument("output_pdf", help="Path to output pdf file")
    parser.add_argument("--contributor", default=None, help="Contributor name")
    parser.add_argument("--approver", default=None, help="Approver names")
    parser.add_argument("--informed", default=None, help="Informed stakeholders")
    args = parser.parse_args()
    convert_md_to_pdf(args.input_md, args.output_pdf, args.contributor, args.approver, args.informed)
