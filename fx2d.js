/* ============================================================
 * fx2d.js —— 玩家身上的特效 v8 · PNG 缓缓上升光带
 *
 * 反馈: v7 程序描边丝带"太长太细", 不像缓缓上升的光带 → 回退贴图方案。
 * 贴图选型(经像素剖面分析):
 *   fx_gold_streak.png   64x256 (有效 ~31x220) 竖向柔光流光条, 两端淡中段亮
 *   fx_bloom_ray_soft.png 128x512 竖向柔光柱, 更宽更柔 → 作外晕
 * 渲染要点:
 *   · 贴图"压短拉宽": 高 ~0.3H, 宽按境界条数自适应(总宽不糊成一片);
 *   · 三层叠加: 宽淡外晕(ray) + 主体(streak) + 亮芯, additive;
 *   · 缓缓上升: 全程 7~13s(呼吸感), 极小的摆动与旋转, 呼吸式伸缩;
 *   · 头尾用 alpha 淡入淡出, 贴图本身两端也淡 → 自然散没, 无蝌蚪头;
 *   · 无跨帧轨迹数组, 每帧按参数现算。
 * 保留已获认可的静态柔光/光环/光柱 + 细碎金尘(mote)。
 * ============================================================ */
"use strict";

const safe = (v, fb = 0) => (Number.isFinite(v) ? v : fb);
const rnd = (a, b) => a + Math.random() * (b - a);
const easeIO = u => u * u * (3 - 2 * u);
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const WHITE = [255, 255, 255];
const TWO_PI = 6.2831853;

