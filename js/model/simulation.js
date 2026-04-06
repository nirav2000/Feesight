/**
 * Simulation model module.
 * Boundaries: pure calculations only (no DOM, no storage, no network).
 */

export const FUND_LIBRARY = {
  VUAG:{label:'Vanguard S&P 500 UCITS ETF (VUAG)',type:'equity',currency:'USD base / GBP line available',ocf:0.07,sourceNote:'Vanguard factsheet, net of expenses, 12-month returns aligned to school-year style periods ending Aug.',sourceUrl:'https://fund-docs.vanguard.com/SandP_500_UCITS_ETF_USD_Accumulating_9694_EU_INT_UK_EN.pdf',returnLabels:['01 Sep 2020–31 Aug 2021','01 Sep 2021–31 Aug 2022','01 Sep 2022–31 Aug 2023','01 Sep 2023–31 Aug 2024','01 Sep 2024–31 Aug 2025','01 Sep 2025–31 Aug 2026'],returns:[30.92,16.07,-7.97,30.07,18.09,16.69]},
  VWRP:{label:'Vanguard FTSE All-World UCITS ETF (VWRP)',type:'equity',currency:'USD base / GBP line available',ocf:0.19,sourceNote:'Vanguard factsheet, net of expenses, 12-month returns aligned to school-year style periods ending Aug.',sourceUrl:'https://fund-docs.vanguard.com/FTSE_All-World_UCITS_ETF_USD_Accumulating_9679_EU_INT_UK_EN.pdf',returnLabels:['01 Sep 2020–31 Aug 2021','01 Sep 2021–31 Aug 2022','01 Sep 2022–31 Aug 2023','01 Sep 2023–31 Aug 2024','01 Sep 2024–31 Aug 2025','01 Sep 2025–31 Aug 2026'],returns:[30.07,7.66,-8.07,22.97,14.86,24.62]},
  ISF:{label:'iShares Core FTSE 100 UCITS ETF (ISF)',type:'equity',currency:'GBP',ocf:0.07,sourceNote:'BlackRock product page, total return in GBP, calendar-year returns plus 1-year total return to 28 Feb 2026.',sourceUrl:'https://www.blackrock.com/uk/individual/products/251795/ishares-ftse-100-ucits-etf-inc-fund',returnLabels:['2021','2022','2023','2024','2025','1y to 28 Feb 2026'],returns:[18.31,4.62,7.80,9.50,25.66,27.89]},
  LS60:{label:'Vanguard LifeStrategy 60% Equity Fund Acc',type:'multi-asset',currency:'GBP',ocf:0.20,sourceNote:'Vanguard factsheet, net of OCF, rolling 12-month returns to 28 Feb 2026.',sourceUrl:'https://fund-docs.vanguard.com/LifeStrategy_60_Equity_Fund_9241_GBP_EN_UK.pdf',returnLabels:['28 Feb 2021','28 Feb 2022','28 Feb 2023','28 Feb 2024','28 Feb 2025','28 Feb 2026'],returns:[9.33,6.26,-4.46,9.25,10.58,13.57]},
  BAL80:{label:'Balanced 80/20 proxy (80% VWRP + 20% Cash)',type:'portfolio',currency:'GBP mixed',ocf:0.15,sourceNote:'App-built proxy using 80% FTSE All-World stored returns plus 20% user cash rate.',sourceUrl:'https://fund-docs.vanguard.com/FTSE_All-World_UCITS_ETF_USD_Accumulating_9679_EU_INT_UK_EN.pdf',returnLabels:['Proxy series'],returns:[]},
  CASH:{label:'100% Cash',type:'cash',currency:'GBP',ocf:0.00,sourceNote:'Uses your input annual cash rate. Default is set to the Bank Rate reference.',sourceUrl:'https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp',returnLabels:['Custom annual rate'],returns:[]}
};

export const ORLEY_ROWS = [
  {year:'2021–22', group:'Reception', feeInput:5007},
  {year:'2022–23', group:'Y1', feeInput:5207},
  {year:'2023–24', group:'Y2', feeInput:5572},
  {year:'2024–25', group:'Y3', feeInput:6222},
  {year:'2025–26', group:'Y4', feeInput:7415},
  {year:'2026–27', group:'Y5', feeInput:8326}
];

