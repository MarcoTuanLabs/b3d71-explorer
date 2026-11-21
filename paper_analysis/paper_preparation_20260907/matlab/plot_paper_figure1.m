function plot_paper_figure1(data, outdir)
%PLOT_PAPER_FIGURE1 Draw paper Figure 1a-c entirely in MATLAB.
% All figure content is generated from numeric arrays, including heatmaps.
% Required input contract (scope order is All, S1, M1, M2):
%   data.f1a.edges_hz          21 x 1 histogram bin edges, 0:2.5:50
%   data.f1a.percentages       20 x 4 percentages, each column sums to 100
%   data.f1a.counts            1 x 4 neuron counts
%   data.f1a.median_hz         1 x 4 recorded-window rate medians
%   data.f1b.time_s            T x 1 cue-relative bin centers, -1 to +5 s
%   data.f1b.heatmaps          1 x 4 cells of numeric [n(scope) x T] z-scores
%       Heatmap rows: odd-trial peak order, ties broken by neuron ID.
%       Heatmap values: even-trial rates normalized with odd-trial baseline.
%   data.f1b.counts            1 x 4 neuron counts
%   data.f1b.trace_mean        T x 3 x 4 baseline-centered even-trial Hz
%   data.f1b.trace_sem         T x 3 x 4 across-neuron SEM in Hz
%       Response order: cue-excited, cue-suppressed, unmodulated.
%   data.f1c.baseline_odd_hz    N x 1 odd-trial baseline rates
%   data.f1c.modulation_even_hz N x 1 even-trial cue modulation
%   data.f1c.area_code         N x 1 codes: 1=S1, 2=M1, 3=M2
%   data.f1c.response_code     N x 1 codes: 1=excited, 2=suppressed, 3=unmodulated
%   data.f1c.fit_amplitude_hz  2 x 4 signed-log fit positive amplitudes
%   data.f1c.fit_scale_hz      2 x 4 signed-log fit positive scale values
%   data.f1c.xmax, ymax        Positive common display limits in Hz
%
% Shared dependency: pp_export(fig, stem, outdir).

assert(isstruct(data) && all(isfield(data, {'f1a', 'f1b', 'f1c'})), ...
    'Figure 1 needs data.f1a, data.f1b and data.f1c.');
if exist(outdir, 'dir') ~= 7, mkdir(outdir); end
scopes = {'All', 'S1', 'M1', 'M2'};
areaColors = [38 52 74; 59 126 161; 182 92 80; 90 143 98] / 255;
responseColors = [217 95 69; 63 109 168; 146 153 166] / 255;
responseNames = {'Cue excited', 'Cue suppressed', 'Unmodulated'};
plot_landscape(data.f1a, outdir, scopes, areaColors);
plot_population(data.f1b, outdir, scopes, areaColors, responseColors, responseNames);
plot_baseline(data.f1c, outdir, scopes, areaColors, responseColors, responseNames);
end


