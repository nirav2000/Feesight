/**
 * App bootstrap/composition module.
 * Boundaries: wire modules, DOM events, state orchestration, and body dataset syncing.
 */

import { ORLEY_ROWS, FUND_LIBRARY, BENCHMARK_FEES, GCSE_HEADLINES, ALEVEL_HEADLINES, deepCopy, avg, getFundData, annualReturnsForRows, extendRows, updatedComparison, summaryFromComparison, termStructure, requiredCapitalForExactSequence, runDecum, probabilityCurve, formatYearGroupLabel, normalizeYearGroup } from '../model/simulation.js';
import { loadDb, saveDb, saveCurrentSchoolRemote, refreshRemoteSchools, normalizeSchoolName, loadLatestRevisionRows } from '../data/schools-store.js';
import { initFirebaseAuth, signInWithGoogle } from '../auth/firebase-auth.js';
import { money, pct, fmt1, populateFundMeta, renderUpdatedTable, renderSummaryTable, renderExtendedTable, renderCurve, renderStressTable, renderTermTable, setKpis, renderBenchmarkTables } from '../ui/renderers.js';

const VERSION_HISTORY_FILE = 'index.versions.json';
const APP_VERSION = '6.3.10';
let SCHOOL_DB = loadDb();
let REMOTE_SCHOOL_INDEX = {};
let FIRESTORE = null; let AUTH = null; let firebaseReady = false; let currentUser = null;
let saveTimer = null; let authInFlight = false; let pendingRemoteSync = false;
let remoteSyncBackoffMs = 5000;
let nextRemoteSyncAt = 0;
const BENCHMARK_DATA_KEY = 'feesight.ui.benchmarkData.v1';

const defaultBenchmarkData = ()=>({ fees: deepCopy(BENCHMARK_FEES), gcse: deepCopy(GCSE_HEADLINES), alevel: deepCopy(ALEVEL_HEADLINES) });
let BENCHMARK_DATA = defaultBenchmarkData();

function debugLog(level, message, data){ const el = document.getElementById('debugConsole'); const ts = new Date().toISOString().replace('T',' ').slice(0,19); const line = document.createElement('div'); line.className = 'line'; line.textContent = `[${ts}] [${level}] ${message}${data ? ` | ${typeof data === 'string' ? data : JSON.stringify(data)}` : ''}`; if(el){ el.prepend(line); while(el.childNodes.length > 100) el.removeChild(el.lastChild); } }
const setStatus = (msg, cls)=>{ const el=document.getElementById('saveStatus'); if(el){ el.className=`status ${cls}`; el.textContent=msg || ''; } };
const setAuthStatus = (msg, cls)=>{ const el=document.getElementById('authStatus'); if(el){ el.className=`status ${cls}`; el.textContent=msg || ''; } };

function syncBodyDatasetFromUiState(){
  const theme = localStorage.getItem('feesight.ui.theme') || 'default';
  const view = localStorage.getItem('feesight.ui.view') || 'current';
  const displayMode = localStorage.getItem('feesight.ui.displayMode') || 'table';
  document.body.dataset.theme = theme;
  document.body.dataset.view = view;
  document.body.dataset.displayMode = displayMode;
}

