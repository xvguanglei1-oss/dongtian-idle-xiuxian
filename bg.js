/* 深空仙侠全屏背景 bg.js —— 可调参数集中在各常量/函数注释处。
 * (1) 粒子数量: SHELLS 每层 count、GALAXY_N、DUST_N；(2) 星云/仙月: NEB_CFG 里 fx/fy/scale/opacity/depth；
 * (3) 节奏: 星层 rot 速度、相机漂移幅度、呼吸 speed 等。总粒子 ≤1200，全部程序化生成，无外部贴图。 */
import * as THREE from 'three';

const FOV = 64;
const TAN_HALF = Math.tan((FOV * Math.PI) / 360); // 视角竖直半角正切
const DPR_CAP = 2;

/* ---------- 顶点/片元着色器：柔和加性发光粒子（星场、星带、灵尘共用） ---------- */
const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.70 + 0.30 * sin(uTime * aSpeed + aPhase);
    float shimmer = 0.90 + 0.10 * sin(uTime * aSpeed * 0.61 + aPhase * 1.9);
    vColor = aColor * tw;
    gl_PointSize = aSize * uPixelRatio * shimmer;
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float a = pow(max(1.0 - d, 0.0), 2.0);
    gl_FragColor = vec4(vColor, a);
  }
`;

function makeParticleMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/* ---------- 确定性伪随机（重建星带时保证形状/分布稳定） ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 程序化纹理 ---------- */
// 柔和径向光斑（星云）
function makeBlobTexture() {
  const s = 256, c = s / 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(c, c, 0, c, c, c - 2);
  gr.addColorStop(0.00, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.42)');
  gr.addColorStop(0.50, 'rgba(255,255,255,0.16)');
  gr.addColorStop(0.75, 'rgba(255,255,255,0.05)');
  gr.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  // 轻微不对称高光，避免“完美圆球”
  g.globalCompositeOperation = 'lighter';
  const g2 = g.createRadialGradient(c - 26, c - 20, 4, c - 26, c - 20, 42);
  g2.addColorStop(0, 'rgba(255,255,255,0.10)');
  g2.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = g2; g.fillRect(0, 0, s, s);
  const g3 = g.createRadialGradient(c + 24, c + 22, 4, c + 24, c + 22, 40);
  g3.addColorStop(0, 'rgba(255,255,255,0.06)');
  g3.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = g3; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 仙月：冷白月轮 + 内层微晕 + 宽阔淡晕
function makeMoonTexture() {
  const s = 256, c = s / 2, R = c - 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const C = (a) => 'rgba(232,240,255,' + a + ')';
  // 最外层宽阔淡晕
  let gr = g.createRadialGradient(c, c, 0, c, c, R);
  gr.addColorStop(0.00, C(0.12));
  gr.addColorStop(0.35, C(0.07));
  gr.addColorStop(0.65, C(0.025));
  gr.addColorStop(1.00, C(0));
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  // 内层月晕
  gr = g.createRadialGradient(c, c, 0, c, c, R * 0.56);
  gr.addColorStop(0.00, C(0.10));
  gr.addColorStop(0.55, C(0.05));
  gr.addColorStop(1.00, C(0));
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  // 月轮本体（柔和边界）
  gr = g.createRadialGradient(c, c, 0, c, c, R * 0.30);
  gr.addColorStop(0.00, C(1.0));
  gr.addColorStop(0.55, C(0.95));
  gr.addColorStop(0.78, C(0.55));
  gr.addColorStop(0.92, C(0.22));
  gr.addColorStop(1.00, C(0));
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 深邃蓝黑→紫黑竖直渐变背景（逐行微抖噪防色带）
function makeSkyTexture() {
  const H = 512, W = 4;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const stops = [
    [0.00, [6, 9, 26]],
    [0.18, [13, 19, 54]],
    [0.40, [28, 34, 90]],
    [0.62, [52, 46, 124]],
    [0.80, [76, 52, 140]],
    [0.90, [44, 26, 96]],
    [1.00, [18, 10, 40]],
  ];
  const img = g.createImageData(W, H);
  const pick = (y) => {
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (y >= a[0] && y <= b[0]) {
        const t = b[0] === a[0] ? 0 : (y - a[0]) / (b[0] - a[0]);
        return [a[1][0] + (b[1][0] - a[1][0]) * t,
                a[1][1] + (b[1][1] - a[1][1]) * t,
                a[1][2] + (b[1][2] - a[1][2]) * t];
      }
    }
    return stops[stops.length - 1][1];
  };
  for (let y = 0; y < H; y++) {
    const p = pick(y / (H - 1));
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const n = (Math.random() - 0.5) * 1.2;
      img.data[o] = Math.max(0, Math.min(255, p[0] + n));
      img.data[o + 1] = Math.max(0, Math.min(255, p[1] + n));
      img.data[o + 2] = Math.max(0, Math.min(255, p[2] + n));
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- 主入口 ---------- */
async function initDeepSpace(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, powerPreference: 'high-performance', alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));

  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 4000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -640);

  let aspect = 1;
  const disposables = [];

  /* ============ 1. 三层视差星场 ============ */
  const SHELLS = [
    { count: 140, R: 470,  size: [1.5, 3.4], bright: [0.45, 1.0], rot:  0.012, cool: [0.82, 0.90, 1.0], warm: [1.0, 0.90, 0.80] },
    { count: 230, R: 720,  size: [1.0, 2.3], bright: [0.34, 0.85], rot: -0.008, cool: [0.88, 0.95, 1.0], warm: [1.0, 0.93, 0.85] },
    { count: 320, R: 1010, size: [0.75, 1.7], bright: [0.24, 0.7], rot:  0.005, cool: [0.92, 0.97, 1.0], warm: [1.0, 0.96, 0.90] },
  ];
  const starPoints = [];
  SHELLS.forEach((L, li) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(L.count * 3);
    const col = new Float32Array(L.count * 3);
    const siz = new Float32Array(L.count);
    const ph = new Float32Array(L.count);
    const sp = new Float32Array(L.count);
    for (let i = 0; i < L.count; i++) {
      // 单位球随机方向（均匀）
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const R = L.R * (1 + (Math.random() - 0.5) * 0.12);
      pos[i * 3] = s * Math.cos(th) * R;
      pos[i * 3 + 1] = u * R;
      pos[i * 3 + 2] = s * Math.sin(th) * R;
      const cool = Math.random();
      const mix = Math.pow(Math.random(), 2.0);
      const b = L.bright[0] + (L.bright[1] - L.bright[0]) * mix;
      col[i * 3] = (L.cool[0] * (1 - cool) + L.warm[0] * cool) * b;
      col[i * 3 + 1] = (L.cool[1] * (1 - cool) + L.warm[1] * cool) * b;
      col[i * 3 + 2] = (L.cool[2] * (1 - cool) + L.warm[2] * cool) * b;
      siz[i] = L.size[0] + (L.size[1] - L.size[0]) * Math.pow(Math.random(), 1.6);
      ph[i] = Math.random() * Math.PI * 2;
      sp[i] = 0.4 + Math.random() * 1.6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(sp, 1));
    const mat = makeParticleMat();
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    starPoints.push({ pts, rot: L.rot });
    disposables.push(geo, mat);
  });

  /* ============ 2. 主星云（Sprite 云团，青金/蓝紫低饱和） ============ */
  const blobTex = makeBlobTexture();
  const NEB_CFG = [
    { fx:  0.00, fy:  0.30, scale: 0.34, depth: 200, col: 0x39498f, op: 0.16, spd: 0.30, ph: 0.0 },
    { fx: -0.24, fy:  0.42, scale: 0.25, depth: 185, col: 0x246b82, op: 0.15, spd: 0.24, ph: 1.1 },
    { fx:  0.24, fy:  0.40, scale: 0.27, depth: 215, col: 0x2c4d7e, op: 0.15, spd: 0.27, ph: 2.2 },
    { fx: -0.42, fy:  0.20, scale: 0.19, depth: 195, col: 0x4a3a76, op: 0.13, spd: 0.21, ph: 3.3 },
    { fx:  0.44, fy:  0.18, scale: 0.17, depth: 225, col: 0x6e5c38, op: 0.10, spd: 0.23, ph: 4.4 },
    { fx: -0.15, fy:  0.58, scale: 0.15, depth: 205, col: 0x3d7f93, op: 0.13, spd: 0.32, ph: 0.7 },
    { fx:  0.17, fy:  0.56, scale: 0.13, depth: 190, col: 0x5a559e, op: 0.12, spd: 0.28, ph: 1.8 },
    { fx:  0.00, fy:  0.40, scale: 0.13, depth: 235, col: 0x9fbcc4, op: 0.08, spd: 0.19, ph: 5.0 },
  ];
  const nebSprites = NEB_CFG.map((c) => {
    const mat = new THREE.SpriteMaterial({
      map: blobTex, color: c.col, transparent: true,
      opacity: c.op, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    mat.rotation = Math.random() * Math.PI;
    const sp = new THREE.Sprite(mat);
    sp.frustumCulled = false;
    sp.scale.setScalar(c.scale); // 相对可见高度比例，layout 时换算成世界尺寸
    sp.userData.cfg = c;
    scene.add(sp);
    disposables.push(mat);
    return sp;
  });

  /* ============ 3. 银河/星带（对角微弧，横贯） ============ */
  const GALAXY_N = 250;
  const bandGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(GALAXY_N * 3);
  const bCol = new Float32Array(GALAXY_N * 3);
  const bSiz = new Float32Array(GALAXY_N);
  const bPh = new Float32Array(GALAXY_N);
  const bSp = new Float32Array(GALAXY_N);
  bandGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bandGeo.setAttribute('aColor', new THREE.BufferAttribute(bCol, 3));
  bandGeo.setAttribute('aSize', new THREE.BufferAttribute(bSiz, 1));
  bandGeo.setAttribute('aPhase', new THREE.BufferAttribute(bPh, 1));
  bandGeo.setAttribute('aSpeed', new THREE.BufferAttribute(bSp, 1));
  const bandMat = makeParticleMat();
  const bandPts = new THREE.Points(bandGeo, bandMat);
  const bandGroup = new THREE.Group();
  bandGroup.add(bandPts);
  scene.add(bandGroup);
  disposables.push(bandGeo, bandMat);

  const BAND_DEPTH = 620;
  function regenBand() {
    const rng = mulberry32(20240907);
    const halfY = halfAt(BAND_DEPTH);
    const halfW = halfY * aspect;
    for (let i = 0; i < GALAXY_N; i++) {
      // λ: 沿对角方向 -1..1
      const u = rng() * 2 - 1;
      const x0 = u * halfW;
      const y0 = u * halfY * 0.86 + (1 - u * u) * halfY * 0.22; // 中间略拱起
      // 平面内法向宽度扰动
      const v = (rng() - 0.5) * 2;
      const width = v * halfY * 0.085;
      const lx = halfW, ly = halfY * 0.86;
      const nLen = Math.hypot(ly, lx);
      const nx = ly / nLen, ny = -lx / nLen;
      bPos[i * 3] = x0 + nx * width + (rng() - 0.5) * 6;
      bPos[i * 3 + 1] = y0 + ny * width + (rng() - 0.5) * 6;
      bPos[i * 3 + 2] = -BAND_DEPTH - (1 - u * u) * 130 + (rng() - 0.5) * 26;
      // 亮度：边缘/两端渐隐，少量亮星点缀
      const big = rng() < 0.10;
      const fadeV = Math.max(0, 1 - Math.abs(v) * 1.15);
      const fadeU = 1 - Math.pow(Math.max(0, Math.abs(u) - 0.86) / 0.14, 2);
      const base = big ? 0.28 + rng() * 0.3 : 0.035 + rng() * 0.075;
      const f = base * fadeV * fadeU * (0.85 + rng() * 0.3);
      bCol[i * 3] = 0.92 * f;
      bCol[i * 3 + 1] = 0.96 * f;
      bCol[i * 3 + 2] = 1.0 * f;
      bSiz[i] = (big ? 1.6 : 0.7 + rng() * 0.9) * (0.8 + rng() * 0.6);
      bPh[i] = rng() * Math.PI * 2;
      bSp[i] = 0.4 + rng() * 1.5;
    }
    bandGeo.attributes.position.needsUpdate = true;
    bandGeo.attributes.aColor.needsUpdate = true;
    bandGeo.attributes.aSize.needsUpdate = true;
    bandGeo.attributes.aPhase.needsUpdate = true;
    bandGeo.attributes.aSpeed.needsUpdate = true;
    bandGeo.computeBoundingSphere();
  }
  regenBand();

  /* ============ 4. 灵尘（≤60，青金微光自下而上升腾） ============ */
  const DUST_N = 50;
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST_N * 3);
  const dCol = new Float32Array(DUST_N * 3);
  const dSiz = new Float32Array(DUST_N);
  const dPh = new Float32Array(DUST_N);
  const dSp = new Float32Array(DUST_N);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute('aColor', new THREE.BufferAttribute(dCol, 3));
  dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dSiz, 1));
  dustGeo.setAttribute('aPhase', new THREE.BufferAttribute(dPh, 1));
  dustGeo.setAttribute('aSpeed', new THREE.BufferAttribute(dSp, 1));
  dustGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  dustGeo.attributes.aColor.setUsage(THREE.DynamicDrawUsage);
  const dustMat = makeParticleMat();
  const dustPts = new THREE.Points(dustGeo, dustMat);
  scene.add(dustPts);
  disposables.push(dustGeo, dustMat);

  const dust = [];
  for (let i = 0; i < DUST_N; i++) {
    const gold = Math.random() < 0.35;
    const seed = {
      fx: (Math.random() * 2 - 1) * 0.72,
      depth: 165 + Math.random() * 95,
      rise: 0.012 + Math.random() * 0.018,   // 周/秒（一程 ~35-80s）
      phase: Math.random(),
      driftPh: Math.random() * Math.PI * 2,
      driftAmp: 3 + Math.random() * 5,
      base: gold ? [1.0, 0.86, 0.60] : [0.55, 0.95, 0.95],
    };
    dust.push(seed);
    dSiz[i] = 1.0 + Math.random() * 2.0;
    dPh[i] = Math.random() * Math.PI * 2;
    dSp[i] = 0.6 + Math.random() * 1.4;
    dCol[i * 3] = dCol[i * 3 + 1] = dCol[i * 3 + 2] = 0;
  }
  function updateDust(t) {
    for (let i = 0; i < DUST_N; i++) {
      const s = dust[i];
      const p = (t * s.rise + s.phase) % 1;
      const fy = -1.25 + p * 1.80; // -1.25(屏下) → 0.55(中上部)
      const halfY = halfAt(s.depth);
      const x = s.fx * halfY * aspect + Math.sin(t * 0.25 + s.driftPh) * s.driftAmp;
      const y = fy * halfY;
      dPos[i * 3] = x;
      dPos[i * 3 + 1] = y;
      dPos[i * 3 + 2] = -s.depth;
      // 顶部渐隐 + 细微闪烁
      const fade = Math.min(1, Math.max(0, (0.55 - fy) / 0.18));
      const tw = 0.78 + 0.22 * Math.sin(t * 2.0 + dPh[i]);
      const f = Math.max(0, fade) * tw * 0.62;
      dCol[i * 3] = s.base[0] * f;
      dCol[i * 3 + 1] = s.base[1] * f;
      dCol[i * 3 + 2] = s.base[2] * f;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustGeo.attributes.aColor.needsUpdate = true;
  }

  /* ============ 5. 远方仙月（冷白月轮 + 环晕） ============ */
  const moonTex = makeMoonTexture();
  const moonMat = new THREE.SpriteMaterial({
    map: moonTex, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.NormalBlending,
  });
  const moon = new THREE.Sprite(moonMat);
  moon.frustumCulled = false;
  const MOON = { fx: 0.60, fy: 0.52, depth: 520, scale: 0.30 };
  scene.add(moon);
  disposables.push(blobTex, moonTex, moonMat);

  /* ---------- 布局（随视口变化，把分数坐标换算到世界） ---------- */
  function halfAt(d) { return d * TAN_HALF; }
  function layout() {
    for (const sp of nebSprites) {
      const c = sp.userData.cfg;
      const halfY = halfAt(c.depth);
      const hw = halfY * aspect;
      sp.position.set(c.fx * hw, c.fy * halfY, -c.depth);
      sp.scale.setScalar(c.scale * halfY * 2);
    }
    const mh = halfAt(MOON.depth);
    moon.position.set(MOON.fx * mh * aspect, MOON.fy * mh, -MOON.depth);
    moon.scale.setScalar(MOON.scale * mh * 2);
    regenBand();
  }

  /* ---------- 尺寸/DPR ---------- */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || window.innerWidth || 1);
    const h = Math.max(1, rect.height || window.innerHeight || 1);
    const pr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    layout();
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ---------- 主循环与可见性省电 ---------- */
  let running = true, rafId = 0;
  let last = performance.now();
  let time = 0;

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    const t = time;

    // 星层自转（视差）
    for (let i = 0; i < starPoints.length; i++) {
      starPoints[i].pts.rotation.y = t * starPoints[i].rot;
    }
    // 银河带缓慢偏转
    bandGroup.rotation.y = t * 0.0032;

    // 相机缓慢漂移 → 近/远内容产生柔和视差
    camera.position.x = Math.sin(t * 0.021) * 6.5;
    camera.position.y = Math.sin(t * 0.013 + 1.3) * 4.5;
    camera.position.z = Math.sin(t * 0.008 + 0.6) * 2.5;
    camera.lookAt(0, Math.sin(t * 0.02) * 2.2, -640);

    // 星云浮动 + 明暗呼吸
    for (const sp of nebSprites) {
      const c = sp.userData.cfg;
      const bx = sp.position.x, by = sp.position.y;
      sp.position.x = bx + Math.sin(t * c.spd + c.ph) * 1.8;
      sp.position.y = by + Math.cos(t * c.spd * 0.7 + c.ph * 1.3) * 1.4;
      sp.material.opacity = c.op * (0.78 + 0.22 * Math.sin(t * c.spd + c.ph * 2.7));
    }
    // 仙月轻呼吸
    moonMat.opacity = 0.85 * (0.93 + 0.07 * Math.sin(t * 0.18 + 1.2));
    const mBaseY = MOON.fy * halfAt(MOON.depth);
    moon.position.y = mBaseY + Math.sin(t * 0.11 + 0.8) * 2.5;

    // 灵尘
    updateDust(t);

    // 统一推送时间 uniform
    const pr = renderer.getPixelRatio();
    for (const m of [starPoints[0].pts.material, starPoints[1].pts.material, starPoints[2].pts.material, bandMat, dustMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uPixelRatio.value = pr;
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  function onVis() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }
  document.addEventListener('visibilitychange', onVis);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVis);
      ro.disconnect();
      disposables.forEach((d) => {
        if (d.dispose) d.dispose();
        if (d.geometry) d.geometry.dispose();
        if (d.material) {
          if (Array.isArray(d.material)) d.material.forEach((m) => m.dispose());
          else d.material.dispose();
        }
      });
      renderer.dispose();
    },
  };
}

export { initDeepSpace };
export default initDeepSpace;
