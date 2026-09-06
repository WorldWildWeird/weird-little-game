const CHARS = [
  { id: "artistic", name: "Artistic", src: "/chars/artistic.png?v=3" },
  { id: "believe", name: "Believe", src: "/chars/believe.png?v=3" },
  { id: "cabal", name: "Cabal", src: "/chars/cabal.png?v=3" },
  { id: "doodle", name: "Doodle", src: "/chars/doodle.png?v=3" },
  { id: "dream", name: "Dream", src: "/chars/dream.png?v=3" },
  { id: "fomo", name: "Fomo", src: "/chars/fomo.png?v=3" },
  { id: "ftw", name: "FTW", src: "/chars/ftw.png?v=3" },
  { id: "gucci", name: "Gucci", src: "/chars/gucci.png?v=3" },
  { id: "luck", name: "Luck", src: "/chars/luck.png?v=3" },
  { id: "neon", name: "Neon", src: "/chars/neon.png?v=3" },
  { id: "orion", name: "Orion", src: "/chars/orion.png?v=3" },
  { id: "pizza", name: "Pizza", src: "/chars/pizza.png?v=3" },
  { id: "redlines", name: "Redlines", src: "/chars/redlines.png?v=3" },
  { id: "sewing", name: "Sewing", src: "/chars/sewing.png?v=3" },
  { id: "shortsqueeze", name: "Shortsqueeze", src: "/chars/shortsqueeze.png?v=3" },
  { id: "sportswear", name: "Sportswear", src: "/chars/sportswear.png?v=3" },
  { id: "star", name: "Star", src: "/chars/star.png?v=3" },
  { id: "tv", name: "TV", src: "/chars/tv.png?v=3" },
  { id: "worldpeace", name: "Worldpeace", src: "/chars/worldpeace.png?v=3" },
];

const KINDS = {
  "green-s": { src: "/candles/green-s.png", w: 62, h: 80 },
  "green-m": { src: "/candles/green-m.png", w: 65, h: 245 },
  "green-l": { src: "/candles/green-l.png", w: 80, h: 395 },
  "red-s": { src: "/candles/red-s.png", w: 92, h: 77 },
  "red-m": { src: "/candles/red-m.png", w: 62, h: 254 },
  "red-l": { src: "/candles/red-l.png", w: 83, h: 383 },
};

const W = 640;
const H = 360;
const SCALE = 2;
const BG = "#dddddd";
const GRAVITY = 0.2;
const FALL_GRAVITY = 0.34;
const JUMP_CUT = 0.45;
const JUMP = -5.2;
const JUMP_LONG = -6.2;
const LONG_GRAVITY = 0.2;
const LONG_FALL = 0.32;
const SPEED0 = 2;
const JUMP_BUFFER = 8;
const MAX_STEPS = 2;
const BODY_W = 18;
const BODY_H = 22;
const LAND_SQUASH = [1, 0.93, 0.88, 0.93, 1];
const JUMP_SQUASH = [1, 0.88, 1, 1.08];
const LAND_FRAMES = 5;
const LAND_TICKS = 3;
const JUMP_FRAMES = 4;
const JUMP_TICKS = 3;
const JUMP_CROUCH = 1;
const STEP = 1000 / 60;
const START_TOP = 2480;
const EXPO_TOP = 2340;
const CANDLE_GAP = 5;

// rise = how much higher the next close is (px). Space jump reaches ~64.
const SEQUENCE = [
  ["green-s", 0],
  ["red-s", -12],
  ["green-s", 18],
  ["green-m", 22],
  ["red-s", -14],
  ["green-m", 24],
  ["green-l", 26],
  ["green-l", 20],
  ["green-m", 16],
  ["red-s", -20],
  ["red-m", -22],
  ["red-l", -24],
  ["red-s", -18],
  ["red-m", -16],
  ["green-s", 18],
  ["green-m", 22],
  ["green-s", 26],
  ["green-l", 28],
  ["green-m", 30],
  ["green-l", 32],
  ["green-s", 34],
  ["green-l", 36],
];

