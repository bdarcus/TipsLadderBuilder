// @ts-check
/**
 * @typedef {Object} TIPS_Bond
 * @property {string} cusip
 * @property {Date} maturity
 * @property {number} coupon
 * @property {number} baseCpi
 * @property {string} [datedDate]
 * @property {number|null} price
 * @property {number|null} yield
 */

/**
 * @typedef {Object} Holding
 * @property {string} cusip
 * @property {number} qty
 * @property {Date} [maturity]
 * @property {number} [year]
 */

/**
 * @typedef {Object} GapParameters
 * @property {number} avgDuration
 * @property {number} totalCost
 */

/**
 * @typedef {Object} Brackets
 * @property {number} lowerYear
 * @property {Date} lowerMaturity
 * @property {string} lowerCUSIP
 * @property {number} upperYear
 * @property {Date} upperMaturity
 * @property {string} upperCUSIP
 */

export const LOWEST_LOWER_BRACKET_YEAR = 2032;

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Parses YYYY-MM-DD as local date (not UTC)
 * @param {string} str 
 * @returns {Date}
 */
export function localDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * @param {Date} date 
 * @returns {string}
 */
export function toDateStr(date) {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

/**
 * @param {Date} date 
 * @returns {string}
 */
export function fmtDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = String(date.getFullYear()).slice(2);
  return `${m}/${d}/${y}`;
}

// ─── Yield and Duration Math ──────────────────────────────────────────────────

/**
 * Yield from price (actual/actual, matches Excel YIELD(...,2,1))
 * @param {number} cleanPrice 
 * @param {number} coupon 
 * @param {string} settleDateStr 
 * @param {string} maturityStr 
 * @returns {number|null}
 */
export function yieldFromPrice(cleanPrice, coupon, settleDateStr, maturityStr) {
  if (!cleanPrice || cleanPrice <= 0) return null;
  const settle = localDate(settleDateStr);
  const mature = localDate(maturityStr);
  if (settle >= mature) return null;

  const semiCoupon = (coupon / 2) * 100;
  const matMon = mature.getMonth() + 1;
  const cm1 = matMon <= 6 ? matMon : matMon - 6;
  const cm2 = cm1 + 6;

  function nextCouponOnOrAfter(d) {
    const candidates = [];
    for (let y = d.getFullYear() - 1; y <= d.getFullYear() + 1; y++) {
      candidates.push(new Date(y, cm1 - 1, 15));
      candidates.push(new Date(y, cm2 - 1, 15));
    }
    candidates.sort((a, b) => a.getTime() - b.getTime());
    return candidates.find(c => c >= d && c <= mature) || null;
  }

  const nextCoupon = nextCouponOnOrAfter(settle);
  if (!nextCoupon) return null;
  const lastCoupon = new Date(nextCoupon.getFullYear(), nextCoupon.getMonth() - 6, 15);

  const days = (/** @type {Date} */ a, /** @type {Date} */ b) => (b.getTime() - a.getTime()) / 86400000;
  const E = days(lastCoupon, nextCoupon);
  const A = days(lastCoupon, settle);
  const DSC = days(settle, nextCoupon);
  const accrued = semiCoupon * (A / E);
  const dirtyPrice = cleanPrice + accrued;
  const w = DSC / E;

  const coupons = [];
  let d = new Date(nextCoupon);
  while (d <= mature) {
    coupons.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth() + 6, 15);
  }
  const N = coupons.length;
  if (N === 0) return null;

  function pv(/** @type {number} */ y)  {
    const r = y / 2;
    let s = 0;
    for (let k = 0; k < N; k++) {
      const cf = k === N - 1 ? semiCoupon + 100 : semiCoupon;
      s += cf / Math.pow(1 + r, w + k);
    }
    return s;
  }
  function dpv(/** @type {number} */ y) {
    const r = y / 2;
    let s = 0;
    for (let k = 0; k < N; k++) {
      const cf = k === N - 1 ? semiCoupon + 100 : semiCoupon;
      s += (-cf * (w + k)) / (2 * Math.pow(1 + r, w + k + 1));
    }
    return s;
  }

  let y = coupon > 0.005 ? coupon : 0.02;
  for (let i = 0; i < 200; i++) {
    const diff = pv(y) - dirtyPrice;
    if (Math.abs(diff) < 1e-10) break;
    const deriv = dpv(y);
    if (Math.abs(deriv) < 1e-15) break;
    y -= diff / deriv;
  }
  return y;
}

/**
 * @param {Date} settlement 
 * @param {Date} maturity 
 * @returns {number}
 */
export function getNumPeriods(settlement, maturity) {
  const months = (maturity.getFullYear() - settlement.getFullYear()) * 12 +
                 (maturity.getMonth() - settlement.getMonth());
  return Math.ceil(months / 6);
}

/**
 * @param {Date} settlement 
 * @param {Date} maturity 
 * @param {number} coupon 
 * @param {number} yld 
 * @returns {number}
 */
