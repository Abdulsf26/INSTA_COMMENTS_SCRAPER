"""Optional documentation builder: pip install reportlab; python tools/build_review.py output.pdf"""
from pathlib import Path
import json, sys
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE = Path(__file__).resolve().parents[1]
points = json.loads((BASE / 'docs/review-points.json').read_text())
font_dir = Path('/usr/share/fonts/truetype/dejavu')
if (font_dir / 'DejaVuSans.ttf').exists():
    pdfmetrics.registerFont(TTFont('HKS', str(font_dir / 'DejaVuSans.ttf')))
    pdfmetrics.registerFont(TTFont('HKS-Bold', str(font_dir / 'DejaVuSans-Bold.ttf')))
    pdfmetrics.registerFontFamily('HKS', normal='HKS', bold='HKS-Bold')
    regular, bold = 'HKS', 'HKS-Bold'
else:
    regular, bold = 'Helvetica', 'Helvetica-Bold'
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyHKS', fontName=regular, fontSize=10, leading=15, spaceAfter=7, textColor=colors.HexColor('#171717')))
styles.add(ParagraphStyle(name='SmallHKS', parent=styles['BodyHKS'], fontSize=8.5, leading=12))
styles.add(ParagraphStyle(name='TitleHKS', fontName=bold, fontSize=29, leading=34, spaceAfter=15))
styles.add(ParagraphStyle(name='HeadingHKS', fontName=bold, fontSize=14, leading=19, spaceAfter=9))
styles.add(ParagraphStyle(name='LabelHKS', fontName=bold, fontSize=9, leading=13))
def p(text, style='BodyHKS'):
    return Paragraph(escape(text), styles[style])

def page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(colors.HexColor('#171717'))
    for x, y, color in [(42,height-35,'#A8C8FF'),(52,height-35,'#FF8C7B'),(42,height-45,'#DFEF78'),(52,height-45,'#C8BAED')]:
        canvas.setFillColor(colors.HexColor(color)); canvas.rect(x,y,9,9,stroke=1,fill=1)
    canvas.setFillColor(colors.HexColor('#171717')); canvas.setFont(bold,10)
    canvas.drawString(71,height-36,'HKS_67 / RELEASE REVIEW')
    canvas.setFont(regular,8); canvas.drawRightString(width-42,height-36,'v5.0.0  |  30 OCT 2026')
    canvas.line(42,40,width-42,40);canvas.drawString(42,27,'Two simulated review perspectives / not independent reviewers')
    canvas.drawRightString(width-42,27,str(doc.page));canvas.restoreState()

out = Path(sys.argv[1]) if len(sys.argv)>1 else BASE.parent/'HKS_67-Arguments-and-Final-Review.pdf'
doc = SimpleDocTemplate(str(out), pagesize=A4, rightMargin=42,leftMargin=42,topMargin=65,bottomMargin=55,title='HKS_67 — 24-point arguments and final review',author='HKS_67 project review')
story=[p('HKS_67','TitleHKS'),p('24 arguments. One practical release.','HeadingHKS'),p('A structured user-versus-engineering review of the extension, exports, media and optional AI workflow. These are two simulated review perspectives, not two independent agents or a transcript of private reasoning.'),p('Release decision: suitable for controlled desktop use within the tested boundaries. Free local collection/exports remain primary. Do not describe partial coverage, unavailable photos, live paid AI or all-laptop compatibility as solved.'),p('Evidence at a glance','HeadingHKS')]
for line in ['85 grouped automated checks: 13 collector state + 13 media/core + 10 Excel + 14 analysis/API boundary + 25 Chrome integration + 10 Moli DOM checks.','Additional axe audits: zero reported WCAG A/AA violations in setup, review and AI dialog; document-width checks at 320, 640, 780 and 1280 CSS pixels. These are not an accessibility certification.','Historical real dataset: 624 / 639 reported rows, 511 roots + 113 replies, 45 GIF and 80 withheld-photo placeholders. New workbook: four sheets, two native charts and one actually fetched GIF still; validated independently with openpyxl.','No fresh authenticated post collection or real paid API call was made for this release. Chrome/network integration uses deterministic fixtures.']:
    story.append(p(line))
story.extend([Spacer(1,10),p('How to read the review','HeadingHKS'),p('USER VIEW states the practical need. ENGINEERING states a constraint or counterpoint. The decision records the delivered change or an explicit limit, followed by the evidence location. No claim of universal compatibility or complete source access is implied.'),Spacer(1,12)])
for item in points:
    title=p(f"{item['number']:02d} / {item['title']}",'HeadingHKS')
    rows=[[p('USER VIEW','LabelHKS'),p('ENGINEERING','LabelHKS')],[p(item['user']),p(item['engineering'])],[p('DECISION / '+item['decision']), ''],[p('EVIDENCE / '+item['evidence'],'SmallHKS'),'']]
    table=Table(rows,colWidths=[(A4[0]-84)/2]*2,hAlign='LEFT')
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(0,0),colors.HexColor('#A8C8FF')),('BACKGROUND',(1,0),(1,0),colors.HexColor('#FFBA9B')),('BACKGROUND',(0,2),(-1,-1),colors.HexColor('#F5F1E8')),('SPAN',(0,2),(-1,2)),('SPAN',(0,3),(-1,3)),('BOX',(0,0),(-1,-1),1,colors.HexColor('#171717')),('LINEBELOW',(0,0),(-1,0),1,colors.HexColor('#171717')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    story.append(KeepTogether([title,table,Spacer(1,16)]))
story.extend([p('Final corrections and remaining boundaries','HeadingHKS'),p('Corrected during review: oversized unavailable-media cards; unreachable full comment text; imported-source partial status; selected-tab hover contrast; API-key clearing on Escape; short visible spreadsheet links; stable comment-scoped media references. Native chart and image parts were checked with an independent spreadsheet reader.'),p('Before using live: install/reload on your own desktop browser; export the old JSON before moving installation paths; keep the original post tab open; read the coverage warning; inspect exact AI data before consenting. API account/model/billing and ChatGPT UI behavior still require user-side verification.'),p('Not verified: every laptop/OS, every historic Chrome release, real screen-reader interaction, exhaustive RTL/localization/OS-level zoom, desktop Excel visual rendering, every media codec/URL, provider billing/cancellation behavior, or complete access to inaccessible comments.'),p('Maintenance priority: preserve the proven collector and compatibility keys; keep schema fixtures current; rerun the included tests for changes; never hide uncertainty to make the result look complete.'),Spacer(1,12),p('Source and attribution','HeadingHKS'),p('Supplied UI guidance: github.com/jakubkrehel/skills, inspected snapshot 592aedc, MIT, Jakub Krehel (2026). Skills were copied into this Arena workspace, not installed into the user’s local editor. See docs/UI-SKILLS.md, VALIDATION.md, ARCHITECTURE.md and the editable docs/review-points.json for implementation and verification details.','SmallHKS')])
doc.build(story,onFirstPage=page,onLaterPages=page)
print(out)
