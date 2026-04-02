// assets/js/pages/home.js
import { getGlobalLeaderboard } from "../scores.js";

async function loadGames() {
  return [
    {
      id: "chess",
      title: "Ajedrez Online",
      desc: "Estrategia pura. Gana ELO y conviértete en Gran Maestro de la Arena.",
      img: "assets/img/covers/ajedrez.jpg",
      category: "Estrategia"
    },
    {
      id: "snake",
      title: "Titan Snake",
      desc: "Reflejos prehistóricos. Crece sin límites y domina el tablero.",
      img: "assets/img/covers/snake.jpg",
      category: "Retro"
    },
    {
      id: "meteor_dodge",
      title: "Volcano Dodge",
      desc: "¡La lava sube! Esquiva las rocas y sobrevive a la erupción.",
      img: "assets/img/covers/meteor_dodge.jpg",
      category: "Acción"
    }
  ];
}

async function loadTopMonthly() {
  return {
    top: ["chess", "snake", "meteor_dodge"]
  };
}

function renderGameGrid(containerId, gamesList) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = gamesList.map(game => `
    <div class="card game-card" style="border-color: ${game.id === 'chess' ? '#f59e0b' : 'rgba(255,255,255,0.1)'}; overflow: hidden; display: flex; flex-direction: column;">
      
      <div style="width: 100%; height: 160px; overflow: hidden; background: #2a1a0a;">
        <img src="${game.img}" alt="${game.title}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
      </div>

      <div class="card-body" style="padding: 20px; flex-grow: 1; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #fff; font-size: 1.2rem;">${game.title}</h3>
            <span style="font-size: 10px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 2px 6px; border-radius: 4px; border: 1px solid #f59e0b;">${game.category}</span>
        </div>
        <p class="muted" style="font-size: 13px; margin-bottom: 20px; flex-grow: 1;">${game.desc}</p>
        <a href="game.html?id=${game.id}" class="btn ${game.id === 'chess' ? 'btn-primary' : 'btn-ghost'}" style="width: 100%; text-align: center; display: block; text-decoration: none;">Jugar Ahora</a>
      </div>
    </div>
  `).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const games = await loadGames();
    const topData = await loadTopMonthly();
    const topGames = games.filter(game => topData.top.includes(game.id));
    renderGameGrid("top-monthly", topGames);
  } catch (err) {
    console.error("Error cargando destacados:", err);
  }

  const tbody = document.getElementById("globalLeaderboardBody");
  if (tbody) {
    try {
      const topUsers = await getGlobalLeaderboard();
      if (topUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="muted" style="text-align:center;">Aún no hay guerreros registrados.</td></tr>`;
        return;
      }
      tbody.innerHTML = topUsers.map((u, idx) => {
          // USAMOS LA FUNCIÓN GLOBAL getRomanLevel definida en ui.js
          const level = u.level || 1;
          const roman = typeof getRomanLevel !== 'undefined' ? getRomanLevel(level) : "I";
          const isMax = level === 7;

          // LÓGICA DE TRAMPOSO
          const isCheater = u.isCheater || false;
          const displayName = isCheater ? `⚠️ ${u.nickname}` : u.nickname;
          
          // Color: Rojo si es tramposo (#ef4444), Verde si es nivel max (#10b981), blanco por defecto
          let nameColor = "white";
          if (isCheater) {
              nameColor = "#ef4444";
          } else if (isMax) {
              nameColor = "#10b981";
          }

          return `
            <tr>
              <td style="color:var(--primary); font-weight:bold;">#${idx + 1}</td>
              <td>
                <div style="display:flex; align-items:center; gap:10px;">
                  <img src="assets/img/iconos/${u.badge || 1}.png" style="width:28px; height:28px; object-fit:contain; border-radius:4px;">
                  <span style="font-weight:700; color: ${nameColor};">
                    ${displayName} <span class="roman-badge ${isMax && !isCheater ? 'roman-badge-max' : ''}">${roman}</span>
                  </span>
                </div>
              </td>
              <td style="font-weight:900; color:var(--primary); font-size:16px;">${u.score} pts</td>
            </tr>
          `;
      }).join("");
    } catch (error) {
      console.error("Error al renderizar el ranking:", error);
      tbody.innerHTML = `<tr><td colspan="3" style="color:var(--danger); text-align:center;">Error cargando ranking global.</td></tr>`;
    }
  }
});