export function calculateDuration(settlement, maturity, coupon, yld) {
  const settle = new Date(settlement);
  const mature = new Date(maturity);
  const periods = getNumPeriods(settle, mature);
  let weightedSum = 0, pvSum = 0;
  for (let i = 1; i <= periods; i++) {
    const cashflow = i === periods ? 1000 + coupon * 1000 / 2 : coupon * 1000 / 2;
    const pv = cashflow / Math.pow(1 + yld / 2, i);
    weightedSum += i * pv;
    pvSum += pv;
  }
  return weightedSum / pvSum / 2;
}

/**
 * @param {Date} settlement 
 * @param {Date} maturity 
 * @param {number} coupon 
 * @param {number} yld 
 * @returns {number}
 */
export function calculateMDuration(settlement, maturity, coupon, yld) {
  return calculateDuration(settlement, maturity, coupon, yld) / (1 + yld / 2);
}

// ─── Financial Logic ──────────────────────────────────────────────────────────

/**
 * PI per bond
 * @param {string} cusip 
 * @param {Date} maturity 
 * @param {number} refCPI 
 * @param {Map<string, TIPS_Bond>} tipsMap 
 * @returns {number}
 */
export function calculatePIPerBond(cusip, maturity, refCPI, tipsMap) {
  const bond = tipsMap.get(cusip);
  const coupon  = bond?.coupon  ?? 0;
  const baseCpi = bond?.baseCpi ?? refCPI; // default 1:1 index ratio if not found
  const indexRatio = refCPI / baseCpi;
  const adjustedPrincipal = 1000 * indexRatio;
  const adjustedAnnualInterest = adjustedPrincipal * coupon;
  const monthF = new Date(maturity).getMonth() + 1;
  const lastYearInterest = monthF < 7 ? adjustedAnnualInterest * 0.5 : adjustedAnnualInterest * 1.0;
  return adjustedPrincipal + lastYearInterest;
}

/**
 * @param {number[]} gapYears 
 * @param {Date} settlementDate 
 * @param {number} refCPI 
 * @param {Map<string, TIPS_Bond>} tipsMap 
 * @param {number} DARA 
 * @param {Holding[]} holdings 
 * @returns {GapParameters}
 */
export function calculateGapParameters(gapYears, settlementDate, refCPI, tipsMap, DARA, holdings) {
  if (!gapYears || gapYears.length === 0) return { avgDuration: 0, totalCost: 0 };

  /** @type {Record<number, Holding[]>} */
  const holdingsByYear = {};
  for (const h of holdings) {
    const year = h.year ?? 0;
    if (!holdingsByYear[year]) holdingsByYear[year] = [];
    holdingsByYear[year].push(h);
  }

  let laterMaturityFrom2041Plus = 0;
  for (const yearStr in holdingsByYear) {
    const year = parseInt(yearStr);
    if (year > 2040) {
      for (const h of holdingsByYear[year]) {
        const bond = tipsMap.get(h.cusip);
        const coupon = bond?.coupon ?? 0;
        const baseCpi = bond?.baseCpi ?? refCPI;
        const indexRatio = refCPI / baseCpi;
        laterMaturityFrom2041Plus += h.qty * 1000 * indexRatio * coupon;
      }
    }
  }

  // Find 2040 anchor
  let bond2040 = null;
  const tips2040Holding = holdingsByYear[2040] ? holdingsByYear[2040][0] : null;
  if (tips2040Holding) {
    bond2040 = tipsMap.get(tips2040Holding.cusip);
  } else {
    // If no holding in 2040, look for any TIPS in 2040 market data
    for (const b of tipsMap.values()) {
      if (b.maturity?.getFullYear() === 2040 && b.maturity?.getMonth() === 1) { // Feb 2040
        bond2040 = b;
        break;
      }
    }
  }

  if (!bond2040) throw new Error('No TIPS found for 2040 (required for gap interpolation)');
  const maturity2040 = bond2040.maturity;
  if (!maturity2040) throw new Error('2040 anchor missing maturity');

  const piPerBond2040 = calculatePIPerBond(bond2040.cusip, maturity2040, refCPI, tipsMap);
  const targetQty2040 = Math.round((DARA - laterMaturityFrom2041Plus) / piPerBond2040);

  const coupon2040 = bond2040.coupon ?? 0;
  const baseCpi2040 = bond2040.baseCpi ?? refCPI;
  const indexRatio2040 = refCPI / baseCpi2040;
  const annualInterest2040 = targetQty2040 * 1000 * indexRatio2040 * coupon2040;

  /** @type {Record<number, number>} */
  const gapLaterMaturityInterest = { 2040: annualInterest2040 };
  for (const yearStr in holdingsByYear) {
    const year = parseInt(yearStr);
    if (year > 2040) {
      gapLaterMaturityInterest[year] = 0;
      for (const h of holdingsByYear[year]) {
        const bond = tipsMap.get(h.cusip);
        const coupon = bond?.coupon ?? 0;
        const baseCpi = bond?.baseCpi ?? refCPI;
        const indexRatio = refCPI / baseCpi;
        gapLaterMaturityInterest[year] += h.qty * 1000 * indexRatio * coupon;
      }
    }
  }

  const minGapYear = Math.min(...gapYears);
  const maxGapYear = Math.max(...gapYears);
  /** @type {{maturity: Date, yield: number} | null} */
  let anchorBefore = null;
  /** @type {{maturity: Date, yield: number} | null} */
  let anchorAfter = null;

  for (const bond of tipsMap.values()) {
    if (!bond.maturity || bond.yield === null) continue;
    const year  = bond.maturity.getFullYear();
    const month = bond.maturity.getMonth() + 1;
    if (year === minGapYear - 1 && month === 1) {
      anchorBefore = { maturity: bond.maturity, yield: bond.yield };
    }
    if (year === maxGapYear + 1 && month === 2) {
      anchorAfter = { maturity: bond.maturity, yield: bond.yield };
    }
  }
  if (!anchorBefore || !anchorAfter) throw new Error('Could not find interpolation anchors for gap years');

  let totalDuration = 0, totalCost = 0, count = 0;
  for (const year of [...gapYears].sort((a, b) => b - a)) {
    const syntheticMat = new Date(year, 1, 15);
    const syntheticYield = anchorBefore.yield +
      (syntheticMat.getTime() - anchorBefore.maturity.getTime()) * (anchorAfter.yield - anchorBefore.yield) /
      (anchorAfter.maturity.getTime() - anchorBefore.maturity.getTime());
    const syntheticCoupon = Math.max(0.00125, Math.floor(syntheticYield * 100 / 0.125) * 0.00125);

    totalDuration += calculateMDuration(settlementDate, syntheticMat, syntheticCoupon, syntheticYield);

    let sumLaterMaturityInterest = 0;
    for (const futYearStr in gapLaterMaturityInterest) {
      const futYear = parseInt(futYearStr);
      if (futYear > year) sumLaterMaturityInterest += gapLaterMaturityInterest[futYear];
    }

    const piPerBond = 1000 + 1000 * syntheticCoupon * 0.5;
    const qty = Math.round((DARA - sumLaterMaturityInterest) / piPerBond);
    totalCost += qty * 1000;
    count++;
  }

  return { avgDuration: totalDuration / count, totalCost };
}

