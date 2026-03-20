import { auth, db } from "../../../assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, onSnapshot, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { saveHighScore } from "../../../assets/js/scores.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const turnEl = document.getElementById('player-turn');
const btnEndTurn = document.getElementById('btn-end-turn');
const countEl = document.getElementById('conquest-count');
const roleTag = document.getElementById('player-role-tag');

const hexRadius = 35;
const hexHeight = Math.sqrt(3) * hexRadius;
const columns = 8;
const rows = 5;

let uid = null;
let gameData = null;
const gameId = "arena_conquest";

const colors = {
    null: "rgba(71, 85, 105, 0.15)", 
    player1: "#38bdf8",            
    player2: "#f59e0b"             
};

async function initGame() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "../../../login.html"; return; }
        uid = user.uid;
        
        onSnapshot(doc(db, "matches", gameId), (docSnap) => {
            if (!docSnap.exists()) {
                createInitialMap();
            } else {
                gameData = docSnap.data();
                drawMap();
                updateUI();
                updateRoleTag();
                checkGameOver();
            }
        });
    });
}

async function createInitialMap() {
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            cells.push({ id: `${c}-${r}`, owner: null });
        }
    }
    await setDoc(doc(db, "matches", gameId), {
        cells: cells,
        turn: uid, // P1 empieza
        player1: uid,
        player2: null,
        status: "active",
        moves: 0
    });
}

window.addEventListener('keydown', async (e) => {
    if (e.key.toLowerCase() === 'r') {
        if (confirm("¿Reiniciar la arena?")) await createInitialMap();
    }
});

function captureNeighbors(clickedId, attackerUid) {
    const [c, r] = clickedId.split('-').map(Number);
    const neighbors = c % 2 === 0 
        ? [[0,-1], [1,-1], [1,0], [0,1], [-1,0], [-1,-1]]
        : [[0,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0]];

    gameData.cells.forEach(cell => {
        neighbors.forEach(([dc, dr]) => {
            if (cell.id === `${c + dc}-${r + dr}` && cell.owner !== null && cell.owner !== attackerUid) {
                cell.owner = attackerUid;
            }
        });
    });
}

canvas.onclick = async (e) => {
    if (!gameData || gameData.status === "finished") return;

    // LÓGICA DE UNIÓN: Si soy nuevo y no hay P2, yo soy P2 y puedo mover aunque no sea mi turno
    const isNewPlayer = uid !== gameData.player1 && !gameData.player2;
    const isMyTurn = gameData.turn === uid;

    if (!isMyTurn && !isNewPlayer) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let selectedCell = null;
    let minDist = Infinity;

    gameData.cells.forEach(cell => {
        const [c, r] = cell.id.split('-').map(Number);
        let x = c * (hexRadius * 1.5) + 65;
        let y = r * hexHeight + 65;
        if (c % 2 !== 0) y += hexHeight / 2;
        const dist = Math.hypot(mouseX - x, mouseY - y);
        if (dist < hexRadius && dist < minDist) { minDist = dist; selectedCell = cell; }
    });

    if (selectedCell && selectedCell.owner === null) {
        selectedCell.owner = uid;
        captureNeighbors(selectedCell.id, uid);
        
        let updates = { 
            cells: gameData.cells,
            moves: (gameData.moves || 0) + 1
        };

        // Si soy el nuevo jugador (P2)
        if (isNewPlayer) {
            updates.player2 = uid;
            updates.turn = gameData.player1; // Turno vuelve al 1
        } else {
            // Cambio de turno normal si ya hay 2 jugadores
            updates.turn = uid === gameData.player1 ? gameData.player2 : gameData.player1;
            // Si el P2 aún no existe, el turno se queda en P1 (esperando)
            if (!gameData.player2) updates.turn = uid; 
        }

        await updateDoc(doc(db, "matches", gameId), updates);
    }
};

function updateUI() {
    if (!gameData) return;
    const isMyTurn = gameData.turn === uid;
    const isP1 = uid === gameData.player1;
    const hasP2 = gameData.player2 !== null;

    if (isP1 && !hasP2) {
        turnEl.textContent = "⌛ ESPERANDO RIVAL...";
        turnEl.style.color = "#94a3b8";
        btnEndTurn.disabled = true;
    } else if (!isP1 && !hasP2) {
        turnEl.textContent = "⚔️ HAZ CLIC PARA UNIRTE";
        turnEl.style.color = "#f59e0b";
        btnEndTurn.disabled = true;
    } else {
        turnEl.textContent = isMyTurn ? "🟢 TU TURNO" : "🔴 TURNO DEL RIVAL";
        turnEl.style.color = isMyTurn ? "#10b981" : "#ef4444";
        btnEndTurn.disabled = !isMyTurn;
    }
}

// (El resto de funciones drawMap, drawHexagon, updateRoleTag y checkGameOver siguen igual)

async function checkGameOver() {
    if (!gameData) return;
    const emptyCells = gameData.cells.filter(c => c.owner === null).length;
    if (emptyCells === 0 && gameData.status !== "finished") {
        const p1 = gameData.cells.filter(c => c.owner === gameData.player1).length;
        const p2 = gameData.cells.filter(c => c.owner === gameData.player2).length;
        const winner = p1 > p2 ? "AZUL" : "ÁMBAR";
        alert(`¡ARENA CONQUISTADA!\nGanador: ${winner}\nAzul: ${p1} | Ámbar: ${p2}\n\nPresiona 'R' para reiniciar.`);
        await updateDoc(doc(db, "matches", gameId), { status: "finished" });
    }
}

function drawHexagon(x, y, owner) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        ctx.lineTo(x + hexRadius * Math.cos(i * Math.PI / 3), y + hexRadius * Math.sin(i * Math.PI / 3));
    }
    ctx.closePath();
    let key = owner === gameData.player1 ? 'player1' : (owner === gameData.player2 ? 'player2' : null);
    ctx.fillStyle = colors[key];
    ctx.fill();
    ctx.strokeStyle = key ? "white" : "rgba(255,255,255,0.1)";
    ctx.stroke();
}

function drawMap() {
    if (!gameData) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let myCount = 0;
    gameData.cells.forEach(cell => {
        const [c, r] = cell.id.split('-').map(Number);
        let x = c * (hexRadius * 1.5) + 65;
        let y = r * hexHeight + 65;
        if (c % 2 !== 0) y += hexHeight / 2;
        if (cell.owner === uid) myCount++;
        drawHexagon(x, y, cell.owner);
    });
    countEl.textContent = myCount;
}

function updateRoleTag() {
    if (!gameData) return;
    if (uid === gameData.player1) {
        roleTag.textContent = "GUERRERO AZUL";
        roleTag.className = "player-indicator p1-theme";
    } else if (uid === gameData.player2) {
        roleTag.textContent = "GUERRERO ÁMBAR";
        roleTag.className = "player-indicator p2-theme";
    }
}

initGame();