const getRootPathPrefix = ()=>{ const parts = window.location.pathname.split('/').filter(Boolean); const dirParts = parts.slice(0, -1); const versionsIdx = dirParts.indexOf('versions'); if (versionsIdx === -1) return ''; return '../'.repeat(dirParts.length - versionsIdx); };
const getRootUrl = ()=> new URL(getRootPathPrefix() || '.', window.location.href).href;
const withBust = url => { const u = new URL(url, window.location.href); u.searchParams.set('v', String(Date.now())); return u.toString(); };
function getCurrentAppFile(){ const parts = window.location.pathname.split('/').filter(Boolean); const fileName = parts.at(-1) || 'index.html'; const versionsIdx = parts.indexOf('versions'); if (versionsIdx >= 0 && parts[versionsIdx + 1]) return `versions/${parts[versionsIdx + 1]}/${fileName}`; return fileName; }
async function loadVersionArchive(){
  try{
    const res = await fetch(withBust(`${getRootUrl()}${VERSION_HISTORY_FILE}`), { cache: 'no-store' });
    const archive = await res.json();
    const currentFile = getCurrentAppFile();
    const currentEntry = archive.versions.find(v=>v.appFile===currentFile) || archive.versions.at(-1);
    document.getElementById('versionChip').textContent = `Version: ${currentEntry?.version || APP_VERSION}`;

    const versionList = document.getElementById('versionList');
    versionList.replaceChildren();
    archive.versions.forEach(entry=>{
      const item = document.createElement('div');
      item.className = 'version-item';
      const top = document.createElement('div');
      top.className = 'version-item-head';
      const title = document.createElement('strong');
      title.textContent = entry.label || entry.version;
      const openBtn = document.createElement('button');
      openBtn.className = 'open-version';
      openBtn.dataset.version = entry.version;
      openBtn.textContent = 'Open';
      top.append(title, openBtn);
      const note = document.createElement('div');
      note.className = 'panel-note';
      note.textContent = (entry.changes||[]).join(' • ') || 'No change notes.';
      item.append(top, note);
      versionList.appendChild(item);
    });
    versionList.querySelectorAll('.open-version').forEach(btn=>btn.addEventListener('click', ()=>{
      const entry = archive.versions.find(v=>v.version===btn.dataset.version);
      if(entry && entry.appFile !== currentFile) window.location.href = withBust(`${getRootUrl()}${entry.appFile}`);
    }));
  }catch(err){
    document.getElementById('versionChip').textContent = `Version: ${APP_VERSION}`;
    document.getElementById('versionStatus').textContent = `Version history could not be loaded: ${err.message}`;
  }
}
function sanitizeExternalUrl(rawUrl){ if(!rawUrl) return ''; try{ const parsed = new URL(rawUrl, window.location.href); if(parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href; }catch(_err){ return ''; } return ''; }
function updateUserMenuAvatar(user){
  const btn = document.getElementById('userMenuBtn');
  if(!btn) return;
  if(user?.photoURL){
    const safePhotoUrl = sanitizeExternalUrl(user.photoURL);
    // Trust boundary: profile photo URL comes from remote auth profile data.
    if(safePhotoUrl){
      const img = document.createElement('img');
      img.src = safePhotoUrl;
      img.alt = 'user';
      img.className = 'user-avatar';
      btn.replaceChildren(img);
      return;
    }
  }
  if(user){
    const label = (user.displayName || user.email || 'U').trim().charAt(0).toUpperCase();
    btn.textContent = label || 'U';
  } else btn.textContent = '👤';
}


const PANEL_LAYOUT_KEY = 'feesight.ui.panelLayout.v1';

function getPanelKey(panel, idx){
  return panel.id || panel.querySelector('h2')?.textContent?.trim() || `panel-${idx}`;
}

function savePanelLayout(){
  const main = document.querySelector('.app-main');
  if(!main) return;
  const order = [...main.querySelectorAll(':scope > .panel, :scope > .grid.g2, :scope > footer.panel, :scope > section.panel')]
    .filter(el=>el.classList.contains('panel') || el.classList.contains('app-secondary'))
    .map((el, idx)=>({ key: el.dataset.panelKey || getPanelKey(el, idx), full: el.classList.contains('panel-fullwidth') }));
  localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(order));
  saveUserPrefsRemote();
}

function applyPanelLayout(){
  const main = document.querySelector('.app-main');
  if(!main) return;
  let saved;
  try{ saved = JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY) || '[]'); }catch{ saved = []; }
  if(!Array.isArray(saved) || !saved.length) return;
  const children = [...main.children];
  const map = new Map(children.map((el, idx)=>[el.dataset.panelKey || getPanelKey(el, idx), el]));
  saved.forEach(item=>{
    const el = map.get(item?.key);
    if(!el) return;
    main.appendChild(el);
    if(item?.full) el.classList.add('panel-fullwidth');
  });
}