function plot_landscape(source, outdir, scopes, areaColors)
edges = double(source.edges_hz(:));
pct = double(source.percentages);
counts = double(source.counts(:));
medians = double(source.median_hz(:));
assert(numel(edges) == 21 && isequal(size(pct), [20, 4]));
assert(numel(counts) == 4 && numel(medians) == 4);
assert(all(abs(sum(pct, 1) - 100) < 1e-6));
fig = new_figure(8.5, 3.4);
label(fig, [.025 .922 .95 .060], 'Firing-rate landscape across the recorded network', 12, 'bold');
label(fig, [.025 .844 .95 .045], '80 trials | recorded -1 to +5 s cue window | equal 2.5-Hz bins', 8.5);
label(fig, [.025 .734 .035 .060], 'a', 13, 'bold');
ymax = ceil(max(pct(:)) * 1.10 / 5) * 5;
for column = 1:4
    left = .085 + (column - 1) * .218;
    ax = axes('Parent', fig, 'Position', [left .295 .180 .435]);
    axes_style(ax); hold(ax, 'on');
    for row = 1:numel(edges)-1
        patch(ax, [edges(row) edges(row+1) edges(row+1) edges(row)], ...
            [0 0 pct(row,column) pct(row,column)], areaColors(column,:), ...
            'EdgeColor', 'white', 'LineWidth', .35);
    end
    plot(ax, [medians(column) medians(column)], [0 ymax], '--', ...
        'Color', [.12 .15 .19], 'LineWidth', .9);
    text(ax, .98, .965, sprintf('median %.2f Hz', medians(column)), ...
        'Units', 'normalized', 'HorizontalAlignment', 'right', ...
        'VerticalAlignment', 'top', 'FontName', 'Arial', 'FontSize', 7.7, ...
        'Interpreter', 'none', 'Color', [.2 .25 .3]);
    set(ax, 'XLim', [0 50], 'YLim', [0 ymax], 'XTick', [0 25 50], ...
        'XTickLabel', {'0', '25', '>=50'}, 'YTick', 0:10:ymax);
    xlabel(ax, {'Recorded-window rate', '(Hz)'}, 'FontSize', 8.5);
    if column == 1
        ylabel(ax, {'Recorded neurons', '(%)'}, 'FontSize', 8.5);
    else
        set(ax, 'YTickLabel', []);
    end
    label(fig, [left .752 .19 .055], sprintf('%s | n=%s', scopes{column}, integer_label(counts(column))), ...
        9, 'bold', areaColors(column,:));
end
label(fig, [.085 .040 .89 .045], 'Each neuron contributes once. The final bin starts at 47.5 Hz and includes all rates at or above 50 Hz.', 7.5);
pp_export(fig, 'paper_figure_01a_firing_rate_landscape', outdir);
close(fig);
end


function plot_population(source, outdir, scopes, areaColors, responseColors, responseNames)
time = double(source.time_s(:));
means = double(source.trace_mean);
sems = double(source.trace_sem);
counts = double(source.counts(:));
assert(numel(source.heatmaps) == 4 && numel(counts) == 4);
assert(isequal(size(means), [numel(time), 3, 4]) && isequal(size(sems), size(means)));
assert(all(sems(:) >= 0) && all(isfinite(means(:))) && all(isfinite(sems(:))));
traceLimit = max(4, ceil(max(abs(means(:)) + sems(:)) / 2) * 2);
fig = new_figure(8.5, 6.2);
set(fig, 'Colormap', paper_parula(256));
label(fig, [.025 .940 .95 .042], 'Cue-locked population responses across the recorded network', 12, 'bold');
label(fig, [.025 .889 .95 .034], 'Odd trials define normalization and row order; held-out even trials supply the displayed activity.', 8.3);
label(fig, [.025 .848 .95 .032], '80 trials | 40 odd / 40 even | -1 to +5 s | neuron-mean traces with SEM', 8.0);
label(fig, [.025 .772 .035 .045], 'b', 13, 'bold');
heatAxes = cell(1, 4);
legendLines = cell(1, 3);
for column = 1:4
    left = .078 + (column - 1) * .214;
    z = double(source.heatmaps{column});
    assert(isequal(size(z), [counts(column), numel(time)]), 'Heatmap dimensions do not match counts/time.');
    assert(all(isfinite(z(:))), 'Heatmap data must be finite numeric z-scores.');
    ax = axes('Parent', fig, 'Position', [left .450 .180 .315]);
    heatAxes{column} = ax;
    imagesc(ax, [time(1) time(end)], [1 counts(column)], z, [-2 4]);
    colormap(ax, paper_parula(256));
    axes_style(ax); hold(ax, 'on');
    set(ax, 'YDir', 'reverse', 'XLim', [-1 5], 'YLim', [.5 counts(column)+.5], ...
        'XTick', [-1 0 2 4 5], 'YTick', [1 counts(column)]);
    plot(ax, [0 0], [.5 counts(column)+.5], '--', 'Color', 'white', 'LineWidth', .8);
    if column == 1
        ylabel(ax, {'Neuron', '(odd-trial peak order)'}, 'FontSize', 8.5);
    else
        set(ax, 'YTickLabel', []);
    end
    label(fig, [left .785 .195 .030], sprintf('%s | n=%s', scopes{column}, integer_label(counts(column))), ...
        9, 'bold', areaColors(column,:));

    traceAx = axes('Parent', fig, 'Position', [left .184 .180 .164]);
    axes_style(traceAx); hold(traceAx, 'on');
    for response = 1:3
        mu = means(:,response,column);
        se = sems(:,response,column);
        fill(traceAx, [time; flipud(time)], [mu-se; flipud(mu+se)], responseColors(response,:), ...
            'EdgeColor', 'none', 'FaceAlpha', .15, 'HandleVisibility', 'off');
        lineHandle = plot(traceAx, time, mu, 'Color', responseColors(response,:), 'LineWidth', 1.2);
        if column == 1, legendLines{response} = lineHandle; end
    end
    plot(traceAx, [-1 5], [0 0], ':', 'Color', [.52 .56 .61], 'LineWidth', .65, 'HandleVisibility', 'off');
    plot(traceAx, [0 0], [-traceLimit traceLimit], '--', 'Color', [.27 .3 .35], 'LineWidth', .65, 'HandleVisibility', 'off');
    set(traceAx, 'XLim', [-1 5], 'YLim', [-traceLimit traceLimit], ...
        'XTick', [-1 0 2 4 5], 'YTick', [-traceLimit 0 traceLimit]);
    xlabel(traceAx, 'Time from cue (s)', 'FontSize', 8.5);
    if column == 1
        ylabel(traceAx, {'Baseline-centered rate', '(Hz; mean +/- SEM)'}, 'FontSize', 8.3);
    else
        set(traceAx, 'YTickLabel', []);
    end
