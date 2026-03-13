// assets/js/pages/games.js
import { db } from "../firebase.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// 1) Definición local de juegos para evitar errores de rutas en GitHub Pages
async function loadGames() {
  return [
    { id: "snake", title: "Snake", category: "retro", tagline: "El clásico de siempre.", cover: "assets/img/covers/snake.jpg", featured: true },
    { id: "meteor_dodge", title: "Volcano Dodge", category: "original", tagline: "Esquiva meteoritos con tu nave.", cover: "assets/img/covers/meteor_dodge.jpg", featured: true },
    { id: "reflex_arena", title: "Reflex Arena", category: "modern", tagline: "Piedra · Papel · Tijera.", cover: "assets/img/covers/reflex_arena.jpg", featured: true },
    { id: "aim_trainer", title: "Aim Trainer", category: "modern", tagline: "Haz click y rompe tu récord.", cover: "assets/img/covers/aim_trainer.jpg", featured: true },
    { id: "chess", title: "Ajedrez", category: "modern", tagline: "Estrategia online.", cover: "assets/img/covers/ajedrez.jpg", featured: true }
  ];
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Cargar juegos
  const games = await loadGames();

  // 2) Estado de filtros
  const searchEl = document.getElementById("search");
  const noResultsEl = document.getElementById("no-results");
  let activeFilter = "all";

  // 3) Mapa de stats en tiempo real
  const statsMap = new Map();

  // 4) Debounce para no re-renderizar 20 veces seguidas
  let applyTimer = null;
  function scheduleApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(apply, 60);
  }

  // 5) Helpers
  function getAvg(gameId) {
    const s = statsMap.get(gameId);
    return s && Number.isFinite(s.avg) ? s.avg : 0;
  }
  function getCount(gameId) {
    const s = statsMap.get(gameId);
    return s && Number.isFinite(s.count) ? s.count : 0;
  }

  // 6) Pintar ⭐ en cada tarjeta
  function updateStarsInDOM(gameId, avg, count) {
    // Selector más flexible para rutas de GitHub
    const link = document.querySelector(`a[href*="id=${CSS.escape(gameId)}"]`);
    if (!link) return;

    const card = link.closest(".card");
    if (!card) return;

    const nodes = card.querySelectorAll("*");
    let targetNode = null;

    nodes.forEach(n => {
      const t = (n.textContent || "").trim();
      if (!targetNode && t.startsWith("⭐") && t.includes("(") && t.includes(")")) {
        targetNode = n;
      }
    });

    if (!targetNode) return;

    const fixedAvg = (Math.round((avg || 0) * 10) / 10).toFixed(1);
    targetNode.textContent = `⭐ ${fixedAvg} (${count || 0})`;
  }

  // 7) Render con filtro/búsqueda + orden recomendado
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

      const ca = getCount(a.id);
      const cb = getCount(b.id);
      if (cb !== ca) return cb - ca;

      return (a.title || "").localeCompare(b.title || "");
    });

    // IMPORTANTE: Asegúrate de que ui.js o renderGameGrid esté cargado
    if (typeof renderGameGrid === "function") {
      renderGameGrid("games-container", filtered);
    }

    // CORRECCIÓN SEGURIDAD: noResultsEl
    if (noResultsEl) {
      noResultsEl.style.display = filtered.length === 0 ? "block" : "none";
    }

    filtered.forEach(g => {
      updateStarsInDOM(g.id, getAvg(g.id), getCount(g.id));
    });
  }

  // 8) Listeners UI
  searchEl?.addEventListener("input", scheduleApply);

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter || "all";
      scheduleApply();
    });
  });

  // 9) Suscribirse a gameStats
  const unsubs = [];
  games.forEach(g => {
    const ref = doc(db, "gameStats", g.id);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        statsMap.set(g.id, { avg: 0, count: 0, sum: 0 });
        updateStarsInDOM(g.id, 0, 0);
        scheduleApply();
        return;
      }

      const d = snap.data() || {};
      const avg = Number(d.avg || 0);
      const count = Number(d.count || 0);
      const sum = Number(d.sum || 0);

      statsMap.set(g.id, {
        avg: Number.isFinite(avg) ? avg : 0,
        count: Number.isFinite(count) ? count : 0,
        sum: Number.isFinite(sum) ? sum : 0
      });

      updateStarsInDOM(g.id, getAvg(g.id), getCount(g.id));
      scheduleApply();
    });

    unsubs.push(unsub);
  });

  // 10) Render inicial
  apply();

  window.addEventListener("beforeunload", () => {
    unsubs.forEach(fn => { try { fn(); } catch(_){} });
  });
});