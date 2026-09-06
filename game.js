/* 洞天 · 挂机修仙 —— game.js v2(凡人体系) */
"use strict";

/* ============ 境界体系(凡人修仙传风) ============
 * 炼气 1~13 层; 其余大境分 初期/中期/后期/圆满
 * 人界: 凡人 → 炼气 → 筑基 → 结丹 → 元婴 → 化神(本版终点, 静候飞升)
 */
const SEG4 = ["前期", "中期", "后期", "圆满"];
const BIGS = [
  { n: "凡人", segs: 1, color: "#9fc3ff", c: [159,195,255] },
  { n: "炼气", segs: 13, color: "#7fe0ff", c: [127,224,255] },
  { n: "筑基", segs: 4, color: "#7fe0c3", c: [127,224,195] },
  { n: "结丹", segs: 4, color: "#e8c56b", c: [232,197,107] },
  { n: "元婴", segs: 4, color: "#c59bff", c: [197,155,255] },
  { n: "化神", segs: 4, color: "#ffab6b", c: [255,171,107] },
];
const TOTAL_SEGS = BIGS.reduce((s, b) => s + b.segs, 0);   // 30 段

// 段 → 元数据
const SEG_META = [];
(function buildSegs() {
  let cum = 0;
  for (let bi = 0; bi < BIGS.length; bi++) {
    const big = BIGS[bi];
    for (let s = 0; s < big.segs; s++, cum++) {
      let label, isBigEnd = false;
      if (big.n === "凡人") {
        label = "凡人";
      } else if (big.n === "炼气") {
        label = `${big.n}·${cnNum(s + 1)}层`;
        isBigEnd = (s === big.segs - 1);
      } else {
        label = `${big.n}·${SEG4[s]}`;
        isBigEnd = (s === big.segs - 1);
      }
      const need = Math.round(1000 * Math.pow(2.72, cum * 0.55) / 100) * 100;
      SEG_META.push({ bigIdx: bi, big: big.n, label, need, isBigEnd,
        color: big.color, c: big.c, segNo: s + 1,
        sub: bigSub(bi) });
    }
  }
})();
function cnNum(n) {
  return ["一","二","三","四","五","六","七","八","九","十","十一","十二","十三"][n - 1] || n;
}
function bigSub(bi) {
  return [
    "灵根初启 · 洞天福地", "引气入体 · 洗髓易经", "真元化液 · 仙凡之隔",
    "凝液化固 · 金丹大道", "丹破婴生 · 大道初成", "元婴化神 · 人界之巅"
  ][bi] || "";
}

/* ============ 法宝(凡人修仙传梗致敬) ============ */
const QUALITY = [ // 名/权重/倍率/颜色(符器→玄天)
  { name: "粗制", w: 40, mult: 1.10, cls: "q1" },
  { name: "法器", w: 30, mult: 1.30, cls: "q2" },
  { name: "灵器", w: 16, mult: 1.58, cls: "q3" },
  { name: "古宝", w: 8,  mult: 2.00, cls: "q4" },
  { name: "灵宝", w: 4,  mult: 2.70, cls: "q5" },
  { name: "玄天", w: 2,  mult: 3.80, cls: "q6" },
];
const ART_PREFIX = ["青竹", "金雷", "墨蛟", "噬金", "太阴", "离火", "九幽", "乾蓝", "天外", "血凝", "碧磷", "玄冰", "紫檀", "五色", "遁地", "化血"];
const ART_SUFFIX = ["飞剑", "古印", "小幡", "玄镜", "宝珠", "仙鼎", "葫芦", "玉尺", "金锁", "飞针", "法螺", "神灯"];
const ART_SPECIAL = [ // 稀有致敬掉落: [品质下限, 名字]
  [3, "青竹蜂云剑"], [4, "七十二口蜂云剑阵"], [3, "金雷竹符"],
  [3, "噬金虫母卵"], [4, "掌天瓶·灵液"], [5, "大衍决·残页"],
  [4, "血凝阴魔幡"], [5, "乾蓝冰焰"], [5, "墨蛟内丹"],
  [6, "玄天斩灵剑"], [6, "神秘小瓶(绿光)"],
];

