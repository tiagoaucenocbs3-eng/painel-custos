const assert = require('node:assert/strict');
const calc = require('../calculations.js');

function almost(actual, expected, tolerance = 0.000001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

(function testDailyMetricsWithIof() {
  const entry = calc.calculateEntryMetrics({
    date: '2026-08-28',
    adSpend: 1250,
    iofPercent: 3.5,
    sales: 31,
    revenue: 3720,
  });

  almost(entry.iofValue, 43.75);
  almost(entry.realCost, 1293.75);
  almost(entry.roas, 2.8753623188405797);
  almost(entry.profit, 2426.25);
  almost(entry.roi, 187.53623188405797);
  almost(entry.cpa, 41.733870967741936);
  almost(entry.averageTicket, 120);
  almost(entry.margin, 65.22177419354838);
  almost(entry.mediaPercent, 34.778225806451616);
})();

(function testZeroDivisionNeverBreaks() {
  const entry = calc.calculateEntryMetrics({ adSpend: 0, iofPercent: 3.5, sales: 0, revenue: 0 });
  assert.equal(entry.iofValue, 0);
  assert.equal(entry.realCost, 0);
  assert.equal(entry.roas, 0);
  assert.equal(entry.roi, 0);
  assert.equal(entry.cpa, 0);
  assert.equal(entry.averageTicket, 0);
  assert.equal(entry.margin, 0);
  assert.equal(entry.mediaPercent, 0);
})();

(function testPeriodAggregationUsesRealCost() {
  const summary = calc.summarizeEntries([
    { date: '2026-08-27', adSpend: 1000, iofPercent: 3.5, sales: 10, revenue: 3000 },
    { date: '2026-08-28', adSpend: 500, iofPercent: 4, sales: 5, revenue: 1000 },
  ]);

  almost(summary.adSpend, 1500);
  almost(summary.iofValue, 55);
  almost(summary.realCost, 1555);
  almost(summary.revenue, 4000);
  assert.equal(summary.sales, 15);
  almost(summary.profit, 2445);
  almost(summary.roas, 4000 / 1555);
  almost(summary.roi, (2445 / 1555) * 100);
  almost(summary.cpa, 1555 / 15);
  almost(summary.averageTicket, 4000 / 15);
  almost(summary.margin, (2445 / 4000) * 100);
})();

(function testPeriodsAreInclusive() {
  const filtered = calc.filterEntriesByPeriod([
    { date: '2026-08-01' },
    { date: '2026-08-15' },
    { date: '2026-09-01' },
  ], { start: '2026-08-01', end: '2026-08-31' });

  assert.deepEqual(filtered.map((item) => item.date), ['2026-08-01', '2026-08-15']);
})();

(function testComparisonDirectionForCpaIsLowerBetter() {
  const result = calc.compareMetric(40, 50, false);
  assert.equal(result.percentChange, -20);
  assert.equal(result.goodDirection, true);

  const bad = calc.compareMetric(60, 50, false);
  assert.equal(bad.percentChange, 20);
  assert.equal(bad.goodDirection, false);
})();

console.log('All calculation tests passed');
