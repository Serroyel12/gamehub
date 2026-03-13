const SCORE_KEY = "gamehub_rps_best";

const elRound = document.getElementById("round");
const elPWins = document.getElementById("pWins");
const elCWins = document.getElementById("cWins");
const elBest  = document.getElementById("best");
const elStatus= document.getElementById("status");
const elSub   = document.getElementById("sub");
const elPPick = document.getElementById("pPick");
const elCPick = document.getElementById("cPick");
const elLog   = document.getElementById("log");

// Importante: seleccionamos solo los botones de las jugadas, no el del overlay
const buttons = Array.from(document.querySelectorAll(".controls .btn"));

// Elementos del Overlay
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ovTitle");
const ovSub = document.getElementById("ovSub");
const startBtn = document.getElementById("startBtn");

let gameStarted = false;
let paused = false;
let round = 1;      // 1..5
let pWins = 0;
let cWins = 0;
let matchWins = 0;  // racha de matches ganados
let best = Number(localStorage.getItem(SCORE_KEY) || 0);
elBest.textContent = best;

// Cambiamos papel y tijera por hoja y garra
const PICK_EMOJI = {
  rock: "🪨",
  paper: "🍃",
  scissors: "🐾"
};

// --- Nuevo Evento de Inicio ---
startBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  startBtn.style.display = "none"; // Ocultamos el botón de empezar
  gameStarted = true;
  logLine("🎮 ¡El match ha comenzado!");
  updateUI();
});
// ------------------------------

function cpuPick() {
  const opts = ["rock","paper","scissors"];
  return opts[Math.floor(Math.random()*opts.length)];
}

function result(player, cpu){
  if (player === cpu) return "draw";
  if (
    (player === "rock" && cpu === "scissors") ||
    (player === "paper" && cpu === "rock") ||
    (player === "scissors" && cpu === "paper")
  ) return "win";
  return "lose";
}

function logLine(text){
  const div = document.createElement("div");
  div.className = "line";
  div.textContent = text;
  elLog.prepend(div);
}

function setButtons(enabled){
  buttons.forEach(b => b.disabled = !enabled);
}

function updateUI(){
  elRound.textContent = String(round);
  elPWins.textContent = String(pWins);
  elCWins.textContent = String(cWins);
  elBest.textContent = String(best);

  document.body.classList.toggle("paused", paused);
  
  // Solo activamos botones si el juego ha empezado, no está pausado y no ha terminado
  setButtons(gameStarted && !paused && !isMatchOver());
}

function isMatchOver(){
  return pWins === 3 || cWins === 3 || round > 5;
}

function startNewMatch(){
  round = 1;
  pWins = 0;
  cWins = 0;
  paused = false;
  elPPick.textContent = "—";
  elCPick.textContent = "—";
  elStatus.textContent = "Elige tu jugada";
  elSub.textContent = "Best of 5 · Ganas el match si llegas a 3";
  updateUI();
}

function endMatch(){
  const playerWon = pWins > cWins;

  if (playerWon) {
    matchWins += 1;
    logLine(`🏁 Match ganado. Racha: ${matchWins}`);
    elStatus.textContent = `🏆 ¡Ganaste el match! (Racha: ${matchWins})`;
    elSub.textContent = "Pulsa R para reiniciar el match";
  } else {
    checkAndSaveBest();
    matchWins = 0;
    logLine("💀 Match perdido. Racha reiniciada a 0");
    elStatus.textContent = "💀 Perdiste el match. Racha: 0";
    elSub.textContent = "Pulsa R para reiniciar el match";
  }

  if (playerWon) {
      checkAndSaveBest();
  }

  updateUI();
}

function checkAndSaveBest() {
  if (matchWins > best) {
    best = matchWins;
    localStorage.setItem(SCORE_KEY, String(best));
    elBest.textContent = String(best);
    logLine(`✨ Nuevo récord local: ${best}`);
  }
  
  if (window.parent && window.parent.saveScoreFromGame && matchWins > 0) {
    window.parent.saveScoreFromGame("reflex_arena", matchWins);
  }
}

function playRound(player){
  if (paused || isMatchOver() || !gameStarted) return;

  const cpu = cpuPick();
  const r = result(player, cpu);

  elPPick.textContent = PICK_EMOJI[player];
  elCPick.textContent = PICK_EMOJI[cpu];

  if (r === "win") pWins++;
  if (r === "lose") cWins++;

  const msg =
    r === "draw" ? "🤝 Empate" :
    r === "win"  ? "✅ Ganas la ronda" :
                   "❌ Pierdes la ronda";

  logLine(`R${round}: Tú ${PICK_EMOJI[player]} vs CPU ${PICK_EMOJI[cpu]} → ${msg}`);
  elStatus.textContent = msg;

  round++;
  updateUI();

  if (isMatchOver()) endMatch();
}

function togglePause(){
  if (!gameStarted || isMatchOver()) return; // No pausar si no ha empezado o ya terminó
  
  paused = !paused;
  if (paused) {
    ovTitle.textContent = "PAUSA";
    ovSub.innerHTML = "Pulsa <b>ESPACIO</b> para continuar";
    startBtn.style.display = "none";
    overlay.style.display = "flex"; // Mostramos el overlay en pausa
    elStatus.textContent = "⏸️ Pausa";
  } else {
    overlay.style.display = "none";
    elStatus.textContent = "Elige tu jugada";
  }
  updateUI();
}

function resetMatch(){
  if (!gameStarted) return;
  startNewMatch();
}

buttons.forEach(btn => {
  btn.addEventListener("click", () => playRound(btn.dataset.pick));
});

document.addEventListener("keydown", (e) => {
  const block = ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "];
  if (block.includes(e.key)) e.preventDefault();

  if (!gameStarted) return; // Ignorar teclas si no hemos dado a empezar

  if (e.key === " ") togglePause();
  if (e.key.toLowerCase() === "r") resetMatch();
}, { passive:false });

elLog.innerHTML = "";
logLine("🎮 Listo: pulsa Empezar para jugar.");
startNewMatch();