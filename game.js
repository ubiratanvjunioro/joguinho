(() => {
  "use strict";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const titleEl = document.getElementById("overlay-title");
  const textEl = document.getElementById("overlay-text");
  const startBtn = document.getElementById("start-btn");

  const W = canvas.width, H = canvas.height, groundY = 246;
  const bestKey = "marioRunnerBest";
  let best = Number(localStorage.getItem(bestKey) || 0);
  let score = 0, speed = 5, frame = 0, running = false, gameOver = false;
  let obstacles = [], clouds = [], groundOffset = 0;
  let lastTime = 0;

  const mario = { x: 95, y: groundY - 48, w: 34, h: 48, vy: 0, onGround: true };
  const gravity = 0.72, jumpPower = -13.2;

  bestEl.textContent = format(best);
  function format(n) { return String(Math.floor(n)).padStart(5, "0"); }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  // Mario é desenhado com blocos pixelados, sem imagens ou dependências externas.
  function drawMario(x, y) {
    const p = 4;
    // boné
    rect(x + 8, y, 20, p, "#d71920");
    rect(x + 4, y + p, 28, p, "#e52521");
    rect(x + 20, y + p, 8, p, "#f4f4f4");
    // cabelo e rosto
    rect(x + 4, y + 8, 8, 8, "#6b351c");
    rect(x + 12, y + 8, 16, 12, "#f2b47e");
    rect(x + 24, y + 12, 8, 8, "#6b351c");
    rect(x + 16, y + 12, 4, 4, "#222");
    rect(x + 8, y + 20, 20, 4, "#6b351c");
    // camisa e macacão
    rect(x + 4, y + 24, 8, 12, "#e52521");
    rect(x + 12, y + 24, 16, 16, "#1769d2");
    rect(x, y + 28, 8, 8, "#e52521");
    rect(x + 28, y + 28, 8, 8, "#e52521");
    rect(x + 16, y + 28, 4, 4, "#ffd84d");
    rect(x + 24, y + 28, 4, 4, "#ffd84d");
    // pernas / sapatos
    if (Math.floor(frame / 6) % 2 === 0 && running && mario.onGround) {
      rect(x + 8, y + 40, 8, 4, "#1769d2");
      rect(x + 4, y + 44, 12, 4, "#6b351c");
      rect(x + 20, y + 40, 8, 4, "#1769d2");
      rect(x + 20, y + 44, 12, 4, "#6b351c");
    } else {
      rect(x + 8, y + 40, 8, 4, "#1769d2");
      rect(x + 4, y + 44, 12, 4, "#6b351c");
      rect(x + 20, y + 40, 8, 4, "#1769d2");
      rect(x + 20, y + 44, 12, 4, "#6b351c");
    }
  }

  function drawCactus(o) {
    const x = o.x, y = groundY - o.h;
    rect(x + o.w * .35, y, o.w * .3, o.h, "#278447");
    rect(x, y + o.h * .35, o.w * .38, 6, "#278447");
    rect(x, y + o.h * .2, 6, o.h * .35, "#278447");
    rect(x + o.w * .62, y + o.h * .5, o.w * .38, 6, "#278447");
    rect(x + o.w - 6, y + o.h * .3, 6, o.h * .25, "#278447");
    rect(x + o.w * .35, y, o.w * .3, 4, "#53a567");
  }

  function drawGoomba(o) {
    const x = o.x, y = groundY - o.h;
    // Inimigo marrom simples inspirado em jogos de plataforma
    rect(x + 7, y, o.w - 14, 5, "#8b4a22");
    rect(x + 2, y + 5, o.w - 4, o.h - 12, "#a85d2a");
    rect(x + 7, y + 10, 5, 7, "#fff");
    rect(x + o.w - 12, y + 10, 5, 7, "#fff");
    rect(x + 9, y + 12, 3, 5, "#222");
    rect(x + o.w - 10, y + 12, 3, 5, "#222");
    rect(x + 3, y + o.h - 7, 10, 7, "#4b2b1b");
    rect(x + o.w - 13, y + o.h - 7, 10, 7, "#4b2b1b");
  }

  function drawCloud(c) {
    ctx.fillStyle = "#e5edf5";
    ctx.beginPath();
    ctx.arc(c.x + 12, c.y + 12, 10, Math.PI, 0);
    ctx.arc(c.x + 26, c.y + 8, 13, Math.PI, 0);
    ctx.arc(c.x + 42, c.y + 13, 9, Math.PI, 0);
    ctx.fill();
    rect(c.x + 3, c.y + 12, 45, 8, "#e5edf5");
  }

  function reset() {
    score = 0; speed = 5; frame = 0; obstacles = []; groundOffset = 0;
    mario.y = groundY - mario.h; mario.vy = 0; mario.onGround = true;
    clouds = [{x: 120, y: 52}, {x: 480, y: 78}, {x: 740, y: 42}];
    gameOver = false; running = true; overlay.classList.add("hidden");
    lastTime = 0; requestAnimationFrame(loop);
  }

  function jump() {
    if (!running) {
      if (gameOver || overlay.classList.contains("hidden") === false) reset();
      return;
    }
    if (mario.onGround) { mario.vy = jumpPower; mario.onGround = false; }
  }

  function spawnObstacle() {
    const isEnemy = Math.random() < 0.35;
    const h = isEnemy ? 34 : 28 + Math.random() * 25;
    obstacles.push({ x: W + 20, w: isEnemy ? 34 : 20 + Math.random() * 12, h, type: isEnemy ? "enemy" : "cactus" });
  }

  function collide(a, b) {
    const ax = a.x + 5, ay = a.y + 4, aw = a.w - 10, ah = a.h - 5;
    const bx = b.x + 3, by = groundY - b.h + 3, bw = b.w - 6, bh = b.h - 3;
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function endGame() {
    running = false; gameOver = true;
    best = Math.max(best, Math.floor(score));
    localStorage.setItem(bestKey, String(best));
    bestEl.textContent = format(best);
    titleEl.textContent = "GAME OVER";
    textEl.textContent = "Pontuação: " + format(score) + " — pressione ESPAÇO ou clique para tentar novamente.";
    startBtn.textContent = "Jogar novamente";
    overlay.classList.remove("hidden");
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    clouds.forEach(drawCloud);
    // chão e pequenas marcas de terreno
    rect(0, groundY, W, 3, "#53565a");
    for (let x = -20 + (groundOffset % 44); x < W; x += 44) {
      rect(x, groundY + 10, 7, 2, "#777");
      rect(x + 17, groundY + 16, 3, 2, "#b7b7b7");
    }
    // montanhas distantes
    ctx.strokeStyle = "#c9d4df"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, groundY); ctx.lineTo(42, groundY - 13); ctx.lineTo(58, groundY - 7); ctx.lineTo(76, groundY); ctx.stroke();
    obstacles.forEach(o => o.type === "enemy" ? drawGoomba(o) : drawCactus(o));
    drawMario(mario.x, mario.y);
  }

  function loop(time) {
    if (!running) return;
    const dt = lastTime ? Math.min((time - lastTime) / 16.67, 2) : 1;
    lastTime = time; frame += dt;
    speed = Math.min(5 + score / 450, 12);
    score += dt * speed * 0.11;
    scoreEl.textContent = format(score);
    groundOffset += speed * dt;
    clouds.forEach(c => { c.x -= speed * .22 * dt; if (c.x < -60) { c.x = W + 20; c.y = 35 + Math.random() * 65; } });

    mario.vy += gravity * dt;
    mario.y += mario.vy * dt;
    if (mario.y >= groundY - mario.h) { mario.y = groundY - mario.h; mario.vy = 0; mario.onGround = true; }

    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < W - (230 + Math.random() * 150)) {
      if (Math.random() < 0.035 * dt) spawnObstacle();
    }
    obstacles.forEach(o => { o.x -= speed * dt; if (collide(mario, o)) endGame(); });
    obstacles = obstacles.filter(o => o.x + o.w > -10);
    render();
    if (running) requestAnimationFrame(loop);
  }

  startBtn.addEventListener("click", () => reset());
  canvas.addEventListener("pointerdown", () => jump());
  window.addEventListener("keydown", e => {
    if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
      e.preventDefault();
      if (!running) reset(); else jump();
    }
  });
  // tela inicial
  clouds = [{x: 120, y: 52}, {x: 480, y: 78}, {x: 740, y: 42}];
  render();
})();
