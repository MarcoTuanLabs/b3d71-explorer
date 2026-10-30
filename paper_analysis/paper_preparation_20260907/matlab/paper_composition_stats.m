function stats = paper_composition_stats(area_code, wave_code, response_code)
%PAPER_COMPOSITION_STATS Neuron-level tests for Figure 2b/2d.
%   Codes: area 1=S1,2=M1,3=M2; wave 1=Broad,2=Fast/Narrow;
%   response 1=Cue-excited,2=Cue-suppressed,3=Unmodulated.
%   Uses base MATLAB/Octave only; no Statistics Toolbox is required.
%
%   2b: Pearson chi-square on the 3x2 regional table, Cramer's V,
%       optional two-sided pairwise 2x2 Fisher tests + three-pair Holm.
%   2d: two-sided Fisher exact tests of excited vs non-excited counts,
%       with Holm adjustment across All/S1/M1/M2.
%   Exact means full enumeration of the fixed-margin null distribution;
%   log probabilities use floating-point arithmetic, with no Monte Carlo.
%   These are conditional neuron-level summaries from one recording,
%   not inference from independent animals. Neuron dependence remains a
%   limitation of nominal independence-based p-values.

    area_code = area_code(:);
    wave_code = wave_code(:);
    response_code = response_code(:);
    n = numel(area_code);
    assert(n > 0 && numel(wave_code) == n && numel(response_code) == n, ...
        'Input vectors must have the same positive length.');
    assert(all(isfinite(area_code)) && all(ismember(area_code, 1:3)), ...
        'Area codes must be 1, 2, or 3.');
    assert(all(isfinite(wave_code)) && all(ismember(wave_code, 1:2)), ...
        'Waveform codes must be 1 or 2.');
    assert(all(isfinite(response_code)) && all(ismember(response_code, 1:3)), ...
        'Response codes must be 1, 2, or 3.');

    counts2b = accumarray([area_code wave_code], 1, [3 2]);
    [chi2, df, p, V, expected] = pearson_summary(counts2b);
    stat2b = struct('chi2', chi2, 'df', df, 'p', p, 'V', V, ...
        'counts', counts2b, 'expected', expected, ...
        'minimum_expected', min(expected(:)));
    pairs = [1 2; 1 3; 2 3];
    pairwise_p = zeros(3, 1);
    pairwise_difference = zeros(3, 1);
    for k = 1:3
        pair_table = counts2b(pairs(k, :), :);
        pairwise_p(k) = fisher_probability_exact(pair_table);
        fast_fraction = pair_table(:, 2) ./ sum(pair_table, 2);
        pairwise_difference(k) = 100 * (fast_fraction(1) - fast_fraction(2));
    end
    stat2b.pairwise_area_codes = pairs;
    stat2b.pairwise_p_raw = pairwise_p;
    stat2b.pairwise_p_holm = holm_adjust(pairwise_p);
    stat2b.pairwise_fast_difference_pp = pairwise_difference;

    % Retain the existing excited-versus-non-excited hypothesis. Fisher
    % exact inference handles sparse counts without a t approximation.
    % Holm covers all four displayed tests, including overlapping All.
    counts2d = zeros(2, 3, 4);
    p2d = zeros(4, 1); binary_tables = zeros(2, 2, 4);
    differences = zeros(4, 3); sizes = zeros(4, 2);
    for scope = 1:4
        selected = (scope == 1) | (area_code == scope - 1);
        table = accumarray([wave_code(selected) response_code(selected)], 1, [2 3]);
        counts2d(:, :, scope) = table;
        fast = double(response_code(selected & wave_code == 2) == 1);
        broad = double(response_code(selected & wave_code == 1) == 1);
        binary_tables(:,:,scope) = [table(:,1) sum(table(:,2:3),2)];
        p2d(scope) = fisher_probability_exact(binary_tables(:,:,scope));
        sizes(scope, :) = [numel(broad), numel(fast)];
        proportions = bsxfun(@rdivide, table, sum(table, 2));
        differences(scope, :) = 100 * (proportions(2, :) - proportions(1, :));
    end
    adjusted2d = holm_adjust(p2d);
    stars2d = arrayfun(@paper_significance_stars, adjusted2d, 'UniformOutput', false);
    stat2d = struct('scope_labels', {{'All', 'S1', 'M1', 'M2'}}, ...
        'counts', counts2d, 'binary_tables', binary_tables, 'p_raw', p2d, 'p_holm', adjusted2d, ...
        'test', 'Fisher exact test; two-sided probability ordering', 'family_size', 4, ...
        'stars', {stars2d}, ...
        'sample_sizes_broad_fast', sizes, 'correction', 'Holm across four displayed scopes', ...
        'outcome', 'Cue-excited indicator: excited=1, suppressed/unmodulated=0', ...
        'direction', 'Fast versus Broad; effect is Fast minus Broad', 'alternative', 'two-sided', ...
        'inference_scope', 'Neuron-level conditional association in one mouse; neuron dependence is not corrected', ...
        'fast_minus_broad_response_pp', differences);

    pooled2d = counts2d(:, :, 1);
    [~, ~, ~, pooledV] = pearson_summary(pooled2d);
    stats = struct;
    stats.n = n;
    stats.area_labels = {'S1', 'M1', 'M2'};
    stats.wave_labels = {'Broad', 'Fast/Narrow'};
    stats.response_labels = {'Cue-excited', 'Cue-suppressed', 'Unmodulated'};
    stats.stat2b = stat2b;
    stats.stat2d = stat2d;
    stats.pooled = struct('wave_counts', sum(counts2b, 1), ...
        'response_counts', pooled2d, 'V', pooledV, ...
        'tested_2b', false, 'tested_2d', true);
    stats.method2b = 'Pearson chi-square; pairwise Fisher exact two-sided + Holm across 3 pairs';
    stats.method2d = 'Two-sided Fisher exact test of excited versus non-excited counts; Holm across All/S1/M1/M2; stars use adjusted P';
