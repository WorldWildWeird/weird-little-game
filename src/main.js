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

const W = 640;
const H = 360;
const SCALE = 2;
const GROUND = 32;
const START_X = 48;
const MAP_W = 3840;
const CAM_MARGIN = 24;
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
const BODY_W = 18; // collision = corps, pas le casque
const BODY_H = 22;
const LAND_FRAMES = 5;
const LAND_FW = 52;
const LAND_FH = 69;
const LAND_TICKS = 3;
const JUMP_FRAMES = 4;
const JUMP_FW = 52;
const JUMP_FH = 69;
const JUMP_TICKS = 3;
const JUMP_CROUCH = 1;
const LAND_SQUASH = [1, 0.93, 0.88, 0.93, 1];
const JUMP_SQUASH = [1, 0.88, 1, 1.08];

const CHESTS = [
  { mapX: 640, y: 264, w: 32, h: 32 },
  { mapX: 672, y: 264, w: 32, h: 32 },
  { mapX: 704, y: 264, w: 32, h: 32 },
];

const selectEl = document.getElementById("select");
const charsEl = document.getElementById("chars");
const playEl = document.getElementById("play");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const mapImg = new Image();
mapImg.src = "/maps/decor.png?v=4";

const STEP = 1000 / 60;

let chosen = null;
let img = null;
let running = false;
let dead = false;
let y = 0;
let vy = 0;
let onGround = true;
let px = START_X;
let cam = 0;
let facing = 1;
let leftHeld = false;
let rightHeld = false;
let nextSpawn = 90;
let obstacles = [];
let raf = 0;
let jumpBuffer = 0;
let jumpHeld = false;
let longJump = false;
let longBuffer = 0;
let longHeld = false;
let charData = null;
let lastT = 0;
let acc = 0;
let landImg = null;
let landFrameDatas = null;
let landAnim = -1;
let landTick = 0;
let jumpImg = null;
let jumpFrameDatas = null;
let jumpAnim = -1;
let jumpTick = 0;
let pendingLaunch = false;

function cacheCharPixels() {
  if (!img || !img.naturalWidth) return;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
  charData = g.getImageData(0, 0, c.width, c.height);
}

function cacheSheet(sheet, frameCount, fw, fh) {
  if (!sheet || !sheet.naturalWidth) return null;
  const c = document.createElement("canvas");
  c.width = fw;
  c.height = fh;
  const g = c.getContext("2d", { willReadFrequently: true });
  const frames = [];
  for (let i = 0; i < frameCount; i++) {
    g.clearRect(0, 0, fw, fh);
    g.drawImage(sheet, i * fw, 0, fw, fh, 0, 0, fw, fh);
    frames.push(g.getImageData(0, 0, fw, fh));
  }
  return frames;
}

function cacheLandFrames() {
  landFrameDatas = cacheSheet(landImg, LAND_FRAMES, LAND_FW, LAND_FH);
  if (landFrameDatas) charData = landFrameDatas[0];
}

function cacheJumpFrames() {
  jumpFrameDatas = cacheSheet(jumpImg, JUMP_FRAMES, JUMP_FW, JUMP_FH);
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(src));
    i.src = src;
  });
}

function loadImgOptional(src) {
  if (!src) return Promise.resolve(null);
  return loadImg(src).catch(() => null);
}

function currentPixels() {
  if (jumpFrameDatas && jumpAnim >= 0) return jumpFrameDatas[jumpAnim];
  if (landFrameDatas && landAnim >= 0) return landFrameDatas[landAnim];
  return charData;
}

