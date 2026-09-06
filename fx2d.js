/* ============================================================
 * fx2d.js —— 玩家身上的特效流 v4 (复刻 Unity 仓库柔光配方)
 * 精修点:
 *   ① 点状粒子(mote/星)更小; 线状粒子(streak)更细更长
 *   ② 数量按境界加大, 有"灵气浓度"递进
 *   ③ 色彩双色分层: 主色(60%)/亮色(28%)/白珠光(12%), 同屏有层次
 *   ④ 运动曲线区分——
 *       流光 streak: 绕身螺旋上升的流线轨迹(丝带弯曲, 不直射)
 *       烟缕 smoke : 低频大摆幅曲线袅袅上飘(幅度随高度张开)
 *       金尘 mote  : 飘浮式布朗微动(双频正弦叠加, 像尘埃悬浮)
 *       星闪 star  : 原地脉动闪烁
 *   ⑤ 粒子只在躯干带(y 27%~68%H, x ±22%W), 不越界不乱飞
 * ============================================================ */
"use strict";

const safe = (v, fb = 0) => (Number.isFinite(v) ? v : fb);
const rnd = (a, b) => a + Math.random() * (b - a);
const easeIO = u => u * u * (3 - 2 * u);
const WHITE = [255, 255, 255];

/* ---------- 境界视觉配置(数量递进·色彩分层) ---------- */
const REALM_VIS = [
  /* 凡人: 暖土尘, 仅一丝尘气 */
  { t: [232, 208, 150], s: [255, 244, 208],
    smoke: { n: 1, pk: .13, dur: [2.8, 3.8] },
    mote:  { n: 5, pk: .22, dur: [1.8, 2.6] },
    streak:{ n: 0, pk: .0, dur: [1.2, 1.7] },
    star:  { n: 0, pk: .0, dur: [.5, .8] },
    core: .10, haze: .08, beam: 0, ray: 0, rayA: 0 },
  /* 炼气: 淡青气流开始绕体 */
  { t: [128, 222, 255], s: [222, 248, 255],
    smoke: { n: 2, pk: .20, dur: [2.5, 3.5] },
    mote:  { n: 8, pk: .30, dur: [1.6, 2.4] },
    streak:{ n: 1, pk: .28, dur: [1.2, 1.7] },
    star:  { n: 1, pk: .45, dur: [.5, .8] },
    core: .14, haze: .11, beam: 0, ray: 0, rayA: 0 },
  /* 筑基: 青绿, 灵气明显浓 */
  { t: [104, 216, 198], s: [172, 250, 222],
    smoke: { n: 2, pk: .26, dur: [2.3, 3.3] },
    mote:  { n: 11, pk: .38, dur: [1.4, 2.2] },
    streak:{ n: 2, pk: .36, dur: [1.1, 1.6] },
    star:  { n: 1, pk: .52, dur: [.5, .8] },
    core: .18, haze: .14, beam: 0, ray: 0, rayA: 0 },
  /* 结丹: 金芒丹火, 光流渐盛 */
  { t: [250, 202, 110], s: [255, 242, 196],
    smoke: { n: 3, pk: .32, dur: [2.1, 3.1] },
    mote:  { n: 14, pk: .46, dur: [1.3, 2.0] },
    streak:{ n: 3, pk: .44, dur: [1.0, 1.5] },
    star:  { n: 2, pk: .58, dur: [.45, .8] },
    core: .22, haze: .17, beam: .30, ray: 0, rayA: 0 },
  /* 元婴: 紫金, 婴灵星光 */
  { t: [206, 168, 255], s: [255, 226, 158],
    smoke: { n: 3, pk: .38, dur: [2.0, 3.0] },
    mote:  { n: 17, pk: .52, dur: [1.2, 1.9] },
    streak:{ n: 4, pk: .50, dur: [1.0, 1.5] },
    star:  { n: 3, pk: .64, dur: [.45, .8] },
    core: .26, haze: .20, beam: .36, ray: 3, rayA: .05 },
  /* 化神: 青金, 万灵归身 */
  { t: [118, 214, 255], s: [255, 228, 150],
    smoke: { n: 4, pk: .44, dur: [1.9, 2.9] },
    mote:  { n: 20, pk: .60, dur: [1.1, 1.8] },
    streak:{ n: 5, pk: .56, dur: [.95, 1.45] },
    star:  { n: 4, pk: .70, dur: [.4, .75] },
    core: .30, haze: .24, beam: .42, ray: 5, rayA: .07 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];

/* ---------- 柔光贴图 ---------- */
const TEX = {
  haze: "assets/fx/fx_bloom_haze_soft.png",
  core: "assets/fx/fx_bloom_core_soft.png",
  ray:  "assets/fx/fx_bloom_ray_soft.png",
  beam: "assets/fx/fx_gold_beam_soft.png",
  smoke:"assets/fx/fx_gold_smoke.png",
  streak:"assets/fx/fx_gold_streak.png",
  mote: "assets/fx/fx_gold_mote.png",
  star: "assets/fx/fx_gold_star.png",
};
let imgs = {};
function loadAll() {
  return Promise.all(Object.keys(TEX).map(k =>
    new Promise(res => {
      const im = new Image();
      im.onload = () => { imgs[k] = im; res(); };
      im.onerror = () => { imgs[k] = null; res(); };
      im.src = TEX[k];
    })));
}
let tintedCache = {};
function tinted(keyTex, color) {
  const ck = keyTex + "_" + color.join(",");
  if (tintedCache[ck]) return tintedCache[ck];
  const src = imgs[keyTex];
  if (!src) return null;
  const cv = document.createElement("canvas");
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext("2d");
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
  g.fillRect(0, 0, cv.width, cv.height);
  tintedCache[ck] = cv;
  return cv;
}

/* 三段透明度: x 0..1 → 0..1 (峰0.3, 缓落) */
function prof(x) {
  if (x <= 0 || x >= 1) return 0;
  if (x < 0.3) { const u = x / 0.3; return u * u * (3 - 2 * u); }
  if (x < 0.78) { const u = (x - 0.3) / 0.48; return 1 - 0.42 * u; }
  const u = (x - 0.78) / 0.22;
  return (1 - u) * (1 - u);
}

/* 色彩分层: 主色t / 亮色s / 白珠光 按 hash 决定 (60/28/12) */
function pickCol(seed, t, s) {
  const r = (seed * 2654435761 % 100 + 100) % 100;
  if (r < 60) return t;
  if (r < 88) return s;
  return WHITE;
}

/* ============================================================
 * 引擎
 * ============================================================ */
function initFx(canvas) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, ready = false;
  let smokes = [], streaks = [], motes = [], stars = [];

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

  /* 生成上浮粒子: 仅定义自身特性; y 由 cy 邻域决定 */
  function mkP(type, cfgV) {
    const p = {
      type, dur: rnd(cfgV.dur[0], cfgV.dur[1]), born: 0,
      seed: Math.floor(rnd(0, 1e6)),
      y0: rnd(-0.02, 0.12),        // cy + y0H  起点(腰下至臀侧, 屏内)
      rise: rnd(0.16, 0.30),       // 上升高度
      x0: rnd(-0.17, 0.17),
      ph: rnd(0, 6.28), ph2: rnd(0, 6.28),
      f: rnd(0.9, 1.9), f2: rnd(2.1, 3.3),
      amp: rnd(0.008, 0.02),
      s0: rnd(0.8, 1.1),
      tilt: rnd(-0.05, 0.05),
      trace: [],
    };
    return p;
  }
  function mkStar(cfgV) {
    return {
      type: "star", dur: rnd(cfgV.dur[0], cfgV.dur[1]), born: 0,
      seed: Math.floor(rnd(0, 1e6)),
      x0: rnd(-0.20, 0.20), y0: rnd(-0.08, 0.14),
      s: rnd(0.5, 0.95), ang: rnd(0, 3.14), rot: rnd(-0.4, 0.4), pk: rnd(0.8, 1.1),
    };
  }
  function respawn(p, cfgV, t) {
    p.born = -rnd(0.6, 1.8);
    p.dur = rnd(cfgV.dur[0], cfgV.dur[1]);
    p.seed = Math.floor(rnd(0, 1e6));
    p.y0 = rnd(-0.02, 0.12); p.rise = rnd(0.16, 0.30);
    p.x0 = rnd(-0.17, 0.17); p.ph = rnd(0, 6.28); p.ph2 = rnd(0, 6.28);
    p.f = rnd(0.9, 1.9); p.f2 = rnd(2.1, 3.3);
    p.amp = rnd(0.008, 0.02); p.s0 = rnd(0.8, 1.1);
    p.tilt = rnd(-0.05, 0.05); p.trace = [];
  }
  function prepare(cfgV) {
    while (smokes.length < cfgV.smoke.n) smokes.push(mkP("smoke", cfgV.smoke));
    while (motes.length < cfgV.mote.n) motes.push(mkP("mote", cfgV.mote));
    while (streaks.length < cfgV.streak.n) streaks.push(mkP("streak", cfgV.streak));
    while (stars.length < cfgV.star.n) stars.push(mkStar(cfgV.star));
    smokes.length = cfgV.smoke.n; motes.length = cfgV.mote.n;
    streaks.length = cfgV.streak.n; stars.length = cfgV.star.n;
  }

  function draw(t, dt) {
    if (!ready || !imgs.haze) return;
    if (!Number.isFinite(W) || W < 1 || H < 1) return;
    const cfgV = REALM_VIS[idx()];
    try { ctx.clearRect(0, 0, W, H); } catch (e) { return; }
    ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.50;
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.1);
    const tCol = cfgV.t, sCol = cfgV.s;

    /* ---- 0) 背后柔光(静态呼吸) ---- */
    const hazeCv = tinted("haze", tCol);
    if (hazeCv && cfgV.haze > 0.01) {
      const sz = W * (0.62 + 0.05 * breathe);
      ctx.globalAlpha = safe(cfgV.haze * (0.7 + 0.3 * breathe), 0);
      ctx.drawImage(hazeCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    const coreCv = tinted("core", sCol);
    if (coreCv && cfgV.core > 0.01) {
      const sz = W * (0.30 + 0.04 * breathe);
      ctx.globalAlpha = safe(cfgV.core * (0.65 + 0.35 * breathe), 0);
      ctx.drawImage(coreCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    if (cfgV.beam > 0.01) {
      const bCv = tinted("beam", sCol);
      if (bCv) {
        const bw = W * 0.026 * (1 + 0.2 * breathe);
        const bh = H * 0.34 * (1 + 0.05 * breathe);
        ctx.globalAlpha = safe(cfgV.beam * (0.5 + 0.5 * breathe), 0);
        ctx.drawImage(bCv, cx - bw / 2, cy - bh * 0.5, bw, bh);
      }
    }
    if (cfgV.ray > 0 && imgs.ray) {
      const rCv = tinted("ray", sCol);
      if (rCv) {
        for (let i = 0; i < cfgV.ray; i++) {
          const ang = (i / Math.max(1, cfgV.ray - 1) - 0.5) * 1.5 + Math.sin(t * 0.25 + i) * 0.05;
          const len = W * 0.26;
          ctx.save();
          ctx.translate(cx, cy - H * 0.12);
          ctx.rotate(ang);
          ctx.globalAlpha = safe(cfgV.rayA * (0.55 + 0.45 * Math.sin(t * 0.4 + i * 1.7)), 0);
          ctx.drawImage(rCv, -len * 0.2, -len * 0.5, len * 0.4, len);
          ctx.restore();
        }
      }
    }

    /* ---- ① 流光 streak: 细丝, 绕体螺旋上升(有弯曲的流线轨迹) ---- */
    for (const p of streaks) {
      p.born += dt;
      if (p.born < 0) { p.trace = []; continue; }
      if (p.born > p.dur) { respawn(p, cfgV.streak, t); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      /* 螺旋相位随上升推进 → 轨迹是绕身螺旋, 非直射 */
      const spin = u * 3.4 + p.ph;
      const rr = W * 0.15 * (0.3 + 0.7 * Math.sin(Math.min(1, mv) * Math.PI)) * (0.6 + 0.4 * p.s0);
      const px = cx + Math.cos(spin) * rr + p.x0 * W * 0.25;
      const py = cy + (p.y0 - p.rise * mv) * H;
      /* 头端 */
      const al = safe(prof(u) * cfgV.streak.pk, 0);
      const col = pickCol(p.seed, tCol, sCol);
      ctx.globalAlpha = al;
      const dot = tinted("mote", col);
      const headS = H * 0.012 * p.s0;
      if (dot) ctx.drawImage(dot, px - headS / 2, py - headS / 2, headS, headS);
      /* 尾迹: 记录轨迹 → 细丝连线(弯曲流线) */
      p.trace.unshift({ x: px, y: py });
      if (p.trace.length > 10) p.trace.length = 10;
      ctx.lineCap = "round";
      for (let i = 1; i < p.trace.length; i++) {
        const a0 = p.trace[i - 1], a1 = p.trace[i];
        const seg = 1 - i / p.trace.length;
        ctx.strokeStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + safe(al * seg * 0.8, 0) + ")";
        ctx.lineWidth = Math.max(0.6, H * 0.0016);
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
      }
    }

    /* ---- ② 烟缕 smoke: 低频大摆幅袅袅上飘(烟感曲线) ---- */
    for (const p of smokes) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawn(p, cfgV.smoke, t); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      /* 摆幅随上升张开 → 袅袅散开的烟 */
      const swayAmp = p.amp * (0.4 + 2.2 * mv);
      const x = cx + (p.x0 + Math.sin(t * 0.9 + p.ph) * swayAmp) * W;
      const y = cy + (p.y0 - p.rise * mv) * H;
      const bh0 = H * 0.045 * p.s0 * (1 + 0.25 * mv);
      const bw0 = bh0 * (0.4 + 0.55 * mv);
      const col = pickCol(p.seed, tCol, sCol);
      const al = safe(prof(u) * cfgV.smoke.pk, 0);
      ctx.globalAlpha = al;
      const ic = tinted("smoke", col);
      if (ic) ctx.drawImage(ic, x - bw0 / 2, y - bh0 / 2, bw0, bh0);
    }

    /* ---- ③ 金尘 mote: 小点, 飘浮式微动(双频布朗感, 缓慢上浮) ---- */
    for (const p of motes) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawn(p, cfgV.mote, t); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      /* 双频叠加 = 尘埃随气流乱而缓慢地飘 */
      const drift = Math.sin(t * p.f + p.ph) * p.amp + Math.sin(t * p.f2 + p.ph2) * p.amp * 0.55;
      const x = cx + (p.x0 + drift * (1 + mv * 0.5)) * W;
      const y = cy + (p.y0 - p.rise * 0.55 * mv) * H + Math.sin(t * 1.4 + p.ph2) * H * 0.006;
      const sz = H * 0.014 * p.s0 * (1 - 0.35 * u);
      const col = pickCol(p.seed, tCol, sCol);
      const al = safe(prof(u) * cfgV.mote.pk, 0);
      ctx.globalAlpha = al;
      const ic = tinted("mote", col);
      if (ic) ctx.drawImage(ic, x - sz / 2, y - sz / 2, sz, sz);
    }

    /* ---- ④ 星闪 star: 原地脉动 ---- */
    for (const p of stars) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) {
        p.born = -rnd(1.4, 2.8);
        p.x0 = rnd(-0.20, 0.20); p.y0 = rnd(-0.10, 0.13); p.s = rnd(0.5, 0.95);
        p.seed = Math.floor(rnd(0, 1e6));
        continue;
      }
      const u = p.born / p.dur;
      const x = cx + p.x0 * W, y = cy + p.y0 * H;
      const sz = H * 0.055 * p.s * (1 + 0.4 * u);
      const col = pickCol(p.seed, tCol, sCol);
      const al = safe(prof(u) * cfgV.star.pk * p.pk, 0);
      ctx.globalAlpha = al;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.ang + p.rot * u);
      const ic = tinted("star", col);
      if (ic) ctx.drawImage(ic, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = safe(Math.min(0.05, (now - last) / 1000), 0.02); last = now;
    try {
      const cfgV = REALM_VIS[idx()];
      prepare(cfgV);
      draw(now / 1000, dt);
    } catch (e) {}
  }

  loadAll().then(() => { ready = true; });
  prepare(REALM_VIS[0]);
  last = performance.now();
  raf = requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { last = performance.now(); }
  });
  return { destroy() { cancelAnimationFrame(raf); ro.disconnect(); } };
}

export { initFx };
