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

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sanitizeExternalUrl = rawUrl => {
  if(!rawUrl) return '';
  try{
    const parsed = new URL(rawUrl, window.location.href);
    if(parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  }catch(_err){ return ''; }
  return '';
};

export function populateFundMeta(fund, effectiveReturns){
  const fundMeta = document.getElementById('fundMeta');
  fundMeta.replaceChildren();

  const kpis = document.createElement('div');
  kpis.className = 'kpis';
  [['Fund used', fund.label], ['Charge used', `${fmt1(fund.ocf)}%`], ['Average stored return', pct(avg(effectiveReturns))]].forEach(([label, value])=>{
    const kpi = document.createElement('div'); kpi.className = 'kpi';
    const muted = document.createElement('div'); muted.className = 'muted'; muted.textContent = label;
    const v = document.createElement('div'); v.className = 'v'; // Trust boundary: fund metadata can include remotely maintained text values.
    v.textContent = value;
    kpi.append(muted, v);
    kpis.appendChild(kpi);
  });
  const sourceNote = document.createElement('p'); sourceNote.style.marginTop = '10px'; sourceNote.textContent = fund.sourceNote || '';
  const sourceP = document.createElement('p'); sourceP.className = 'source'; sourceP.append('Source: ');
  const sourceLink = document.createElement('a');
  // Trust boundary: source URL points to external docs and may be untrusted input.
  const safeSourceUrl = sanitizeExternalUrl(fund.sourceUrl);
  sourceLink.href = safeSourceUrl || '#'; sourceLink.target = '_blank'; sourceLink.rel = 'noopener'; sourceLink.textContent = safeSourceUrl || 'Unavailable';
  sourceP.appendChild(sourceLink);
  fundMeta.append(kpis, sourceNote, sourceP);

  const table = document.getElementById('fundDataTable');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Period','Return used'].forEach(text=>{ const th = document.createElement('th'); th.textContent = text; headRow.appendChild(th); });
  thead.appendChild(headRow);
  const tbody = document.createElement('tbody');
  if(fund.returns.length){
    fund.returnLabels.forEach((label,i)=>{ const tr = document.createElement('tr'); const td1 = document.createElement('td'); td1.textContent = label; const td2 = document.createElement('td'); td2.textContent = pct(fund.returns[i]); tr.append(td1, td2); tbody.appendChild(tr); });
  } else {
    const tr = document.createElement('tr'); const td1 = document.createElement('td'); td1.textContent = 'Custom annual cash rate'; const td2 = document.createElement('td'); td2.textContent = pct(effectiveReturns[0] || 0); tr.append(td1, td2); tbody.appendChild(tr);
  }
  table.replaceChildren(thead, tbody);
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

export function renderUpdatedTable(comp, fund){
  const comparisonMeta = document.getElementById('comparisonMeta');
  comparisonMeta.replaceChildren();
  [{label:'Fund', value:fund.label},{label:'Rows analysed', value:String(comp.length)}].forEach(item=>{ const span = document.createElement('span'); span.className = 'pill'; span.textContent = `${item.label}: ${item.value}`; comparisonMeta.appendChild(span); });

  const avgYoY = avg(comp.map(r=>r.feeDelta).filter(v=>v!==null));
  const avgFund = avg(comp.map(r=>r.returnPct));
  const totalGrowth = comp.reduce((s,r)=>s+r.annualGrowth,0);

  const table = document.getElementById('updatedTable');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Year','Year group','Annual fees','School fee % Δ YoY','Cumulative fees',`${fund.label} value`,`Annual ${fund.type==='cash'?'interest':'fund growth'}`,`${fund.label} YoY %`,'Total gain vs fees'].forEach(text=>{ const th = document.createElement('th'); th.textContent = text; headRow.appendChild(th); });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  comp.forEach(r=>{
    const tr = document.createElement('tr');
    [r.year, r.group, money(r.fee), r.feeDelta===null?'—':pct(r.feeDelta), money(r.cumFees), money(r.fundValue), money(r.annualGrowth), pct(r.returnPct), money(r.gainVsFees)].forEach((cell,idx)=>{ const td = document.createElement('td'); td.textContent = cell; if(idx===6) td.className = r.annualGrowth>=0?'good':'bad'; if(idx===7) td.className = r.returnPct>=0?'good':'bad'; if(idx===8) td.className = r.gainVsFees>=0?'good':'bad'; tr.appendChild(td); });
    tbody.appendChild(tr);
  });
  const totalsTr = document.createElement('tr');
  const first = document.createElement('td'); first.colSpan = 2; const firstStrong = document.createElement('strong'); firstStrong.textContent = 'Total / Average'; first.appendChild(firstStrong); totalsTr.appendChild(first);
  [money(comp.reduce((s,r)=>s+r.fee,0)), pct(avgYoY), money(comp.at(-1)?.cumFees || 0), money(comp.at(-1)?.fundValue || 0), money(totalGrowth), pct(avgFund), money(comp.at(-1)?.gainVsFees || 0)].forEach(text=>{ const td = document.createElement('td'); const strong = document.createElement('strong'); strong.textContent = text; td.appendChild(strong); totalsTr.appendChild(td); });
  tbody.appendChild(totalsTr);
  table.replaceChildren(thead, tbody);
}

