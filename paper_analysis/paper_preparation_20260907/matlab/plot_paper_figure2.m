function plot_paper_figure2(data, outdir)
%PLOT_PAPER_FIGURE2 Draw every Paper Figure 2 panel from numerical source data.
% Compatible with MATLAB and GNU Octave; no Statistics Toolbox is required.
% Data contract (class order is always regular/broad, fast/narrow):
% fig2a: time_ms, mean/sd [sample x class], class_n, features [t2p ratio class].
%         Optional samples{class} contains individual normalized waveforms.
% fig2b: counts [All/S1/M1/M2 x class], omnibus_p, pairwise_p (Holm adjusted;
%         ordered S1-M1, S1-M2, M1-M2).
% fig2c: time_s, mean_hz [S1regular M1regular M2regular S1fast M1fast M2fast],
%         points [peak_latency_s signed_delta_hz area_code class_code].
% fig2d: counts [scope x class x response], raw_p [All S1 M1 M2].
% Figure 2c has exactly two data axes. Its top panel mirrors the positive
% fast-spiking rate below zero; its bottom panel retains true signed delta Hz.

    if ~exist(outdir, 'dir'), mkdir(outdir); end
    c.area = [59 126 161; 182 92 80; 90 143 98] / 255;
    c.response = [217 95 69; 63 109 168; 146 153 166] / 255;
    % Waveform panels share 2d's red/blue solid fills and white bar labels.
    c.wave = c.response(1:2,:);
    draw_2a(data.fig2a, outdir, c);
    draw_2b(data.fig2b, outdir, c);
    draw_2c(data.fig2c, outdir, c);
    draw_2d(data.fig2d, outdir, c);
end

function fig = pp_fig(height)
    fig = figure('Visible', 'off', 'Color', 'w', 'Units', 'inches', ...
        'Position', [0.5 0.5 8.5 height], 'PaperUnits', 'inches', ...
        'PaperPosition', [0 0 8.5 height], 'PaperSize', [8.5 height]);
end

function ax = pp_axes(fig, pos)
    ax = axes('Parent', fig, 'Position', pos, 'FontName', 'Arial', ...
        'FontSize', 8, 'LineWidth', 0.7, 'Box', 'off', ...
        'XColor', [0 0 0], 'YColor', [0 0 0], 'TickDir', 'out', ...
        'Tag', 'pp_data_axes');
    hold(ax, 'on');
end

function pp_text(fig, pos, label, size_, bold)
    weight = 'normal';
    if bold, weight = 'bold'; end
    annotation(fig, 'textbox', pos, 'String', label, 'EdgeColor', 'none', ...
        'Margin', 0.1, 'FontName', 'Arial', 'FontSize', size_, ...
        'FontWeight', weight, 'Color', [0 0 0], 'Interpreter', 'none', ...
        'VerticalAlignment', 'middle');
end

function pp_swatch(fig, x, y, rgb, label, width_)
    annotation(fig, 'rectangle', [x y+0.005 0.020 0.023], ...
        'FaceColor', rgb, 'Color', rgb);
    pp_text(fig, [x+0.028 y width_ 0.035], label, 8, false);
end

