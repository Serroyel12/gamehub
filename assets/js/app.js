const USER_KEY = "gamehub_user";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function setUser(name) {
  localStorage.setItem(USER_KEY, JSON.stringify({ name }));
}

function clearUser() {
  localStorage.removeItem(USER_KEY);
}

function updateNavbarUser() {
  const user = getUser();

  const navUser = document.getElementById("nav-user");
  const navLogin = document.getElementById("nav-login");
  const navLogout = document.getElementById("nav-logout");

  if (!navUser) return; // páginas que no tengan navbar completa

  if (user && user.name) {
    navUser.textContent = `👤 ${user.name}`;
    if (navLogin) navLogin.style.display = "none";
    if (navLogout) navLogout.style.display = "inline-flex";
  } else {
    navUser.textContent = "👤 Invitado";
    if (navLogin) navLogin.style.display = "inline-flex";
    if (navLogout) navLogout.style.display = "none";
  }

  if (navLogout && !navLogout.dataset.bound) {
    navLogout.dataset.bound = "1";
    navLogout.addEventListener("click", () => {
      clearUser();
      updateNavbarUser();
    });
  }
}

document.addEventListener("DOMContentLoaded", updateNavbarUser);
