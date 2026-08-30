(function (root) {
  'use strict';

  function moneyShort(value) {
    const abs = Math.abs(value || 0);
    if (abs >= 1000000) return `R$ ${(value / 1000000).toFixed(1).replace('.', ',')} mi`;
    if (abs >= 1000) return `R$ ${(value / 1000).toFixed(1).replace('.', ',')} mil`;
    return `R$ ${(value || 0).toFixed(0)}`;
  }

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width));
    const height = Number(canvas.getAttribute('height')) || 260;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height };
  }

  function bounds(series, referenceLines) {
    let values = [];
    series.forEach((s) => { if (s.visible !== false) values = values.concat(s.data.map(Number)); });
    (referenceLines || []).forEach((line) => values.push(Number(line.value)));
    values = values.filter(Number.isFinite);
    if (!values.length) values = [0, 1];
    let min = Math.min(...values, 0);
    let max = Math.max(...values, 1);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.14;
    return { min: min - pad, max: max + pad };
  }

  function clear(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(8,13,24,.25)';
    ctx.fillRect(0, 0, width, height);
  }

  function grid(ctx, width, height, pad, min, max, formatter) {
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.fillStyle = 'rgba(226,232,240,.65)';
    ctx.font = '11px Inter, sans-serif';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ((height - pad.top - pad.bottom) * i / 4);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      const value = max - ((max - min) * i / 4);
      ctx.fillText(formatter(value), 10, y + 4);
    }
  }

  function labelDates(ctx, labels, width, height, pad) {
    if (!labels.length) return;
    ctx.fillStyle = 'rgba(226,232,240,.62)';
    ctx.font = '11px Inter, sans-serif';
    const plotW = width - pad.left - pad.right;
    const step = Math.max(1, Math.ceil(labels.length / 6));
    labels.forEach((label, i) => {
      if (i % step && i !== labels.length - 1) return;
      const x = pad.left + (labels.length === 1 ? plotW / 2 : plotW * i / (labels.length - 1));
      ctx.save();
      ctx.translate(x - 16, height - 13);
      ctx.rotate(-0.35);
      ctx.fillText(label.slice(0, 5), 0, 0);
      ctx.restore();
    });
  }

  function renderLineChart(canvas, labels, series, options = {}) {
    const { ctx, width, height } = resizeCanvas(canvas);
    const pad = { left: 68, right: 18, top: 22, bottom: 42 };
    const { min, max } = bounds(series, options.referenceLines);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const xFor = (i) => pad.left + (labels.length === 1 ? plotW / 2 : plotW * i / Math.max(1, labels.length - 1));
    const yFor = (v) => pad.top + (max - v) / (max - min) * plotH;

    clear(ctx, width, height);
    grid(ctx, width, height, pad, min, max, options.valueFormatter || moneyShort);
    labelDates(ctx, labels, width, height, pad);

    (options.referenceLines || []).forEach((line) => {
      const y = yFor(line.value);
      ctx.save();
      ctx.strokeStyle = line.color || '#fbbf24';
      ctx.setLineDash([7, 7]);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = line.color || '#fbbf24';
      ctx.fillText(line.label || String(line.value), pad.left + 8, y - 6);
      ctx.restore();
    });

    series.forEach((s) => {
      if (s.visible === false) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      s.data.forEach((value, i) => {
        const x = xFor(i), y = yFor(Number(value) || 0);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = s.color;
      s.data.forEach((value, i) => {
        const x = xFor(i), y = yFor(Number(value) || 0);
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
      });
    });
  }

  function renderBarChart(canvas, labels, series, options = {}) {
    const { ctx, width, height } = resizeCanvas(canvas);
    const pad = { left: 58, right: 16, top: 22, bottom: 42 };
    const data = series.data || [];
    const colors = series.colors || [];
    const { min, max } = bounds([{ data }], options.referenceLines);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const barW = Math.max(8, plotW / Math.max(1, labels.length) * 0.62);
    const yFor = (v) => pad.top + (max - v) / (max - min) * plotH;

    clear(ctx, width, height);
    grid(ctx, width, height, pad, min, max, options.valueFormatter || ((v) => String(Math.round(v))));
    labelDates(ctx, labels, width, height, pad);

    data.forEach((value, i) => {
      const xCenter = pad.left + plotW * (i + .5) / Math.max(1, labels.length);
      const y0 = yFor(0);
      const y = yFor(Number(value) || 0);
      const top = Math.min(y, y0);
      const heightBar = Math.max(2, Math.abs(y0 - y));
      ctx.fillStyle = colors[i] || series.color || '#38bdf8';
      roundRect(ctx, xCenter - barW / 2, top, barW, heightBar, 6);
      ctx.fill();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  root.FinCharts = { renderLineChart, renderBarChart };
})(window);