export function renderSummaryTable(s, fund){
  const summaryMeta = document.getElementById('summaryMeta');
  summaryMeta.replaceChildren();
  const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = `Fund: ${fund.label}`; summaryMeta.appendChild(pill);
  const tbody = document.createElement('tbody');
  [['Total fees paid', money(s.totalFees)],[`Final ${fund.type==='cash'?'cash':'fund'} value`, money(s.finalFundValue)],['Total gain vs fees', money(s.totalGainVsFees)],[`Total annual ${fund.type==='cash'?'interest':'growth'}`, money(s.totalAnnualGrowth)],['Average school fee increase', pct(s.avgSchoolFeeIncrease)],['Average fund return', pct(s.avgFundReturn)]].forEach(([label,value])=>{ const tr = document.createElement('tr'); const td1 = document.createElement('td'); td1.textContent = label; const td2 = document.createElement('td'); td2.textContent = value; tr.append(td1, td2); tbody.appendChild(tr); });
  document.getElementById('summaryTable').replaceChildren(tbody);
}

export function renderExtendedTable(baseRows, extRows, avgInc){
  const meta = document.getElementById('extendedMeta');
  meta.replaceChildren();
  const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = `Average fee increase used for extensions: ${pct(avgInc*100)}`; meta.appendChild(pill);
  const table = document.getElementById('extendedTable');
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  ['Academic year','Year group','Annual fee','Basis'].forEach(text=>{ const th = document.createElement('th'); th.textContent = text; trHead.appendChild(th); });
  thead.appendChild(trHead);
  const tbody = document.createElement('tbody');
  extRows.forEach((r,i)=>{ const tr = document.createElement('tr'); [r.year, r.group, money(r.fee), i<baseRows.length?'Entered fee':`Estimated using average increase ${pct(avgInc*100)}`].forEach(text=>{ const td = document.createElement('td'); td.textContent = text; tr.appendChild(td); }); tbody.appendChild(tr); });
  table.replaceChildren(thead, tbody);
}

