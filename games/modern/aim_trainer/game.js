const SCORE_KEY = "gamehub_aim_best";

const arena = document.getElementById("arena");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ovTitle");
const ovSub = document.getElementById("ovSub");
const ovRules = document.getElementById("ovRules"); // Añadido
const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");

const uiTime = document.getElementById("time");
const uiHits = document.getElementById("hits");
const uiMiss = document.getElementById("miss");
const uiBest = document.getElementById("best");

let best = Number(localStorage.getItem(SCORE_KEY) || 0);
uiBest.textContent = best;

let running = false;
let paused = false;

let timeLeft = 30.0;
let hits = 0;
let miss = 0;

let targetEl = null;
let timerId = null;

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function rand(min, max){ return Math.random() * (max - min) + min; }

function updateHUD(){
  uiTime.textContent = timeLeft.toFixed(1);
  uiHits.textContent = hits;
  uiMiss.textContent = miss;
  uiBest.textContent = best;
}

function removeTarget(){
  if (targetEl){
    targetEl.remove();
    targetEl = null;
  }
}

function spawnTarget(){
  removeTarget();
  const rect = arena.getBoundingClientRect();
  const pad = 36;
  const x = rand(pad, rect.width - pad);
  const y = rand(pad, rect.height - pad);

  const t = document.createElement("div");
  t.className = "target";
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;

  t.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!running || paused) return;
    hits++;
    updateHUD();
    spawnTarget();
  });

  arena.appendChild(t);
  targetEl = t;
}

function showOverlay(title, sub, showRules = false){
  overlay.style.display = "flex";
  ovTitle.textContent = title;
  ovSub.textContent = sub;
  ovRules.style.display = showRules ? "block" : "none"; // Control de reglas
}

function hideOverlay(){
  overlay.style.display = "none";
}

function endGame(){
  running = false;
  clearInterval(timerId);
  timerId = null;
  removeTarget();

  if (hits > best){
    best = hits;
    localStorage.setItem(SCORE_KEY, String(best));
  }

  if (window.parent && window.parent.saveScoreFromGame) {
    window.parent.saveScoreFromGame("aim_trainer", hits);
  }

  showOverlay("🏁 Fin de la Caza", `Aciertos: ${hits} · Fallos: ${miss}`, false);
  btnStart.textContent = "▶ Reintentar";
  updateHUD();
}

function tick(){
  if (!running || paused) return;
  timeLeft = clamp(timeLeft - 0.1, 0, 999);
  updateHUD();
  if (timeLeft <= 0.0001) endGame();
}

function start(){
  running = true;
  paused = false;
  timeLeft = 30.0;
  hits = 0;
  miss = 0;
  updateHUD();
  hideOverlay();
  spawnTarget();
  clearInterval(timerId);
  timerId = setInterval(tick, 100);
}

function reset(){
  running = false;
  paused = false;
  clearInterval(timerId);
  timerId = null;
  timeLeft = 30.0;
  hits = 0;
  miss = 0;
  removeTarget();
  showOverlay("📜 Reglas de la Caza", "¿Listo para demostrar tu puntería?", true);
  btnStart.textContent = "▶ Empezar";
  updateHUD();
}

arena.addEventListener("click", () => {
  if (!running || paused) return;
  miss++;
  updateHUD();
});

btnStart.addEventListener("click", start);
btnReset.addEventListener("click", reset);

document.addEventListener("keydown", (e) => {
  if (e.key === " ") e.preventDefault();
  if (e.key === " "){
    if (!running) return;
    paused = !paused;
    if (paused){
      showOverlay("⏸️ Pausa", "Pulsa ESPACIO para continuar", false);
    }else{
      hideOverlay();
    }
  }
  if (e.key.toLowerCase() === "r") reset();
}, { passive:false });

reset();