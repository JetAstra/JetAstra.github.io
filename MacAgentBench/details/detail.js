// Parse model id from URL query
function getModelId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || '';
}

// Fetch a single model by id
async function loadModel(id) {
    const res = await fetch(`../data/models/${id}.json`);
    if (!res.ok) {
        throw new Error(`Failed to load model ${id}`);
    }
    return res.json();
}

// Render model detail page
function renderDetail(model) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('detail-content').style.display = 'block';

    document.title = `${model.name} | MacAgentBench`;
    const nameEl = document.getElementById('model-name');
    nameEl.innerHTML = '';
    if (model.icon_name) {
        const img = document.createElement('img');
        img.src = `../assets/${model.icon_name}.svg`;
        img.alt = '';
        img.className = 'model-icon model-detail-icon';
        nameEl.appendChild(img);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = model.name;
    nameEl.appendChild(nameSpan);
    document.getElementById('model-meta').textContent =
        `${model.org} · Aggregate ${model.score} · ${model.params} · Updated ${model.date}`;

    const tbody = document.getElementById('task-body');
    tbody.innerHTML = model.tasks.map(t => `
        <tr>
            <td style="font-family: SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${t.name}</td>
            <td style="font-weight: bold;">${t.successRate}%</td>
        </tr>
    `).join('');

    initTaskChart(model.tasks);
}

// Horizontal bar chart for tasks (same style as main page)
function initTaskChart(tasks) {
    const ctx = document.getElementById('taskChart').getContext('2d');

    if (typeof Chart === 'undefined') return;

    if (Chart.Tooltip && Chart.Tooltip.positioners) {
        Chart.Tooltip.positioners.barCenter = function (elements) {
            if (!elements || !elements.length) return false;
            const bar = elements[0].element;
            const props = bar.getProps(['base', 'x', 'y'], true);
            return { x: (props.base + props.x) / 2, y: props.y - 8 };
        };
    }

    Chart.register({
        id: 'centerValueLabels',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            const dataset = chart.data.datasets[0];
            const meta = chart.getDatasetMeta(0);
            if (!dataset || !meta) return;
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px system-ui, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            dataset.data.forEach((value, i) => {
                const bar = meta.data[i];
                if (!bar) return;
                const props = bar.getProps(['base', 'x', 'y'], true);
                ctx.fillText(value + '%', (props.base + props.x) / 2, props.y);
            });
            ctx.restore();
        }
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: tasks.map(t => t.name),
            datasets: [{
                label: 'Success Rate',
                data: tasks.map(t => t.successRate),
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
                    max: 100,
                    grid: { display: false },
                    title: { display: true, text: 'Success Rate (%)' }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        font: { family: "SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    padding: 12,
                    callbacks: {
                        label: ctx => ctx.raw + '%'
                    },
                    position: 'barCenter'
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const id = getModelId();
    if (!id) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('not-found').style.display = 'block';
        return;
    }

    try {
        const model = await loadModel(id);
        renderDetail(model);
    } catch (e) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('not-found').style.display = 'block';
    }
});
