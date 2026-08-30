(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FinCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  function num(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function safeDivide(numerator, denominator) {
    numerator = num(numerator);
    denominator = num(denominator);
    if (!denominator) return 0;
    const value = numerator / denominator;
    return Number.isFinite(value) ? value : 0;
  }

  function roundMoney(value) {
    return Math.round((num(value) + Number.EPSILON) * 100) / 100;
  }

  function calculateEntryMetrics(entry) {
    const adSpend = num(entry.adSpend);
    const iofPercent = num(entry.iofPercent);
    const sales = Math.max(0, Math.round(num(entry.sales)));
    const revenue = num(entry.revenue);
    const iofValue = adSpend * iofPercent / 100;
    const realCost = adSpend + iofValue;
    const profit = revenue - realCost;

    return {
      ...entry,
      adSpend,
      iofPercent,
      sales,
      revenue,
      iofValue,
      realCost,
      profit,
      roas: safeDivide(revenue, realCost),
      roi: safeDivide(profit, realCost) * 100,
      cpa: safeDivide(realCost, sales),
      averageTicket: safeDivide(revenue, sales),
      margin: safeDivide(profit, revenue) * 100,
      mediaPercent: safeDivide(realCost, revenue) * 100,
    };
  }

  function summarizeEntries(entries) {
    const calculated = (entries || []).map(calculateEntryMetrics);
    const totals = calculated.reduce((acc, item) => {
      acc.adSpend += item.adSpend;
      acc.iofValue += item.iofValue;
      acc.realCost += item.realCost;
      acc.sales += item.sales;
      acc.revenue += item.revenue;
      acc.profit += item.profit;
      return acc;
    }, { adSpend: 0, iofValue: 0, realCost: 0, sales: 0, revenue: 0, profit: 0 });

    return {
      ...totals,
      roas: safeDivide(totals.revenue, totals.realCost),
      roi: safeDivide(totals.profit, totals.realCost) * 100,
      cpa: safeDivide(totals.realCost, totals.sales),
      averageTicket: safeDivide(totals.revenue, totals.sales),
      margin: safeDivide(totals.profit, totals.revenue) * 100,
      mediaPercent: safeDivide(totals.realCost, totals.revenue) * 100,
      count: calculated.length,
    };
  }

  function parseLocalDate(isoDate) {
    if (!isoDate) return null;
    const [year, month, day] = String(isoDate).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(date, days) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function daysBetweenInclusive(startISO, endISO) {
    const start = parseLocalDate(startISO);
    const end = parseLocalDate(endISO);
    if (!start || !end) return 0;
    return Math.max(0, Math.floor((end - start) / 86400000) + 1);
  }

  function getPeriodRange(type, customStart, customEnd, baseDate = new Date()) {
    const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    let start = today;
    let end = today;

    switch (type) {
      case 'yesterday':
        start = addDays(today, -1); end = addDays(today, -1); break;
      case 'last7':
        start = addDays(today, -6); break;
      case 'last30':
        start = addDays(today, -29); break;
      case 'thisMonth':
        start = startOfMonth(today); end = endOfMonth(today); break;
      case 'lastMonth': {
        const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start = startOfMonth(last); end = endOfMonth(last); break;
      }
      case 'custom':
        return { start: customStart || toISODate(today), end: customEnd || customStart || toISODate(today), label: 'Período personalizado' };
      case 'today':
      default:
        break;
    }

    return { start: toISODate(start), end: toISODate(end), label: type };
  }

  function previousComparableRange(range) {
    const start = parseLocalDate(range.start);
    const end = parseLocalDate(range.end);
    const length = daysBetweenInclusive(range.start, range.end);
    if (!start || !end || !length) return range;
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(length - 1));
    return { start: toISODate(prevStart), end: toISODate(prevEnd) };
  }

  function filterEntriesByPeriod(entries, range) {
    if (!range || !range.start || !range.end) return entries || [];
    return (entries || []).filter((entry) => entry.date >= range.start && entry.date <= range.end);
  }

  function sortEntries(entries, key = 'date', direction = 'desc') {
    const multiplier = direction === 'asc' ? 1 : -1;
    const metricMap = {
      revenue: (item) => calculateEntryMetrics(item).revenue,
      profit: (item) => calculateEntryMetrics(item).profit,
      roas: (item) => calculateEntryMetrics(item).roas,
      roi: (item) => calculateEntryMetrics(item).roi,
      cpa: (item) => calculateEntryMetrics(item).cpa,
      sales: (item) => calculateEntryMetrics(item).sales,
      date: (item) => item.date || '',
    };
    const reader = metricMap[key] || metricMap.date;
    return [...(entries || [])].sort((a, b) => {
      const av = reader(a);
      const bv = reader(b);
      if (av < bv) return -1 * multiplier;
      if (av > bv) return 1 * multiplier;
      return 0;
    });
  }

  function compareMetric(current, previous, higherIsBetter = true) {
    current = num(current);
    previous = num(previous);
    const percentChange = previous ? ((current - previous) / Math.abs(previous)) * 100 : (current ? 100 : 0);
    const delta = current - previous;
    const goodDirection = higherIsBetter ? delta >= 0 : delta <= 0;
    return { current, previous, delta, percentChange, goodDirection };
  }

  function monthRangeFromISO(iso) {
    const base = parseLocalDate(iso) || new Date();
    return { start: toISODate(startOfMonth(base)), end: toISODate(endOfMonth(base)) };
  }

  function monthProjection(entries, settings, baseDate = new Date()) {
    const todayISO = toISODate(baseDate);
    const monthRange = monthRangeFromISO(todayISO);
    const untilTodayRange = { start: monthRange.start, end: todayISO };
    const monthEntries = filterEntriesByPeriod(entries, untilTodayRange);
    const summary = summarizeEntries(monthEntries);
    const daysElapsed = Math.max(1, daysBetweenInclusive(monthRange.start, todayISO));
    const daysInMonth = daysBetweenInclusive(monthRange.start, monthRange.end);
    const factor = daysInMonth / daysElapsed;
    const projection = {
      revenue: summary.revenue * factor,
      profit: summary.profit * factor,
      sales: Math.round(summary.sales * factor),
      adSpend: summary.adSpend * factor,
    };
    return {
      monthRange,
      untilTodayRange,
      daysElapsed,
      daysInMonth,
      summary,
      projection,
      remainingRevenueGoal: Math.max(0, num(settings && settings.monthlyRevenueGoal) - summary.revenue),
      remainingProfitGoal: Math.max(0, num(settings && settings.monthlyProfitGoal) - summary.profit),
    };
  }

  return {
    num,
    safeDivide,
    roundMoney,
    calculateEntryMetrics,
    summarizeEntries,
    filterEntriesByPeriod,
    getPeriodRange,
    previousComparableRange,
    sortEntries,
    compareMetric,
    parseLocalDate,
    toISODate,
    addDays,
    startOfMonth,
    endOfMonth,
    daysBetweenInclusive,
    monthRangeFromISO,
    monthProjection,
  };
});