function buildMap() {
  let x = 40;
  let top = START_TOP;
  const out = [];
  for (const [kind, rise] of SEQUENCE) {
    top -= rise;
    const k = KINDS[kind];
    out.push({ kind, x, top, w: k.w, h: k.h, src: k.src });
    x += k.w + CANDLE_GAP;
  }
  return out;
}

const selectEl = document.getElementById("select");
const charsEl = document.getElementById("chars");
const playEl = document.getElementById("play");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const candleImgs = {};
const candles = buildMap();
const WORLD_W = candles[candles.length - 1].x + candles[candles.length - 1].w + 48;

let chosen = null;
let img = null;
let running = false;
let dead = false;
let px = candles[0].x + 6;
let y = 0;
let camX = 0;
let vy = 0;
let onGround = true;
let facing = 1;
let leftHeld = false;
let rightHeld = false;
let jumpBuffer = 0;
let jumpHeld = false;
let longJump = false;
let longBuffer = 0;
let longHeld = false;
let pendingLaunch = false;
let jumpAnim = -1;
let jumpTick = 0;
let landAnim = -1;
let landTick = 0;
let camY = 0;
let bestTop = START_TOP;
let raf = 0;
let lastT = 0;
let acc = 0;

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(src));
    i.src = src;
  });
}

Promise.all(Object.entries(KINDS).map(([id, k]) => loadImg(k.src).then((im) => { candleImgs[id] = im; })));

if (window.__mcRaf) cancelAnimationFrame(window.__mcRaf);
charsEl.innerHTML = "";

for (const c of CHARS) {
  const btn = document.createElement("button");
  btn.className = "char";
  btn.type = "button";
  btn.innerHTML = `<img src="${c.src}" alt="${c.name}" /><span>${c.name}</span>`;
  btn.addEventListener("click", () => startGame(c));
  charsEl.appendChild(btn);
}

function startGame(char) {
  chosen = char;
  loadImg(char.src).then((charImg) => {
    if (chosen !== char) return;
    img = charImg;
    selectEl.hidden = true;
    playEl.hidden = false;
    resetRun();
    running = true;
    lastT = 0;
    acc = 0;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(window.__mcRaf);
    raf = window.__mcRaf = requestAnimationFrame(loop);
  });
}

function charW() {
  return img ? img.naturalWidth : 52;
}

function charH() {
  return img ? img.naturalHeight : 69;
}

function resetRun() {
  dead = false;
  px = candles[0].x + 6;
  y = candles[0].top - charH();
  vy = 0;
  onGround = true;
  facing = 1;
  jumpBuffer = 0;
  longJump = false;
  longBuffer = 0;
  pendingLaunch = false;
  jumpAnim = -1;
  jumpTick = 0;
  landAnim = -1;
  landTick = 0;
  camX = 0;
  camY = candles[0].top - H + 110;
  bestTop = candles[0].top;
  leftHeld = false;
  rightHeld = false;
}

function launchJump() {
  vy = longJump ? JUMP_LONG : JUMP;
  onGround = false;
  pendingLaunch = false;
}

function tryJump(isLong) {
  if (!running || dead || pendingLaunch) return;
  if (!onGround) return;
  longJump = !!isLong;
  jumpBuffer = 0;
  longBuffer = 0;
  landAnim = -1;
  landTick = 0;
  jumpAnim = JUMP_CROUCH;
  jumpTick = 0;
  pendingLaunch = true;
}

function requestJump() {
  if (!running || dead) return;
  jumpBuffer = JUMP_BUFFER;
  tryJump(false);
}

function requestLongJump() {
  if (!running || dead) return;
  longBuffer = JUMP_BUFFER;
  tryJump(true);
}