/* ============ 历险奇遇文案(按大境界分层) ============ */
const EVENTS = [
  // 凡人期
  [
    "分身于后山采药，撞见两只獐子争食灵果，捡了漏，得灵石",
    "山神庙中打坐三日，忽闻滴水声，石缝里竟有灵泉，修为微涨",
    "替镇上老翁修补屋顶，老翁赠一册泛黄《吐纳口诀》，有所悟",
    "溪边偶见锦鲤跃龙门之相，观鱼悟道，修为精进",
    "七玄门杂役处领到一株黄精，服下后气血两旺",
  ],
  // 炼气
  [
    "掌心浮现一枚神秘小瓶，瓶内绿光氤氲，灵液滴入药圃，修为大涨",
    "在坊市地摊淘到半张残破丹方，依方炼成一炉小还丹",
    "夜探乱石岗，斩一条寻衅的黑纹蛇，蛇胆入药修为精进",
    "山涧遇险坠落，崖底山洞中寻到前人遗蜕与储物袋",
    "与同门切磋三场，两胜一负，于实战中有所顿悟",
  ],
  // 筑基
  [
    "御剑穿云时，撞上一只驮碑老龟，龟背竟刻着上古引灵纹",
    "黄枫谷外妖雾弥漫，分身除妖归来，携回一袋妖兽材料",
    "闭关百日，丹田真元又凝一分；出关时月华如练，心有所感",
    "偶入一处废弃药园，掘得五百年人参一株",
  ],
  // 结丹
  [
    "寻到一处灵气眼，布下聚灵阵，金丹飞速旋转，修为大涨",
    "魔道修士上门挑衅，被分身一剑逼退，缴获半部魔功残卷",
    "深入血色禁地外围，采得赤血果，丹火淬炼后受益匪浅",
    "古修士洞府现世，夺宝者众；分身取走一件古宝后遁走",
  ],
  // 元婴
  [
    "元婴出窍夜游，遥见天际一道遁光坠入深谷，拾得一枚储物戒",
    "虚天殿开启传闻四起，分身在外围寻得灵宝碎片一枚",
    "与同阶道友论道七日，交换功法心得，瓶颈松动",
    "心魔悄然滋生，分身静坐斩之，道心愈发稳固",
  ],
  // 化神
  [
    "引动天地灵气灌体，周遭草木疯长，修为暴涨一大截",
    "于灵界裂缝边缘感应到一股精纯元气，摄来炼化",
    "渡一小劫，雷火淬体；虽险，然受益无穷",
    "遥望星空，忽有所悟：此界之外，尚有灵界在焉",
  ],
];

/* ============ 存档 ============ */
let state = { realmIdx: 0, exp: 0, spirit: 0, arrayLv: 1, arts: [], lastTs: Date.now() };
let breaking = false;
let lastReadyHint = false;
const SAVE_KEY = "dongtian_xiuxian_v2";
const OFFLINE_CAP = 6 * 3600;

const $ = id => document.getElementById(id);
const fmt = n => n >= 1e8 ? (n / 1e8).toFixed(2).replace(/\.?0+$/, "") + "亿"
             : n >= 1e4 ? (n / 1e4).toFixed(1).replace(/\.0$/, "") + "万"
             : Math.floor(n).toLocaleString();

function seg(i) { return SEG_META[Math.min(i, TOTAL_SEGS - 1)]; }
function realm() { return seg(state.realmIdx); }
function bigIdx() { return realm().bigIdx; }

function save() {
  state.lastTs = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && Array.isArray(s.arts)) state = s;
  } catch (e) {}
}

/* ============ 数值 ============ */
function realmMult() { return Math.pow(bigIdx() + 1, 2.05); } // 大境界指数
function artMult() { return state.arts.reduce((m, a) => m * a.mult, 1); }
function rateNow() { return 4 * realmMult() * artMult() * (1 + (state.arrayLv - 1) * 0.35); }
function spiritRate() { return 0.15 + state.arrayLv * 0.06; }

function pickQ() {
  const t = QUALITY.reduce((s, r) => s + r.w, 0);
  let x = Math.random() * t;
  for (let i = 0; i < QUALITY.length; i++) { x -= QUALITY[i].w; if (x <= 0) return i; }
  return 0;
}
function makeArt() {
  const q = pickQ();
  let name;
  const sp = ART_SPECIAL.filter(s => q >= s[0]);
  if (sp.length && Math.random() < 0.5) {
    name = sp[Math.floor(Math.random() * sp.length)][1];
  } else {
    name = ART_PREFIX[Math.floor(Math.random() * ART_PREFIX.length)]
         + ART_SUFFIX[Math.floor(Math.random() * ART_SUFFIX.length)];
  }
  return { name, q, mult: QUALITY[q].mult, t: Date.now() };
}