function draw_2a(d, outdir, c)
    fig = pp_fig(6.5);
    pp_text(fig, [0.025 0.937 0.035 0.035], 'a', 14, true);
    pp_text(fig, [0.090 0.936 0.88 0.041], 'Extracellular waveform classes', 13, true);
    pp_text(fig, [0.090 0.891 0.88 0.032], ...
        'Normalized waveforms and continuous features | operational 0.4-ms split', 8, false);
    positions = [0.10 0.585 0.375 0.225; 0.575 0.585 0.375 0.225];
    order = [2 1];
    names = {'Regular / broad', 'Fast / narrow'};
    t = d.time_ms(:);
    for j = 1:2
        k = order(j);
        ax = pp_axes(fig, positions(j,:));
        lo = max(-1.05, d.mean(:,k) - d.sd(:,k));
        hi = min(1.05, d.mean(:,k) + d.sd(:,k));
        patch('Parent', ax, 'XData', [t; flipud(t)], 'YData', [lo; flipud(hi)], ...
            'FaceColor', 0.76+0.24*c.wave(k,:), 'EdgeColor', 'none');
        if isfield(d, 'samples') && iscell(d.samples) && ~isempty(d.samples{k})
            light = 0.72 + 0.28*c.wave(k,:);
            plot(ax, t, d.samples{k}, 'Color', light, 'LineWidth', 0.35);
        end
        plot(ax, [-1.25 1.2], [0 0], '-', 'Color', [0.78 0.78 0.78], 'LineWidth', 0.6);
        plot(ax, [0 0], [-1.05 1.05], '--', 'Color', [0.45 0.45 0.45], 'LineWidth', 0.6);
        plot(ax, t, d.mean(:,k), 'Color', c.wave(k,:), 'LineWidth', 1.9);
        set(ax, 'XLim', [-1.25 1.20], 'YLim', [-1.05 1.05], ...
            'XTick', [-1 0 1], 'YTick', [-1 0 1]);
        title(ax, sprintf('%s | n = %d', names{k}, d.class_n(k)), ...
            'Color', 'k', 'FontSize', 9, 'FontWeight', 'bold');
        xlabel(ax, 'Time from trough (ms)', 'FontSize', 9);
        if j == 1, ylabel(ax, 'Normalized waveform', 'FontSize', 9); end
    end
    ax = pp_axes(fig, [0.10 0.145 0.85 0.305]);
    for k = 1:2
        p = d.features(d.features(:,3)==k,:);
        scatter(ax, p(:,1), p(:,2), 12, c.wave(k,:), 'filled', ...
            'MarkerEdgeColor', 'w', 'LineWidth', 0.2);
    end
    yl = ylim(ax);
    plot(ax, [0.4 0.4], yl, '--', 'Color', [0.2 0.2 0.2], 'LineWidth', 0.9);
    set(ax, 'XLim', [0.1 1.02], 'YLim', yl);
    text(ax, 0.414, yl(2)-0.08*diff(yl), '0.4-ms cutoff', 'FontSize', 8, 'Color', 'k');
    xlabel(ax, 'Trough-to-peak duration (ms)', 'FontSize', 9);
    ylabel(ax, 'Post-peak / |trough| ratio', 'FontSize', 9);
    pp_swatch(fig, 0.51, 0.465, c.wave(1,:), names{1}, 0.18);
    pp_swatch(fig, 0.755, 0.465, c.wave(2,:), names{2}, 0.18);
    pp_text(fig, [0.10 0.035 0.87 0.030], ...
        'Waveform classes describe extracellular phenotypes; they do not establish cell identity.', 7.3, false);
    pp_export(fig, 'paper_figure_02a_waveform_classes', outdir);
    close(fig);
end

