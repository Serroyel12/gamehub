import { auth, db } from "../js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, runTransaction,
  serverTimestamp, collection, query, where, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ========= helpers =========
export async function loadMyReview(gameId, uid){
  const reviewId = `${gameId}_${uid}`;
  const ref = doc(db, "reviews", reviewId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveReview({ gameId, uid, rating, text }){
  const reviewId = `${gameId}_${uid}`;
  const reviewRef = doc(db, "reviews", reviewId);
  const statsRef  = doc(db, "gameStats", gameId);

  await runTransaction(db, async (tx) => {
    const oldReviewSnap = await tx.get(reviewRef);
    const statsSnap = await tx.get(statsRef);

    const oldRating = oldReviewSnap.exists() ? (oldReviewSnap.data().rating || 0) : 0;

    // stats actuales
    let sum = 0, count = 0;
    if (statsSnap.exists()){
      const d = statsSnap.data();
      sum = Number(d.sum || 0);
      count = Number(d.count || 0);
    }

    // si es nuevo -> count++
    if (!oldReviewSnap.exists()){
      count += 1;
      sum += rating;
    } else {
      // update -> ajustar suma
      sum = sum - oldRating + rating;
    }

    const avg = count > 0 ? (sum / count) : 0;

    // guardar review
    if (!oldReviewSnap.exists()){
      tx.set(reviewRef, {
        gameId,
        uid,
        rating,
        text: String(text || ""),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.update(reviewRef, {
        rating,
        text: String(text || ""),
        updatedAt: serverTimestamp(),
      });
    }

    // guardar stats
    if (!statsSnap.exists()){
      tx.set(statsRef, {
        gameId,
        sum,
        count,
        avg,
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.update(statsRef, {
        sum,
        count,
        avg,
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function loadLatestReviews(gameId){
  const qy = query(
    collection(db, "reviews"),
    where("gameId", "==", gameId),
    orderBy("updatedAt", "desc"),
    limit(10)
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => d.data());
}