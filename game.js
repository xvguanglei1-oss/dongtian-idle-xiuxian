/* 洞天 · 挂机修仙 —— game.js v3(双栏叙事) */
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

/* ============ 历险奇遇文案(按大境界分层 · v3 大扩) ============
 * 分身经历的句子池(每境 16~24 句)。句子为“发生了什么”,
 * 收益(灵石/修为)由 adventure() 统一追加, 保证句式丰富不重复。
 */
const EVENTS = [
  // 凡人期(凡俗起步)
  [
    "替富户看守灵田一月，夜半总闻田里细碎响动，循去只见灵苗自己拔节",
    "在七玄门茶棚听散修论道，趁兴记下半篇吐纳口诀",
    "村口老井深夜泛绿光，探手捞上一枚温润玉坠",
    "攀崖采药救下一只白鹤，鹤绕梁三日，衔来一枚青涩灵果",
    "给炼丹房跑了三年腿，偷记下一副安神丹的配伍",
    "山中避雨闯进废弃狐庙，神像底座砖缝里嵌着半块灵玉",
    "用十年积蓄在坊市换来一株蔫灵灵的药草，种在院中竟一日日返青",
    "替猎户整理陷阱，套住一头吐息成雾的老狐，皮毛换回一瓶灵液",
    "秋收时在自家田垄尽头挖出一节比手臂还长的何首乌",
    "半夜听见屋后有金铁交鸣，探头见两道光影掠过，原地落下几枚圆石",
    "被选派看守药库，趁机把百种灵药性味背得滚瓜烂熟",
    "在溪边磨刀，刀锋映出七彩虹晕，刀刃从此不沾腥锈",
  ],
  // 炼气
  [
    "神秘小瓶又在掌心发烫，倒出的灵液浇在药圃，草叶一夜挂满露珠",
    "坊市地摊淘到半页残方，依样开炉，竟炼出一炉喷香的黄芽丹",
    "替师门清扫藏经阁，指尖拂过某卷竹简时，一段口诀烙进脑海",
    "灌溉灵田时引动地底灵泉，渠水倒涌，整片灵稻拔高三寸",
    "下山采买遇上劫修，缠斗后脱身，顺手抄走对方遗落的储物袋",
    "密林深处传来剑鸣，循声寻去，一柄无主飞剑插在青石上轻颤",
    "炼丹炸了炉被罚面壁，却在壁后暗格里摸到一本前人手记",
    "随猎妖队深入妖兽谷，归途在巢穴边捡到一枚温热的兽卵",
    "替村民驱逐拱田的野猪妖，妖血渗进土里，来年那块田灵稻双穗",
    "把掌心聚水术练得出神入化，一指虚点，水珠凝成雀鸟绕身三匝",
    "在矿脉外围抠出几块碎灵石，磨粉换到一本粗浅身法",
    "连看七日同门斗法，夜半独自比划，竟悟出一记金盾法门",
    "偷入前辈闭关的石室打坐，蹭得一线残留灵气，经脉微胀",
    "悬瀑之后藏着水帘洞天，壁上刻满前人筑基的批注",
    "试炼途中失足坠入寒潭，寒气灌体，反淬出一缕精纯真气",
    "救下一名重伤散修，对方赠一枚回气丹，言道来日再会",
    "误食崖畔赤红野果，药力横冲直撞，疼出一身汗后修为小进",
    "十五月圆登高吐纳，引下一缕月华，四肢百骸暖融融的",
    "初学御风术渡江，江心巨鱼跃出水面相伴十里",
    "宗门药田大比，他培育的灵草变异出银纹，拔得头筹",
    "古战场边缘拾到半截锈剑，剑脊里封着一丝剑意，夜夜铮鸣",
    "替杂役处修补法器，顺手把裂纹烧成云纹，管事多赏了三枚灵石",
    "入夜演练新悟的遁术，身形连闪，惊起一林宿鸟",
    "在灵泉眼边栽下的那株蔫草终于开花，花瓣竟呈淡金色",
  ],
  // 筑基
  [
    "御剑穿云撞上一只驮碑老龟，龟背铭文竟是一部残缺引灵诀",
    "黄枫谷外妖雾翻涌，他除妖归来，腰悬的布袋沉甸甸的",
    "闭关百余日，丹田真元又凝一分，出关时灵雨随行三尺",
    "闯进一座荒废药园，篱下掘出五百年紫灵芝",
    "替同门重炼本命法器，火候拿捏入微，器成时嗡鸣如钟",
    "拍卖会上盯上一枚无标价古玉，加价三倍竞得，玉中竟藏山河图",
    "夜探魔道据点，盗回一份标注灵脉节点的舆图",
    "与海外散修互换功法，习得一门踏浪而行的水系身法",
    "灵泉眼边闭关数日，引泉中灵气温养丹基",
    "深夜地脉轻震，循裂缝而下，发现一簇微型灵晶",
    "破解上古傀儡遗迹的连环机关，取出一枚傀儡核心",
    "为淬心境化装凡人行医三月，救活一镇时疫，归来道心通明",
    "登顶通天古木静坐，借万丈霞光涤荡真元",
    "幽深地宫里，壁画上竟演着整套阵法的推演",
    "护送商队穿越妖岭，几番险死还生，瓶颈竟自行松动",
    "断崖观云海翻涌，忽然明白御剑时那股气流该怎么借",
    "炼化一滴万年灵乳，经脉铮铮作响，强韧数分",
    "从老蛟口中夺下一株珊瑚血草，负伤而归却觉值当",
    "参研上古丹方，炼成一炉续元灵髓丹，丹香三日不散",
    "雷雨夜引雷淬器，法器灵性大增，天际隐有异象",
    "替故人修补洞府禁制，对方以一块空青石相酬，石中竟孕着灵液",
    "溪谷尽头静坐，看游鱼逆流而上，忽有所悟，顺势凝出一缕剑罡",
  ],
  // 结丹
  [
    "灵气眼上布阵闭关，金丹嗡鸣旋动，修为稳步上涨",
    "魔道长老上门寻衅，他剑气横空，逼退来人还缴下半部魔功残卷",
    "潜入血色禁地外围，采得赤血果，丹火煅烧后纳入金丹",
    "古修士洞府现世群雄夺宝，他取一件古宝，化虹遁走",
    "为炼剑域，于荒山演练万剑，剑鸣七日方歇",
    "拍卖会拍下一枚妖丹，丹火炼化，金丹凝实三分",
    "与同阶道友论道三日，印证所悟，道基更稳",
    "潜入深海遗府，收服一头幼年灵兽为护法",
    "于雷池边缘静坐，吸纳雷霆真意，金丹浮现细密雷纹",
    "替旧识破解一道上古禁制，获赠一卷凝婴秘术手抄",
    "南疆遇瘴，采得解毒圣药，还悟出护体毒罡的雏形",
    "寻到化神前辈的洞府遗址，拾得一本修炼杂记",
    "与妖王当面谈判，为宗门换得一方灵矿的开采权",
    "以金丹之火重炼本命法宝，宝光内敛，品阶再升",
    "万仞孤峰闭关，引星辉淬炼神识",
    "破解一幅古画禁制，画中竟藏着一门金丹神通",
    "炼制婴丹缺一味主药，远赴极北挖回冰髓草",
    "大漠深处寻到地火溶洞，以地火锻体，皮膜如铁",
    "静修中斩灭心魔幻象，道心坚如磐石",
    "观两名元婴老怪斗法三日，对大道之悟又深一层",
  ],
  // 元婴
  [
    "元婴出窍夜游，遥见一道遁光坠谷，循去拾回一枚储物戒",
    "虚天殿将启，他远赴海外打探，在外围寻得一块古宝碎片",
    "与同阶道友论道七日，交换心得，瓶颈隐有松动",
    "心魔滋扰，他以剑光斩之，道心复明",
    "灵眼之地闭关，元婴光华流转，隐有第二元神的雏形",
    "探上古宗门废墟，寻得一枚记载功法的玉简",
    "炼化千年玄冰之精，元婴染上寒意，神通却大涨",
    "亲手布下跨界传送阵，游历诸国，见识奇人异术",
    "于灵界裂缝边缘，摄来一缕精纯元气缓缓炼化",
    "助一方小宗门平定兽潮，受香火供奉，愿力凝神",
    "参透空间神通皮毛，遁速倍增，残影难辨",
    "东海之滨观潮起潮落，悟得真元循环不息之理",
    "与魔道巨擘隔空对了一掌，全身而退，获益良多",
    "寻得一处天然聚灵洞府，设下重重禁制作为道场",
    "在远古战场遗迹，感应到一道未散的剑意残痕",
    "炼制身外化身的材料齐了，开始孕育第二元婴",
    "行走人间广结善缘，心境愈发圆融",
    "在一株通天藤上发现上古灵种，小心翼翼种入灵田",
    "受困迷阵七日，破阵时对阵法之道豁然开朗",
    "夜观北斗，捕捉到一丝命星牵引之力，凝入元婴",
  ],
  // 化神
  [
    "引天地灵气灌体，草木疯长，境界再度精进",
    "灵界裂缝边缘静坐，摄界外元气淬炼元神",
    "渡一小劫，雷火加身，虽险犹荣",
    "遥望星河生悟：此界之外，尚有更广阔的天地",
    "开辟洞天雏形，纳入一缕混沌之气",
    "与灵界投影论道，得一缕上界修行感悟",
    "炼化混沌灵物，体内小世界愈发完整",
    "极渊之地镇压古兽，取其精血淬体",
    "参悟空间法则，已能短暂撕裂虚空而行",
    "于星辰坠落处悟道，心神随流星轨迹共振",
    "分化万千神识念头，同时参研数部天书",
    "以自身大道引动天象，万里灵云来朝",
    "在无尽海眼闭关，借海眼之力洗涤元神",
    "观想上古真龙之形，筋骨隐隐蜕变",
    "将剑意凝成一枚剑种埋于丹田，日夜温养",
    "与人界老怪论道，共参飞升之秘",
  ],
];
/* 拾装专属场景句 */
const ART_HINTS = [
  "某处坍塌洞府的禁制松动，泄出一线宝光",
  "溪流尽头的沉木匣被水冲开一角，内里生光",
  "夜空一道遁光坠入荒野，焦土中埋着遗落之物",
  "坊市地摊的障眼法被一眼看破，底下另有真品",
  "古战场缝隙里，指尖触到一件温润之物",
  "山崩后露出半间石室，案上供着一件蒙尘之物",
  "拍卖行流拍的杂件堆里，混着一件被看走眼的宝贝",
  "断崖鹰巢的枯枝间，有什么在微微发光",
];
/* 静坐吐纳专属句 */
const STILL_MOMENTS = [
  "寻一处清净地铺开蒲团，吐纳之间灵力缓缓沉淀",
  "循灵脉走向踱步半日，气息愈发绵长",
  "溪边青石上盘膝而坐，任水汽浸润经脉",
  "入定片刻，杂念尽消，丹田温润如春",
  "对着一盏烛火调息，火苗随呼吸轻轻摇曳",
  "倚在古松根下小憩，灵气随呼吸沉入丹田",
  "挑灯夜读丹书，烛影中体悟药性相生之理",
  "清晨于露台采气，朝霞入体，神清气爽",
];

