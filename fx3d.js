/* ============================================================
 * fx3d.js —— three.js 角色绑定特效层(替换保守的2D版)
 * 思想: 立绘居中于 cult 画布, 特效坐标以角色中轴为基准:
 *   - helix  : 螺旋缠身粒子(自下而上绕身体旋转, 气流/金砂/星光)
 *   - flow   : 贴身流光(沿躯干上浮, 高斯的身体宽度约束)
 *   - ribbon : 1~2条发光螺线丝带(Line 加性, 视觉最炫的流动光带)
 *   - sparks : 随机星闪
 *   - bolt   : 化神专属雷丝
 * 境界切换读 #cult dataset.big, 参数插值平滑过渡。参数集中在 REALM_FX。
 * ============================================================ */
"use strict";

const REALM_FX = [
  /* 凡人: 极淡, 几点暖尘旋身 + 一缕几乎看不见的流 */
  { hN: 14, hR: 0.34, fN: 10, rN: 0, sN: 3, bolt: 0,
    c1: [206,186,124], c2: [160,138,90], c3: [235,222,180],
    hSpd: 0.5, up: 0.20, size: 1.0, op: 0.25, big: 0.9 },
  /* 炼气: 淡青气流绕身 + 贴身微光 */
  { hN: 26, hR: 0.44, fN: 18, rN: 1, sN: 6, bolt: 0,
    c1: [127,224,255], c2: [96,176,224], c3: [200,240,255],
    hSpd: 0.7, up: 0.34, size: 1.3, op: 0.42, big: 1.5 },
  /* 筑基: 青绿双色螺旋 + 上身流光 + 一圈腰际光带 */
  { hN: 40, hR: 0.54, fN: 28, rN: 1, sN: 12, bolt: 0,
    c1: [97,208,196], c2: [96,168,228], c3: [176,244,230],
    hSpd: 0.9, up: 0.42, size: 1.6, op: 0.55, big: 1.9 },
  /* 结丹: 金砂密旋 + 丹田火点 + 腰间金环 */
  { hN: 60, hR: 0.64, fN: 30, rN: 2, sN: 22, bolt: 0,
    c1: [246,200,112], c2: [255,228,164], c3: [206,148,60],
    hSpd: 1.1, up: 0.30, size: 2.0, op: 0.68, big: 2.4 },
  /* 元婴: 紫金双色螺旋 + 星光闪 + 双带 */
  { hN: 66, hR: 0.74, fN: 34, rN: 2, sN: 30, bolt: 0,
    c1: [196,158,255], c2: [252,216,130], c3: [150,118,255],
    hSpd: 0.95, up: 0.24, size: 2.2, op: 0.74, big: 2.8 },
  /* 化神: 广域青金旋尘 + 双层螺带 + 雷丝 */
  { hN: 90, hR: 0.88, fN: 44, rN: 3, sN: 40, bolt: 5,
    c1: [96,208,255], c2: [255,216,128], c3: [150,244,255],
    hSpd: 1.25, up: 0.26, size: 2.5, op: 0.85, big: 3.4 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];

let THREE, renderer, scene, cam;
let cv, W = 0, H = 0, dpr = 1, running = false, raf = 0, last = 0, visible = true;
let cfg = null, from = null, to = null, mix = 1, tIdx = 0;
let group;                 // 特效容器
let texDot;                // 圆形软点纹理
let hPts = [], fPts = [], sPts = [];
let ribbons = [], ringPts = [], bolts = [];
let ro = null;

function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function makeDotTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}

function freshRibbon(c, alpha) {
  const g = new THREE.BufferGeometry();
  const n = 64;
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const m = new THREE.LineBasicMaterial({
    color: new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255),
    transparent: true, opacity: alpha, blending: THREE.AdditiveBlending,
    depthWrite: false, linewidth: 1 });
  const ln = new THREE.Line(g, m);
  group.add(ln);
  return { line: ln, t: Math.random() * 9, dir: Math.random() < .5 ? 1 : -1,
    radius: 1, color: c };
}

function makePoints(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const m = new THREE.PointsMaterial({
    map: texDot, size: 8, transparent: true, opacity: .9,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false,
    vertexColors: true });
  const pts = new THREE.Points(g, m);
  group.add(pts);
  return pts;
}

