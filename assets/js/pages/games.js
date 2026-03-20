// assets/js/pages/games.js
import { db } from "../firebase.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// 1) Definición local incluyendo Arena Conquest
async function loadGames() {
  return [
    { id: "snake", title: "Snake", category: "retro", tagline: "El clásico de siempre.", cover: "assets/img/covers/snake.jpg", featured: true, scoreKey: "gamehub_snake_best" },
    { id: "meteor_dodge", title: "Volcano Dodge", category: "original", tagline: "Esquiva meteoritos con tu nave.", cover: "assets/img/covers/meteor_dodge.jpg", featured: true, scoreKey: "gamehub_meteor_best" },
    { id: "reflex_arena", title: "Reflex Arena", category: "modern", tagline: "Piedra · Papel · Tijera.", cover: "assets/img/covers/reflex_arena.jpg", featured: true, scoreKey: "gamehub_rps_best" },
    { id: "aim_trainer", title: "Aim Trainer", category: "modern", tagline: "Haz click y rompe tu récord.", cover: "assets/img/covers/aim_trainer.jpg", featured: true, scoreKey: "gamehub_aim_best" },
    { id: "chess", title: "Ajedrez", category: "modern", tagline: "Estrategia online.", cover: "assets/img/covers/ajedrez.jpg", featured: true },
    { id: "arena_conquest", title: "Arena Conquest", category: "modern", tagline: "Domina la arena hexagonal.", cover: "assets/img/covers/conquest.png", featured: true, scoreKey: "rankarena_conquest_wins" }
  ];
}

document.addEventListener("DOMContentLoaded", async () => {
  const games = await loadGames();
  const searchEl = document.getElementById("search");
  const noResultsEl = document.getElementById("no-results");
  let activeFilter = "all";
  const statsMap = new Map();

  let applyTimer = null;
  function scheduleApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(apply, 60);
  }

  function getAvg(gameId) {
    const s = statsMap.get(gameId);
    return s && Number.isFinite(s.avg) ? s.avg : 0;
  }
  function getCount(gameId) {
    const s = statsMap.get(gameId);
    return s && Number.isFinite(s.count) ? s.count : 0;
  }

  function updateStarsInDOM(gameId, avg, count) {
    const card = document.querySelector(`.card[data-game-id="${gameId}"]`);
    if (!card) return;
    const targetNode = card.querySelector(".rating-badge");
    if (!targetNode) return;

    const fixedAvg = (Math.round((avg || 0) * 10) / 10).toFixed(1);
    targetNode.textContent = `⭐ ${fixedAvg} (${count || 0})`;
  }

  function apply() {
    const q = (searchEl?.value || "").trim().toLowerCase();

    const filtered = games.filter(g => {
      const byFilter = activeFilter === "all" ? true : (g.category === activeFilter);
      const hay = `${g.title || ""} ${g.tagline || ""}`.toLowerCase();
      const bySearch = q === "" ? true : hay.includes(q);
      return byFilter && bySearch;
    });

    filtered.sort((a, b) => {
      const fa = a.featured ? 1 : 0;
      const fb = b.featured ? 1 : 0;
      if (fb !== fa) return fb - fa;
      const avga = getAvg(a.id);
      const avgb = getAvg(b.id);
      if (avgb !== avga) return avgb - avga;
      return (a.title || "").localeCompare(b.title || "");
    });

    // Llamada a la función global de ui.js
    if (typeof renderGameGrid === "function") {
      renderGameGrid("games-container", filtered);
    }

    if (noResultsEl) {
      noResultsEl.style.display = filtered.length === 0 ? "block" : "none";
    }

    filtered.forEach(g => {
      updateStarsInDOM(g.id, getAvg(g.id), getCount(g.id));
    });
  }

  searchEl?.addEventListener("input", scheduleApply);
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter || "all";
      scheduleApply();
    });
  });

  const unsubs = [];
  games.forEach(g => {
    const ref = doc(db, "gameStats", g.id);
    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data() || { avg: 0, count: 0 };
      statsMap.set(g.id, { avg: d.avg || 0, count: d.count || 0 });
      updateStarsInDOM(g.id, getAvg(g.id), getCount(g.id));
      scheduleApply();
    });
    unsubs.push(unsub);
  });

  apply();
  window.addEventListener("beforeunload", () => {
    unsubs.forEach(fn => { try { fn(); } catch(_){} });
  });
});