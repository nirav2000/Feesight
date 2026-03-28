/**
 * Schools store module.
 * Boundaries: localStorage persistence + Firestore payload/schema mapping + remote read/write.
 */

import { ORLEY_ROWS, deepCopy } from '../model/simulation.js';

const STORAGE_KEY = 'feesight.schooldb.v2';
const APP_OWNER_UID = '2SLAVkYq78Pm7KR27vB1oV9ywUB3';
const normalizeName = s => (s||'').trim().toLowerCase();

export function docIdFromName(name){ return normalizeName(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120) || 'school'; }
export function defaultDb(){ return { schools:{ 'Orley Farm School':{name:'Orley Farm School',feeMode:'termly',rows:deepCopy(ORLEY_ROWS),updatedAt:new Date().toISOString(),source:'sample'} } }; }
export function loadDb(){ const fallback=defaultDb(); try{ const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; return {schools:{...fallback.schools, ...(saved.schools || {})}}; }catch{ return fallback; } }
export function saveDb(db){ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

export function toRuleFeeRows(localSchool){ return (Array.isArray(localSchool?.rows) ? localSchool.rows : []).map(r=>({ academicYear: String(r?.year || '').trim(), yearGroup: String(r?.group || '').trim(), billingMode: localSchool?.feeMode === 'termly' ? 'termly' : 'annual', amount: Number(r?.feeInput || 0) })).filter(r=>r.academicYear && r.yearGroup && r.amount > 0); }
export function toFirestoreSchoolPayload(localSchool, user){ const cleanRows = Array.isArray(localSchool?.rows) ? localSchool.rows.map(r=>({ year: String(r?.year || '').trim(), group: String(r?.group || '').trim(), feeInput: Number(r?.feeInput || 0) })).filter(r=>r.year && r.group && r.feeInput > 0) : []; return { name: String(localSchool?.name || '').trim(), feeMode: localSchool?.feeMode === 'termly' ? 'termly' : 'annual', rows: cleanRows, ownerUid: String(user?.uid || ''), searchableName: normalizeName(localSchool?.name || ''), updatedAt: String(localSchool?.updatedAt || new Date().toISOString()) }; }
export function validateSchoolPayloadForRules(payload){ const issues=[]; if(typeof payload?.name !== 'string' || !payload.name.trim()) issues.push('name must be non-empty string'); if(!['termly','annual'].includes(payload?.feeMode)) issues.push('feeMode must be termly or annual'); if(!Array.isArray(payload?.rows)) issues.push('rows must be an array'); if(typeof payload?.ownerUid !== 'string' || !payload.ownerUid) issues.push('ownerUid must be a non-empty string'); if(typeof payload?.searchableName !== 'string' || !payload.searchableName) issues.push('searchableName must be a non-empty string'); if(typeof payload?.updatedAt !== 'string' || !payload.updatedAt) issues.push('updatedAt must be an ISO string'); return issues; }
export function toCanonicalSchoolDoc(localSchool, revisionId){ const now = new Date().toISOString(); return { schoolName: String(localSchool?.name || '').trim(), searchableName: normalizeName(localSchool?.name || ''), createdAt: now, updatedAt: now, status: 'active', currentRevisionId: revisionId }; }
export function toRevisionDoc(schoolId, localSchool, user, revisionId, status = 'pending'){ return { schoolId, editorUid: user.uid, createdAt: new Date().toISOString(), action: 'update', status, snapshot: { schoolName: String(localSchool?.name || '').trim(), searchableName: normalizeName(localSchool?.name || ''), fees: toRuleFeeRows(localSchool) } }; }

export async function saveCurrentSchoolRemote({firebaseReady,FIRESTORE,currentUser,school,onWarn,onStatus,dbState,onRemoteIndex}){
  if(!firebaseReady || !FIRESTORE || !currentUser) return false;
  if(!school?.name||!school?.rows?.length) return false;
  try{
    const docId = docIdFromName(school.name);
    const revisionId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`);
    const payload = toFirestoreSchoolPayload(school, currentUser);
    const issues = validateSchoolPayloadForRules(payload);
    if(issues.length){ onWarn?.(`Saved locally. Firestore sync blocked by payload shape: ${issues.join('; ')}`); return false; }
    const canonical = toCanonicalSchoolDoc(school, revisionId);
    const revisionPublished = toRevisionDoc(docId, school, currentUser, revisionId, 'published');
    const revisionPending = toRevisionDoc(docId, school, currentUser, revisionId, 'pending');
    if(currentUser.uid === APP_OWNER_UID){
      await FIRESTORE.setDoc(FIRESTORE.doc(FIRESTORE.db,'schools',docId), canonical, {merge:true});
      await FIRESTORE.setDoc(FIRESTORE.doc(FIRESTORE.db,'schools',docId,'revisions',revisionId), revisionPublished, {merge:true});
      onRemoteIndex?.(school.name, {id:docId, ownerUid:APP_OWNER_UID});
    } else {
      await FIRESTORE.setDoc(FIRESTORE.doc(FIRESTORE.db,'schools',docId,'revisions',revisionId), revisionPending, {merge:true});
    }
    onStatus?.('', 'ok');
    return true;
  }catch(err){ onWarn?.(`Saved locally. Firestore sync failed: ${err.message}`); return false; }
}

export async function refreshRemoteSchools({firebaseReady,FIRESTORE,currentUser,SCHOOL_DB,setRemoteIndex,onStatus,onWarn}){
  if(!firebaseReady || !FIRESTORE || !currentUser) return;
  try{
    const snap = await FIRESTORE.getDocs(FIRESTORE.query(FIRESTORE.collection(FIRESTORE.db,'schools'), FIRESTORE.orderBy('searchableName')));
    const remote = {};
    snap.forEach(docSnap=>{ const data=docSnap.data(); if(!data?.schoolName) return; remote[data.schoolName] = {id:docSnap.id, ownerUid:APP_OWNER_UID}; const existing = SCHOOL_DB.schools[data.schoolName]; SCHOOL_DB.schools[data.schoolName] = { name:data.schoolName, feeMode: existing?.feeMode || 'annual', rows: Array.isArray(existing?.rows) ? existing.rows : [], updatedAt: data.updatedAt || new Date().toISOString(), source:'cloud-shared' }; });
    setRemoteIndex(remote);
    saveDb(SCHOOL_DB);
    onStatus?.('', 'ok');
  } catch(err){ onWarn?.(`Local saving is enabled. Firestore list load failed: ${err.message}`); }
}

export function normalizeSchoolName(s){ return normalizeName(s); }