function initPanelLayoutControls(){
  const main = document.querySelector('.app-main');
  if(!main) return;
  [...main.children].forEach((panel, idx)=>{
    panel.dataset.panelKey = panel.dataset.panelKey || getPanelKey(panel, idx);
    const host = panel.querySelector('.panel-head') || panel;
    if(host.querySelector('.panel-layout-actions')) return;

    const wrap = document.createElement('div');
    wrap.className = 'panel-layout-actions';
    const up = document.createElement('button');
    up.type = 'button'; up.className = 'small'; up.textContent = '↑'; up.title = 'Move up';
    const down = document.createElement('button');
    down.type = 'button'; down.className = 'small'; down.textContent = '↓'; down.title = 'Move down';
    const wide = document.createElement('button');
    wide.type = 'button'; wide.className = 'small'; wide.textContent = '100%'; wide.title = 'Toggle full width';

    up.addEventListener('click', ()=>{ const prev = panel.previousElementSibling; if(prev){ panel.parentElement.insertBefore(panel, prev); savePanelLayout(); } });
    down.addEventListener('click', ()=>{ const next = panel.nextElementSibling; if(next){ panel.parentElement.insertBefore(next, panel); savePanelLayout(); } });
    wide.addEventListener('click', ()=>{ panel.classList.toggle('panel-fullwidth'); savePanelLayout(); });

    wrap.append(up, down, wide);
    host.appendChild(wrap);
  });
  applyPanelLayout();
}


const TOP_TAB_KEY = 'feesight.ui.topTab.v1';