/**
 * @param {any[]} baseCpiRows
 * @param {any[]} priceRows
 * @param {string} settleDateStr
 * @returns {Map<string, TIPS_Bond>}
 */
export function buildTipsMap(baseCpiRows, priceRows, settleDateStr) {
  const map = new Map();
  for (const r of baseCpiRows) {
    map.set(r.cusip, {
      cusip:     r.cusip,
      maturity:  localDate(r.maturity),
      coupon:    r.coupon,
      baseCpi:   r.baseCpi,
      datedDate: r.datedDate,
      price:     null,
      yield:     null,
    });
  }
  for (const r of priceRows) {
    const entry = map.get(r.cusip);
    if (!entry) continue;
    const price = r.sell || r.eod || r.buy || null;
    if (price) {
      entry.price = price;
      entry.yield = yieldFromPrice(price, entry.coupon, settleDateStr, toDateStr(entry.maturity));
    }
  }
  return map;
}

/**
 * Build tipsMap from TipsYields.csv rows
 * @param {any[]} rows 
 * @returns {Map<string, TIPS_Bond>}
 */
export function buildTipsMapFromYields(rows) {
  const map = new Map();
  for (const r of rows) {
    map.set(r.cusip, {
      cusip:    r.cusip,
      maturity: localDate(r.maturity),
      coupon:   r.coupon,
      baseCpi:  r.baseCpi,
      price:    r.price  || null,
      yield:    r.yield  || null,
    });
  }
  return map;
}

/**
 * @typedef {Object} RebalanceParams
 * @property {number|null} [dara]
 * @property {'Gap'|'Full'} method
 * @property {Holding[]} holdings
 * @property {Map<string, TIPS_Bond>} tipsMap
 * @property {number} refCPI
 * @property {Date} settlementDate
 * @property {number} [initialCash]
 * @property {number} [startYear]
 * @property {number} [endYear]
 */

/**
 * @typedef {Object} RebalanceResult
 * @property {any[][]} results
 * @property {string[]} HDR
 * @property {Object} summary
 */

/**
 * @param {RebalanceParams} params
 * @returns {RebalanceResult}
 */
