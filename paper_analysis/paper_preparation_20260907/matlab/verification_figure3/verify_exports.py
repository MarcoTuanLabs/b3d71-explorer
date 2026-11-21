from pathlib import Path
import json
import pymupdf as fitz
import xml.etree.ElementTree as ET
W=Path(__file__).resolve().parent;G=W/'generated';report={}
files=sorted(G.glob('paper_figure_03*.pdf'));assert len(files)==7,len(files)
for file in files:
 stem=file.stem
 for ext in ['svg','pdf','png','fig']:assert (G/f'{stem}.{ext}').stat().st_size>1000
 ET.parse(G/f'{stem}.svg')
 doc=fitz.open(file);page=doc[0];lines=[]
 for block in page.get_text('dict')['blocks']:
  for line in block.get('lines',[]):
   text=''.join(s['text'] for s in line['spans']).strip()
   if text:lines.append((text,fitz.Rect(line['bbox'])))
 overlaps=[]
 for i,(a,ra) in enumerate(lines):
  for b,rb in lines[i+1:]:
   clip=ra&rb
   if not clip.is_empty and clip.width>.5 and clip.height>.5:overlaps.append({'a':a,'b':b,'intersection':[round(clip.width,2),round(clip.height,2)]})
 clipped=[t for t,r in lines if r.x0<-.5 or r.y0<-.5 or r.x1>page.rect.width+.5 or r.y1>page.rect.height+.5]
 (W/'pdf_previews').mkdir(exist_ok=True);page.get_pixmap(matrix=fitz.Matrix(1.6,1.6)).save(W/'pdf_previews'/f'{stem}.png')
 report[stem]={'text_lines':len(lines),'overlaps':overlaps,'clipped':clipped};doc.close()
(W/'pdf_layout_report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert all(not r['overlaps'] and not r['clipped'] for r in report.values())
r=json.loads((G/'matlab_figure3_results.json').read_text());assert r['matlab_execution_verified'] and r['panels']==7 and r['cue_clusters']==5 and r['subtypes']==16 and r['communities']==8 and r['zscore_firing_map_included'] is False
print('PASS: seven MATLAB native/exported panels; 5/16/8 resolution; no PDF text overlap or clipping')