function resize() {
  if (!cv) return;
  const r = cv.parentElement.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.max(2, r.width); H = Math.max(2, r.height);
  renderer.setSize(W, H, false);
  renderer.domElement.style.width = W + "px";
  renderer.domElement.style.height = H + "px";
  const halfW = W / 2, halfH = H / 2;
  cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
  cam.updateProjectionMatrix();
}

function spawnParticle(i) {
  const n = cfg.hN;
  const ph = (i / n) * Math.PI * 2 + Math.random() * .2;
  const yH = Math.random();
  hPts[i] = {
    ph, y: yH, spd: cfg.hSpd * (0.8 + Math.random() * .5),
    rMul: 0.82 + Math.random() * .5,
    col: (Math.random() < .6 ? cfg.c1 : cfg.c2).slice(),
    tw: Math.random() * 6.28, size: (0.7 + Math.random() * .8) * cfg.size };
}
function spawnFlow(i) {
  const n = Math.max(1, cfg.fN);
  fPts[i] = {
    x: (Math.random() - .5) * 0.42,         // 躯干宽度内(±0.21W左右)
    y: Math.random(), spd: cfg.up * (0.6 + Math.random() * .9),
    sway: Math.random() * 6.28, swayA: 0.02 + Math.random() * 0.03,
    col: (Math.random() < .5 ? cfg.c2 : cfg.c3).slice(),
    tw: Math.random() * 6.28, size: (0.6 + Math.random() * .9) * cfg.size * .7 };
}
function spawnSpark(i) {
  const n = Math.max(1, cfg.sN);
  sPts[i] = { a: Math.random() * 6.28, r: 0.5 + Math.random() * 0.7,
    tw: Math.random() * 6.28, size: (0.5 + Math.random()) * cfg.size * .8 };
}

function applyCounts() {
  while (hPts.length < cfg.hN) spawnParticle(hPts.length);
  hPts.length = cfg.hN;
  while (fPts.length < cfg.fN) spawnFlow(fPts.length);
  fPts.length = cfg.fN;
  while (sPts.length < cfg.sN) spawnSpark(sPts.length);
  sPts.length = cfg.sN;
  // 粒子几何
  hPtsMat.geometry.setDrawRange(0, Math.max(0, Math.round(cfg.hN)));
  fPtsMat.geometry.setDrawRange(0, Math.max(0, Math.round(cfg.fN)));
  sPtsMat.geometry.setDrawRange(0, Math.max(0, Math.round(cfg.sN)));
  // ribbons 数
  while (ribbons.length < cfg.rN) ribbons.push(freshRibbon(cfg.c2, 0.5));
  while (ribbons.length > cfg.rN) { const rb = ribbons.pop(); group.remove(rb.line); rb.line.geometry.dispose(); rb.line.material.dispose(); }
  for (const rb of ribbons) { rb.radius = cfg.hR; rb.color = cfg.c2; rb.line.material.opacity = .55 * cfg.op + .1; }
}
let hPtsMat, fPtsMat, sPtsMat, lastApply = 0;

function morph(dt) {
  const cult = document.getElementById("cult");
  const nm = cult && cult.dataset.big;
  const i = BIG_NAMES.indexOf(nm);
  if (i >= 0 && i !== tIdx) { tIdx = i; from = cfg; to = REALM_FX[i]; mix = 0; }
  if (to && mix < 1) {
    mix = Math.min(1, mix + dt * 1.6);
    const a = from, b = to;
    cfg = {
      hN: a.hN + (b.hN - a.hN) * mix, hR: a.hR + (b.hR - a.hR) * mix,
      fN: a.fN + (b.fN - a.fN) * mix, rN: Math.round(a.rN + (b.rN - a.rN) * mix),
      sN: a.sN + (b.sN - a.sN) * mix, bolt: b.bolt,
      c1: a.c1.map((v, k) => v + (b.c1[k] - v) * mix),
      c2: a.c2.map((v, k) => v + (b.c2[k] - v) * mix),
      c3: a.c3.map((v, k) => v + (b.c3[k] - v) * mix),
      hSpd: a.hSpd + (b.hSpd - a.hSpd) * mix, up: a.up + (b.up - a.up) * mix,
      size: a.size + (b.size - a.size) * mix, op: a.op + (b.op - a.op) * mix,
      big: a.big + (b.big - a.big) * mix };
    hPtsMat.material.opacity = .9 * cfg.op; fPtsMat.material.opacity = .75 * cfg.op;
  } else if (mix >= 1 && to) { cfg = to; to = null; }
}