function applyTopTab(tab='all'){
  const sections = [...document.querySelectorAll('.app-main [data-tab-group]')];
  sections.forEach(section=>{
    const visible = tab === 'all' || section.dataset.tabGroup === tab;
    section.classList.toggle('tab-hidden', !visible);
  });
  document.querySelectorAll('#topTabs .tab-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.tab === tab));
  localStorage.setItem(TOP_TAB_KEY, tab);
  saveUserPrefsRemote();

  const first = sections.find(section=>!section.classList.contains('tab-hidden'));
  if(first) first.scrollIntoView({ behavior:'smooth', block:'start' });
}

function initTopTabs(){
  const tabs = document.getElementById('topTabs');
  if(!tabs) return;
  tabs.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click', ()=>applyTopTab(btn.dataset.tab || 'all')));
  const saved = localStorage.getItem(TOP_TAB_KEY) || 'all';
  applyTopTab(saved);
}


function loadBenchmarkData(){
  try{
    const parsed = JSON.parse(localStorage.getItem(BENCHMARK_DATA_KEY) || 'null');
    if(parsed && Array.isArray(parsed.fees) && Array.isArray(parsed.gcse) && Array.isArray(parsed.alevel)) BENCHMARK_DATA = parsed;
  }catch(_err){ BENCHMARK_DATA = defaultBenchmarkData(); }
}
function saveBenchmarkData(){
  localStorage.setItem(BENCHMARK_DATA_KEY, JSON.stringify(BENCHMARK_DATA));
  saveUserPrefsRemote();
}

let benchmarkEditMode = false;
function setBenchmarkCellsEditable(enabled){
  ['benchmarkFeesTable','benchmarkGcseTable','benchmarkAlevelTable'].forEach(id=>{
    document.querySelectorAll(`#${id} tbody td`).forEach(td=>{ td.contentEditable = enabled ? 'true' : 'false'; td.classList.toggle('editable-cell', enabled); });
  });
  const toggleBtn = document.getElementById('toggleBenchmarkEdit');
  if(toggleBtn) toggleBtn.textContent = enabled ? 'Disable table editing' : 'Enable table editing';
}

function addEmptyRow(tableId){
  const table = document.getElementById(tableId);
  if(!table) return;
  const colCount = table.querySelector('thead tr:last-child')?.children.length || table.querySelector('thead tr:first-child')?.children.length || 0;
  const tbody = table.querySelector('tbody');
  if(!tbody || !colCount) return;
  const tr = document.createElement('tr');
  for(let i=0;i<colCount;i++){
    const td = document.createElement('td');
    td.textContent = i===0 ? 'New School' : '—';
    td.contentEditable = benchmarkEditMode ? 'true' : 'false';
    td.classList.toggle('editable-cell', benchmarkEditMode);
    tr.appendChild(td);
  }
  tbody.appendChild(tr);
}

function collectBenchmarkDataFromTables(){
  const fees = [...document.querySelectorAll('#benchmarkFeesTable tbody tr')].map(tr=>{ const tds=[...tr.children].map(td=>td.textContent.trim()); return { stage:tds[0]||'', mts:tds[1]||'', mtsInc:tds[2]||'', habs:tds[3]||'', habsInc:tds[4]||'', orley:tds[5]||'', orleyInc:tds[6]||'', johnLyon:tds[7]||'', johnLyonInc:tds[8]||'' }; }).filter(r=>r.stage);

  const yearsGcse = ['2025','2024','2023','2022'];
  const gcse = [...document.querySelectorAll('#benchmarkGcseTable tbody tr')].map(tr=>{
    const tds=[...tr.children].map(td=>td.textContent.trim());
    const out = { school:tds[0]||'Untitled', stats:{} };
    yearsGcse.forEach((y,idx)=>{ const base = 1 + idx*3; out.stats[y] = { grade9: tds[base] || '—', grade98: tds[base+1] || '—', grade97: tds[base+2] || '—' }; });
    return out;
  }).filter(r=>r.school);

  const yearsA = ['2025','2024','2023','2022'];
  const alevel = [...document.querySelectorAll('#benchmarkAlevelTable tbody tr')].map(tr=>{
    const tds=[...tr.children].map(td=>td.textContent.trim());
    const out = { school:tds[0]||'Untitled', stats:{} };
    yearsA.forEach((y,idx)=>{ const base = 1 + idx*2; out.stats[y] = { astar: tds[base] || '—', astarA: tds[base+1] || '—' }; });
    return out;
  }).filter(r=>r.school);

  return { fees, gcse, alevel };
}

function initBenchmarkTableEditing(){
  loadBenchmarkData();
  const statusEl = document.getElementById('benchmarkEditorStatus');
  const setEditorStatus = (msg, cls='ok')=>{ if(statusEl){ statusEl.className = `status ${cls}`; statusEl.textContent = msg || ''; }};

  document.getElementById('toggleBenchmarkEdit')?.addEventListener('click', ()=>{
    benchmarkEditMode = !benchmarkEditMode;
    setBenchmarkCellsEditable(benchmarkEditMode);
    setEditorStatus(benchmarkEditMode ? 'Table edit mode enabled.' : 'Table edit mode disabled.', 'ok');
  });
  document.getElementById('saveBenchmarkEdits')?.addEventListener('click', ()=>{
    BENCHMARK_DATA = collectBenchmarkDataFromTables();
    saveBenchmarkData();
    build();
    benchmarkEditMode = false;
    setEditorStatus('Benchmark table edits saved.', 'ok');
  });
  document.getElementById('addFeesRow')?.addEventListener('click', ()=>addEmptyRow('benchmarkFeesTable'));
  document.getElementById('addGcseRow')?.addEventListener('click', ()=>addEmptyRow('benchmarkGcseTable'));
  document.getElementById('addAlevelRow')?.addEventListener('click', ()=>addEmptyRow('benchmarkAlevelTable'));
}

async function saveUserPrefsRemote(){
  if(!firebaseReady || !FIRESTORE || !currentUser) return;
  try{
    const panelLayout = localStorage.getItem(PANEL_LAYOUT_KEY);
    const topTab = localStorage.getItem(TOP_TAB_KEY);
    const displayMode = localStorage.getItem('feesight.ui.displayMode');
    await FIRESTORE.setDoc(FIRESTORE.doc(FIRESTORE.db, 'users', currentUser.uid, 'prefs', 'layout'), {
      panelLayout: panelLayout ? JSON.parse(panelLayout) : [],
      topTab: topTab || 'all',
      displayMode: displayMode || 'table',
      benchmarkData: BENCHMARK_DATA,
      updatedAt: new Date().toISOString()
    }, { merge:true });
  }catch(_err){ /* non-blocking */ }
}

async function loadUserPrefsRemote(){
  if(!firebaseReady || !FIRESTORE || !currentUser || !FIRESTORE.getDoc) return;
  try{
    const snap = await FIRESTORE.getDoc(FIRESTORE.doc(FIRESTORE.db, 'users', currentUser.uid, 'prefs', 'layout'));
    const data = snap?.data?.() || null;
    if(!data) return;
    if(Array.isArray(data.panelLayout)) localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(data.panelLayout));
    if(typeof data.topTab === 'string') localStorage.setItem(TOP_TAB_KEY, data.topTab);
    if(typeof data.displayMode === 'string') localStorage.setItem('feesight.ui.displayMode', data.displayMode);
    if(data.benchmarkData && Array.isArray(data.benchmarkData.fees) && Array.isArray(data.benchmarkData.gcse) && Array.isArray(data.benchmarkData.alevel)){
      BENCHMARK_DATA = data.benchmarkData;
      localStorage.setItem(BENCHMARK_DATA_KEY, JSON.stringify(BENCHMARK_DATA));
    }
  }catch(_err){ /* non-blocking */ }
}