/* 主角主线叙事(分大境界·右栏) */
const MAIN_STORY = [
  [ // 凡人
    "你盘坐院中，第一次捕捉到天地间若有若无的灵气",
    "对着一炉安神香静心，你感应到丹田深处一丝温热",
    "把吐纳口诀默诵百遍，气息渐长，胸中浊气尽去",
    "以山泉沐浴后枯坐，通体轻灵，似脱去一层凡壳",
    "你试着将意识沉入丹田，恍惚看见一片混沌灵光",
    "晨起练拳千遍，收势时你发觉拳风带起的水珠凝而不散",
  ],
  [ // 炼气
    "你默运功法，真气沿周天缓缓流淌，又凝一分",
    "参悟《长春功》要诀，你对吐纳之法的理解更深一层",
    "你将两缕真气合一，丹田微微一震，似有突破之兆",
    "静室中观想剑气纵横，剑意初生，锋芒暗藏",
    "你轻抚掌天瓶，瓶身微温，仿佛在回应你的修行",
    "咀嚼近日斗法心得，你举手投足间多了几分从容",
    "吐纳之际，一缕灵气盘桓不散，你知道根基又固一分",
    "你在月下演练新悟的遁术，身形如烟，落地无声",
  ],
  [ // 筑基
    "你盘坐筑基台，真元如溪汇入丹田，丹基愈发稳固",
    "凝神内视，经脉中流动的真元已泛出温润光泽",
    "以本命真火淬炼经脉，痛楚中修为悄然攀升",
    "参透玉简中前人筑基感悟，你茅塞顿开",
    "灵泉瀑下静坐半日，水声与心跳渐渐同频",
    "将飞行法器打磨一新，御剑而起时剑光圆润无滞",
    "你在洞府布下层层禁制，安心闭关冲击下一关口",
  ],
  [ // 结丹
    "金丹在丹田缓缓旋转，每转一周，真元便精纯一分",
    "以丹火温养金丹，丹体表面浮现细密灵纹",
    "神识内探，金丹之上似有异象流转",
    "你炼成一炉养丹灵液，浇灌金丹，丹力更盛",
    "洞府顶层引星辉入体，金丹轻轻震颤响应",
    "复盘结丹以来的际遇，你对道途有了更清晰的规划",
  ],
  [ // 元婴
    "元婴盘坐紫府，吞吐灵气如婴儿呼吸，气息绵长",
    "你以神念温养元婴，婴孩双目渐渐有了神采",
    "参悟元婴出窍之法，紫府传出婴孩般的轻笑",
    "将一缕剑意渡入元婴，小元婴竟比划着演练剑招",
    "元婴夜游归来，带回一段模糊的上古传承记忆",
    "凝神感应天地法则，元婴周身泛起大道涟漪",
  ],
  [ // 化神
    "元神与天地共鸣，你举手投足间皆合道韵",
    "以神识织网，方圆千里的灵气流动尽在感知",
    "你参悟飞升之秘，冥冥中感应到灵界的召唤",
    "将混沌元气炼入元神，元神宝光流转宛如琉璃",
    "山巅观日出，霞光万道中道心愈发通明",
    "随手一挥间山河变色，你知此界已困不住你",
  ],
];

