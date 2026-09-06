/* fx2d.js — 纯 Canvas2D 玩家粒子流(无 WebGL 依赖)
 * 所有数值统一过 safe() 过滤, 非有限值降为默认值, createLinearGradient 永不抛错
 * 上下 16% 渐变带 + 软光点精灵 + 轨迹残影(无断点割裂感)
 * 已移除 createLinearGradient — 改用纯色 stroke, 杜绝报错
 */
"use strict";

const REALM_FX = [
  { hN: 10, fN: 6,  c1: [214,190,130], c2: [160,140, 95],
    hSpd: 0.5, up: 0.24, rBase: 0.42, size: 7, op: 0.30 },
  { hN: 22, fN: 14, c1: [130,224,255], c2: [100,180,228],
    hSpd: 0.8, up: 0.40, rBase: 0.52, size: 8, op: 0.50 },
  { hN: 34, fN: 20, c1: [100,210,198], c2: [102,170,230],
    hSpd: 1.0, up: 0.50, rBase: 0.60, size: 9, op: 0.66 },
  { hN: 48, fN: 22, c1: [248,204,118], c2: [255,230,168],
    hSpd: 1.2, up: 0.36, rBase: 0.68, size: 10, op: 0.78 },
  { hN: 54, fN: 26, c1: [198,162,255], c2: [253,218,132],
    hSpd: 1.05, up: 0.30, rBase: 0.76, size: 11, op: 0.84 },
  { hN: 70, fN: 32, c1: [100,210,255], c2: [255,220,132],
    hSpd: 1.3, up: 0.32, rBase: 0.86, size: 12, op: 0.95 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];
const FADE = 0.16;

/* 兜底: NaN/Infinity 绝不让它参与几何坐标 */
const safe = (v, fb = 0) => (Number.isFinite(v) ? v : fb);

/* 软光点精灵 */
let _white = null;
function whiteGlow() {
  if (_white) return _white;
  _white = document.createElement("canvas");
  const S = 48; _white.width = _white.height = S;
  const g = _white.getContext("2d");
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.30, "rgba(255,255,255,.65)");
  grd.addColorStop(0.7, "rgba(255,255,255,.16)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return _white;
}
const spriteCache = {};
function glowSprite(color) {
  const key = color.join(",");
  if (spriteCache[key]) return spriteCache[key];
  const cv = document.createElement("canvas");
  const S = 48; cv.width = cv.height = S;
  const g = cv.getContext("2d");
  g.drawImage(whiteGlow(), 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
  g.fillRect(0, 0, S, S);
  spriteCache[key] = cv;
  return cv;
}

function initFx(canvas) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let helix = [], flows = [];
  let cur = 0;

  const fit = () => {
    try {
      const r = host.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(10, r.width); H = Math.max(10, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } catch (e) { W = 10; H = 10; }
  };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(host);

  const idx = () => {
    const c = document.getElementById("cult");
    const nm = c && c.dataset.big;
    const i = BIG_NAMES.indexOf(nm);
    return i >= 0 ? i : 0;
  };
  function makeHelix(i) {
    const cfg0 = REALM_FX[cur];
    return {
      a: Math.random() * 6.28,
      y: Math.random() * 0.7 + 0.15,
      r: 0.55 + Math.random() * 0.45,
      spd: cfg0.hSpd * (0.75 + Math.random() * 0.6),
      seed: i
    };
  }
  function makeFlow(i) {
    return {
      x: (Math.random() - 0.5) * 0.7,
      y: Math.random() * 0.7 + 0.15,
      spd: 0.35 + Math.random() * 0.75,
      sway: Math.random() * 6.28,
      seed: i
    };
  }
  const ensure = (n, arr, mk) => {
    while (arr.length < n) arr.push(mk(arr.length));
    if (arr.length > n) arr.length = n;
  };
  function edgeAlpha(yN) {
    if (yN < FADE) return Math.max(0, yN / FADE);
    if (yN > 1 - FADE) return Math.max(0, (1 - yN) / FADE);
    return 1;
  }
  function wrapY(p) {
    if (!Number.isFinite(p.y)) p.y = 0.02;
    if (p.y >= 1) { p.y = 0.02; p.a = Math.random() * 6.28; }
    if (p.y <= 0.01) p.y = 0.02;
  }

  function draw(t, dt) {
    if (!Number.isFinite(W) || !Number.isFinite(H) || W < 1 || H < 1) return;
    const cfg0 = REALM_FX[cur];
    if (!cfg0) return;
    try { ctx.clearRect(0, 0, W, H); } catch (e) { return; }
    ctx.globalCompositeOperation = "lighter";
    const cx = safe(W / 2, 0), cy = safe(H * 0.5, 0);
    const rad = safe(cfg0.rBase * W * 0.5, 0);

    /* ① 缠身螺旋(带短残影) — 用纯色 stroke + 软光点, 不再调用 createLinearGradient */
    for (const q of helix) {
      q.y += dt * cfg0.up * (0.55 + q.spd * 0.45);
      wrapY(q);
      q.a += dt * q.spd * 0.8;
      const sinT = safe(Math.sin(safe(Math.min(1, q.y), 0) * Math.PI), 0);
      const rr = safe(rad * q.r * (0.18 + 0.82 * sinT), 0);
      const x = safe(cx + Math.cos(q.a) * rr, 0);
      const y = safe(cy + (q.y - 0.5) * H, 0);
      const base = safe(edgeAlpha(q.y) * cfg0.op, 0);
      if (base <= 0.005) continue;
      const col = (q.seed % 3 === 0) ? cfg0.c2 : cfg0.c1;
      const tx = safe(x - Math.cos(q.a) * 14, x);
      const ty = y;
      ctx.strokeStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + safe(base * 0.45, 0) + ")";
      ctx.lineWidth = safe(cfg0.size * 0.5, 1);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = safe(base * 0.95, 0);
      const sp = safe(cfg0.size, 6);
      try { ctx.drawImage(glowSprite(col), safe(x - sp / 2, 0), safe(y - sp / 2, 0), sp, sp); }
      catch (e) {}
    }
    /* ② 贴身流光 */
    for (const u of flows) {
      u.y += dt * cfg0.up * u.spd;
      wrapY(u);
      const sway = safe(Math.sin(t * 1.6 + u.sway) * 0.045, 0);
      const x = safe(cx + (u.x + sway) * W, 0);
      const y = safe(cy + (u.y - 0.5) * H, 0);
      const base = safe(edgeAlpha(u.y) * cfg0.op * 0.9, 0);
      if (base <= 0.005) continue;
      const col = (u.seed % 2 === 0) ? cfg0.c1 : cfg0.c2;
      const size = safe(cfg0.size * 0.8, 6);
      const ty2 = safe(y - size * 3, y);
      ctx.strokeStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + safe(base, 0) + ")";
      ctx.lineWidth = safe(size * 0.4, 1);
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, ty2); ctx.stroke();
      ctx.globalAlpha = safe(base, 0);
      try { ctx.drawImage(glowSprite(col), safe(x - size / 2, 0), safe(y - size / 2, 0), size, size); }
      catch (e) {}
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = safe(Math.min(0.05, (now - last) / 1000), 0.02); last = now;
    const i = idx();
    if (i !== cur) {
      cur = i;
      ensure(safe(REALM_FX[cur], REALM_FX[0]).hN, helix, makeHelix);
      ensure(safe(REALM_FX[cur], REALM_FX[0]).fN, flows, makeFlow);
    }
    try { draw(now / 1000, dt); } catch (e) { /* 单帧跳过 */ }
  }

  cur = idx();
  ensure(REALM_FX[cur].hN, helix, makeHelix);
  ensure(REALM_FX[cur].fN, flows, makeFlow);
  last = performance.now();
  raf = requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { last = performance.now(); }
  });
  return { destroy() { cancelAnimationFrame(raf); ro.disconnect(); } };
}

export { initFx };
