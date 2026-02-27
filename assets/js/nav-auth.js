// assets/js/nav-auth.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export function initNavbarAuth() {
  const nameEl = document.getElementById("navUserName");
  const loginBtn = document.getElementById("navLoginBtn");
  const profileBtn = document.getElementById("navProfileBtn");
  const logoutBtn = document.getElementById("navLogoutBtn");

  // Si tienes un contenedor pill tipo: "👤 <b id=navUserName>"
  // vamos a inyectar un img antes del nombre (si no existe lo creamos)
  const userPill = nameEl?.closest(".pill") || null;

  function ensureBadgeImg(){
    if (!userPill) return null;
    let img = userPill.querySelector("img[data-role='badge']");
    if (!img){
      img = document.createElement("img");
      img.setAttribute("data-role","badge");
      img.alt = "Insignia";
      img.style.width = "18px";
      img.style.height = "18px";
      img.style.objectFit = "contain";
      img.style.marginRight = "6px";
      img.style.verticalAlign = "middle";
      img.style.borderRadius = "6px";
      // inserta al principio del pill
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

  const setUser = (nickname, badgeNumber) => {
    if (nameEl) nameEl.textContent = nickname || "Jugador";
    if (loginBtn) loginBtn.style.display = "none";
    if (profileBtn) profileBtn.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";

    if (userPill){
      const img = ensureBadgeImg();
      const n = Number(badgeNumber || 1);
      img.src = `assets/img/iconos/${n}.png`;
    }
  };

  // Pintado rápido (cache)
  const cachedNick = localStorage.getItem("gh_nickname");
  const cachedBadge = localStorage.getItem("gh_badge");
  if (cachedNick && nameEl) nameEl.textContent = cachedNick;
  if (cachedBadge && userPill){
    const img = ensureBadgeImg();
    img.src = `assets/img/iconos/${Number(cachedBadge) || 1}.png`;
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

      // badge: 1..10, pero si no premium => 1..9
      const premium = !!data.premium;
      let badge = Number(data.badge || 1);
      if (!Number.isFinite(badge) || badge < 1 || badge > 10) badge = 1;
      if (!premium && badge === 10) badge = 1;

      localStorage.setItem("gh_nickname", nickname);
      localStorage.setItem("gh_badge", String(badge));

      setUser(nickname, badge);
    } catch (e) {
      console.error(e);
      // fallback
      const nick = user.email?.split("@")[0] || "Jugador";
      const badge = Number(localStorage.getItem("gh_badge") || 1) || 1;
      setUser(nick, badge);
    }
  });

  // Logout
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