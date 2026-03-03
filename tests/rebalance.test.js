import test from 'node:test';
import assert from 'node:assert';
import { 
  runRebalance,
  localDate 
} from '../rebalance-engine.js';

// Helper to create a mock TIPS map
function createMockTipsMap() {
  const map = new Map();
  const tips = [
    { cusip: 'B2032', maturity: '2032-01-15', coupon: 0.01, baseCpi: 300, price: 100, yield: 0.01 },
    { cusip: 'B2033', maturity: '2033-01-15', coupon: 0.01, baseCpi: 300, price: 100, yield: 0.01 },
    { cusip: 'B2034', maturity: '2034-01-15', coupon: 0.01, baseCpi: 300, price: 100, yield: 0.01 },
    { cusip: 'B2035', maturity: '2035-01-15', coupon: 0.01, baseCpi: 300, price: 100, yield: 0.01 },
    { cusip: 'B2036', maturity: '2036-01-15', coupon: 0.01, baseCpi: 300, price: 100, yield: 0.01 },
    // 2037, 2038, 2039 are gaps (market data anchors only)
    { cusip: 'B2036J', maturity: '2036-01-15', coupon: 0.01, baseCpi: 300, price: 100, yield: 0.01 }, // anchorBefore
    { cusip: 'B2040F', maturity: '2040-02-15', coupon: 0.02, baseCpi: 300, price: 100, yield: 0.02 }, // anchorAfter / upper bracket
  ];

  for (const t of tips) {
    map.set(t.cusip, {
      ...t,
      maturity: localDate(t.maturity)
    });
  }
  return map;
}

test('runRebalance - Gap Mode (Basic)', () => {
  const tipsMap = createMockTipsMap();
  const settlementDate = localDate('2026-03-02');
  const refCPI = 300;
  
  // Initial holdings: Ladder from 2032 to 2036, with excess in 2034 and 2040
  const holdings = [
    { cusip: 'B2032', qty: 10 },
    { cusip: 'B2033', qty: 10 },
    { cusip: 'B2034', qty: 50 }, // Lower bracket
    { cusip: 'B2035', qty: 10 },
    { cusip: 'B2036', qty: 10 },
    { cusip: 'B2040F', qty: 100 }, // Upper bracket
  ];

  const result = runRebalance({
    dara: 10000,
    method: 'Gap',
    holdings,
    tipsMap,
    refCPI,
    settlementDate
  });

  assert.strictEqual(result.summary.method, 'Gap');
  assert.ok(result.summary.gapYears.includes(2037));
  assert.ok(result.summary.gapYears.includes(2038));
  assert.ok(result.summary.gapYears.includes(2039));
  
  // In Gap mode, 2035 and 2036 should be rebalanced (between lower bracket 2034 and first gap 2037)
  const row2035 = result.results.find(r => r[3] === '2035');
  const row2032 = result.results.find(r => r[3] === '2032');

  assert.ok(row2035[8] !== "", '2035 should have a target qty');
  assert.strictEqual(row2032[8], "", '2032 should NOT have a target qty in Gap mode');
});

test('runRebalance - Full Mode', () => {
  const tipsMap = createMockTipsMap();
  const settlementDate = localDate('2026-03-02');
  const refCPI = 300;
  
  const holdings = [
    { cusip: 'B2032', qty: 10 },
    { cusip: 'B2034', qty: 50 },
    { cusip: 'B2040F', qty: 100 },
  ];

  const result = runRebalance({
    dara: 10000,
    method: 'Full',
    holdings,
    tipsMap,
    refCPI,
    settlementDate
  });

  assert.strictEqual(result.summary.method, 'Full');
  
  // In Full mode, 2032 should be rebalanced
  const row2032 = result.results.find(r => r[3] === '2032');
  assert.ok(row2032[8] !== "", '2032 should have a target qty in Full mode');
});

test('runRebalance - Full Rebuild (Empty Rungs)', () => {
  const tipsMap = createMockTipsMap();
  const settlementDate = localDate('2026-03-02');
  const refCPI = 300;
  
  // Only holdings in 2032 and 2040. 2033, 2034, 2035, 2036 are "empty rungs" but TIPS exist in market.
  const holdings = [
    { cusip: 'B2032', qty: 10 },
    { cusip: 'B2040F', qty: 100 },
  ];

  const result = runRebalance({
    dara: 10000,
    method: 'Full',
    holdings,
    tipsMap,
    refCPI,
    settlementDate
  });

  // Verify 2033 (empty rung) is present in results and has a target
  const row2033 = result.results.find(r => r[3] === '2033');
  assert.ok(row2033, '2033 should be in results even if not held');
  assert.strictEqual(row2033[0], 'B2033');
  assert.strictEqual(row2033[1], 0, 'Current qty should be 0');
  assert.ok(row2033[8] > 0, 'Target qty should be > 0 to fill the rung');
});

test('runRebalance - Virgin Build (New Investor)', () => {
  const tipsMap = createMockTipsMap();
  const settlementDate = localDate('2026-03-02');
  const refCPI = 300;
  
  // Starting with $0 in TIPS and $100,000 cash
  const holdings = [];
  const initialCash = 100000;
  const startYear = 2032;
  const endYear = 2036;
  const dara = 5000;

  const result = runRebalance({
    dara,
    method: 'Full',
    holdings,
    tipsMap,
    refCPI,
    settlementDate,
    initialCash,
    startYear,
    endYear
  });

  assert.strictEqual(result.summary.initialCash, 100000);
  assert.strictEqual(result.summary.firstYear, 2032);
  assert.strictEqual(result.summary.lastYear, 2036);
  
  // Verify that we have targets for all years in the range
  for (let y = 2032; y <= 2036; y++) {
    const row = result.results.find(r => r[3] === y.toString());
    assert.ok(row, `Year ${y} should be in results`);
    assert.ok(row[8] > 0, `Year ${y} should have a target qty > 0`);
  }

  // Cash should have been spent
  assert.ok(result.summary.costDeltaSum < 0, 'Cost delta should be negative (buying)');
  assert.ok(result.summary.totalCash < initialCash, 'Total cash should be less than initial cash');
});
