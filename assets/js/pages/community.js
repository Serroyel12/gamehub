import { auth, db } from "../firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const POSTS_KEY = "rankarena_posts";

/**
 * Obtiene el nivel real de Firebase. 
 * Si no está logueado o hay error, devuelve 1.
 */
async function getRealLevel(user) {
    if (!user) return 1;
    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            return parseInt(snap.data().level) || 1;
        }
    } catch (e) {
        console.error("Error consultando nivel en Firebase:", e);
    }
    return 1;
}

function loadPosts() {
    try {
        return JSON.parse(localStorage.getItem(POSTS_KEY) || "[]");
    } catch { return []; }
}

function savePosts(posts) {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

function renderFeed(posts) {
    const feed = document.getElementById("feed");
    if (!feed) return;

    if (posts.length === 0) {
        feed.innerHTML = `<div class="card"><div class="card-body">Aún no hay mensajes. ¡Sé el primero!</div></div>`;
        return;
    }

    feed.innerHTML = posts.map(p => {
        const pLevel = parseInt(p.level) || 1;
        
        // Conversión manual a Romano para asegurar el II
        const romanos = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
        const roman = romanos[pLevel] || "I";

        const isMax = pLevel === 7;
        const nameColor = isMax ? '#10b981' : 'white';

        return `
        <div class="card" style="margin-bottom:12px; border-left: 4px solid ${isMax ? '#10b981' : 'rgba(245, 158, 11, 0.3)'};">
          <div class="card-body">
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items: center;">
              <div style="font-weight:900; color: ${nameColor}; display: flex; align-items: center; gap: 8px;"> 
                ${p.user} 
                <span class="roman-badge ${isMax ? 'roman-badge-max' : ''}" 
                      style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: #f59e0b; border: 1px solid rgba(245,158,11,0.2);">
                  ${roman}
                </span>
              </div>
              <div style="color:var(--muted); font-size:12px;">${new Date(p.ts).toLocaleString()} · 🎮 ${p.gameTitle}</div>
            </div>
            <div style="margin-top:10px; color: var(--text); line-height:1.4;">${p.text}</div>
            <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
              <button class="btn btn-ghost like-btn" data-id="${p.id}" style="padding: 4px 10px; font-size: 12px;">👍 Me gusta</button>
              <span class="pill" style="border: 1px solid rgba(255,255,255,0.1);">❤️ ${p.likes || 0}</span>
            </div>
          </div>
        </div>`;
    }).join("");

    // Bind de likes
    document.querySelectorAll(".like-btn").forEach(btn => {
        btn.onclick = () => {
            const all = loadPosts();
            const post = all.find(x => x.id === btn.dataset.id);
            if (post) {
                post.likes = (post.likes || 0) + 1;
                savePosts(all);
                renderFeed(all);
            }
        };
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    let currentUser = null;
    let ALL_GAMES = [];
    if (typeof loadGames === 'function') ALL_GAMES = await loadGames();

    const sel = document.getElementById("gameFilter");
    const postBtn = document.getElementById("post");
    const textEl = document.getElementById("text");

    // Rellenar select
    if (sel && ALL_GAMES.length > 0) {
        ALL_GAMES.forEach(g => {
            const opt = document.createElement("option");
            opt.value = g.id; opt.textContent = g.title;
            sel.appendChild(opt);
        });
    }

    // Detectar login
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (!user) {
            if(postBtn) postBtn.disabled = true;
            if(textEl) textEl.placeholder = "Inicia sesión para publicar...";
        } else {
            if(postBtn) postBtn.disabled = false;
            if(textEl) textEl.placeholder = "Escribe un mensaje...";
        }
        renderFeed(loadPosts());
    });

    if (postBtn) {
        postBtn.onclick = async () => {
            const text = (textEl.value || "").trim();
            if (text.length < 2) return;

            // --- AQUÍ ESTÁ EL ARREGLO ---
            // Consultamos Firebase justo antes de publicar el post
            const realLevel = await getRealLevel(currentUser);
            const myNick = localStorage.getItem("gh_nickname") || "Guerrero";

            const posts = loadPosts();
            posts.push({
                id: String(Date.now() + Math.random()),
                user: myNick,
                level: realLevel, // Guardamos el nivel real (ej: 2)
                text: text,
                ts: Date.now(),
                gameId: sel.value === "all" ? "general" : sel.value,
                gameTitle: sel.value === "all" ? "General" : (ALL_GAMES.find(g => g.id === sel.value)?.title || "General"),
                likes: 0
            });

            savePosts(posts);
            textEl.value = "";
            renderFeed(posts);
        };
    }
});