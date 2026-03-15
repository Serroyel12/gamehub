// assets/js/nav-auth.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function initNavbarAuth() {
  const nameEl = document.getElementById("navUserName");
  const loginBtn = document.getElementById("navLoginBtn");
  const profileBtn = document.getElementById("navProfileBtn");
  const logoutBtn = document.getElementById("navLogoutBtn");

  const userPill = nameEl?.closest(".pill") || null;

  function ensureBadgeImg(){
    if (!userPill) return null;
    let img = userPill.querySelector("img[data-role='badge']");
    if (!img){
      img = document.createElement("img");
      img.setAttribute("data-role","badge");
      img.alt = "Insignia";
      img.style.width = "22px"; // Un poco más grande para que se vea bien
      img.style.height = "22px";
      img.style.objectFit = "contain";
      img.style.marginRight = "8px";
      img.style.verticalAlign = "middle";
      img.style.borderRadius = "4px";
      userPill.insertBefore(img, userPill.firstChild);
    }
    return img;
  }

  const setGuest = () => {
    if (nameEl) nameEl.textContent = "Invitado";
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (profileBtn) profileBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";

    const img = userPill?.querySelector("img[data-role='badge']");
    if (img) img.remove();
  };

  const setUser = (nickname, badgeId) => {
    if (nameEl) nameEl.textContent = nickname || "Jugador";
    if (loginBtn) loginBtn.style.display = "none";
    if (profileBtn) profileBtn.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";

    if (userPill){
      const img = ensureBadgeImg();
      // Usamos el ID directamente (ej: "1" o "g11")
      img.src = `assets/img/iconos/${badgeId || '1'}.png`;
    }
  };

  // Cache (Carga rápida)
  const cachedNick = localStorage.getItem("gh_nickname");
  const cachedBadge = localStorage.getItem("gh_badge");
  if (cachedNick && nameEl) nameEl.textContent = cachedNick;
  if (cachedBadge && userPill){
    const img = ensureBadgeImg();
    img.src = `assets/img/iconos/${cachedBadge}.png`;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setGuest();
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? snap.data() : {};

      const nickname = data.nickname || user.email?.split("@")[0] || "Jugador";
      // Guardamos el badge tal cual (sea "1" o "g11")
      const badge = data.badge ? String(data.badge) : "1";

      localStorage.setItem("gh_nickname", nickname);
      localStorage.setItem("gh_badge", badge);

      setUser(nickname, badge);
    } catch (e) {
      console.error(e);
      const nick = user.email?.split("@")[0] || "Jugador";
      const badge = localStorage.getItem("gh_badge") || "1";
      setUser(nick, badge);
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js");
      await signOut(auth);
      localStorage.removeItem("gh_nickname");
      localStorage.removeItem("gh_badge");
      setGuest();
      window.location.href = "index.html";
    });
  }
}