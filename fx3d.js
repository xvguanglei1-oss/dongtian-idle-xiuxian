/* 极简版玩家身上的粒子流(three.js 角色绑定) — 缠身螺旋 + 贴身流光, 失败自动降级2D */
"use strict";
const REALM_FX = [
  { hN: 12, fN: 8,  c1: [206,186,124], c2: [150,138, 90], c3: [235,222,180],
    hSpd: 0.5, up: 0.20, size: 1.0, op: 0.35, big: 0.9 },
  { hN: 26, fN: 16, c1: [127,224,255], c2: [ 96,176,224], c3: [200,240,255],
    hSpd: 0.7, up: 0.34, size: 1.4, op: 0.55, big: 1.5 },
  { hN: 40, fN: 24, c1: [ 97,208,196], c2: [ 96,168,228], c3: [176,244,230],
    hSpd: 0.9, up: 0.42, size: 1.7, op: 0.70, big: 1.9 },
  { hN: 60, fN: 28, c1: [246,200,112], c2: [255,228,164], c3: [206,148, 60],
    hSpd: 1.1, up: 0.30, size: 2.1, op: 0.80, big: 2.4 },
  { hN: 66, fN: 32, c1: [196,158,255], c2: [252,216,130], c3: [150,118,255],
    hSpd: 0.95, up: 0.24, size: 2.4, op: 0.85, big: 2.8 },
  { hN: 90, fN: 40, c1: [ 96,208,255], c2: [255,216,128], c3: [150,244,255],
    hSpd: 1.25, up: 0.26, size: 2.7, op: 0.95, big: 3.4 },
];
const BIG_NAMES = ["凡人", "炼气", "筑基", "结丹", "元婴", "化神"];
let THREE, renderer, scene, cam, cv, W = 0, H = 0, raf = 0, last = 0;
let hGeo, fGeo, hMat, fMat, hPts = [], fPts = [];
let cfg = null, toCfg = null, mix = 1, tIdx = 0, ro = null;