/* ============ 界面 ============ */
function updateRealmUI() {
  const r = realm();
  if (r.big === "凡人") {
    $("realmName").textContent = "凡人";
    $("realmSub").textContent = r.sub + (state.realmIdx >= TOTAL_SEGS - 1 ? " · 已臻圆满" : "");
  } else if (r.big === "炼气") {
    $("realmName").textContent = "炼气";
    $("realmSub").textContent = `${cnNum(r.segNo)}层 · ${r.sub}`;
  } else {
    $("realmName").textContent = r.big;
    $("realmSub").textContent = `${r.label.split("·")[1]} · ${r.sub}`;
  }
  const aura = document.querySelector(".aura");
  if (aura) aura.style.background =
    `radial-gradient(circle,rgba(${r.c},.34),rgba(${r.c},.08) 42%,transparent 68%)`;
}
function updateHUD() {
  const r = realm();
  $("expText").textContent = fmt(state.exp);
  $("expNeed").textContent = r.need === Infinity ? "∞" : fmt(r.need);
  const pct = Math.min(100, state.exp / r.need * 100);
  $("expFill").style.width = pct + "%";
  $("spirit").textContent = fmt(state.spirit);
  $("rateText").textContent = fmt(rateNow());
  $("arrayLv").textContent = state.arrayLv;
  // 可渡劫: 处于大境界末尾且修为圆满
  const can = state.exp >= r.need && r.isBigEnd && state.realmIdx < TOTAL_SEGS - 1;
  const btn = $("btnBreak");
  btn.disabled = !can;
  btn.textContent = can ? "☯ 渡劫突破" : "☯ 立即突破";
  btn.classList.toggle("ready", can);
  if (can && !lastReadyHint) {
    lastReadyHint = true;
    const nextBig = seg(state.realmIdx + 1).big;
    log(`<span class="r">${r.big}·${段名(r)}已圆满</span>——你随时可亲手渡劫，踏入<span class="g">${nextBig}</span>`);
  }
  if (!can) lastReadyHint = false;
}
function 段名(r) {
  if (r.big === "凡人") return "";
  if (r.big === "炼气") return cnNum(r.segNo) + "层";
  return r.label.split("·")[1];
}

/* 大境界突破(手动) */
function doBreak() {
  if (breaking) return;
  const r = realm();
  if (state.exp < r.need || !r.isBigEnd || state.realmIdx >= TOTAL_SEGS - 1) return;
  breaking = true;
  const next = seg(state.realmIdx + 1);
  const fl = $("flash"); fl.style.transition = "none"; fl.style.opacity = .95;
  requestAnimationFrame(() => { fl.style.transition = "opacity 1.8s ease-out"; fl.style.opacity = 0; });
  const up = $("realmUp");
  $("realmUpT").textContent = next.big;
  $("realmUpT").style.fontSize = next.big.length > 2 ? "30px" : "40px";
  up.classList.remove("show"); void up.offsetWidth; up.classList.add("show");
  burstBoom();
  log(`<span class="r">天劫降临！</span>${r.label} → <span class="r">${next.label}</span>`);
  setTimeout(() => {
    state.realmIdx++;
    state.exp = 0;
    breaking = false;
    updateRealmUI(); updateHUD(); save();
    const nr = realm();
    const greet = ["金丹凝形！", "元婴出窍！", "化神之姿！", "踏入筑基！"][nr.bigIdx - 2] || "";
    log(`<span class="g">${nr.big}</span>！${greet || "修行又进一步"}`);
  }, 950);
}
function manualBreak() { doBreak(); }

/* 聚灵阵 */
function tapArray() {
  const cost = 60 * Math.pow(state.arrayLv, 1.8);
  if (state.spirit >= cost) { state.spirit -= cost; state.arrayLv++; save(); updateHUD(); }
  else log(`灵石不足(需 ${fmt(cost)})，<span class="r">分身正在四处寻矿</span>…`);
}

/* 日志 */
let logQueue = [];
function log(html) {
  logQueue.push(html); if (logQueue.length > 3) logQueue.shift();
  const el = $("logLine");
  el.innerHTML = logQueue.join("<br>");
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
}