/* ============ 存档 ============ */
let state = { realmIdx: 0, exp: 0, spirit: 0, arrayLv: 1, arts: [], journal: [], lastTs: Date.now() };
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
    if (s && Array.isArray(s.arts)) {
      if (!Array.isArray(s.journal)) s.journal = [];
      state = s;
    }
  } catch (e) {}
}

/* ============ 数值 ============ */
function realmMult() { return Math.pow(bigIdx() + 1, 2.05); } // 大境界指数
function artMult() { return state.arts.reduce((m, a) => m * a.mult, 1); }
function rateNow() { return 4 * realmMult() * artMult() * (1 + (state.arrayLv - 1) * 0.35); }
function spiritRate() { return 0.15 + state.arrayLv * 0.06; }

/* 品质与境界挂钩: 凡人只能粗制, 炼气→法器, 筑基→灵器, 结丹→古宝, 元婴→灵宝, 化神→玄天
 * 杜绝“炼气期用筑基期法宝”的越境体验 */
function maxQIdx() { return Math.min(bigIdx(), QUALITY.length - 1); }
function pickQ() {
  const pool = QUALITY.slice(0, maxQIdx() + 1);
  const t = pool.reduce((s, r) => s + r.w, 0);
  let x = Math.random() * t;
  for (let i = 0; i < pool.length; i++) { x -= pool[i].w; if (x <= 0) return i; }
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
    pushMsg("main", `<span class="r">${r.big}·${段名(r)}已圆满</span>——你随时可亲手渡劫，踏入<span class="g">${nextBig}</span>`);
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
  pushMsg("main", `<span class="r">天劫降临！</span>${r.label} → <span class="r">${next.label}</span>`);
  setTimeout(() => {
    state.realmIdx++;
    state.exp = 0;
    breaking = false;
    updateRealmUI(); updateHUD(); save();
    const nr = realm();
    const greet = ["金丹凝形！", "元婴出窍！", "化神之姿！", "踏入筑基！"][nr.bigIdx - 2] || "";
    pushMsg("main", `<span class="g">${nr.big}</span>！${greet || "修行又进一步"}`);
    realmPlot();
  }, 950);
}
function manualBreak() { doBreak(); }

