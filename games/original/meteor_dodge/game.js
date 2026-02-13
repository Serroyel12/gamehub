const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const SCORE_KEY = "gamehub_meteor_best";

const uiScore = document.getElementById("score");
const uiBest  = document.getElementById("best");

let best = Number(localStorage.getItem(SCORE_KEY) || 0);
uiBest.textContent = best;

const W = canvas.width;
const H = canvas.height;

let running = true;
let paused = false;

const ship = {
  w: 34,
  h: 18,
  x: W/2,
  y: H - 28,
  vx: 0,
  speed: 6
};

let meteors = [];
let particles = [];
let score = 0;
let timeAlive = 0;

// Dificultad
let spawnTimer = 0;
let spawnEvery = 55; // frames
let meteorSpeed = 2.7;

// Input
const keys = new Set();
document.addEventListener("keydown", (e) => {
  const block = ["ArrowLeft","ArrowRight"," "];
  if (block.includes(e.key)) e.preventDefault();

  keys.add(e.key);

  if (e.key === " ") paused = !paused;
  if (e.key.toLowerCase() === "r") reset();
}, { passive:false });

document.addEventListener("keyup", (e) => keys.delete(e.key));

function reset(){
  meteors = [];
  particles = [];
  score = 0;
  timeAlive = 0;
  spawnTimer = 0;
  spawnEvery = 55;
  meteorSpeed = 2.7;

  ship.x = W/2;
  ship.vx = 0;

  running = true;
  paused = false;

  uiScore.textContent = score;
}

function rand(min, max){ return Math.random() * (max - min) + min; }

function spawnMeteor(){
  const r = rand(10, 22);
  meteors.push({
    x: rand(r, W - r),
    y: -r - 10,
    r,
    vy: meteorSpeed + rand(-0.3, 0.7),
    vx: rand(-0.6, 0.6),
    rot: rand(0, Math.PI*2),
    vr: rand(-0.06, 0.06)
  });
}

function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr){
  // clamp
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx*dx + dy*dy <= cr*cr;
}

function explode(x,y, n=18){
  for(let i=0;i<n;i++){
    particles.push({
      x, y,
      vx: rand(-3.2, 3.2),
      vy: rand(-3.8, 1.8),
      life: rand(18, 30)
    });
  }
}

function update(){
  // mover nave
  const left  = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D");

  ship.vx = 0;
  if (left) ship.vx = -ship.speed;
  if (right) ship.vx = ship.speed;

  ship.x += ship.vx;
  ship.x = Math.max(ship.w/2, Math.min(W - ship.w/2, ship.x));

  // spawn meteoritos
  spawnTimer++;
  if (spawnTimer >= spawnEvery){
    spawnTimer = 0;
    spawnMeteor();
  }

  // dificultad progresiva
  timeAlive++;
  if (timeAlive % 180 === 0) {         // cada 3 segundos aprox (a 60fps)
    meteorSpeed += 0.15;
    spawnEvery = Math.max(22, spawnEvery - 1);
  }

  // score por supervivencia
  if (timeAlive % 6 === 0) {           // ~10 puntos/seg
    score++;
    uiScore.textContent = score;
  }

  // mover meteoritos
  for (let i = meteors.length - 1; i >= 0; i--){
    const m = meteors[i];
    m.x += m.vx;
    m.y += m.vy;
    m.rot += m.vr;

    // rebote suave en paredes
    if (m.x < m.r) { m.x = m.r; m.vx *= -0.8; }
    if (m.x > W - m.r) { m.x = W - m.r; m.vx *= -0.8; }

    // colisión con nave
    const rx = ship.x - ship.w/2;
    const ry = ship.y - ship.h/2;
    if (rectCircleCollide(rx, ry, ship.w, ship.h, m.x, m.y, m.r)){
      explode(ship.x, ship.y, 30);
      gameOver();
      return;
    }

    // fuera de pantalla
    if (m.y - m.r > H + 40){
      meteors.splice(i, 1);
    }
  }

  // partículas
  for (let i = particles.length - 1; i >= 0; i--){
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= 1;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function gameOver(){
  running = false;

  if (score > best){
    best = score;
    localStorage.setItem(SCORE_KEY, String(best));
    uiBest.textContent = best;
  }
}

function draw(){
  // fondo con “estrellas”
  ctx.fillStyle = "#0b1224";
  ctx.fillRect(0,0,W,H);

  // estrellas pseudo
  ctx.fillStyle = "rgba(148,163,184,0.35)";
  for(let i=0;i<40;i++){
    const x = (i*97 + timeAlive*2) % W;
    const y = (i*53 + timeAlive*3) % H;
    ctx.fillRect(x, y, 2, 2);
  }

  // nave
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(-ship.w/2, ship.h/2);
  ctx.lineTo(0, -ship.h/2);
  ctx.lineTo(ship.w/2, ship.h/2);
  ctx.closePath();
  ctx.fill();
  // “cabina”
  ctx.fillStyle = "rgba(15,23,42,0.6)";
  ctx.fillRect(-6, 2, 12, 6);
  ctx.restore();

  // meteoritos
  for(const m of meteors){
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(0,0,m.r,0,Math.PI*2);
    ctx.fill();

    // cráteres
    ctx.fillStyle = "rgba(15,23,42,0.35)";
    ctx.beginPath(); ctx.arc(-m.r*0.2, -m.r*0.1, m.r*0.25, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(m.r*0.25, m.r*0.15, m.r*0.18, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // partículas
  ctx.fillStyle = "rgba(239,68,68,0.9)";
  for(const p of particles){
    ctx.fillRect(p.x, p.y, 2, 2);
  }

  if (paused) {
    overlay("PAUSA", "Pulsa ESPACIO para continuar");
  }

  if (!running) {
    overlay("GAME OVER", "Pulsa R para reiniciar");
  }
}

function overlay(title, subtitle){
  ctx.fillStyle = "rgba(15,23,42,0.65)";
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = "#f1f5f9";
  ctx.textAlign = "center";
  ctx.font = "bold 34px Arial";
  ctx.fillText(title, W/2, H/2 - 10);
  ctx.font = "16px Arial";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(subtitle, W/2, H/2 + 22);
  ctx.textAlign = "start";
}

function loop(){
  if (!paused && running) update();
  draw();
  requestAnimationFrame(loop);
}

reset();
loop();
