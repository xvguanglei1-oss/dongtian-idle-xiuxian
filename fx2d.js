/* ============================================================
 * fx2d.js —— 玩家身上的特效流 (复刻 Unity 仓库参考:
 *   CultivationBloomAura.ts / PlayerBodyAuraStatic.ts)
 * 全部使用真柔光贴图(assets/fx/fx_*.png), 非几何圆点:
 *   haze/core 柔光晕(角色背后呼吸) · ray/beam 光束 · smoke 烟缕
 *   streak 流光 · mote 金尘 · star 星闪
 * 流动感来源:
 *   ① 三段式透明度吐息(0→峰→谷→0)  ② sin 摆动路径(非直线)
 *   ③ 缩放缓动(smoke 拉长 / mote 收小 / star 放大)
 * 所有数值 safe() 兜底, 永不崩溃; WebGL 零依赖。
 * ============================================================ */
"use strict";

const safe = (v, fb = 0) => (Number.isFinite(v) ? v : fb);

/* ---------- 境界配色(主色/点缀/背后光晕) ---------- */
const REALM_VIS = [
  { t: [228, 210, 160], s: [180, 160, 110], aura: "rgba(228,210,160,.26)",
    smoke: { n: 1, sMin: .5,  sMax: .9,  pk: .26, dur: [2.4, 3.4] },
    mote:  { n: 2, pk: .30, dur: [1.6, 2.4] },
    streak:{ n: 0, pk: .0, dur: [1.0, 1.4] },
    star:  { n: 0, pk: .0, dur: [.5, .8] },
    core: .10, haze: .10, beam: 0, ray: 0, rayA: 0, glow: 2.6 },
  { t: [140, 226, 255], s: [200, 244, 255], aura: "rgba(140,226,255,.30)",
    smoke: { n: 2, sMin: .6,  sMax: 1.0,  pk: .34, dur: [2.2, 3.2] },
    mote:  { n: 5, pk: .40, dur: [1.4, 2.2] },
    streak:{ n: 1, pk: .34, dur: [1.0, 1.5] },
    star:  { n: 1, pk: .5, dur: [.5, .85] },
    core: .16, haze: .12, beam: 0, ray: 0, rayA: 0, glow: 3.0 },
  { t: [110, 216, 200], s: [170, 244, 210], aura: "rgba(110,216,200,.34)",
    smoke: { n: 2, sMin: .65, sMax: 1.05, pk: .40, dur: [2.0, 3.0] },
    mote:  { n: 7, pk: .46, dur: [1.3, 2.0] },
    streak:{ n: 2, pk: .42, dur: [.95, 1.5] },
    star:  { n: 1, pk: .55, dur: [.45, .8] },
    core: .20, haze: .16, beam: 0, ray: 0, rayA: 0, glow: 3.4 },
  { t: [250, 208, 120], s: [255, 236, 180], aura: "rgba(250,208,120,.40)",
    smoke: { n: 2, sMin: .7,  sMax: 1.1,  pk: .48, dur: [1.9, 2.9] },
    mote:  { n: 9, pk: .54, dur: [1.2, 1.9] },
    streak:{ n: 3, pk: .52, dur: [.9, 1.45] },
    star:  { n: 2, pk: .6, dur: [.45, .8] },
    core: .26, haze: .20, beam: .5, ray: 0, rayA: 0, glow: 3.8 },
  { t: [205, 170, 255], s: [255, 220, 150], aura: "rgba(205,170,255,.46)",
    smoke: { n: 3, sMin: .75, sMax: 1.15, pk: .54, dur: [1.8, 2.8] },
    mote:  { n: 11, pk: .6, dur: [1.1, 1.8] },
    streak:{ n: 3, pk: .6, dur: [.85, 1.4] },
    star:  { n: 3, pk: .68, dur: [.45, .8] },
    core: .30, haze: .24, beam: .6, ray: 3, rayA: .10, glow: 4.2 },
  { t: [110, 214, 255], s: [255, 222, 140], aura: "rgba(140,226,255,.52)",
    smoke: { n: 3, sMin: .8,  sMax: 1.2,  pk: .62, dur: [1.7, 2.7] },
    mote:  { n: 13, pk: .68, dur: [1.0, 1.7] },
    streak:{ n: 4, pk: .68, dur: [.8, 1.35] },
    star:  { n: 4, pk: .75, dur: [.4, .75] },
    core: .34, haze: .28, beam: .7, ray: 5, rayA: .14, glow: 4.8 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];

/* ---------- 柔光贴图加载 ---------- */
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
      im.onerror = () => { imgs[k] = null; res(); };  // 个别缺失也不阻塞
      im.src = TEX[k];
    })));
}

/* ---------- 染色精灵缓存(source-in) ---------- */
let _white2 = null;
function tinted(keyTex, color) {
  const ck = keyTex + "_" + color.join(",");
  const cache = (tinted._c = tinted._c || {});
  if (cache[ck]) return cache[ck];
  const src = imgs[keyTex];
  if (!src) return null;
  const cv = document.createElement("canvas");
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext("2d");
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
  g.fillRect(0, 0, cv.width, cv.height);
  cache[ck] = cv;
  return cv;
}