/* 聚灵阵 */
function tapArray() {
  const cost = 60 * Math.pow(state.arrayLv, 1.8);
  if (state.spirit >= cost) {
    state.spirit -= cost; state.arrayLv++; save(); updateHUD();
    pushMsg("main", `聚灵阵升至 <span class="g">Lv.${state.arrayLv}</span>，灵脉奔涌！`);
  } else {
    pushMsg("main", `灵石不足(需 ${fmt(cost)})，分身正在四处寻矿…`);
  }
}

/* ============ 双栏叙事流 ============
 * main   → 右栏: 主角主线(境界精进/渡劫/聚灵/顿悟)  清晰持久
 * avatar → 左栏: 分身经历(历险奇遇/拾装/采矿)  低对比·渐隐
 */
function pushMsg(side, html) {
  const box = $((side === "main") ? "mainFeed" : "avatarFeed");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "fmsg";
  el.innerHTML = html;
  box.insertBefore(el, box.firstChild); // column-reverse 下: 新消息出现在视觉底部
  while (box.children.length > 6) box.removeChild(box.lastChild);
  const life = (side === "main") ? 9200 : 6200;
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, life + 250);
}

/* ============ 修行录: 主角亲身剧情(凡人→化神 六卷, 未历不显·不剧透) ============
 * 以凡人修仙传式际遇为骨(夺舍/小瓶/禁地/乱星海/虚天殿/踏月救人/坠魔谷…),
 * 主角一律为"你"。PLOT[i] = 该大境剧情卷, 每个 beat 绑境界内小层门槛 seg(1-based):
 *   在线/离线推进到对应小层才会经历 → 大境之门须手动渡劫,
 *   故离线最多走完当前卷, 绝不提前进入下一卷。
 */