export function runRebalance({ 
  dara, method, holdings: holdingsRaw, tipsMap, refCPI, settlementDate,
  initialCash = 0, startYear, endYear
}) {
  const settleDateStr  = toDateStr(settlementDate);
  const settleDateDisp = fmtDate(settlementDate);

  // Enrich holdings with maturity from tipsMap
  const holdings = [];
  for (const h of holdingsRaw) {
    const bond = tipsMap.get(h.cusip);
    if (!bond) continue;
    holdings.push({
      cusip:    h.cusip,
      qty:      h.qty,
      maturity: bond.maturity,
      year:     bond.maturity?.getFullYear(),
    });
  }
  holdings.sort((a, b) => (a.maturity?.getTime() ?? 0) - (b.maturity?.getTime() ?? 0));

  // Build yearInfo
  /** @type {Record<number, {firstIdx: number, lastIdx: number, holdings: Holding[]}>} */
  const yearInfo = {};
  holdings.forEach((h, idx) => {
    const year = h.year ?? 0;
    if (!yearInfo[year]) yearInfo[year] = { firstIdx: idx, lastIdx: idx, holdings: [] };
    yearInfo[year].lastIdx = idx;
    yearInfo[year].holdings.push(h);
  });

  // Determine firstYear / lastYear
  const holdingsYears = Object.keys(yearInfo).map(Number).sort((a, b) => a - b);
  const firstYear = startYear ?? (holdingsYears.length > 0 ? holdingsYears[0] : new Date().getFullYear());
  
  let lastYear;
  if (endYear) {
    lastYear = endYear;
  } else if (holdingsYears.length > 0) {
    lastYear = holdingsYears[0];
    for (let i = 0; i < holdingsYears.length; i++) {
      const year = holdingsYears[i];
      if (year <= 2040) { lastYear = year; continue; }
      const nextExpected   = year + 1;
      const nextInHoldings = holdingsYears[i + 1];
      if (nextInHoldings && nextInHoldings === nextExpected) { lastYear = nextInHoldings; }
      else { lastYear = year; break; }
    }
  } else {
    lastYear = firstYear + 10; // Default 10 year ladder if nothing specified
  }

  // TIPS years available in market
  const tipsMapYears = new Set();
  /** @type {Record<number, TIPS_Bond[]>} */
  const tipsByYear = {};
  for (const bond of tipsMap.values()) {
    if (bond.maturity) {
      const year = bond.maturity.getFullYear();
      tipsMapYears.add(year);
      if (!tipsByYear[year]) tipsByYear[year] = [];
      tipsByYear[year].push(bond);
    }
  }

  // Gap years: in range, no TIPS in market and no holdings
  const gapYears = [];
  for (let year = firstYear; year <= lastYear; year++) {
    if (!tipsMapYears.has(year) && !yearInfo[year]) gapYears.push(year);
  }

  // ARA per year (for inferred DARA and before-state display)
  /** @type {Record<number, number>} */
  const araLaterMaturityInterestByYear = {};
  /** @type {Record<number, number>} */
  const araByYear = {};
  const allYearsSorted = Object.keys(yearInfo).map(Number).sort((a, b) => b - a);

  for (const year of allYearsSorted) {
    let laterMatInt = 0;
    for (const yStr in araLaterMaturityInterestByYear) {
      if (parseInt(yStr) > year) laterMatInt += araLaterMaturityInterestByYear[yStr];
    }
    let yearPrincipal = 0, yearLastYearInterest = 0;
    araLaterMaturityInterestByYear[year] = 0;
    for (const holding of yearInfo[year].holdings) {
      const bond = tipsMap.get(holding.cusip);
      const coupon  = bond?.coupon  ?? 0;
      const baseCpi = bond?.baseCpi ?? refCPI;
      const indexRatio = refCPI / baseCpi;
      const adjustedPrincipal = 1000 * indexRatio;
      const adjustedAnnualInterest = adjustedPrincipal * coupon;
      const monthF = (holding.maturity?.getMonth() ?? 0) + 1;
      const lastYearInterest = monthF < 7 ? adjustedAnnualInterest * 0.5 : adjustedAnnualInterest * 1.0;
      yearPrincipal += holding.qty * adjustedPrincipal;
      yearLastYearInterest += holding.qty * lastYearInterest;
      araLaterMaturityInterestByYear[year] += holding.qty * adjustedAnnualInterest;
    }
    araByYear[year] = yearPrincipal + yearLastYearInterest + laterMatInt;
  }

  let araSum = 0;
  for (let year = firstYear; year <= lastYear; year++) {
    if (araByYear[year] !== undefined) araSum += araByYear[year];
  }
  const rungCount    = lastYear - firstYear + 1;
  const inferredDARA = rungCount > 0 ? araSum / rungCount : 0;
  const DARA         = (dara !== undefined && dara !== null) ? dara : inferredDARA;
  const isFullMode   = (method === 'Full');

  // Phase 2: Gap parameters
  const gapParams = calculateGapParameters(gapYears, settlementDate, refCPI, tipsMap, DARA, holdings);

  // Phase 3a: Brackets + durations + weights
  const brackets      = identifyBrackets(gapYears, holdings, yearInfo, tipsByYear);
  const lowerBond     = tipsMap.get(brackets.lowerCUSIP);
  const upperBond     = tipsMap.get(brackets.upperCUSIP);
  const lowerDuration = calculateMDuration(settlementDate, brackets.lowerMaturity,
    lowerBond?.coupon ?? 0, lowerBond?.yield ?? 0);
  const upperDuration = calculateMDuration(settlementDate, brackets.upperMaturity,
    upperBond?.coupon ?? 0, upperBond?.yield ?? 0);
  const lowerWeight   = (upperDuration - gapParams.avgDuration) / (upperDuration - lowerDuration);
  const upperWeight   = 1 - lowerWeight;

  // Phase 3b: Before-state bracket excess (display only)
  const bracketYearSet = new Set([brackets.lowerYear, brackets.upperYear]);
  const gapYearSet     = new Set(gapYears);
  const minGapYear     = gapYears.length > 0 ? Math.min(...gapYears) : 9999;

  /** @type {Record<number, number>} */
  const bracketTargetFYQtyBefore = {};
  for (const [bracketYear, bracketCUSIP, bracketMaturity] of /** @type {const} */ ([
    [brackets.lowerYear, brackets.lowerCUSIP, brackets.lowerMaturity],
    [brackets.upperYear, brackets.upperCUSIP, brackets.upperMaturity],
  ])) {
    let laterMatIntBefore = 0;
    for (const yStr in araLaterMaturityInterestByYear) {
      if (parseInt(yStr) > bracketYear) laterMatIntBefore += araLaterMaturityInterestByYear[yStr];
    }
    const yh = yearInfo[bracketYear]?.holdings ?? [];
    let tFYQty;
    if (yh.length <= 1) {
      tFYQty = Math.round((DARA - laterMatIntBefore) / calculatePIPerBond(bracketCUSIP, bracketMaturity, refCPI, tipsMap));
    } else {
      let nonPI = 0;
      for (const h of yh) {
        if (h.cusip !== bracketCUSIP) nonPI += h.qty * calculatePIPerBond(h.cusip, h.maturity, refCPI, tipsMap);
      }
      tFYQty = Math.round((DARA - laterMatIntBefore - nonPI) / calculatePIPerBond(bracketCUSIP, bracketMaturity, refCPI, tipsMap));
    }
    bracketTargetFYQtyBefore[bracketYear] = tFYQty;
  }

  // Phase 4: Ladder rebuild (longest to shortest)
  /** @type {Set<number>} */
  let rebalYearSet;
  if (isFullMode) {
    rebalYearSet = new Set();
    for (let year = firstYear; year <= lastYear; year++) {
      if (!bracketYearSet.has(year) && !gapYearSet.has(year)) rebalYearSet.add(year);
    }
  } else {
    rebalYearSet = new Set();
    for (let year = brackets.lowerYear + 1; year < minGapYear; year++) {
      if (!gapYearSet.has(year)) rebalYearSet.add(year);
    }
  }

  const bracketExcessTarget = {
    [brackets.lowerYear]: gapParams.totalCost * lowerWeight,
    [brackets.upperYear]: gapParams.totalCost * upperWeight,
  };

  /** @type {Record<number, any>} */
  const buySellTargets  = {};
  /** @type {Record<string, number>} */
  const postRebalQtyMap = {};
  for (const h of holdings) postRebalQtyMap[h.cusip] = h.qty;

  let rebuildLaterMatInt = 0;
  /** @type {Record<number, number>} */
  const yearLaterMatIntSnapshot = {};

  const rebuildYears = [];
  for (let year = lastYear; year >= firstYear; year--) rebuildYears.push(year);
  for (const year of allYearsSorted) {
    if (year > lastYear) rebuildYears.push(year);
  }
  rebuildYears.sort((a, b) => b - a);

  for (const year of rebuildYears) {
    if (gapYearSet.has(year)) continue;

    yearLaterMatIntSnapshot[year] = rebuildLaterMatInt;

    const yi        = yearInfo[year];
    const isBracket = bracketYearSet.has(year);
    const isRebal   = rebalYearSet.has(year);

    /** @type {string|null} */
    let targetCUSIP = null;
    /** @type {Date|null} */
    let targetMaturity = null;

    if (yi && yi.holdings.length > 0) {
      let maxQty = -1;
      for (const h of yi.holdings) {
        if (h.qty > maxQty) {
          maxQty = h.qty;
          targetCUSIP = h.cusip;
          targetMaturity = h.maturity ?? null;
        }
      }
    } else if (tipsByYear[year] && tipsByYear[year].length > 0) {
      const febBond = tipsByYear[year].find(b => b.maturity?.getMonth() === 1);
      const bond = febBond || tipsByYear[year][0];
      targetCUSIP = bond.cusip;
      targetMaturity = bond.maturity ?? null;
    }

    if (!targetCUSIP || !targetMaturity) {
      if (yi) {
         for (const h of yi.holdings) {
           const bond = tipsMap.get(h.cusip);
           const c  = bond?.coupon  ?? 0;
           const bc = bond?.baseCpi ?? refCPI;
           const ir = refCPI / bc;
           rebuildLaterMatInt += h.qty * 1000 * ir * c;
         }
      }
      continue;
    }

    const targetBondR  = tipsMap.get(targetCUSIP);
    const tPrice       = targetBondR?.price ?? 0;
    const tBaseCpi     = targetBondR?.baseCpi ?? refCPI;
    const tIndexRatio  = refCPI / tBaseCpi;
    const costPerBond  = tPrice / 100 * tIndexRatio * 1000;

    const currentHolding = yi?.holdings.find(h => h.cusip === targetCUSIP);
    const currentQty     = currentHolding ? currentHolding.qty : 0;

    let targetFYQty, postRebalQty;

    if (isBracket || isRebal) {
      if (!yi || yi.holdings.length <= 1) {
        targetFYQty = Math.round((DARA - rebuildLaterMatInt) / calculatePIPerBond(targetCUSIP, targetMaturity, refCPI, tipsMap));
      } else {
        let nonTargetPI = 0;
        for (const h of yi.holdings) {
          if (h.cusip !== targetCUSIP) nonTargetPI += h.qty * calculatePIPerBond(h.cusip, h.maturity, refCPI, tipsMap);
        }
        targetFYQty = Math.round((DARA - rebuildLaterMatInt - nonTargetPI) / calculatePIPerBond(targetCUSIP, targetMaturity, refCPI, tipsMap));
      }
      postRebalQty = isBracket
        ? targetFYQty + Math.round((bracketExcessTarget[year] || 0) / costPerBond)
        : targetFYQty;
    } else {
      targetFYQty  = currentQty;
      postRebalQty = currentQty;
    }

    if (isBracket || isRebal) {
      buySellTargets[year] = {
        targetCUSIP, targetFYQty,
        targetQty: postRebalQty, postRebalQty, qtyDelta: postRebalQty - currentQty,
        targetCost:        targetFYQty * costPerBond,
        costDelta:         -((postRebalQty - currentQty) * costPerBond),
        costPerBond, isBracket,
        currentExcessCost: isBracket
          ? (currentQty - (bracketTargetFYQtyBefore[year] || 0)) * costPerBond
          : undefined,
      };
    }

    postRebalQtyMap[targetCUSIP] = postRebalQty;
    if (yi) {
      for (const h of yi.holdings) {
        const qtyForInt = h.cusip === targetCUSIP ? postRebalQty : h.qty;
        const bond = tipsMap.get(h.cusip);
        const c  = bond?.coupon  ?? 0;
        const bc = bond?.baseCpi ?? refCPI;
        const ir = refCPI / bc;
        rebuildLaterMatInt += qtyForInt * 1000 * ir * c;
      }
    } else {
        const bond = tipsMap.get(targetCUSIP);
        const c  = bond?.coupon  ?? 0;
        const bc = bond?.baseCpi ?? refCPI;
        const ir = refCPI / bc;
        rebuildLaterMatInt += postRebalQty * 1000 * ir * c;
    }
  }

  // Before ARA
  /** @type {Record<number, number>} */
  const beforeARAByYear = {};
  for (const year of rebuildYears) {
    if (gapYearSet.has(year)) continue;
    let laterMatInt = 0;
    for (const yStr in araLaterMaturityInterestByYear) {
      if (parseInt(yStr) > year) laterMatInt += araLaterMaturityInterestByYear[yStr];
    }
    let yearPrincipal = 0, yearLastYearInterest = 0;
    if (yearInfo[year]) {
      for (const holding of yearInfo[year].holdings) {
        const bond = tipsMap.get(holding.cusip);
        const coupon  = bond?.coupon  ?? 0;
        const baseCpi = bond?.baseCpi ?? refCPI;
        const indexRatio = refCPI / baseCpi;
        const adjustedPrincipal = 1000 * indexRatio;
        const adjustedAnnualInterest = adjustedPrincipal * coupon;
        const monthF = (holding.maturity?.getMonth() ?? 0) + 1;
        const lastYearInterest = monthF < 7 ? adjustedAnnualInterest * 0.5 : adjustedAnnualInterest * 1.0;
        const isBracketTarget = bracketYearSet.has(year) && holding.cusip === buySellTargets[year]?.targetCUSIP;
        const qtyForARA = isBracketTarget ? (bracketTargetFYQtyBefore[year] ?? 0) : holding.qty;
        yearPrincipal        += qtyForARA * adjustedPrincipal;
        yearLastYearInterest += qtyForARA * lastYearInterest;
      }
    }
    beforeARAByYear[year] = yearPrincipal + yearLastYearInterest + laterMatInt;
  }

  // After ARA
  /** @type {Record<number, number>} */
  const postARAByYear = {};
  for (const year of rebuildYears) {
    if (gapYearSet.has(year)) continue;
    const laterMatInt = yearLaterMatIntSnapshot[year] ?? 0;
    let yearPrincipal = 0, yearLastYearInterest = 0;
    
    const cusipsInYear = new Set();
    if (yearInfo[year]) yearInfo[year].holdings.forEach(h => cusipsInYear.add(h.cusip));
    if (buySellTargets[year]) cusipsInYear.add(buySellTargets[year].targetCUSIP);

    for (const cusip of cusipsInYear) {
      const bond = tipsMap.get(cusip);
      const coupon  = bond?.coupon  ?? 0;
      const baseCpi = bond?.baseCpi ?? refCPI;
      const indexRatio = refCPI / baseCpi;
      const adjustedPrincipal = 1000 * indexRatio;
      const adjustedAnnualInterest = adjustedPrincipal * coupon;
      const monthF = (bond?.maturity?.getMonth() ?? 0) + 1;
      const lastYearInterest = monthF < 7 ? adjustedAnnualInterest * 0.5 : adjustedAnnualInterest * 1.0;
      
      const bt = buySellTargets[year];
      let qtyForARA;
      if (bt && cusip === bt.targetCUSIP) {
        qtyForARA = bt.isBracket ? bt.targetFYQty : bt.postRebalQty;
      } else {
        qtyForARA = postRebalQtyMap[cusip] ?? 0;
      }
      yearPrincipal        += qtyForARA * adjustedPrincipal;
      yearLastYearInterest += qtyForARA * lastYearInterest;
    }
    postARAByYear[year] = yearPrincipal + yearLastYearInterest + laterMatInt;
  }

  // Build result rows
  const displayYears = [...rebuildYears].sort((a, b) => a - b);
  const results = [];
  /** @type {Record<number, number>} */
  const outputLaterMaturityInterest = {};

  for (let i = displayYears.length - 1; i >= 0; i--) {
    const year = displayYears[i];
    
    let sumLaterMaturityAnnualInterest = 0;
    for (const yearStr in outputLaterMaturityInterest) {
      if (parseInt(yearStr) > year) sumLaterMaturityAnnualInterest += outputLaterMaturityInterest[yearStr];
    }

    const yi = yearInfo[year];
    const bt = buySellTargets[year];
    
    /** @type {string[]} */
    const cusipsToShow = [];
    if (yi) {
      yi.holdings.forEach(h => cusipsToShow.push(h.cusip));
    }
    if (bt && !cusipsToShow.includes(bt.targetCUSIP)) {
      cusipsToShow.push(bt.targetCUSIP);
    }

    for (let j = 0; j < cusipsToShow.length; j++) {
      const cusip = cusipsToShow[j];
      const isLastInYear = (j === cusipsToShow.length - 1);
      const holding = yi?.holdings.find(h => h.cusip === cusip);
      const bond = tipsMap.get(cusip);
      const maturity = bond?.maturity;

      let fy = "", principalFY = "", interestFY = "", araFY = "", costFY = "";
      let targetQty = "", qtyDelta = "", targetCost = "", costDelta = "";
      let araBeforeFY = "", araMinusDaraBefore = "", araAfterFY = "", araMinusDaraAfter = "";
      let excessBefore = "", excessAfter = "";

      if (isLastInYear) {
        let yearPrincipal = 0, yearLastYearInterest = 0, yearCost = 0;
        const allCusipsInYear = new Set(cusipsToShow);
        for (const c of allCusipsInYear) {
          const b = tipsMap.get(c);
          const h = yi?.holdings.find(holding => holding.cusip === c);
          const q = h?.qty ?? 0;
          const coupon  = b?.coupon  ?? 0;
          const price   = b?.price   ?? 0;
          const baseCpi = b?.baseCpi ?? refCPI;
          const indexRatio = refCPI / baseCpi;
          const adjustedPrincipal = 1000 * indexRatio;
          yearPrincipal += q * adjustedPrincipal;
          const adjustedAnnualInterest = adjustedPrincipal * coupon;
          const monthF = (b?.maturity?.getMonth() ?? 0) + 1;
          const lastYearInterest = monthF < 7 ? adjustedAnnualInterest * 0.5 : adjustedAnnualInterest * 1.0;
          yearLastYearInterest += q * lastYearInterest;
          yearCost += q * (price / 100 * indexRatio * 1000);
        }
        fy              = year.toString();
        principalFY     = yearPrincipal;
        interestFY      = yearLastYearInterest + sumLaterMaturityAnnualInterest;
        araFY           = principalFY + interestFY;
        costFY          = yearCost;
        araBeforeFY        = beforeARAByYear[year] ?? "";
        araMinusDaraBefore = typeof araBeforeFY === "number" ? araBeforeFY - DARA : "";
        araAfterFY         = postARAByYear[year] ?? "";
        araMinusDaraAfter  = typeof araAfterFY === "number" ? araAfterFY - DARA : "";
      }

      if (bt && cusip === bt.targetCUSIP) {
        targetQty  = bt.targetQty;
        qtyDelta   = bt.qtyDelta;
        targetCost = bt.targetCost;
        costDelta  = bt.costDelta;
        if (bt.isBracket) {
          excessBefore = bt.currentExcessCost;
          excessAfter  = (bt.postRebalQty - bt.targetFYQty) * bt.costPerBond;
        }
      }

      const coupon  = bond?.coupon  ?? 0;
      const baseCpi = bond?.baseCpi ?? refCPI;
      const indexRatio = refCPI / baseCpi;
      if (!outputLaterMaturityInterest[year]) outputLaterMaturityInterest[year] = 0;
      const currentQty = holding?.qty ?? 0;
      outputLaterMaturityInterest[year] += currentQty * 1000 * indexRatio * coupon;

      results.unshift([
        cusip, currentQty, maturity ? fmtDate(maturity) : "", fy,
        principalFY, interestFY, araFY, costFY,
        targetQty, qtyDelta, targetCost, costDelta,
        araBeforeFY, araMinusDaraBefore, araAfterFY, araMinusDaraAfter,
        excessBefore, excessAfter,
      ]);
    }
  }

  const costDeltaSum = results.reduce((sum, row) => sum + (typeof row[11] === 'number' ? row[11] : 0), 0);
  const totalCash = initialCash + costDeltaSum;

  // Weight summary
  const lowerPrice       = lowerBond?.price ?? 0;
  const lowerBaseCpi     = lowerBond?.baseCpi ?? refCPI;
  const lowerCostPerBond = lowerPrice / 100 * (refCPI / lowerBaseCpi) * 1000;
  const upperPrice       = upperBond?.price ?? 0;
  const upperBaseCpi     = upperBond?.baseCpi ?? refCPI;
  const upperCostPerBond = upperPrice / 100 * (refCPI / upperBaseCpi) * 1000;

  const lowerCurrentExcess = buySellTargets[brackets.lowerYear]?.currentExcessCost;
  const upperCurrentExcess = buySellTargets[brackets.upperYear]?.currentExcessCost;
  const totalCurrentExcess = (lowerCurrentExcess ?? 0) + (upperCurrentExcess ?? 0);

  const lowerPostQty     = buySellTargets[brackets.lowerYear]?.postRebalQty ?? 0;
  const upperPostQty     = buySellTargets[brackets.upperYear]?.postRebalQty ?? 0;
  const lowerTargetFYQty = buySellTargets[brackets.lowerYear]?.targetFYQty ?? 0;
  const upperTargetFYQty = buySellTargets[brackets.upperYear]?.targetFYQty ?? 0;
  const lowerExcessQty   = lowerPostQty - lowerTargetFYQty;
  const upperExcessQty   = upperPostQty - upperTargetFYQty;
  const lowerExcessCost  = lowerExcessQty * lowerCostPerBond;
  const upperExcessCost  = upperExcessQty * upperCostPerBond;
  const totalExcessCost  = lowerExcessCost + upperExcessCost;

  const beforeLowerWeight = (totalCurrentExcess > 0 && lowerCurrentExcess !== undefined) ? lowerCurrentExcess / totalCurrentExcess : null;
  const beforeUpperWeight = (totalCurrentExcess > 0 && upperCurrentExcess !== undefined) ? upperCurrentExcess / totalCurrentExcess : null;
  const afterLowerWeight  = totalExcessCost   > 0 ? lowerExcessCost   / totalExcessCost   : null;
  const afterUpperWeight  = totalExcessCost   > 0 ? upperExcessCost   / totalExcessCost   : null;

  const HDR = ['CUSIP','Qty','Maturity','FY','Principal','Interest','ARA','Cost',
               'Target Qty','Qty Delta','Target Cost','Cost Delta',
               'ARA (Before)','ARA-DARA Before','ARA (After)','ARA-DARA After',
               'Excess $ Before','Excess $ After'];

  const summary = {
    settleDateDisp, refCPI, DARA, inferredDARA, method,
    firstYear, lastYear, rungCount, gapYears,
    gapParams, brackets,
    lowerDuration, upperDuration, lowerWeight, upperWeight,
    beforeLowerWeight, beforeUpperWeight, afterLowerWeight, afterUpperWeight,
    costDeltaSum, initialCash, totalCash,
  };

  return { results, HDR, summary };
}

