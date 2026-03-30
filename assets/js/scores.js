// assets/js/scores.js
import { db } from "./firebase.js";
import {
  collection, doc, getDocs, query, where, orderBy, limit, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Guardar puntuación (solo si es mayor que la anterior)
export async function saveHighScore(uid, nickname, gameId, newScore) {
  const scoreRef = doc(db, "scores", `${uid}_${gameId}`);
  const userRef = doc(db, "users", uid);

  try {
    await runTransaction(db, async (tx) => {
      const scoreSnap = await tx.get(scoreRef);
      const userSnap = await tx.get(userRef);
      
      let oldScore = 0;
      let currentLevel = 1;
      let currentBadge = "1";

      if (scoreSnap.exists()) {
        oldScore = Number(scoreSnap.data().score || 0);
      }

      if (userSnap.exists()) {
        const userData = userSnap.data();
        currentLevel = userData.level || 1;
        currentBadge = userData.badge || "1";
      }

      // Solo guardamos si ha superado su récord personal en este juego
      if (newScore > oldScore) {
        tx.set(scoreRef, {
          uid,
          nickname: nickname || "Jugador",
          gameId,
          score: newScore,
          level: currentLevel, // Guardamos nivel actual en la foto del score
          badge: currentBadge, // Guardamos insignia actual en la foto del score
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Actualizar el score global del usuario
        let globalScore = userSnap.exists() ? Number(userSnap.data().globalScore || 0) : 0;
        globalScore = globalScore - oldScore + newScore;
        
        tx.set(userRef, { 
            globalScore, 
            updatedAt: serverTimestamp() 
        }, { merge: true });
      }
    });
  } catch (error) {
    console.error("Error en la transacción de Firebase:", error);
    throw error;
  }
}

// Obtener el Top 10 de un juego específico
export async function getGameLeaderboard(gameId) {
  const q = query(
    collection(db, "scores"),
    where("gameId", "==", gameId)
  );
  
  const snap = await getDocs(q);
  const results = snap.docs.map(d => d.data());

  results.sort((a, b) => (b.score || 0) - (a.score || 0));
  return results.slice(0, 10);
}

// Obtener el Top 10 Global (Usuarios con más puntos en total)
export async function getGlobalLeaderboard() {
  const q = query(
    collection(db, "users"),
    orderBy("globalScore", "desc"),
    limit(10)
  );
  const snap = await getDocs(q);
  
  return snap.docs.map(d => {
    const data = d.data();
    return {
      nickname: data.nickname || "Jugador",
      score: data.globalScore || 0,
      badge: data.badge || "1",
      level: data.level || 1 // <-- CRÍTICO: Ahora recuperamos el nivel para el ranking
    };
  }).filter(user => user.score > 0); 
}

// 4. Obtener el Top 10 de ELO (Especial para Ajedrez)
export async function getEloLeaderboard() {
  try {
    const snap = await getDocs(collection(db, "users"));
    
    let usersList = snap.docs.map(d => {
      const data = d.data();
      return {
        nickname: data.nickname || "Jugador",
        elo: Number(data.elo || 1200),
        badge: data.badge || "1",
        level: data.level || 1 // También incluimos el nivel aquí
      };
    });

    usersList.sort((a, b) => b.elo - a.elo);
    return usersList.slice(0, 10);
  } catch (error) {
    console.error("Error obteniendo ranking de ELO:", error);
    return [];
  }
}