const PLOT = [
  [ // 凡人卷
    { key: "origin", big: "凡人", seg: 1, kind: "开篇", title: "灵根初启",
      text: "残碑前你第一次感应到天地灵气，如涓流汇入丹田。山野凡人，自此也敢问道长生。" },
  ],
  [ // 炼气卷(13层)
    { key: "lq1", big: "炼气", seg: 1, kind: "突破", title: "引气入体",
      text: "灵气自百会灌体而下，沿周天缓缓流转。你踏入炼气，从此吐纳有法、御物可期。" },
    { key: "lq2", big: "炼气", seg: 3, kind: "际遇", title: "神秘小瓶",
      text: "是夜你于山溪边拾得一只青瓷小瓶，瓶中有露，可一夜催活枯药。你隐隐觉得——此物将是你此生最大的秘密。" },
    { key: "lq3", big: "炼气", seg: 5, kind: "际遇", title: "夺舍之祸",
      text: "药谷里那位老供奉待你忽而亲厚，你却在他丹房暗格里翻见满纸“夺舍”的笔记。你将计就计、反客为主——那一夜，你第一次真切感到修仙界的森冷。" },
    { key: "lq4", big: "炼气", seg: 7, kind: "际遇", title: "坊市起家",
      text: "你以瓶中灵液催活枯药，于坊市悄然换购修炼之物。财不露白，你始终只作个不起眼的低阶散修。" },
    { key: "lq5", big: "炼气", seg: 9, kind: "际遇", title: "升仙入谷",
      text: "一场门派倾轧中你护下半卷藏经，得引荐入青枫谷为记名弟子。伪灵根不受人待见，你便只管埋头打理药园。" },
    { key: "lq6", big: "炼气", seg: 11, kind: "际遇", title: "筑基之愿",
      text: "炼气将满，你盯着那份筑基丹方看了整夜。禁地试炼的告示已贴在谷口——你收拾好行囊，按下心头波澜。" },
  ],
  [ // 筑基卷(前中后圆满)
    { key: "zj1", big: "筑基", seg: 1, kind: "突破", title: "筑基成道",
      text: "真元凝而成液，轰然冲开仙凡之隔。筑基一成，方算真正踏上仙途——御剑乘风，皆可期矣。" },
    { key: "zj2", big: "筑基", seg: 2, kind: "际遇", title: "血色禁地",
      text: "筑基初成，你随队进入血色禁地寻一味主药。秘境深处，一位被群修围攻的清冷女修与你背靠背死战脱险——她留下一句“来日相报”，你当时并未放在心上。" },
    { key: "zj3", big: "筑基", seg: 3, kind: "际遇", title: "魔道压境",
      text: "魔道大举南侵，青枫谷一夜倾覆。你被当作弃子抛在断崖，只得跃下崖底那座上古传送阵——白光卷过，你落进一片腥咸的海风里。" },
    { key: "zj4", big: "筑基", seg: 4, kind: "际遇", title: "乱星海立足",
      text: "乱星海岛屿林立、修士如蝗。你隐姓埋名，靠一手催熟灵药的本事在坊市站稳脚跟。夜里望月，你只想着：金丹，还远。" },
  ],
  [ // 结丹卷
    { key: "jd1", big: "结丹", seg: 1, kind: "突破", title: "金丹大道",
      text: "丹火淬炼百日，一粒金丹于丹田凝成，宝光内敛。自此寿元大增，已可称一声真人。" },
    { key: "jd2", big: "结丹", seg: 2, kind: "际遇", title: "虚天殿",
      text: "传闻三百年一开的虚天殿现于海眼。你本只想碰碰运气，却在殿中夺得一件人人眼红的至宝——消息走漏那刻，你便知这乱星海再难安生。" },
    { key: "jd3", big: "结丹", seg: 3, kind: "际遇", title: "外海潜修",
      text: "你远遁外海，猎妖取丹、炼药服气，数十年弹指而过。海上风暴与成群妖兽，都成了你的磨刀石。" },
    { key: "jd4", big: "结丹", seg: 4, kind: "际遇", title: "风雷双翼",
      text: "妖修设局围你，欲夺你性命。你反手破局，缴下一对可裂空而行的风雷双翼——自此遁速倍增，天下大可去得。" },
  ],
  [ // 元婴卷
    { key: "yy1", big: "元婴", seg: 1, kind: "突破", title: "元婴出窍",
      text: "金丹应声而碎，元婴于紫府中睁眼。神魂可离体夜游，天地法则的轮廓，第一次向你展开。" },
    { key: "yy2", big: "元婴", seg: 2, kind: "际遇", title: "潜归天南",
      text: "你悄然潜回天南，化名寄身一座小宗潜修。旧日故人，皆以为你早已殒身海外。" },
    { key: "yy3", big: "元婴", seg: 3, kind: "际遇", title: "踏月三千里",
      text: "一封血书送到你案前——禁地那位故人被困于宗门禁地，命悬一线。你踏月夜行三千里，于众目睽睽之下将她带走。这一夜，天南都知道你回来了。" },
    { key: "yy4", big: "元婴", seg: 4, kind: "际遇", title: "坠魔谷之战",
      text: "魔修大举压境，天南危如累卵。你于坠魔谷外布下剑阵，一战成名——自此，再无人敢小觑这个从海外归来的散修。" },
  ],
  [ // 化神卷
    { key: "hs1", big: "化神", seg: 1, kind: "突破", title: "人界之巅",
      text: "元婴与天地相合，神念瞬息千里，一念动而风雨相随。人界之巅已在脚下——飞升，成了你唯一的念想。" },
    { key: "hs2", big: "化神", seg: 2, kind: "际遇", title: "灵气枯竭",
      text: "你遍访名山大川，只见灵脉渐枯、灵气日薄。大限之前，你开始遍阅古籍，只为寻一条通往上界的路。" },
    { key: "hs3", big: "化神", seg: 3, kind: "际遇", title: "空间节点",
      text: "传闻某处海域存在可撕裂虚空的节点。你亲往探查，于风暴眼中，感应到那一线若有若无的界面气息。" },
    { key: "hs4", big: "化神", seg: 4, kind: "际遇", title: "静候飞升",
      text: "你在洞府中炼化护体之宝，回望百年仙途——从残碑前那个懵懂少年到人界之巅，一路风雨，皆是自己一步一步走出来的。飞升之日，静待来朝。" },
  ],
];