const unionSchoolNames = ()=> [...new Set([...Object.keys(SCHOOL_DB.schools), ...Object.keys(REMOTE_SCHOOL_INDEX)])].sort((a,b)=>a.localeCompare(b));
const currentRows = ()=> [...document.querySelectorAll('#feeInputTable tbody tr')].map(tr=>({ year: tr.querySelector('.year').value.trim(), group: tr.querySelector('.group').value.trim(), feeInput: Number(tr.querySelector('.feeInput').value||0) })).filter(r=>r.year && r.group && r.feeInput>0);
const annualRows = ()=> currentRows().map(r=>({year:r.year, group:normalizeYearGroup(r.group), fee: document.getElementById('feeMode').value === 'termly' ? r.feeInput*3 : r.feeInput }));
const schoolPayload = ()=> ({ name: document.getElementById('schoolName').value.trim(), feeMode: document.getElementById('feeMode').value, rows: currentRows(), updatedAt: new Date().toISOString(), source:'user' });

function refreshCurrentRowOptions(){
  const rows = annualRows(); const sel = document.getElementById('currentRow'); const previous = sel.value;
  sel.replaceChildren();
  rows.forEach((r,i)=>{ const option = document.createElement('option'); option.value = String(i); // Trust boundary: row fields are user input.
    option.textContent = `${r.year} · ${formatYearGroupLabel(r.group)}`; if(String(i)===String(previous)) option.selected = true; sel.appendChild(option); });
  if (!sel.value && rows.length) sel.value = String(Math.max(0, rows.length-2));
}
function updateAnnualisedDisplays(){ [...document.querySelectorAll('#feeInputTable tbody tr')].forEach(tr=>{ const input=Number(tr.querySelector('.feeInput').value||0); tr.querySelector('.annualised').textContent = input ? money(input * (document.getElementById('feeMode').value === 'termly' ? 3 : 1)) : '—'; }); }
function rowEl(row){
  const tr = document.createElement('tr');
  const yearTd = document.createElement('td'); const yearInput = document.createElement('input'); yearInput.className='year'; yearInput.type='text'; yearInput.value=row.year||''; yearTd.appendChild(yearInput);
  const groupTd = document.createElement('td'); const groupInput = document.createElement('input'); groupInput.className='group'; groupInput.type='text'; groupInput.value=row.group||''; groupTd.appendChild(groupInput);
  const feeTd = document.createElement('td'); const feeInput = document.createElement('input'); feeInput.className='feeInput mono'; feeInput.type='number'; feeInput.step='1'; feeInput.value=row.feeInput||''; feeTd.appendChild(feeInput);
  const annualisedTd = document.createElement('td'); annualisedTd.className='annualised mono';
  const actionTd = document.createElement('td'); const delBtn = document.createElement('button'); delBtn.className='small del'; delBtn.type='button'; delBtn.textContent='Delete'; actionTd.appendChild(delBtn);
  tr.append(yearTd, groupTd, feeTd, annualisedTd, actionTd);
  tr.querySelector('.del').addEventListener('click', ()=>{ tr.remove(); refreshCurrentRowOptions(); updateAnnualisedDisplays(); queueAutosave(); });
  tr.querySelectorAll('input').forEach(inp=>inp.addEventListener('input', ()=>{ updateAnnualisedDisplays(); refreshCurrentRowOptions(); queueAutosave(); }));
  return tr;
}
function renderFeeRows(rows){
  const tbody = document.querySelector('#feeInputTable tbody');
  tbody.replaceChildren();
  rows.forEach(r=>tbody.appendChild(rowEl(r)));
  document.getElementById('feeValueHeader').textContent = document.getElementById('feeMode').value === 'termly' ? 'Termly Fee (£)' : 'Annual Fee (£)';
  document.getElementById('feeModeBadge').textContent = `Input mode: ${document.getElementById('feeMode').value === 'termly' ? 'Termly fees' : 'Annual fees'}`;
  updateAnnualisedDisplays();
  refreshCurrentRowOptions();
}
function rebuildSchoolPickers(){
  const names = unionSchoolNames();
  const suggestions = document.getElementById('schoolSuggestions');
  suggestions.replaceChildren();
  names.forEach(name=>{ const option = document.createElement('option'); // Trust boundary: names combine local and remote values.
    option.value = name; suggestions.appendChild(option); });
  const currentName = document.getElementById('schoolName')?.value?.trim() || names[0] || 'No school selected';
  document.getElementById('schoolCountBadge').textContent = `🏫 ${currentName}`;
}
function saveCurrentSchoolLocal(){ const p=schoolPayload(); if(!p.name||!p.rows.length) return; SCHOOL_DB.schools[p.name]=p; saveDb(SCHOOL_DB); rebuildSchoolPickers(); }
async function pushRemoteSchool(){
  if(Date.now() < nextRemoteSyncAt) return false;
  const ok = await saveCurrentSchoolRemote({
    firebaseReady,
    FIRESTORE,
    currentUser,
    school: schoolPayload(),
    onWarn:(m)=>setStatus(m,'warn'),
    onStatus:setStatus,
    dbState:SCHOOL_DB,
    onRemoteIndex:(name,meta)=>{REMOTE_SCHOOL_INDEX[name]=meta;}
  });
  pendingRemoteSync = !ok;
  if(ok){
    remoteSyncBackoffMs = 5000;
    nextRemoteSyncAt = 0;
  } else {
    nextRemoteSyncAt = Date.now() + remoteSyncBackoffMs;
    remoteSyncBackoffMs = Math.min(remoteSyncBackoffMs * 2, 120000);
  }
  return ok;
}
function queueAutosave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    saveCurrentSchoolLocal();
    pendingRemoteSync = true;
    setStatus('Syncing pending revision…', 'ok');
    await pushRemoteSchool();
  }, 600);
}

