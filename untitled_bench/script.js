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

document.addEventListener('DOMContentLoaded', async () => {
    await loadModels();
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
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';

                dataset.data.forEach((value, index) => {
                    const bar = meta.data[index];
                    if (!bar) return;
                    const props = bar.getProps(['base', 'x', 'y'], true);
                    const centerX = (props.base + props.x) / 2;
                    const text = value.toString();
                    ctx.fillText(text, centerX, props.y);
                });

                ctx.restore();
            }
        });
    }

    initChart();
});

function renderTable() {
    const tableBody = document.getElementById('ranking-body');
    tableBody.innerHTML = benchmarkData.map(item => `
        <tr>
            <td><strong>#${item.rank}</strong></td>
            <td><a href="details/index.html?id=${item.id}" style="color: #2563eb; font-weight: 600; font-family: SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; text-decoration: none;">${item.name}</a></td>
            <td>${item.org}</td>
            <td style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: bold;">${item.score}</td>
            <td>${item.params}</td>
            <td style="color: #64748b; font-size: 0.85rem;">${item.date}</td>
        </tr>
    `).join('');
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

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: benchmarkData.map(d => d.name),
            datasets: [{
                label: 'Aggregate Score',
                data: benchmarkData.map(d => d.score),
                backgroundColor: 'rgba(37, 99, 235, 0.8)',
                hoverBackgroundColor: 'rgba(37, 99, 235, 1)',
                borderRadius: 999,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
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
                        font: {
                            family: "SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                        }
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
                                <div class="tooltip-title">${model.name}</div>
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