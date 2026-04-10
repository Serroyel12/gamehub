// games/modern/chess/game.js

// Firebase
import { auth, db } from "../../../assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { startChat, stopChat } from "./chat.js";

// DOM
const statusEl = document.getElementById("status");
const fenBox = document.getElementById("fenBox");
const movesEl = document.getElementById("moves");

const btnNew = document.getElementById("btnNew");
const btnUndo = document.getElementById("btnUndo");
const btnFlip = document.getElementById("btnFlip");
const btnCopyFen = document.getElementById("btnCopyFen");

const btnCreateOnline = document.getElementById("btnCreateOnline");
const btnJoinOnline = document.getElementById("btnJoinOnline");
const joinCode = document.getElementById("joinCode");
const matchInfo = document.getElementById("matchInfo");
const btnToggleSkin = document.getElementById("btnToggleSkin");

// DOM ELO UI
const topPlayerEl = document.getElementById("topPlayer");
const topBadgeEl = document.getElementById("topBadge");
const topNameEl = document.getElementById("topName");
const topEloEl = document.getElementById("topElo");

const bottomPlayerEl = document.getElementById("bottomPlayer");
const bottomBadgeEl = document.getElementById("bottomBadge");
const bottomNameEl = document.getElementById("bottomName");
const bottomEloEl = document.getElementById("bottomElo");

const btnStartTimer = document.getElementById("btnStartTimer");
const topTimerEl = document.getElementById("topTimer");
const bottomTimerEl = document.getElementById("bottomTimer");

let timerInterval = null;
const INITIAL_TIME = 600; // 10 minutos

const ChessCtor = window.Chess || null;
const ChessboardCtor = window.Chessboard || null;

function setStatus(t) { statusEl.textContent = t; }
function showMatchInfo(t) {
  matchInfo.style.display = "inline-flex";
  matchInfo.textContent = t;
}

// PREMIUM + SKINS
function isPremiumUser() { return localStorage.getItem("gamehub_premium") === "1"; }
const SKINS = ["wikipedia", "skin1", "skin2", "skin3"];

function getSkinName() {
  const saved = localStorage.getItem("gamehub_chess_skin") || "wikipedia";
  return SKINS.includes(saved) ? saved : "wikipedia";
}
function setSkinName(name) { localStorage.setItem("gamehub_chess_skin", name); }

function getPieceThemePath(piece) {
  const pathArray = window.location.pathname.split('/');
  const repoName = pathArray[1]; 
  let baseUrl = window.location.hostname.includes("github.io") 
    ? `${window.location.origin}/${repoName}/assets/img/chesspieces`
    : `${window.location.origin}/assets/img/chesspieces`;

  const skin = isPremiumUser() ? getSkinName() : "wikipedia";
  if (piece) return `${baseUrl}/${skin}/${piece}.png`;
  return `${baseUrl}/${skin}/{piece}.png`;
}

function syncSkinButtonVisibility() {
  if (!btnToggleSkin) return;
  if (!isPremiumUser()) {
    btnToggleSkin.style.display = "none";
    setSkinName("wikipedia");
  } else {
    btnToggleSkin.style.display = "inline-flex";
  }
}

let boardConfig = null;
function recreateBoardKeepState() {
  if (!boardConfig) return;
  const fen = game.fen();
  const orient = flipped ? "black" : "white";

  boardConfig.pieceTheme = getPieceThemePath();
  boardConfig.orientation = orient;
  boardConfig.position = fen;

  const el = document.getElementById("board");
  el.innerHTML = "";
  board = ChessboardCtor("board", boardConfig);
  board.position(fen, false);
}

btnToggleSkin?.addEventListener("click", () => {
  if (!isPremiumUser()) return;
  const current = getSkinName();
  const idx = SKINS.indexOf(current);
  const next = SKINS[(idx + 1) % SKINS.length];

  setSkinName(next);
  recreateBoardKeepState();
  setStatus(`🎨 Skin: ${next}`);
  setTimeout(updateUI, 300);
});

// ESTADO
let me = null;
let myData = null; // Guardará nuestro ELO y Badge al iniciar sesión
let game = new ChessCtor();
let board = null;
let flipped = false;

// Online
let onlineMode = false;
let matchId = null;
let unsub = null;
let myColor = null; 
let matchData = null; 

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function turnLabel(t) { return t === "w" ? "Blancas" : "Negras"; }

