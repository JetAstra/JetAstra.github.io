let benchmarkData = [];

async function loadModels() {
    const indexRes = await fetch('data/models/index.json');
    const modelIndex = await indexRes.json();
    const results = await Promise.all(modelIndex.map(async ({ id }) => {
        const res = await fetch(`data/models/${id}.json`);
        if (!res.ok) {
            console.warn(`Skipping model ${id}: ${res.status}`);
            return null;
        }
        try {
            return await res.json();
        } catch (error) {
            console.warn(`Skipping model ${id}: invalid JSON`, error);
            return null;
        }
    }));
    const models = results.filter(Boolean);

    models.sort((a, b) => b.score - a.score);
    benchmarkData = models.map((model, index) => ({ ...model, rank: index + 1 }));
}

function getRankClass(rank) {
    if (rank === 1) return 'rank-badge rank-1';
    if (rank === 2) return 'rank-badge rank-2';
    if (rank === 3) return 'rank-badge rank-3';
    return 'rank-badge rank-n';
}

function formatRuntimePerTask(seconds) {
    if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '-';
    return `${seconds.toFixed(2)}s`;
}

function formatCostPerTask(cost) {
    if (typeof cost !== 'number' || Number.isNaN(cost)) return '-';
    return `$${cost.toFixed(3)}`;
}

function getPassRate(model) {
    if (!Array.isArray(model.tasks) || model.tasks.length === 0) return model.score;
    const total = model.tasks.reduce((sum, task) => sum + (task.successRate || 0), 0);
    return total / model.tasks.length;
}

