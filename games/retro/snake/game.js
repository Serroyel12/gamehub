const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Elementos de la UI
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const overlay = document.getElementById("overlay");
const ovTitle = document.getElementById("ovTitle");
const ovSub = document.getElementById("ovSub");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

// Constantes del juego
const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;
const GAME_SPEED = 100; // Milisegundos por frame (menor = más rápido)

// Variables del juego
let snake = [];
let food = { x: 0, y: 0 };
let dx = 0;
let dy = 0;
let score = 0;
let bestScore = localStorage.getItem("titanSnakeBest") || 0;
let gameInterval;
let isPaused = false;
let isGameOver = false;
let changingDirection = false;
let gameStarted = false; // Nueva variable para controlar el inicio

// Inicializar puntuación máxima
bestScoreEl.innerText = bestScore;

// Event Listeners para controles y botones
document.addEventListener("keydown", handleInput);

startBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  startBtn.style.display = "none"; // Ocultamos el botón para siempre
  gameStarted = true;
  resetGame();
});

restartBtn.addEventListener("click", () => {
  overlay.style.display = "none";
  resetGame();
});

function resetGame() {
  // Configuración inicial de la serpiente (empieza con tamaño 3)
  snake = [
    { x: 10 * GRID_SIZE, y: 10 * GRID_SIZE },
    { x: 9 * GRID_SIZE, y: 10 * GRID_SIZE },
    { x: 8 * GRID_SIZE, y: 10 * GRID_SIZE }
  ];
  
  // Dirección inicial (hacia la derecha)
  dx = GRID_SIZE;
  dy = 0;
  
  score = 0;
  scoreEl.innerText = score;
  isGameOver = false;
  isPaused = false;
  changingDirection = false;
  
  spawnFood();
  clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, GAME_SPEED);
}

function gameLoop() {
  // Si está pausado, ha terminado, o no ha empezado, no actualizamos
  if (isPaused || isGameOver || !gameStarted) return;
  
  changingDirection = false;
  moveSnake();
  
  if (checkCollision()) {
    triggerGameOver();
    return;
  }
  
  draw();
}

function moveSnake() {
  // Crear la nueva cabeza
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };
  snake.unshift(head);

  // Comprobar si come la manzana
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.innerText = score;
    spawnFood();
  } else {
    snake.pop(); // Borrar cola si no ha comido
  }
}

function checkCollision() {
  const head = snake[0];

  // Colisión con los muros
  if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
    return true;
  }

  // Colisión consigo misma (empezamos a comprobar desde el índice 1)
  for (let i = 1; i < snake.length; i++) {
    if (head.x === snake[i].x && head.y === snake[i].y) {
      return true;
    }
  }

  return false;
}

function spawnFood() {
  let validPosition = false;
  while (!validPosition) {
    food.x = Math.floor(Math.random() * TILE_COUNT) * GRID_SIZE;
    food.y = Math.floor(Math.random() * TILE_COUNT) * GRID_SIZE;
    
    // Asegurarse de que la comida no aparezca encima de la serpiente
    validPosition = true;
    for (let segment of snake) {
      if (segment.x === food.x && segment.y === food.y) {
        validPosition = false;
        break;
      }
    }
  }
}

function draw() {
  // Limpiar fondo
  ctx.fillStyle = "#112a16"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Dibujar comida
  ctx.fillStyle = "#ef4444"; 
  ctx.beginPath();
  ctx.arc(food.x + GRID_SIZE / 2, food.y + GRID_SIZE / 2, GRID_SIZE / 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Dibujar serpiente
  snake.forEach((segment, index) => {
    ctx.fillStyle = index === 0 ? "#f59e0b" : "#84cc16";
    ctx.fillRect(segment.x, segment.y, GRID_SIZE - 1, GRID_SIZE - 1); 
  });
}

function handleInput(e) {
  // Prevenir que la página haga scroll
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }

  // Tecla ESPACIO (solo funciona si el juego ya empezó)
  if (e.key === " " && gameStarted) {
    if (isGameOver) {
      overlay.style.display = "none";
      resetGame();
    } else {
      togglePause();
    }
    return;
  }

  // Ignorar movimiento si está pausado, terminado, no empezado o ya cambió de dirección
  if (changingDirection || isPaused || isGameOver || !gameStarted) return;

  const goingUp = dy === -GRID_SIZE;
  const goingDown = dy === GRID_SIZE;
  const goingRight = dx === GRID_SIZE;
  const goingLeft = dx === -GRID_SIZE;

  switch (e.key) {
    case "ArrowLeft":
      if (!goingRight) { dx = -GRID_SIZE; dy = 0; changingDirection = true; }
      break;
    case "ArrowUp":
      if (!goingDown) { dx = 0; dy = -GRID_SIZE; changingDirection = true; }
      break;
    case "ArrowRight":
      if (!goingLeft) { dx = GRID_SIZE; dy = 0; changingDirection = true; }
      break;
    case "ArrowDown":
      if (!goingUp) { dx = 0; dy = GRID_SIZE; changingDirection = true; }
      break;
  }
}

function togglePause() {
  isPaused = !isPaused;
  if (isPaused) {
    ovTitle.innerText = "PAUSA";
    ovSub.innerHTML = "Pulsa <b>ESPACIO</b> para continuar";
    startBtn.style.display = "none";
    restartBtn.style.display = "none";
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
  }
}

function triggerGameOver() {
  isGameOver = true;
  clearInterval(gameInterval);
  
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("titanSnakeBest", bestScore);
    bestScoreEl.innerText = bestScore;
  }

  ovTitle.innerText = "¡FIN DEL JUEGO!";
  ovSub.innerText = `Puntuación final: ${score}`;
  startBtn.style.display = "none"; 
  restartBtn.style.display = "inline-block"; // Mostrar el botón de reiniciar
  overlay.style.display = "flex";
}