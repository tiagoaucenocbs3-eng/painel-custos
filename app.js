(function () {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const calc = window.FinCalc;
  const store = window.FinStorage;
  const charts = window.FinCharts;

  const state = {
    entries: [],
    settings: store.getSettings(),
    periodType: 'last7',
    currentRange: null,
    currentView: 'dashboard',
    tableSort: { key: 'date', direction: 'desc' },
    mainSeriesVisibility: { revenue: true, adSpend: true, realCost: true, profit: true },
  };

  const formatters = {
    money: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    number: new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }),
    decimal: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };

  function fmtMoney(value) { return formatters.money.format(Number(value) || 0); }
  function fmtPercent(value) { return `${formatters.decimal.format(Number(value) || 0)}%`; }
  function fmtX(value) { return `${formatters.decimal.format(Number(value) || 0)}x`; }
  function fmtDate(iso) {
    if (!iso) return '--';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function fmtMonth(iso) {
    const date = calc.parseLocalDate(iso);
    return date ? date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '--';
  }
  function toast(message) {
    const box = $('#toast');
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => box.classList.remove('show'), 3200);
  }

  function refreshData() {
    state.entries = store.getEntries();
    state.settings = store.getSettings();
    updatePeriodRange();
  }

  function updatePeriodRange() {
    const type = $('#periodSelect').value;
    state.periodType = type;
    state.currentRange = calc.getPeriodRange(type, $('#customStart').value, $('#customEnd').value);
    $('#customPeriod').classList.toggle('hidden', type !== 'custom');
  }

  function entriesInCurrentPeriod() {
    return calc.filterEntriesByPeriod(state.entries, state.currentRange).map(calc.calculateEntryMetrics);
  }

  function setView(viewName) {
    state.currentView = viewName;
    $$('.view').forEach((view) => view.classList.toggle('active', view.id === viewName));
    $$('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewName));
    const titles = {
      dashboard: 'Dashboard',
      entries: 'Lançamentos',
      calendar: 'Calendário',
      reports: 'Relatórios',
      cooud: 'Integração Cooud',
      converter: 'Conversor de Moedas',
      goals: 'Metas',
      settings: 'Configurações'
    };
    $('#viewTitle').textContent = titles[viewName] || 'Dashboard';

    if (viewName === 'converter') {
      fetchExchangeRates();
    }

    render();
  }

  function metricStatus(metric, value) {
    if (metric === 'roas') {
      if (value >= state.settings.roasGood) return 'good';
      if (value >= state.settings.roasMin) return 'warn';
      return 'bad';
    }
    if (metric === 'roi') {
      if (value >= state.settings.roiGood) return 'good';
      if (value >= state.settings.roiMin) return 'warn';
      return 'bad';
    }
    if (metric === 'profit') return value >= 0 ? 'good' : 'bad';
    return '';
  }

  function roasBadge(value) {
    if (value >= state.settings.roasGood) return 'green';
    if (value >= state.settings.roasMin) return 'yellow';
    return 'red';
  }
  function roiBadge(value) {
    if (value >= state.settings.roiGood) return 'green';
    if (value >= state.settings.roiMin) return 'yellow';
    return 'red';
  }

  function renderMainCards(summary) {
    const cards = [
      ['Faturamento', fmtMoney(summary.revenue), 'Quanto entrou no período', '#00d4a6'],
      ['Gasto em anúncios', fmtMoney(summary.adSpend), 'Valor nominal colocado nas campanhas', '#60a5fa'],
      ['IOF', fmtMoney(summary.iofValue), 'Custo do IOF nas recargas', '#fbbf24'],
      ['Custo real da mídia', fmtMoney(summary.realCost), 'Anúncios + IOF', '#fb923c'],
      ['Lucro', fmtMoney(summary.profit), 'Faturamento - custo real', '#22c55e', metricStatus('profit', summary.profit)],
      ['ROI', fmtPercent(summary.roi), 'Retorno sobre custo real', '#a78bfa', metricStatus('roi', summary.roi)],
      ['ROAS', fmtX(summary.roas), 'Faturamento / custo real', '#38bdf8', metricStatus('roas', summary.roas)],
      ['Vendas', formatters.number.format(summary.sales), 'Quantidade total', '#e879f9'],
      ['CPA', fmtMoney(summary.cpa), 'Custo real / vendas', '#f87171'],
      ['Ticket médio', fmtMoney(summary.averageTicket), 'Faturamento / vendas', '#2dd4bf'],
      ['Margem', fmtPercent(summary.margin), 'Lucro / faturamento', '#84cc16', metricStatus('profit', summary.margin)],
      ['Mídia / faturamento', fmtPercent(summary.mediaPercent), 'Custo real / faturamento', '#f472b6'],
    ];
    $('#mainCards').innerHTML = cards.map(([title, value, note, color, status]) => `
      <article class="metric-card ${status || ''}" style="--line-color:${color}">
        <span>${title}</span><strong>${value}</strong><small>${note}</small>
      </article>`).join('');

    $('#qaRevenue').textContent = fmtMoney(summary.revenue);
    $('#qaSpend').textContent = fmtMoney(summary.adSpend);
    $('#qaProfit').textContent = fmtMoney(summary.profit);
    $('#qaRoasRoi').textContent = `${fmtX(summary.roas)} / ${fmtPercent(summary.roi)}`;
    $('#qaCpa').textContent = fmtMoney(summary.cpa);
  }

  function dailySeries(entries) {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return {
      sorted,
      labels: sorted.map((item) => fmtDate(item.date).slice(0, 5)),
    };
  }

  function renderDashboardCharts(entries) {
    const { sorted, labels } = dailySeries(entries);
    const mainSeries = [
      { key: 'revenue', name: 'Faturamento', color: '#00d4a6', data: sorted.map((e) => e.revenue) },
      { key: 'adSpend', name: 'Gasto anúncios', color: '#60a5fa', data: sorted.map((e) => e.adSpend) },
      { key: 'realCost', name: 'Custo real com IOF', color: '#fb923c', data: sorted.map((e) => e.realCost) },
      { key: 'profit', name: 'Lucro', color: '#22c55e', data: sorted.map((e) => e.profit) },
    ].map((s) => ({ ...s, visible: state.mainSeriesVisibility[s.key] !== false }));

    $('#mainLegend').innerHTML = mainSeries.map((s) => `<button data-series="${s.key}" class="${s.visible ? '' : 'off'}"><i style="background:${s.color}"></i>${s.name}</button>`).join('');
    $$('#mainLegend button').forEach((btn) => btn.onclick = () => {
      const key = btn.dataset.series;
      state.mainSeriesVisibility[key] = !state.mainSeriesVisibility[key];
      renderDashboard();
    });

    charts.renderLineChart($('#mainChart'), labels, mainSeries, { valueFormatter: shortMoney });
    charts.renderLineChart($('#roasChart'), labels, [{ name: 'ROAS', color: '#38bdf8', data: sorted.map((e) => e.roas) }], {
      valueFormatter: (v) => `${Number(v).toFixed(1).replace('.', ',')}x`,
      referenceLines: [{ value: state.settings.roasMin, label: `Meta ${fmtX(state.settings.roasMin)}`, color: '#fbbf24' }],
    });
    charts.renderBarChart($('#roiChart'), labels, {
      data: sorted.map((e) => e.roi),
      colors: sorted.map((e) => e.roi >= 0 ? '#22c55e' : '#ef4444'),
    }, { valueFormatter: (v) => `${Math.round(v)}%` });
    charts.renderBarChart($('#salesChart'), labels, { data: sorted.map((e) => e.sales), color: '#a78bfa' });
    charts.renderLineChart($('#cpaChart'), labels, [{ name: 'CPA', color: '#f87171', data: sorted.map((e) => e.cpa) }], {
      valueFormatter: shortMoney,
      referenceLines: [{ value: state.settings.cpaMax, label: `Máx ${fmtMoney(state.settings.cpaMax)}`, color: '#fbbf24' }],
    });
  }

  function shortMoney(value) {
    const abs = Math.abs(Number(value) || 0);
    if (abs >= 1000000) return `R$ ${(value / 1000000).toFixed(1).replace('.', ',')} mi`;
    if (abs >= 1000) return `R$ ${(value / 1000).toFixed(1).replace('.', ',')} mil`;
    return `R$ ${Math.round(value || 0)}`;
  }

  function renderComparison() {
    const kind = $('#comparisonSelect').value;
    const today = new Date();
    let currentRange;
    let previousRange;
    let label;
    if (kind === 'todayVsYesterday') {
      currentRange = calc.getPeriodRange('today', null, null, today);
      previousRange = calc.getPeriodRange('yesterday', null, null, today);
      label = 'Hoje x ontem';
    } else if (kind === 'thisMonthVsLastMonth') {
      currentRange = calc.getPeriodRange('thisMonth', null, null, today);
      previousRange = calc.getPeriodRange('lastMonth', null, null, today);
      label = 'Este mês x mês anterior';
    } else {
      currentRange = calc.getPeriodRange('last7', null, null, today);
      previousRange = calc.previousComparableRange(currentRange);
      label = 'Últimos 7 dias x 7 dias anteriores';
    }
    const current = calc.summarizeEntries(calc.filterEntriesByPeriod(state.entries, currentRange));
    const previous = calc.summarizeEntries(calc.filterEntriesByPeriod(state.entries, previousRange));
    const metrics = [
      ['Faturamento', 'revenue', fmtMoney, true],
      ['Gasto', 'adSpend', fmtMoney, false],
      ['Lucro', 'profit', fmtMoney, true],
      ['ROAS', 'roas', fmtX, true],
      ['Vendas', 'sales', (v) => formatters.number.format(v), true],
      ['CPA', 'cpa', fmtMoney, false],
    ];
    $('#comparisonGrid').innerHTML = metrics.map(([name, key, formatter, higherIsBetter]) => {
      const comp = calc.compareMetric(current[key], previous[key], higherIsBetter);
      const arrow = comp.delta >= 0 ? '↑' : '↓';
      return `<article class="comparison-card">
        <span>${name} · ${label}</span>
        <strong>${formatter(current[key])}</strong>
        <em class="delta ${comp.goodDirection ? 'good' : 'bad'}">${arrow} ${fmtPercent(comp.percentChange)}</em>
        <small>Anterior: ${formatter(previous[key])}</small>
      </article>`;
    }).join('');
  }

  function renderBestWorst(entries) {
    if (!entries.length) {
      $('#bestWorstGrid').innerHTML = '<p>Nenhum lançamento no período.</p>';
      return;
    }
    const bestBy = (key) => [...entries].sort((a, b) => b[key] - a[key])[0];
    const worstBy = (key) => [...entries].sort((a, b) => a[key] - b[key])[0];
    const lowestPositiveCpa = [...entries].filter((e) => e.sales > 0).sort((a, b) => a.cpa - b.cpa)[0] || entries[0];
    const items = [
      ['Melhor faturamento', bestBy('revenue'), 'revenue', fmtMoney],
      ['Melhor lucro', bestBy('profit'), 'profit', fmtMoney],
      ['Melhor ROAS', bestBy('roas'), 'roas', fmtX],
      ['Melhor ROI', bestBy('roi'), 'roi', fmtPercent],
      ['Menor CPA', lowestPositiveCpa, 'cpa', fmtMoney],
      ['Mais vendas', bestBy('sales'), 'sales', (v) => formatters.number.format(v)],
      ['Pior ROAS', worstBy('roas'), 'roas', fmtX],
      ['Maior CPA', bestBy('cpa'), 'cpa', fmtMoney],
      ['Menor lucro', worstBy('profit'), 'profit', fmtMoney],
      ['Dia com prejuízo', worstBy('profit'), 'profit', fmtMoney],
    ];
    $('#bestWorstGrid').innerHTML = items.map(([title, item, key, formatter]) => `<article class="mini-card">
      <span>${title}</span><strong>${formatter(item[key])}</strong><small>${fmtDate(item.date)}</small>
    </article>`).join('');
  }

  function renderGoalProgress() {
    const month = calc.monthProjection(state.entries, state.settings);
    const todayRange = calc.getPeriodRange('today');
    const todaySummary = calc.summarizeEntries(calc.filterEntriesByPeriod(state.entries, todayRange));
    const monthSummary = month.summary;
    const goals = [
      ['Meta diária de faturamento', todaySummary.revenue, state.settings.dailyRevenueGoal, fmtMoney],
      ['Meta diária de vendas', todaySummary.sales, state.settings.dailySalesGoal, (v) => formatters.number.format(v)],
      ['ROAS mínimo', todaySummary.roas, state.settings.roasMin, fmtX],
      ['ROI mínimo', todaySummary.roi, state.settings.roiMin, fmtPercent],
      ['CPA máximo', todaySummary.cpa, state.settings.cpaMax, fmtMoney, true],
      ['Meta mensal de faturamento', monthSummary.revenue, state.settings.monthlyRevenueGoal, fmtMoney],
      ['Meta mensal de lucro', monthSummary.profit, state.settings.monthlyProfitGoal, fmtMoney],
    ];
    $('#goalProgress').innerHTML = goals.map(([label, current, target, formatter, lowerBetter]) => {
      const progress = lowerBetter ? (target ? Math.max(0, Math.min(100, (target / Math.max(current, .0001)) * 100)) : 0) : (target ? Math.max(0, Math.min(140, (current / target) * 100)) : 0);
      return `<div class="progress-row"><div class="progress-label"><span>${label}</span><strong>${formatter(current)} / ${formatter(target)}</strong></div><div class="progress-bar"><div class="progress-fill" style="width:${Math.min(progress,100)}%"></div></div></div>`;
    }).join('');

    $('#monthProjection').innerHTML = [
      ['Faturamento até agora', fmtMoney(month.summary.revenue)],
      ['Dias decorridos', `${month.daysElapsed} de ${month.daysInMonth}`],
      ['Média diária faturamento', fmtMoney(calc.safeDivide(month.summary.revenue, month.daysElapsed))],
      ['Projeção faturamento', fmtMoney(month.projection.revenue)],
      ['Projeção lucro', fmtMoney(month.projection.profit)],
      ['Projeção vendas', formatters.number.format(month.projection.sales)],
      ['Projeção gasto anúncios', fmtMoney(month.projection.adSpend)],
      ['Falta p/ meta faturamento', fmtMoney(month.remainingRevenueGoal)],
      ['Falta p/ meta lucro', fmtMoney(month.remainingProfitGoal)],
    ].map(([label, value]) => `<article class="mini-card"><span>${label}</span><strong>${value}</strong></article>`).join('');
  }

  function renderInsights() {
    const insights = buildInsights();
    $('#insightsList').innerHTML = insights.length ? insights.map((text) => `<li>${text}</li>`).join('') : '<li class="empty">Ainda não há dados suficientes para gerar insights úteis.</li>';
  }

  function buildInsights() {
    const insights = [];
    const todayRange = calc.getPeriodRange('today');
    const today = calc.summarizeEntries(calc.filterEntriesByPeriod(state.entries, todayRange));
    const last7Range = calc.getPeriodRange('last7');
    const prev7Range = calc.previousComparableRange(last7Range);
    const last7 = calc.summarizeEntries(calc.filterEntriesByPeriod(state.entries, last7Range));
    const prev7 = calc.summarizeEntries(calc.filterEntriesByPeriod(state.entries, prev7Range));
    if (last7.count && prev7.count && prev7.roas) {
      const change = calc.compareMetric(last7.roas, prev7.roas, true).percentChange;
      insights.push(`Seu ROAS nos últimos 7 dias está ${fmtPercent(Math.abs(change))} ${change >= 0 ? 'maior' : 'menor'} que nos 7 dias anteriores.`);
    }
    const last3Entries = calc.filterEntriesByPeriod(state.entries, { start: calc.toISODate(calc.addDays(new Date(), -2)), end: calc.toISODate(new Date()) });
    const previous3Entries = calc.filterEntriesByPeriod(state.entries, { start: calc.toISODate(calc.addDays(new Date(), -5)), end: calc.toISODate(calc.addDays(new Date(), -3)) });
    const last3 = calc.summarizeEntries(last3Entries);
    const prev3 = calc.summarizeEntries(previous3Entries);
    if (last3.count && prev3.count && prev3.cpa) {
      const cpaChange = calc.compareMetric(last3.cpa, prev3.cpa, false).percentChange;
      insights.push(`Seu CPA ${cpaChange >= 0 ? 'aumentou' : 'caiu'} ${fmtPercent(Math.abs(cpaChange))} nos últimos 3 dias.`);
    }
    const last30 = calc.filterEntriesByPeriod(state.entries, calc.getPeriodRange('last30')).map(calc.calculateEntryMetrics);
    if (today.count && last30.length) {
      const maxRevenue = Math.max(...last30.map((e) => e.revenue));
      if (today.revenue >= maxRevenue && today.revenue > 0) insights.push('Hoje foi o maior faturamento dos últimos 30 dias.');
    }
    if (last7.count && prev7.count && prev7.adSpend && prev7.revenue) {
      const spendChange = calc.compareMetric(last7.adSpend, prev7.adSpend, false).percentChange;
      const revChange = calc.compareMetric(last7.revenue, prev7.revenue, true).percentChange;
      if (spendChange > 15 && revChange < spendChange / 2) insights.push(`Seu gasto aumentou ${fmtPercent(spendChange)}, mas o faturamento aumentou apenas ${fmtPercent(revChange)}.`);
    }
    const sortedRecent = [...state.entries].map(calc.calculateEntryMetrics).sort((a, b) => b.date.localeCompare(a.date));
    let below = 0;
    for (const item of sortedRecent) {
      if (item.roas < state.settings.roasMin) below++; else break;
    }
    if (below >= 3) insights.push(`Seu ROAS está abaixo da meta há ${below} dias consecutivos.`);
    const month = calc.monthProjection(state.entries, state.settings);
    if (state.settings.monthlyRevenueGoal) insights.push(`Você está a ${fmtMoney(month.remainingRevenueGoal)} da meta mensal de faturamento.`);
    if (month.summary.count) insights.push(`Se mantiver a média atual, sua projeção de faturamento é ${fmtMoney(month.projection.revenue)} neste mês.`);
    return insights.slice(0, 8);
  }

  function renderDashboard() {
    const periodEntries = entriesInCurrentPeriod();
    const summary = calc.summarizeEntries(periodEntries);
    renderMainCards(summary);
    renderDashboardCharts(periodEntries);
    renderComparison();
    renderBestWorst(periodEntries);
    renderGoalProgress();
    renderInsights();
  }

  function renderFormPreview() {
    const entry = calc.calculateEntryMetrics(readFormEntry());
    const chips = [
      ['IOF', fmtMoney(entry.iofValue)],
      ['Custo real', fmtMoney(entry.realCost)],
      ['ROAS', fmtX(entry.roas)],
      ['ROI', fmtPercent(entry.roi)],
      ['CPA', fmtMoney(entry.cpa)],
      ['Ticket médio', fmtMoney(entry.averageTicket)],
      ['Lucro', fmtMoney(entry.profit)],
      ['Margem', fmtPercent(entry.margin)],
      ['Mídia / faturamento', fmtPercent(entry.mediaPercent)],
    ];
    $('#formPreview').innerHTML = chips.map(([label, value]) => `<div class="preview-chip"><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  function readFormEntry() {
    return {
      id: $('#entryId').value || undefined,
      date: $('#entryDate').value,
      adSpend: Number($('#adSpend').value) || 0,
      iofPercent: Number($('#iofPercent').value) || 0,
      sales: Number($('#sales').value) || 0,
      revenue: Number($('#revenue').value) || 0,
      notes: $('#notes').value.trim(),
      sample: false,
    };
  }

  function clearForm(date = calc.toISODate(new Date())) {
    $('#entryId').value = '';
    $('#entryDate').value = date;
    $('#adSpend').value = '';
    $('#iofPercent').value = state.settings.defaultIof;
    $('#sales').value = '';
    $('#revenue').value = '';
    $('#notes').value = '';
    renderFormPreview();
  }

  function fillForm(entry) {
    $('#entryId').value = entry.id;
    $('#entryDate').value = entry.date;
    $('#adSpend').value = entry.adSpend;
    $('#iofPercent').value = entry.iofPercent;
    $('#sales').value = entry.sales;
    $('#revenue').value = entry.revenue;
    $('#notes').value = entry.notes || '';
    renderFormPreview();
    setView('entries');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSaveEntry(event) {
    event.preventDefault();
    const entry = readFormEntry();
    if (!entry.date) return toast('Informe a data do lançamento.');
    const existingSameDate = state.entries.find((item) => item.date === entry.date && item.id !== entry.id);
    if (existingSameDate && !confirm(`Já existe lançamento em ${fmtDate(entry.date)}. Deseja substituir esse lançamento?`)) return;
    if (existingSameDate) store.deleteEntry(existingSameDate.id);
    store.upsertEntry(entry);
    refreshData();
    clearForm(entry.date);
    render();
    toast('Lançamento salvo com sucesso.');
  }

  function duplicateEntry(id) {
    const original = state.entries.find((item) => item.id === id);
    if (!original) return;
    let nextDate = calc.toISODate(calc.addDays(calc.parseLocalDate(original.date), 1));
    while (state.entries.some((item) => item.date === nextDate)) nextDate = calc.toISODate(calc.addDays(calc.parseLocalDate(nextDate), 1));
    const copy = { ...original, id: undefined, date: nextDate, notes: `${original.notes || ''} (duplicado)`.trim(), sample: false };
    store.upsertEntry(copy);
    refreshData();
    render();
    toast(`Lançamento duplicado para ${fmtDate(nextDate)}.`);
  }

  function deleteEntry(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    if (!confirm(`Excluir definitivamente o lançamento de ${fmtDate(entry.date)}?`)) return;
    store.deleteEntry(id);
    refreshData();
    render();
    toast('Lançamento excluído.');
  }

  function renderTables() {
    const sorted = calc.sortEntries(entriesInCurrentPeriod(), state.tableSort.key, state.tableSort.direction);
    const tableHTML = sorted.map((entry) => rowHTML(entry)).join('') || '<tr><td colspan="13">Nenhum lançamento encontrado no período.</td></tr>';
    $('#entriesTable tbody').innerHTML = tableHTML;
    bindTableActions($('#entriesTable'));

    $('#reportsTable thead').innerHTML = $('#entriesTable thead').innerHTML;
    $('#reportsTable tbody').innerHTML = tableHTML;
    bindTableActions($('#reportsTable'));
  }

  function rowHTML(entry) {
    return `<tr>
      <td>${fmtDate(entry.date)}</td>
      <td>${fmtMoney(entry.adSpend)}</td>
      <td>${fmtMoney(entry.iofValue)}</td>
      <td>${fmtMoney(entry.realCost)}</td>
      <td>${formatters.number.format(entry.sales)}</td>
      <td>${fmtMoney(entry.revenue)}</td>
      <td class="${entry.profit >= 0 ? 'positive' : 'negative'}">${fmtMoney(entry.profit)}</td>
      <td><span class="badge ${roasBadge(entry.roas)}">${fmtX(entry.roas)}</span></td>
      <td><span class="badge ${roiBadge(entry.roi)}">${fmtPercent(entry.roi)}</span></td>
      <td>${fmtMoney(entry.cpa)}</td>
      <td>${fmtMoney(entry.averageTicket)}</td>
      <td>${fmtPercent(entry.margin)}</td>
      <td><div class="actions"><button class="action-btn" data-action="edit" data-id="${entry.id}">Editar</button><button class="action-btn" data-action="duplicate" data-id="${entry.id}">Duplicar</button><button class="action-btn" data-action="delete" data-id="${entry.id}">Excluir</button></div></td>
    </tr>`;
  }

  function bindTableActions(table) {
    $$('button[data-action]', table).forEach((btn) => btn.onclick = () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'edit') fillForm(state.entries.find((item) => item.id === id));
      if (btn.dataset.action === 'duplicate') duplicateEntry(id);
      if (btn.dataset.action === 'delete') deleteEntry(id);
    });
  }

  function renderPeriodSummary() {
    const entries = entriesInCurrentPeriod();
    const summary = calc.summarizeEntries(entries);
    const items = [
      ['Período', `${fmtDate(state.currentRange.start)} até ${fmtDate(state.currentRange.end)}`],
      ['Faturamento', fmtMoney(summary.revenue)],
      ['Investimento em anúncios', fmtMoney(summary.adSpend)],
      ['IOF', fmtMoney(summary.iofValue)],
      ['Custo real', fmtMoney(summary.realCost)],
      ['Vendas', formatters.number.format(summary.sales)],
      ['Lucro', fmtMoney(summary.profit)],
      ['ROAS', fmtX(summary.roas)],
      ['ROI', fmtPercent(summary.roi)],
      ['CPA', fmtMoney(summary.cpa)],
      ['Ticket médio', fmtMoney(summary.averageTicket)],
      ['Margem', fmtPercent(summary.margin)],
      ['Mídia / faturamento', fmtPercent(summary.mediaPercent)],
    ];
    $('#periodSummary').innerHTML = items.map(([label, value]) => `<article class="summary-item"><span>${label}</span><strong>${value}</strong></article>`).join('');
  }

  function renderCalendar() {
    const monthInput = $('#calendarMonth');
    if (!monthInput.value) monthInput.value = calc.toISODate(new Date()).slice(0, 7);
    const [year, month] = monthInput.value.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const startPad = first.getDay();
    const byDate = new Map(state.entries.map((entry) => [entry.date, calc.calculateEntryMetrics(entry)]));
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let html = weekdays.map((day) => `<div class="calendar-weekday">${day}</div>`).join('');
    for (let i = 0; i < startPad; i++) html += '<div class="calendar-day empty"></div>';
    for (let day = 1; day <= last.getDate(); day++) {
      const iso = calc.toISODate(new Date(year, month - 1, day));
      const e = byDate.get(iso);
      const klass = e ? dayClass(e) : 'empty';
      html += `<div class="calendar-day ${klass}" data-date="${iso}">
        <div class="date"><span>${day}</span><i class="day-status"></i></div>
        ${e ? `<small>Fat: ${fmtMoney(e.revenue)}</small><small>Gasto: ${fmtMoney(e.adSpend)}</small><small>Lucro: ${fmtMoney(e.profit)}</small><small>ROAS: ${fmtX(e.roas)}</small><small>Vendas: ${e.sales}</small>` : '<small>Sem lançamento</small>'}
      </div>`;
    }
    $('#calendarGrid').innerHTML = html;
    $$('.calendar-day[data-date]').forEach((dayEl) => dayEl.onclick = () => showDayDetails(dayEl.dataset.date));
  }

  function dayClass(entry) {
    if (!entry || !entry.id) return 'empty';
    if (entry.profit < 0) return 'negative';
    if (entry.roas >= state.settings.roasGood && entry.roi >= state.settings.roiGood) return 'excellent';
    if (entry.roas >= state.settings.roasMin && entry.roi >= state.settings.roiMin) return 'normal';
    return 'bad';
  }

  function showDayDetails(date) {
    const entry = state.entries.find((item) => item.date === date);
    const dialog = $('#detailsDialog');
    if (!entry) {
      $('#dialogContent').innerHTML = `<h2>${fmtDate(date)}</h2><p>Sem lançamento para este dia.</p><button class="primary" id="createFromDialog">Criar lançamento</button>`;
      $('#createFromDialog').onclick = () => { dialog.close(); clearForm(date); setView('entries'); };
      dialog.showModal();
      return;
    }
    const e = calc.calculateEntryMetrics(entry);
    $('#dialogContent').innerHTML = `<h2>Detalhes de ${fmtDate(e.date)}</h2><p>${e.notes || 'Sem observações.'}</p><div class="dialog-metrics">
      ${[['Faturamento', fmtMoney(e.revenue)], ['Gasto nominal', fmtMoney(e.adSpend)], ['IOF', fmtMoney(e.iofValue)], ['Custo real', fmtMoney(e.realCost)], ['Lucro', fmtMoney(e.profit)], ['ROAS', fmtX(e.roas)], ['ROI', fmtPercent(e.roi)], ['CPA', fmtMoney(e.cpa)], ['Ticket médio', fmtMoney(e.averageTicket)], ['Margem', fmtPercent(e.margin)], ['Vendas', e.sales], ['Mídia/fat.', fmtPercent(e.mediaPercent)]].map(([l, v]) => `<div class="preview-chip"><span>${l}</span><strong>${v}</strong></div>`).join('')}
    </div><div class="form-actions" style="margin-top:16px"><button class="primary" id="editFromDialog">Editar lançamento</button><button class="danger-outline" id="deleteFromDialog">Excluir</button></div>`;
    $('#editFromDialog').onclick = () => { dialog.close(); fillForm(e); };
    $('#deleteFromDialog').onclick = () => { dialog.close(); deleteEntry(e.id); };
    dialog.showModal();
  }

  function renderSettingsForms() {
    const field = (id, label, type = 'number', step = '0.01') => `<label>${label}<input type="${type}" id="${id}" step="${step}" value="${state.settings[id] ?? ''}"></label>`;
    const commonFields = [
      field('defaultIof', 'Percentual padrão de IOF (%)'),
      field('roasMin', 'ROAS mínimo'),
      field('roasGood', 'ROAS considerado bom'),
      field('roiMin', 'ROI mínimo (%)'),
      field('roiGood', 'ROI considerado bom (%)'),
      field('cpaMax', 'CPA máximo (R$)'),
      field('dailyRevenueGoal', 'Meta diária de faturamento (R$)'),
      field('dailySalesGoal', 'Meta diária de vendas', 'number', '1'),
      field('monthlyRevenueGoal', 'Meta mensal de faturamento (R$)'),
      field('monthlyProfitGoal', 'Meta mensal de lucro (R$)'),
      `<label>Moeda<select id="currency"><option value="BRL" ${state.settings.currency === 'BRL' ? 'selected' : ''}>BRL · Real brasileiro · R$</option></select></label>`,
      '<div class="form-actions"><button class="primary" type="submit">Salvar configurações</button></div>',
    ].join('');
    $('#settingsForm').innerHTML = commonFields;
    $('#goalsForm').innerHTML = commonFields;
    $('#settingsForm').onsubmit = saveSettingsFromForm;
    $('#goalsForm').onsubmit = saveSettingsFromForm;
  }

  function saveSettingsFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = { ...state.settings };
    ['defaultIof','roasMin','roasGood','roiMin','roiGood','cpaMax','dailyRevenueGoal','dailySalesGoal','monthlyRevenueGoal','monthlyProfitGoal'].forEach((id) => {
      next[id] = Number($(`#${id}`, form).value) || 0;
    });
    next.currency = $('#currency', form).value;
    store.saveSettings(next);
    refreshData();
    render();
    toast('Configurações salvas.');
  }

  function exportCSV() {
    const entries = calc.sortEntries(entriesInCurrentPeriod(), 'date', 'asc');
    const headers = ['Data','Gasto anúncios','Percentual IOF','IOF','Custo real','Vendas','Faturamento','Lucro','ROAS','ROI','CPA','Ticket médio','Margem','Mídia sobre faturamento','Observações'];
    const lines = [headers.join(';')];
    entries.forEach((e) => {
      lines.push([
        fmtDate(e.date), brNumber(e.adSpend), brNumber(e.iofPercent), brNumber(e.iofValue), brNumber(e.realCost), e.sales,
        brNumber(e.revenue), brNumber(e.profit), brNumber(e.roas), brNumber(e.roi), brNumber(e.cpa), brNumber(e.averageTicket), brNumber(e.margin), brNumber(e.mediaPercent),
        `"${String(e.notes || '').replaceAll('"', '""')}"`,
      ].join(';'));
    });
    downloadBlob(`painel-operacao-${state.currentRange.start}-${state.currentRange.end}.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
    toast('CSV exportado.');
  }

  function brNumber(value) { return formatters.decimal.format(Number(value) || 0); }

  function exportBackup() {
    downloadBlob(`painel-operacao-backup-${calc.toISODate(new Date())}.json`, JSON.stringify(store.exportBackup(), null, 2), 'application/json');
    toast('Backup JSON exportado.');
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importBackupFile(file) {
    if (!file) return;
    if (!confirm('Importar este backup vai substituir os lançamentos e configurações atuais. Continuar?')) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.importBackup(JSON.parse(reader.result));
        refreshData();
        clearForm();
        render();
        toast('Backup restaurado com sucesso.');
      } catch (error) {
        alert(error.message || 'Não foi possível importar o backup.');
      }
    };
    reader.readAsText(file);
  }

  function deleteSampleData() {
    if (!confirm('Apagar apenas os dados fictícios de exemplo? Seus lançamentos reais serão mantidos.')) return;
    const count = store.deleteSampleData();
    refreshData(); render();
    toast(`${count} lançamentos de exemplo apagados.`);
  }

  function seedSampleData(force) {
    const count = store.seedSampleData(force);
    refreshData(); render();
    toast(count ? `${count} dias de exemplo criados.` : 'Os dados de exemplo já existem ou há dados reais cadastrados.');
  }

  function wipeAllData() {
    if (!confirm('ATENÇÃO: isto apagará TODOS os lançamentos e configurações locais. Deseja continuar?')) return;
    store.wipeAll();
    refreshData();
    clearForm();
    render();
    toast('Todos os dados locais foram apagados.');
  }

  function attachEvents() {
    $$('.nav-btn').forEach((btn) => btn.onclick = () => setView(btn.dataset.view));
    $('#periodSelect').onchange = () => { updatePeriodRange(); render(); };
    $('#customStart').onchange = () => { updatePeriodRange(); render(); };
    $('#customEnd').onchange = () => { updatePeriodRange(); render(); };
    $('#comparisonSelect').onchange = renderComparison;
    $('#entryForm').onsubmit = handleSaveEntry;
    ['#adSpend','#iofPercent','#sales','#revenue'].forEach((selector) => $(selector).addEventListener('input', renderFormPreview));
    $('#clearFormBtn').onclick = () => clearForm();
    $('#seedSampleBtn').onclick = () => seedSampleData(true);
    $('#deleteSampleBtn').onclick = deleteSampleData;
    $('#settingsDeleteSampleBtn').onclick = deleteSampleData;
    $('#wipeAllBtn').onclick = wipeAllData;
    $('#exportCsvBtn').onclick = exportCSV;
    $('#reportsCsvBtn').onclick = exportCSV;
    if ($('#logoutBtn')) $('#logoutBtn').onclick = () => store.logout();
    if ($('#copyWebhookUrlBtn')) {
      $('#copyWebhookUrlBtn').onclick = () => {
        const input = $('#cooudWebhookUrl');
        if (input) {
          input.select();
          input.setSelectionRange(0, 99999);
          navigator.clipboard.writeText(input.value);
          toast('Link do Webhook copiado!');
        }
      };
    }
    $('#calendarMonth').onchange = renderCalendar;
    $('#closeDialog').onclick = () => $('#detailsDialog').close();
    $$('#entriesTable th[data-sort]').forEach((th) => th.onclick = () => sortBy(th.dataset.sort));
    window.addEventListener('resize', debounce(() => renderDashboardCharts(entriesInCurrentPeriod()), 150));

    // Eventos do Conversor de Moedas
    if ($('#refreshRatesBtn')) $('#refreshRatesBtn').onclick = fetchExchangeRates;
    if ($('#calcSourceCurrency')) $('#calcSourceCurrency').onchange = calculateConversion;
    if ($('#calcTargetCurrency')) $('#calcTargetCurrency').onchange = calculateConversion;
    if ($('#calcAmount')) $('#calcAmount').oninput = calculateConversion;
  }

  function sortBy(key) {
    if (state.tableSort.key === key) state.tableSort.direction = state.tableSort.direction === 'asc' ? 'desc' : 'asc';
    else state.tableSort = { key, direction: key === 'date' ? 'desc' : 'asc' };
    renderTables();
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  function render() {
    $('#todayLabel').textContent = `Hoje: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    if (state.currentView === 'dashboard') renderDashboard();
    if (state.currentView === 'cooud') fetchCooudStats();
    renderTables();
    renderPeriodSummary();
    renderCalendar();
    renderSettingsForms();
    renderFormPreview();
  }

  // --- Funções Auxiliares do Conversor de Moedas ---
  let exchangeRates = { USD: 0, EUR: 0, GBP: 0 };

  async function fetchExchangeRates() {
    const refreshBtn = $('#refreshRatesBtn');
    if (refreshBtn) {
      refreshBtn.textContent = 'Atualizando...';
      refreshBtn.disabled = true;
    }

    try {
      const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,GBP-BRL');
      if (!res.ok) throw new Error('Erro ao buscar taxas');
      const data = await res.json();

      if (data.USDBRL && data.EURBRL && data.GBPBRL) {
        exchangeRates.USD = Number(data.USDBRL.ask);
        exchangeRates.EUR = Number(data.EURBRL.ask);
        exchangeRates.GBP = Number(data.GBPBRL.ask);

        $('#rateUSD').textContent = fmtMoney(exchangeRates.USD);
        $('#rateEUR').textContent = fmtMoney(exchangeRates.EUR);
        $('#rateGBP').textContent = fmtMoney(exchangeRates.GBP);

        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR');
        $('#ratesUpdatedLabel').textContent = `Cotações atualizadas em: ${dateStr} às ${timeStr}`;

        calculateConversion();
      }
    } catch (err) {
      console.error('Falha ao obter cotações da API AwesomeAPI:', err);
      toast('Erro ao buscar cotações online.');
    } finally {
      if (refreshBtn) {
        refreshBtn.textContent = 'Atualizar Cotações';
        refreshBtn.disabled = false;
      }
    }
  }

  function calculateConversion() {
    const source = $('#calcSourceCurrency').value;
    const target = $('#calcTargetCurrency').value;
    const amount = Number($('#calcAmount').value) || 0;

    let valueInBrl = 0;

    // 1. Converter de SOURCE para Real (BRL)
    if (source === 'BRL') {
      valueInBrl = amount;
    } else {
      const rateToBrl = exchangeRates[source] || 0;
      valueInBrl = amount * rateToBrl;
    }

    // 2. Converter de Real (BRL) para TARGET
    let finalValue = 0;
    if (target === 'BRL') {
      finalValue = valueInBrl;
    } else {
      const rateToBrl = exchangeRates[target] || 0;
      finalValue = rateToBrl > 0 ? valueInBrl / rateToBrl : 0;
    }

    // 3. Formatar o resultado
    let formatted = '';
    if (target === 'BRL') {
      formatted = fmtMoney(finalValue);
    } else {
      const currencySymbols = { USD: '$', EUR: '€', GBP: '£' };
      const symbol = currencySymbols[target] || target;
      formatted = `${symbol} ${formatters.decimal.format(finalValue)}`;
    }

    $('#calcResult').textContent = formatted;
  }

  // --- Integração Cooud Checkout ---
  async function fetchCooudStats() {
    const { start, end } = state.currentRange;
    const startStr = typeof start === 'string' ? start : calc.toISODate(start);
    const endStr = typeof end === 'string' ? end : calc.toISODate(end);

    const grossEl = $('#cooudGrossRevenue');
    const netEl = $('#cooudNetRevenue');
    const approvedEl = $('#cooudApprovedOrders');
    const rateEl = $('#cooudApprovalRate');
    const refundEl = $('#cooudRefundAmount');

    if (grossEl) grossEl.textContent = 'Carregando...';
    if (netEl) netEl.textContent = 'Carregando...';
    if (approvedEl) approvedEl.textContent = '...';
    if (rateEl) rateEl.textContent = '...';
    if (refundEl) refundEl.textContent = 'Carregando...';

    // Definir o valor dinâmico do webhook com base no domínio de acesso
    const webhookUrlInput = $('#cooudWebhookUrl');
    if (webhookUrlInput) {
      webhookUrlInput.value = `${window.location.origin}/api/webhooks/cooud`;
    }

    try {
      const password = localStorage.getItem('painelOperacao.authToken') || '';
      const res = await fetch(`/api/cooud-stats?startDate=${startStr}&endDate=${endStr}`, {
        headers: {
          'Authorization': password
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          if (window.showLoginOverlay) window.showLoginOverlay(true);
          return;
        }
        throw new Error('Falha ao carregar dados da Cooud');
      }

      const data = await res.json();
      renderCooudView(data);
    } catch (err) {
      console.error(err);
      toast('Erro ao buscar dados da Cooud.');
      if (grossEl) grossEl.textContent = 'Erro';
      if (netEl) netEl.textContent = 'Erro';
      if (approvedEl) approvedEl.textContent = 'Erro';
      if (rateEl) rateEl.textContent = 'Erro';
      if (refundEl) refundEl.textContent = 'Erro';
    }
  }

  function renderCooudView(data) {
    const summary = data.summary;
    if ($('#cooudGrossRevenue')) $('#cooudGrossRevenue').textContent = fmtMoney(summary.grossRevenue);
    if ($('#cooudNetRevenue')) $('#cooudNetRevenue').textContent = fmtMoney(summary.netRevenue);
    if ($('#cooudApprovedOrders')) $('#cooudApprovedOrders').textContent = summary.approvedOrders;
    if ($('#cooudApprovalRate')) $('#cooudApprovalRate').textContent = `${summary.approvalRate}%`;
    if ($('#cooudRefundAmount')) $('#cooudRefundAmount').textContent = `${fmtMoney(summary.refundAmount)} (${summary.refundCount})`;

    const tbody = $('#cooudTransactionsBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!data.transactions || data.transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--muted); padding: 20px;">Nenhuma transação recebida no período. Configure o Webhook acima na Cooud para começar.</td>
        </tr>`;
      return;
    }

    data.transactions.forEach(tx => {
      const row = document.createElement('tr');
      
      let statusBadge = '';
      if (tx.status === 'approved') {
        statusBadge = '<span class="status-badge badge-approved">Aprovado</span>';
      } else if (tx.status === 'refused') {
        statusBadge = '<span class="status-badge badge-refused">Recusado</span>';
      } else if (tx.status === 'refunded') {
        statusBadge = '<span class="status-badge badge-refunded">Reembolsado</span>';
      } else {
        statusBadge = `<span class="status-badge badge-pending">${tx.status}</span>`;
      }

      row.innerHTML = `
        <td>${tx.id}</td>
        <td>${fmtDate(tx.date)}</td>
        <td>${fmtMoney(tx.amount)}</td>
        <td>${fmtMoney(tx.net_amount)}</td>
        <td>${statusBadge}</td>
      `;
      tbody.appendChild(row);
    });
  }

  // --- Fluxo de Autenticação / Login ---
  function showLoginOverlay(show, message = '') {
    const overlay = $('#loginOverlay');
    const errorDiv = $('#loginError');
    if (show) {
      overlay.classList.remove('hidden');
      if (message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
      }
    } else {
      overlay.classList.add('hidden');
    }
  }

  // Expor globalmente para storage.js disparar em caso de erro 401
  window.showLoginOverlay = showLoginOverlay;

  async function handleLogin(e) {
    e.preventDefault();
    const username = $('#loginUsername').value;
    const password = $('#loginPassword').value;
    const errorDiv = $('#loginError');
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    try {
      await store.login(username, password);
      showLoginOverlay(false);
      startApp();
    } catch (err) {
      errorDiv.textContent = 'Usuário ou senha incorretos. Tente novamente.';
      errorDiv.style.display = 'block';
    }
  }

  function startApp() {
    const todayISO = calc.toISODate(new Date());
    $('#customStart').value = todayISO;
    $('#customEnd').value = todayISO;
    $('#calendarMonth').value = todayISO.slice(0, 7);

    store.seedSampleData(false);
    refreshData();
    clearForm(todayISO);
    attachEvents();
    render();
  }

  async function init() {
    $('#loginForm').onsubmit = handleLogin;

    const authInfo = await store.checkAuthRequired();
    if (authInfo.required && !store.isAuthenticated()) {
      showLoginOverlay(true);
    } else {
      startApp();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.PainelOperacao = { state, refreshData, render, calc, store };
})();
