#!/usr/bin/env python3
"""Prepare numeric source arrays only; every figure is drawn by the .m files.
Run with Python + numpy/pandas/scipy. Source provenance is saved beside the MAT.
"""
import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.io import savemat

HERE=Path(__file__).resolve().parent
OUT=HERE.parent
APP=OUT.parents[1]

def assigned(path):
    return json.loads(path.read_text().split('=',1)[1].strip().rstrip(';'))

third=assigned(APP/'data/figure_reconstruction_third_draft.js')
units=assigned(APP/'data/core.js')
metrics=pd.DataFrame(third['metrics']).sort_values('id')
assert len(metrics)==1346 and list(metrics.id)==list(range(1346))
area=metrics.area.map({'S1':1,'M1':2,'M2':3}).to_numpy()
wave=metrics.wave.map({'Broad':1,'Fast/Narrow':2}).to_numpy()
response=metrics.responseClass.map({'Cue-excited':1,'Cue-suppressed':2,'Unmodulated':3}).to_numpy()
scopes=['All','S1','M1','M2']
masks=[np.ones(1346,dtype=bool)]+[area==i for i in (1,2,3)]
counts=np.array([m.sum() for m in masks])
rate_table=pd.read_csv(OUT/'paper_figure_01a_source_units.csv')
hist=pd.read_csv(OUT/'paper_figure_01a_source_histograms.csv')
rates=rate_table.recorded_window_hz.to_numpy()
assert np.array_equal(rate_table.unit,np.arange(1346))
f1a={'edges_hz':np.r_[hist.bin_left_hz.to_numpy(),50.0],
     'percentages':hist[scopes].to_numpy(), 'counts':counts,
     'median_hz':np.array([np.median(rates[m]) for m in masks])}

centers=-5+(np.arange(1000)+.5)*.025
show=(centers>=-1)&(centers<5)
show2=(centers>=-1)&(centers<4)
base=(centers>=-5)&(centers<0)
kernel=np.exp(-.5*(np.arange(-6,7)/2.)**2)
norm=np.convolve(np.ones(1000),kernel,'same')
all_raw=np.empty((1346,1000))
odd_smoothed=np.empty((1346,1000))
even_smoothed=np.empty((1346,1000))
for i in range(1346):
    text=(APP/'data/units'/f'u{i}.js').read_text()
    detail=json.loads(text.split(f'window.UNIT_CACHE[{i}]=',1)[1].strip().rstrip(';'))
    assert detail['psthX0']==-5 and detail['psthDx']==.025
    all_raw[i]=detail['psth']
    t=np.asarray(detail['raster']['t']); tr=np.asarray(detail['raster']['tr'])
    bins=np.floor((t+5)/.025).astype(int)
    valid=(bins>=0)&(bins<1000)&(tr>=0)&(tr<80)
    parity=tr%2
    for par,destination in [(0,odd_smoothed),(1,even_smoothed)]:
        counts_i=np.bincount(bins[valid&(parity==par)],minlength=1000)
        destination[i]=np.convolve(counts_i/(40*.025),kernel,'same')/norm
odd_mean=odd_smoothed[:,base].mean(axis=1)
odd_sd=np.maximum(odd_smoothed[:,base].std(axis=1,ddof=1),.05)
odd_z=(odd_smoothed[:,show]-odd_mean[:,None])/odd_sd[:,None]
even_z=(even_smoothed[:,show]-odd_mean[:,None])/odd_sd[:,None]
even_delta=even_smoothed[:,show]-odd_mean[:,None]
peak=np.argmax(odd_z,axis=1)
heatmaps=np.empty((1,4),dtype=object)
ordered_ids=np.empty((1,4),dtype=object)
means=np.empty((show.sum(),3,4)); sem=np.empty_like(means)
for c,m in enumerate(masks):
    ids=np.flatnonzero(m); ids=ids[np.lexsort((ids,peak[ids]))]
    heatmaps[0,c]=even_z[ids]
    ordered_ids[0,c]=ids
    for r in range(1,4):
        vals=even_delta[m&(response==r)]
        means[:,r-1,c]=vals.mean(axis=0)
        sem[:,r-1,c]=vals.std(axis=0,ddof=1)/np.sqrt(len(vals))
f1b={'time_s':centers[show], 'heatmaps':heatmaps, 'counts':counts,
     'trace_mean':means,'trace_sem':sem,'ordered_ids_zero_based':ordered_ids}
points=pd.read_csv(OUT/'paper_figure_01c_source_points.csv')
fits=pd.read_csv(OUT/'paper_figure_01c_source_fits.csv')
amp=np.empty((2,4)); scale=np.empty_like(amp)
for c,scope in enumerate(scopes):
    for r,cls in enumerate(['Cue-excited','Cue-suppressed']):
        row=fits[(fits.scope==scope)&(fits.response_class==cls)].iloc[0]
        amp[r,c]=row.amplitude_hz; scale[r,c]=row.scale_hz
f1c={'baseline_odd_hz':points.baseline_odd_hz.to_numpy(),
     'modulation_even_hz':points.modulation_even_hz.to_numpy(),
     'area_code':area,'response_code':response,'fit_amplitude_hz':amp,'fit_scale_hz':scale,
     'xmax':float(max(30,points.baseline_odd_hz.max()*1.05)),
     'ymax':float(max(20,points.modulation_even_hz.abs().max()*1.05))}