/**
 * @param {number[]} gapYears 
 * @param {Holding[]} holdings 
 * @param {Record<number, {holdings: Holding[]}>} yearInfo 
 * @param {Record<number, TIPS_Bond[]>} tipsByYear
 * @returns {Brackets}
 */
export function identifyBrackets(gapYears, holdings, yearInfo, tipsByYear) {
  // 1. Find Upper Bracket (Dynamic: Target 2040, but pick closest available)
  const targetUpperYear = 2040;
  /** @type {number|null} */
  let upperYear = null;
  /** @type {Date|null} */
  let upperMaturity = null;
  /** @type {string|null} */
  let upperCUSIP = null;

  // Search around 2040 for any bond
  const sortedTipsYears = Object.keys(tipsByYear).map(Number).sort((a, b) => a - b);
  if (sortedTipsYears.length > 0) {
    // Pick the one closest to 2040
    upperYear = sortedTipsYears.reduce((prev, curr) => 
      Math.abs(curr - targetUpperYear) < Math.abs(prev - targetUpperYear) ? curr : prev
    );
    const bonds = tipsByYear[upperYear];
    const febBond = bonds.find(b => b.maturity?.getMonth() === 1);
    const bond = febBond || bonds[0];
    upperCUSIP = bond.cusip;
    upperMaturity = bond.maturity ?? null;
  }

  // 2. Find Lower Bracket (Holdings preferred, then market)
  const minGapYear = (gapYears && gapYears.length > 0) ? Math.min(...gapYears) : 9999;
  /** @type {number|null} */
  let lowerYear = null;
  /** @type {Date|null} */
  let lowerMaturity = null;
  /** @type {string|null} */
  let lowerCUSIP = null;
  let maxQty = -1;

  for (const h of holdings) {
    const year = h.year ?? 0;
    if (year >= LOWEST_LOWER_BRACKET_YEAR && year < minGapYear && h.qty > maxQty) {
      maxQty = h.qty;
      lowerYear = year;
      lowerMaturity = h.maturity ?? null;
      lowerCUSIP = h.cusip;
    }
  }
  
  if (!lowerCUSIP) {
    for (let y = Math.min(minGapYear - 1, 2035); y >= LOWEST_LOWER_BRACKET_YEAR; y--) {
      if (tipsByYear[y]) {
        const bonds = tipsByYear[y];
        const febBond = bonds.find(b => b.maturity?.getMonth() === 1);
        const bond = febBond || bonds[0];
        lowerYear = y;
        lowerCUSIP = bond.cusip;
        lowerMaturity = bond.maturity ?? null;
        break;
      }
    }
  }

  if (!lowerYear || !lowerMaturity || !lowerCUSIP || !upperMaturity || !upperCUSIP) {
    throw new Error(`Could not find suitable coverage brackets in market data. (Found Lower: ${lowerYear}, Upper: ${upperYear})`);
  }

  return { lowerYear, lowerMaturity, lowerCUSIP, upperYear, upperMaturity, upperCUSIP };
}