// Source datasets: school_full.md and schools_full.md
export const BENCHMARK_FEES = [
  { stage:'Pre-Prep', mts:'£7,792', mtsInc:'—', habs:'£8,413', habsInc:'—', orley:'£6,973', orleyInc:'—', johnLyon:'£5,967', johnLyonInc:'—' },
  { stage:'Prep', mts:'£8,183', mtsInc:'5.0%', habs:'£9,849', habsInc:'17.1%', orley:'£7,415', orleyInc:'6.3%', johnLyon:'£6,790', johnLyonInc:'13.8%' },
  { stage:'Y7–Y8', mts:'£8,183', mtsInc:'0.0%', habs:'£10,423', habsInc:'5.8%', orley:'£8,044', orleyInc:'8.5%', johnLyon:'£9,416', johnLyonInc:'38.7%' },
  { stage:'Y9+', mts:'£10,649', mtsInc:'30.1%', habs:'£10,423', habsInc:'0.0%', orley:'—', orleyInc:'—', johnLyon:'£9,416', johnLyonInc:'0.0%' },
  { stage:'Total to Y8 (Y1–Y8 weighted years)', mts:'£64,682', mtsInc:'', habs:'£77,068', habsInc:'', orley:'£59,694', orleyInc:'', johnLyon:'£57,926', johnLyonInc:'' },
  { stage:'Total incl. Y9+ (Y1–Y9 weighted years)', mts:'£75,331', mtsInc:'', habs:'£87,491', habsInc:'', orley:'—', orleyInc:'', johnLyon:'£67,342', johnLyonInc:'' }
];

export const GCSE_HEADLINES = [
  {
    school:'HABS',
    stats:{
      '2025':{ grade9:'47%', grade98:'73%', grade97:'88%' },
      '2024':{ grade9:'53%', grade98:'78.4%', grade97:'91.5%' },
      '2023':{ grade9:'51.1%', grade98:'73.4%', grade97:'—' },
      '2022':{ grade9:'Not found', grade98:'Not found', grade97:'Not found' }
    }
  },
  {
    school:'MTS',
    stats:{
      '2025':{ grade9:'43%', grade98:'71%', grade97:'88%' },
      '2024':{ grade9:'39%', grade98:'70%', grade97:'87.7%' },
      '2023':{ grade9:'—', grade98:'68.3%', grade97:'86.2%' },
      '2022':{ grade9:'—', grade98:'77.8%', grade97:'93.1%' }
    }
  },
  {
    school:'John Lyon',
    stats:{
      '2025':{ grade9:'17%', grade98:'41%', grade97:'62%' },
      '2024':{ grade9:'20%', grade98:'43%', grade97:'64%' },
      '2023':{ grade9:'Not found', grade98:'Not found', grade97:'Not found' },
      '2022':{ grade9:'Not found', grade98:'Not found', grade97:'Not found' }
    }
  },
  {
    school:'Orley Farm',
    stats:{
      '2025':{ grade9:'N/A', grade98:'N/A', grade97:'N/A' },
      '2024':{ grade9:'N/A', grade98:'N/A', grade97:'N/A' },
      '2023':{ grade9:'N/A', grade98:'N/A', grade97:'N/A' },
      '2022':{ grade9:'N/A', grade98:'N/A', grade97:'N/A' }
    }
  },
  {
    school:'Whitmore High School',
    stats:{
      '2025':{ grade9:'Not published', grade98:'Not published', grade97:'Not published' },
      '2024':{ grade9:'—', grade98:'—', grade97:'74.4% grades 9–4' },
      '2023':{ grade9:'—', grade98:'—', grade97:'74.0% grades 9–4' },
      '2022':{ grade9:'—', grade98:'—', grade97:'82.0% grades 9–4' }
    }
  },
  {
    school:'Nower Hill High School',
    stats:{
      '2025':{ grade9:'Not published', grade98:'Not published', grade97:'Not published' },
      '2024':{ grade9:'Not available', grade98:'Not available', grade97:'Not available' },
      '2023':{ grade9:'Not available', grade98:'Not available', grade97:'Not available' },
      '2022':{ grade9:'Not available', grade98:'Not available', grade97:'Not available' }
    }
  }
];




export const ALEVEL_HEADLINES = [
  {
    school:'HABS',
    stats:{
      '2025':{ astar:'46%', astarA:'79%' },
      '2024':{ astar:'38%', astarA:'75%' },
      '2023':{ astar:'48%', astarA:'81%' },
      '2022':{ astar:'—', astarA:'—' }
    }
  },
  {
    school:'MTS',
    stats:{
      '2025':{ astar:'33%', astarA:'70%' },
      '2024':{ astar:'36%', astarA:'71%' },
      '2023':{ astar:'33%', astarA:'70%' },
      '2022':{ astar:'34%', astarA:'76%' }
    }
  },
  {
    school:'John Lyon',
    stats:{
      '2025':{ astar:'—', astarA:'43%' },
      '2024':{ astar:'12%', astarA:'45%' },
      '2023':{ astar:'—', astarA:'—' },
      '2022':{ astar:'—', astarA:'—' }
    }
  },
  {
    school:'Harrow School',
    stats:{
      '2025':{ astar:'~33%', astarA:'65%' },
      '2024':{ astar:'32%', astarA:'67%' },
      '2023':{ astar:'~33%', astarA:'60%' },
      '2022':{ astar:'40%', astarA:'—' }
    }
  },
  {
    school:'Pinner High',
    stats:{
      '2025':{ astar:'—', astarA:'22%' },
      '2024':{ astar:'—', astarA:'~25%' },
      '2023':{ astar:'—', astarA:'30%' },
      '2022':{ astar:'—', astarA:'—' }
    }
  }
];
export const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;


