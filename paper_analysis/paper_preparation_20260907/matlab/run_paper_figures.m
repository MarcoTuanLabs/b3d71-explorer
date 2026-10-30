function results = run_paper_figures(outdir)
%RUN_PAPER_FIGURES Reproduce every Paper Figures 1–3 from numeric data.
% MATLAB: addpath('path/to/matlab'); run_paper_figures;
% Octave: octave --no-gui --eval "addpath('path/to/matlab'); run_paper_figures"
% Optional outdir is useful for staging and visual QA before website release.
here=fileparts(mfilename('fullpath'));
addpath(here);
if nargin<1 || isempty(outdir), outdir=fileparts(here); end
loaded=load(fullfile(here,'paper_source_data.mat'));
data=loaded.data;
assert(numel(data.area_code)==1346);
assert(sum(data.fig2b.counts(1,:))==1346);
assert(isequal(size(data.fig2c.mean_hz),[200 6]));
assert(all(isfinite(data.fig2c.mean_hz(:))) && all(data.fig2c.mean_hz(:)>=0));
assert(size(data.fig2c.points,1)==1074);
assert(isequal(size(data.fig2d.counts),[4 2 3]));
assert(all(abs(sum(data.f1a.percentages,1)-100)<1e-6));
stats=paper_composition_stats(data.area_code,data.wave_code,data.response_code);
data.fig2b.omnibus_p=stats.stat2b.p;
data.fig2b.chi2=stats.stat2b.chi2;
data.fig2b.cramers_v=stats.stat2b.V;
data.fig2b.pairwise_p=stats.stat2b.pairwise_p_holm;
data.fig2d.raw_p=stats.stat2d.p_raw;
data.fig2d.adjusted_p=stats.stat2d.p_holm;
plot_paper_figure1(data,outdir);
plot_paper_figure2(data,outdir);
figure3=run_paper_figure3(outdir);
results=struct('statistics',stats,'source_data','paper_source_data.mat', ...
    'drawn_by','MATLAB .m plotting programs','neuron_count',1346, ...
    'figure3',figure3,'panel_count',14,'fig2c_plot_count',2,'fig2c_trace_count',6,'fig2c_point_count',1074);
if exist('OCTAVE_VERSION','builtin')
    results.runtime=['GNU Octave ' OCTAVE_VERSION];
    results.matlab_execution_verified=false;
else
    results.runtime=['MATLAB ' version];
    results.matlab_execution_verified=true;
end
fid=fopen(fullfile(outdir,'matlab_render_results.json'),'w');
fprintf(fid,'%s\n',pp_jsonencode(results)); fclose(fid);
save(fullfile(outdir,'paper_statistics.mat'),'stats','-v7');
fprintf('PASS: all 14 panels exported; 2c contains two plots, six mean-rate traces,1074 neurons.\n');
end
