/**
 * Firebase auth lifecycle module.
 * Boundaries: auth/bootstrap only; delegates UI/data side effects to callbacks.
 */

export const isIOSLike = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandaloneLike = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export async function initFirebaseAuth({debugLog,onStatus,onAuthStatus,onUserChanged,onReady}){
  if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.projectId){
    debugLog?.('WARN', 'Firebase config missing. Auth and cloud sync disabled.');
    return { firebaseReady:false, AUTH:null, FIRESTORE:null };
  }
  try {
    const [{ initializeApp }, { getFirestore, doc, setDoc, collection, getDocs, query, orderBy }, { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInAnonymously, getRedirectResult, onAuthStateChanged, signOut }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js')
    ]);
    const app = initializeApp(window.FIREBASE_CONFIG);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const FIRESTORE = { db, doc, setDoc, collection, getDocs, query, orderBy };
    const AUTH = { auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInAnonymously, getRedirectResult, onAuthStateChanged, signOut };
    await getRedirectResult(auth).catch(()=>null);
    onAuthStateChanged(auth, user => onUserChanged?.(user || null, AUTH, FIRESTORE));
    onReady?.(AUTH, FIRESTORE);
    onStatus?.('', 'ok');
    return { firebaseReady:true, AUTH, FIRESTORE };
  } catch (err) {
    debugLog?.('ERROR', 'Firebase initialization failed.', err?.message || String(err));
    onStatus?.(`Local saving is enabled. Firebase could not start: ${err.message}`, 'warn');
    onAuthStatus?.(`Firebase Auth could not start: ${err.message}`, 'warn');
    return { firebaseReady:false, AUTH:null, FIRESTORE:null };
  }
}

export async function signInWithGoogle({AUTH,authInFlight,setAuthInFlight,debugLog,setAuthStatus,onUnauthorizedDomain,onDone}){
  if (authInFlight || !AUTH?.auth) return;
  setAuthInFlight(true);
  try{
    const provider = new AUTH.GoogleAuthProvider();
    if (isIOSLike() || isStandaloneLike()) await AUTH.signInWithRedirect(AUTH.auth, provider);
    else await AUTH.signInWithPopup(AUTH.auth, provider);
  }catch(err){
    debugLog?.('ERROR', 'Google sign-in failed.', err?.message || String(err));
    if(err?.code === 'auth/unauthorized-domain'){ onUnauthorizedDomain?.(); return; }
    if(err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request' || err?.code === 'auth/operation-not-supported-in-this-environment') await AUTH.signInWithRedirect(AUTH.auth, new AUTH.GoogleAuthProvider());
    else setAuthStatus?.(`Google sign-in failed: ${err.message}`, 'warn');
  } finally { setAuthInFlight(false); onDone?.(); }
}
