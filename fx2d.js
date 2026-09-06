/* ============================================================
 * fx2d.js —— 玩家身上的特效流 v5
 * 依据仓库贴图/脚本特性:
 *   fx_gold_streak (64x256 细长光条) → 流光: 亮光条快速上窜,
 *       上窜中带横向正弦摆动 → 曲线运动(非直射)
 *   fx_gold_mote   (32x32 小圆点)    → 金尘: 细碎光点群, 飘浮布朗感
 *   fx_gold_star   (64x64 四角星)    → 星闪: 原地脉动闪烁
 *   fx_gold_beam/ray/haze/core       → 静态层(背后光柱/放射/柔光)
 *   (fx_gold_smoke 已弃用——烟团观感不可控)
 * 原则: 该看的看得见, 点状小粒子做密度, 线状粒子做显眼流动。
 * ============================================================ */
"use strict";

const safe = (v, fb = 0) => (Number.isFinite(v) ? v : fb);
const rnd = (a, b) => a + Math.random() * (b - a);
const easeIO = u => u * u * (3 - 2 * u);
const WHITE = [255, 255, 255];

/* ---------- 境界视觉配置(数量递进·流光明亮可见) ---------- */
const REALM_VIS = [
  /* 凡人: 几缕暖尘 */
  { t: [232, 210, 156], s: [255, 246, 214],
    mote:  { n: 6,  pk: .30, dur: [1.8, 2.6], sz: 1.0 },
    streak:{ n: 0,  pk: .0,  dur: [1.1, 1.6], ln: 1.0 },
    star:  { n: 0,  pk: .0,  dur: [.5, .85] },
    core: .10, haze: .08, beam: 0, ray: 0, rayA: 0 },
  /* 炼气: 淡青光点初现 + 一缕流光 */
  { t: [128, 222, 255], s: [226, 250, 255],
    mote:  { n: 14, pk: .40, dur: [1.6, 2.4], sz: 1.0 },
    streak:{ n: 2,  pk: .60, dur: [1.1, 1.6], ln: 1.0 },
    star:  { n: 1,  pk: .55, dur: [.5, .8] },
    core: .14, haze: .11, beam: 0, ray: 0, rayA: 0 },
  /* 筑基: 灵气成雾点群 */
  { t: [108, 218, 200], s: [178, 252, 226],
    mote:  { n: 20, pk: .48, dur: [1.4, 2.2], sz: 1.05 },
    streak:{ n: 3,  pk: .66, dur: [1.0, 1.5], ln: 1.05 },
    star:  { n: 2,  pk: .62, dur: [.5, .8] },
    core: .18, haze: .14, beam: 0, ray: 0, rayA: 0 },
  /* 结丹: 金芒丹光流转 */
  { t: [250, 202, 108], s: [255, 244, 200],
    mote:  { n: 28, pk: .56, dur: [1.3, 2.0], sz: 1.1 },
    streak:{ n: 4,  pk: .72, dur: [1.0, 1.5], ln: 1.1 },
    star:  { n: 2,  pk: .66, dur: [.45, .8] },
    core: .22, haze: .17, beam: .30, ray: 0, rayA: 0 },
  /* 元婴: 紫金婴辉 */
  { t: [206, 168, 255], s: [255, 228, 162],
    mote:  { n: 34, pk: .62, dur: [1.2, 1.9], sz: 1.15 },
    streak:{ n: 5,  pk: .76, dur: [1.0, 1.5], ln: 1.15 },
    star:  { n: 3,  pk: .72, dur: [.45, .8] },
    core: .26, haze: .20, beam: .36, ray: 3, rayA: .05 },
  /* 化神: 青金万灵归身 */
  { t: [120, 216, 255], s: [255, 230, 156],
    mote:  { n: 42, pk: .68, dur: [1.1, 1.8], sz: 1.2 },
    streak:{ n: 6,  pk: .80, dur: [.95, 1.45], ln: 1.2 },
    star:  { n: 4,  pk: .78, dur: [.4, .75] },
    core: .30, haze: .24, beam: .42, ray: 5, rayA: .07 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];

/* ---------- 柔光贴图 ---------- */
const TEX = {
  haze: "assets/fx/fx_bloom_haze_soft.png",
  core: "assets/fx/fx_bloom_core_soft.png",
  ray:  "assets/fx/fx_bloom_ray_soft.png",
  beam: "assets/fx/fx_gold_beam_soft.png",
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
/* 色彩分层: 主色t / 亮色s / 白 按 seed hash (45/40/15) */
function pickCol(seed, t, s) {
  const r = (seed * 2654435761 % 100 + 100) % 100;
  if (r < 45) return t;
  if (r < 85) return s;
  return WHITE;
}
/* 三段透明度: 峰0.3, 缓落 */
function prof(x) {
  if (x <= 0 || x >= 1) return 0;
  if (x < 0.3) { const u = x / 0.3; return u * u * (3 - 2 * u); }
  if (x < 0.78) { const u = (x - 0.3) / 0.48; return 1 - 0.42 * u; }
  const u = (x - 0.78) / 0.22;
  return (1 - u) * (1 - u);
}

/* ============================================================
 * 引擎
 * ============================================================ */
function initFx(canvas) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, ready = false;
  let streaks = [], motes = [], stars = [];

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

  /* 金尘 mote: 细碎光点, 飘浮双频 */
  function mkMote(cfgV) {
    return {
      dur: rnd(cfgV.dur[0], cfgV.dur[1]), born: 0,
      seed: Math.floor(rnd(0, 1e6)),
      y0: rnd(-0.03, 0.12), rise: rnd(0.13, 0.24),
      x0: rnd(-0.20, 0.20),
      ph: rnd(0, 6.28), ph2: rnd(0, 6.28),
      f: rnd(1.0, 2.0), f2: rnd(2.4, 3.6),
      amp: rnd(0.012, 0.028), s0: rnd(0.8, 1.2),
    };
  }
  /* 流光 streak: 细长光条(贴图), 从脚下快速上窜, x正弦摆动 */
  function mkStreak(cfgV) {
    return {
      dur: rnd(cfgV.dur[0], cfgV.dur[1]), born: 0,
      seed: Math.floor(rnd(0, 1e6)),
      x0: rnd(-0.22, 0.22),              // 出生横向偏移(躯干内)
      y0: rnd(0.16, 0.28),               // 起点: cy+y0H (腿侧, 屏内~0.7H)
      rise: rnd(0.34, 0.44),             // 上窜到 cy+(y0-rise)H (~0.25~0.35H 胸口/肩)
      ph: rnd(0, 6.28), f: rnd(1.4, 2.2),
      amp: rnd(0.02, 0.045),             // 摆动幅度(比mote大→曲线可见)
      s0: rnd(0.85, 1.15),
      tilt: rnd(-0.10, 0.10),
      ln: rnd(0.9, 1.1) * cfgV.ln,
    };
  }
  /* 星闪 */
  function mkStar(cfgV) {
    return {
      dur: rnd(cfgV.dur[0], cfgV.dur[1]), born: 0,
      seed: Math.floor(rnd(0, 1e6)),
      x0: rnd(-0.20, 0.20), y0: rnd(-0.08, 0.14),
      s: rnd(0.6, 1.1), ang: rnd(0, 3.14), rot: rnd(-0.4, 0.4), pk: rnd(0.85, 1.1),
    };
  }
  function respawnP(p, cfgV) {
    p.born = -rnd(0.5, 1.5);
    p.dur = rnd(cfgV.dur[0], cfgV.dur[1]);
    p.seed = Math.floor(rnd(0, 1e6));
  }
  function respawnMote(p, cfgV) {
    respawnP(p, cfgV);
    p.y0 = rnd(-0.03, 0.12); p.rise = rnd(0.13, 0.24);
    p.x0 = rnd(-0.20, 0.20); p.ph = rnd(0, 6.28); p.ph2 = rnd(0, 6.28);
    p.f = rnd(1.0, 2.0); p.f2 = rnd(2.4, 3.6);
    p.amp = rnd(0.012, 0.028); p.s0 = rnd(0.8, 1.2);
  }
  function respawnStreak(p, cfgV) {
    respawnP(p, cfgV);
    p.x0 = rnd(-0.22, 0.22); p.y0 = rnd(0.16, 0.28);
    p.rise = rnd(0.34, 0.44); p.ph = rnd(0, 6.28); p.f = rnd(1.4, 2.2);
    p.amp = rnd(0.02, 0.045); p.s0 = rnd(0.85, 1.15);
    p.tilt = rnd(-0.10, 0.10); p.ln = rnd(0.9, 1.1) * cfgV.ln;
  }
  function respawnStar(p, cfgV) {
    p.born = -rnd(0.9, 2.0);
    p.dur = rnd(cfgV.dur[0], cfgV.dur[1]);
    p.x0 = rnd(-0.20, 0.20); p.y0 = rnd(-0.08, 0.14);
    p.s = rnd(0.6, 1.1); p.seed = Math.floor(rnd(0, 1e6));
  }
  function prepare(cfgV) {
    while (motes.length < cfgV.mote.n) motes.push(mkMote(cfgV.mote));
    while (streaks.length < cfgV.streak.n) streaks.push(mkStreak(cfgV.streak));
    while (stars.length < cfgV.star.n) stars.push(mkStar(cfgV.star));
    motes.length = cfgV.mote.n; streaks.length = cfgV.streak.n; stars.length = cfgV.star.n;
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

    /* 0) 背后柔光(静态呼吸) + 光柱 + 放射 */
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
        const bw = W * 0.028 * (1 + 0.2 * breathe);
        const bh = H * 0.36 * (1 + 0.05 * breathe);
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

    /* ---- ① 流光 streak: 细长光条快速上窜, x正弦摆动(曲线流动) ---- */
    for (const p of streaks) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawnStreak(p, cfgV.streak); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      /* 上窜 y: 从身下到肩/头侧; x: 正弦摆动 → 曲线 */
      const yTop = cy + (p.y0 - p.rise * mv) * H;
      const swayX = Math.sin(t * p.f + p.ph) * p.amp * (0.6 + mv);
      const xMid = cx + (p.x0 + swayX) * W;
      const ang = p.tilt + Math.cos(t * p.f + p.ph) * p.amp * 0.7 * (0.5 + mv);
      const len = H * (0.11 + 0.05 * mv) * p.ln;
      const wid = len * 0.085;
      const al = safe(prof(u) * cfgV.streak.pk, 0);
      const col = pickCol(p.seed, tCol, sCol);
      ctx.save();
      ctx.translate(xMid, yTop);
      ctx.rotate(ang);
      ctx.globalAlpha = al;
      const ic = tinted("streak", col);
      /* 贴图较长: 尾端朝上(-y), 让可见的主体在下方 2/3 */
      if (ic) ctx.drawImage(ic, -wid / 2, -len * 0.62, wid, len);
      ctx.restore();
    }

    /* ---- ② 金尘 mote: 细碎小光点群, 双频飘浮 ---- */
    for (const p of motes) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawnMote(p, cfgV.mote); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      const drift = Math.sin(t * p.f + p.ph) * p.amp + Math.sin(t * p.f2 + p.ph2) * p.amp * 0.55;
      const x = cx + (p.x0 + drift * (1 + mv)) * W;
      const y = cy + (p.y0 - p.rise * mv) * H + Math.sin(t * 1.4 + p.ph2) * H * 0.005;
      const sz = H * 0.022 * p.s0 * cfgV.mote.sz * (1 - 0.3 * u);
      const col = pickCol(p.seed, tCol, sCol);
      const al = safe(prof(u) * cfgV.mote.pk, 0);
      ctx.globalAlpha = al;
      const ic = tinted("mote", col);
      if (ic) ctx.drawImage(ic, x - sz / 2, y - sz / 2, sz, sz);
    }

    /* ---- ③ 星闪 star: 原地脉动 ---- */
    for (const p of stars) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawnStar(p, cfgV.star); continue; }
      const u = p.born / p.dur;
      const x = cx + p.x0 * W, y = cy + p.y0 * H;
      const sz = H * 0.075 * p.s * (1 + 0.35 * u);
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