end
% Draw the scale from the exact RGB lookup table. This avoids Octave's peer
% colorbar listeners replacing the per-axes colormap or resizing the heatmap.
colorbarHandle = axes('Parent', fig, 'Position', [.930 .469 .012 .258]);
rgbScale = reshape(paper_parula(256), [256 1 3]);
image(colorbarHandle, [0 1], [-2 4], rgbScale);
set(colorbarHandle, 'YDir', 'normal', 'YLim', [-2 4], 'YTick', [-2 0 2 4], ...
    'XTick', [], 'YAxisLocation', 'right', 'FontName', 'Arial', 'FontSize', 7.5, ...
    'TickDir', 'out', 'LineWidth', .5, 'Box', 'on', 'TickLabelInterpreter', 'none');
ylabel(colorbarHandle, 'Pre-cue z-score', 'FontSize', 8, 'FontName', 'Arial');
lg = legend([legendLines{:}], responseNames, 'Orientation', 'horizontal', 'Box', 'off', ...
    'FontName', 'Arial', 'FontSize', 8, 'Interpreter', 'none');
set(lg, 'Units', 'normalized', 'Position', [.205 .363 .60 .037]);
label(fig, [.078 .068 .90 .032], 'Heatmap colors are clipped at -2 to +4 z. Ribbons are SEM across recorded neurons, not animals.', 7.6);
label(fig, [.078 .030 .90 .028], 'All four views use the same rate limits and color scale; All pools the three recording areas.', 7.6);
pp_export(fig, 'paper_figure_01b_cue_population_timing', outdir);
close(fig);
end


