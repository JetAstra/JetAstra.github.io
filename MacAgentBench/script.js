// Models loaded from JSONL (assigned rank after sort)
let benchmarkData = [];

async function loadModels() {
    const res = await fetch('data/models.jsonl');
    const text = await res.text();
    const models = text.trim().split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    // Sort by score descending and assign rank
    models.sort((a, b) => b.score - a.score);
    benchmarkData = models.map((m, i) => ({ ...m, rank: i + 1 }));
}

const iconImageCache = {};
function loadIconImages() {
    const unique = [...new Set(benchmarkData.map(m => m.icon_name).filter(Boolean))];
    return Promise.all(unique.map(name => {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => { iconImageCache[name] = img; resolve(); };
            img.onerror = () => resolve();
            img.src = `assets/${name}.svg`;
        });
    }));
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadModels();
    await loadIconImages();
    renderTable();

    // Custom tooltip positioner: center of bar, expand upwards
    if (window.Chart && Chart.Tooltip && Chart.Tooltip.positioners) {
        Chart.Tooltip.positioners.barCenter = function (elements) {
            if (!elements || !elements.length) return false;
            const el = elements[0];
            const bar = el.element;
            if (!bar) return false;
            // Use bar geometry to find true center for horizontal bar (indexAxis: 'y')
            const props = bar.getProps(['base', 'x', 'y'], true);
            const centerX = (props.base + props.x) / 2;
            // Slightly above vertical center so tooltip grows upward
            return { x: centerX, y: props.y - 8 };
        };
    }

    // Plugin to draw agent + model labels (left-aligned) on y-axis
    if (window.Chart) {
        Chart.register({
            id: 'modelLabelIcons',
            afterDraw(chart) {
                const meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data.length) return;
                const ctx = chart.ctx;
                const left = 12;
                const agentColumnWidth = 78;
                const iconSize = 20;
                const gap = 8;
                ctx.save();
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#0f172a';
                ctx.font = "12px SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
                meta.data.forEach((bar, i) => {
                    const model = benchmarkData[i];
                    if (!model) return;
                    const y = bar.y;
                    ctx.fillText('Openclaw', left, y);
                    const img = model.icon_name && iconImageCache[model.icon_name];
                    const modelLeft = left + agentColumnWidth;
                    if (img) {
                        ctx.drawImage(img, modelLeft, y - iconSize / 2, iconSize, iconSize);
                    }
                    const textX = modelLeft + (img ? iconSize + gap : 0);
                    ctx.fillText(model.name, textX, y);
                });
                ctx.restore();
            }
        });
    }

    // Plugin to draw value labels so they don't disappear on hover
    if (window.Chart) {
        Chart.register({
            id: 'centerValueLabels',
            afterDatasetsDraw(chart, args, opts) {
                const { ctx } = chart;
                const dataset = chart.data.datasets[0];
                const meta = chart.getDatasetMeta(0);
                if (!dataset || !meta) return;

                ctx.save();
                ctx.font = 'bold 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';

                const labelColors = dataset.valueLabelColors;
                dataset.data.forEach((value, index) => {
                    const bar = meta.data[index];
                    if (!bar) return;
                    ctx.fillStyle = (labelColors && labelColors[index]) ? labelColors[index] : '#ffffff';
                    const props = bar.getProps(['base', 'x', 'y'], true);
                    const centerX = (props.base + props.x) / 2;
                    ctx.fillText(String(value), centerX, props.y);
                });

                ctx.restore();
            }
        });
    }

    initChart();
});

/** Top 25% green, middle 50% yellow, bottom 25% red (by rank after score sort). */
function quartileBarStyles(n) {
    const GREEN = 'rgba(34, 197, 94, 0.85)';
    const GREEN_H = 'rgba(34, 197, 94, 1)';
    const YELLOW = 'rgba(234, 179, 8, 0.9)';
    const YELLOW_H = 'rgba(202, 138, 4, 1)';
    const RED = 'rgba(239, 68, 68, 0.85)';
    const RED_H = 'rgba(239, 68, 68, 1)';
    if (n <= 0) return { backgroundColor: [], hoverBackgroundColor: [], valueLabelColors: [] };
    if (n === 1) {
        return {
            backgroundColor: [GREEN],
            hoverBackgroundColor: [GREEN_H],
            valueLabelColors: ['#ffffff']
        };
    }
    const nGreen = Math.round(n * 0.25);
    const nRed = Math.round(n * 0.25);
    const nYellow = n - nGreen - nRed;
    const backgroundColor = [];
    const hoverBackgroundColor = [];
    const valueLabelColors = [];
    for (let i = 0; i < nGreen; i++) {
        backgroundColor.push(GREEN);
        hoverBackgroundColor.push(GREEN_H);
        valueLabelColors.push('#ffffff');
    }
    for (let i = 0; i < nYellow; i++) {
        backgroundColor.push(YELLOW);
        hoverBackgroundColor.push(YELLOW_H);
        valueLabelColors.push('#ffffff');
    }
    for (let i = 0; i < nRed; i++) {
        backgroundColor.push(RED);
        hoverBackgroundColor.push(RED_H);
        valueLabelColors.push('#ffffff');
    }
    return { backgroundColor, hoverBackgroundColor, valueLabelColors };
}