function build(){
  const baseRows = annualRows(); if(!baseRows.length) return;
  const displayMode = document.body.dataset.displayMode || 'table';
  const cashRate = Number(document.getElementById('cashRate').value||0);
  const fund = getFundData(document.getElementById('fundSelect').value, cashRate);
  populateFundMeta(fund, annualReturnsForRows(fund, Math.max(1,fund.returns.length || 1), cashRate), displayMode);
  const ext = extendRows(baseRows, document.getElementById('endGroup').value);
  const comp = updatedComparison(baseRows, fund, cashRate);
  renderUpdatedTable(comp, fund, displayMode);
  renderSummaryTable(summaryFromComparison(comp), fund, displayMode);
  renderExtendedTable(baseRows, ext.rows, ext.avgIncrease, displayMode);

  const remainingRows = ext.rows.slice(Number(document.getElementById('currentRow').value || 0));
  const exactAnnualReturns = annualReturnsForRows(fund, remainingRows.length, cashRate);
  const exactTerms = termStructure(remainingRows, 3, exactAnnualReturns);
  const exactRequired = requiredCapitalForExactSequence(exactTerms);
  renderTermTable(runDecum(exactRequired, exactTerms), fund);

  const curveMin = Number(document.getElementById('capitalMin').value||60000); const curveMax = Number(document.getElementById('capitalMax').value||240000); let curveStep = Number(document.getElementById('capitalStep').value||5000); if(!Number.isFinite(curveStep)||curveStep<=0) curveStep=5000;
  if(curveMax<=curveMin){
    const curveWrap = document.getElementById('curveWrap');
    curveWrap.replaceChildren();
    const warn = document.createElement('div');
    warn.className = 'status warn';
    warn.textContent = 'Curve end capital must be greater than curve start capital.';
    curveWrap.appendChild(warn);
    return;
  }
  const curve = probabilityCurve(remainingRows, 3, fund, Number(document.getElementById('simCount').value||3000), curveMin, curveMax, curveStep, cashRate);
  renderCurve(curve, fund, displayMode);
  const remainingFees = exactTerms.reduce((s,t)=>s+t.fee,0);
  const todayMeta = document.getElementById('todayMeta');
  todayMeta.replaceChildren();
  [
    `Fund: ${fund.label}`,
    `Average school fee increase in data: ${pct(ext.avgIncrease*100)}`
  ].forEach(text=>{
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = text;
    todayMeta.appendChild(pill);
  });
  setKpis([{label:'Remaining fees from selected point', value:money(remainingFees)},{label:'Actual-sequence capital needed', value:money(exactRequired)},{label:'50% success capital', value:curve.find(p=>p.success>=0.5)?.capital?money(curve.find(p=>p.success>=0.5).capital):'Not reached'},{label:'80% success capital', value:curve.find(p=>p.success>=0.8)?.capital?money(curve.find(p=>p.success>=0.8).capital):'Not reached'}]);
  const src = annualReturnsForRows(fund, Math.max(1, remainingRows.length), cashRate); const sorted = src.slice().sort((a,b)=>a-b), reversed=src.slice().sort((a,b)=>b-a), minRet=Math.min(...src), avRet=avg(src);
  const stress = [{name:'Best case actual order', seq: exactAnnualReturns, returnRef:`Actual stored order · avg ${pct(avRet)}`},{name:'Strongest returns first', seq: reversed.slice(0,remainingRows.length), returnRef:'Stored returns reordered best first'},{name:'Average return repeated', seq: remainingRows.map(()=>avRet), returnRef:`Flat ${pct(avRet)}`},{name:'Weakest returns first', seq: sorted.slice(0,remainingRows.length), returnRef:'Stored returns reordered worst first'},{name:'Severe stress', seq: remainingRows.map(()=>minRet), returnRef:`Repeat worst stored return ${pct(minRet)}`}] .map(s=>{ const terms=termStructure(remainingRows, 3, s.seq); const req=requiredCapitalForExactSequence(terms); const end=runDecum(req, terms).at(-1)?.end||0; return {...s, requiredStart:req, endBalance:end, outcome:req<=remainingFees?'Capital-efficient':'Needs more than fees upfront'}; });
  renderStressTable(stress, remainingFees, fund, displayMode);
  renderBenchmarkTables(BENCHMARK_DATA);
}

