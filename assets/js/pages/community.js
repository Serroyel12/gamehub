const POSTS_KEY = "gamehub_posts";

function getUserName(){
  try {
    const u = JSON.parse(localStorage.getItem("gamehub_user") || "null");
    return (u && u.name) ? u.name : "Invitado";
  } catch {
    return "Invitado";
  }
}

function loadPosts(){
  try {
    return JSON.parse(localStorage.getItem(POSTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePosts(posts){
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

function fmtTime(ts){
  const d = new Date(ts);
  return d.toLocaleString();
}

function renderFeed(posts){
  const feed = document.getElementById("feed");
  if (!feed) return;

  if (posts.length === 0){
    feed.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="card-title">Aún no hay mensajes</div>
          <div class="card-text">Sé el primero en publicar algo 🫡</div>
        </div>
      </div>
    `;
    return;
  }

  feed.innerHTML = posts.map(p => `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-body">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="font-weight:900;"> ${p.user}</div>
          <div style="color:var(--muted); font-size:12px;">${fmtTime(p.ts)} · 🎮 ${p.gameTitle}</div>
        </div>

        <div style="margin-top:10px; color: var(--text); line-height:1.4;">
          ${escapeHtml(p.text)}
        </div>

        <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
          <button class="btn btn-ghost like-btn" data-id="${p.id}" type="button">👍 Me gusta</button>
          <span class="pill">❤️ ${p.likes || 0}</span>
        </div>
      </div>
    </div>
  `).join("");

  // bind likes
  document.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const all = loadPosts();
      const post = all.find(x => x.id === id);
      if (!post) return;
      post.likes = (post.likes || 0) + 1;
      savePosts(all);
      applyFilters();
    });
  });
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

let ALL_GAMES = [];
function titleForGameId(id){
  const g = ALL_GAMES.find(x => x.id === id);
  return g ? g.title : "General";
}

function applyFilters(){
  const filter = document.getElementById("gameFilter").value;
  let posts = loadPosts();

  // newest first
  posts.sort((a,b) => b.ts - a.ts);

  if (filter !== "all"){
    posts = posts.filter(p => p.gameId === filter);
  }

  renderFeed(posts);
}

document.addEventListener("DOMContentLoaded", async () => {
  ALL_GAMES = await loadGames();

  const sel = document.getElementById("gameFilter");
  ALL_GAMES.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.title;
    sel.appendChild(opt);
  });

  document.getElementById("post").addEventListener("click", () => {
    const textEl = document.getElementById("text");
    const gameId = sel.value === "all" ? "general" : sel.value;

    const text = (textEl.value || "").trim();
    if (text.length < 2) return;

    const posts = loadPosts();
    posts.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      user: getUserName(),
      text,
      ts: Date.now(),
      gameId,
      gameTitle: (gameId === "general") ? "General" : titleForGameId(gameId),
      likes: 0
    });

    savePosts(posts);
    textEl.value = "";
    applyFilters();
  });

  sel.addEventListener("change", applyFilters);
  applyFilters();
});
