/* ============================================================
 * aura_fx.js —— 玩家身上的粒子流引擎(Canvas2D, 角色绑定)
 * 光环=动态粒子模型(环绕/上升/星闪/雷丝), 按 #cult dataset.big 切换,
 * 测试面板改 dataset 即可实时预览。参数集中于 REALM_FX, 想调参改这里。
 * ============================================================ */
"use strict";

const REALM_FX = [
  /* 凡人: 几乎无光, 几点暖尘贴着身侧缓缓上浮 */
  { ringN: 0, upN: 10, sparkN: 2, bolt: 0,
    c1: "198,176,124", c2: "150,130,80", c3: "230,214,160",
    upV: 14, ringR: 0.40, ringS: 0.15, size: 1.2, glow: .20 },
  /* 炼气: 淡青气流绕身一环 + 灵气细丝上浮 */
  { ringN: 26, upN: 26, sparkN: 6, bolt: 0,
    c1: "127,224,255", c2: "90,170,215", c3: "190,240,255",
    upV: 26, ringR: 0.56, ringS: 0.30, size: 1.5, glow: .30 },
  /* 筑基: 青绿双环逆向 + 上升灵光, 密度提升 */
  { ringN: 44, upN: 40, sparkN: 10, bolt: 0,
    c1: "97,208,196", c2: "70,160,220", c3: "170,240,225",
    upV: 34, ringR: 0.64, ringS: 0.45, size: 1.7, glow: .38 },
  /* 结丹: 金砂绕体(多层轨道) + 中心丹火金粒 + 星闪 */
  { ringN: 70, upN: 30, sparkN: 16, bolt: 0,
    c1: "244,196,105", c2: "255,225,160", c3: "200,140,50",
    upV: 22, ringR: 0.72, ringS: 0.60, size: 1.9, glow: .46 },
  /* 元婴: 紫金双环 + 婴灵星光闪烁 + 缓慢上浮光丝 */
  { ringN: 60, upN: 26, sparkN: 22, bolt: 0,
    c1: "189,149,255", c2: "250,214,120", c3: "140,110,255",
    upV: 16, ringR: 0.80, ringS: 0.55, size: 2.0, glow: .52 },
  /* 化神: 广域青金光尘 + 双层大环 + 隐现雷丝 */
  { ringN: 84, upN: 50, sparkN: 26, bolt: 6,
    c1: "88,204,255", c2: "255,214,120", c3: "140,240,255",
    upV: 20, ringR: 0.95, ringS: 0.70, size: 2.2, glow: .60 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];

let cv, ctx, W = 0, H = 0, cx = 0, cy = 0, running = false, raf = 0, last = 0;
let parts = [];       // ring particles
let ups = [];         // rising motes
let sparks = [];      // twinkling sparks
let bolts = [];       // 雷丝(化神)
let cfg = REALM_FX[0];
let smooth = 0;       // 0..1 切换过渡进度
let targetIdx = 0;

function pickColor(str) { return str; }

function spawnRing() {
  if (!cfg.ringN) return;
  const a = Math.random() * Math.PI * 2;
  parts.push({ a, spd: (Math.random() * .6 + .45) * (Math.random() < .5 ? 1 : -1),
    r: cfg.ringR + (Math.random() - .5) * .12,
    size: (Math.random() * .8 + .5) * cfg.size,
    col: Math.random() < .6 ? cfg.c1 : cfg.c2,
    ph: Math.random() * 6.28 });
}
function spawnUp() {
  const left = Math.random() < .5;
  ups.push({ x: cx + (left ? -1 : 1) * W * (0.20 + Math.random() * 0.22),
    y: cy + H * (0.30 + Math.random() * 0.25),
    vx: (Math.random() - .5) * 6, vy: -cfg.upV * (0.6 + Math.random() * .7),
    life: 1, size: (Math.random() * .7 + .4) * cfg.size * .8,
    col: Math.random() < .5 ? cfg.c1 : cfg.c3,
    sway: Math.random() * 6.28, swayA: 8 + Math.random() * 12 });
}
function spawnSpark() {
  sparks.push({ a: Math.random() * Math.PI * 2,
    r: cfg.ringR * (0.55 + Math.random() * 0.6),
    ph: Math.random() * 6.28, tw: Math.random() * 6.28,
    size: (Math.random() * .5 + .3) * cfg.size, col: cfg.c3 });
}
function spawnBolt() {
  const a = Math.random() * Math.PI * 2, r0 = cfg.ringR * 0.9;
  const pts = []; let x = cx + Math.cos(a) * r0 * W * .5, y = cy + Math.sin(a) * r0 * W * .5;
  for (let i = 0; i < 4; i++) {
    x += (Math.random() - .5) * W * .10; y -= H * (0.03 + Math.random() * .05);
    pts.push([x, y]);
  }
  bolts.push({ pts, life: 1, col: Math.random() < .5 ? "200,240,255" : "255,224,150" });
}

function refill(dt) {
  const wantRing = cfg.ringN, wantUp = cfg.upN, wantSpark = cfg.sparkN;
  if (parts.length < wantRing && Math.random() < dt * 22) spawnRing();
  if (ups.length < wantUp && Math.random() < dt * 30) spawnUp();
  if (sparks.length < wantSpark && Math.random() < dt * 20) spawnSpark();
  if (cfg.bolt && bolts.length < 2 && Math.random() < dt * cfg.bolt * 0.04) spawnBolt();
}

function morph() {
  const cult = document.getElementById("cult");
  if (!cult) return;
  const i = BIG_NAMES.indexOf(cult.dataset.big);
  if (i !== targetIdx) { targetIdx = i >= 0 ? i : 0; smooth = 0; }
  if (smooth < 1) {
    smooth = Math.min(1, smooth + 0.04);
    const from = cfg, to = REALM_FX[targetIdx];
    cfg = {
      ringN: from.ringN + (to.ringN - from.ringN) * smooth,
      upN: from.upN + (to.upN - from.upN) * smooth,
      sparkN: from.sparkN + (to.sparkN - from.sparkN) * smooth,
      bolt: to.bolt, c1: to.c1, c2: to.c2, c3: to.c3,
      upV: from.upV + (to.upV - from.upV) * smooth,
      ringR: from.ringR + (to.ringR - from.ringR) * smooth,
      ringS: from.ringS + (to.ringS - from.ringS) * smooth,
      size: from.size + (to.size - from.size) * smooth,
      glow: from.glow + (to.glow - from.glow) * smooth,
    };
  } else if (!cfg.c1) {
    cfg = REALM_FX[targetIdx];
  }
}

function draw(dt, t) {
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";
  // 环粒子
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.a += p.spd * dt * 0.6;
    const rr = p.r * W * 0.5 * (1 + Math.sin(t * .8 + p.ph) * .04);
    const x = cx + Math.cos(p.a) * rr, y = cy + Math.sin(p.a) * rr * 0.92;
    const al = .5 + .35 * Math.sin(t * 2 + p.ph);
    ctx.fillStyle = `rgba(${p.col},${al * cfg.glow * 2.2})`;
    ctx.beginPath(); ctx.arc(x, y, p.size, 0, 7); ctx.fill();
  }
  // 上升灵气
  for (let i = ups.length - 1; i >= 0; i--) {
    const p = ups[i];
    p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(t * 1.3 + p.sway) * p.swayA * dt;
    p.life -= dt * 0.22;
    if (p.life <= 0 || p.y < cy - H * .5) { ups.splice(i, 1); continue; }
    ctx.fillStyle = `rgba(${p.col},${p.life * cfg.glow * 1.8})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, 7); ctx.fill();
  }
  // 星闪
  for (const s of sparks) {
    const tw = .5 + .5 * Math.sin(t * 2.6 + s.tw);
    const x = cx + Math.cos(s.a) * s.r * W * .5, y = cy + Math.sin(s.a) * s.r * W * .5;
    ctx.fillStyle = `rgba(${s.col},${tw * tw * cfg.glow * 2.0})`;
    ctx.beginPath(); ctx.arc(x, y, s.size * (0.6 + tw * .7), 0, 7); ctx.fill();
  }
  // 雷丝(化神)
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]; b.life -= dt * 1.4;
    if (b.life <= 0) { bolts.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(${b.col},${b.life * cfg.glow})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    b.pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function step(now) {
  raf = requestAnimationFrame(step);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  morph();
  refill(dt);
  draw(dt, now / 1000);
}

export function initAuraFx(canvas) {
  cv = canvas; ctx = cv.getContext("2d");
  const cult = canvas.parentElement;
  const fit = () => {
    const r = cult.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = Math.max(1, Math.round(r.width * dpr));
    H = cv.height = Math.max(1, Math.round(r.height * dpr));
    cv.style.width = r.width + "px"; cv.style.height = r.height + "px";
    cx = W / 2; cy = H * 0.46;
  };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(cult);
  if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(raf); running = false; }
    else if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); }
  });
  return { destroy() { cancelAnimationFrame(raf); running = false; ro.disconnect(); } };
}