async function bootstrap(){
  const versionChip = document.getElementById('versionChip');
  if(versionChip) versionChip.textContent = `Version: ${APP_VERSION}`;
  if(window.FeesightUIState?.init) window.FeesightUIState.init();
  syncBodyDatasetFromUiState();
  initPanelLayoutControls();
  initTopTabs();
  initBenchmarkTableEditing();
  document.getElementById('themeSelect').addEventListener('change', e=>{ window.FeesightUIState?.applyTheme?.(e.target.value); syncBodyDatasetFromUiState(); });
  document.getElementById('viewSelect').addEventListener('change', e=>{ window.FeesightUIState?.applyView?.(e.target.value); syncBodyDatasetFromUiState(); });
  const displayModeSelect = document.getElementById('displayModeSelect');
  if(displayModeSelect){
    displayModeSelect.addEventListener('change', e=>{
      window.FeesightUIState?.applyDisplayMode?.(e.target.value);
      syncBodyDatasetFromUiState();
      build();
      saveUserPrefsRemote();
    });
  }

  const fundSelect = document.getElementById('fundSelect');
  fundSelect.replaceChildren();
  Object.entries(FUND_LIBRARY).forEach(([k,v])=>{ const option = document.createElement('option'); option.value = k; option.textContent = v.label; fundSelect.appendChild(option); });
  rebuildSchoolPickers(); loadVersionArchive();
  const defaultSchool = SCHOOL_DB.schools['Orley Farm School']; document.getElementById('schoolName').value='Orley Farm School'; document.getElementById('feeMode').value=(defaultSchool?.feeMode)||'termly'; renderFeeRows(deepCopy((defaultSchool?.rows && defaultSchool.rows.length)? defaultSchool.rows : ORLEY_ROWS));

  document.getElementById('loadOrley').addEventListener('click', ()=>{ document.getElementById('schoolName').value='Orley Farm School'; document.getElementById('feeMode').value='termly'; renderFeeRows(deepCopy(ORLEY_ROWS)); build(); queueAutosave(); });
  document.getElementById('newSchool').addEventListener('click', ()=>{ document.getElementById('schoolName').value=''; document.getElementById('feeMode').value='annual'; renderFeeRows([{year:'',group:'',feeInput:''}]); setStatus('', 'ok'); });
  document.getElementById('addRow').addEventListener('click', ()=>{ document.querySelector('#feeInputTable tbody').appendChild(rowEl({year:'',group:'',feeInput:''})); refreshCurrentRowOptions(); });
  document.getElementById('saveSchool').addEventListener('click', async ()=>{ saveCurrentSchoolLocal(); pendingRemoteSync = true; await pushRemoteSchool(); build(); });
  document.getElementById('recalc').addEventListener('click', build);
  document.getElementById('feeMode').addEventListener('change', ()=>{ renderFeeRows(currentRows()); build(); queueAutosave(); });
  ['fundSelect','cashRate','endGroup','currentRow','capitalMin','capitalMax','capitalStep','simCount'].forEach(id=>document.getElementById(id).addEventListener('input', build));
  document.getElementById('schoolName').addEventListener('change', async ()=>{
    const exact = unionSchoolNames().find(n=>normalizeSchoolName(n)===normalizeSchoolName(document.getElementById('schoolName').value));
    if(exact && SCHOOL_DB.schools[exact]){
      const selected = SCHOOL_DB.schools[exact];
      if((!Array.isArray(selected.rows) || !selected.rows.length) && REMOTE_SCHOOL_INDEX[exact]?.id){
        const rows = await loadLatestRevisionRows({ firebaseReady, FIRESTORE, schoolId: REMOTE_SCHOOL_INDEX[exact].id });
        if(rows.length){
          selected.rows = rows;
          selected.source = 'cloud-shared';
          saveDb(SCHOOL_DB);
        }
      }
      document.getElementById('schoolName').value = selected.name;
      document.getElementById('feeMode').value = selected.feeMode || 'annual';
      renderFeeRows(selected.rows || []);
    }
    queueAutosave();
    build();
  });
  document.getElementById('schoolName').addEventListener('input', ()=>{ rebuildSchoolPickers(); queueAutosave(); });
  document.getElementById('userMenuBtn').addEventListener('click', ()=>document.getElementById('userMenuPop').classList.toggle('open'));
  document.addEventListener('click', e=>{ const pop=document.getElementById('userMenuPop'); const btn=document.getElementById('userMenuBtn'); if(pop && btn && !pop.contains(e.target) && !btn.contains(e.target)) pop.classList.remove('open'); });
  document.getElementById('versionChip').addEventListener('click', ()=>document.getElementById('versionModal').classList.add('open'));
  document.getElementById('closeVersionModal').addEventListener('click', ()=>document.getElementById('versionModal').classList.remove('open'));
  document.getElementById('versionModal').addEventListener('click', e=>{ if(e.target.id==='versionModal') e.currentTarget.classList.remove('open'); });
  setInterval(()=>{ if(currentUser && pendingRemoteSync) pushRemoteSchool(); }, 10000);

  const state = await initFirebaseAuth({ debugLog, onStatus:setStatus, onAuthStatus:setAuthStatus, onReady:(a,f)=>{AUTH=a; FIRESTORE=f; firebaseReady=true;}, onUserChanged: async (user)=>{ currentUser = user; updateUserMenuAvatar(currentUser); if(currentUser){ setAuthStatus(`Signed in as ${currentUser.displayName || currentUser.email || currentUser.uid}. Firestore sync is active.`, 'ok'); await loadUserPrefsRemote(); syncBodyDatasetFromUiState(); applyPanelLayout(); applyTopTab(localStorage.getItem(TOP_TAB_KEY) || 'all'); await refreshRemoteSchools({firebaseReady,FIRESTORE,currentUser,SCHOOL_DB,setRemoteIndex:v=>{REMOTE_SCHOOL_INDEX=v;},onStatus:setStatus,onWarn:m=>setStatus(m,'warn')}); rebuildSchoolPickers(); build(); await pushRemoteSchool(); } else { setAuthStatus('Guest mode. Local saving works; Firestore sync will use anonymous auth unless you sign in with Google.', 'warn'); } } });
  firebaseReady = state.firebaseReady; AUTH = state.AUTH; FIRESTORE = state.FIRESTORE;

  document.getElementById('signInGoogle').addEventListener('click', ()=>signInWithGoogle({ AUTH, authInFlight, setAuthInFlight:v=>{authInFlight=v; document.getElementById('signInGoogle').disabled=v;}, debugLog, setAuthStatus, onUnauthorizedDomain:()=>setAuthStatus(`Google sign-in blocked: ${window.location.hostname || 'file://'} is not an authorised domain in Firebase Auth.`, 'bad') }));
  document.getElementById('signOutBtn').addEventListener('click', async ()=>{ if(AUTH?.signOut && AUTH?.auth){ await AUTH.signOut(AUTH.auth); } });

  build();
}

bootstrap();
