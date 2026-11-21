import json,re
from pathlib import Path
from collections import Counter
import numpy as np
import pymupdf
from scipy.io import loadmat
from scipy.stats import fisher_exact
W=Path(__file__).resolve().parent;G=W/'generated'
source=W.parents[1]/'neuron_explorer/paper_analysis/paper_preparation_20260907/matlab'
data=loadmat(source/'paper_source_data.mat',simplify_cells=True)['data']
result=json.loads((G/'matlab_render_results.json').read_text())
assert result['matlab_execution_verified']
d=result['statistics']['stat2d'];assert d['family_size']==4 and d['correction']=='Holm across four displayed scopes'
p=[]
for a in range(4):
    selected=(data['area_code']==a) if a else np.ones(len(data['area_code']),dtype=bool)
    fast=(data['response_code'][selected & (data['wave_code']==2)]==1).astype(float)
    broad=(data['response_code'][selected & (data['wave_code']==1)]==1).astype(float)
    p.append(fisher_exact([[broad.sum(),len(broad)-broad.sum()],[fast.sum(),len(fast)-fast.sum()]],alternative='two-sided').pvalue)
np.testing.assert_allclose(d['p_raw'],p,rtol=1e-10,atol=0)
order=np.argsort(p);adjusted=np.empty(4);adjusted[order]=np.minimum(1,np.maximum.accumulate(np.asarray(p)[order]*np.arange(4,0,-1)))
np.testing.assert_allclose(d['p_holm'],adjusted,rtol=1e-10,atol=0)
assert d['stars']==['****','****','***','ns']
panels={}
for stem,n,counts,denomaxis in [('paper_figure_02b_waveform_composition',8,data['fig2b']['counts'],1),('paper_figure_02d_response_by_waveform',24,data['fig2d']['counts'],2)]:
    doc=pymupdf.open(G/(stem+'.pdf'));text=doc[0].get_text();doc.close()
    actual=re.findall(r'^\d+\.\d%$',text,re.M)
    counts=np.asarray(counts,dtype=float);pct=100*counts/counts.sum(axis=denomaxis,keepdims=True)
    expected=[f'{v:.1f}%' for v in pct.flat]
    assert len(actual)==n and Counter(actual)==Counter(expected),(stem,actual,expected)
    meta=json.loads((G/'qa'/(stem+'_render.json')).read_text())
    assert meta['segment_percentage_labels']==n
    if n==24:assert meta['detail_axes_count']==0 and meta['data_axes_count']==4 and 'Holm' in text and 'Welch' not in text
    assert meta['data_axes_count']==4
    if n==24:assert 'Top of bar detail' not in text and 'All response classes:' not in text
    panels[stem]={'in_bar_percentage_count':n,'source_match':True,'detail_axes':meta['detail_axes_count']}
assert len(list(G.glob('*.fig')))==7
report={'status':'PASS','runtime':result['runtime'],'panels':panels,'native_matlab_fig_files':7,'raw_p':p,'adjusted_p':adjusted.tolist(),'correction':d['correction'],'stars':d['stars']}
(W/'output_verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
