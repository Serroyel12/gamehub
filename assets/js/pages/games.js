// assets/js/pages/games.js
// Catálogo con:
// - filtro + búsqueda
// - ⭐ medias en TIEMPO REAL desde Firestore (gameStats/{gameId})
// - orden recomendado: featured primero, luego mejor valorados (avg desc), luego alfabético

import { db } from "../firebase.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Cargar juegos
  const games = await loadGames();

  // 2) Estado de filtros
  const searchEl = document.getElementById("search");
  const noResultsEl = document.getElementById("no-results");
  let activeFilter = "all";

  // 3) Mapa de stats en tiempo real: { [gameId]: { avg, count, sum } }
  const statsMap = new Map();

  // 4) Debounce para no re-renderizar 20 veces seguidas
  let applyTimer = null;
  function scheduleApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(apply, 60);
  }

  // 5) Helpers: leer avg/count de statsMap
  function getAvg(gameId) {
    const s = statsMap.get(gameId);
    return s && Number.isFinite(s.avg) ? s.avg : 0;
  }
  function getCount(gameId) {
    const s = statsMap.get(gameId);
    return s && Number.isFinite(s.count) ? s.count : 0;
  }

  // 6) Pintar ⭐ en cada tarjeta (sin tocar ui.js)
  //    Tu ui.js ya pinta: ⭐ 0.0 (0)
  //    Esto lo actualiza en vivo encontrando el bloque dentro de cada card.
  function updateStarsInDOM(gameId, avg, count) {
    // Encontrar la card por el link "game.html?id=..."
    const link = document.querySelector(`a.btn.btn-primary[href="game.html?id=${CSS.escape(gameId)}"]`);
    if (!link) return;

    const card = link.closest(".card");
    if (!card) return;

    // Busca el "⭐ 0.0 (0)" dentro de la card (en tu diseño actual está como texto)
    // Lo hacemos robusto: buscamos cualquier nodo que contenga "⭐" y "(...)".
    const nodes = card.querySelectorAll("*");
    let targetNode = null;

    nodes.forEach(n => {
      const t = (n.textContent || "").trim();
      // ejemplo: "⭐ 0.0 (0)"
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

    // Orden:
    // 1) featured (true primero)
    // 2) avg desc
    // 3) count desc (si empatan en avg)
    // 4) title asc
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

    renderGameGrid("games-container", filtered);
    noResultsEl.style.display = filtered.length === 0 ? "block" : "none";

    // tras renderizar, re-pintamos estrellas con los stats que ya tengamos
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

  // 9) Suscribirse a gameStats en tiempo real (uno por juego)
  //    (Con 5 juegos va sobrado y es simple. Si tienes 200 juegos, ya optimizamos.)
  const unsubs = [];
  games.forEach(g => {
    const ref = doc(db, "gameStats", g.id);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        // si aún no hay stats, lo ponemos a 0
        statsMap.set(g.id, { avg: 0, count: 0, sum: 0 });
        updateStarsInDOM(g.id, 0, 0);
        scheduleApply(); // para que ordene de nuevo
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
      scheduleApply(); // re-orden recomendado en vivo
    });

    unsubs.push(unsub);
  });

  // 10) Render inicial
  apply();

  // (Opcional) limpiar listeners al salir
  window.addEventListener("beforeunload", () => {
    unsubs.forEach(fn => { try { fn(); } catch(_){} });
  });
});