/* 历险 */
function adventure() {
  const roll = Math.random();
  const bi = Math.min(bigIdx(), EVENTS.length - 1);
  const artChance = 0.05 + bi * 0.005;
  if (roll < artChance) {
    const a = makeArt();
    state.arts.push(a);
    const r = QUALITY[a.q];
    log(`分身历险拾得<span class="r">${a.name}</span>(<span class="${r.cls}">${r.name}</span>)，已自动装备`);
    updateArts(); save();
  } else if (roll < 0.30) {
    const g = Math.round(8 + Math.random() * 30 + bigIdx() * 10);
    state.spirit += g;
    log(`分身${EVENTS[bi][1 + Math.floor(Math.random() * Math.min(3, EVENTS[bi].length - 1))] || "采药得灵石"}, 获灵石 <span class="g">${g}</span>`);
  } else if (roll < 0.6) {
    const g = Math.round(14 + Math.random() * 50 + bigIdx() * 16);
    state.spirit += g;
    log(`${EVENTS[bi][Math.floor(Math.random() * EVENTS[bi].length)]}，得灵石 <span class="g">${g}</span>`);
  } else if (roll < 0.78) {
    const bonus = rateNow() * (4 + Math.random() * 8);
    state.exp += bonus;
    log(`分身${EVENTS[bi][Math.floor(Math.random() * EVENTS[bi].length)]}，修为精进`);
  } else if (roll < 0.9) {
    log(`分身于洞府中静坐吐纳，灵力缓缓沉淀`);
  }
  state.spirit += spiritRate();
  updateHUD();
}

function updateArts() {
  const row = $("artRow");
  row.innerHTML = state.arts.slice(-6).map(a =>
    `<span class="art"><span class="q ${QUALITY[a.q].cls}">${QUALITY[a.q].name}</span>${a.name}</span>`
  ).join("");
  while (state.arts.length > 6) {
    const old = state.arts.shift();
    state.spirit += Math.round(60 * Math.pow(1.6, old.q));
  }
}

/* ============ 突破粒子 ============ */
const bcv = $("burst"), bctx = bcv.getContext("2d");
let parts = [];
function sizeBurst() { bcv.width = innerWidth; bcv.height = innerHeight; }
sizeBurst(); addEventListener("resize", sizeBurst);
function burstBoom() {
  const cx = innerWidth / 2, cy = innerHeight * 0.46;
  for (let i = 0; i < 120; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 8;
    parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.4,
      life: 1, size: 1.5 + Math.random() * 2.8, color: Math.random() < .75 ? "232,197,107" : "255,240,200" });
  }
}
function tickBurst(dt) {
  parts = parts.filter(p => p.life > 0);
  if (!parts.length) { bctx.clearRect(0, 0, bcv.width, bcv.height); return; }
  bctx.clearRect(0, 0, bcv.width, bcv.height);
  bctx.globalCompositeOperation = "lighter";
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += .09; p.life -= dt * 1.2;
    bctx.fillStyle = `rgba(${p.color},${Math.max(0, p.life)})`;
    bctx.beginPath(); bctx.arc(p.x, p.y, Math.max(0, p.size * p.life), 0, 7); bctx.fill();
  }
  bctx.globalCompositeOperation = "source-over";
}

/* ============ 离线收益 ============ */
function applyOffline() {
  const now = Date.now();
  let dt = (now - state.lastTs) / 1000;
  if (dt < 30) return;
  dt = Math.min(dt, OFFLINE_CAP);
  const gainExp = rateNow() * dt * 0.6;
  const gainSpirit = spiritRate() * dt * 0.7;
  let guard = 0;
  while (guard++ < 60) {
    const r = realm();
    if (r.isBigEnd) break; // 大境界之间不自动渡劫, 等你亲手
    if (state.exp + gainExp >= r.need && state.realmIdx < TOTAL_SEGS - 1) {
      state.realmIdx++; state.exp = 0;
    } else break;
  }
  state.exp += gainExp; state.spirit += gainSpirit;
  save();
  const h = Math.floor(dt / 3600), m = Math.floor(dt % 3600 / 60);
  $("offlineText").innerHTML =
    `你离开了 <b>${h ? h + " 小时 " : ""}${m ? m + " 分钟" : "片刻"}</b>。<br>` +
    `分身闭关，修为 +<span class="num"> ${fmt(gainExp)}</span><br>灵石 +<span class="num"> ${fmt(gainSpirit)}</span>`;
  $("offlineModal").classList.add("show");
  updateRealmUI(); updateHUD();
}
function closeOffline() { $("offlineModal").classList.remove("show"); }