function draw_2b(d, outdir, c)
    fig = pp_fig(7.2);
    scopes = {'All', 'S1', 'M1', 'M2'};
    pp_text(fig, [0.025 0.936 0.035 0.040], 'b', 14, true);
    pp_text(fig, [0.080 0.936 0.89 0.040], 'Waveform-class composition across areas', 13, true);
    pp_text(fig, [0.080 0.887 0.88 0.031], ...
        'Within-area percentages inside each segment | total neuron count above each bar', 9, false);
    pp_swatch(fig, 0.080, 0.835, c.wave(1,:), 'Regular / broad', 0.22);
    pp_swatch(fig, 0.370, 0.835, c.wave(2,:), 'Fast / narrow', 0.22);
    bar_width = 0.184 * 0.64 / 2.16;
    previous_pitch = 0.850 / 4.2;
    half_gap = (previous_pitch-bar_width)/2;
    pitch = bar_width+half_gap;
    centers = 0.530+(-1.5:1.5)*pitch;
    awidth = 0.120;
    for j = 1:4
        ax = pp_axes(fig, [centers(j)-awidth/2 0.210 awidth 0.600]);
        set(ax, 'FontSize', 9.5, 'XLim', [-0.5 0.5], 'YLim', [0 112], ...
            'XTick', 0, 'XTickLabel', scopes(j), 'YTick', [], 'YColor', 'none');
        counts = double(d.counts(j,:));
        n = sum(counts);
        p = 100*counts/n;
        pp_stack(ax, 0, p, c.wave, bar_width/awidth, 0);
        text(ax, 0, 106, sprintf('n = %d', n), ...
            'HorizontalAlignment', 'center', 'VerticalAlignment', 'middle', ...
            'FontName', 'Arial', 'FontSize', 8.5, 'Color', 'k');
    end
    stat = sprintf('Regional omnibus: 3 x 2 Pearson chi-square, P = %s.', pp_p(d.omnibus_p));
    pp_text(fig, [0.105 0.141 0.87 0.031], stat, 8.5, false);
    if isfield(d, 'pairwise_p') && numel(d.pairwise_p)==3
        stat = sprintf('Two-sided Fisher + Holm: S1-M1 P = %s; S1-M2 P = %s; M1-M2 P = %s.', ...
            pp_p(d.pairwise_p(1)), pp_p(d.pairwise_p(2)), pp_p(d.pairwise_p(3)));
        pp_text(fig, [0.105 0.094 0.87 0.031], stat, 8.0, false);
    end
    pp_text(fig, [0.105 0.043 0.87 0.031], ...
        'All pools S1, M1 and M2. These neuron-level comparisons describe this mouse, not animal-level effects.', 7.8, false);
    pp_export(fig, 'paper_figure_02b_waveform_composition', outdir);
    close(fig);
end