function makeDot() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(.4, "rgba(255,255,255,.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function resize() {
  if (!renderer) return;
  const r = cv.parentElement.getBoundingClientRect();
  W = Math.max(2, r.width); H = Math.max(2, r.height);
  renderer.setSize(W, H, false);
  cv.style.width = W + "px"; cv.style.height = H + "px";
  cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2; cam.bottom = -H / 2;
  cam.updateProjectionMatrix();
}
function idx() {
  const c = document.getElementById("cult");
  const i = BIG_NAMES.indexOf(c && c.dataset.big);
  return i >= 0 ? i : 0;
}
function ensureCounts(n) {
  while (hPts.length < n) hPts.push({ a: Math.random() * 6.28, y: Math.random(), r: 0.85 + Math.random() * .4, spd: cfg.hSpd * (0.8 + Math.random() * .6) });
  if (hPts.length > n) hPts.length = n;
  while (fPts.length < n) fPts.push({ x: (Math.random() - 0.5) * 0.5, y: Math.random(), spd: 0.3 + Math.random() * .7 });
  if (fPts.length > n) fPts.length = n;
}
function morph() {
  const i = idx();
  if (i !== tIdx) { tIdx = i; toCfg = REALM_FX[i]; mix = 0; }
  if (toCfg && mix < 1) {
    mix = Math.min(1, mix + 0.04);
    const a = cfg || REALM_FX[0], b = toCfg;
    cfg = {
      hN: Math.round(a.hN + (b.hN - a.hN) * mix),
      fN: Math.round(a.fN + (b.fN - a.fN) * mix),
      c1: a.c1.map((v, k) => v + (b.c1[k] - v) * mix),
      c2: a.c2.map((v, k) => v + (b.c2[k] - v) * mix),
      c3: a.c3.map((v, k) => v + (b.c3[k] - v) * mix),
      hSpd: a.hSpd + (b.hSpd - a.hSpd) * mix,
      up: a.up + (b.up - a.up) * mix,
      size: a.size + (b.size - a.size) * mix,
      op: a.op + (b.op - a.op) * mix,
      big: a.big + (b.big - a.big) * mix,
    };
    ensureCounts(cfg.hN);
  } else if (toCfg && mix >= 1) { cfg = toCfg; toCfg = null; }
}
function tick(t, dt) {
  const rad = cfg.big * W * 0.5;
  const hpos = hGeo.attributes.position.array;
  const hcol = hGeo.attributes.color.array;
  for (let i = 0; i < cfg.hN; i++) {
    const p = hPts[i];
    p.y += dt * cfg.up * (0.5 + p.spd * 0.25);
    if (p.y > 1.05) p.y -= 1.1;
    p.a += dt * p.spd * 0.7;
    const rr = rad * p.r * Math.max(0.1, Math.sin(p.y * Math.PI));
    hpos[i * 3]     = Math.cos(p.a) * rr;
    hpos[i * 3 + 1] = (p.y - 0.5) * H;
    hpos[i * 3 + 2] = Math.sin(p.a) * rr * 0.55;
    const tw = 0.6 + 0.4 * Math.abs(Math.sin(t * 1.5 + i));
    hcol[i * 3]     = cfg.c1[0] / 255 * tw + cfg.c2[0] / 255 * (1 - tw);
    hcol[i * 3 + 1] = cfg.c1[1] / 255 * tw + cfg.c2[1] / 255 * (1 - tw);
    hcol[i * 3 + 2] = cfg.c1[2] / 255 * tw + cfg.c2[2] / 255 * (1 - tw);
  }
  hGeo.attributes.position.needsUpdate = true;
  hGeo.attributes.color.needsUpdate = true;
  const fpos = fGeo.attributes.position.array;
  const fcol = fGeo.attributes.color.array;
  for (let i = 0; i < cfg.fN; i++) {
    const p = fPts[i];
    p.y += dt * cfg.up * p.spd;
    if (p.y > 1.02) { p.y = -0.04; p.x = (Math.random() - 0.5) * 0.5; }
    fpos[i * 3]     = p.x * W;
    fpos[i * 3 + 1] = (p.y - 0.5) * H + Math.sin(t * 2.3 + i) * 2;
    fpos[i * 3 + 2] = 0;
    fcol[i * 3]     = cfg.c2[0] / 255;
    fcol[i * 3 + 1] = cfg.c2[1] / 255;
    fcol[i * 3 + 2] = cfg.c2[2] / 255;
  }
  fGeo.attributes.position.needsUpdate = true;
  fGeo.attributes.color.needsUpdate = true;
  hMat.opacity = 0.9 * cfg.op;
  fMat.opacity = 0.8 * cfg.op;
  renderer.render(scene, cam);
}
function step(now) {
  if (!document.hidden) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    morph();
    tick(now / 1000, dt);
  }
  raf = requestAnimationFrame(step);
}
function initFx2d(canvas) {
  const ctx = canvas.getContext("2d");
  const host = canvas.parentElement;
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
  let rings = [], ups = [];
  const fit = () => {
    const r = host.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(10, r.width); H = Math.max(10, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  const ro2 = new ResizeObserver(fit); ro2.observe(host);
  const getIdx2 = () => {
    const nm = document.getElementById("cult") && document.getElementById("cult").dataset.big;
    const i = BIG_NAMES.indexOf(nm); return i >= 0 ? i : 0;
  };
  const ensure = (n, arr, mk) => {
    while (arr.length < n) arr.push(mk());
    if (arr.length > n) arr.length = n;
  };
  function step2(now) {
    raf = requestAnimationFrame(step2);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (document.hidden) return;
    const p = REALM_FX[getIdx2()];
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const cx = W / 2, cy = H * 0.5;
    const rad = p.big * W * 0.5;
    ensure(p.hN, rings, () => ({ a: Math.random() * 6.28, y: Math.random(), r: 0.85 + Math.random() * .4, spd: p.hSpd * (0.8 + Math.random() * .6) }));
    for (const q of rings) {
      q.y += dt * p.up * (0.5 + q.spd * 0.25); if (q.y > 1.05) q.y -= 1.1;
      q.a += dt * q.spd * 0.7;
      const rr = rad * q.r * Math.max(0.1, Math.sin(q.y * Math.PI));
      const x = cx + Math.cos(q.a) * rr, y = cy + (q.y - 0.5) * H;
      const col = (Math.random() < 0.6) ? p.c1 : p.c2;
      ctx.fillStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + (0.5 * p.op) + ")";
      ctx.beginPath(); ctx.arc(x, y, p.size * 4, 0, 7); ctx.fill();
    }
    ensure(p.fN, ups, () => ({ x: (Math.random() - 0.5) * 0.5, y: Math.random(), spd: 0.3 + Math.random() * 0.7 }));
    for (const u of ups) {
      u.y += dt * p.up * u.spd; if (u.y > 1.02) { u.y = -0.04; u.x = (Math.random() - 0.5) * 0.5; }
      const x = cx + u.x * W + Math.sin(now / 900 + u.x * 9) * 5;
      const y = cy + (u.y - 0.5) * H;
      ctx.fillStyle = "rgba(" + p.c2[0] + "," + p.c2[1] + "," + p.c2[2] + "," + (0.6 * p.op) + ")";
      ctx.beginPath(); ctx.arc(x, y, p.size * 3, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  raf = requestAnimationFrame(step2);
  return { destroy() { cancelAnimationFrame(raf); ro2.disconnect(); } };
}
export async function initFx3d(canvas) {
  cv = canvas;
  try {
    THREE = await import("three");
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 80);
    cam.position.set(0, 0, 40);
    resize();
    ro = new ResizeObserver(resize); ro.observe(cv.parentElement);
    cfg = REALM_FX[0];
    tIdx = 0;
    ensureCounts(cfg.hN);
    const maxH = Math.max.apply(null, REALM_FX.map(x => x.hN));
    const maxF = Math.max.apply(null, REALM_FX.map(x => x.fN));
    hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(maxH * 3), 3));
    hGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(maxH * 3), 3));
    hGeo.setDrawRange(0, cfg.hN);
    hMat = new THREE.PointsMaterial({ size: 16, map: makeDot(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true });
    scene.add(new THREE.Points(hGeo, hMat));
    fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(maxF * 3), 3));
    fGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(maxF * 3), 3));
    fGeo.setDrawRange(0, cfg.fN);
    fMat = new THREE.PointsMaterial({ size: 11, map: makeDot(), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true });
    scene.add(new THREE.Points(fGeo, fMat));
    last = performance.now();
    raf = requestAnimationFrame(step);
    return { destroy() { cancelAnimationFrame(raf); ro && ro.disconnect(); } };
  } catch (err) {
    console.warn("[fx] WebGL 不可用, 降级 2D 粒子", err);
    window.__fxMode = "2d";
    window.__fxErr = String((err && err.message) || err);
    try { return initFx2d(canvas); }
    catch (e2) { window.__fxErr = String((e2 && e2.message) || e2); return { destroy() {} }; }
  }
}
