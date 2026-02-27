import { auth, db } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc, runTransaction, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

let me = null;
let selected = 0;
let gameId = null;

function qs(id){ return document.getElementById(id); }

function getParam(name){
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

function paintStars(v){
  const wrap = qs("ratingStars");
  if (!wrap) return;
  [...wrap.querySelectorAll("span[data-v]")].forEach(s => {
    const n = Number(s.dataset.v);
    s.textContent = n <= v ? "★" : "☆";
  });
}

function setMsg(t){
  const el = qs("rateMsg");
  if(el) el.textContent = t || "";
}

function setSummary(avg, count){
  const el = qs("ratingSummary");
  if (!el) return;
  el.textContent = `⭐ ${Number(avg).toFixed(1)} (${count})`;
}

async function ensureGameId(){
  gameId = getParam("id");
  if (!gameId) throw new Error("Missing game id");
}

function bindStats(){
  const ref = doc(db, "gameStats", gameId);
  onSnapshot(ref, (snap) => {
    const data = snap.exists() ? snap.data() : null;
    setSummary(data?.avg ?? 0, data?.count ?? 0);
  }, () => setSummary(0, 0));
}

function bindUI(){
  const starsWrap = qs("ratingStars");
  const btnRate = qs("btnRate");

  if (starsWrap){
    starsWrap.addEventListener("click", (e) => {
      const t = e.target;
      const v = Number(t?.dataset?.v || 0);
      if (!v) return;

      selected = v;
      window.selectedRating = selected; // ✅ clave para reviews.js
      paintStars(selected);
      setMsg(`Tu voto: ${selected}/5`);
    });
  }

  btnRate?.addEventListener("click", async () => {
    if (!me){
      setMsg("⚠️ Debes iniciar sesión para valorar.");
      return;
    }
    if (selected < 1 || selected > 5){
      setMsg("⚠️ Elige de 1 a 5 estrellas.");
      return;
    }

    try {
      await submitRating(selected);
      setMsg("✅ Valoración guardada. ¡Gracias!");
    } catch (e){
      console.error(e);
      setMsg("❌ No se pudo guardar (mira consola).");
    }
  });
}

async function submitRating(rating){
  const reviewId = `${gameId}_${me.uid}`;
  const reviewRef = doc(db, "reviews", reviewId);
  const statsRef = doc(db, "gameStats", gameId);

  await runTransaction(db, async (tx) => {
    const reviewSnap = await tx.get(reviewRef);
    const statsSnap = await tx.get(statsRef);

    const prev = reviewSnap.exists() ? Number(reviewSnap.data().rating || 0) : 0;

    let sum = 0, count = 0;

    if (statsSnap.exists()){
      const d = statsSnap.data();
      sum = Number(d.sum || 0);
      count = Number(d.count || 0);
    }

    if (!reviewSnap.exists()){
      sum += rating;
      count += 1;
      tx.set(reviewRef, {
        gameId,
        uid: me.uid,
        rating,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      sum = sum - prev + rating;
      tx.set(reviewRef, {
        gameId,
        uid: me.uid,
        rating,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    const avg = count > 0 ? (sum / count) : 0;

    tx.set(statsRef, {
      sum,
      count,
      avg,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
}

// INIT
document.addEventListener("DOMContentLoaded", async () => {
  await ensureGameId();
  bindUI();
  bindStats();

  onAuthStateChanged(auth, (user) => {
    me = user || null;
    if (!me) setMsg("Inicia sesión para valorar.");
  });
});