/* LifeOS Elite — firebase.js */
// const FIREBASE_CONFIG = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_PROJECT.firebaseapp.com",
//   projectId: "YOUR_PROJECT_ID",
//   storageBucket: "YOUR_PROJECT.appspot.com",
//   messagingSenderId: "YOUR_SENDER_ID",
//   appId: "YOUR_APP_ID"
// };

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAZmCXfW_fcbjbEe7hPOPE8CRtWk8rPkns",
  authDomain: "nifty-jet-430708-d7.firebaseapp.com",
  projectId: "nifty-jet-430708-d7",
  storageBucket: "nifty-jet-430708-d7.firebasestorage.app",
  messagingSenderId: "1035191412587",
  appId: "1:1035191412587:web:dc5324d6afb2abbd660e2e",
  measurementId: "G-PYN67RGG40"
};

window.FIREBASE_READY = false;
window.DEMO_MODE = false;

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') { window.DEMO_MODE = true; return null; }
    if (firebase.apps.length === 0) firebase.initializeApp(FIREBASE_CONFIG);
    window.fbAuth = firebase.auth();
    window.fbDb = firebase.firestore();
    window.fbDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    window.FIREBASE_READY = true;
    return { auth: window.fbAuth, db: window.fbDb };
  } catch(e) {
    console.error('Firebase init error:', e);
    window.DEMO_MODE = true;
    return null;
  }
}

async function signInWithGoogle() {
  if (!window.FIREBASE_READY) throw new Error('Firebase not ready');
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return (await window.fbAuth.signInWithPopup(provider)).user;
}

async function signOut() {
  if (window.FIREBASE_READY) await window.fbAuth.signOut();
}

function onAuthChange(cb) {
  if (!window.FIREBASE_READY) { setTimeout(() => cb(null), 0); return () => {}; }
  return window.fbAuth.onAuthStateChanged(cb);
}

async function fbSave(col, doc) {
  if (!window.FIREBASE_READY || window.DEMO_MODE) return doc;
  const ref = doc.id ? window.fbDb.collection(col).doc(doc.id) : window.fbDb.collection(col).doc();
  const data = { ...doc, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (!doc.id) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  await ref.set(data, { merge: true });
  return { ...doc, id: ref.id };
}

async function fbDelete(col, id) {
  if (!window.FIREBASE_READY || window.DEMO_MODE) return;
  await window.fbDb.collection(col).doc(id).delete();
}

async function fbLoadAll(col, uid) {
  if (!window.FIREBASE_READY || window.DEMO_MODE) return [];
  const snap = await window.fbDb.collection(col).where('uid','==',uid).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbSaveProfile(uid, data) {
  if (!window.FIREBASE_READY || window.DEMO_MODE) return;
  await window.fbDb.collection('userProfiles').doc(uid).set(
    { ...data, uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

async function fbGetProfile(uid) {
  if (!window.FIREBASE_READY || window.DEMO_MODE) return null;
  const doc = await window.fbDb.collection('userProfiles').doc(uid).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

window.FirebaseService = { init: initFirebase, signInWithGoogle, signOut, onAuthChange, fbSave, fbDelete, fbLoadAll, fbSaveProfile, fbGetProfile };