function draw_2c(d, outdir, c)
    fig = pp_fig(8.0);
    pp_text(fig, [0.025 0.947 0.035 0.033], 'c', 14, true);
    pp_text(fig, [0.110 0.945 0.86 0.040], 'Cue-response timing by waveform class and area', 13, true);
    pp_text(fig, [0.110 0.910 0.86 0.028], ...
        'Six population traces | one point per cue-modulated neuron | descriptive plots', 8, false);
    pp_swatch(fig, 0.110, 0.863, c.area(1,:), 'S1', 0.06);
    pp_swatch(fig, 0.230, 0.863, c.area(2,:), 'M1', 0.06);
    pp_swatch(fig, 0.350, 0.863, c.area(3,:), 'M2', 0.06);
    pp_text(fig, [0.110 0.815 0.86 0.030], 'Mean firing rate over cue-relative latency', 10, true);
    ax = pp_axes(fig, [0.110 0.535 0.845 0.260]);
    maxrate = max(d.mean_hz(:));
    extent = max(10, 10*ceil(maxrate/10));
    set(ax, 'XLim', [-1 4], 'YLim', [-extent extent], ...
        'XTick', [-1 0 1 2 3 4], 'YTick', [-extent -extent/2 0 extent/2 extent]);
    set(ax, 'YTickLabel', {num2str(extent), num2str(extent/2), '0', num2str(extent/2), num2str(extent)});
    plot(ax, [-1 4], [0 0], '-', 'Color', [0.25 0.25 0.25], 'LineWidth', 0.85);
    plot(ax, [0 0], [-extent extent], '--', 'Color', [0.55 0.55 0.55], 'LineWidth', 0.7);
    for r = 1:3
        plot(ax, d.time_s(:), d.mean_hz(:,r), 'Color', c.area(r,:), 'LineWidth', 1.7);
        plot(ax, d.time_s(:), -d.mean_hz(:,r+3), 'Color', c.area(r,:), 'LineWidth', 1.7);
    end
    % The x-axis at zero separates the two mirrored waveform classes.
    % Numeric latency labels sit below the plot so they cannot collide with
    % low-rate fast-spiking traces immediately below the central zero line.
    set(ax, 'XAxisLocation', 'origin', 'XTickLabel', []);
    for tick = -1:4
        text(ax, (tick+1)/5, -0.037, sprintf('%d', tick), 'Units', 'normalized', ...
            'HorizontalAlignment', 'center', 'VerticalAlignment', 'top', ...
            'FontSize', 8, 'Color', 'k', 'Clipping', 'off');
    end
    ylabel(ax, 'Mirrored mean firing rate (Hz)', 'FontSize', 9);
    xlabel(ax, 'Latency from cue (s)', 'FontSize', 9, 'Units', 'normalized', 'Position', [0.5 -0.205 0]);
    text(ax, 0.97, 0.94, 'Regular / broad', 'Units', 'normalized', ...
        'HorizontalAlignment', 'right', 'VerticalAlignment', 'top', ...
        'FontSize', 8, 'FontWeight', 'bold', 'Color', 'k');
    text(ax, 0.97, 0.06, 'Fast / narrow (mirrored)', 'Units', 'normalized', ...
        'HorizontalAlignment', 'right', 'VerticalAlignment', 'bottom', ...
        'FontSize', 8, 'FontWeight', 'bold', 'Color', 'k');
    pp_text(fig, [0.110 0.451 0.86 0.026], ...
        'Lower traces are reflected below zero for display; tick labels give the actual positive rate.', 7.4, false);
    pp_text(fig, [0.110 0.405 0.45 0.030], 'Firing-rate change versus peak latency', 10, true);
    ax = pp_axes(fig, [0.110 0.135 0.845 0.248]);
    p = d.points;
    yr = [min(p(:,2)) max(p(:,2))];
    yr = yr + [-1 1] * 0.08 * diff(yr);
    plot(ax, [-1 4], [0 0], '-', 'Color', [0.30 0.30 0.30], 'LineWidth', 0.8);
    plot(ax, [0 0], yr, '--', 'Color', [0.65 0.65 0.65], 'LineWidth', 0.7);
    for k = 1:2
        for r = 1:3
            q = p(p(:,3)==r & p(:,4)==k,:);
            if k == 1
                scatter(ax, q(:,1), q(:,2), 18, c.area(r,:), 'o', 'filled', ...
                    'MarkerEdgeColor', 'w', 'LineWidth', 0.3);
            else
                scatter(ax, q(:,1), q(:,2), 25, c.area(r,:), 'd', 'filled', ...
                    'MarkerEdgeColor', [0.12 0.12 0.12], 'LineWidth', 0.45);
            end
        end
    end
    set(ax, 'XLim', [-1 4], 'YLim', yr, 'XTick', [-1 0 1 2 3 4], 'YTick', [-20 0 20 40]);
    xlabel(ax, 'Peak firing latency from cue (s)', 'FontSize', 9);
    ylabel(ax, '\Delta firing rate (Hz)', 'FontSize', 9, 'Interpreter', 'tex');
    % Text-only marker key avoids hiding any of the observed points.
    pp_text(fig, [0.565 0.405 0.39 0.030], 'Circles: regular   Diamonds: fast', 7.4, false);
    pp_text(fig, [0.110 0.047 0.86 0.026], ...
        'Delta rate = mean 0-3 s rate - mean -5-0 s rate. Points retain their measured sign and latency.', 7.0, false);
    pp_text(fig, [0.110 0.022 0.86 0.023], ...
        'Lines: neuron-mean PSTH, 50-ms Gaussian smoothing. No statistical comparisons are displayed.', 7.0, false);
    pp_export(fig, 'paper_figure_02c_waveform_latency', outdir);
    close(fig);
end

