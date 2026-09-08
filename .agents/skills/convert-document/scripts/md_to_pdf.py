import os
import sys
import re
import argparse
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)

def convert_md_to_pdf(md_path, pdf_path):
    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom styles
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

    # Title extraction
    title_text = ""
    for line in lines:
        if line.strip().startswith("# "):
            title_text = line.strip()[2:].strip()
            break
    if not title_text:
        title_text = os.path.basename(md_path).replace(".md", "")

    story.append(Paragraph(f"<b>[TIW] {title_text}</b>", title_style))

    # Metadata Box
    feature_name = title_text.replace("Analisis PRD & Perancangan Test Matrix:", "").strip()
    meta_data = [
        [Paragraph("<b>Product/Feature Name</b>", table_cell_style), Paragraph(feature_name, table_cell_style)],
        [Paragraph("<b>Supporting Docs</b>", table_cell_style), Paragraph("PRD, Figma, RBAC SSOT, Adhoc Docs", table_cell_style)],
        [Paragraph("<b>Contributor</b>", table_cell_style), Paragraph("Eldo Fadlyady (QA Engineer)", table_cell_style)],
        [Paragraph("<b>Approver</b>", table_cell_style), Paragraph("Rizky Nuredja, Elsa Vinietta", table_cell_style)],
        [Paragraph("<b>Informed</b>", table_cell_style), Paragraph("Everpro Core Team, Product Management, Engineering", table_cell_style)]
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
        [Paragraph("1.0.0", table_cell_style), Paragraph("May 18, 2026", table_cell_style), Paragraph("Initial Document Analysis & Test Matrix", table_cell_style), Paragraph("Eldo Fadlyady", table_cell_style), Paragraph("", table_cell_style)]
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
        [Paragraph("<b>Name</b>", table_header_style), Paragraph("<b>Status</b>", table_header_style), Paragraph("<b>Date</b>", table_header_style), Paragraph("<b>Notes</b>", table_header_style)],
        [Paragraph("Rizky Nuredja", table_cell_style), Paragraph("Pending", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("Elsa Vinietta", table_cell_style), Paragraph("Pending", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("QA Lead / PM", table_cell_style), Paragraph("Pending", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)],
        [Paragraph("Engineering Lead", table_cell_style), Paragraph("Pending", table_cell_style), Paragraph("", table_cell_style), Paragraph("", table_cell_style)]
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

    # Helper function for rendering markdown tables in PDF
    def render_pdf_table(headers, rows):
        if not headers and not rows:
            return
        all_rows = [headers] + rows if headers else rows
        num_cols = max(len(r) for r in all_rows)
        
        # Calculate available width (515 pt)
        col_w = 515.0 / num_cols
        widths = [col_w] * num_cols

        # Specific adjustments for 5/6 cols
        if num_cols == 5:
            widths = [135, 75, 95, 105, 105]
        elif num_cols == 6:
            widths = [140, 75, 75, 75, 75, 75]
        elif num_cols == 3:
            widths = [200, 115, 200]
        elif num_cols == 2:
            widths = [160, 355]

        table_data = []
        is_cyan = any(w in " ".join(headers).lower() for w in ["scenario", "test case", "rule", "fep", "decision", "kondisi", "skenario"])
        header_color = colors.HexColor('#00FFFF') if is_cyan else colors.HexColor('#CCCCCC')

        for r_idx, row in enumerate(all_rows):
            r_data = []
            is_hdr = (r_idx == 0)
            st = table_header_style if is_hdr else table_cell_style
            for c_idx, val in enumerate(row):
                val_str = str(val).strip()
                # Markdown bold convert
                val_html = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', val_str)
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
        raw = line.rstrip("\n\r")
        s = raw.strip()

        # Check table
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
            content_html = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', content)
            story.append(Paragraph(f"&bull; {content_html}", bullet_style))
        elif re.match(r'^\d+\.\s+', s):
            content_html = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', s)
            story.append(Paragraph(content_html, body_style))
        else:
            content_html = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', s)
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
    print(f"Successfully converted MD to PDF: {pdf_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert Markdown QA Analysis to Standard PDF")
    parser.add_argument("input_md", help="Path to input markdown file")
    parser.add_argument("output_pdf", help="Path to output pdf file")
    args = parser.parse_args()
    convert_md_to_pdf(args.input_md, args.output_pdf)
