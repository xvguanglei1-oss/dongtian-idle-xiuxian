/* ============================================================
 * fx2d.js —— 纯 Canvas2D 玩家粒子流(不依赖 WebGL)
 * 要点: ①软光点精灵(离屏预渲染, 高性能) ②轨迹残影(流动感)
 *       ③画面上下边缘双重渐变, 粒子淡入淡出, 绝无割裂断点
 * 境界切换读 #cult dataset.big; 所有效果均为纯2D绘制。
 * ============================================================ */
"use strict";

const REALM_FX = [
  /* 凡人: 极淡暖尘 */
  { hN: 10, fN: 6,  c1: [214,190,130], c2: [160,140, 95],
    hSpd: 0.5, up: 0.24, rBase: 0.42, size: 7, op: 0.30 },
  /* 炼气: 淡青气流缠身 */
  { hN: 22, fN: 14, c1: [130,224,255], c2: [100,180,228],
    hSpd: 0.8, up: 0.40, rBase: 0.52, size: 8, op: 0.50 },
  /* 筑基: 青绿密旋 */
  { hN: 34, fN: 20, c1: [100,210,198], c2: [102,170,230],
    hSpd: 1.0, up: 0.50, rBase: 0.60, size: 9, op: 0.66 },
  /* 结丹: 金砂旋绕 */
  { hN: 48, fN: 22, c1: [248,204,118], c2: [255,230,168],
    hSpd: 1.2, up: 0.36, rBase: 0.68, size: 10, op: 0.78 },
  /* 元婴: 紫金星流 */
  { hN: 54, fN: 26, c1: [198,162,255], c2: [253,218,132],
    hSpd: 1.05, up: 0.30, rBase: 0.76, size: 11, op: 0.84 },
  /* 化神: 青金广域 */
  { hN: 70, fN: 32, c1: [100,210,255], c2: [255,220,132],
    hSpd: 1.3, up: 0.32, rBase: 0.86, size: 12, op: 0.95 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];
/* 上下渐隐带(占画布比例) — 在此带内粒子透明度平滑到0, 不生硬消失 */
const FADE = 0.16;

/* 软光点精灵缓存: 白芯软点 → tint */
const spriteCache = {};
function glowSprite(color) {
  const key = color.join(",");
  if (spriteCache[key]) return spriteCache[key];
  const cv = document.createElement("canvas");
  const S = 48; cv.width = cv.height = S;
  const g = cv.getContext("2d");
  g.drawImage(whiteGlow(), 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  g.fillRect(0, 0, S, S);
  spriteCache[key] = cv;
  return cv;
}
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

function initFx(canvas) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let helix = [], flows = [];
  let cur = 0;                 // 当前境界 idx
  let blend = 1;               // 切换过渡 0..1

  const fit = () => {
    const r = host.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(10, r.width); H = Math.max(10, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(host);

  const idx = () => {
    const nm = document.getElementById("cult") && document.getElementById("cult").dataset.big;
    const i = BIG_NAMES.indexOf(nm);
    return i >= 0 ? i : 0;
  };

  function P(cfgKey, i) {
    return { y: Math.random(), ph: Math.random() * 6.28, ok: true };
  }
  function makeHelix(i) {
    const p = REALM_FX[cur];
    return { a: Math.random() * 6.28, y: Math.random() * 0.7 + 0.15,
      r: 0.55 + Math.random() * 0.45,
      spd: p.hSpd * (0.75 + Math.random() * 0.6),
      ph: Math.random() * 6.28, seed: i };
  }
  function makeFlow(i) {
    const p = REALM_FX[cur];
    return { x: (Math.random() - 0.5) * 0.7, y: Math.random() * 0.7 + 0.15,
      spd: 0.35 + Math.random() * 0.75,
      sway: Math.random() * 6.28, seed: i };
  }
  const ensure = (n, arr, mk) => {
    while (arr.length < n) arr.push(mk(arr.length));
    if (arr.length > n) arr.length = n;
  };

  /* 上下渐变衰减: yN∈0..1 */
  function edgeAlpha(yN) {
    if (yN < FADE) return Math.max(0, yN / FADE);
    if (yN > 1 - FADE) return Math.max(0, (1 - yN) / FADE);
    return 1;
  }
  /* 平滑重生于底部(淡入), 顶部淡出, 区域外永不硬切 */
  function wrapY(p) {
    if (p.y >= 1) { p.y = 0.02; p.a = Math.random() * 6.28; }  // 顶部出→底部重生(会自然淡入)
    if (p.y <= 0.01) p.y = 0.02;
  }

  function draw(t, dt) {
    const p = REALM_FX[cur];
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.5;
    const rad = p.rBase * W * 0.5;

    /* ① 缠身螺旋粒子(带拖尾残影) */
    for (const q of helix) {
      q.y += dt * p.up * (0.55 + q.spd * 0.45);
      wrapY(q);
      q.a += dt * p.spd * 0.8;
      const rr = rad * q.r * (0.18 + 0.82 * Math.sin(Math.min(1, q.y) * Math.PI)); // 首尾收拢
      const x = cx + Math.cos(q.a) * rr;
      const y = cy + (q.y - 0.5) * H;
      const base = edgeAlpha(q.y) * p.op;
      // 残影尾迹: 沿运动反向一段渐隐
      const tx = x - Math.cos(q.a) * 16, ty = y;
      const grad = ctx.createLinearGradient(x, y, tx, ty);
      const col = (q.seed % 3 === 0) ? p.c2 : p.c1;
      grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${base * 0.85})`);
      grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      ctx.strokeStyle = grad; ctx.lineWidth = p.size * 0.55; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
      // 软光点
      ctx.globalAlpha = base * 0.9;
      ctx.drawImage(glowSprite(col), x - p.size / 2, y - p.size / 2, p.size, p.size);
    }
    /* ② 贴身流光(上升+摆动+残影, 上下渐隐) */
    for (const u of flows) {
      u.y += dt * p.up * u.spd;
      wrapY(u);
      const sway = Math.sin(t * 1.6 + u.sway) * 0.045;
      const x = cx + (u.x + sway) * W;
      const y = cy + (u.y - 0.5) * H;
      const base = edgeAlpha(u.y) * p.op * 0.9;
      const col = (u.seed % 2 === 0) ? p.c1 : p.c2;
      const size = p.size * 0.8;
      const ty2 = y - size * 3.2;   // 上方的细尾
      const grad = ctx.createLinearGradient(x, y, x, ty2);
      grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${base})`);
      grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      ctx.strokeStyle = grad; ctx.lineWidth = size * 0.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, ty2); ctx.stroke();
      ctx.globalAlpha = base;
      ctx.drawImage(glowSprite(col), x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    // 境界切换(立即切参数, 粒子平滑续跑)
    const i = idx();
    if (i !== cur) {
      cur = i; blend = 0;
      const P2 = REALM_FX[cur];
      ensure(P2.hN, helix, makeHelix);
      ensure(P2.fN, flows, makeFlow);
    }
    draw(now / 1000, dt);
  }

  // 初始化
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