function draw_2d(d, outdir, c)
    % True interval omission within excited segments. The retained upper
    % excited piece remains larger than either other class in every bar.
    fig = pp_fig(9.5);
    scopes = {'All', 'S1', 'M1', 'M2'};
    cut_high = [30 54 26 11]; cut_low = 5; gap = 2;
    pp_text(fig, [0.025 0.949 0.035 0.034], 'd', 14, true);
    pp_text(fig, [0.080 0.949 0.89 0.034], 'Cue-response composition by waveform class', 13, true);
    pp_text(fig, [0.080 0.914 0.89 0.026], ...
        'Two-sided Fisher exact test | Holm correction across four scopes | broken y-axes', 9, false);
    pp_swatch(fig, 0.080, 0.873, c.response(1,:), 'Cue-excited', 0.17);
    pp_swatch(fig, 0.325, 0.873, c.response(2,:), 'Cue-suppressed', 0.20);
    pp_swatch(fig, 0.610, 0.873, c.response(3,:), 'Unmodulated', 0.20);
    for j = 1:4
        ax = pp_axes(fig, [0.115+(j-1)*0.218 0.145 0.184 0.590]);
        hi = cut_high(j); top = 100-(hi-cut_low)+gap;
        counts = double(reshape(d.counts(j,:,:), [2 3]));
        n = sum(counts,2); proportions=100*counts./n;
        set(ax, 'FontSize', 9.5, 'XLim', [0.42 2.58], 'YLim', [0 top], ...
            'XTick', [1 2], 'XTickLabel', {'Regular', 'Fast'}, 'YTick', [], 'YColor', 'none');
        set(ax, 'UserData', struct('scope',scopes{j},'cut_percent',[cut_low hi], ...
            'break_gap_display',gap,'source_percentages',proportions));
        for k = 1:2
            p=proportions(k,:);
            assert(p(1)-hi>max(p(2:3)), ...
                'Retained continuous excited block must remain visually largest.');
            pp_broken_stack(ax,k,p,c.response,0.64,cut_low,hi,gap);
            text(ax,k,top*1.040,sprintf('n = %d',n(k)), 'FontSize',8.5, ...
                'HorizontalAlignment','center','VerticalAlignment','middle','Color','k');
        end
        % Draw the y-axis in two pieces, with matching breaks through bars.
        plot(ax,[0.42 0.42],[0 cut_low],'k-','LineWidth',0.7);
        plot(ax,[0.42 0.42],[cut_low+gap top],'k-','LineWidth',0.7);
        pp_break_mark(ax,0.42,cut_low+gap/2);
        ticks=unique([0 hi 25 50 75 100]);
        ticks=ticks(ticks<=cut_low | ticks>=hi);
        for tick=ticks
            y=pp_break_map(tick,cut_low,hi,gap);
            plot(ax,[0.375 0.42],[y y],'k-','LineWidth',0.7,'Clipping','off');
            text(ax,0.32,y,sprintf('%g',tick),'FontSize',8,'Color','k', ...
                'HorizontalAlignment','right','VerticalAlignment','middle','Clipping','off');
        end
        if j==1
            ylabel(ax,'Cue-response composition (%)','FontSize',10,'Color','k', ...
                'Units','normalized','Position',[-0.37 0.5 0]);
        end
        plot(ax,[1 1 2 2],top*[1.074 1.095 1.095 1.074],'k-','LineWidth',0.8,'Clipping','off');
        text(ax,1.5,top*1.145,paper_significance_stars(d.adjusted_p(j)), ...
            'FontSize',14,'FontWeight','bold','HorizontalAlignment','center', ...
            'VerticalAlignment','middle','Interpreter','none','Color','k');
        text(ax,1.5,top*1.208,sprintf('%s | n = %d',scopes{j},sum(n)), ...
            'FontSize',10,'FontWeight','bold','HorizontalAlignment','center', ...
            'VerticalAlignment','middle','Color','k');
    end
    pp_text(fig,[0.115 0.093 0.84 0.022], ...
        'Omitted y ranges: All 5-30%; S1 5-54%; M1 5-26%; M2 5-11%. Labels give actual percentages.',7.5,false);
    pp_text(fig,[0.115 0.064 0.84 0.022], ...
        'Breaks differ by area; compare printed percentages. The size ranking of all three response classes is preserved.',7.5,false);
    pp_text(fig,[0.115 0.035 0.84 0.022], ...
        'Holm-adjusted P: * < 0.05; ** < 0.01; *** < 0.001; **** < 0.0001; ns >= 0.05.',7.5,false);
    pp_export(fig,'paper_figure_02d_response_by_waveform',outdir);
    close(fig);