export function renderCurve(points, fund){
  const W=760,H=340,m={t:18,r:16,b:38,l:52}, iw=W-m.l-m.r, ih=H-m.t-m.b;
  const xMin=Math.min(...points.map(p=>p.capital)), xMax=Math.max(...points.map(p=>p.capital));
  const x=v=>m.l+(v-xMin)/(xMax-xMin||1)*iw, y=v=>m.t+(1-v)*ih;
  const path = points.map((p,i)=>`${i?'L':'M'}${x(p.capital).toFixed(1)},${y(p.success).toFixed(1)}`).join(' ');
  let gy=''; [0,0.25,0.5,0.75,1].forEach(v=>{ gy += `<line x1="${m.l}" y1="${y(v)}" x2="${W-m.r}" y2="${y(v)}" stroke="#e7edf6"/><text x="${m.l-8}" y="${y(v)+4}" text-anchor="end" font-size="12" fill="#667085">${Math.round(v*100)}%</text>`; });
  const xt = points.filter((_,i)=>i===0 || i===points.length-1 || i%2===0).map(p=>`<text x="${x(p.capital)}" y="${H-12}" text-anchor="middle" font-size="12" fill="#667085">${Math.round(p.capital/1000)}k</text>`).join('');
  document.getElementById('curveMeta').innerHTML = `<span class="pill">Fund: ${escapeHtml(fund.label)}</span><span class="pill">Curve points: ${points.length}</span>`;
  document.getElementById('curveWrap').innerHTML = `<svg viewBox="0 0 ${W} ${H}">${gy}<line x1="${m.l}" y1="${H-m.b}" x2="${W-m.r}" y2="${H-m.b}" stroke="#94a3b8"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H-m.b}" stroke="#94a3b8"/><path d="${path}" fill="none" stroke="#2952cc" stroke-width="3"/>${points.map(p=>`<circle cx="${x(p.capital)}" cy="${y(p.success)}" r="3" fill="#2952cc"><title>${money(p.capital)} · ${pct(p.success*100)}</title></circle>`).join('')}${xt}<text x="${W/2}" y="${H-2}" text-anchor="middle" font-size="12" fill="#667085">Starting capital</text><text x="16" y="${H/2}" transform="rotate(-90 16 ${H/2})" text-anchor="middle" font-size="12" fill="#667085">Probability of success</text></svg>`;
}

export function renderStressTable(rows, totalFees, fund){
  const stressMeta = document.getElementById('stressMeta');
  stressMeta.replaceChildren();
  [{label:'Fund', value:fund.label},{label:'Reference fees', value:money(totalFees)}].forEach(item=>{ const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = `${item.label}: ${item.value}`; stressMeta.appendChild(pill); });
  const table = document.getElementById('stressTable');
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  ['Scenario','Return basis','Required start','% of fees','Diff vs fees','Fund left','Outcome'].forEach(text=>{ const th = document.createElement('th'); th.textContent = text; trHead.appendChild(th); });
  thead.appendChild(trHead);
  const tbody = document.createElement('tbody');
  rows.forEach(r=>{ const tr = document.createElement('tr'); [r.name, r.returnRef, money(r.requiredStart), `${fmt1((r.requiredStart/totalFees)*100)}%`, money(r.requiredStart-totalFees), money(r.endBalance), r.outcome].forEach((cell,idx)=>{ const td = document.createElement('td'); td.textContent = cell; if(idx===4) td.className = (r.requiredStart-totalFees)<=0?'good':'bad'; tr.appendChild(td); }); tbody.appendChild(tr); });
  table.replaceChildren(thead, tbody);
}

export function renderTermTable(rows, fund){
  const termMeta = document.getElementById('termMeta');
  termMeta.replaceChildren();
  [`Fund: ${fund.label}`,'Drawdowns at term start'].forEach(text=>{ const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = text; termMeta.appendChild(pill); });
  const table = document.getElementById('termTable');
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  ['Year','Group','Term','Start','Fee draw','After fee','Term growth','End'].forEach(text=>{ const th = document.createElement('th'); th.textContent = text; trHead.appendChild(th); });
  thead.appendChild(trHead);
  const tbody = document.createElement('tbody');
  rows.forEach(r=>{ const tr = document.createElement('tr'); [r.year, r.group, r.term, money(r.start), money(r.fee), money(r.afterFee), money(r.growth), money(r.end)].forEach((value,idx)=>{ const td = document.createElement('td'); td.textContent = value; if(idx===6) td.className = r.growth>=0?'good':'bad'; tr.appendChild(td); }); tbody.appendChild(tr); });
  table.replaceChildren(thead, tbody);
}

export function setKpis(items){
  const container = document.getElementById('todayKpis');
  container.replaceChildren();
  items.forEach(item=>{
    const kpi = document.createElement('div');
    kpi.className = 'kpi';

    const label = document.createElement('div');
    label.className = 'muted';
    label.textContent = item.label;

    const value = document.createElement('div');
    value.className = `v ${item.className || ''}`.trim();
    value.textContent = item.value;

    kpi.append(label, value);
    container.appendChild(kpi);
  });
}