function landOn(surfaceY, wasAir) {
  y = surfaceY - charH();
  vy = 0;
  onGround = true;
  longJump = false;
  jumpAnim = -1;
  jumpTick = 0;
  if (surfaceY < bestTop) bestTop = surfaceY;
  if (longHeld || longBuffer > 0) tryJump(true);
  else if (jumpHeld || jumpBuffer > 0) tryJump(false);
  else if (wasAir) {
    landAnim = 1;
    landTick = 0;
  }
}

function overlappingTops() {
  const left = px + 10;
  const right = px + charW() - 10;
  const tops = [];
  for (const c of candles) {
    if (right > c.x && left < c.x + c.w) tops.push(c.top);
  }
  return tops;
}

function walkDir() {
  return (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
}

function followCamera() {
  const sx = px - camX;
  if (sx < 140) camX = px - 140;
  else if (sx > W - charW() - 160) camX = px - (W - charW() - 160);
  const maxCamX = Math.max(0, WORLD_W - W);
  if (camX < 0) camX = 0;
  if (camX > maxCamX) camX = maxCamX;

  const target = y - H * 0.45;
  camY += (target - camY) * 0.16;
  if (bestTop < EXPO_TOP) {
    const t = Math.min(1, (EXPO_TOP - bestTop) / 400);
    camY -= 0.25 + t * 0.55;
  }
  const maxCamY = START_TOP - 80;
  if (camY > maxCamY) camY = maxCamY;
  if (camY < 0) camY = 0;
}

function marketCap() {
  return Math.floor((START_TOP - bestTop) * 18400 + 42000);
}

function formatCap(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

function update() {
  if (dead) return;

  const dir = walkDir();
  if (dir !== 0) {
    px += dir * SPEED0;
    facing = dir;
  }
  if (px < 8) px = 8;
  if (px > WORLD_W - charW() - 8) px = WORLD_W - charW() - 8;

  if (pendingLaunch) {
    jumpTick += 1;
    if (jumpTick >= JUMP_TICKS) {
      jumpTick = 0;
      jumpAnim = JUMP_CROUCH + 1;
      launchJump();
    }
  } else if (!onGround && jumpAnim >= 0) {
    jumpTick += 1;
    if (jumpTick >= JUMP_TICKS) {
      jumpTick = 0;
      jumpAnim += 1;
      if (jumpAnim >= JUMP_FRAMES) jumpAnim = -1;
    }
  }

  if (!onGround) {
    if (longJump) {
      vy += vy > 0 ? LONG_FALL : LONG_GRAVITY;
    } else if (vy < 0 && !jumpHeld) {
      vy += GRAVITY + JUMP_CUT;
    } else if (vy > 0) {
      vy += FALL_GRAVITY;
    } else {
      vy += GRAVITY;
    }
    y += vy;
  }

  const tops = overlappingTops();
  if (!pendingLaunch) {
    if (!onGround) {
      const feet = y + charH();
      const prevFeet = feet - vy;
      if (vy >= 0) {
        let land = null;
        for (const platTop of tops) {
          if (prevFeet <= platTop && feet >= platTop) {
            if (land == null || platTop < land) land = platTop;
          }
        }
        if (land != null) landOn(land, true);
      }
    } else {
      const feet = y + charH();
      const near = tops.find((t) => Math.abs(feet - t) <= 2);
      if (near != null) y = near - charH();
      else onGround = false;
    }
  }

  if (onGround && !pendingLaunch && landAnim >= 0) {
    landTick += 1;
    if (landTick >= LAND_TICKS) {
      landTick = 0;
      landAnim += 1;
      if (landAnim >= LAND_FRAMES) landAnim = -1;
    }
  }

  followCamera();
  if (y > camY + H + 36) dead = true;
  if (jumpBuffer > 0) jumpBuffer -= 1;
  if (longBuffer > 0) longBuffer -= 1;
}

function drawCandles() {
  for (const c of candles) {
    const sx = Math.floor(c.x - camX);
    const sy = Math.floor(c.top - camY);
    if (sx + c.w < 0 || sx > W || sy > H || sy + c.h < 0) continue;
    const im = candleImgs[c.kind];
    if (im) ctx.drawImage(im, sx, sy, c.w, c.h);
  }
}

function withFacing(sx, w, drawAt) {
  ctx.save();
  if (facing < 0) {
    ctx.translate(sx + w, 0);
    ctx.scale(-1, 1);
    drawAt(0);
  } else {
    drawAt(sx);
  }
  ctx.restore();
}

function drawSquash(src, scale, sx, py) {
  const cw = charW();
  const ch = charH();
  const dh = Math.max(1, Math.round(ch * scale));
  ctx.drawImage(src, 0, 0, cw, ch, sx, py + ch - dh, cw, dh);
}

function drawChar() {
  if (!img) return;
  const sx = Math.floor(px - camX);
  const py = Math.floor(y - camY);
  const cw = charW();
  withFacing(sx, cw, (dx) => {
    if (jumpAnim >= 0) {
      drawSquash(img, JUMP_SQUASH[jumpAnim] ?? 1, dx, py);
      return;
    }
    if (landAnim >= 0) {
      drawSquash(img, LAND_SQUASH[landAnim] ?? 1, dx, py);
      return;
    }
    ctx.drawImage(img, dx, py, cw, charH());
  });
}

function drawHud() {
  ctx.fillStyle = "#111";
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.fillText("MARKET CAP", 8, 16);
  ctx.font = "16px monospace";
  ctx.fillText(formatCap(marketCap()), 8, 34);

  if (dead) {
    ctx.fillStyle = "rgba(17,17,17,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.font = "14px monospace";
    ctx.fillText("LIQUIDATED", W / 2, H / 2 - 8);
    ctx.font = "8px monospace";
    ctx.fillText(formatCap(marketCap()), W / 2, H / 2 + 10);
    ctx.fillText("Space: retry · Esc: characters", W / 2, H / 2 + 24);
    ctx.textAlign = "left";
  }
}

function draw() {
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawCandles();
  drawChar();
  drawHud();
}

function loop(t) {
  raf = window.__mcRaf = requestAnimationFrame(loop);
  if (!running) return;
  if (!lastT) {
    lastT = t;
    draw();
    return;
  }
  acc += t - lastT;
  lastT = t;
  if (acc > 50) acc = STEP;
  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS) {
    update();
    acc -= STEP;
    steps += 1;
  }
  if (steps === MAX_STEPS) acc = 0;
  draw();
}

function backToSelect() {
  running = false;
  cancelAnimationFrame(raf);
  playEl.hidden = true;
  selectEl.hidden = false;
}

function isLeft(code) {
  return code === "ArrowLeft" || code === "KeyA" || code === "KeyQ";
}

function isRight(code) {
  return code === "ArrowRight" || code === "KeyD";
}

window.addEventListener("keydown", (e) => {
  if (isLeft(e.code)) {
    e.preventDefault();
    leftHeld = true;
    return;
  }
  if (isRight(e.code)) {
    e.preventDefault();
    rightHeld = true;
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    jumpHeld = true;
    if (e.repeat) return;
    if (dead) resetRun();
    else requestJump();
  }
  if (e.code === "KeyB") {
    longHeld = true;
    if (e.repeat) return;
    if (!dead) requestLongJump();
  }
  if (e.code === "Escape") backToSelect();
});

window.addEventListener("keyup", (e) => {
  if (isLeft(e.code)) leftHeld = false;
  if (isRight(e.code)) rightHeld = false;
  if (e.code === "Space") jumpHeld = false;
  if (e.code === "KeyB") longHeld = false;
});

canvas.addEventListener("pointerdown", () => {
  jumpHeld = true;
  if (dead) resetRun();
  else requestJump();
});

window.addEventListener("pointerup", () => {
  jumpHeld = false;
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    running = false;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(window.__mcRaf);
  });
}
