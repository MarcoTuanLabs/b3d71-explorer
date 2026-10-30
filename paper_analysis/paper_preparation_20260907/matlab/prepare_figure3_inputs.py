#!/usr/bin/env python3
"""Recompute Figure 3 from complete spike samples. Numeric analysis only; MATLAB draws all panels.
No teacher figures, reference counts, existing hierarchy memberships or graph coordinates are read.
"""
from pathlib import Path
import sys,json,hashlib,csv
import numpy as np
import scipy,networkx as nx
from scipy.io import savemat
from scipy.cluster.hierarchy import linkage,leaves_list,fcluster,cut_tree
from scipy.cluster.vq import kmeans2
from scipy.spatial.distance import squareform
from scipy.sparse import diags
from scipy.optimize import linear_sum_assignment
HERE=Path(__file__).resolve().parent;APP=HERE.parents[2]
sys.path.insert(0,str(APP/'tools'))
from full_spike_data import DEFAULT_SPIKE_ROOT,build_sparse_raster_matrix,source_fingerprint,validate_spike_root
SEED=20260918;NBOOT=50
OUT=HERE.parent

def corr_dense(x):
 x=np.asarray(x,dtype=float);x=x-x.mean(1,keepdims=True);norm=np.sqrt((x*x).sum(1));valid=norm>1e-12
 y=np.divide(x,norm[:,None],out=np.zeros_like(x),where=valid[:,None]);c=np.clip(y@y.T,-1,1);np.fill_diagonal(c,1)
 return c

def tree_from(c):
 d=np.clip(1-c,0,2);np.fill_diagonal(d,0);return linkage(squareform(d,checks=False),method='average'),d

def silhouette(d,lab):
 labels=np.unique(lab);sizes=np.array([(lab==k).sum() for k in labels]);means=np.column_stack([d[:,lab==k].mean(1) for k in labels]);inv=np.searchsorted(labels,lab);n=sizes[inv];a=means[np.arange(len(lab)),inv]*n/np.maximum(n-1,1);means[np.arange(len(lab)),inv]=np.inf;b=means.min(1)
 v=np.divide(b-a,np.maximum(a,b),out=np.zeros_like(a),where=np.maximum(a,b)>0);v[n==1]=0
 return float(v.mean())

def fit(c,maxk=10):
 tree,d=tree_from(c);scores=[]
 for k in range(2,min(maxk,len(c)-1)+1):
  lab=fcluster(tree,k,criterion='maxclust');scores.append([k,silhouette(d,lab)])
 lab=cut_tree(tree,n_clusters=5).ravel()+1;order=leaves_list(tree);keys=list(dict.fromkeys(lab[order].tolist()));lab=np.array([keys.index(x)+1 for x in lab]);return tree,order,lab,np.array(scores)

def summary(c,tree,order,lab,profiles,tax,area,scores):
 k=int(lab.max());cnt=np.array([[(lab[area==r]==g).sum() for r in (1,2,3)] for g in range(1,k+1)])
 return dict(corr=c.astype('float32'),tree=tree,order=order+1,labels=lab,k=k,scores=scores,counts=cnt,profiles=np.array([profiles[lab==g].mean(0) for g in range(1,k+1)]),time=tax,silhouette=silhouette(np.clip(1-c,0,2),lab))

def align(ref,new):
 a=np.unique(ref);b=np.unique(new);tab=np.array([[np.sum((ref==x)&(new==y)) for y in b] for x in a]);ri,ci=linear_sum_assignment(-tab);mapping={b[j]:a[i] for i,j in zip(ri,ci)};return np.array([mapping.get(x,0) for x in new])

def cue_names(labels,profiles,tax):
 stats={}
 for g in np.unique(labels):
  p=profiles[labels==g].mean(0);early=p[(tax>=0)&(tax<1)].mean();stats[g]=(early-p[tax<0].mean(),p[tax>=3].mean()-early,p.mean())
 available=set(stats);exc=max(available,key=lambda x:stats[x][0]);available.remove(exc);sup=min(available,key=lambda x:stats[x][0]);available.remove(sup);late=max(available,key=lambda x:stats[x][1]);available.remove(late);lo,hi=sorted(available,key=lambda x:stats[x][2]);mapping={sup:1,lo:2,late:3,hi:4,exc:5}
 return np.array([mapping[x] for x in labels])

def orient(tree,labels):
 t=tree.copy();n=len(labels);key={i:(int(labels[i]),i) for i in range(n)}
 for k,row in enumerate(t):
  a,b=int(row[0]),int(row[1])
  if key[a]>key[b]:t[k,0],t[k,1]=b,a;a,b=b,a
  key[n+k]=min(key[a],key[b])
 return t,leaves_list(t)

