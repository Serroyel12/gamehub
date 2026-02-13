const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const box = 20;
const canvasSize = 400;

// Velocidad (ms por tick). Menor = más rápido
const BASE_SPEED = 140;
const MIN_SPEED = 60; // límite de velocidad
const SPEED_STEP = 4; // cuánto baja por punto

let snake, direction, food, score, gameTimer, isPaused;

// Récord (localStorage)
const BEST_KEY = "gamehub_snake_best";
let bestScore = Number(localStorage.getItem(BEST_KEY) || 0);

// UI
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("bestScore");
bestEl.textContent = bestScore;

document.addEventListener("keydown", handleKeydown, { passive: false });
document.getElementById("restartBtn").addEventListener("click", restartGame);

function initGame() {
  snake = [{ x: 200, y: 200 }];
  direction = "RIGHT";
  food = generateFood();
  score = 0;
  isPaused = false;

  scoreEl.textContent = score;
  bestEl.textContent = bestScore;

  startLoop();
}

function currentSpeed() {
  // A más score, más rápido (menos ms)
  const speed = BASE_SPEED - score * SPEED_STEP;
  return Math.max(MIN_SPEED, speed);
}

function startLoop() {
  clearInterval(gameTimer);
  gameTimer = setInterval(tick, currentSpeed());
}

function tick() {
  if (isPaused) return;
  draw();
}

function draw() {
  // Fondo
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Dibujar serpiente
  for (let i = 0; i < snake.length; i++) {
    ctx.fillStyle = i === 0 ? "#38bdf8" : "#94a3b8";
    ctx.fillRect(snake[i].x, snake[i].y, box, box);
  }

  // Dibujar comida
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(food.x, food.y, box, box);

  // Movimiento: nueva posición cabeza
  let headX = snake[0].x;
  let headY = snake[0].y;

  if (direction === "LEFT") headX -= box;
  if (direction === "RIGHT") headX += box;
  if (direction === "UP") headY -= box;
  if (direction === "DOWN") headY += box;

  // WRAP paredes
  if (headX < 0) headX = canvasSize - box;
  if (headX >= canvasSize) headX = 0;
  if (headY < 0) headY = canvasSize - box;
  if (headY >= canvasSize) headY = 0;

  // Comer
  let ate = (headX === food.x && headY === food.y);
  if (ate) {
    score++;
    scoreEl.textContent = score;
    food = generateFood();
  } else {
    snake.pop();
  }

  const newHead = { x: headX, y: headY };

  // Colisión contigo mismo
  if (collision(newHead, snake)) {
    endGame();
    return;
  }

  snake.unshift(newHead);

  // Si has comido, recalcula velocidad (más rápido) reiniciando loop
  if (ate) startLoop();

  // Overlay de pausa
  if (isPaused) drawPauseOverlay();
}

function drawPauseOverlay() {
  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PAUSA", canvasSize / 2, canvasSize / 2 - 10);
  ctx.font = "16px Arial";
  ctx.fillText("Pulsa ESPACIO para continuar", canvasSize / 2, canvasSize / 2 + 18);
  ctx.textAlign = "start";
}

function handleKeydown(event) {
  const keysToBlock = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", " "];
  if (keysToBlock.includes(event.key)) event.preventDefault();

  // Pausa con espacio
  if (event.key === " ") {
    togglePause();
    return;
  }

  // Dirección
  if (event.key === "ArrowLeft" && direction !== "RIGHT") direction = "LEFT";
  if (event.key === "ArrowUp" && direction !== "DOWN") direction = "UP";
  if (event.key === "ArrowRight" && direction !== "LEFT") direction = "RIGHT";
  if (event.key === "ArrowDown" && direction !== "UP") direction = "DOWN";
}

function togglePause() {
  isPaused = !isPaused;
  // Si pausas, dibuja overlay inmediatamente
  if (isPaused) {
    draw();
    drawPauseOverlay();
  }
}

function endGame() {
  clearInterval(gameTimer);

  // Actualiza récord
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_KEY, String(bestScore));
    bestEl.textContent = bestScore;
  }

  alert(`Game Over 😵\nPuntuación: ${score}\nRécord: ${bestScore}`);
}

function generateFood() {
  // Evitar que aparezca encima de la serpiente (simple)
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * (canvasSize / box)) * box,
      y: Math.floor(Math.random() * (canvasSize / box)) * box
    };
  } while (snake && snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

function collision(head, array) {
  return array.some(segment => segment.x === head.x && segment.y === head.y);
}

function restartGame() {
  initGame();
}

initGame();