function tick(t, dt) {
  // 螺旋缠身
  const h = cfg.hR * W * .5;
  const pos = hPtsMat.geometry.attributes.position.array;
  for (let i = 0; i < cfg.hN; i++) {
    const p = hPts[i] || spawnParticle(i);
    p.y += dt * cfg.up * (0.5 + p.spd * 0.25);
    if (p.y > 1.06) { p.y -= 1.12; }
    const rad = h * p.rMul * Math.max(0.08, Math.sin(p.y * Math.PI)); // 两端收拢=缠身感
    const a = p.ph + t * p.spd;
    const x = Math.cos(a) * rad, y = (p.y - 0.5) * H;
    const z = Math.sin(a) * rad * 0.6;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
  }
  const hcol = hPtsMat.geometry.attributes.color.array;
  for (let i = 0; i < cfg.hN; i++) { const p = hPts[i]; if (!p) continue; hcol[i*3]=p.col[0]/255; hcol[i*3+1]=p.col[1]/255; hcol[i*3+2]=p.col[2]/255; }
  hPtsMat.geometry.attributes.color.needsUpdate = true;
  hPtsMat.geometry.attributes.position.needsUpdate = true;
  // 贴身流光(高斯约束在身体宽度)
  const fpos = fPtsMat.geometry.attributes.position.array;
  for (let i = 0; i < cfg.fN; i++) {
    const p = fPts[i] || spawnFlow(i);
    p.y += dt * cfg.up * p.spd;
    if (p.y > 1.02) { p.y = -0.04; p.x = (Math.random() - .5) * .4; }
    p.x += Math.sin(t * 1.4 + p.sway) * p.swayA * dt;
    const x = p.x * W, y = (p.y - 0.5) * H, z = 0;
    fpos[i * 3] = x; fpos[i * 3 + 1] = y; fpos[i * 3 + 2] = z;
  }
  const fcol = fPtsMat.geometry.attributes.color.array;
  for (let i = 0; i < cfg.fN; i++) { const p = fPts[i]; if (!p) continue; fcol[i*3]=p.col[0]/255; fcol[i*3+1]=p.col[1]/255; fcol[i*3+2]=p.col[2]/255; }
  fPtsMat.geometry.attributes.color.needsUpdate = true;
  fPtsMat.geometry.attributes.position.needsUpdate = true;
  // 星闪 (仅动size不可行, 用alpha? PointsMaterial uniform) → 用几何中 x 微偏移亮度替代: 简化为静态
  const spos = sPtsMat.geometry.attributes.position.array;
  for (let i = 0; i < cfg.sN; i++) {
    const p = sPts[i] || spawnSpark(i);
    const tw = .55 + .45 * Math.sin(t * 2.2 + p.tw);
    const a = p.a + t * .3;
    const x = Math.cos(a) * p.r * cfg.hR * W * .5 * tw;
    const y = Math.sin(a) * p.r * cfg.hR * W * .5 * .92 * tw;
    spos[i * 3] = x; spos[i * 3 + 1] = y; spos[i * 3 + 2] = 4;
  }
  const scol = sPtsMat.geometry.attributes.color.array;
  for (let i = 0; i < cfg.sN; i++) { const p = sPts[i]; if (!p) continue; scol[i*3]=p.col[0]/255; scol[i*3+1]=p.col[1]/255; scol[i*3+2]=p.col[2]/255; }
  sPtsMat.geometry.attributes.color.needsUpdate = true;
  sPtsMat.geometry.attributes.position.needsUpdate = true;
  // 丝带
  for (const rb of ribbons) {
    const n = 64, arr = rb.line.geometry.attributes.position.array;
    rb.t += dt * (0.5 + rb.dir * 0.02);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const y = (u - 0.5) * H * 1.25;
      const r = rb.radius * W * .5 * Math.max(0.06, Math.sin(u * Math.PI)) * (0.9 + 0.12 * Math.sin(rb.t * 1.3 + u * 9));
      const a = rb.t * (0.8 + rb.dir * .4) + u * Math.PI * 2.6 * rb.dir;
      arr[i * 3] = Math.cos(a) * r; arr[i * 3 + 1] = y + Math.sin(rb.t * 1.8 + u * 7) * 4;
      arr[i * 3 + 2] = Math.sin(a) * r * .6;
    }
    rb.line.geometry.attributes.position.needsUpdate = true;
  }
  // 雷丝 (化神, 闪烁)
  for (const b of bolts) {
    b.life -= dt;
    const arr = b.line.geometry.attributes.position.array;
    const segs = (arr.length / 3) - 1;
    arr[0] = b.x0; arr[1] = b.y0; arr[2] = 6;
    let x = b.x0, y = b.y0;
    for (let s = 0; s < segs; s++) {
      x += b.vx * (0.7 + Math.random() * .7) * (b.flash ? 1 : 1.4);
      y += b.vy;
      arr[(s + 1) * 3] = x; arr[(s + 1) * 3 + 1] = y; arr[(s + 1) * 3 + 2] = 6;
    }
    b.line.geometry.attributes.position.needsUpdate = true;
    b.line.material.opacity = b.life * cfg.op * (b.flash ? .9 : .5);
    b.line.material.color.setRGB(b.color[0] / 255, b.color[1] / 255, b.color[2] / 255);
  }
}