function addJournal(entry) {
  entry.ts = Date.now();
  state.journal.push(entry);
  if (state.journal.length > 80) state.journal.shift();
  save();
}
/* 剧情推进器: 触发当前大境卷内所有"已达小层且未经历"的节点 */
function realmPlot() {
  const r = realm();
  const vol = PLOT[Math.min(r.bigIdx, PLOT.length - 1)];
  if (!vol) return;
  for (const b of vol) {
    if (state.journal.some(j => j.key === b.key)) continue;
    if (b.seg <= r.segNo) {
      addJournal({ key: b.key, big: b.big, kind: b.kind, title: b.title, text: b.text });
      pushMsg("main", `<span class="b">${b.big} · ${b.title}</span>｜${b.text}`);
    }
  }
}

function openStory() {
  const m = $("storyModal");
  if (!m) return;
  renderStory();
  m.classList.add("show");
}
function closeStory() {
  const m = $("storyModal");
  if (m) m.classList.remove("show");
}
function renderStory() {
  const body = $("storyBody");
  if (!body) return;
  const bi = Math.min(bigIdx(), PLOT.length - 1);
  const walked = PLOT.slice(0, bi + 1).map(x => x[0].big).join(" → ");
  let html = `<div class="story-sum">已历仙途：<b>${walked}</b>` +
    (state.realmIdx >= TOTAL_SEGS - 1 ? "（人界之巅 · 静候飞升）" : "") + `</div>`;
  if (!state.journal.length) {
    html += `<div class="empty-hint">尚无记载。<br>仙途伊始，一切从你打坐感应灵气开始。</div>`;
  } else {
    const pad = n => String(n).padStart(2, "0");
    for (const j of state.journal.slice().reverse()) {
      const tm = new Date(j.ts);
      html += `<div class="j-card k-${j.kind || "际遇"}">` +
        `<div class="j-head"><span class="j-big">${j.big || ""}</span>` +
        `<span class="j-kind k-${j.kind || "际遇"}">${j.kind || "际遇"}</span>` +
        `<span class="j-time">${pad(tm.getMonth() + 1)}-${pad(tm.getDate())} ${pad(tm.getHours())}:${pad(tm.getMinutes())}</span></div>` +
        `<h5>${j.title || "仙途拾遗"}</h5><p>${j.text || ""}</p></div>`;
    }
  }
  body.innerHTML = html;
  body.scrollTop = 0;
}