/* ---------- 透明度三段曲线: x 0..1 → 0..1 (峰0.25, 谷0.68) ---------- */
function prof(x) {
  if (x <= 0 || x >= 1) return 0;
  if (x < 0.25) { const u = x / 0.25; return u * u * (3 - 2 * u); }
  if (x < 0.68) { const u = (x - 0.25) / 0.43; return 1 - 0.4 * Math.sin(u * Math.PI * 0.5); }
  const u = (x - 0.68) / 0.32;
  return (1 - u) * (1 - u);
}

/* 流畅随机数 */
const rnd = (a, b) => a + Math.random() * (b - a);

/* ============================================================
 * 引擎主体
 * ============================================================ */
function initFx(canvas) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, ready = false, cur = 0;

  // 上飘粒子池
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

  /* 生成一个"周期粒子": 上飘型(烟/流光/尘) */
  function mkRise(type, cfgV, col, col2) {
    const y0 = rnd(0.74, 0.96);          // 出生带: 脚下
    return {
      type, col, col2,
      dur: rnd(cfgV.dur[0], cfgV.dur[1]),
      born: 0,                             // 已出生时间(s), 负=等待
      x0: rnd(-0.30, 0.30),                // 相对中心横向偏移(身体宽内)
      y0,
      rise: rnd(0.42, 0.62),               // 上升高度(占 H)
      amp: rnd(0.018, 0.05),               // sin 摆动幅度
      ph: rnd(0, 6.28),
      f: rnd(0.7, 1.6),                    // 摆动频率
      s0: rnd(0.7, 1.0),                   // 缩放起点系数
      tilt: rnd(-0.10, 0.10),              // 轻微倾斜(rad)
      spdScale: rnd(0.85, 1.2),
    };
  }
  /* 星闪 */
  function mkStar(cfgV) {
    return {
      dur: rnd(cfgV.star.dur[0], cfgV.star.dur[1]),
      born: 0, x0: rnd(-0.34, 0.30), y0: rnd(-0.26, 0.10),
      s: rnd(0.05, 0.11), ang: rnd(0, 3.14), rot: rnd(-0.6, 0.6),
      pk: rnd(0.8, 1.2),
    };
  }

  function respawn(p, v, cfgV) {
    p.born = -rnd(0.4, 1.6);               // 下一轮随机间隔
    p.x0 = rnd(-0.30, 0.30); p.ph = rnd(0, 6.28);
    p.f = rnd(0.7, 1.6); p.dur = rnd(cfgV.dur[0], cfgV.dur[1]);
    p.amp = rnd(0.018, 0.05);
    p.rise = rnd(0.42, 0.62);
    p.s0 = rnd(0.7, 1.0);
    p.tilt = rnd(-0.10, 0.10);
  }

  function prepare(cfgV) {
    const t = cfgV.t, s = cfgV.s;
    const targetS = cfgV.smoke.n, targetM = cfgV.mote.n,
          targetK = cfgV.streak.n, targetSt = cfgV.star.n;
    while (smokes.length < targetS) smokes.push(mkRise("smoke", cfgV.smoke, t, s));
    while (motes.length < targetM) motes.push(mkRise("mote", cfgV.mote, t, s));
    while (streaks.length < targetK) streaks.push(mkRise("streak", cfgV.streak, t, s));
    while (stars.length < targetSt) stars.push(mkStar(cfgV));
    smokes.length = targetS; motes.length = targetM;
    streaks.length = targetK; stars.length = targetSt;
  }

  function draw(t, dt) {
    if (!ready || !imgs.haze) return;
    if (!Number.isFinite(W) || W < 1 || H < 1) return;
    const cfgV = REALM_VIS[idx()];
    try { ctx.clearRect(0, 0, W, H); } catch (e) { return; }
    ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.52;

    /* 0) 背后柔光晕 haze + core(呼吸) */
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.1);
    const hazeCv = tinted("haze", cfgV.t);
    if (hazeCv && cfgV.haze > 0.01) {
      const sz = W * (0.55 + 0.12 * breathe);
      ctx.globalAlpha = safe(cfgV.haze * (0.55 + 0.45 * breathe), 0);
      ctx.drawImage(hazeCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    const coreCv = tinted("core", cfgV.s);
    if (coreCv && cfgV.core > 0.01) {
      const sz = W * (0.26 + 0.05 * breathe);
      ctx.globalAlpha = safe(cfgV.core * (0.6 + 0.4 * breathe), 0);
      ctx.drawImage(coreCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }

    /* 背后竖立光柱 beam(境界 ≥ 结丹) */
    if (cfgV.beam > 0.01) {
      const bCv = tinted("beam", cfgV.s);
      if (bCv) {
        const bw = W * 0.045 * (1 + 0.2 * breathe);
        const bh = H * 0.62 * (1 + 0.1 * breathe);
        ctx.globalAlpha = safe(cfgV.beam * 0.5 * (0.5 + 0.5 * breathe), 0);
        ctx.drawImage(bCv, cx - bw / 2, cy - bh * 0.72, bw, bh);
      }
    }

    /* 背后放射光束 ray(境界 ≥ 元婴, 头顶扇形, 缓摆) */
    if (cfgV.ray > 0 && imgs.ray) {
      const rCv = tinted("ray", cfgV.t);
      if (rCv) {
        const angles = [-1.35, -0.85, -0.4, 0, 0.4, 0.85, 1.35]; // 上方扇形
        for (let i = 0; i < cfgV.ray; i++) {
          const a = angles[(i * 2) % angles.length] + Math.sin(t * 0.35 + i) * 0.06;
          const len = W * 0.42;
          ctx.save();
          ctx.translate(cx, cy - H * 0.08);
          ctx.rotate(a);
          ctx.globalAlpha = safe(cfgV.rayA * (0.55 + 0.45 * Math.sin(t * 0.5 + i * 2)), 0);
          ctx.drawImage(rCv, -len * 0.5, -len * 0.5, len * 0.5, len);
          ctx.restore();
        }
      }
    }

    /* 1) 烟缕: 脚下出生, 上飘拉长, 横向 sin 扩散 */
    for (const p of smokes) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawn(p, 0, cfgV.smoke); continue; }
      const u = p.born / p.dur;
      const xx = cx + p.x0 * W + Math.sin(t * p.f + p.ph) * p.amp * W * u * 2;
      const yy = cy + (p.y0 - p.rise * u) * H;
      const baseH = H * (0.11 + 0.05 * p.s0);
      const baseW = baseH * (0.32 + 0.22 * u);      // 越飘越宽(散开)
      const al = safe(prof(u) * cfgV.smoke.pk, 0);
      ctx.globalAlpha = al;
      ctx.save();
      ctx.translate(xx, yy);
      ctx.rotate(p.tilt + u * 0.05);
      const c1 = p.col; const c2 = p.col2;
      const imgCv = tinted("smoke", (Math.random() < 0.25) ? c2 : c1);
      if (imgCv) ctx.drawImage(imgCv, -baseW / 2, -baseH / 2, baseW, baseH);
      ctx.restore();
    }

    /* 2) 流光: 细长条, 快穿上升 */
    for (const p of streaks) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawn(p, 0, cfgV.streak); continue; }
      const u = p.born / p.dur;
      const xx = cx + p.x0 * W + Math.sin(t * p.f + p.ph) * p.amp * W * 1.5;
      const yy = cy + (p.y0 - p.rise * u) * H;
      const len = H * (0.18 + 0.1 * p.s0) * (1 - 0.2 * u);
      const wid = len * 0.10;
      const al = safe(prof(u) * cfgV.streak.pk, 0);
      ctx.globalAlpha = al;
      ctx.save();
      ctx.translate(xx, yy);
      ctx.rotate(p.tilt + u * 0.08);
      const imgCv = tinted("streak", (Math.random() < 0.35) ? p.col2 : p.col);
      if (imgCv) ctx.drawImage(imgCv, -wid / 2, -len / 2, wid, len);
      ctx.restore();
    }

    /* 3) 金尘: 小点, 乱舞上飘+收小 */
    for (const p of motes) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawn(p, 0, cfgV.mote); continue; }
      const u = p.born / p.dur;
      const sway = Math.sin(t * p.f * 2.2 + p.ph) * p.amp * W * (0.5 + u);
      const xx = cx + p.x0 * W + sway * 1.6;
      const yy = cy + (p.y0 - p.rise * 0.8 * u) * H;
      const sz = H * 0.05 * p.s0 * (1 - 0.5 * u);
      const al = safe(prof(u) * cfgV.mote.pk, 0);
      ctx.globalAlpha = al;
      const imgCv = tinted("mote", (Math.random() < 0.3) ? p.col2 : p.col);
      if (imgCv) ctx.drawImage(imgCv, xx - sz / 2, yy - sz / 2, sz, sz);
    }

    /* 4) 星闪: 原地闪烁, 旋转变大消失 */
    for (const p of stars) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { p.born = -rnd(1.2, 2.6); p.x0 = rnd(-0.34, 0.30); p.y0 = rnd(-0.26, 0.10); p.s = rnd(0.05, 0.11); continue; }
      const u = p.born / p.dur;
      const xx = cx + p.x0 * W, yy = cy + p.y0 * H;
      const sz = H * 0.16 * p.s * (1 + 0.5 * u);
      const al = safe(prof(u) * cfgV.star.pk * p.pk, 0);
      ctx.globalAlpha = al;
      ctx.save();
      ctx.translate(xx, yy);
      ctx.rotate(p.ang + p.rot * u);
      const imgCv = tinted("star", p.col2 || p.col);
      if (imgCv) ctx.drawImage(imgCv, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = safe(Math.min(0.05, (now - last) / 1000), 0.02); last = now;
    prepare(REALM_VIS[idx()]);
    try { draw(now / 1000, dt); } catch (e) {}
  }

  loadAll().then(() => { ready = true; });
  cur = 0;
  prepare(REALM_VIS[0]);
  last = performance.now();
  raf = requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { last = performance.now(); }
  });
  return { destroy() { cancelAnimationFrame(raf); ro.disconnect(); } };
}

export { initFx };