const COMPARATOR_YEARS = ['2025–26','2026–27','2027–28','2028–29','2029–30','2030–31','2031–32','2032–33','2033–34','2034–35'];
const COMPARATOR_GROUPS = ['Reception','Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9'];
const rowsFromStageFees = ({ prePrep, prep, upper, senior })=> COMPARATOR_GROUPS.map((group, idx)=>{
  const feeInput = idx <= 2 ? prePrep : idx <= 6 ? prep : idx <= 8 ? upper : senior;
  return { year: COMPARATOR_YEARS[idx], group, feeInput };
});

export const SAMPLE_SCHOOL_ROWS = {
  'Merchant Taylors School': rowsFromStageFees({ prePrep: 7792, prep: 8183, upper: 8183, senior: 10649 }),
  'Haberdashers Boys': rowsFromStageFees({ prePrep: 8413, prep: 9849, upper: 10423, senior: 10423 }),
  'The John Lyon School': rowsFromStageFees({ prePrep: 5967, prep: 6790, upper: 9416, senior: 9416 }),
  'Orley Farm School': rowsFromStageFees({ prePrep: 6973, prep: 7415, upper: 8044, senior: 8044 })
};
export const deepCopy = o => JSON.parse(JSON.stringify(o));
export const YEAR_GROUP_AGE_MAP = {
  Reception:'4+',
  Y1:'5+',
  Y2:'6+',
  Y3:'7+',
  Y4:'8+',
  Y5:'9+',
  Y6:'10+',
  Y7:'11+',
  Y8:'12+',
  Y9:'13+',
  Y10:'14+',
  Y11:'15+',
  Y12:'16+',
  Y13:'17+'
};
export const YEAR_GROUP_ORDER = ['Reception','Y1','Y2','Y3','Y4','Y5','Y6','Y7','Y8','Y9','Y10','Y11','Y12','Y13'];
const UPPER_TO_SENIOR_EXTRA_UPLIFT = 0.30; // +30 percentage points on top of baseline annual increase
export function normalizeYearGroup(group){
  const raw = String(group || '').trim();
  if(!raw) return raw;
  if(/^reception\b/i.test(raw)) return 'Reception';
  const yearMatch = raw.match(/\bY\s*([0-9]{1,2})\b/i);
  if(yearMatch) return `Y${Number(yearMatch[1])}`;
  return raw;
}
export function formatYearGroupLabel(group){
  const key = normalizeYearGroup(group);
  const age = YEAR_GROUP_AGE_MAP[key];
  return age ? `${key} - ${age}` : key;
}