/* 历险(分身·左栏) */
const _lastPick = {};
function pickNoRepeat(arr, key) {
  const banned = _lastPick[key] || (_lastPick[key] = []);
  const cand = [];
  for (let i = 0; i < arr.length; i++) if (!banned.includes(i)) cand.push(i);
  const pool = cand.length ? cand : arr.map((_, i) => i);
  const idx = pool[(Math.random() * pool.length) | 0];
  banned.push(idx); if (banned.length > 5) banned.shift();
  return arr[idx];
}
function adventure() {
  const roll = Math.random();
  const bi = Math.min(bigIdx(), EVENTS.length - 1);
  const artChance = 0.05 + bi * 0.005;
  if (roll < artChance) {
    const a = makeArt();
    state.arts.push(a);
    const r = QUALITY[a.q];
    pushMsg("avatar", `${pickNoRepeat(ART_HINTS, "art")}，得<span class="r">${a.name}</span>(<span class="${r.cls}">${r.name}</span>)已自动换上`);
    updateArts(true); save();
  } else if (roll < 0.30) {
    const g = Math.round(8 + Math.random() * 30 + bigIdx() * 10);
    state.spirit += g;
    pushMsg("avatar", `${pickNoRepeat(EVENTS[bi], bi)}，换得些许灵石`);
  } else if (roll < 0.62) {
    const g = Math.round(14 + Math.random() * 50 + bigIdx() * 16);
    state.spirit += g;
    pushMsg("avatar", `${pickNoRepeat(EVENTS[bi], bi)}，所得颇丰`);
  } else if (roll < 0.84) {
    const bonus = rateNow() * (4 + Math.random() * 8);
    state.exp += bonus;
    pushMsg("avatar", `${pickNoRepeat(EVENTS[bi], bi)}，气机随之增长`);
  } else {
    state.exp += rateNow() * 1.5;
    pushMsg("avatar", `${pickNoRepeat(STILL_MOMENTS, "still")}`);
  }
  state.spirit += spiritRate();
  updateHUD();
}

