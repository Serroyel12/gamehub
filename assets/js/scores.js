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
      if (scoreSnap.exists()) {
        oldScore = Number(scoreSnap.data().score || 0);
      }

      // Solo guardamos si ha superado su récord personal en este juego
      if (newScore > oldScore) {
        tx.set(scoreRef, {
          uid,
          nickname: nickname || "Jugador",
          gameId,
          score: newScore,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Actualizar el score global del usuario
        let globalScore = userSnap.exists() ? Number(userSnap.data().globalScore || 0) : 0;
        globalScore = globalScore - oldScore + newScore;
        
        tx.set(userRef, { globalScore, updatedAt: serverTimestamp() }, { merge: true });
      }
    });
  } catch (error) {
    console.error("Error en la transacción de Firebase:", error);
    throw error;
  }
}

// Obtener el Top 10 de un juego específico (SOLUCIÓN AL ERROR DEL ÍNDICE)
export async function getGameLeaderboard(gameId) {
  // Solo filtramos por el juego (evitamos el orderBy de Firebase para no necesitar el índice)
  const q = query(
    collection(db, "scores"),
    where("gameId", "==", gameId)
  );
  
  const snap = await getDocs(q);
  const results = snap.docs.map(d => d.data());

  // Ordenamos de mayor a menor directamente con JavaScript
  results.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Devolvemos solo los 10 primeros
  return results.slice(0, 10);
}

// Obtener el Top 10 Global (Usuarios con más puntos en total)
export async function getGlobalLeaderboard() {
  // Como aquí solo ordenamos por una cosa (globalScore), NO pide índice compuesto
  const q = query(
    collection(db, "users"),
    orderBy("globalScore", "desc"),
    limit(10)
  );
  const snap = await getDocs(q);
  
  // Mapeamos los datos y filtramos a los que tienen 0 puntos para que no salgan
  return snap.docs.map(d => {
    const data = d.data();
    return {
      nickname: data.nickname || "Jugador",
      score: data.globalScore || 0,
      badge: data.badge || 1
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
        elo: Number(data.elo || 1200), // Si no tiene, por defecto es 1200
        badge: data.badge || 1
      };
    });

    // Ordenamos de mayor a menor ELO
    usersList.sort((a, b) => b.elo - a.elo);

    return usersList.slice(0, 10);
  } catch (error) {
    console.error("Error obteniendo ranking de ELO:", error);
    return [];
  }
}