function formatTime(seconds) {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function startLocalTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!matchData || matchData.status !== "active" || matchData.winner) {
      clearInterval(timerInterval);
      return;
    }
    const now = Date.now();
    const lastUpdate = matchData.updatedAt?.toDate().getTime() || now;
    const elapsed = Math.floor((now - lastUpdate) / 1000);

    let wTime = matchData.whiteTime ?? INITIAL_TIME;
    let bTime = matchData.blackTime ?? INITIAL_TIME;

    if (matchData.turn === "w") wTime -= elapsed;
    else bTime -= elapsed;

    if (myColor === "w") {
      bottomTimerEl.textContent = formatTime(wTime);
      topTimerEl.textContent = formatTime(bTime);
      bottomTimerEl.classList.toggle("timer-active", matchData.turn === "w");
      topTimerEl.classList.toggle("timer-active", matchData.turn === "b");
    } else {
      bottomTimerEl.textContent = formatTime(bTime);
      topTimerEl.textContent = formatTime(wTime);
      bottomTimerEl.classList.toggle("timer-active", matchData.turn === "b");
      topTimerEl.classList.toggle("timer-active", matchData.turn === "w");
    }

    if (wTime <= 0 || bTime <= 0) handleTimeout(wTime <= 0 ? "w" : "b");
  }, 1000);
}

async function handleTimeout(loser) {
  clearInterval(timerInterval);
  if (!matchId || matchData.winner) return;
  const winner = loser === "w" ? "b" : "w";
  await updateDoc(doc(db, "matches", matchId), {
    winner: winner,
    status: "finished",
    updatedAt: serverTimestamp()
  });
}

// UI
function renderHistory() {
  const history = game.history({ verbose: true });
  let html = "";
  for (let i = 0; i < history.length; i += 2) {
    const n = (i / 2) + 1;
    const w = history[i]?.san || "";
    const b = history[i + 1]?.san || "";
    html += `<div>${n}. <b style="color:var(--primary);">${w}</b> ${b}</div>`;
  }
  movesEl.innerHTML = html || "<div>—</div>";
}

function checkWinnerText() {
  if (game.in_checkmate && game.in_checkmate()) {
    const loserTurn = game.turn();
    const winner = loserTurn === "w" ? "Negras" : "Blancas";
    const iWin = (myColor && (winner === "Blancas" ? myColor === "w" : myColor === "b"));
    return iWin ? `🏆 JAQUE MATE — ¡Ganaste!` : `💀 JAQUE MATE — Has perdido`;
  }
  if (game.in_draw && game.in_draw()) return "🤝 Tablas";
  if (game.in_check && game.in_check()) return `⚠️ Jaque — Turno: ${turnLabel(game.turn())}`;
  return `Turno: ${turnLabel(game.turn())}`;
}

function updateUI() {
  fenBox.value = game.fen();
  renderHistory();
  let s = checkWinnerText();

  if (onlineMode && matchId) {
    const meTxt = myColor ? (myColor === "w" ? "Blancas" : "Negras") : "—";
    s += ` | Juegas con: ${meTxt} | Código: ${matchId}`;
  }

  setStatus(s);
}

function canIMove() {
  if (!onlineMode) return true;
  if (!matchData) return false;
  if (matchData.status !== "active") return false;
  if (!myColor) return false;
  if (matchData.turn !== myColor) return false;
  if (matchData.winner) return false;
  return true;
}

function onDragStart(source, piece) {
  if (game.game_over && game.game_over()) return false;
  if (game.turn() === "w" && piece.startsWith("b")) return false;
  if (game.turn() === "b" && piece.startsWith("w")) return false;
  if (onlineMode && !canIMove()) return false;
  return true;
}

async function pushStateToFirestore() {
  if (!onlineMode || !matchId || !matchData) return;
  if (matchData.turn !== myColor) return;

  const now = Date.now();
  const lastUpdate = matchData.updatedAt?.toDate().getTime() || now;
  const elapsed = Math.floor((now - lastUpdate) / 1000);

  const ref = doc(db, "matches", matchId);
  let winner = null;
  if (game.in_checkmate && game.in_checkmate()) {
    winner = (game.turn() === "w") ? "b" : "w";
  } else if (game.in_draw && game.in_draw()) {
    winner = "draw";
  }

  let updateData = {
    fen: game.fen(),
    turn: game.turn(),
    winner: winner,
    updatedAt: serverTimestamp()
  };

  // Solo si el reloj está activado
  if (matchData.whiteTime !== undefined) {
    if (myColor === "w") updateData.whiteTime = (matchData.whiteTime ?? INITIAL_TIME) - elapsed;
    else updateData.blackTime = (matchData.blackTime ?? INITIAL_TIME) - elapsed;
  }

  await updateDoc(ref, updateData);
}

function onDrop(source, target) {
  if (onlineMode && !canIMove()) return "snapback";

  const move = game.move({ from: source, to: target, promotion: "q" });
  if (move === null) return "snapback";

  board.position(game.fen(), false);
  updateUI();

  if (onlineMode) {
    pushStateToFirestore().catch(console.error);
  }
}

