/* ============================================================
 * fxgl.js —— 流光真贴图弯曲 (WebGL 细分网格)
 * 把 fx_gold_streak 贴到 21行×2列 的细长网格上, 每帧按
 * 空间正弦波逐行挪动顶点 x → 贴图本尊如绸带被气流扭弯。
 * 依赖: fx2d.js 导出的 REALM_VIS/BIG_NAMES(流光的境界配置)
 * 与原 2D 层(motes/光晕)互相独立, 仅负责 streak。
 * ============================================================ */
import { REALM_VIS, BIG_NAMES } from "./fx2d.js";

"use strict";
const safe = (v, fb = 0) => (Number.isFinite(v) ? v : fb);
const rnd = (a, b) => a + Math.random() * (b - a);
const easeIO = u => u * u * (3 - 2 * u);
const WHITE = [255, 255, 255];

/* 每道光带网格: ROWS+1 行 × 2 列 */
const ROWS = 20;
const V_PER_STRIP = (ROWS + 1) * 2;
const MAX_STRIPS = 8;                 // 境界上限(化神=8)
const FLOATS = MAX_STRIPS * V_PER_STRIP * 4;  // x,y,u,v

function pickStreak(seed, t, s) {
  const r = (seed * 2654435761 % 100 + 100) % 100;
  if (r < 18) return t;
  if (r < 72) return s;
  return WHITE;
}
function prof(x) {
  if (x <= 0 || x >= 1) return 0;
  if (x < 0.32) { const u = x / 0.32; return u * u * (3 - 2 * u); }
  if (x < 0.8) { const u = (x - 0.32) / 0.48; return 1 - 0.38 * u; }
  const u = (x - 0.8) / 0.2;
  return (1 - u) * (1 - u);
}

const VS = `
attribute vec2 aPos;
attribute vec2 aUV;
varying vec2 vUV;
uniform vec2 uCss;         // css 像素尺寸
void main(){
  vUV = aUV;
  vec2 ndc = vec2(aPos.x / uCss.x * 2.0 - 1.0,
                  1.0 - aPos.y / uCss.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;
const FS = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTex;
uniform vec4 uColor;
uniform float uA;
void main(){
  vec4 tx = texture2D(uTex, vUV);
  gl_FragColor = vec4(tx.rgb * uColor.rgb, tx.a) * uA;
}`;

let gl, canvas, W = 0, H = 0, dpr = 1;
let prog, buf, texWhite = null, uLocs;
let strips = [];              // 活动的光带对象
let last = 0, raf = 0;
let stripTex = null;          // fx_gold_streak 纹理(白色原图, shader内染色)

function idx() {
  const c = document.getElementById("cult");
  const nm = c && c.dataset.big;
  const i = BIG_NAMES.indexOf(nm);
  return i >= 0 ? i : 0;
}

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("[fxgl] shader err:", gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

function loadTex() {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      stripTex = t;
      res();
    };
    im.onerror = () => { stripTex = null; res(); };
    im.src = "assets/fx/fx_gold_streak.png";
  });
}

/* 新建一条光带 */
function makeStrip(cfgV) {
  return {
    born: -rnd(0.5, 2.0),
    dur: rnd(cfgV.dur[0], cfgV.dur[1]),
    seed: Math.floor(rnd(0, 1e6)),
    x0: rnd(-0.22, 0.22),
    y0: rnd(0.14, 0.26),
    rise: rnd(0.32, 0.42),
    ph: rnd(0, 6.28), ph2: rnd(0, 6.28),
    f: rnd(0.5, 0.9), f2: rnd(1.2, 1.8),
    amp: rnd(0.025, 0.05),
    wid: rnd(0.9, 1.2),
    s0: rnd(0.9, 1.15),
    col: null,
  };
}
function respawnStrip(p, cfgV) {
  p.born = -rnd(0.6, 1.8);
  p.dur = rnd(cfgV.dur[0], cfgV.dur[1]);
  p.seed = Math.floor(rnd(0, 1e6));
  p.x0 = rnd(-0.22, 0.22); p.y0 = rnd(0.14, 0.26);
  p.rise = rnd(0.32, 0.42); p.ph = rnd(0, 6.28); p.ph2 = rnd(0, 6.28);
  p.f = rnd(0.5, 0.9); p.f2 = rnd(1.2, 1.8);
  p.amp = rnd(0.025, 0.05); p.wid = rnd(0.9, 1.2); p.s0 = rnd(0.9, 1.15);
}
function syncCount(cfgV) {
  while (strips.length < cfgV.streak.n) strips.push(makeStrip(cfgV));
  if (strips.length > cfgV.streak.n) strips.length = cfgV.streak.n;
}

