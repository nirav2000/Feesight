/**
 * App bootstrap/composition module.
 * Boundaries: wire modules, DOM events, state orchestration, and body dataset syncing.
 */

import { ORLEY_ROWS, FUND_LIBRARY, deepCopy, avg, getFundData, annualReturnsForRows, extendRows, updatedComparison, summaryFromComparison, termStructure, requiredCapitalForExactSequence, runDecum, probabilityCurve } from '../model/simulation.js';
import { loadDb, saveDb, saveCurrentSchoolRemote, refreshRemoteSchools, normalizeSchoolName, loadLatestRevisionRows } from '../data/schools-store.js';
import { initFirebaseAuth, signInWithGoogle } from '../auth/firebase-auth.js';
import { money, pct, fmt1, populateFundMeta, renderUpdatedTable, renderSummaryTable, renderExtendedTable, renderCurve, renderStressTable, renderTermTable, setKpis } from '../ui/renderers.js';

const VERSION_HISTORY_FILE = 'index.versions.json';
let SCHOOL_DB = loadDb();
let REMOTE_SCHOOL_INDEX = {};
let FIRESTORE = null; let AUTH = null; let firebaseReady = false; let currentUser = null;
let saveTimer = null; let authInFlight = false; let pendingRemoteSync = false;

function debugLog(level, message, data){ const el = document.getElementById('debugConsole'); const ts = new Date().toISOString().replace('T',' ').slice(0,19); const line = document.createElement('div'); line.className = 'line'; line.textContent = `[${ts}] [${level}] ${message}${data ? ` | ${typeof data === 'string' ? data : JSON.stringify(data)}` : ''}`; if(el){ el.prepend(line); while(el.childNodes.length > 100) el.removeChild(el.lastChild); } }
const setStatus = (msg, cls)=>{ const el=document.getElementById('saveStatus'); if(el){ el.className=`status ${cls}`; el.textContent=msg || ''; } };
const setAuthStatus = (msg, cls)=>{ const el=document.getElementById('authStatus'); if(el){ el.className=`status ${cls}`; el.textContent=msg || ''; } };

function syncBodyDatasetFromUiState(){
  const theme = localStorage.getItem('feesight.ui.theme') || 'default';
  const view = localStorage.getItem('feesight.ui.view') || 'current';
  document.body.dataset.theme = theme;
  document.body.dataset.view = view;
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
    document.getElementById('versionChip').textContent = `Version: ${currentEntry?.version || 'unknown'}`;

    const versionList = document.getElementById('versionList');
    versionList.replaceChildren();
    archive.versions.forEach(entry=>{
      const item = document.createElement('div');
      item.className = 'version-item';
      const top = document.createElement('div');
      top.style.cssText = 'display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap';
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
      img.style.cssText = 'width:22px;height:22px;border-radius:50%;vertical-align:middle';
      btn.replaceChildren(img);
      return;
    }
  }
  if(user){
    const label = (user.displayName || user.email || 'U').trim().charAt(0).toUpperCase();
    btn.textContent = label || 'U';
  } else btn.textContent = '👤';
}

const unionSchoolNames = ()=> [...new Set([...Object.keys(SCHOOL_DB.schools), ...Object.keys(REMOTE_SCHOOL_INDEX)])].sort((a,b)=>a.localeCompare(b));
const currentRows = ()=> [...document.querySelectorAll('#feeInputTable tbody tr')].map(tr=>({ year: tr.querySelector('.year').value.trim(), group: tr.querySelector('.group').value.trim(), feeInput: Number(tr.querySelector('.feeInput').value||0) })).filter(r=>r.year && r.group && r.feeInput>0);
const annualRows = ()=> currentRows().map(r=>({year:r.year, group:r.group, fee: document.getElementById('feeMode').value === 'termly' ? r.feeInput*3 : r.feeInput }));
const schoolPayload = ()=> ({ name: document.getElementById('schoolName').value.trim(), feeMode: document.getElementById('feeMode').value, rows: currentRows(), updatedAt: new Date().toISOString(), source:'user' });

