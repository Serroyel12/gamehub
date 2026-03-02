// games/modern/chess/game.js (ONLINE + JAQUE MATE + SKINS CIRCULARES)

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

// Librerías globales (cargadas por script normal, NO module)
const ChessCtor = window.Chess || null;
const ChessboardCtor = window.Chessboard || null;

function setStatus(t) { statusEl.textContent = t; }
function showMatchInfo(t) {
  matchInfo.style.display = "inline-flex";
  matchInfo.textContent = t;
}

if (!ChessCtor || !ChessboardCtor) {
  setStatus("❌ Faltan librerías (Chess o Chessboard). Revisa scripts.");
  throw new Error("Missing libs");
}

/// ======================
// PREMIUM + SKINS (compatible chessboard.js 1.0.0)
// ======================
function isPremiumUser() {
  return localStorage.getItem("gamehub_premium") === "1";
}

const SKINS = ["wikipedia", "skin1", "skin2", "skin3"];

function getSkinName() {
  const saved = localStorage.getItem("gamehub_chess_skin") || "wikipedia";
  return SKINS.includes(saved) ? saved : "wikipedia";
}
function setSkinName(name) {
  localStorage.setItem("gamehub_chess_skin", name);
}
function getPieceThemePath(piece) {
  // 1. Obtenemos la ruta base absoluta de forma segura
  const baseUrl = new URL("../../../assets/img/chesspieces/", import.meta.url).href;
  
  // 2. Determinamos el skin
  const skin = isPremiumUser() ? getSkinName() : "wikipedia";
  
  // 3. Construimos la ruta. 
  // chessboard.js puede llamar a esta función pasando 'piece' o esperando el string con el template.
  if (piece) {
    return `${baseUrl}${skin}/${piece}.png`;
  }
  
  // Si no recibe 'piece', devolvemos el template que la librería espera
  return `${baseUrl}${skin}/{piece}.png`;
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

// OJO: aquí guardamos la config base del tablero (se rellena en INIT)
let boardConfig = null;

function recreateBoardKeepState() {
  if (!boardConfig) return;

  const fen = game.fen();
  const orient = flipped ? "black" : "white";

  // Cambiar theme
  boardConfig.pieceTheme = getPieceThemePath();
  boardConfig.orientation = orient;
  boardConfig.position = fen;

  // Vaciar el contenedor (si no, chessboard duplica cosas)
  const el = document.getElementById("board");
  el.innerHTML = "";

  // Recrear
  board = ChessboardCtor("board", boardConfig);

  // Asegurar posición
  board.position(fen, false);
}

// Botón: ciclo skins
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

// ======================
// Estado
// ======================
let me = null;

let game = new ChessCtor();
let board = null;
let flipped = false;

// Online
let onlineMode = false;
let matchId = null;
let unsub = null;

let myColor = null;       // 'w' o 'b'
let matchData = null;     // snapshot data

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function turnLabel(t) { return t === "w" ? "Blancas" : "Negras"; }

// ======================
// UI
// ======================
function renderHistory() {
  const history = game.history({ verbose: true });
  let html = "";
  for (let i = 0; i < history.length; i += 2) {
    const n = (i / 2) + 1;
    const w = history[i]?.san || "";
    const b = history[i + 1]?.san || "";
    html += `<div>${n}. <b>${w}</b> ${b}</div>`;
  }
  movesEl.innerHTML = html || "<div>—</div>";
}

function checkWinnerText() {
  if (game.in_checkmate && game.in_checkmate()) {
    const loserTurn = game.turn();
    const winner = loserTurn === "w" ? "Negras" : "Blancas";
    const iWin = (myColor && (winner === "Blancas" ? myColor === "w" : myColor === "b"));
    return iWin ? `🏆 JAQUE MATE — Has ganado (${winner})` : `💀 JAQUE MATE — Has perdido (${winner})`;
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
    const turnTxt = matchData?.turn ? (matchData.turn === "w" ? "Blancas" : "Negras") : "—";
    s += ` · Online · Tú: ${meTxt} · Turno: ${turnTxt} · Código: ${matchId}`;
  }

  setStatus(s);
}

// ======================
// Permisos turno (online)
// ======================
function canIMove() {
  if (!onlineMode) return true;
  if (!matchData) return false;
  if (matchData.status !== "active") return false;
  if (!myColor) return false;
  if (matchData.turn !== myColor) return false;
  if (matchData.winner) return false;
  return true;
}

// ======================
// Chessboard callbacks
// ======================
function onDragStart(source, piece) {
  if (game.game_over && game.game_over()) return false;

  // Solo mover piezas del turno local
  if (game.turn() === "w" && piece.startsWith("b")) return false;
  if (game.turn() === "b" && piece.startsWith("w")) return false;

  // Online: solo si te toca
  if (onlineMode && !canIMove()) return false;

  return true;
}

async function pushStateToFirestore() {
  if (!onlineMode || !matchId) return;
  if (!matchData) return;

  // anti-trampa básico: si no es tu turno, no escribes
  if (matchData.turn !== myColor) return;

  const ref = doc(db, "matches", matchId);

  // Detectar mate local y marcar ganador
  let winner = null;
  if (game.in_checkmate && game.in_checkmate()) {
    winner = (game.turn() === "w") ? "b" : "w";
  }

  await updateDoc(ref, {
    fen: game.fen(),
    turn: game.turn(),
    winner: winner,
    updatedAt: serverTimestamp()
  });
}

function onDrop(source, target) {
  if (onlineMode && !canIMove()) return "snapback";

  const move = game.move({ from: source, to: target, promotion: "q" });
  if (move === null) return "snapback";

  // Refresca tablero y UI
  board.position(game.fen(), false);
  updateUI();

  // Online -> guardar estado
  if (onlineMode) {
    pushStateToFirestore().catch((e) => {
      console.error(e);
      setStatus("❌ Error guardando en Firestore (mira consola)");
    });
  }
}

function onSnapEnd() {
  board.position(game.fen(), false);
}

// ======================
// Local controls
// ======================
btnNew?.addEventListener("click", () => {
  if (unsub) { unsub(); unsub = null; }
  stopChat();

  onlineMode = false;
  matchId = null;
  matchData = null;
  myColor = null;
  matchInfo.style.display = "none";

  game.reset();
  board.position("start", false);
  updateUI();
});

btnUndo?.addEventListener("click", () => {
  if (onlineMode) {
    setStatus("⚠️ En online no hay deshacer (anti-trampa).");
    return;
  }
  game.undo();
  board.position(game.fen(), false);
  updateUI();
});

btnFlip?.addEventListener("click", () => {
  flipped = !flipped;
  board.orientation(flipped ? "black" : "white");
});

btnCopyFen?.addEventListener("click", async () => {
  await navigator.clipboard.writeText(game.fen());
  setStatus("✅ FEN copiado");
  setTimeout(updateUI, 700);
});

// ======================
// ONLINE
// ======================
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

    // asignar mi color
    myColor = null;
    if (me) {
      if (matchData.white === me.uid) myColor = "w";
      else if (matchData.black === me.uid) myColor = "b";
    }
if (matchData.status === "waiting") {
  showMatchInfo(`🕒 Esperando rival… Código: ${code}`);
  stopChat(); // aún no hay chat (o si quieres, lo puedes permitir igual)
} else {
  showMatchInfo(`✅ Partida activa · Código: ${code}`);

  // ✅ Chat solo si eres jugador (white/black)
  const iAmPlayer = !!myColor; // myColor ya se calcula arriba
  if (iAmPlayer) startChat(code);
  else stopChat();
}
    // FEN remoto siempre válido
    let remoteFen = matchData.fen;
    if (!remoteFen || remoteFen === "start") remoteFen = new ChessCtor().fen();

    // Sincronizar motor y tablero
    if (remoteFen !== game.fen()) {
      game = new ChessCtor(remoteFen);
      board.position(remoteFen, false);
    }

    // Orientación según color en online
    if (myColor) {
      board.orientation(myColor === "b" ? "black" : "white");
      flipped = (myColor === "b");
    }

    updateUI();
  }, (err) => {
    console.error(err);
    setStatus("❌ Error de Firestore / permisos");
  });
}