function step(now) {
  raf = requestAnimationFrame(step);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (document.hidden) return;
  morph(dt);
  if (now - lastApply > 400) { lastApply = now; applyCounts(); }
  tick(now / 1000, dt);
  if (cfg && cfg.bolt && bolts.length < 2 && Math.random() < dt * cfg.bolt * .3) {
    const b = {
      life: 1, color: Math.random() < .5 ? [200,240,255] : [255,224,150],
      x0: (Math.random() - .5) * cfg.hR * W * .9,
      y0: H * .3 + Math.random() * H * .3,
      vx: (Math.random() - .5) * 30, vy: -H * (0.02 + Math.random() * .04),
      flash: Math.random() < .3 };
    const g = new THREE.BufferGeometry();
    const segs = 6;
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((segs + 1) * 3), 3));
    const m = new THREE.LineBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const ln = new THREE.Line(g, m);
    group.add(ln);
    b.line = ln;
    bolts.push(b);
  }
  bolts = bolts.filter(x => x.life > 0 && x.line.parent);
  renderer.render(scene, cam);
}

export async function initFx3d(canvas) {
  cv = canvas;
  THREE = await import("three");
  try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 80); // near>0, 避免粒子贴在近平面上被裁剪
  cam.position.set(0, 0, 40);
  group = new THREE.Group();
  scene.add(group);
  texDot = makeDotTexture();
  cfg = REALM_FX[0]; tIdx = 0;

  // 三组粒子(geometry 上限取最大境)
  const maxH = Math.max(...REALM_FX.map(x => x.hN));
  const maxF = Math.max(...REALM_FX.map(x => x.fN));
  const maxS = Math.max(...REALM_FX.map(x => x.sN));
  const geoH = new THREE.BufferGeometry();
  geoH.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(maxH * 3), 3));
  const hMat = new THREE.PointsMaterial({ map: texDot, size: 15, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, vertexColors: false });
  const hP = new THREE.Points(geoH, hMat); hPtsMat = { geometry: geoH, material: hMat }; group.add(hP);
  const geoF = new THREE.BufferGeometry();
  geoF.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(maxF * 3), 3));
  const fMat = new THREE.PointsMaterial({ map: texDot, size: 10, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
  const fP = new THREE.Points(geoF, fMat); fPtsMat = { geometry: geoF, material: fMat }; group.add(fP);
  const geoS = new THREE.BufferGeometry();
  geoS.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(maxS * 3), 3));
  const sMat = new THREE.PointsMaterial({ map: texDot, size: 8, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
  const sP = new THREE.Points(geoS, sMat); sPtsMat = { geometry: geoS, material: sMat }; group.add(sP);
  // 每帧更新粒子颜色不可行(PointsMaterial单色) → 用混合: 粒子单色+几何z? 简化: 全部用近白, 分层染色不足。
  // 补充: 给三组初始不设色; 材质颜色在 morph 中更新为 cfg.c1 以呈现主色。
  resize();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  ro = new ResizeObserver(resize); ro.observe(cv.parentElement);
  applyCounts();   // 首帧即按初始境界建立粒子与 drawRange(避免顶点残留)
  if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(step); }
  return { destroy() { cancelAnimationFrame(raf); running = false; ro && ro.disconnect(); } };
  } catch (err) {
    console.warn("[fx] WebGL 不可用, 降级 2D 粒子", err);
    window.__fxMode = "2d";
    window.__fxErr = String((err && err.message) || err);
    try { return initFx2d(canvas); }
    catch (e2) { window.__fxErr = String((e2 && e2.message) || e2); return { destroy() {} }; }
  }
}