end

function [chi2, df, p, V, expected] = pearson_summary(table)
    row = sum(table, 2);
    col = sum(table, 1);
    n = sum(row);
    assert(all(row > 0) && all(col > 0), 'Every test margin must be positive.');
    expected = row * col / n;
    terms = (table - expected).^2 ./ expected;
    chi2 = sum(terms(:));
    df = (size(table, 1) - 1) * (size(table, 2) - 1);
    % Upper incomplete gamma avoids cancellation for very small p-values.
    p = gammainc(chi2 / 2, df / 2, 'upper');
    V = sqrt(chi2 / (n * min(size(table) - 1)));
end

function [p, enumerated, probability_sum] = fisher_probability_exact(table)
% All 2x2 or 2x3 tables with the observed margins are enumerated.
% A table belongs to the two-sided tail when its probability is <= that
% of the observed table. This is not a doubled one-sided test.
    assert(size(table, 1) == 2 && any(size(table, 2) == [2 3]), ...
        'Exact enumeration supports 2x2 and 2x3 tables.');
    row = sum(table, 2);
    col = sum(table, 1);
    if row(1) > row(2)
        table = table([2 1], :);
        row = row([2 1]);
    end
    if numel(col) == 2
        table = [table zeros(2, 1)];
        col = [col 0];
    end
    n = sum(row);
    small_row = row(1);
    constant = sum(gammaln(row + 1)) + sum(gammaln(col + 1)) - gammaln(n + 1);
    observed_logp = constant - sum(gammaln(table(:) + 1));
    tail_logp = [];
    all_logp = [];
    % Tolerance includes numerical ties after log-factorial subtraction.
    tolerance = 1e-10;
    for x = max(0, small_row - col(2) - col(3)):min(small_row, col(1))
        for y = max(0, small_row - x - col(3)):min(small_row - x, col(2))
            first = [x y small_row - x - y];
            candidate = [first; col - first];
            logp = constant - sum(gammaln(candidate(:) + 1));
            all_logp(end + 1, 1) = logp; %#ok<AGROW>
            if logp <= observed_logp + tolerance
                tail_logp(end + 1, 1) = logp; %#ok<AGROW>
            end
        end
    end
    enumerated = numel(all_logp);
    probability_sum = exp(logsumexp(all_logp));
    assert(abs(probability_sum - 1) < 1e-8, 'Exact null probabilities must sum to one.');
    p = min(1, exp(logsumexp(tail_logp)));
end

function value = logsumexp(x)
    m = max(x);
    value = m + log(sum(exp(x - m)));
end

function adjusted = holm_adjust(p)
    p = p(:);
    [ordered, order] = sort(p);
    adjusted = zeros(size(p));
    previous = 0;
    for k = 1:numel(p)
        previous = max(previous, min(1, (numel(p) - k + 1) * ordered(k)));
        adjusted(order(k)) = previous;
    end
end
