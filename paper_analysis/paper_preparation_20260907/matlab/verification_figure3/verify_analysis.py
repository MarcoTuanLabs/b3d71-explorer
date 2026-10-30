from pathlib import Path
import json,hashlib
import numpy as np
from scipy.io import loadmat
from scipy.ndimage import uniform_filter1d
from scipy.cluster.hierarchy import fcluster
W=Path(__file__).resolve().parent;APP=W.parents[1]/'neuron_explorer';M=APP/'paper_analysis/paper_preparation_20260907/matlab';d=loadmat(M/'paper_figure3_data.mat',simplify_cells=True)['f3'];p=json.loads((M/'figure3_provenance.json').read_text());root=Path(p['source']['root'])
assert p['reference_inputs_used'] is False and d['source_fingerprint']==p['sha256_raw_files']
ids=np.unique(np.r_[np.random.default_rng(71).choice(1346,12,replace=False),np.flatnonzero(d['subtypes']['labels']==1)])
bins=np.zeros((len(ids),80,2000),dtype=float)
for session in range(21,41):
 t=np.load(root/f'S{session}_spike_times.npy');u=np.load(root/f'S{session}_spike_clusters.npy')
 for j,id in enumerate(ids):
  spikes=t[u==id]
  for trial,cue in enumerate([5,35,65,95]):
   relative=spikes-cue*32000;selected=relative[(relative>=-5*32000)&(relative<20*32000)];bins[j,(session-21)*4+trial]=np.bincount(((selected+5*32000)//400).astype(np.int64),minlength=2000)
raw=np.corrcoef(bins.reshape(len(ids),-1));smooth=uniform_filter1d(bins,5,axis=2,mode='constant');sd=smooth.std(2,keepdims=True);smooth=np.divide(smooth-smooth.mean(2,keepdims=True),sd,out=np.zeros_like(smooth),where=sd>1e-12);smooth=np.corrcoef(smooth.reshape(len(ids),-1))
np.testing.assert_allclose(d['raw']['corr'][np.ix_(ids,ids)],raw,atol=1e-7)
np.testing.assert_allclose(d['smooth']['corr'][np.ix_(ids,ids)],smooth,atol=1e-7)
cue=bins[:,:,320:800].reshape(len(ids),80,120,4).sum(3).mean(1)*20
np.testing.assert_allclose(d['cue_profiles_hz'][ids],cue,atol=1e-12)
np.testing.assert_array_equal(d['source_spike_count'][ids],bins.sum((1,2)))
for key in ['cue','raw','smooth']:
 s=d[key];assert int(s['k'])==5;assert s['counts'].sum()==1346
 for r in range(1,4):
  for g in range(1,int(s['k'])+1):assert s['counts'][g-1,r-1]==np.sum((d['area']==r)&(s['labels']==g))
 assert set(s['order'])==set(range(1,1347));assert np.allclose(s['corr'],s['corr'].T)
for group in ['subtypes','graph']:
 s=d[group];assert s['counts'].sum()==1346
 for r in range(1,4):
  for g in range(1,int(s['k'])+1):assert s['counts'][g-1,r-1]==np.sum((d['area']==r)&(s['labels']==g))
g=d['graph'];edges=g['edges'];assert len(set(map(tuple,edges[:,:2].astype(int))))==len(edges);assert np.all(edges[:,0]<edges[:,1]);degree=np.zeros(1346);bridge=np.zeros(1346);strength=np.zeros((3,3))
for ii,jj,w in edges:
 i=int(ii)-1;j=int(jj)-1;a=int(d['area'][i])-1;b=int(d['area'][j])-1
 assert np.isclose(w,d['smooth']['corr'][i,j],atol=1e-7) and w>0
 degree[i]+=w;degree[j]+=w;strength[a,b]+=w
 if a!=b:bridge[i]+=w;bridge[j]+=w;strength[b,a]+=w
np.testing.assert_allclose(g['degree'],degree);np.testing.assert_allclose(g['bridge'],bridge);np.testing.assert_allclose(g['edge_strength'],strength)
np.testing.assert_array_equal(g['hubs'],np.argsort(-degree,kind='stable')[:8]+1)
np.testing.assert_array_equal(g['bridges'],np.argsort(-bridge,kind='stable')[:8]+1)
s=d['subtypes'];np.testing.assert_allclose(s['bootstrap'].mean(0),s['recovery_mean']);np.testing.assert_allclose(np.percentile(s['bootstrap'],[2.5,97.5],axis=0).T,s['recovery_interval']);assert s['bootstrap'].shape==(50,int(s['k']))
report={'status':'PASS','independent_raw_spike_reconstruction_units':ids.tolist(),'tested_trials':80,'cue_rate_and_raw_and_normalized_Pearson_match':True,'all_partition_counts_verified':True,'unique_edges_and_degree_and_bridge_and_region_budget_verified':True,'bootstrap_summary_verified':True,'reference_inputs_used':False,'input_mat_sha256':hashlib.sha256((M/'paper_figure3_data.mat').read_bytes()).hexdigest()}
(W/'analysis_verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
