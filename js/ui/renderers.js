/**
 * UI renderer module.
 * Boundaries: DOM/chart rendering only; receives prepared data.
 */

import { avg } from '../model/simulation.js';

export const fmt = n => new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(n);
export const fmt1 = n => new Intl.NumberFormat('en-GB',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
export const money = n => `£${fmt(Math.round(n||0))}`;
export const pct = n => `${n>=0?'+':''}${fmt1(n)}%`;

let fundTrendChart = null;

export function populateFundMeta(fund, effectiveReturns){
  document.getElementById('fundMeta').innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="muted">Fund used</div><div class="v">${fund.label}</div></div>
      <div class="kpi"><div class="muted">Charge used</div><div class="v">${fmt1(fund.ocf)}%</div></div>
      <div class="kpi"><div class="muted">Average stored return</div><div class="v">${pct(avg(effectiveReturns))}</div></div>
    </div>
    <p style="margin-top:10px">${fund.sourceNote}</p>
    <p class="source">Source: <a href="${fund.sourceUrl}" target="_blank" rel="noopener">${fund.sourceUrl}</a></p>`;
  const rows = (fund.returns.length
    ? fund.returnLabels.map((label,i)=>`<tr><td>${label}</td><td>${pct(fund.returns[i])}</td></tr>`).join('')
    : `<tr><td>Custom annual cash rate</td><td>${pct(effectiveReturns[0] || 0)}</td></tr>`);
  document.getElementById('fundDataTable').innerHTML = `<thead><tr><th>Period</th><th>Return used</th></tr></thead><tbody>${rows}</tbody>`;
  renderFundTrendChart(fund, effectiveReturns);
}

export function renderFundTrendChart(fund, effectiveReturns){
  const returns = fund.returns.length ? fund.returns : [effectiveReturns[0] || 0];
  let value = 100;
  const pts = returns.map(r=>{ value*=1+r/100; return value; });
  const labels = returns.map((_,i)=>`Y${i+1}`);
  const canvas = document.getElementById('fundTrendChart');
  if(!canvas || !window.Chart) return;
  if(fundTrendChart) fundTrendChart.destroy();
  fundTrendChart = new window.Chart(canvas, { type:'line', data:{labels, datasets:[{label:'Indexed £100', data:pts, borderColor:'#2952cc', backgroundColor:'rgba(41,82,204,0.15)', tension:0.25, fill:true, pointRadius:2}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, title:{display:true,text:'Indexed growth of £100 using stored annual returns'}}, scales:{x:{grid:{display:false}}, y:{grid:{color:'#e7edf6'}}}} });
}

export function renderUpdatedTable(comp, fund){ /* unchanged presentation */
  document.getElementById('comparisonMeta').innerHTML = `<span class="pill">Fund: ${fund.label}</span><span class="pill">Rows analysed: ${comp.length}</span>`;
  const body = comp.map(r=>`<tr><td>${r.year}</td><td>${r.group}</td><td>${money(r.fee)}</td><td>${r.feeDelta===null?'—':pct(r.feeDelta)}</td><td>${money(r.cumFees)}</td><td>${money(r.fundValue)}</td><td class="${r.annualGrowth>=0?'good':'bad'}">${money(r.annualGrowth)}</td><td class="${r.returnPct>=0?'good':'bad'}">${pct(r.returnPct)}</td><td class="${r.gainVsFees>=0?'good':'bad'}">${money(r.gainVsFees)}</td></tr>`).join('');
  const avgYoY = avg(comp.map(r=>r.feeDelta).filter(v=>v!==null)); const avgFund = avg(comp.map(r=>r.returnPct)); const totalGrowth = comp.reduce((s,r)=>s+r.annualGrowth,0);
  const totals = `<tr><td colspan="2"><strong>Total / Average</strong></td><td><strong>${money(comp.reduce((s,r)=>s+r.fee,0))}</strong></td><td><strong>${pct(avgYoY)}</strong></td><td><strong>${money(comp.at(-1)?.cumFees || 0)}</strong></td><td><strong>${money(comp.at(-1)?.fundValue || 0)}</strong></td><td><strong>${money(totalGrowth)}</strong></td><td><strong>${pct(avgFund)}</strong></td><td><strong>${money(comp.at(-1)?.gainVsFees || 0)}</strong></td></tr>`;
  document.getElementById('updatedTable').innerHTML = `<thead><tr><th>Year</th><th>Year group</th><th>Annual fees</th><th>School fee % Δ YoY</th><th>Cumulative fees</th><th>${fund.label} value</th><th>Annual ${fund.type==='cash'?'interest':'fund growth'}</th><th>${fund.label} YoY %</th><th>Total gain vs fees</th></tr></thead><tbody>${body}${totals}</tbody>`;
}
export function renderSummaryTable(s, fund){ const rows=[['Total fees paid', money(s.totalFees)],[`Final ${fund.type==='cash'?'cash':'fund'} value`, money(s.finalFundValue)],['Total gain vs fees', money(s.totalGainVsFees)],[`Total annual ${fund.type==='cash'?'interest':'growth'}`, money(s.totalAnnualGrowth)],['Average school fee increase', pct(s.avgSchoolFeeIncrease)],['Average fund return', pct(s.avgFundReturn)]].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join(''); document.getElementById('summaryMeta').innerHTML = `<span class="pill">Fund: ${fund.label}</span>`; document.getElementById('summaryTable').innerHTML = `<tbody>${rows}</tbody>`; }
export function renderExtendedTable(baseRows, extRows, avgInc){ document.getElementById('extendedMeta').innerHTML = `<span class="pill">Average fee increase used for extensions: ${pct(avgInc*100)}</span>`; const body = extRows.map((r,i)=>`<tr><td>${r.year}</td><td>${r.group}</td><td>${money(r.fee)}</td><td>${i<baseRows.length?'Entered fee':`Estimated using average increase ${pct(avgInc*100)}`}</td></tr>`).join(''); document.getElementById('extendedTable').innerHTML = `<thead><tr><th>Academic year</th><th>Year group</th><th>Annual fee</th><th>Basis</th></tr></thead><tbody>${body}</tbody>`; }
export function renderCurve(points, fund){ const W=760,H=340,m={t:18,r:16,b:38,l:52}, iw=W-m.l-m.r, ih=H-m.t-m.b; const xMin=Math.min(...points.map(p=>p.capital)), xMax=Math.max(...points.map(p=>p.capital)); const x=v=>m.l+(v-xMin)/(xMax-xMin||1)*iw, y=v=>m.t+(1-v)*ih; const path = points.map((p,i)=>`${i?'L':'M'}${x(p.capital).toFixed(1)},${y(p.success).toFixed(1)}`).join(' '); let gy=''; [0,0.25,0.5,0.75,1].forEach(v=>{ gy += `<line x1="${m.l}" y1="${y(v)}" x2="${W-m.r}" y2="${y(v)}" stroke="#e7edf6"/><text x="${m.l-8}" y="${y(v)+4}" text-anchor="end" font-size="12" fill="#667085">${Math.round(v*100)}%</text>`; }); const xt = points.filter((_,i)=>i===0 || i===points.length-1 || i%2===0).map(p=>`<text x="${x(p.capital)}" y="${H-12}" text-anchor="middle" font-size="12" fill="#667085">${Math.round(p.capital/1000)}k</text>`).join(''); document.getElementById('curveMeta').innerHTML = `<span class="pill">Fund: ${fund.label}</span><span class="pill">Curve points: ${points.length}</span>`; document.getElementById('curveWrap').innerHTML = `<svg viewBox="0 0 ${W} ${H}">${gy}<line x1="${m.l}" y1="${H-m.b}" x2="${W-m.r}" y2="${H-m.b}" stroke="#94a3b8"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H-m.b}" stroke="#94a3b8"/><path d="${path}" fill="none" stroke="#2952cc" stroke-width="3"/>${points.map(p=>`<circle cx="${x(p.capital)}" cy="${y(p.success)}" r="3" fill="#2952cc"><title>${money(p.capital)} · ${pct(p.success*100)}</title></circle>`).join('')}${xt}<text x="${W/2}" y="${H-2}" text-anchor="middle" font-size="12" fill="#667085">Starting capital</text><text x="16" y="${H/2}" transform="rotate(-90 16 ${H/2})" text-anchor="middle" font-size="12" fill="#667085">Probability of success</text></svg>`; }
export function renderStressTable(rows, totalFees, fund){ document.getElementById('stressMeta').innerHTML = `<span class="pill">Fund: ${fund.label}</span><span class="pill">Reference fees: ${money(totalFees)}</span>`; const body = rows.map(r=>`<tr><td>${r.name}</td><td>${r.returnRef}</td><td>${money(r.requiredStart)}</td><td>${fmt1((r.requiredStart/totalFees)*100)}%</td><td class="${(r.requiredStart-totalFees)<=0?'good':'bad'}">${money(r.requiredStart-totalFees)}</td><td>${money(r.endBalance)}</td><td>${r.outcome}</td></tr>`).join(''); document.getElementById('stressTable').innerHTML = `<thead><tr><th>Scenario</th><th>Return basis</th><th>Required start</th><th>% of fees</th><th>Diff vs fees</th><th>Fund left</th><th>Outcome</th></tr></thead><tbody>${body}</tbody>`; }
export function renderTermTable(rows, fund){ document.getElementById('termMeta').innerHTML = `<span class="pill">Fund: ${fund.label}</span><span class="pill">Drawdowns at term start</span>`; const body = rows.map(r=>`<tr><td>${r.year}</td><td>${r.group}</td><td>${r.term}</td><td>${money(r.start)}</td><td>${money(r.fee)}</td><td>${money(r.afterFee)}</td><td class="${r.growth>=0?'good':'bad'}">${money(r.growth)}</td><td>${money(r.end)}</td></tr>`).join(''); document.getElementById('termTable').innerHTML = `<thead><tr><th>Year</th><th>Group</th><th>Term</th><th>Start</th><th>Fee draw</th><th>After fee</th><th>Term growth</th><th>End</th></tr></thead><tbody>${body}</tbody>`; }
export function setKpis(items){ document.getElementById('todayKpis').innerHTML = items.map(k=>`<div class="kpi"><div class="muted">${k.label}</div><div class="v ${k.className||''}">${k.value}</div></div>`).join(''); }
