import { db } from "./firebase.js";
import {
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function loadGameStatsMap(){
  const snap = await getDocs(collection(db, "gameStats"));
  const map = new Map();
  snap.forEach(docu => map.set(docu.id, docu.data()));
  return map;
}

export function attachStatsToGames(games, statsMap){
  return games.map(g => {
    const st = statsMap.get(g.id);
    return {
      ...g,
      ratingAvg: st?.avg ? Number(st.avg) : 0,
      ratingCount: st?.count ? Number(st.count) : 0
    };
  });
}