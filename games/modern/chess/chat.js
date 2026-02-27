// games/modern/chess/chat.js
import { auth, db } from "../../../assets/js/firebase.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function qs(id){ return document.getElementById(id); }

function escapeHTML(str){
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

function showHint(msg, ok=true){
  const hint = qs("chatHint");
  if (!hint) return;
  hint.style.display = "inline-flex";
  hint.textContent = msg;
  hint.style.opacity = "1";
  // Usamos las clases de tu base.css si existen, o mantenemos los estilos inline
  hint.style.border = ok
    ? "1px solid rgba(34,197,94,.35)"
    : "1px solid rgba(239,68,68,.35)";
  hint.style.background = ok
    ? "rgba(34,197,94,.10)"
    : "rgba(239,68,68,.10)";
  setTimeout(()=>{ hint.style.display="none"; }, 2200);
}

let unsubChat = null;

export function stopChat(){
  if (unsubChat) { unsubChat(); unsubChat = null; }
}

export function startChat(matchId){
  const card = qs("chatCard");
  const box = qs("chatMessages");
  const input = qs("chatInput");
  const btn = qs("btnSendChat");

  if (!card || !box || !input || !btn) return;

  card.style.display = "block";
  box.innerHTML = `<div class="muted" style="padding:10px; opacity:0.6;">Cargando chat…</div>`;

  stopChat();

  const q = query(
    collection(db, "matches", matchId, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );

  unsubChat = onSnapshot(q, (snap) => {
    box.innerHTML = "";
    snap.forEach(docu => {
      const m = docu.data();
      const mine = auth.currentUser?.uid === m.uid;

      const wrap = document.createElement("div");
      wrap.className = "chat-item"; // ✅ Usamos la clase de tu CSS
      wrap.style.textAlign = mine ? "right" : "left";

      // ✅ Aplicamos la clase chat-bubble y quitamos estilos inline redundantes
      wrap.innerHTML = `
        <span class="chat-bubble" style="
          background: ${mine ? "rgba(56,189,248,.22)" : "rgba(148,163,184,.14)"};
          border: 1px solid ${mine ? "rgba(56,189,248,.2)" : "rgba(148,163,184,.12)"};
          color: white;
        ">
          ${escapeHTML(m.text)}
        </span>
      `;

      box.appendChild(wrap);
    });

    // Scroll suave al final
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, (err) => {
    console.error(err);
    box.innerHTML = `<div class="muted">No se pudo cargar el chat (permisos).</div>`;
    showHint("❌ No puedes acceder al chat.", false);
  });

  async function send(){
    const user = auth.currentUser;
    if (!user){
      showHint("Debes iniciar sesión.", false);
      return;
    }
    const text = (input.value || "").trim();
    if (!text) return;

    try{
      // Limpiamos el input inmediatamente para mejor UX
      const msgText = text.slice(0, 300);
      input.value = "";
      
      await addDoc(collection(db, "matches", matchId, "messages"), {
        uid: user.uid,
        text: msgText,
        createdAt: serverTimestamp()
      });
    }catch(e){
      console.error(e);
      showHint("❌ No se pudo enviar.", false);
    }
  }

  btn.onclick = send;
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Evita saltos de línea molestos
      send();
    }
  };
}