if (window.__wlRaf) cancelAnimationFrame(window.__wlRaf);
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
  landImg = null;
  landFrameDatas = null;
  jumpImg = null;
  jumpFrameDatas = null;
  Promise.all([
    loadImg(char.src),
    loadImgOptional(char.landSrc),
    loadImgOptional(char.jumpSrc),
  ]).then(([charImg, landSheet, jumpSheet]) => {
    if (chosen !== char) return;
    img = charImg;
    landImg = landSheet;
    jumpImg = jumpSheet;
    cacheCharPixels();
    cacheLandFrames();
    cacheJumpFrames();
    selectEl.hidden = true;
    playEl.hidden = false;
    resetRun();
    running = true;
    lastT = 0;
    acc = 0;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(window.__wlRaf);
    raf = window.__wlRaf = requestAnimationFrame(loop);
  }).catch(() => {
    if (chosen !== char) return;
    img = new Image();
    img.onload = () => {
      cacheCharPixels();
      selectEl.hidden = true;
      playEl.hidden = false;
      resetRun();
      running = true;
      lastT = 0;
      acc = 0;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(window.__wlRaf);
      raf = window.__wlRaf = requestAnimationFrame(loop);
    };
    img.src = char.src;
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
  y = H - GROUND - charH();
  vy = 0;
  onGround = true;
  px = START_X;
  cam = 0;
  facing = 1;
  obstacles = [];
  jumpBuffer = 0;
  longJump = false;
  longBuffer = 0;
  landAnim = -1;
  landTick = 0;
  jumpAnim = -1;
  jumpTick = 0;
  pendingLaunch = false;
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

function spawn() {
  const h = 8 + Math.floor(Math.random() * 6);
  obstacles.push({
    x: W + 8,
    y: H - GROUND - h,
    w: 8,
    h,
  });
  nextSpawn = 140 + Math.random() * 50;
}

function charScreenX() {
  return Math.floor(px - cam);
}

function bodyBox() {
  return {
    x: charScreenX() + (charW() - BODY_W) / 2,
    y: y + charH() - BODY_H,
    w: BODY_W,
    h: BODY_H,
  };
}

function hit(o) {
  const b = bodyBox();
  return b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y;
}

function chestScreenX(mapX) {
  return Math.floor(mapX - cam);
}

function overlappingPlatformTop() {
  const sx = charScreenX();
  const left = sx + 10;
  const right = sx + charW() - 10;
  let top = null;
  for (const c of CHESTS) {
    const x = chestScreenX(c.mapX);
    if (right > x && left < x + c.w) top = c.y;
  }
  return top;
}

function landOn(surfaceY, wasAir) {
  y = surfaceY - charH();
  vy = 0;
  onGround = true;
  longJump = false;
  jumpAnim = -1;
  jumpTick = 0;
  if (longHeld || longBuffer > 0) tryJump(true);
  else if (jumpHeld || jumpBuffer > 0) tryJump(false);
  else if (wasAir) {
    landAnim = 1;
    landTick = 0;
  }
}

function walkDir() {
  return (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
}

function maxWorldX() {
  return Math.max(0, MAP_W - charW());
}

function followCamera() {
  const maxCam = Math.max(0, MAP_W - W);
  const sx = px - cam;
  if (sx < CAM_MARGIN) cam = px - CAM_MARGIN;
  else if (sx > W - charW() - CAM_MARGIN) cam = px - (W - charW() - CAM_MARGIN);
  if (cam < 0) cam = 0;
  if (cam > maxCam) cam = maxCam;
}

function update() {
  if (dead) return;

  const dir = walkDir();
  if (dir !== 0) {
    px += dir * SPEED0;
    facing = dir;
  }
  if (px < 0) px = 0;
  if (px > maxWorldX()) px = maxWorldX();
  followCamera();

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
  const floor = H - GROUND - charH();
  const platTop = overlappingPlatformTop();
  if (!pendingLaunch) {
    if (!onGround) {
      const feet = y + charH();
      const prevFeet = feet - vy;
      if (platTop != null && vy >= 0 && prevFeet <= platTop && feet >= platTop) {
        landOn(platTop, true);
      } else if (y >= floor) {
        landOn(H - GROUND, true);
      }
    } else if (platTop != null && Math.abs(y + charH() - platTop) <= 2) {
      y = platTop - charH();
    } else if (platTop == null && y < floor - 0.5) {
      onGround = false;
    } else if (y >= floor - 0.5) {
      y = floor;
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
  if (y < 0) y = 0;
  if (jumpBuffer > 0) jumpBuffer -= 1;
  if (longBuffer > 0) longBuffer -= 1;
}

function drawMap() {
  if (!mapImg.complete || !mapImg.naturalWidth) {
    ctx.fillStyle = "#7ec8e3";
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const mapW = mapImg.naturalWidth || MAP_W;
  const view = Math.floor(cam);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mapImg, view, 0, W, H, 0, 0, W, H);
  if (view + W > mapW) {
    const extra = view + W - mapW;
    ctx.drawImage(mapImg, 0, 0, extra, H, W - extra, 0, extra, H);
  }
}

function drawCrate(o) {
  const x = Math.floor(o.x);
  const y0 = Math.floor(o.y);
  ctx.fillStyle = "#c45c2d";
  ctx.fillRect(x, y0, o.w, o.h);
  ctx.fillStyle = "#e09050";
  ctx.fillRect(x, y0, o.w, 1);
  ctx.fillRect(x, y0, 1, o.h);
  ctx.fillStyle = "#7a3018";
  ctx.fillRect(x, y0 + o.h - 1, o.w, 1);
  ctx.fillRect(x + o.w - 1, y0, 1, o.h);
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
  const dy = py + ch - dh;
  ctx.drawImage(src, 0, 0, cw, ch, sx, dy, cw, dh);
}

function drawChar(py) {
  const sx = charScreenX();
  const cw = charW();
  withFacing(sx, cw, (dx) => {
    if (jumpAnim >= 0 && jumpImg) {
      ctx.drawImage(
        jumpImg,
        jumpAnim * JUMP_FW,
        0,
        JUMP_FW,
        JUMP_FH,
        dx,
        py,
        JUMP_FW,
        JUMP_FH
      );
      return;
    }
    if (landAnim >= 0 && landImg) {
      ctx.drawImage(
        landImg,
        landAnim * LAND_FW,
        0,
        LAND_FW,
        LAND_FH,
        dx,
        py,
        LAND_FW,
        LAND_FH
      );
      return;
    }
    if (img && jumpAnim >= 0) {
      drawSquash(img, JUMP_SQUASH[jumpAnim] ?? 1, dx, py);
      return;
    }
    if (img && landAnim >= 0) {
      drawSquash(img, LAND_SQUASH[landAnim] ?? 1, dx, py);
      return;
    }
    if (landImg) {
      ctx.drawImage(landImg, 0, 0, LAND_FW, LAND_FH, dx, py, LAND_FW, LAND_FH);
      return;
    }
    if (img) ctx.drawImage(img, dx, py, cw, charH());
  });
}

function draw() {
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawMap();
  drawChar(Math.floor(y));

  if (dead) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "12px monospace";
    ctx.fillText("GAME OVER", W / 2, H / 2 - 8);
    ctx.font = "8px monospace";
    ctx.fillText("Space: retry", W / 2, H / 2 + 10);
    ctx.fillText("Esc: characters", W / 2, H / 2 + 22);
    ctx.textAlign = "left";
  }
}

function loop(t) {
  raf = window.__wlRaf = requestAnimationFrame(loop);
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
    cancelAnimationFrame(window.__wlRaf);
  });
}