function plot_baseline(source, outdir, scopes, areaColors, responseColors, responseNames)
x = double(source.baseline_odd_hz(:));
y = double(source.modulation_even_hz(:));
area = double(source.area_code(:));
response = double(source.response_code(:));
amplitude = double(source.fit_amplitude_hz);
scale = double(source.fit_scale_hz);
xmax = double(source.xmax); ymax = double(source.ymax);
assert(numel(x) == numel(y) && numel(x) == numel(area) && numel(x) == numel(response));
assert(all(x >= 0) && all(isfinite(x)) && all(isfinite(y)));
assert(isequal(size(amplitude), [2 4]) && isequal(size(scale), [2 4]));
assert(xmax > 0 && ymax > 0);
fig = new_figure(8.5, 4.3);
label(fig, [.025 .940 .95 .043], 'Baseline firing versus cue modulation', 12, 'bold');
label(fig, [.025 .879 .95 .040], 'Odd-trial baseline | even-trial modulation | descriptive sign-constrained fits', 8.3);
label(fig, [.025 .748 .035 .052], 'c', 13, 'bold');
legendPoints = cell(1, 3);
for column = 1:4
    left = .085 + (column - 1) * .218;
    if column == 1, mask = true(size(x)); else, mask = area == column-1; end
    ax = axes('Parent', fig, 'Position', [left .275 .180 .410]);
    axes_style(ax); hold(ax, 'on');
    plot(ax, symlog([0 xmax], .25, .5), [0 0], '-', 'Color', [.55 .58 .62], 'LineWidth', .65, 'HandleVisibility', 'off');
    for classIndex = [3 2 1]
        choose = mask & response == classIndex;
        p = scatter(ax, symlog(x(choose), .25, .5), symlog(y(choose), 1, .55), ...
            9, responseColors(classIndex,:), 'filled', 'MarkerEdgeColor', 'none');
        if isprop(p, 'MarkerFaceAlpha')
            set(p, 'MarkerFaceAlpha', .38);
        else
            set(p, 'MarkerFaceColor', .62 + .38 * responseColors(classIndex,:));
        end
        if column == 1, legendPoints{classIndex} = p; end
    end
    gridX = [0; logspace(log10(.01), log10(xmax), 240)'];
    for classIndex = 1:2
        direction = 3 - 2*classIndex;
        assert(isfinite(amplitude(classIndex,column)) && isfinite(scale(classIndex,column)) && scale(classIndex,column) > 0);
        fitY = direction * amplitude(classIndex,column) .* log1p(gridX ./ scale(classIndex,column));
        plot(ax, symlog(gridX, .25, .5), symlog(fitY, 1, .55), ...
            'Color', responseColors(classIndex,:), 'LineWidth', 1.6, 'HandleVisibility', 'off');
    end
    yTicks = [-100 -10 -1 0 1 10 100];
    yTicks = yTicks(abs(yTicks) <= ymax);
    set(ax, 'XLim', symlog([0 xmax], .25, .5), 'YLim', symlog([-ymax ymax], 1, .55), ...
        'XTick', symlog([0 1 10], .25, .5), 'XTickLabel', {'0', '1', '10'}, ...
        'YTick', symlog(yTicks, 1, .55), 'YTickLabel', arrayfun(@num2str, yTicks, 'UniformOutput', false));
    xlabel(ax, {'Pre-cue rate (Hz)', 'odd trials'}, 'FontSize', 8.5);
    if column == 1
        ylabel(ax, {'Held-out cue modulation', '(Hz; symmetric log)'}, 'FontSize', 8.3);
    else
        set(ax, 'YTickLabel', []);
    end
    label(fig, [left .760 .195 .038], sprintf('%s | n=%s', scopes{column}, integer_label(sum(mask))), ...
        9, 'bold', areaColors(column,:));
    stripAx = axes('Parent', fig, 'Position', [left .710 .180 .034]);
    hold(stripAx, 'on'); set(stripAx, 'XLim', [0 1], 'YLim', [0 1], 'Visible', 'off');
    start = 0;
    for classIndex = 1:3
        width = sum(mask & response == classIndex) / sum(mask);
        patch(stripAx, [start start+width start+width start], [0 0 1 1], responseColors(classIndex,:), ...
            'EdgeColor', 'white', 'LineWidth', .4);
        % A label in a very narrow strip would collide with its neighbor.
        % Its exact fraction remains in the numeric source data.
        if width >= .08
            text(stripAx, start+width/2, .5, sprintf('%.0f%%', 100*width), 'HorizontalAlignment', 'center', ...
                'VerticalAlignment', 'middle', 'FontName', 'Arial', 'FontSize', 6.8, 'FontWeight', 'bold', 'Color', 'white');
        end
        start = start + width;
    end
end
lg = legend([legendPoints{:}], responseNames, 'Orientation', 'horizontal', 'Box', 'off', ...
    'FontName', 'Arial', 'FontSize', 8, 'Interpreter', 'none');
set(lg, 'Units', 'normalized', 'Position', [.200 .812 .63 .035]);
label(fig, [.085 .079 .89 .034], 'One point = one neuron. Strips show cue-response composition; fitted curves are descriptive within one recording.', 7.5);
label(fig, [.085 .034 .89 .030], 'Axes use symmetric-log spacing with common limits covering every neuron; the plotted quantities retain their Hz units.', 7.5);
pp_export(fig, 'paper_figure_01c_baseline_modulation', outdir);
close(fig);
end


function fig = new_figure(width, height)
fig = figure('Visible', 'off', 'Color', 'white', 'Units', 'inches', ...
    'Position', [1 1 width height], 'PaperUnits', 'inches', ...
    'PaperPosition', [0 0 width height], 'PaperSize', [width height], ...
    'InvertHardcopy', 'off', 'Renderer', 'painters');
set(fig, 'DefaultAxesFontName', 'Arial', 'DefaultTextFontName', 'Arial', ...
    'DefaultAxesFontSize', 8.5, 'DefaultTextFontSize', 8.5, ...
    'DefaultTextInterpreter', 'none', 'DefaultAxesTickLabelInterpreter', 'none');
end


function axes_style(ax)
set(ax, 'FontName', 'Arial', 'FontSize', 8, 'LineWidth', .75, ...
    'Box', 'off', 'TickDir', 'out', 'TickLength', [.017 .017], ...
    'XColor', [.24 .29 .35], 'YColor', [.24 .29 .35], 'Color', 'white', ...
    'Layer', 'top', 'TickLabelInterpreter', 'none');
end


function handle = label(fig, position, value, fontSize, weight, color)
if nargin < 5, weight = 'normal'; end
if nargin < 6, color = [.20 .25 .31]; end
handle = annotation(fig, 'textbox', position, 'String', value, 'EdgeColor', 'none', ...
    'Margin', .01, 'Interpreter', 'none', 'FontName', 'Arial', 'FontSize', fontSize, ...
    'FontWeight', weight, 'Color', color, 'VerticalAlignment', 'middle', ...
    'FitBoxToText', 'off');
end


function out = symlog(values, threshold, linearScale)
% Exact symmetric-log coordinate rule used by the original Matplotlib plots.
adjustedScale = linearScale / (1 - 10^(-1));
out = double(values) * adjustedScale;
outside = abs(values) > threshold;
out(outside) = sign(values(outside)) .* threshold .* ...
    (adjustedScale + log10(abs(values(outside)) ./ threshold));
end


function map = paper_parula(n)
stops = [49 42 136; 33 65 176; 17 88 214; 9 118 212; 0 148 210; ...
    17 166 189; 33 183 167; 78 183 137; 121 183 107; 169 184 91; ...
    218 186 77; 234 215 41; 248 245 8] / 255;
map = interp1(linspace(0, 1, size(stops, 1)), stops, linspace(0, 1, n), 'linear');
end


function out = integer_label(value)
out = regexprep(sprintf('%.0f', value), '(\d)(?=(\d{3})+$)', '$1,');
end
