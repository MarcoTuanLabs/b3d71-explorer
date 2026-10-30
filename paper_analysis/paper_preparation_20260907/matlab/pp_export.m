function pp_export(fig, stem, outdir)
%PP_EXPORT Save plots drawn by MATLAB source as editable SVG, PDF, and PNG.
% Compatible with MATLAB and GNU Octave. Runtime provenance is explicit.
if exist(outdir,'dir')~=7, mkdir(outdir); end
set(fig,'PaperPositionMode','manual');
drawnow;
file = fullfile(outdir,stem);
if exist('OCTAVE_VERSION','builtin')
    engine = ['GNU Octave ' OCTAVE_VERSION ' executing MATLAB-compatible .m source'];
    print(fig,[file '.svg'],'-dsvg','-painters');
    print(fig,[file '.pdf'],'-dpdf','-painters');
    print(fig,[file '.png'],'-dpng','-r400');
else
    engine = ['MATLAB ' version];
    savefig(fig,[file '.fig']);
    print(fig,[file '.svg'],'-dsvg','-painters');
    print(fig,[file '.pdf'],'-dpdf','-painters');
    print(fig,[file '.png'],'-dpng','-r400');
end
for extension={'.svg','.pdf','.png'}
    infofile=dir([file extension{1}]);
    assert(~isempty(infofile) && infofile.bytes>1000, ['Export failed: ' file extension{1}]);
end
% Same figure at a compact review resolution, not a separately drawn preview.
qadir=fullfile(outdir,'qa');
if exist(qadir,'dir')~=7, mkdir(qadir); end
print(fig,fullfile(qadir,[stem '.png']),'-dpng','-r140');
info=struct('stem',stem,'engine',engine,'paper_size_inches',get(fig,'PaperSize'), ...
    'png_dpi',400,'line_objects',numel(findall(fig,'Type','line')), ...
    'patch_objects',numel(findall(fig,'Type','patch')), ...
    'data_axes_count',numel(findall(fig,'Tag','pp_data_axes')));
info.detail_axes_count=numel(findall(fig,'Tag','pp_detail_axes'));
info.segment_percentage_labels=numel(findall(fig,'Tag','pp_segment_percentage'));
if strcmp(stem,'paper_figure_02b_waveform_composition')
    assert(info.segment_percentage_labels==8,'Figure 2b must label all eight segments.');
elseif strcmp(stem,'paper_figure_02d_response_by_waveform')
    assert(info.segment_percentage_labels==24,'Figure 2d must label all 24 segments directly in bars.');
end
if strcmp(stem,'paper_figure_02c_waveform_latency')
    lines=findall(fig,'Type','line'); trace_count=0;
    for k=1:numel(lines)
        if numel(get(lines(k),'XData'))==200, trace_count=trace_count+1; end
    end
    info.mean_rate_trace_count=trace_count;
    assert(info.data_axes_count==2 && trace_count==6,'Figure2c must have exactly two axes and six mean-rate traces');
end
fid=fopen(fullfile(qadir,[stem '_render.json']),'w');
fprintf(fid,'%s\n',pp_jsonencode(info)); fclose(fid);
fprintf('Exported %s [%s]\n',stem,engine);
end
