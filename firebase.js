/* LifeOS — firebase.js */
'use strict';

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

function initFirebase() {
  if (typeof firebase === 'undefined' || window.FIREBASE_READY) return;
  try {
    if (firebase.apps.length === 0) firebase.initializeApp(FIREBASE_CONFIG);
    window.fbAuth = firebase.auth();
    window.fbDb   = firebase.firestore();
    window.fbDb.enablePersistence({ synchronizeTabs:true }).catch(()=>{});
    window.FIREBASE_READY = true;
  } catch(e) {
    console.error('Firebase init error:', e);
  }
}

function signInWithGoogle() {
  if (!window.FIREBASE_READY) return Promise.reject('Firebase not ready');
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider);
}

function signOut() {
  return window.FIREBASE_READY ? firebase.auth().signOut() : Promise.resolve();
}

function onAuthChange(cb) {
  if (!window.FIREBASE_READY) { setTimeout(() => cb(null), 0); return () => {}; }
  return window.fbAuth.onAuthStateChanged(cb);
}

// ── Generic CRUD ──
async function fbSet(col, docId, data) {
  if (!window.FIREBASE_READY) return;
  await window.fbDb.collection(col).doc(docId).set(
    { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

async function fbGet(col, docId) {
  if (!window.FIREBASE_READY) return null;
  const d = await window.fbDb.collection(col).doc(docId).get();
  return d.exists ? { id: d.id, ...d.data() } : null;
}

async function fbGetAll(col) {
  if (!window.FIREBASE_READY) return [];
  const snap = await window.fbDb.collection(col).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbDelete(col, docId) {
  if (!window.FIREBASE_READY) return;
  await window.fbDb.collection(col).doc(docId).delete();
}

// ── User sub-collection helpers ──
function userCol(uid, sub) {
  return window.fbDb.collection('users').doc(uid).collection(sub);
}

async function saveProfile(uid, data) {
  if (!window.FIREBASE_READY) return;
  await window.fbDb.collection('users').doc(uid).set(
    { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

async function loadProfile(uid) {
  if (!window.FIREBASE_READY) return null;
  const d = await window.fbDb.collection('users').doc(uid).get();
  return d.exists ? d.data() : null;
}

async function saveToSub(uid, sub, docId, data) {
  if (!window.FIREBASE_READY) return;
  await userCol(uid, sub).doc(docId).set(
    { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

async function deleteFromSub(uid, sub, docId) {
  if (!window.FIREBASE_READY) return;
  await userCol(uid, sub).doc(docId).delete();
}

async function loadSub(uid, sub) {
  if (!window.FIREBASE_READY) return [];
  const snap = await userCol(uid, sub).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Shared maps ──
async function saveSharedMap(shareId, data) {
  if (!window.FIREBASE_READY) return;
  await window.fbDb.collection('sharedMaps').doc(shareId).set(
    { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

async function loadSharedMap(shareId) {
  if (!window.FIREBASE_READY) return null;
  const d = await window.fbDb.collection('sharedMaps').doc(shareId).get();
  return d.exists ? d.data() : null;
}

window.FB = {
  init: initFirebase, signInWithGoogle, signOut, onAuthChange,
  fbSet, fbGet, fbGetAll, fbDelete,
  saveProfile, loadProfile,
  saveToSub, deleteFromSub, loadSub,
  saveSharedMap, loadSharedMap,
};