end

function y = pp_break_map(raw,lo,hi,gap)
    y=raw;
    y(raw>=hi)=raw(raw>=hi)-(hi-lo)+gap;
    y(raw>lo & raw<hi)=NaN;
end

function pp_break_mark(ax,x,y)
    for offset=[-0.32 0.32]
        plot(ax,x+[-0.045 0.045],y+offset+[-0.22 0.22], ...
            'k-','LineWidth',0.8,'Clipping','off','Tag','pp_axis_break');
    end
end

function pp_broken_stack(ax,x,p,colors,width_,lo,hi,gap)
    edges=[0 cumsum(p)];
    for r=1:3
        pieces=[edges(r) min(edges(r+1),lo); max(edges(r),hi) edges(r+1)];
        longest=-Inf; label_y=NaN;
        for part=1:2
            a=pieces(part,1);b=pieces(part,2);
            if b<=a, continue; end
            ya=pp_break_map(a,lo,hi,gap);yb=pp_break_map(b,lo,hi,gap);
            patch('Parent',ax,'XData',x+[-1 1 1 -1]*width_/2,'YData',[ya ya yb yb], ...
                'FaceColor',colors(r,:),'EdgeColor','w','LineWidth',0.7, ...
                'UserData',struct('bar',x,'response',r,'source_interval',[a b]));
            if b-a>longest, longest=b-a;label_y=(ya+yb)/2;end
        end
        font=9.5;if p(r)<2,font=8.5;end
        text(ax,x,label_y,sprintf('%.1f%%',p(r)),'FontName','Arial','FontSize',font, ...
            'FontWeight','bold','Color','w','HorizontalAlignment','center', ...
            'VerticalAlignment','middle','Tag','pp_segment_percentage', ...
            'UserData',struct('bar',x,'response',r,'true_percentage',p(r)));
    end
    top=pp_break_map(100,lo,hi,gap);
    for piece=[0 lo;lo+gap top]'
        plot(ax,x+[-1 1 1 -1 -1]*width_/2,[piece(1) piece(1) piece(2) piece(2) piece(1)], ...
            '-','Color',[0.25 0.25 0.25],'LineWidth',0.55);
    end
    pp_break_mark(ax,x-width_/2,lo+gap/2);
    pp_break_mark(ax,x+width_/2,lo+gap/2);
end

function pp_stack(ax, xpos, heights, colors, width_, minlabel, maxlabel)
    if nargin < 7, maxlabel = Inf; end
    base = 0;
    for k = 1:numel(heights)
        value = heights(k);
        patch('Parent', ax, 'XData', xpos+[-1 1 1 -1]*width_/2, ...
            'YData', [base base base+value base+value], 'FaceColor', colors(k,:), ...
            'EdgeColor', 'w', 'LineWidth', 0.7);
        if value >= minlabel && value < maxlabel
            labelsize = 9.5;
            text(ax, xpos, base+value/2, sprintf('%.1f%%', value), ...
                'HorizontalAlignment', 'center', 'VerticalAlignment', 'middle', ...
                'FontName', 'Arial', 'FontSize', labelsize, 'FontWeight', 'bold', 'Color', 'w', ...
                'Tag', 'pp_segment_percentage');
        end
        base = base + value;
    end
    plot(ax, xpos+[-1 1 1 -1 -1]*width_/2, [0 0 100 100 0], ...
        '-', 'Color', [0.25 0.25 0.25], 'LineWidth', 0.55);
end

function label = pp_p(p)
    if ~isfinite(p)
        label = 'NA';
    elseif p < 0.001
        label = sprintf('%.2g', p);
    else
        label = sprintf('%.3f', p);
    end
end