function getPointColor(rank) {
    if (rank === 1) return '#2563eb';
    if (rank === 2) return '#0f766e';
    if (rank === 3) return '#c2410c';
    return '#475569';
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createScatterPlotSvg({ title, subtitle, xKey, xLabel, formatX }) {
    const width = 560;
    const height = 320;
    const margin = { top: 26, right: 28, bottom: 54, left: 58 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const points = benchmarkData
        .map(model => ({
            ...model,
            x: model[xKey],
            y: getPassRate(model)
        }))
        .filter(point => typeof point.x === 'number' && !Number.isNaN(point.x));

    if (points.length === 0) {
        return `
            <div class="scatter-card">
                <div class="scatter-card-header">
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(subtitle)}</p>
                </div>
                <div class="scatter-empty">No chart data available.</div>
            </div>
        `;
    }

    const xValues = points.map(point => point.x);
    const yValues = points.map(point => point.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMinRaw = Math.min(...yValues);
    const yMaxRaw = Math.max(...yValues);
    const xPad = xMin === xMax ? Math.max(1, xMax * 0.1 || 1) : (xMax - xMin) * 0.15;
    const yPad = Math.max(4, (yMaxRaw - yMinRaw) * 0.2 || 6);
    const domainXMin = Math.max(0, xMin - xPad);
    const domainXMax = xMax + xPad;
    const domainYMin = Math.max(0, yMinRaw - yPad);
    const domainYMax = Math.min(100, yMaxRaw + yPad);
    const yTicks = 4;
    const xTicks = 4;

    const scaleX = value => margin.left + ((value - domainXMin) / (domainXMax - domainXMin || 1)) * innerWidth;
    const scaleY = value => margin.top + innerHeight - ((value - domainYMin) / (domainYMax - domainYMin || 1)) * innerHeight;

    const horizontalGrid = Array.from({ length: yTicks + 1 }, (_, index) => {
        const value = domainYMin + ((domainYMax - domainYMin) * index) / yTicks;
        const y = scaleY(value);
        return `
            <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="scatter-grid-line"></line>
            <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" class="scatter-axis-tick">${value.toFixed(0)}%</text>
        `;
    }).join('');

    const verticalGrid = Array.from({ length: xTicks + 1 }, (_, index) => {
        const value = domainXMin + ((domainXMax - domainXMin) * index) / xTicks;
        const x = scaleX(value);
        return `
            <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" class="scatter-grid-line scatter-grid-line-vertical"></line>
            <text x="${x}" y="${height - margin.bottom + 22}" text-anchor="middle" class="scatter-axis-tick">${escapeHtml(formatX(value))}</text>
        `;
    }).join('');

    const pointMarks = points.map(point => {
        const cx = scaleX(point.x);
        const cy = scaleY(point.y);
        const color = getPointColor(point.rank);
        const iconHref = point.icon_name ? `assets/${point.icon_name}.svg` : '';
        return `
            <g class="scatter-point" data-model-id="${escapeHtml(point.id)}">
                <title>${escapeHtml(point.name)}: ${point.y.toFixed(2)}% pass rate, ${formatX(point.x)}</title>
                <circle cx="${cx}" cy="${cy}" r="13" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="1.5"></circle>
                ${iconHref ? `<image href="${iconHref}" x="${cx - 8}" y="${cy - 8}" width="16" height="16"></image>` : `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}"></circle>`}
                <text x="${cx + 14}" y="${cy + 4}" class="scatter-point-label">${escapeHtml(point.name)}</text>
            </g>
        `;
    }).join('');

    return `
        <div class="scatter-card">
            <div class="scatter-card-header">
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(subtitle)}</p>
            </div>
            <div class="scatter-svg-wrap">
                <svg viewBox="0 0 ${width} ${height}" class="scatter-svg" role="img" aria-label="${escapeHtml(title)}">
                    ${horizontalGrid}
                    ${verticalGrid}
                    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" class="scatter-axis-line"></line>
                    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" class="scatter-axis-line"></line>
                    ${pointMarks}
                    <text x="${width / 2}" y="${height - 10}" text-anchor="middle" class="scatter-axis-label">${escapeHtml(xLabel)}</text>
                    <text x="18" y="${height / 2}" text-anchor="middle" transform="rotate(-90 18 ${height / 2})" class="scatter-axis-label">Pass Rate (%)</text>
                </svg>
            </div>
        </div>
    `;
}

function renderLeaderboard() {
    const root = document.getElementById('leaderboard-root');
    if (!root) return;

    root.innerHTML = `
        <div class="leaderboard-table-wrap">
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Model</th>
                        <th>Agent</th>
                        <th>Score</th>
                        <th>Time / Task</th>
                        <th>Price / Task</th>
                    </tr>
                </thead>
                <tbody>
                    ${benchmarkData.map(model => `
                        <tr class="leaderboard-row" data-model-id="${model.id}">
                            <td>
                                <span class="${getRankClass(model.rank)}">#${model.rank}</span>
                            </td>
                            <td>
                                <div class="leaderboard-model-cell">
                                    ${model.icon_name ? `<img src="assets/${model.icon_name}.svg" alt="" class="leaderboard-model-icon" />` : ''}
                                    <div class="leaderboard-model-copy">
                                        <div class="leaderboard-model-name">
                                            <span>${model.name}</span>
                                            <a href="details/index.html?id=${model.id}" class="leaderboard-detail-link">details</a>
                                        </div>
                                        <div class="leaderboard-model-org">${model.org}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="leaderboard-agent">OpenClaw</td>
                            <td>
                                <div class="leaderboard-score-cell">
                                    <div class="leaderboard-score-meta">
                                        <span class="leaderboard-score-value">${model.score.toFixed(2)}</span>
                                        <span class="leaderboard-score-label">/ 100</span>
                                    </div>
                                    <div class="leaderboard-bar-track">
                                        <div class="leaderboard-bar-fill" style="width: ${model.score}%"></div>
                                    </div>
                                </div>
                            </td>
                            <td class="leaderboard-params">${formatRuntimePerTask(model.runtimeSecondsAvg)}</td>
                            <td class="leaderboard-date">${formatCostPerTask(model.costAvg)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    root.querySelectorAll('.leaderboard-row').forEach(row => {
        row.addEventListener('click', () => {
            const { modelId } = row.dataset;
            if (!modelId) return;
            window.location.href = `details/index.html?id=${modelId}`;
        });
    });
}

function renderScatterCharts() {
    const root = document.getElementById('scatter-root');
    if (!root) return;

    root.innerHTML = [
        createScatterPlotSvg({
            title: 'Pass Rate vs. Cost',
            subtitle: 'Lower cost per task with higher pass rate is better.',
            xKey: 'costAvg',
            xLabel: 'Price / Task (USD)',
            formatX: value => `$${value.toFixed(3)}`
        }),
        createScatterPlotSvg({
            title: 'Pass Rate vs. Speed',
            subtitle: 'Lower time per task with higher pass rate is better.',
            xKey: 'runtimeSecondsAvg',
            xLabel: 'Time / Task (s)',
            formatX: value => `${value.toFixed(1)}s`
        })
    ].join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadModels();
        renderLeaderboard();
        renderScatterCharts();
    } catch (error) {
        console.error('Failed to initialize leaderboard', error);

        const leaderboardRoot = document.getElementById('leaderboard-root');
        if (leaderboardRoot) {
            leaderboardRoot.innerHTML = '<div class="scatter-empty">Failed to load leaderboard data.</div>';
        }

        const scatterRoot = document.getElementById('scatter-root');
        if (scatterRoot) {
            scatterRoot.innerHTML = '<div class="scatter-card"><div class="scatter-empty">Failed to load chart data.</div></div>';
        }
    }
});