function onSnapEnd() { board.position(game.fen(), false); }

// ======================
// FUNCIONES ELO ONLINE
// ======================
async function fetchMyData() {
  if (!me) return {};
  const snap = await getDoc(doc(db, "users", me.uid));
  const data = snap.exists() ? snap.data() : {};
  if (!data.elo) data.elo = 1200; // ELO base
  return data;
}

function updatePlayerHeaders() {
  if (!onlineMode) {
    topPlayerEl.style.display = "none";
    bottomPlayerEl.style.display = "none";
    return;
  }

  topPlayerEl.style.display = "flex";
  bottomPlayerEl.style.display = "flex";

  const basePath = "../../../assets/img/iconos/";

  if (myColor === "w") {
    // Yo soy Blancas (Abajo)
    bottomNameEl.textContent = matchData.whiteName || "Tú";
    bottomEloEl.textContent = matchData.whiteElo || 1200;
    if(matchData.whiteBadge) { bottomBadgeEl.src = `${basePath}${matchData.whiteBadge}.png`; bottomBadgeEl.style.display="block"; }

    // Rival es Negras (Arriba)
    topNameEl.textContent = matchData.blackName || "Esperando rival...";
    topEloEl.textContent = matchData.blackName ? (matchData.blackElo || 1200) : "---";
    if(matchData.blackBadge) { topBadgeEl.src = `${basePath}${matchData.blackBadge}.png`; topBadgeEl.style.display="block"; } else { topBadgeEl.style.display="none"; }
  
  } else {
    // Yo soy Negras (Abajo)
    bottomNameEl.textContent = matchData.blackName || "Tú";
    bottomEloEl.textContent = matchData.blackElo || 1200;
    if(matchData.blackBadge) { bottomBadgeEl.src = `${basePath}${matchData.blackBadge}.png`; bottomBadgeEl.style.display="block"; }

    // Rival es Blancas (Arriba)
    topNameEl.textContent = matchData.whiteName || "Rival";
    topEloEl.textContent = matchData.whiteElo || 1200;
    if(matchData.whiteBadge) { topBadgeEl.src = `${basePath}${matchData.whiteBadge}.png`; topBadgeEl.style.display="block"; }
  }
}

function bindMatch(code) {
  if (unsub) unsub();

  const ref = doc(db, "matches", code);
  unsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      setStatus("❌ La partida no existe.");
      return;
    }

    matchData = snap.data();
    onlineMode = true;
    matchId = code;

    myColor = null;
    if (me) {
      if (matchData.white === me.uid) myColor = "w";
      else if (matchData.black === me.uid) myColor = "b";
    }

    updatePlayerHeaders();

    if (matchData.status === "waiting") {
      showMatchInfo(`🕒 Esperando rival... Código: ${code}`);
      stopChat(); 
    } else {
      showMatchInfo(`✅ Partida activa · Código: ${code}`);
      if (myColor) startChat(code); else stopChat();
    }

    let remoteFen = matchData.fen;
    if (!remoteFen || remoteFen === "start") remoteFen = new ChessCtor().fen();

    if (remoteFen !== game.fen()) {
      game = new ChessCtor(remoteFen);
      board.position(remoteFen, false);
    }

    if (myColor) {
      board.orientation(myColor === "b" ? "black" : "white");
      flipped = (myColor === "b");
    }

    updateUI();

    // ==========================================
    // LÓGICA DE TIEMPOS Y RELOJES (NUEVO)
    // ==========================================
    if (matchData.whiteTime !== undefined) {
      // Si el reloj está activado en Firebase, mostramos y arrancamos
      btnStartTimer.style.display = "none";
      topTimerEl.style.display = "block";
      bottomTimerEl.style.display = "block";
      startLocalTimer();
    } else {
      // Si no está activado, solo mostramos el botón al admin (blancas) si la partida es activa
      topTimerEl.style.display = "none";
      bottomTimerEl.style.display = "none";
      const isGameActive = matchData.status === "active" && !matchData.winner;
      btnStartTimer.style.display = (onlineMode && isGameActive) ? "inline-flex" : "none";
    }

    // ==========================================
    // PROCESAMIENTO AUTOMÁTICO DE ELO
    // ==========================================
    if (matchData.winner && myColor) {
      const myProcessedKey = myColor === "w" ? "whiteProcessed" : "blackProcessed";
      
      if (!matchData[myProcessedKey]) {
        const iWon = matchData.winner === myColor;
        const isDraw = matchData.winner === "draw";
        
        const myElo = myColor === "w" ? (matchData.whiteElo||1200) : (matchData.blackElo||1200);
        const opElo = myColor === "w" ? (matchData.blackElo||1200) : (matchData.whiteElo||1200);

        let scoreActual = isDraw ? 0.5 : (iWon ? 1 : 0);
        const K = 18; 
        const expected = 1 / (1 + Math.pow(10, (opElo - myElo) / 400));
        const change = Math.round(K * (scoreActual - expected));

        const newElo = Math.max(100, myElo + change);

        // Guardamos en nuestro perfil
        updateDoc(doc(db, "users", me.uid), { elo: newElo }).catch(console.error);
        // Marcamos la partida como procesada
        updateDoc(doc(db, "matches", matchId), { [myProcessedKey]: true }).catch(console.error);

        // Actualizamos UI visualmente
        const changeTxt = change >= 0 ? `+${change}` : change;
        bottomEloEl.textContent = `${newElo} (${changeTxt})`;
        setStatus(`🏁 FIN. Has ${iWon ? 'ganado' : (isDraw ? 'empatado' : 'perdido')}. ELO: ${changeTxt}`);
        
        // Detener el cronómetro si existía
        if (timerInterval) clearInterval(timerInterval);
      }
    }

  }, (err) => {
    console.error(err);
    setStatus("❌ Error de permisos o conexión");
  });
}