btnCreateOnline?.addEventListener("click", async () => {
  if (!me) {
    setStatus("❌ Inicia sesión para crear partida online.");
    return;
  }

  const code = randomCode(6);
  const ref = doc(db, "matches", code);

  await setDoc(ref, {
    status: "waiting",
    white: me.uid,
    black: null,
    fen: new ChessCtor().fen(),   // FEN real
    turn: "w",
    winner: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  myColor = "w";
  bindMatch(code);
  setStatus("✅ Partida creada. Comparte el código: " + code);
});

btnJoinOnline?.addEventListener("click", async () => {
  if (!me) {
    setStatus("❌ Inicia sesión para unirte.");
    return;
  }

  const code = (joinCode?.value || "").trim().toUpperCase();
  if (!code) {
    setStatus("❌ Escribe un código.");
    return;
  }

  const ref = doc(db, "matches", code);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    setStatus("❌ No existe esa partida.");
    return;
  }

  const data = snap.data();

  // entrar como negras si hay hueco
  if (!data.black && data.white !== me.uid) {
    await updateDoc(ref, {
      black: me.uid,
      status: "active",
      updatedAt: serverTimestamp()
    });
  }

  bindMatch(code);
  setStatus("✅ Unido a la partida: " + code);
});

// ======================
// INIT board
// ======================
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

syncSkinButtonVisibility();
updateUI();

// ======================
// Auth
// ======================
onAuthStateChanged(auth, (user) => {
  me = user || null;
  syncSkinButtonVisibility();

  if (!me) {
    setStatus("⚠️ Inicia sesión para jugar online. Local disponible.");
    // sin usuario, sigue en local
  } else {
    updateUI();
  }
});