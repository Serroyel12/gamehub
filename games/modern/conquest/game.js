import { auth, db } from "../../../assets/js/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, onSnapshot, updateDoc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const turnBadge = document.getElementById('player-turn');
const countEl = document.getElementById('conquest-count');

const hexRadius = 30;
const hexHeight = Math.sqrt(3) * hexRadius;
const columns = 9;
const rows = 6;

let uid = null;
let myData = null;
let gameData = null;
let matchId = null;
let unsub = null;

const playerColors = {
    p1: "#38bdf8", // Azul
    p2: "#f59e0b", // Ámbar
    p3: "#10b981", // Esmeralda
    p4: "#ef4444"  // Carmesí
};

onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    uid = user.uid;
    const snap = await getDoc(doc(db, "users", uid));
    myData = snap.exists() ? snap.data() : { nickname: "Guerrero", elo: 1200, badge: 1, isCheater: false };
    setupMenu();
});

function setupMenu() {
    const createBtn = document.getElementById('btn-create-arena');
    const joinBtn = document.getElementById('btn-join-arena');
    const joinInput = document.getElementById('input-join-code');
    let selectedMode = 2;

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.onclick = () => {
            selectedMode = parseInt(btn.dataset.players);
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('primary'));
            btn.classList.add('primary');
        };
    });

    createBtn.onclick = async () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        await createArena(code, selectedMode);
        startListening(code);
        document.getElementById('setup-screen').remove();
        alert("SALA CREADA: " + code + "\nPásalo a tus rivales.");
    };

    joinBtn.onclick = async () => {
        const code = joinInput.value.trim().toUpperCase();
        if (code.length < 4) return alert("Código inválido");
        const snap = await getDoc(doc(db, "matches", code));
        if (!snap.exists()) return alert("La sala no existe");
        startListening(code);
        document.getElementById('setup-screen').remove();
    };
}

async function createArena(id, numPlayers) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            cells.push({ id: `${c}-${r}`, owner: null });
        }
    }
    await setDoc(doc(db, "matches", id), {
        cells,
        mode: numPlayers,
        p1: uid, 
        p1Name: myData.nickname, 
        p1Elo: myData.elo || 1200, 
        p1Badge: myData.badge || 1,
        p1IsCheater: myData.isCheater || false,
        p2: null, p3: null, p4: null,
        turn: uid,
        status: "active",
        processed: []
    });
}

function startListening(id) {
    matchId = id;
    if (unsub) unsub();
    unsub = onSnapshot(doc(db, "matches", id), (docSnap) => {
        if (!docSnap.exists()) return;
        gameData = docSnap.data();
        checkAutoJoin();
        renderArena();
    });
}

async function checkAutoJoin() {
    if (!gameData || gameData.status !== "active") return;
    const pKeys = ['p1', 'p2', 'p3', 'p4'].slice(0, gameData.mode);
    const isAlreadyIn = pKeys.some(k => gameData[k] === uid);

    if (!isAlreadyIn) {
        const emptySlot = pKeys.find(k => !gameData[k]);
        if (emptySlot) {
            await updateDoc(doc(db, "matches", matchId), {
                [emptySlot]: uid,
                [emptySlot + "Name"]: myData.nickname,
                [emptySlot + "Elo"]: myData.elo || 1200,
                [emptySlot + "Badge"]: myData.badge || 1,
                [emptySlot + "IsCheater"]: myData.isCheater || false
            });
        }
    }
}

canvas.onclick = async (e) => {
    if (!gameData || gameData.status !== "active" || gameData.turn !== uid) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pKeys = ['p1', 'p2', 'p3', 'p4'].slice(0, gameData.mode);
    const myRole = pKeys.find(k => gameData[k] === uid);
    if (!myRole) return;

    let target = null;
    gameData.cells.forEach(cell => {
        const [c, r] = cell.id.split('-').map(Number);
        const cx = c * (hexRadius * 1.5) + 50;
        const cy = r * hexHeight + (c % 2 ? hexHeight / 2 : 0) + 50;
        if (Math.hypot(x - cx, y - cy) < hexRadius) target = cell;
    });

    if (target && !target.owner) {
        target.owner = myRole;
        captureNeighbors(target.id, myRole);
        
        const currentIndex = pKeys.indexOf(myRole);
        let nextIndex = (currentIndex + 1) % gameData.mode;
        let nextPlayer = gameData[pKeys[nextIndex]] || gameData.p1;

        await updateDoc(doc(db, "matches", matchId), {
            cells: gameData.cells,
            turn: nextPlayer
        });
        checkEndGame();
    }
};

