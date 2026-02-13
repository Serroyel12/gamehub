function getLocalBest(game) {
  if (!game.scoreKey) return 0;
  const v = Number(localStorage.getItem(game.scoreKey) || 0);
  return Number.isFinite(v) ? v : 0;
}

function niceCategory(cat){
  if (cat === "retro") return "Retro";
  if (cat === "modern") return "Modern";
  if (cat === "original") return "Original";
  return cat || "";
}

function renderGameGrid(containerId, games) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  games.forEach(game => {
    const best = getLocalBest(game);
    const badge = game.featured ? `<div class="badge">🔥 Featured</div>` : "";
    const logo = game.logo ? `
      <div class="card-logo" title="${game.title}">
        <img src="${game.logo}" alt="${game.title} logo">
      </div>
    ` : "";

    const card = `
      <div class="card">
        ${badge}
        ${logo}
        <div class="card-cover">
          <img src="${game.cover}" alt="${game.title}">
        </div>
        <div class="card-body">
          <div class="card-title">${game.title}</div>
          <div class="card-text">${game.tagline || ""}</div>

          <div class="card-meta">
            <span class="pill">🏷️ ${niceCategory(game.category)}</span>
            <span class="pill">🏆 ${best}</span>
          </div>

          <div style="margin-top:12px;">
            <a class="btn btn-primary" href="game.html?id=${game.id}">▶ Jugar</a>
          </div>
        </div>
      </div>
    `;

    container.innerHTML += card;
  });
}

function renderGamePage(containerId, game) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const best = getLocalBest(game);

  container.innerHTML = `
    <div class="game-header">
      <div>
        <h2>${game.title}</h2>
        <div class="game-sub">${game.tagline || ""}</div>
        <div class="game-sub">🏆 Récord local: <b>${best}</b> · 🏷️ ${niceCategory(game.category)}</div>
      </div>
      <div>
        <a class="btn btn-ghost" href="games.html">← Volver</a>
      </div>
    </div>

    <div class="game-frame">
      <iframe src="${game.path}" loading="lazy"></iframe>
    </div>
  `;
}

function renderLocalLeaderboard(containerId, games, limit = 5) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const scored = games
    .filter(g => g.scoreKey)
    .map(g => ({ ...g, best: getLocalBest(g) }))
    .filter(g => g.best > 0)
    .sort((a, b) => b.best - a.best)
    .slice(0, limit);

  if (scored.length === 0) {
    container.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="card-title">🏆 Ranking local (Top ${limit})</div>
          <div class="card-text">Aún no hay puntuaciones. Juega a un juego para crear el ranking local.</div>
        </div>
      </div>
    `;
    return;
  }

  const rows = scored.map((g, idx) => `
    <tr>
      <td>#${idx + 1}</td>
      <td>
        <a href="game.html?id=${g.id}">${g.title}</a>
        <div style="color:var(--muted); font-size:12px;">${niceCategory(g.category)}</div>
      </td>
      <td>${g.best}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="card">
      <div class="card-body">
        <div class="section-title" style="margin-bottom:10px;">
          <h2 style="font-size:16px;">🏆 Ranking local (Top ${limit})</h2>
          <div class="hint">Guardado en tu navegador (demo)</div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th style="width:90px;">Pos</th>
              <th>Juego</th>
              <th>Récord</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