function updateArts(highlight) {
  const row = $("artRow");
  const last6 = state.arts.slice(-6);
  row.innerHTML = last6.map((a, i) => {
    const isNew = !!(highlight && i === last6.length - 1);
    return `<span class="art${isNew ? " new" : ""}"><span class="q ${QUALITY[a.q].cls}">${QUALITY[a.q].name}</span>${a.name}</span>`;
  }).join("");
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
    if (r.isBigEnd) break; // 大境界之间不自动渡劫, 等你亲手 → 离线最多走完当前卷剧情
    if (state.exp + gainExp >= r.need && state.realmIdx < TOTAL_SEGS - 1) {
      state.realmIdx++; state.exp = 0;
    } else break;
  }
  state.exp += gainExp; state.spirit += gainSpirit;
  realmPlot(); // 离线推进后, 触发当前大境卷内所有"已到小层"的剧情节点(绝不越卷)
  save();
  const h = Math.floor(dt / 3600), m = Math.floor(dt % 3600 / 60);
  $("offlineText").innerHTML =
    `你离开了 <b>${h ? h + " 小时 " : ""}${m ? m + " 分钟" : "片刻"}</b>。<br>` +
    `分身闭关，修为 +<span class="num"> ${fmt(gainExp)}</span><br>灵石 +<span class="num"> ${fmt(gainSpirit)}</span>`;
  // 离线际遇: 与在线同样的叙事池, 随离线时长缓慢累积(每满一小时左右一段, 至多3段)
  const bi = Math.min(bigIdx(), MAIN_STORY.length - 1);
  const bigName = realm().big;
  const cnt = Math.min(3, Math.max(1, Math.floor(dt / 3600)));
  const lines = [];
  for (let i = 0; i < cnt; i++) {
    const line = pickNoRepeat(MAIN_STORY[bi], "off" + bi);
    lines.push(line);
    addJournal({ key: "off-" + Date.now() + "-" + i, big: bigName, kind: "游历", title: "洞天游历", text: line });
  }
  const taleEl = $("offlineTale");
  if (taleEl && lines.length) {
    taleEl.style.display = "block";
    taleEl.innerHTML = `<b>离线际遇</b>${lines.map(x => `<br>· ${x}`).join("")}`;
  }
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

function mainMoment() {
  const pool = MAIN_STORY[Math.min(bigIdx(), MAIN_STORY.length - 1)];
  const g = Math.round(rateNow() * 2.5);
  state.exp += g;
  pushMsg("main", `<span class="b">主线</span>·修为<span class="g">+${fmt(g)}</span>｜${pickNoRepeat(pool, "m" + bigIdx())}`);
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
      pushMsg("main", `修为精进 → <span class="g">${nr.big === "炼气" ? "炼气" + cnNum(nr.segNo) + "层" : nr.label}</span>`);
      updateRealmUI();
    }
    realmPlot(); // 到新小层即推进当前卷剧情(跨大境须手动渡劫 → 剧情也绝不越卷)
  }
  updateHUD();
  if (Math.random() < dt * 0.35) adventure();
  if (Math.random() < dt * 0.05) mainMoment();
  tickBurst(dt);
}

/* ============ 启动 ============ */
load();
applyOffline();
updateRealmUI();
updateHUD();
updateArts();
realmPlot(); // 启动即按当前境界推进已及剧情
if (state.journal.length && !state.journal.some(j => j.key === "origin") && bigIdx() > 0) {
  const o = PLOT[0][0];
  addJournal({ key: o.key, big: o.big, kind: o.kind, title: o.title, text: o.text }); // 老档补记起点
}
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
  giveSpirit: n => { state.spirit += n; updateHUD(); },
  adventure: () => adventure(),
  mainMoment: () => mainMoment(),
  makeArt: () => makeArt(),
  updateArts: h => updateArts(h),
  applyOffline: () => applyOffline(),
  realmPlot: () => realmPlot(),
  openStory, pushMsg, save, load,
};