def split_profiles(p,k,seed):
 if k<=1:return np.ones(len(p),int)
 centered=p-p.mean(1,keepdims=True);sd=centered.std(1,keepdims=True);z=np.divide(centered,sd,out=np.zeros_like(centered),where=sd>1e-12);best=None
 for run in range(32):
  centers,lab=kmeans2(z,k,iter=60,minit='++',seed=seed+run,missing='warn');inertia=float(((z-centers[lab])**2).sum())
  if len(np.unique(lab))==k and (best is None or inertia<best[0]):best=(inertia,lab.copy())
 if best is None:raise ValueError('Unable to form requested nonempty subtypes')
 lab=best[1];keys=sorted(np.unique(lab),key=lambda j:(np.argmax(p[lab==j].mean(0)),int(j)));return np.array([keys.index(x)+1 for x in lab])

def main():
 s=(APP/'data/core.js').read_text();units=json.loads(s[s.index('=')+1:].strip().rstrip(';'));n=len(units);assert n==1346
 area=np.array([{'S1':1,'M1':2,'M2':3}[u['area']] for u in units]);positions=np.array([[u['x'],u['y']] for u in units],dtype=float)
 source=validate_spike_root(DEFAULT_SPIKE_ROOT);fingerprint=source_fingerprint(DEFAULT_SPIKE_ROOT);print('Complete raw files verified',source,flush=True)
 x=build_sparse_raster_matrix(DEFAULT_SPIKE_ROOT);assert x.shape==(1346,160000);print('Rebuilt spike counts',x.shape,x.nnz,flush=True)
 cache=OUT/'paper_figure_03_numeric_audit.npz';prior=HERE/'figure3_provenance.json'
 use_cache=cache.exists() and prior.exists() and json.loads(prior.read_text())['sha256_raw_files']==fingerprint
 cue_trials=np.empty((80,n,120));full_sum=np.zeros((n,2000));smoothgram=np.zeros((n,n));smoothnorm=np.zeros(n)
 kernel=diags([np.ones(2000-abs(j),dtype='float64') for j in range(-2,3)],range(-2,3),shape=(2000,2000),format='csr')
 for t in range(80):
  q=x[:,t*2000:(t+1)*2000].astype(float);dense=q.toarray();full_sum+=dense;cue_trials[t]=dense[:,320:800].reshape(n,120,4).sum(2)*20
  if not use_cache:
   z=q@kernel;sm=np.asarray(z.sum(1)).ravel();ss=np.asarray(z.multiply(z).sum(1)).ravel()-sm*sm/2000;valid=ss>1e-10;inv=np.zeros(n);inv[valid]=np.sqrt(2000/ss[valid]);gram=(z@z.T).toarray()-np.outer(sm,sm)/2000;smoothgram+=gram*np.outer(inv,inv);smoothnorm[valid]+=2000
  if (t+1)%20==0:print('Rebuilt trial profiles',t+1,flush=True)
 sm=np.asarray(x.sum(1)).ravel().astype(float)
 if use_cache:
  cached=np.load(cache);raw=cached['raw'];smooth=cached['smooth'];np.testing.assert_allclose(cue_trials,cached['cue_trials']);print('Verified reuse of this analysis raw-source Pearson matrices',flush=True)
 else:
  ss=np.asarray(x.astype(float).multiply(x).sum(1)).ravel()-sm*sm/x.shape[1];norm=np.sqrt(np.maximum(ss,0));raw=(x.astype(float)@x.T).toarray()-np.outer(sm,sm)/x.shape[1];raw=np.divide(raw,np.outer(norm,norm),out=np.zeros_like(raw),where=np.outer(norm,norm)>1e-12);np.fill_diagonal(raw,1);raw=np.clip(raw,-1,1)
  den=np.sqrt(np.outer(smoothnorm,smoothnorm));smooth=np.divide(smoothgram,den,out=np.zeros_like(smoothgram),where=den>0);np.fill_diagonal(smooth,1);smooth=np.clip(smooth,-1,1)
 profiles=cue_trials.mean(0);tax=-1+(np.arange(120)+.5)/20;full=full_sum.reshape(n,500,4).sum(2)/80*20;fulltax=-5+(np.arange(500)+.5)/20
 cue=corr_dense(profiles);items={}
 for key,c,p,tax_ in [('cue',cue,profiles,tax),('raw',raw,full,fulltax),('smooth',smooth,full,fulltax)]:
  tree,order,lab,scores=fit(c)
  if key=='cue':lab=cue_names(lab,profiles,tax);tree,order=orient(tree,lab)
  items[key]=summary(c,tree,order,lab,p,tax_,area,scores);print(key,'requested K',int(lab.max()),'sizes',np.bincount(lab)[1:].tolist(),'silhouette',items[key]['silhouette'],flush=True)
 # Requested 16-subtype resolution, preserving the existing 5/1/3/1/6 allocation.
 # Memberships are refitted from normalized profiles, never reference neuron counts.
 major=items['cue']['labels'];sub=np.zeros(n,int);subnames=[];childk=[5,1,3,1,6];subaudit=[];counter=0
 for g in range(1,6):
  ids=np.flatnonzero(major==g);chosen=childk[g-1];assert len(ids)>=chosen
  ll=split_profiles(profiles[ids],chosen,SEED+g*100)
  for j in range(1,chosen+1):counter+=1;sub[ids[ll==j]]=counter;subnames.append(f'C{g}{chr(96+j)}')
  subaudit.append({'major':g,'specified_k':chosen,'actual_counts':np.bincount(ll)[1:].tolist()})
 print('Subtypes',counter,childk,flush=True)
 # Session-block bootstrap: redraw 20 blocks of four trials, keeping all neurons paired.
 rng=np.random.default_rng(SEED);recovery=np.zeros((NBOOT,counter));majrec=np.zeros((NBOOT,int(major.max())))
 for b in range(NBOOT):
  blocks=rng.integers(0,20,20);trials=(blocks[:,None]*4+np.arange(4)).ravel();cc=corr_dense(cue_trials[trials].mean(0));tt,_=tree_from(cc);ml=align(major,fcluster(tt,int(major.max()),criterion='maxclust'));sl=np.zeros(n,int)
  for g in range(1,int(major.max())+1):
   rid=np.flatnonzero(major==g);ids=np.flatnonzero(ml==g);actual=np.unique(sub[rid]);kk=min(childk[g-1],len(ids));ll=np.ones(len(ids),int)
   if kk>1:ll=split_profiles(cue_trials[trials].mean(0)[ids],kk,SEED+1000+b*100+g)
   if len(ids):
    tab=np.array([[np.sum((sub[ids]==a)&(ll==v)) for v in np.unique(ll)] for a in actual]);ri,ci=linear_sum_assignment(-tab);values=np.unique(ll)
    for i,j in zip(ri,ci):sl[ids[ll==values[j]]]=actual[i]
   union=np.sum((major==g)|(ml==g));majrec[b,g-1]=np.sum((major==g)&(ml==g))/union if union else 0
  for g in range(1,counter+1):recovery[b,g-1]=np.sum((sub==g)&(sl==g))/np.sum((sub==g)|(sl==g))
  if (b+1)%10==0:print('Block bootstrap',b+1,flush=True)
 subtype_order=np.lexsort((np.arange(n),np.argmax(profiles,axis=1),sub))
 counts=np.array([[(sub[area==r]==g).sum() for r in (1,2,3)] for g in range(1,counter+1)])
 items['subtypes']=dict(labels=sub,names=np.array(subnames,dtype=object),order=subtype_order+1,counts=counts,k=counter,profiles=np.array([profiles[sub==g].mean(0) for g in range(1,counter+1)]),time=tax,mean_hz=np.array([profiles[sub==g].mean() for g in range(1,counter+1)]),recovery_mean=recovery.mean(0),recovery_interval=np.percentile(recovery,[2.5,97.5],axis=0).T,bootstrap=recovery,child_k=np.array(childk))
 items['cue']['recovery_mean']=majrec.mean(0)
 # One undirected edge for the union of positive top-10 selections. No community-count target.
 sim=smooth.copy();np.fill_diagonal(sim,-np.inf);edges={}
 for i in range(n):
  ids=np.lexsort((np.arange(n),-sim[i]))[:10]
  for j in ids:
   if sim[i,j]>0:edges[tuple(sorted((i,int(j))))]=float(sim[i,j])
 G=nx.Graph();G.add_nodes_from(range(n));G.add_weighted_edges_from((i,j,w) for (i,j),w in edges.items());runs=[]
 coassign=np.zeros((n,n));run_ks=[]
 for seed in range(100):
  groups=list(nx.community.asyn_lpa_communities(G,weight='weight',seed=seed));run_ks.append(len(groups))
  for group in groups:
   ids=np.array(sorted(group));coassign[np.ix_(ids,ids)]+=1
 coassign/=100;tt,_=tree_from(coassign);labels=cut_tree(tt,n_clusters=8).ravel()+1;groups=sorted([set(np.flatnonzero(labels==k)) for k in np.unique(labels)],key=lambda x:(-len(x),min(x)));com=np.zeros(n,int)
 for k,ids in enumerate(groups,1):com[list(ids)]=k
 modularity=nx.community.modularity(G,groups,weight='weight');community_recovery=np.array([float((coassign[np.ix_(sorted(ids),sorted(ids))].sum()-len(ids))/(len(ids)*(len(ids)-1))) if len(ids)>1 else 1 for ids in groups])
 xy=nx.spring_layout(G,seed=SEED,weight='weight',iterations=150,method='force');xy=np.array([xy[i] for i in range(n)]);print('Graph',len(edges),'edges',len(groups),'communities, modularity',modularity,flush=True)
 degree=np.zeros(n);bridge=np.zeros(n);strength=np.zeros((3,3))
 for (i,j),w in edges.items():
  degree[i]+=w;degree[j]+=w;a=area[i]-1;b=area[j]-1;strength[a,b]+=w
  if a!=b:strength[b,a]+=w;bridge[i]+=w;bridge[j]+=w
 assert np.isclose(np.triu(strength).sum(),sum(edges.values()))
 items['graph']=dict(labels=com,k=len(groups),counts=np.array([[(com[area==r]==g).sum() for r in (1,2,3)] for g in range(1,len(groups)+1)]),xy=xy,edges=np.array([[i+1,j+1,w] for (i,j),w in edges.items()]),degree=degree,bridge=bridge,edge_strength=strength,hubs=np.argsort(-degree,kind='stable')[:8]+1,bridges=np.argsort(-bridge,kind='stable')[:8]+1,modularity=modularity,seed=SEED,consensus_recovery=community_recovery,run_community_counts=np.array(run_ks))
 items.update(area=area,positions=positions,unit_id=np.arange(n),source_spike_count=sm,full_rate_hz=sm/(80*25),cue_profiles_hz=profiles,bootstrap_count=NBOOT,source_fingerprint=fingerprint)
 savemat(HERE/'paper_figure3_data.mat',{'f3':items},do_compression=True,long_field_names=True)
 np.savez_compressed(OUT/'paper_figure_03_numeric_audit.npz',cue_trials=cue_trials,raw=raw,smooth=smooth,cue=cue,labels=major,subtypes=sub,graph_labels=com)
 manifest={'source':source,'sha256_raw_files':fingerprint,'sha256_core_js':hashlib.sha256((APP/'data/core.js').read_bytes()).hexdigest(),'n_units':n,'n_trials':80,'full_vector_bins':160000,'total_window_spikes':int(sm.sum()),'reference_inputs_used':False,'requested_resolution':{'major_classes':5,'subtypes':16,'subtype_allocation':[5,1,3,1,6],'communities':8},'resolution_is_prespecified':True,'group_selection':'Requested five-class average-linkage cut on 1-Pearson r. Silhouettes for K=2..10 are sensitivity diagnostics, not evidence that K=5 is optimal. Cue class names follow computed early excitation/suppression, late rise and mean rate.','subtype_selection':'Requested 16-subtype resolution allocated 5/1/3/1/6 to C1-C5. Refit 32-start k-means++ on row-standardized actual cue profiles; subtype letters ordered by computed prototype peak. Counts/memberships are not reference targets.','subtype_candidates':subaudit,'bootstrap':'50 session-block resamples of 20 four-trial blocks; major and subtype assignments refitted with selected counts fixed; Hungarian overlap alignment; Jaccard recovery. Intervals are resampling spread, not animal-level confidence intervals.','graph':'Union of positive top-10 Pearson neighbors; 100 weighted asynchronous label-propagation runs, seeds 0..99; average-linkage consensus coassignment cut to requested eight communities. Spring positions for display only.','normalization':'Each 25s trial standardized separately after centered 5-bin zero-padded moving sum. Constant trials contribute zeros.','partitions':{k:{'k':int(items[k]['k']),'sizes':items[k]['counts'].sum(1).tolist(),'silhouette':items[k]['silhouette'],'candidate_scores':items[k]['scores'].tolist()} for k in ['cue','raw','smooth']},'subtype_count':counter,'community_count':len(groups),'graph_edge_count':len(edges),'graph_modularity':modularity,'versions':{'numpy':np.__version__,'scipy':scipy.__version__,'networkx':nx.__version__},'scope':'one mouse; 20 recording blocks are not independent animals; functional similarity is not connectivity or causality','excluded_panel':'subtype-sorted z-score firing-rate map'}
 (HERE/'figure3_provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
 with (OUT/'paper_figure_03_source_units.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(['unit','area','x','y','window_spikes','full_window_hz','cue_class','cue_subtype','raw_class','normalized_class','community','weighted_degree','cross_region_weight'])
  for i in range(n):w.writerow([i,units[i]['area'],*positions[i],int(sm[i]),sm[i]/2000,major[i],subnames[sub[i]-1],items['raw']['labels'][i],items['smooth']['labels'][i],com[i],degree[i],bridge[i]])
 print('Saved MATLAB numeric inputs and provenance',flush=True)
if __name__=='__main__':main()
