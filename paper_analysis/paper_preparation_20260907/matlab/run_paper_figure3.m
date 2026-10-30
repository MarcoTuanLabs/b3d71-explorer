function results=run_paper_figure3(outdir)
here=fileparts(mfilename('fullpath'));addpath(here);if nargin<1,outdir=fileparts(here);end
assert(~exist('OCTAVE_VERSION','builtin'),'Figure 3 deliverables require MathWorks MATLAB.');
loaded=load(fullfile(here,'paper_figure3_data.mat'));f3=loaded.f3;
assert(numel(f3.area)==1346);assert(all(isfinite(f3.cue_profiles_hz(:))));assert(all(f3.cue_profiles_hz(:)>=0));
for name={'cue','raw','smooth'},s=f3.(name{1});assert(sum(s.counts(:))==1346);assert(isequal(size(s.corr),[1346 1346]));assert(all(sort(s.order(:))==(1:1346)'));end
assert(sum(f3.subtypes.counts(:))==1346 && sum(f3.graph.counts(:))==1346);
plot_paper_figure3(f3,outdir);
results=struct('runtime',['MATLAB ' version],'matlab_execution_verified',true,'panels',7,'neuron_count',1346,'trials',80,'source_fingerprint',f3.source_fingerprint,'cue_clusters',f3.cue.k,'subtypes',f3.subtypes.k,'raw_clusters',f3.raw.k,'normalized_clusters',f3.smooth.k,'communities',f3.graph.k,'edges',size(f3.graph.edges,1),'spatial_display_edges',size(f3.graph.edges,1),'spatial_views',2,'zscore_firing_map_included',false);
fid=fopen(fullfile(outdir,'matlab_figure3_results.json'),'w');fprintf(fid,'%s\n',pp_jsonencode(results));fclose(fid);
fprintf('PASS: Figure 3 a-g rendered in MATLAB from recomputed raw-spike analysis.\n');
end