function fit() {
  const host = canvas.parentElement;
  const r = host.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = Math.max(10, r.width); H = Math.max(10, r.height);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  gl.viewport(0, 0, canvas.width, canvas.height);
}

/* 每帧: 每条光带独立 bufferData + 绘制 */
function renderFixed() {
  /* 正确实现: 每条独立 offset 推进, 空条填充零并跳过 */
  const now = performance.now();
  const dt = safe(Math.min(0.05, (now - last) / 1000), 0.02);
  last = now;
  if (!stripTex) return;
  const cfgV = REALM_VIS[idx()];
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (!cfgV.streak.n) return;
  syncCount(cfgV);
  const t = now / 1000;
  const breathe = 0.9 + 0.1 * Math.sin(t * 0.45);
  const cx = W / 2, cy = H * 0.50;

  for (const p of strips) {
    p.born += dt;
    if (p.born < 0) continue;
    if (p.born > p.dur) { respawnStrip(p, cfgV); continue; }
    const u = p.born / p.dur, mv = easeIO(u);
    const headY = cy + (p.y0 - p.rise * mv) * H;
    const lenTotal = H * (0.16 + 0.05 * mv) * p.s0;
    const wid = Math.max(2, lenTotal * (0.085 * p.wid));
    const baseX = cx + (p.x0 + Math.sin(t * p.f * 0.4 + p.ph) * 0.02 * mv) * W;
    const waveSpeed = t * (0.65 + p.f2 * 0.3);
    const col = pickStreak(p.seed, cfgV.t, cfgV.s);
    const al = safe(prof(u) * cfgV.streak.pk * breathe, 0);
    if (al <= 0.01) continue;

    const data = new Float32Array(V_PER_STRIP * 4);
    let o2 = 0;
    for (let row = 0; row <= ROWS; row++) {
      const q = row / ROWS;
      const wave = Math.sin(q * 5.0 + waveSpeed + p.ph2)
                 + 0.55 * Math.sin(q * 2.3 + waveSpeed * 0.6 + p.ph);
      const amp = p.amp * W * (0.16 + q * q * 1.9);
      const xc = baseX + wave * amp;
      const y = headY + q * lenTotal;
      const v = 0.32 + q * 0.60;   // 头顶部用贴图亮段, 尾渐隐
      data[o2++] = xc - wid / 2; data[o2++] = y; data[o2++] = 0; data[o2++] = v;
      data[o2++] = xc + wid / 2; data[o2++] = y; data[o2++] = 1; data[o2++] = v;
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.uniform4f(uLocs.color, col[0] / 212, col[1] / 212, col[2] / 212, 1);
    gl.uniform1f(uLocs.a, al);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, V_PER_STRIP);
  }
}

function frame() {
  raf = requestAnimationFrame(frame);
  if (document.hidden) return;
  try { renderFixed(); } catch (e) {
    if (!window.__fxErr) window.__fxErr = "fxgl: " + (e && e.message || e);
  }
}

export async function initFxGl(canvasEl) {
  canvas = canvasEl;
  try {
    gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) gl = canvas.getContext("experimental-webgl", { alpha: true });
    if (!gl) { window.__fxMode = "no-gl"; return { ok: false }; }
    window.__fxMode = "gl";

    prog = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[fxgl] link err", gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    uLocs = {
      css: gl.getUniformLocation(prog, "uCss"),
      tex: gl.getUniformLocation(prog, "uTex"),
      color: gl.getUniformLocation(prog, "uColor"),
      a: gl.getUniformLocation(prog, "uA"),
    };
    const aPos = gl.getAttribLocation(prog, "aPos");
    const aUV = gl.getAttribLocation(prog, "aUV");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);           // additive
    gl.uniform1i(uLocs.tex, 0);
    gl.activeTexture(gl.TEXTURE0);

    fit();
    const ro = new ResizeObserver(fit); ro.observe(canvas.parentElement);
    await loadTex();
    last = performance.now();
    raf = requestAnimationFrame(frame);
    return {
      ok: true,
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); },
    };
  } catch (e) {
    console.warn("[fxgl] init fail", e);
    window.__fxErr = String((e && e.message) || e);
    return { ok: false };
  }
}
