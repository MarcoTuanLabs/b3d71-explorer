function check_native_figures()
here=fileparts(mfilename('fullpath'));
source=fullfile(here,'..','..','neuron_explorer','paper_analysis','paper_preparation_20260907','matlab');addpath(source);
loaded=load(fullfile(source,'paper_source_data.mat'));data=loaded.data;
files=dir(fullfile(here,'generated','*.fig'));assert(numel(files)==7);
stems={'paper_figure_02b_waveform_composition','paper_figure_02d_response_by_waveform'};
expected_counts=[8 24]; widths=cell(1,2);checked=struct([]);
for idx=1:2
 fig=openfig(fullfile(here,'generated',[stems{idx} '.fig']),'new','invisible');drawnow;
 labels=findall(fig,'Tag','pp_segment_percentage');assert(numel(labels)==expected_counts(idx));
 axeslist=findall(fig,'Tag','pp_data_axes');assert(numel(axeslist)==4);assert(isempty(findall(fig,'Tag','pp_detail_axes')));
 labelstrings=get(labels,'String');visible=0;minmargin=Inf;
 for k=1:numel(labels)
  label=labels(k);ax=ancestor(label,'axes');ext=get(label,'Extent');pos=get(ax,'Position');
  limx=get(ax,'XLim');limy=get(ax,'YLim');patches=findall(ax,'Type','patch');
  assert(all(get(label,'Color')==[1 1 1]) && ismember(get(label,'FontSize'),[8.5 9.5]));
  assert(strcmp(get(label,'FontWeight'),'bold'));
  inside=false;
  for j=1:numel(patches)
   xd=get(patches(j),'XData');yd=get(patches(j),'YData');
   if ext(1)>=min(xd) && ext(1)+ext(3)<=max(xd) && ext(2)>=max(min(yd),limy(1)) && ext(2)+ext(4)<=min(max(yd),limy(2))
    inside=true;
    figpos=get(fig,'Position');
    widths{idx}(end+1)=(max(xd)-min(xd))/diff(limx)*pos(3)*figpos(3)*72;
    minmargin=min(minmargin,min(ext(2)-max(min(yd),limy(1)),min(max(yd),limy(2))-ext(2)-ext(4))/diff(limy)*pos(4)*figpos(4)*72);
    break
   end
  end
  if ~inside, disp(struct('label',get(label,'String'),'extent',ext,'axis_limits',limy,'axes_position',pos,'figure_position',get(fig,'Position'),'paper_size',get(fig,'PaperSize'))); end
  assert(inside,['Label must fit entirely in a visible bar segment: ' get(label,'String')]);visible=visible+1;
 end
 if idx==1
  centers=[];barwidth=[];
  for ax=axeslist'
   assert(strcmp(get(ax,'YColor'),'none') && isempty(get(ax,'YTick')));
   patches=findall(ax,'Type','patch');pos=get(ax,'Position');limx=get(ax,'XLim');xd=get(patches(1),'XData');
   centers(end+1)=pos(1)+(mean([min(xd) max(xd)])-limx(1))/diff(limx)*pos(3);
   barwidth(end+1)=(max(xd)-min(xd))/diff(limx)*pos(3);
  end
  oldgap=.850/4.2-.184*.64/2.16;
  assert(max(abs(diff(sort(centers))-barwidth(1)-oldgap/2))<1e-10);
  counts=double(data.fig2b.counts);pct=100*counts./sum(counts,2);
 else
  assert(numel(findall(fig,'Tag','pp_axis_break'))==40);
  for ax=axeslist'
   info=get(ax,'UserData');patches=findall(ax,'Type','patch');
   for bar=1:2
    heights=zeros(1,3);longest=zeros(1,3);
    for pt=patches'
     meta=get(pt,'UserData');if meta.bar~=bar,continue;end
     y=get(pt,'YData');h=max(y)-min(y);heights(meta.response)=heights(meta.response)+h;longest(meta.response)=max(longest(meta.response),h);
    end
    actual=info.source_percentages(bar,:);
    assert(longest(1)>max(longest(2:3)));
    for a=1:3,for b=a+1:3,assert(sign(actual(a)-actual(b))==sign(heights(a)-heights(b)));end,end
   end
  end
  counts=double(data.fig2d.counts);pct=100*counts./sum(counts,3);
 end
 expected=arrayfun(@(v)sprintf('%.1f%%',v),pct(:),'UniformOutput',false);
 assert(isequal(sort(labelstrings(:)),sort(expected(:))));
 checked(idx).stem=stems{idx};checked(idx).labels=visible;checked(idx).all_labels_inside_visible_patches=true;checked(idx).minimum_vertical_margin_pt=minmargin;
 close(fig);
end
assert(max(abs(widths{1}-widths{2}(1)))<1e-8,'2b and 2d bar widths must be identical in points.');
report=struct('status','PASS','native_fig_files',numel(files),'bar_width_pt',widths{2}(1),'four_independent_axes_each',true,'gap_ratio_2b',0.5,'detail_axes_2d',0,'broken_axes_2d',4,'response_size_rank_preserved',true,'panels',checked);
fid=fopen(fullfile(here,'native_figure_qa.json'),'w');fprintf(fid,'%s\n',pp_jsonencode(report));fclose(fid);
disp('PASS: seven native MATLAB FIG files; all 32 percentage labels fully inside visible patches; common bar width/white font verified.');
end