/* ============ three.js 背景 ============ */
async function initBg() {
  try { await initBg3D(); }
  catch (e) { console.warn("WebGL 不可用，降级星空", e); document.body.classList.add("no-webgl"); }
}
async function initBg3D() {
  const THREE = await import("three");
  const canvas = $("bg");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x070b16);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b16, 0.02);
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
  camera.position.set(0, 0.4, 11);
  const starGeo = new THREE.BufferGeometry();
  const sn = 650, sp = [];
  for (let i = 0; i < sn; i++) {
    const r = 24 + Math.random() * 50, t = Math.random() * Math.PI * 2;
    sp.push(Math.cos(t) * r, Math.random() * 26 - 2, Math.sin(t) * r);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9db6ff, size: 0.22, transparent: true, opacity: .85, sizeAttenuation: true }));
  scene.add(stars);
  const mountMat = new THREE.MeshBasicMaterial({ color: 0x0e1830 });
  for (const [x, y, z] of [[-9,1.4,-20],[-4.5,2.6,-22],[0.5,1.2,-24],[5.5,3.0,-21],[10,1.6,-19],[-13,.9,-16],[13.5,1.1,-17]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(2.6 + Math.random() * 1.6, 4 + Math.random() * 3, 5), mountMat);
    m.position.set(x, y - 2, z); m.scale.set(1, 1.6, 0.5); scene.add(m);
  }
  const dustGeo = new THREE.BufferGeometry();
  const dn = 90, dp = [];
  for (let i = 0; i < dn; i++) dp.push((Math.random() - .5) * 24, (Math.random() - .2) * 16, -3 + Math.random() * 7);
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe8c56b, size: .05, transparent: true, opacity: .7, sizeAttenuation: true, blending: THREE.AdditiveBlending }));
  scene.add(dust);
  let last = performance.now(), px = 0, py = 0, tpx = 0, tpy = 0;
  addEventListener("pointermove", e => { tpx = e.clientX / innerWidth - .5; tpy = e.clientY / innerHeight - .5; });
  addEventListener("touchmove", e => { tpx = e.touches[0].clientX / innerWidth - .5; tpy = e.touches[0].clientY / innerHeight - .5; }, { passive: true });
  (function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    stars.rotation.y += dt * .008; dust.rotation.y += dt * .012;
    const pos = dustGeo.attributes.position;
    for (let i = 1; i < pos.count; i += 3) { pos.array[i] += dt * .08; if (pos.array[i] > 8) pos.array[i] = -8; }
    pos.needsUpdate = true;
    px += (tpx - px) * .03; py += (tpy - py) * .03;
    camera.position.x = px * 1.4; camera.position.y = .4 + py * .9;
    camera.lookAt(0, .4, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })(performance.now());
}

/* ============ 主循环 ============ */
function loop(dt) {
  const r = realm();
  if (!breaking) {
    state.exp += rateNow() * dt;
    // 小层/同大境自动精进; 大境界末尾(圆满)等玩家手动渡劫
    let guard = 0;
    while (!breaking && state.exp >= r.need && !r.isBigEnd && state.realmIdx < TOTAL_SEGS - 1 && guard++ < 8) {
      state.exp -= r.need;
      state.realmIdx++;
      const nr = realm();
      log(`修为精进 → <span class="g">${nr.big === "炼气" ? "炼气" + cnNum(nr.segNo) + "层" : nr.label}</span>`);
      updateRealmUI();
    }
  }
  updateHUD();
  if (Math.random() < dt * 0.8) adventure();
  tickBurst(dt);
}

/* ============ 启动 ============ */
load();
applyOffline();
updateRealmUI();
updateHUD();
updateArts();
setInterval(save, 8000);
addEventListener("pagehide", save);
initBg();
let lastLoop = performance.now();
(function main() {
  const now = performance.now();
  const dt = Math.min(.1, (now - lastLoop) / 1000); lastLoop = now;
  loop(dt);
  requestAnimationFrame(main);
})();

/* 调试句柄(便于测试/调参) */
window.__game = {
  get state() { return state; },
  setRealm: i => { state.realmIdx = i; state.exp = 0; updateRealmUI(); updateHUD(); },
  giveExp: n => { state.exp += n; updateHUD(); },
  save, load,
};