function refreshCurrentRowOptions(){
  const rows = annualRows(); const sel = document.getElementById('currentRow'); const previous = sel.value;
  sel.replaceChildren();
  rows.forEach((r,i)=>{ const option = document.createElement('option'); option.value = String(i); // Trust boundary: row fields are user input.
    option.textContent = `${r.year} · ${r.group}`; if(String(i)===String(previous)) option.selected = true; sel.appendChild(option); });
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
function renderFeeRows(rows){ const tbody = document.querySelector('#feeInputTable tbody'); tbody.innerHTML=''; rows.forEach(r=>tbody.appendChild(rowEl(r))); document.getElementById('feeValueHeader').textContent = document.getElementById('feeMode').value === 'termly' ? 'Termly Fee (£)' : 'Annual Fee (£)'; document.getElementById('feeModeBadge').textContent = `Input mode: ${document.getElementById('feeMode').value === 'termly' ? 'Termly fees' : 'Annual fees'}`; updateAnnualisedDisplays(); refreshCurrentRowOptions(); }
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
async function pushRemoteSchool(){ const ok = await saveCurrentSchoolRemote({ firebaseReady, FIRESTORE, currentUser, school: schoolPayload(), onWarn:(m)=>setStatus(m,'warn'), onStatus:setStatus, dbState:SCHOOL_DB, onRemoteIndex:(name,meta)=>{REMOTE_SCHOOL_INDEX[name]=meta;} }); pendingRemoteSync = !ok; return ok; }
function queueAutosave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async ()=>{
    saveCurrentSchoolLocal();
    pendingRemoteSync = true;
    setStatus('Syncing pending revision…', 'warn');
    await pushRemoteSchool();
  }, 600);
}

function build(){
  const baseRows = annualRows(); if(!baseRows.length) return;
  const cashRate = Number(document.getElementById('cashRate').value||0);
  const fund = getFundData(document.getElementById('fundSelect').value, cashRate);
  populateFundMeta(fund, annualReturnsForRows(fund, Math.max(1,fund.returns.length || 1), cashRate));
  const ext = extendRows(baseRows, document.getElementById('endGroup').value);
  const comp = updatedComparison(baseRows, fund, cashRate);
  renderUpdatedTable(comp, fund); renderSummaryTable(summaryFromComparison(comp), fund); renderExtendedTable(baseRows, ext.rows, ext.avgIncrease);

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
  renderCurve(curve, fund);
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
  renderStressTable(stress, remainingFees, fund);
}

async function bootstrap(){
  if(window.FeesightUIState?.init) window.FeesightUIState.init();
  syncBodyDatasetFromUiState();
  document.getElementById('themeSelect').addEventListener('change', e=>{ window.FeesightUIState?.applyTheme?.(e.target.value); syncBodyDatasetFromUiState(); });
  document.getElementById('viewSelect').addEventListener('change', e=>{ window.FeesightUIState?.applyView?.(e.target.value); syncBodyDatasetFromUiState(); });

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

  const state = await initFirebaseAuth({ debugLog, onStatus:setStatus, onAuthStatus:setAuthStatus, onReady:(a,f)=>{AUTH=a; FIRESTORE=f; firebaseReady=true;}, onUserChanged: async (user)=>{ currentUser = user; updateUserMenuAvatar(currentUser); if(currentUser){ setAuthStatus(`Signed in as ${currentUser.displayName || currentUser.email || currentUser.uid}. Firestore sync is active.`, 'ok'); await refreshRemoteSchools({firebaseReady,FIRESTORE,currentUser,SCHOOL_DB,setRemoteIndex:v=>{REMOTE_SCHOOL_INDEX=v;},onStatus:setStatus,onWarn:m=>setStatus(m,'warn')}); rebuildSchoolPickers(); await pushRemoteSchool(); } else { setAuthStatus('Guest mode. Local saving works; Firestore sync will use anonymous auth unless you sign in with Google.', 'warn'); } } });
  firebaseReady = state.firebaseReady; AUTH = state.AUTH; FIRESTORE = state.FIRESTORE;

  document.getElementById('signInGoogle').addEventListener('click', ()=>signInWithGoogle({ AUTH, authInFlight, setAuthInFlight:v=>{authInFlight=v; document.getElementById('signInGoogle').disabled=v;}, debugLog, setAuthStatus, onUnauthorizedDomain:()=>setAuthStatus(`Google sign-in blocked: ${window.location.hostname || 'file://'} is not an authorised domain in Firebase Auth.`, 'bad') }));
  document.getElementById('signOutBtn').addEventListener('click', async ()=>{ if(AUTH?.signOut && AUTH?.auth){ await AUTH.signOut(AUTH.auth); } });

  build();
}

bootstrap();