function captureNeighbors(cellId, myRole) {
    const [c, r] = cellId.split('-').map(Number);
    const neighbors = c % 2 === 0 
        ? [[0,-1], [1,-1], [1,0], [0,1], [-1,0], [-1,-1]]
        : [[0,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0]];

    gameData.cells.forEach(cell => {
        neighbors.forEach(([dc, dr]) => {
            if (cell.id === `${c+dc}-${r+dr}` && cell.owner && cell.owner !== myRole) {
                cell.owner = myRole;
            }
        });
    });
}

function renderArena() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let myHexes = 0;
    const pKeys = ['p1', 'p2', 'p3', 'p4'].slice(0, gameData.mode);
    const myRole = pKeys.find(k => gameData[k] === uid);

    gameData.cells.forEach(cell => {
        const [c, r] = cell.id.split('-').map(Number);
        const cx = c * (hexRadius * 1.5) + 50;
        const cy = r * hexHeight + (c % 2 ? hexHeight / 2 : 0) + 50;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.lineTo(cx + hexRadius * Math.cos(i * Math.PI / 3), cy + hexRadius * Math.sin(i * Math.PI / 3));
        }
        ctx.closePath();
        ctx.fillStyle = cell.owner ? playerColors[cell.owner] : "rgba(255,255,255,0.05)";
        ctx.fill();
        ctx.strokeStyle = cell.owner ? "white" : "rgba(255,255,255,0.1)";
        ctx.lineWidth = cell.owner ? 2 : 1;
        ctx.stroke();

        if (cell.owner === myRole) myHexes++;
    });

    countEl.textContent = myHexes;
    updateHeaders();
    
    const isMyTurn = gameData.turn === uid;
    turnBadge.style.display = isMyTurn ? "block" : "none";
}

function updateHeaders() {
    for (let i = 1; i <= 4; i++) {
        const ui = document.getElementById(`p${i}-ui`);
        if (i > gameData.mode) { ui.style.display = "none"; continue; }
        ui.style.display = "flex";
        
        const isConnected = !!gameData[`p${i}`];
        ui.style.opacity = isConnected ? "1" : "0.3";
        
        const nameEl = document.getElementById(`p${i}-name`);
        const isCheater = gameData[`p${i}IsCheater`] || false;
        const rawName = gameData[`p${i}Name`] || "Esperando...";
        
        // Aplicar color rojo y aviso si es tramposo
        nameEl.innerHTML = isCheater ? `<span style="color:#ef4444;">⚠️ ${rawName}</span>` : rawName;
        
        document.getElementById(`p${i}-elo`).textContent = gameData[`p${i}Elo`] || "1200";
        const img = document.getElementById(`p${i}-badge`);
        img.src = `../../../assets/img/iconos/${gameData[`p${i}Badge`] || 1}.png`;
        img.style.display = isConnected ? "block" : "none";
    }
}

async function checkEndGame() {
    const full = gameData.cells.every(c => c.owner !== null);
    if (full && gameData.status !== "finished") {
        const pKeys = ['p1', 'p2', 'p3', 'p4'].slice(0, gameData.mode);
        const colorNames = { p1: "AZUL", p2: "ÁMBAR", p3: "ESMERALDA", p4: "CARMESÍ" };

        const scores = pKeys.map(k => ({
            role: k,
            count: gameData.cells.filter(c => c.owner === k).length
        })).sort((a, b) => b.count - a.count);

        const winnerRole = scores[0].role;
        const winnerColor = colorNames[winnerRole];

        await processElo();
        await updateDoc(doc(db, "matches", matchId), { status: "finished" });

        alert(`¡ENHORABUENA! El GUERRERO ${winnerColor} ha conquistado la Arena.\n\nLa arena se reiniciará automáticamente.`);
        
        setTimeout(() => { resetArena(); }, 2000);
    }
}

async function processElo() {
    const pKeys = ['p1', 'p2', 'p3', 'p4'].slice(0, gameData.mode);
    const myRole = pKeys.find(k => gameData[k] === uid);
    if (!myRole || (gameData.processed || []).includes(uid)) return;

    const results = pKeys.map(k => ({
        uid: gameData[k],
        count: gameData.cells.filter(c => c.owner === k).length
    })).sort((a, b) => b.count - a.count);

    const isWinner = results[0].uid === uid;
    const change = isWinner ? 15 : -10;
    const newElo = Math.max(100, (myData.elo || 1200) + change);

    await updateDoc(doc(db, "users", uid), { elo: newElo });
    const processed = [...(gameData.processed || []), uid];
    await updateDoc(doc(db, "matches", matchId), { processed });
}

async function resetArena() {
    if (!matchId || !gameData) return;
    const newCells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            newCells.push({ id: `${c}-${r}`, owner: null });
        }
    }
    await updateDoc(doc(db, "matches", matchId), {
        cells: newCells,
        turn: gameData.p1,
        status: "active",
        processed: []
    });
}