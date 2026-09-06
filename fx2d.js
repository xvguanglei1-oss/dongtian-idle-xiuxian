/* ============================================================
 * fx2d.js —— 玩家身上的特效流 v3 (复刻 Unity 仓库参考:
 *   CultivationBloomAura.ts / PlayerBodyAuraStatic.ts)
 * 铁律: 一切粒子只在角色躯干范围(屏内 y 0.12~0.62H)活动,
 *       绝不从画面外飞入; 数量克制; 尺寸小; 贴身体飘动。
 * 元素: haze/core 背后柔光晕(呼吸) · 光柱beam(弱) · 放射ray(弱)
 *       烟缕smoke(贴身上飘拉丝) · 流光streak(细条快穿)
 *       金尘mote(小点乱舞上浮) · 星闪star(原地一闪)
 * 流动感: 三段透明度吐息 + sin摆动路径 + 缩放缓动
 * ============================================================ */
"use strict";

const safe = (v, fb = 0) => (Number.isFinite(v) ? v : fb);

/* ---------- 境界视觉配置(数量克制, 靠颜色/亮度/元素差异) ---------- */
const REALM_VIS = [
  /*        t(主色)      s(点缀)     aura     smoke             mote          streak       star        core haze beam ray */
  { t: [224, 204, 158], s: [178, 160, 116], a: "rgba(224,204,158,.18)",
    smoke: { n: 1, sMin: .8, sMax: 1.0, pk: .16, dur: [2.6, 3.6] },
    mote:  { n: 2, pk: .20, dur: [1.6, 2.4] },
    streak:{ n: 0, pk: .0, dur: [1.0, 1.4] },
    star:  { n: 0, pk: .0, dur: [.5, .8] },
    core: .10, haze: .09, beam: 0, ray: 0, rayA: 0 },
  { t: [150, 226, 255], s: [206, 244, 255], a: "rgba(150,226,255,.20)",
    smoke: { n: 1, sMin: .8, sMax: 1.0, pk: .22, dur: [2.4, 3.4] },
    mote:  { n: 3, pk: .28, dur: [1.5, 2.2] },
    streak:{ n: 1, pk: .26, dur: [1.0, 1.5] },
    star:  { n: 0, pk: .0, dur: [.5, .8] },
    core: .14, haze: .11, beam: 0, ray: 0, rayA: 0 },
  { t: [120, 218, 200], s: [176, 246, 214], a: "rgba(120,218,200,.24)",
    smoke: { n: 2, sMin: .8, sMax: 1.05, pk: .28, dur: [2.2, 3.2] },
    mote:  { n: 5, pk: .34, dur: [1.4, 2.1] },
    streak:{ n: 1, pk: .32, dur: [1.0, 1.5] },
    star:  { n: 1, pk: .50, dur: [.5, .8] },
    core: .18, haze: .14, beam: 0, ray: 0, rayA: 0 },
  { t: [250, 210, 126], s: [255, 238, 186], a: "rgba(250,210,126,.30)",
    smoke: { n: 2, sMin: .85, sMax: 1.1, pk: .34, dur: [2.0, 3.0] },
    mote:  { n: 6, pk: .42, dur: [1.3, 2.0] },
    streak:{ n: 2, pk: .40, dur: [1.0, 1.5] },
    star:  { n: 1, pk: .55, dur: [.45, .8] },
    core: .22, haze: .18, beam: .30, ray: 0, rayA: 0 },
  { t: [210, 176, 255], s: [255, 224, 156], a: "rgba(210,176,255,.34)",
    smoke: { n: 2, sMin: .85, sMax: 1.1, pk: .40, dur: [1.9, 2.9] },
    mote:  { n: 8, pk: .48, dur: [1.2, 1.9] },
    streak:{ n: 2, pk: .46, dur: [.9, 1.4] },
    star:  { n: 2, pk: .62, dur: [.45, .8] },
    core: .26, haze: .20, beam: .36, ray: 3, rayA: .05 },
  { t: [120, 216, 255], s: [255, 226, 148], a: "rgba(120,216,255,.40)",
    smoke: { n: 3, sMin: .85, sMax: 1.15, pk: .46, dur: [1.8, 2.8] },
    mote:  { n: 9, pk: .54, dur: [1.1, 1.8] },
    streak:{ n: 3, pk: .52, dur: [.85, 1.4] },
    star:  { n: 3, pk: .68, dur: [.4, .75] },
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
  if (x < 0.75) { const u = (x - 0.3) / 0.45; return 1 - 0.35 * u; }
  const u = (x - 0.75) / 0.25;
  return (1 - u) * (1 - u);
}
const rnd = (a, b) => a + Math.random() * (b - a);
/* 缓动: 位置用 easeInOut 让粒子缓慢起止, 不冲 */
const easeIO = u => u * u * (3 - 2 * u);

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

  /* 上飘型粒子: 出生带在躯干下部(相对角色中心 cy≈0.52H), 只在体内上浮 */
  function mkRise(cfgV, withTilt) {
    return {
      dur: rnd(cfgV.dur[0], cfgV.dur[1]),
      born: 0,
      y0: rnd(0.02, 0.11),          // 起点: cy + y0*H (腰/腿侧, 屏内)
      rise: rnd(0.17, 0.30),        // 上浮: 终点 cy+(y0-rise)H → 胸/颈, 全程屏内
      x0: rnd(-0.16, 0.16),         // 角色身体宽内
      amp: rnd(0.008, 0.022),       // sin 摆动幅度(小, 只是摇曳不飞)
      ph: rnd(0, 6.28),
      f: rnd(0.8, 1.7),
      s0: rnd(0.8, 1.05),
      tilt: withTilt ? rnd(-0.06, 0.06) : 0,
      seed: Math.floor(rnd(0, 10)),
    };
  }
  function mkStar() {
    return {
      dur: rnd(0.45, 0.8), born: 0,
      x0: rnd(-0.20, 0.20), y0: rnd(-0.06, 0.16),
      s: rnd(0.05, 0.10), ang: rnd(0, 3.14), rot: rnd(-0.5, 0.5), pk: rnd(0.8, 1.1),
    };
  }
  function respawn(p, cfgV, t0) {
    p.born = -rnd(0.5, 1.8);
    p.y0 = rnd(0.02, 0.11); p.rise = rnd(0.17, 0.30);
    p.x0 = rnd(-0.16, 0.16); p.ph = rnd(0, 6.28);
    p.f = rnd(0.8, 1.7); p.dur = rnd(cfgV.dur[0], cfgV.dur[1]);
    p.amp = rnd(0.008, 0.022); p.s0 = rnd(0.8, 1.05);
    p.seed = Math.floor(rnd(0, 10));
  }
  function prepare(cfgV) {
    while (smokes.length < cfgV.smoke.n) smokes.push(mkRise(cfgV.smoke, true));
    while (motes.length < cfgV.mote.n) motes.push(mkRise(cfgV.mote, false));
    while (streaks.length < cfgV.streak.n) streaks.push(mkRise(cfgV.streak, true));
    while (stars.length < cfgV.star.n) stars.push(mkStar());
    smokes.length = cfgV.smoke.n; motes.length = cfgV.mote.n;
    streaks.length = cfgV.streak.n; stars.length = cfgV.star.n;
  }

  function draw(t, dt) {
    if (!ready || !imgs.haze) return;
    if (!Number.isFinite(W) || W < 1 || H < 1) return;
    const cfgV = REALM_VIS[idx()];
    try { ctx.clearRect(0, 0, W, H); } catch (e) { return; }
    ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.50;        // 角色胸腔基准
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.1);

    /* 0) 背后柔光晕(静态呼吸, 不乱动) */
    const hazeCv = tinted("haze", cfgV.t);
    if (hazeCv && cfgV.haze > 0.01) {
      const sz = W * (0.60 + 0.06 * breathe);
      ctx.globalAlpha = safe(cfgV.haze * (0.7 + 0.3 * breathe), 0);
      ctx.drawImage(hazeCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    const coreCv = tinted("core", cfgV.s);
    if (coreCv && cfgV.core > 0.01) {
      const sz = W * (0.30 + 0.05 * breathe);
      ctx.globalAlpha = safe(cfgV.core * (0.65 + 0.35 * breathe), 0);
      ctx.drawImage(coreCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }

    /* 0.5) 弱光柱(结丹+)：从腰部向上短柱, 弱而静 */
    if (cfgV.beam > 0.01) {
      const bCv = tinted("beam", cfgV.s);
      if (bCv) {
        const bw = W * 0.030 * (1 + 0.2 * breathe);
        const bh = H * 0.36 * (1 + 0.06 * breathe);
        ctx.globalAlpha = safe(cfgV.beam * (0.5 + 0.5 * breathe), 0);
        ctx.drawImage(bCv, cx - bw / 2, cy - bh * 0.45, bw, bh);
      }
    }

    /* 0.7) 放射光(元婴+)：角色头顶一小圈弱芒, 慢摆低透明度 */
    if (cfgV.ray > 0 && imgs.ray) {
      const rCv = tinted("ray", cfgV.t);
      if (rCv) {
        for (let i = 0; i < cfgV.ray; i++) {
          const ang = (i / Math.max(1, cfgV.ray - 1) - 0.5) * 1.6 + Math.sin(t * 0.25 + i) * 0.04;
          const len = W * 0.30;
          ctx.save();
          ctx.translate(cx, cy - H * 0.10);
          ctx.rotate(ang);
          ctx.globalAlpha = safe(cfgV.rayA * (0.6 + 0.4 * Math.sin(t * 0.4 + i * 1.7)), 0);
          ctx.drawImage(rCv, -len * 0.25, -len * 0.5, len * 0.5, len);
          ctx.restore();
        }
      }
    }

    /* ① 烟缕: 贴身上飘, 慢, 拉丝散开 */
    for (const p of smokes) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawn(p, cfgV.smoke, t); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      const x = cx + (p.x0 + Math.sin(t * p.f + p.ph) * p.amp) * W;
      const y = cy + (p.y0 - p.rise * mv) * H;
      const bh0 = H * 0.055 * p.s0;
      const bw0 = bh0 * (0.38 + 0.34 * mv);
      const al = safe(prof(u) * cfgV.smoke.pk, 0);
      ctx.globalAlpha = al;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.tilt * (1 - mv * 0.5));
      const c1 = p.col || cfgV.t, c2 = cfgV.s;
      const ic = tinted("smoke", (p.seed % 5 === 0) ? c2 : c1);
      if (ic) ctx.drawImage(ic, -bw0 / 2, -bh0 / 2, bw0, bh0);
      ctx.restore();
    }

    /* ② 流光: 细条, 贴体快穿(上升快, 只留短光轨) */
    for (const p of streaks) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawn(p, cfgV.streak, t); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      const x = cx + (p.x0 + Math.sin(t * p.f + p.ph) * p.amp * 0.6) * W;
      const y = cy + (p.y0 - p.rise * mv) * H;
      const len = H * 0.075 * (1 + 0.4 * u) * p.s0;
      const wid = len * 0.22;
      const al = safe(prof(u) * cfgV.streak.pk, 0);
      ctx.globalAlpha = al;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.tilt);
      const ic = tinted("streak", (p.seed % 4 === 0) ? cfgV.s : cfgV.t);
      if (ic) ctx.drawImage(ic, -wid / 2, -len / 2, wid, len);
      ctx.restore();
    }

    /* ③ 金尘: 小点, 贴体乱舞上浮(幅度小) */
    for (const p of motes) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) { respawn(p, cfgV.mote, t); continue; }
      const u = p.born / p.dur, mv = easeIO(u);
      const sway = Math.sin(t * p.f * 2.1 + p.ph) * p.amp * (0.5 + mv);
      const x = cx + (p.x0 + sway) * W;
      const y = cy + (p.y0 - p.rise * 0.8 * mv) * H;
      const sz = H * 0.030 * p.s0 * (1 - 0.4 * u);
      const al = safe(prof(u) * cfgV.mote.pk, 0);
      ctx.globalAlpha = al;
      const ic = tinted("mote", (p.seed % 5 === 0) ? cfgV.s : cfgV.t);
      if (ic) ctx.drawImage(ic, x - sz / 2, y - sz / 2, sz, sz);
    }

    /* ④ 星闪: 原地小闪, 不放飞 */
    for (const p of stars) {
      p.born += dt;
      if (p.born < 0) continue;
      if (p.born > p.dur) {
        p.born = -rnd(1.2, 2.6);
        p.x0 = rnd(-0.18, 0.18); p.y0 = rnd(-0.10, 0.14); p.s = rnd(0.05, 0.10);
        continue;
      }
      const u = p.born / p.dur;
      const x = cx + p.x0 * W, y = cy + p.y0 * H;
      const sz = H * 0.10 * p.s * (1 + 0.35 * u);
      const al = safe(prof(u) * cfgV.star.pk * p.pk, 0);
      ctx.globalAlpha = al;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.ang + p.rot * u);
      const ic = tinted("star", cfgV.s);
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