waveforms=np.asarray([u['wf'] for u in units])
samples=np.empty((1,2),dtype=object)
wave_mean=[];wave_sd=[];wave_n=[]
for w in (1,2):
    matrix=waveforms[wave==w]
    wave_mean.append(matrix.mean(axis=0));wave_sd.append(matrix.std(axis=0,ddof=1));wave_n.append(len(matrix))
    rng=np.random.default_rng(20260917+w)
    samples[0,w-1]=matrix[np.sort(rng.choice(len(matrix),min(70,len(matrix)),replace=False))].T
fig2a={'time_ms':(np.arange(waveforms.shape[1])-41)/32.,'mean':np.array(wave_mean).T,
       'sd':np.array(wave_sd).T,'class_n':np.array(wave_n),'samples':samples,
       'features':np.c_[[u['t2p'] for u in units],[u['ratio'] for u in units],wave]}
wave_counts=np.array([[(m&(wave==w)).sum() for w in (1,2)] for m in masks])
response_counts=np.array([[[(m&(wave==w)&(response==r)).sum() for r in (1,2,3)] for w in (1,2)] for m in masks])
mean_hz=[]
for w in (1,2):
    for a in (1,2,3):
        raw_mean=all_raw[(wave==w)&(area==a)].mean(axis=0)
        mean_hz.append((np.convolve(raw_mean,kernel,'same')/norm)[show2])
active=response!=3
fig2c={'time_s':centers[show2], 'mean_hz':np.array(mean_hz).T,
       'points':np.c_[metrics.peakLatency.to_numpy()[active],metrics.cueDelta.to_numpy()[active],area[active],wave[active]],
       'point_ids_zero_based':metrics.id.to_numpy()[active]}

data={'f1a':f1a,'f1b':f1b,'f1c':f1c,'fig2a':fig2a,
      'fig2b':{'counts':wave_counts},'fig2c':fig2c,'fig2d':{'counts':response_counts},
      'area_code':area,'wave_code':wave,'response_code':response}
savemat(HERE/'paper_source_data.mat',{'data':data},do_compression=True,oned_as='column')
provenance={
 'n_neurons':1346,'n_trials':80,'area_order':scopes,'wave_order':['Broad','Fast/Narrow'],
 'response_order':['Cue-excited','Cue-suppressed','Unmodulated'],
 'drawing_engine':'MATLAB .m source; numeric preprocessing only in this Python script',
 'figure1a':'Existing recorded-window Hz source CSV and common 0:2.5:50 bins; redraw, not image copy.',
 'figure1b':'Recomputed from native rasters: odd-numbered 40 trials fit pre-cue mean/SD and row order; frozen transforms apply to even-numbered 40 trials. Even-trial traces subtract odd baseline. Response classes are the archived all-80-trial paired-t/BH labels, not independently held-out labels.',
 'figure1c':'Archived odd-baseline/even-modulation numeric points and descriptive robust fit coefficients; full data extents retained.',
 'figure2a':'Core normalized numeric waveforms/features; seeded70-neuron exemplar subset per class.',
 'figure2b':'Regional 3x2 waveform-class contingency counts; All is pooled descriptive only.',
 'figure2c':'All-80-trial raw PSTH means, Gaussian sigma50ms, native25ms bins. Regular +Hz, Fast -Hz for mirror display only. Scatter exact signed cueDelta and peak firing latency for1074 modulated neurons; no jitter/statistical overlays.',
 'figure2d':'Response composition for All/S1/M1/M2; two-sided Fisher exact tests compare excited versus non-excited counts by waveform class; MATLAB applies Holm across four displayed scopes; stars use adjusted P. Inference remains conditional at neuron level in one mouse; within-mouse dependence is not resolved. Four broken y-axes omit All 5-30%, S1 5-54%, M1 5-26%, M2 5-11%; 24 true percentages remain in bars; no detail row or numerical table.',
 'source_sha256':{f:hashlib.sha256((APP/f).read_bytes()).hexdigest() for f in ['data/core.js','data/figure_reconstruction_third_draft.js']},
}
(HERE/'data_provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
# Readable source exports for the new held-out traces and merged 2c.
trace_rows=[]
for s,scope in enumerate(scopes):
 for r,cls in enumerate(provenance['response_order']):
  for k,t in enumerate(centers[show]):
   trace_rows.append([scope,cls,t,means[k,r,s],sem[k,r,s]])
pd.DataFrame(trace_rows,columns=['scope','response_class','time_s','mean_hz','sem_hz']).to_csv(OUT/'paper_figure_01b_source_traces.csv',index=False)
print(json.dumps({'mat_file':str(HERE/'paper_source_data.mat'),'bytes':(HERE/'paper_source_data.mat').stat().st_size,
                  'heatmap_shapes':[list(v.shape) for v in heatmaps[0]],'fig2c_traces_shape':list(fig2c['mean_hz'].shape),
                  'fig2c_points':int(active.sum())},indent=2))