/* ---- 2D 兜底引擎(WebGL受限时保证能看到粒子) ---- */
function initFx2d(canvas) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let rings = [], ups = [], spark = [];
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
  const cxx = () => W / 2, cyy = () => H * 0.5;
  function idx() {
    const nm = document.getElementById("cult") && document.getElementById("cult").dataset.big;
    const i = BIG_NAMES.indexOf(nm); return i >= 0 ? i : 0;
  }
  function step(now) {
    raf = requestAnimationFrame(step);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    const p = REALM_FX[idx()];
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const cx = cxx(), cy = cyy();
    const rad = p.hR * W * 0.5;
    while (rings.length < p.hN) rings.push({ a: Math.random() * 6.28, y: Math.random(), spd: p.hSpd * (0.8 + Math.random() * .6), r: .85 + Math.random() * .4, col: Math.random() < .6 ? p.c1 : p.c2, ph: Math.random() * 6 });
    rings.length = Math.round(p.hN);
    for (const q of rings) {
      q.y += dt * p.up * (0.6 + q.spd * .2); if (q.y > 1.05) q.y -= 1.1;
      q.a += dt * q.spd * .7;
      const rr = rad * q.r * Math.max(.1, Math.sin(q.y * Math.PI));
      const x = cx + Math.cos(q.a) * rr, y = cy + (q.y - .5) * H;
      ctx.fillStyle = `rgba(${q.col.join(",")},${(0.4 + 0.4 * Math.abs(Math.sin(now / 500 + q.ph))) * p.op})`;
      ctx.beginPath(); ctx.arc(x, y, p.size * 1.1, 0, 7); ctx.fill();
    }
    while (ups.length < p.fN) ups.push({ x: (Math.random() - .5) * .5, y: Math.random(), spd: .3 + Math.random() * .7, sw: Math.random() * 6, col: Math.random() < .5 ? p.c2 : p.c3 });
    ups.length = Math.round(p.fN);
    for (const u of ups) {
      u.y += dt * p.up * u.spd; if (u.y > 1.02) { u.y = -.05; u.x = (Math.random() - .5) * .5; }
      const x = cx + u.x * W + Math.sin(now / 900 + u.sw) * 6;
      const y = cy + (u.y - .5) * H;
      ctx.fillStyle = `rgba(${u.col.join(",")},${0.5 * p.op})`;
      ctx.beginPath(); ctx.arc(x, y, p.size * .9, 0, 7); ctx.fill();
    }
    // 丝带: 螺旋 stroke
    if (p.rN > 0) {
      ctx.strokeStyle = `rgba(${p.c2.join(",")},${0.5 * p.op})`;
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        const off = now / 1200 + k * Math.PI;
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          const y = cy + (u - .5) * H * 1.1;
          const r = rad * Math.max(.08, Math.sin(u * Math.PI)) * (k === 1 ? .6 : 1);
          const x = cx + Math.cos(off + u * Math.PI * 3) * r;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  });
  return { destroy() { cancelAnimationFrame(raf); ro.disconnect(); } };
}
