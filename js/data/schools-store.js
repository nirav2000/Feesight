/**
 * Schools store module.
 * Boundaries: localStorage persistence + Firestore payload/schema mapping + remote read/write.
 */

import { ORLEY_ROWS, deepCopy } from '../model/simulation.js';

const STORAGE_KEY = 'feesight.schooldb.v2';
const normalizeName = s => (s||'').trim().toLowerCase();

export function docIdFromName(name){ return normalizeName(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120) || 'school'; }
export function defaultDb(){ return { schools:{ 'Orley Farm School':{name:'Orley Farm School',feeMode:'termly',rows:deepCopy(ORLEY_ROWS),updatedAt:new Date().toISOString(),source:'sample'} } }; }
export function loadDb(){ const fallback=defaultDb(); try{ const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; return {schools:{...fallback.schools, ...(saved.schools || {})}}; }catch{ return fallback; } }
export function saveDb(db){ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

export function toRuleFeeRows(localSchool){ return (Array.isArray(localSchool?.rows) ? localSchool.rows : []).map(r=>({ academicYear: String(r?.year || '').trim(), yearGroup: String(r?.group || '').trim(), billingMode: localSchool?.feeMode === 'termly' ? 'termly' : 'annual', amount: Number(r?.feeInput || 0) })).filter(r=>r.academicYear && r.yearGroup && r.amount > 0); }
export function toRevisionDoc(schoolId, localSchool, user, revisionId, status = 'pending'){ return { schoolId, editorUid: user.uid, createdAt: new Date().toISOString(), action: 'update', status, snapshot: { schoolName: String(localSchool?.name || '').trim(), searchableName: normalizeName(localSchool?.name || ''), fees: toRuleFeeRows(localSchool) } }; }
export function validateRevisionPayloadForRules(payload, user){ const issues=[]; if(typeof payload?.schoolId !== 'string' || !payload.schoolId.trim()) issues.push('schoolId must be a non-empty string'); if(typeof payload?.editorUid !== 'string' || payload.editorUid !== user?.uid) issues.push('editorUid must match current user uid'); if(typeof payload?.createdAt !== 'string' || !payload.createdAt) issues.push('createdAt must be an ISO string'); if(payload?.action !== 'update') issues.push('action must be update'); if(payload?.status !== 'pending') issues.push('status must be pending'); if(typeof payload?.snapshot?.schoolName !== 'string' || !payload.snapshot.schoolName.trim()) issues.push('snapshot.schoolName must be non-empty string'); if(typeof payload?.snapshot?.searchableName !== 'string' || !payload.snapshot.searchableName.trim()) issues.push('snapshot.searchableName must be non-empty string'); if(!Array.isArray(payload?.snapshot?.fees)) issues.push('snapshot.fees must be an array'); return issues; }

export async function saveCurrentSchoolRemote({firebaseReady,FIRESTORE,currentUser,school,onWarn,onStatus,dbState,onRemoteIndex}){
  if(!firebaseReady || !FIRESTORE || !currentUser) return false;
  if(!school?.name||!school?.rows?.length) return false;
  try{
    const docId = docIdFromName(school.name);
    const revisionId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
    const revisionPending = toRevisionDoc(docId, school, currentUser, revisionId, 'pending');
    const issues = validateRevisionPayloadForRules(revisionPending, currentUser);
    if(issues.length){ onWarn?.(`Saved locally. Firestore sync blocked by payload shape: ${issues.join('; ')}`); return false; }
    await FIRESTORE.setDoc(FIRESTORE.doc(FIRESTORE.db,'schools',docId,'revisions',revisionId), revisionPending, {merge:true});
    onStatus?.('Saved locally and submitted as pending revision for review.', 'ok');
    return true;
  }catch(err){ onWarn?.(`Saved locally. Firestore sync failed: ${err.message}`); return false; }
}

export async function refreshRemoteSchools({firebaseReady,FIRESTORE,currentUser,SCHOOL_DB,setRemoteIndex,onStatus,onWarn}){
  if(!firebaseReady || !FIRESTORE || !currentUser) return;
  try{
    let snap;
    try{
      snap = await FIRESTORE.getDocs(FIRESTORE.query(FIRESTORE.collection(FIRESTORE.db,'schools'), FIRESTORE.orderBy('searchableName')));
    } catch(err){
      const needsIndex = err?.code === 'failed-precondition' || /requires an index/i.test(err?.message || '');
      if(!needsIndex) throw err;
      snap = await FIRESTORE.getDocs(FIRESTORE.query(FIRESTORE.collection(FIRESTORE.db,'schools')));
      onWarn?.('Firestore school list index unavailable; loaded unsorted list fallback.');
    }
    const remote = {};
    snap.forEach(docSnap=>{ const data=docSnap.data(); if(!data?.schoolName) return; remote[data.schoolName] = {id:docSnap.id}; const existing = SCHOOL_DB.schools[data.schoolName]; SCHOOL_DB.schools[data.schoolName] = { name:data.schoolName, feeMode: existing?.feeMode || 'annual', rows: Array.isArray(existing?.rows) ? existing.rows : [], updatedAt: data.updatedAt || new Date().toISOString(), source:'cloud-shared' }; });
    setRemoteIndex(remote);
    saveDb(SCHOOL_DB);
    onStatus?.('', 'ok');
  } catch(err){ onWarn?.(`Local saving is enabled. Firestore list load failed: ${err.message}`); }
}

export async function loadLatestRevisionRows({ firebaseReady, FIRESTORE, schoolId }){
  if(!firebaseReady || !FIRESTORE || !schoolId) return [];
  try{
    const revisionsRef = FIRESTORE.collection(FIRESTORE.db, 'schools', schoolId, 'revisions');
    const queryLatest = async (status = null)=>{
      const clauses = [];
      if(status) clauses.push(FIRESTORE.where('status', '==', status));
      clauses.push(FIRESTORE.orderBy('createdAt', 'desc'));
      clauses.push(FIRESTORE.limit(1));
      const snap = await FIRESTORE.getDocs(FIRESTORE.query(revisionsRef, ...clauses));
      let latestDoc = null;
      snap.forEach(docSnap=>{ if(!latestDoc) latestDoc = docSnap.data(); });
      return latestDoc;
    };

    const latest = await queryLatest('published')
      || await queryLatest('pending')
      || await queryLatest();
    const fees = Array.isArray(latest?.snapshot?.fees) ? latest.snapshot.fees : [];
    return fees.map(fee=>({
      year: String(fee?.academicYear || '').trim(),
      group: String(fee?.yearGroup || '').trim(),
      feeInput: Number(fee?.amount || 0)
    })).filter(row=>row.year && row.group && row.feeInput > 0);
  } catch(_err){
    return [];
  }
}

export function normalizeSchoolName(s){ return normalizeName(s); }