/* ---------- 境界视觉配置(丝带数量·动作慢·化神大胆) ---------- */
const REALM_VIS = [
  /* 凡人: 一缕若有若无的气 */
  { t: [232, 210, 156], s: [255, 246, 214], gold: .5,
    mote:   { n: 16, pk: .36, dur: [3.0, 4.2] },
    stream: { n: 1,  pk: .60, dur: [10, 13] },
    core: .10, haze: .08, beam: 0, ray: 0, rayA: 0 },
  /* 炼气: 数道清气上涌 */
  { t: [128, 222, 255], s: [226, 250, 255], gold: .45,
    mote:   { n: 32, pk: .48, dur: [2.8, 4.0] },
    stream: { n: 3,  pk: .74, dur: [9, 12] },
    core: .14, haze: .11, beam: 0, ray: 0, rayA: 0 },
  /* 筑基: 气成溪流 */
  { t: [108, 218, 200], s: [178, 252, 226], gold: .55,
    mote:   { n: 48, pk: .56, dur: [2.6, 3.8] },
    stream: { n: 4,  pk: .80, dur: [8.5, 11.5] },
    core: .18, haze: .14, beam: 0, ray: 0, rayA: 0 },
  /* 结丹: 金光缕缕绕身 */
  { t: [250, 202, 108], s: [255, 244, 200], gold: .7,
    mote:   { n: 66, pk: .62, dur: [2.4, 3.6] },
    stream: { n: 5,  pk: .86, dur: [8, 11] },
    core: .22, haze: .17, beam: .30, ray: 0, rayA: 0 },
  /* 元婴: 周身灵光流转 */
  { t: [206, 168, 255], s: [255, 228, 162], gold: .6,
    mote:   { n: 90, pk: .68, dur: [2.2, 3.4] },
    stream: { n: 6,  pk: .92, dur: [7.5, 10.5] },
    core: .26, haze: .20, beam: .36, ray: 3, rayA: .05 },
  /* 化神: 紫金流光漫天 */
  { t: [120, 216, 255], s: [255, 230, 150], gold: .78,
    mote:   { n: 132, pk: .76, dur: [2.0, 3.2] },
    stream: { n: 8,  pk: .98, dur: [7, 10] },
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
  let motes = [], bands = [];

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

  /* ===== 丝带光流 =====
     每境界 stream.n 根"光丝带"。带 = 纯参数, 无跨帧轨迹历史:
       p ∈ [0,1] 竖直进度 → 头部 y 从屏下(1.05H)升到头顶外消失;
       s ∈ [0,1] 带内采样(0=头 1=尾), 该帧现算折线并双层 stroke;
       带内波纹相位 (s·sw + t·bf) 沿带向上传播 → 能量流动感。 */
  function rollBand(b, cfgV) {
    const st = cfgV.stream;
    b.dur = rnd(st.dur[0], st.dur[1]);      // 缓缓上升全程秒数(慢)
    b.wf = rnd(0.86, 1.16);                 // 宽窄个体差异
    b.hf = rnd(0.88, 1.14);                 // 长短个体差异
    b.ph = rnd(0, TWO_PI);
    b.ph2 = rnd(0, TWO_PI);
    b.tw = rnd(0.82, 1.12);                 // 明暗个体差异
    /* 原地翻卷: 绕"竖直轴"翻转(不是绕屏幕法线转 → 光带不会左斜右斜),
       2D 上表现为宽度按 |cos| 周期变化 + 明暗变化, 像气流翻面 */
    b.spin = rnd(0, TWO_PI);
    /* 转快点: 一圈约 2~3s, 上升全程(7~13s)内能翻 3~6 个整圈 */
    b.spinV = rnd(2.2, 3.2) * (Math.random() < 0.5 ? -1 : 1);
    /* 上升路径的蜿蜒曲线(幅度小, 不是乱飞) */
    b.curveK = rnd(0.8, 1.8);               // 全程蜿蜒圈数
    b.curvePh = rnd(0, TWO_PI);
    b.curveAmp = rnd(0.022, 0.05);          // 相对 W
    b.white = Math.random() < 0.55;         // 亮芯偏白珠光
  }
  function mkBand(slot, cfgV) {
    const b = { p: Math.random(), slot };
    rollBand(b, cfgV);
    return b;
  }
  function prepare(cfgV, vi) {
    while (motes.length < cfgV.mote.n) motes.push(mkMote(cfgV.mote));
    motes.length = cfgV.mote.n;
    const want = (cfgV.stream && cfgV.stream.n) || 0;
    if (bands._i !== vi) {
      /* 大境界变化 → 整体重建, 新境界立刻生效 */
      bands.length = 0;
      for (let k = 0; k < want; k++) bands.push(mkBand(k, cfgV));
      bands._i = vi;
    } else if (bands.length !== want) {
      while (bands.length < want) bands.push(mkBand(bands.length, cfgV));
      bands.length = want;
    }
  }

  function draw(t, dt) {
    if (!Number.isFinite(W) || W < 1 || H < 1) return;
    const cfgV = REALM_VIS[idx()];
    try { ctx.clearRect(0, 0, W, H); } catch (e) { return; }
    /* 柔光/光柱/放射层依赖贴图; 贴图未就绪跳过即可.
       丝带 + 金尘自绘, 不需要 ready 守卫, 即时生效. */
    ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.50;
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.8);       // 慢呼吸
    const tCol = cfgV.t, sCol = cfgV.s;

    /* 0) 背后柔光(静态呼吸) + 光柱 + 放射 */
    const hazeCv = imgs.haze ? tinted("haze", tCol) : null;
    if (hazeCv && cfgV.haze > 0.01) {
      const sz = W * (0.60 + 0.07 * breathe);
      ctx.globalAlpha = safe(cfgV.haze * (0.7 + 0.3 * breathe), 0);
      ctx.drawImage(hazeCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    const coreCv = imgs.core ? tinted("core", sCol) : null;
    if (coreCv && cfgV.core > 0.01) {
      const sz = W * (0.28 + 0.05 * breathe);
      ctx.globalAlpha = safe(cfgV.core * (0.6 + 0.4 * breathe), 0);
      ctx.drawImage(coreCv, cx - sz / 2, cy - sz / 2, sz, sz);
    }
    if (cfgV.beam > 0.01 && imgs.beam) {
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

    /* ---- ① 金尘: 细碎星尘(小+密), 极慢飘浮 ---- */
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
      const al = safe(prof(u) * cfgV.mote.pk * (0.88 + 0.12 * Math.sin(t * 0.45)), 0);
      ctx.globalAlpha = al;
      const ic = tinted("mote", col);
      if (ic) ctx.drawImage(ic, x - sz / 2, y - sz / 2, sz, sz);
    }

    /* ---- ② PNG 光带: 蜿蜒上升的气流 ----
       · 朝向恒定正上正下(不 rotate Z 轴, 故不会左斜右斜);
       · 绕"竖直轴"原地翻卷: 用 flip=|cos(spin)| 缩放宽度(1=正面,0=侧过去),
         侧面时更暗 → 飘带翻面的立体感, 而非平面旋转;
       · 水平小幅正弦运动曲线; 越过头顶(立绘分析: 头顶约 6% 高度)快速渐隐。
       (beam 长尾柱方案已否决: 随自转会变成贯穿画面的斜线) */
    if (bands.length && imgs.streak) {
      const pk = cfgV.stream ? cfgV.stream.pk : 0;
      const n = bands.length;
      const laneSpan = W * 0.19;
      /* 单条宽度: 条数越多略窄, 下限保证仍是"带"不是"线" */
      const wBase = W * Math.max(0.08, Math.min(0.14, 0.14 - 0.010 * n));
      /* 真实 .cult 近正方形(≈425x430), 光带高取 max(H 比例, 短边比例)
         保证窄高容器与方形容器里都是"带"而不是"团" */
      const hBase = Math.max(H * 0.19, Math.min(W, H) * 0.28);
      const br = 0.88 + 0.12 * Math.sin(t * 0.45);           // 全局呼吸
      const rayCv = imgs.ray ? tinted("ray", tCol) : null;
      /* 约束: 光带自"打坐臀部/下丹田"(seatY)升起, 顶边最高到"脖子"(neckTop),
         不触头顶、不出屏幕底(立绘实测: 头顶~0%, 脖子~23%, 臀部~64%) */
      const seatY = H * 0.64;                                // 生成位: 打坐臀部/下丹田
      const neckTop = H * 0.23;                              // 脖子线(光带顶到此为止)
      const hRef = hBase * 0.5;                              // 光带半高
      const fadeTopC = neckTop + hRef;                       // 中心升到此处→顶边恰达脖子→全隐
      const travel = seatY - fadeTopC;                       // 自臀部升至脖子
      for (const b of bands) {
        b.p += dt / b.dur;
        b.spin += dt * b.spinV;                              // 绕中心自转
        if (b.p >= 1) { b.p = 0; rollBand(b, cfgV); }
        const y = seatY - b.p * travel;                      // p=0 臀部, p=1 脖子(顶边)
        if (y < fadeTopC - H * 0.03 || y > seatY + H * 0.05) continue;
        /* 运动曲线: 水平小幅度蜿蜒 */
        const cph = TWO_PI * (b.p * b.curveK + b.curvePh);
        const laneX = cx + (n > 1 ? (b.slot / (n - 1)) * 2 - 1 : 0) * laneSpan;
        const x = laneX + Math.sin(cph) * W * b.curveAmp;
        /* 原地翻卷(绕竖直轴): 1=正面朝向观众, 0=侧过去;
           保底 0.42 不至于翻成一条线 */
        const flip = Math.abs(Math.cos(b.spin));
        const flipW = 0.42 + 0.58 * flip;
        /* 自臀部淡入 + 升到脖子(中心 fadeTopC)完全渐隐: 顶边不越头、不硬截断 */
        const fin = ss(0.00, 0.12, b.p);
        const fadeHead = ss(fadeTopC, fadeTopC + H * 0.07, y);
        const a = pk * br * b.tw * (0.74 + 0.26 * Math.sin(t * 0.5 + b.ph2))
                * fin * fadeHead * (0.70 + 0.30 * flip);
        if (a <= 0.012) continue;
        /* 呼吸式伸缩 + 翻卷压扁 */
        const bs = Math.sin(t * 0.4 + b.ph);
        const w = wBase * b.wf * (1 - 0.05 * bs) * flipW;
        const h = hBase * b.hf * (1 + 0.07 * bs) * (0.95 + 0.05 * flip);

        /* 朝向固定竖直(正上正下): 不 rotate, 只平移 */
        ctx.save();
        ctx.translate(x, y);
        /* 1) 外层宽淡光晕 */
        if (rayCv) {
          ctx.globalAlpha = Math.min(1, a * 0.26);
          ctx.drawImage(rayCv, -w * 0.66, -h * 0.60, w * 1.32, h * 1.20);
        }
        /* 2) 主体光带 */
        const sCv = tinted("streak", b.white ? sCol : tCol);
        if (sCv) {
          ctx.globalAlpha = Math.min(1, a * 0.55);
          ctx.drawImage(sCv, -w / 2, -h / 2, w, h);
        }
        /* 3) 亮芯: 收窄的同一贴图, 让光带有芯不虚 */
        const kCv = tinted("streak", b.white ? WHITE : sCol);
        if (kCv) {
          ctx.globalAlpha = Math.min(1, a * 0.42);
          ctx.drawImage(kCv, -w * 0.25, -h * 0.30, w * 0.50, h * 0.60);
        }
        ctx.restore();
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
      const vi = idx();
      const cfgV = REALM_VIS[vi];
      prepare(cfgV, vi);
      draw(now / 1000, dt);
    } catch (e) {
      if (!window.__fxErr) window.__fxErr = "fx2d: " + (e && e.message || e);
    }
  }

  loadAll().then(() => { ready = true; });
  prepare(REALM_VIS[0], 0);
  last = performance.now();
  raf = requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { last = performance.now(); }
  });
  return { destroy() { cancelAnimationFrame(raf); ro.disconnect(); } };
}

export { initFx, REALM_VIS, BIG_NAMES };