function renderTable() {
    const tableBody = document.getElementById('ranking-body');
    tableBody.innerHTML = benchmarkData.map(item => {
        const iconHtml = item.icon_name
            ? `<img src="assets/${item.icon_name}.svg" alt="" class="model-icon" />`
            : '';
        return `
        <tr>
            <td><strong>#${item.rank}</strong></td>
            <td>Openclaw</td>
            <td class="model-name-cell">
                <a href="details/index.html?id=${item.id}" class="model-name-link">
                    ${iconHtml}
                    <span>${item.name}</span>
                </a>
            </td>
            <td style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: bold;">${item.score}</td>
            <td>${item.params}</td>
            <td style="color: #64748b; font-size: 0.85rem;">${item.date}</td>
        </tr>
    `;
    }).join('');
}

function initChart() {
    const ctx = document.getElementById('snapshotChart').getContext('2d');
    const tooltipEl = document.getElementById('bar-tooltip');
    const container = document.getElementById('chart-wrapper');
    let tooltipPinned = false;
    let currentModelId = null;
    let showTimeout = null;
    const TOOLTIP_DELAY_MS = 180;

    tooltipEl.addEventListener('mouseenter', () => { tooltipPinned = true; });
    tooltipEl.addEventListener('mouseleave', () => {
        tooltipPinned = false;
        if (showTimeout) clearTimeout(showTimeout);
        showTimeout = null;
        tooltipEl.classList.remove('visible');
        tooltipEl.setAttribute('aria-hidden', 'true');
    });

    const n = benchmarkData.length;
    const quartile = quartileBarStyles(n);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: benchmarkData.map(d => d.name),
            datasets: [{
                label: 'Aggregate Score',
                data: benchmarkData.map(d => d.score),
                backgroundColor: quartile.backgroundColor,
                hoverBackgroundColor: quartile.hoverBackgroundColor,
                valueLabelColors: quartile.valueLabelColors,
                borderRadius: 999,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            layout: {
                padding: { left: 300 }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    min: 0,
                    grid: { display: false },
                    title: { display: true, text: 'Aggregate Score' }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        display: false
                    }
                }
            },
            onClick(evt, elements) {
                if (elements.length) {
                    const i = elements[0].index;
                    window.location.href = `details/index.html?id=${benchmarkData[i].id}`;
                }
            },
            interaction: {
                mode: 'nearest',
                intersect: true
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external(context) {
                        const { chart, tooltip } = context;
                        if (tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
                            if (!tooltipPinned) {
                                if (showTimeout) { clearTimeout(showTimeout); showTimeout = null; }
                                tooltipEl.classList.remove('visible');
                                tooltipEl.setAttribute('aria-hidden', 'true');
                            }
                            return;
                        }
                        const i = tooltip.dataPoints[0].dataIndex;
                        const model = benchmarkData[i];
                        if (!model || !model.tasks) return;
                        currentModelId = model.id;

                        const tasksHtml = model.tasks.map(t =>
                            `<div class="tooltip-task-row"><span class="tooltip-key">${t.name}</span><span class="tooltip-val">${t.successRate}%</span></div>`
                        ).join('');
                        tooltipEl.innerHTML = `
                            <div class="bar-tooltip-inner">
                                <div class="tooltip-meta-row"><span class="tooltip-meta-key">Agent</span><span class="tooltip-meta-val">Openclaw</span></div>
                                <div class="tooltip-meta-row"><span class="tooltip-meta-key">Model</span><span class="tooltip-meta-val">${model.name}</span></div>
                                <div class="tooltip-tasks">${tasksHtml}</div>
                                <div class="tooltip-details">
                                    <a href="details/index.html?id=${model.id}">details</a>
                                </div>
                            </div>
                        `;

                        const el = tooltip.dataPoints[0].element;
                        const props = el.getProps(['base', 'x', 'y'], true);
                        const centerX = (props.base + props.x) / 2;
                        const centerY = props.y;
                        const canvas = chart.canvas;
                        const canvasRect = canvas.getBoundingClientRect();
                        const containerRect = container.getBoundingClientRect();
                        const scaleX = canvasRect.width / chart.width;
                        const scaleY = canvasRect.height / chart.height;
                        const left = (canvasRect.left - containerRect.left) + centerX * scaleX;
                        const top = (canvasRect.top - containerRect.top) + centerY * scaleY - 8;

                        tooltipEl.style.left = left + 'px';
                        tooltipEl.style.top = top + 'px';
                        tooltipEl.style.bottom = 'auto';
                        if (showTimeout) clearTimeout(showTimeout);
                        showTimeout = setTimeout(() => {
                            showTimeout = null;
                            tooltipEl.classList.add('visible');
                            tooltipEl.setAttribute('aria-hidden', 'false');
                        }, TOOLTIP_DELAY_MS);
                    }
                }
            }
        }
    });
}
