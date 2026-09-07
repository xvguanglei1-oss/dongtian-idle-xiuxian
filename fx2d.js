/* ============================================================
 * fx2d.js —— 玩家身上的特效流 v6
 * 依据反馈收敛:
 *   ✂ 移除 star(四角星"爆炸感") / smoke 全部
 *   ✔ 流光 streak 加粗加长, 可见的灵气流动
 *   ✔ 金尘 mote 缩小(<7px) 且密度大幅提高 → 细腻星尘感
 *   ✔ 全体降速(慢上浮+低频摆动) → 呼吸感
 *   ✔ 全局呼吸调制: 光点明暗随 ~0.45Hz 正弦轻微涨落
 *   ✔ 粒子只在角色躯干带内活动(不越屏不乱飞)
 * ============================================================ */
"use strict";

const safe = (v, fb = 0) => (Number.isFinite(v) ? v : fb);
const rnd = (a, b) => a + Math.random() * (b - a);
const easeIO = u => u * u * (3 - 2 * u);
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const WHITE = [255, 255, 255];

/* ---------- 境界视觉配置(数量大·动作慢·化神大胆) ---------- */
const REALM_VIS = [
  { t: [232, 210, 156], s: [255, 246, 214], gold: .5,
    mote:   { n: 16, pk: .36, dur: [3.0, 4.2] },
    streak: { n: 1,  pk: .56, dur: [2.3, 3.1] },
    core: .10, haze: .08, beam: 0, ray: 0, rayA: 0 },
  { t: [128, 222, 255], s: [226, 250, 255], gold: .45,
    mote:   { n: 32, pk: .48, dur: [2.8, 4.0] },
    streak: { n: 3,  pk: .66, dur: [2.1, 2.9] },
    core: .14, haze: .11, beam: 0, ray: 0, rayA: 0 },
  { t: [108, 218, 200], s: [178, 252, 226], gold: .55,
    mote:   { n: 48, pk: .56, dur: [2.6, 3.8] },
    streak: { n: 4,  pk: .72, dur: [2.0, 2.8] },
    core: .18, haze: .14, beam: 0, ray: 0, rayA: 0 },
  { t: [250, 202, 108], s: [255, 244, 200], gold: .7,
    mote:   { n: 66, pk: .62, dur: [2.4, 3.6] },
    streak: { n: 5,  pk: .76, dur: [1.9, 2.7] },
    core: .22, haze: .17, beam: .30, ray: 0, rayA: 0 },
  { t: [206, 168, 255], s: [255, 228, 162], gold: .6,
    mote:   { n: 90, pk: .68, dur: [2.2, 3.4] },
    streak: { n: 6,  pk: .80, dur: [1.8, 2.6] },
    core: .26, haze: .20, beam: .36, ray: 3, rayA: .05 },
  { t: [120, 216, 255], s: [255, 230, 150], gold: .78,
    mote:   { n: 132, pk: .76, dur: [2.0, 3.2] },
    streak: { n: 8,  pk: .86, dur: [1.7, 2.5] },
    core: .30, haze: .24, beam: .42, ray: 5, rayA: .07 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];

/* ---------- 柔光贴图 ---------- */
const TEX = {
  haze: "assets/fx/fx_bloom_haze_soft.png",
  core: "assets/fx/fx_bloom_core_soft.png",
  ray:  "assets/fx/fx_bloom_ray_soft.png",
  beam: "assets/fx/fx_gold_beam_soft.png",
  streak: "assets/fx/fx_gold_streak.png",
  mote: "assets/fx/fx_gold_mote.png",
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
/* 流光专用配色: 亮色为主(保证可见), 少量白珠光 */
function pickStreak(seed, t, s) {
  const r = (seed * 2654435761 % 100 + 100) % 100;
  if (r < 18) return t;
  if (r < 72) return s;
  return WHITE;
}
/* 金尘配色: gold 权重决定金色(亮色)占比, 化神高 → 金光粒子多 */
function pickMote(seed, t, s, gold) {
  const r = (seed * 2654435761 % 100 + 100) % 100;
  const gw = (gold == null) ? 0.5 : gold;
  if (r < gw * 100) return s;
  return t;
}
/* 三段透明度: 峰0.32, 缓落(慢呼吸) */
function prof(x) {
  if (x <= 0 || x >= 1) return 0;
  if (x < 0.32) { const u = x / 0.32; return u * u * (3 - 2 * u); }
  if (x < 0.8) { const u = (x - 0.32) / 0.48; return 1 - 0.38 * u; }
  const u = (x - 0.8) / 0.2;
  return (1 - u) * (1 - u);
}

/* ============================================================
 * 引擎
 * ============================================================ */
function initFx(canvas) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, ready = false;
  let motes = [], streaks = [];

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

  /* 金尘: 细碎小点, 慢飘 */
  function mkMote(cfgV) {
    return {
      dur: rnd(cfgV.dur[0], cfgV.dur[1]), born: 0,
      seed: Math.floor(rnd(0, 1e6)),
      y0: rnd(-0.04, 0.13), rise: rnd(0.10, 0.20),
      x0: rnd(-0.22, 0.22),
      ph: rnd(0, 6.28), ph2: rnd(0, 6.28),
      f: rnd(0.55, 1.0), f2: rnd(1.1, 1.8),   // 低频 → 慢
      amp: rnd(0.010, 0.024), s0: rnd(0.8, 1.3),
    };
  }
  function prepare(cfgV) {
    while (motes.length < cfgV.mote.n) motes.push(mkMote(cfgV.mote));
    while (streaks.length < cfgV.streak.n) streaks.push(mkStreak(cfgV.streak));
    motes.length = cfgV.mote.n; streaks.length = cfgV.streak.n;
  }
  function respawnP(p, cfgV) {
    p.born = -rnd(0.8, 2.4);
    p.dur = rnd(cfgV.dur[0], cfgV.dur[1]);
    p.seed = Math.floor(rnd(0, 1e6));
  }
  function respawnMote(p, cfgV) {
    respawnP(p, cfgV);
    p.y0 = rnd(-0.04, 0.13); p.rise = rnd(0.10, 0.20);
    p.x0 = rnd(-0.22, 0.22); p.ph = rnd(0, 6.28); p.ph2 = rnd(0, 6.28);
    p.f = rnd(0.55, 1.0); p.f2 = rnd(1.1, 1.8);
    p.amp = rnd(0.010, 0.024); p.s0 = rnd(0.8, 1.3);
  }

  /* 流光: 流线尾迹(教程经典做法·丝滑) — 每道是一颗移动的
     光点沿蜿蜒路径上浮, 逐帧记录路径(trace), 画成:
     尾→头 线性渐变的柔光细线(外层halo+内层亮芯+圆帽),
     方向恒朝上但轨迹带低频曲率, 丝滑无接缝。 */
  function mkStreak() {
    const lane = streaks.length;
    const p = { lane, dur: rnd(2.6, 3.6), born: -rnd(0, 2.0),
      seed: Math.floor(rnd(0, 1e6)), ph: rnd(0, 6.28), ph2: rnd(0, 6.28),
      f1: rnd(0.7, 1.3), f2: rnd(1.8, 2.8),
      amp: rnd(0.012, 0.026), trace: [], len: rnd(0.95, 1.15) };
    return p;
  }
  function respawnStreak(p) {
    p.born = -rnd(1.2, 2.8);
    p.dur = rnd(2.6, 3.6);
    p.seed = Math.floor(rnd(0, 1e6));
    p.ph = rnd(0, 6.28); p.ph2 = rnd(0, 6.28);
    p.f1 = rnd(0.7, 1.3); p.f2 = rnd(1.8, 2.8);
    p.amp = rnd(0.012, 0.026);
    p.trace = []; p.len = rnd(0.95, 1.15);
  }

  function draw(t, dt) {
    if (!ready || !imgs.haze) return;
    if (!Number.isFinite(W) || W < 1 || H < 1) return;
    const cfgV = REALM_VIS[idx()];
    try { ctx.clearRect(0, 0, W, H); } catch (e) { return; }
    ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.50;
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.8);       // 慢呼吸
    const breathe2 = 0.88 + 0.12 * Math.sin(t * 0.45);   // 粒子明暗呼吸
    const tCol = cfgV.t, sCol = cfgV.s;

    /* 0) 背后柔光(静态呼吸) + 光柱 + 放射 */
    const hazeCv = tinted("haze", tCol);
    if (hazeCv && cfgV.haze > 0.01) {
      const sz = W * (0.60 + 0.07 * breathe);
      ctx.globalAlpha = safe(cfgV.haze * (0.7 + 0.3 * breathe), 0);
      ctx.drawImage(hazeCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    const coreCv = tinted("core", sCol);
    if (coreCv && cfgV.core > 0.01) {
      const sz = W * (0.28 + 0.05 * breathe);
      ctx.globalAlpha = safe(cfgV.core * (0.6 + 0.4 * breathe), 0);
      ctx.drawImage(coreCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    if (cfgV.beam > 0.01) {
      const bCv = tinted("beam", sCol);
      if (bCv) {
        const bw = W * 0.03 * (1 + 0.18 * breathe);
        const bh = H * 0.34 * (1 + 0.05 * breathe);
        ctx.globalAlpha = safe(cfgV.beam * (0.5 + 0.5 * breathe), 0);
        ctx.drawImage(bCv, cx - bw / 2, cy - bh * 0.5, bw, bh);
      }
    }
    if (cfgV.ray > 0 && imgs.ray) {
      const rCv = tinted("ray", sCol);
      if (rCv) {
        for (let i = 0; i < cfgV.ray; i++) {
          const ang = (i / Math.max(1, cfgV.ray - 1) - 0.5) * 1.4 + Math.sin(t * 0.2 + i) * 0.05;
          const len = W * 0.24;
          ctx.save();
          ctx.translate(cx, cy - H * 0.12);
          ctx.rotate(ang);
          ctx.globalAlpha = safe(cfgV.rayA * (0.55 + 0.45 * Math.sin(t * 0.35 + i * 1.7)), 0);
          ctx.drawImage(rCv, -len * 0.2, -len * 0.5, len * 0.4, len);
          ctx.restore();
        }
      }
    }

    /* ---- ① 金尘: 细碎星尘(小+密), 极慢飘浮, 呼吸明暗 ---- */
    for (const p of motes) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawnMote(p, cfgV.mote); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      const drift = Math.sin(t * p.f + p.ph) * p.amp + Math.sin(t * p.f2 + p.ph2) * p.amp * 0.5;
      const x = cx + (p.x0 + drift * (1 + mv)) * W;
      const y = cy + (p.y0 - p.rise * mv) * H + Math.sin(t * 1.0 + p.ph2) * H * 0.004;
      const sz = H * 0.016 * p.s0 * (1 - 0.28 * u);     // <7px 细碎
      const col = pickMote(p.seed, tCol, sCol, cfgV.gold);
      const al = safe(prof(u) * cfgV.mote.pk * breathe2, 0);
      ctx.globalAlpha = al;
      const ic = tinted("mote", col);
      if (ic) ctx.drawImage(ic, x - sz / 2, y - sz / 2, sz, sz);
    }

    /* ---- ② 流光(精修·自然流线): 数道灵气沿"外→中"微微汇聚的
       斜流车道, 自腰侧向百会升腾。每道=运动光点+逐帧轨迹,
       渲染: 尾→头 smoothstep 渐变 + 柔光外晕/中亮层/头部白芯
       + 柔光圆头 + 沿线细尘点缀 → 绵长丝滑又细腻。 */
    if (cfgV.streak.n) {
      const lanes = cfgV.streak.n;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const sweep = 0.24;                 // 车道从身侧向内收束的比例
      for (const p of streaks) {
        p.born += dt;
        if (p.born < 0) continue;
        if (p.born > p.dur) { respawnStreak(p); continue; }
        const u = p.born / p.dur;
        const col = pickStreak(p.seed, tCol, sCol);
        /* 升腾: 腰侧→头顶前 */
        const headY = H * (0.82 - 0.56 * u);
        const fadeTop = ss(0.80, 0.98, u);          // 尾部20%行程淡出
        const base = prof(u) * cfgV.streak.pk * breathe2 * fadeTop * 1.35;
        const al = Math.min(1, safe(base, 0));
        if (al <= 0.012) continue;
        /* 车道: 起点均匀分布身侧, 高度越高越向内收(百会汇聚) */
        const off = lanes > 1 ? (p.lane / (lanes - 1)) * 2 - 1 : 0;
        const laneBase = cx + off * W * 0.17;
        const tHi = (0.82 - (headY / H)) / 0.56;     // 0底..1顶
        const xNow = laneBase - off * W * sweep * tHi;
        /* 低幅蜿蜒(自然, 不明显摆动) */
        const sway = (Math.sin(t * p.f1 + p.ph) + 0.5 * Math.sin(t * p.f2 + p.ph2))
                     * p.amp * W * 0.6;
        const x = xNow + sway;
        /* 轨迹 */
        p.trace.unshift({ x, y: headY });
        if (p.trace.length > 42) p.trace.length = 42;
        if (p.trace.length < 2) continue;
        const n = p.trace.length;
        const Hp = p.trace[0], Tp = p.trace[n - 1];
        const mkrgb = (a, b, o, rgb) => "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + (a * o) + ")";
        /* ---- 层1: 柔光外晕(整条, 尾淡头亮) */
        let g = ctx.createLinearGradient(Tp.x, Tp.y, Hp.x, Hp.y);
        g.addColorStop(0, mkrgb(0, 1, 1, col));
        g.addColorStop(0.5, mkrgb(0.14 * al, 1, 1, col));
        g.addColorStop(0.85, mkrgb(0.30 * al, 1, 1, col));
        g.addColorStop(1, mkrgb(0.5 * al, 1, 1, col));
        ctx.strokeStyle = g; ctx.lineWidth = H * 0.012;
        ctx.beginPath(); ctx.moveTo(Tp.x, Tp.y);
        for (let i = n - 2; i >= 0; i--) ctx.lineTo(p.trace[i].x, p.trace[i].y);
        ctx.stroke();
        /* ---- 层2: 中亮色芯 */
        g = ctx.createLinearGradient(Tp.x, Tp.y, Hp.x, Hp.y);
        g.addColorStop(0, mkrgb(0, 1, 1, col));
        g.addColorStop(0.6, mkrgb(0.5 * al, 1, 1, col));
        g.addColorStop(1, mkrgb(0.85 * al, 1, 1, col));
        ctx.strokeStyle = g; ctx.lineWidth = H * 0.0044;
        ctx.beginPath(); ctx.moveTo(Tp.x, Tp.y);
        for (let i = n - 2; i >= 0; i--) ctx.lineTo(p.trace[i].x, p.trace[i].y);
        ctx.stroke();
        /* ---- 层3: 头部 ~1/3 段的白亮高光 */
        const cut = Math.max(1, Math.floor(n * 0.32));
        const hP = p.trace[0], cP = p.trace[cut - 1];
        g = ctx.createLinearGradient(cP.x, cP.y, hP.x, hP.y);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(1, "rgba(255,255,255," + (0.7 * al) + ")");
        ctx.strokeStyle = g; ctx.lineWidth = H * 0.0024;
        ctx.beginPath();
        for (let i = cut - 1; i >= 0; i--) i === cut - 1 ? ctx.moveTo(p.trace[i].x, p.trace[i].y) : ctx.lineTo(p.trace[i].x, p.trace[i].y);
        ctx.stroke();
        /* ---- 沿线细尘点缀(每4点一颗, 柔和粒子感) */
        for (let i = 0; i < n; i += 4) {
          const qp = p.trace[i];
          const fade = 1 - i / n;
          const sz = H * 0.009 * fade;
          ctx.globalAlpha = al * (0.5 + 0.5 * fade) * 0.5;
          const ic2 = tinted("mote", col);
          if (ic2) ctx.drawImage(ic2, qp.x - sz / 2, qp.y - sz / 2, sz, sz);
        }
        /* ---- 柔光圆头(小, 柔和) */
        ctx.globalAlpha = al * 0.85;
        const hs = H * 0.022;
        const hc = tinted("mote", [255, 255, 255]);
        if (hc) ctx.drawImage(hc, Hp.x - hs / 2, Hp.y - hs / 2, hs, hs);
        ctx.globalAlpha = 1;
      }
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
    } catch (e) {
      if (!window.__fxErr) window.__fxErr = "fx2d: " + (e && e.message || e);
    }
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

export { initFx, REALM_VIS, BIG_NAMES };