btnCreateOnline?.addEventListener("click", async () => {
  if (!me) { setStatus("❌ Inicia sesión primero."); return; }
  
  myData = await fetchMyData();
  const code = randomCode(6);
  const ref = doc(db, "matches", code);

  await setDoc(ref, {
    status: "waiting",
    white: me.uid,
    whiteName: myData.nickname || "Jugador",
    whiteElo: myData.elo || 1200,
    whiteBadge: myData.badge || 1,
    black: null,
    fen: new ChessCtor().fen(),
    turn: "w",
    winner: null,
    whiteProcessed: false,
    blackProcessed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  bindMatch(code);
  btnCopyFen.style.display = "none"; // Ocultamos copiar FEN en online
});

btnJoinOnline?.addEventListener("click", async () => {
  if (!me) { setStatus("❌ Inicia sesión primero."); return; }

  const code = (joinCode?.value || "").trim().toUpperCase();
  if (!code) { setStatus("❌ Escribe un código."); return; }

  const ref = doc(db, "matches", code);
  const snap = await getDoc(ref);

  if (!snap.exists()) { setStatus("❌ No existe esa partida."); return; }

  const data = snap.data();
  myData = await fetchMyData();

  if (!data.black && data.white !== me.uid) {
    await updateDoc(ref, {
      black: me.uid,
      blackName: myData.nickname || "Jugador",
      blackElo: myData.elo || 1200,
      blackBadge: myData.badge || 1,
      status: "active",
      updatedAt: serverTimestamp()
    });
  }

  bindMatch(code);
  btnCopyFen.style.display = "none";
});

btnNew?.addEventListener("click", () => {
  if (unsub) { unsub(); unsub = null; }
  stopChat();
  onlineMode = false;
  matchId = null;
  matchData = null;
  myColor = null;
  matchInfo.style.display = "none";
  updatePlayerHeaders();
  btnCopyFen.style.display = "inline-flex";

  game.reset();
  board.position("start", false);
  updateUI();
});

btnUndo?.addEventListener("click", () => {
  if (onlineMode) { setStatus("⚠️ En online no hay deshacer."); return; }
  game.undo(); board.position(game.fen(), false); updateUI();
});

btnFlip?.addEventListener("click", () => {
  flipped = !flipped; board.orientation(flipped ? "black" : "white");
});

btnCopyFen?.addEventListener("click", async () => {
  await navigator.clipboard.writeText(game.fen());
  setStatus("✅ FEN copiado");
  setTimeout(updateUI, 700);
});

// INIT board
boardConfig = {
  draggable: true,
  position: "start",
  orientation: "white",
  pieceTheme: getPieceThemePath(),
  onDragStart,
  onDrop,
  onSnapEnd
};

board = ChessboardCtor("board", boardConfig);


// Al final de games/modern/chess/game.js

btnStartTimer?.addEventListener("click", async () => {
  if (!onlineMode || !matchId) return;
  try {
    await updateDoc(doc(db, "matches", matchId), {
      whiteTime: INITIAL_TIME,
      blackTime: INITIAL_TIME,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.error("Error al activar el reloj:", e);
  }
});


onAuthStateChanged(auth, async (user) => {
  me = user || null;
  syncSkinButtonVisibility();

  if (!me) {
    setStatus("⚠️ Inicia sesión para jugar online.");
  } else {
    myData = await fetchMyData();
    updateUI();
  }
});