export function getFundData(key, cashRate){
  if (key === 'CASH') return {...FUND_LIBRARY.CASH, returns:[cashRate], returnLabels:['Custom annual cash rate']};
  if (key === 'BAL80') return {...FUND_LIBRARY.BAL80, returns:FUND_LIBRARY.VWRP.returns.map(r=> r*0.8 + cashRate*0.2), returnLabels:FUND_LIBRARY.VWRP.returnLabels};
  return FUND_LIBRARY[key];
}
export function annualReturnsForRows(fund, count, cashRate){
  if (fund.type === 'cash') return Array.from({length:count},()=>cashRate);
  const src = fund.returns.length ? fund.returns : [0];
  return Array.from({length:count},(_,i)=>src[i % src.length]);
}
export function avgFeeIncrease(rows){ const ch=[]; for(let i=1;i<rows.length;i++) ch.push(rows[i].fee/rows[i-1].fee - 1); return avg(ch); }
export function extendRows(rows, endGroup){
  const order = YEAR_GROUP_ORDER;
  const out = deepCopy(rows).map(r=>({ ...r, group: normalizeYearGroup(r.group) }));
  const g = avgFeeIncrease(rows);
  let prev = out[out.length-1];
  const startIdx = order.indexOf(normalizeYearGroup(prev.group));
  const endIdx = order.indexOf(normalizeYearGroup(endGroup));
  if(startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return {rows:out, avgIncrease:g};
  for(let idx=startIdx+1; idx<=endIdx; idx++){
    const y0 = Number(prev.year.slice(0,4)) + 1;
    const y1 = String(y0+1).slice(2);
    const nextGroup = order[idx];
    const transitionUpliftApplied = prev.group === 'Y8' && nextGroup === 'Y9';
    const appliedIncrease = g + (transitionUpliftApplied ? UPPER_TO_SENIOR_EXTRA_UPLIFT : 0);
    const fee = Math.round(prev.fee * (1 + appliedIncrease));
    prev = {
      year:`${y0}–${y1}`,
      group:nextGroup,
      fee,
      estimated:true,
      appliedIncrease,
      transitionUpliftApplied
    };
    out.push(prev);
  }
  return {rows:out, avgIncrease:g};
}
export function updatedComparison(rows, fund, cashRate){
  const rets = annualReturnsForRows(fund, rows.length, cashRate).map(v=>v/100); let cumFees = 0, fundValue = 0;
  return rows.map((r,i)=>{ cumFees += r.fee; fundValue = (fundValue + r.fee) * (1 + rets[i]); const prevFee = i ? rows[i-1].fee : null;
    const feeDelta = prevFee ? (r.fee/prevFee - 1) * 100 : null; const startBeforeGrowth = fundValue / (1 + rets[i]); const annualGrowth = fundValue - startBeforeGrowth; const gainVsFees = fundValue - cumFees;
    return {...r, feeDelta, cumFees, fundValue, annualGrowth, returnPct:rets[i]*100, gainVsFees};
  });
}
export function summaryFromComparison(comp){ return { totalFees: comp.at(-1)?.cumFees || 0, finalFundValue: comp.at(-1)?.fundValue || 0, totalGainVsFees: comp.at(-1)?.gainVsFees || 0, totalAnnualGrowth: comp.reduce((s,r)=>s+r.annualGrowth,0), avgSchoolFeeIncrease: avg(comp.map(r=>r.feeDelta).filter(v=>v!==null)), avgFundReturn: avg(comp.map(r=>r.returnPct)) }; }
export function termRate(rAnnual){ return Math.pow(1+rAnnual,1/3)-1; }
export function termStructure(rows, remainingTermsInFirst, annualReturns){
  const terms=[]; rows.forEach((row,idx)=>{ const names = idx===0 ? (remainingTermsInFirst===1?['Summer']:remainingTermsInFirst===2?['Spring','Summer']:['Autumn','Spring','Summer']) : ['Autumn','Spring','Summer']; const tr = termRate((annualReturns[idx]||0)/100); names.forEach(name=>terms.push({year:row.year, group:row.group, term:name, fee:row.fee/3, tr})); }); return terms;
}
export function runDecum(startCapital, terms){ let bal = startCapital; return terms.map(t=>{ const start=bal; bal-=t.fee; const afterFee=bal; bal*=1+t.tr; return {...t,start,afterFee,end:bal,growth:bal-afterFee}; }); }
export function requiredCapitalForExactSequence(terms){ let bal=0; for(let i=terms.length-1;i>=0;i--) bal = (bal + terms[i].fee) / (1 + terms[i].tr); return bal; }
export function quantile(arr,q){ const a=arr.slice().sort((x,y)=>x-y); if(!a.length) return 0; const pos=(a.length-1)*q, base=Math.floor(pos), rest=pos-base; return a[base+1]!==undefined ? a[base] + rest*(a[base+1]-a[base]) : a[base]; }
export function bootstrapSuccess(startCapital, remainingRows, remainingTermsInFirst, fund, simulations, cashRate){
  const src = annualReturnsForRows(fund, Math.max(1, fund.returns.length || 1), cashRate); let success = 0; const ends=[];
  for(let s=0;s<simulations;s++){
    const sampledAnnual = remainingRows.map(()=>src[Math.floor(Math.random()*src.length)]);
    const dec = runDecum(startCapital, termStructure(remainingRows, remainingTermsInFirst, sampledAnnual));
    const minAfter = Math.min(...dec.map(r=>r.afterFee)); const end = dec.at(-1)?.end || 0; if(minAfter >= -1e-9 && end >= -1e-9) success++; ends.push(end);
  }
  return {success: success/simulations, medianEnd: quantile(ends,0.5), p10End: quantile(ends,0.1), p90End: quantile(ends,0.9)};
}
export function probabilityCurve(remainingRows, remainingTermsInFirst, fund, simulations, min,max,step,cashRate){ const pts=[]; for(let c=min;c<=max;c+=step){ const r=bootstrapSuccess(c, remainingRows, remainingTermsInFirst, fund, simulations, cashRate); pts.push({capital:c, success:r.success, medianEnd:r.medianEnd}); } return pts; }
