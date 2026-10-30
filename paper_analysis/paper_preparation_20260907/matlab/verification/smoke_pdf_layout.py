"""Inspect actual vector-PDF text geometry from all seven MATLAB-source plots."""
import json
from pathlib import Path
import fitz

ROOT=Path(__file__).resolve().parent
folder=ROOT/'generated'
report={}
for file in sorted(folder.glob('paper_figure_*.pdf')):
 doc=fitz.open(file)
 assert len(doc)==1,file
 page=doc[0]
 lines=[]
 for block in page.get_text('dict')['blocks']:
  for line in block.get('lines',[]):
   text=''.join(s['text'] for s in line['spans']).strip()
   if text: lines.append((text,fitz.Rect(line['bbox'])))
 overlaps=[]
 for i,(a,ra) in enumerate(lines):
  for b,rb in lines[i+1:]:
   clip=ra & rb
   if not clip.is_empty and clip.width>.5 and clip.height>.5:
    overlaps.append({'a':a,'b':b,'intersection_pt':[round(clip.width,2),round(clip.height,2)]})
 clipped=[t for t,r in lines if r.x0<-.5 or r.y0<-.5 or r.x1>page.rect.width+.5 or r.y1>page.rect.height+.5]
 report[file.stem]={'text_lines':len(lines),'overlaps':overlaps,'clipped':clipped}
 doc.close()
(ROOT/'pdf_layout_report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
assert len(report)==7, 'Expected7 panels'
assert all(not r['overlaps'] and not r['clipped'] for r in report.values()), 'Text overlap or clipping in PDF'
print('PASS: seven actual PDF exports; no text overlap or clipping')
