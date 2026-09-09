/* 洞天 · 挂机修仙 —— game.js?v=926b5d17 v3(双栏叙事) */
"use strict";

/* ============ 境界体系(凡人修仙传风) ============
 * 炼气 1~13 层; 其余大境分 初期/中期/后期/圆满
 * 人界: 凡人 → 炼气 → 筑基 → 结丹 → 元婴 → 化神(本版终点, 静候飞升)
 */
const SEG4 = ["前期", "中期", "后期", "圆满"];
const BIGS = [
  { n: "凡人", segs: 1, color: "#c6b07c", c: [198,176,124] },
  { n: "炼气", segs: 13, color: "#7fe0ff", c: [127,224,255] },
  { n: "筑基", segs: 4, color: "#61d0c4", c: [97,208,196] },
  { n: "结丹", segs: 4, color: "#e8c56b", c: [232,197,107] },
  { n: "元婴", segs: 4, color: "#c59bff", c: [197,155,255] },
  { n: "化神", segs: 4, color: "#58ccff", c: [88,204,255] },
  { n: "炼虚", segs: 4, color: "#b98aff", c: [185,138,255] },
  { n: "合体", segs: 4, color: "#ff8ac2", c: [255,138,194] },
  { n: "大乘", segs: 4, color: "#ffb36b", c: [255,179,107] },
  { n: "渡劫", segs: 4, color: "#8a9dff", c: [138,157,255] },
  { n: "真仙", segs: 4, color: "#a9f0c8", c: [169,240,200] },
  { n: "天仙", segs: 4, color: "#fff0a8", c: [255,240,168] },
];
const TOTAL_SEGS = BIGS.reduce((s, b) => s + b.segs, 0);   // 30 段
let __auraBig = null;   // 光环预览中的大境界(为 null=跟随真实修为)

/* ---- 成长曲线(目标 ≈1个月到化神, 前期快、后期稳; 全部可调) ----
 * REALM_DAYS: 各境目标天数(合计30天; 炼气/筑基压短 → 前期一天能冲好几层)
 * SEG_SCALE : 修为需求系数锚点(=4 → 不开聚灵阵纯挂机也≈设计天数; 升阵会更快)
 * arrMult   : 聚灵阵收益 前10级+35%/11~20级+18%/21~30级+8%, 30级封顶, 防止后期产出失控
 * SPIRIT_RATE/ARRAY_COST: 灵石秒产与阵升级花费, 约束阵等级节奏
 */
const REALM_DAYS = [0.15, 5, 4.8, 6, 6.8, 7.25, 9.5, 11.5, 14, 17, 21, 26]; // 化神后: 灵界(炼虚→渡劫)/仙界(真仙·天仙), 不再封顶30天
const SEG_SCALE = 4;
const arrMult = lv => {
  let m = 1;
  for (let k = 2; k <= lv; k++) m += k <= 11 ? 0.35 : (k <= 21 ? 0.18 : (k <= 31 ? 0.08 : 0));
  return m;
};
const SPIRIT_RATE = lv => 0.5 + 0.34 * lv;
const ARRAY_COST = lv => 900 * Math.pow(lv + 1, 2.55);

// 段 → 元数据(need 按“本境目标天数 × 段权重”反推, 段内前快后慢)
const SEG_META = [];
(function buildSegs() {
  let cum = 0;
  for (let bi = 0; bi < BIGS.length; bi++) {
    const big = BIGS[bi];
    const s = big.segs;
    const dsecTotal = REALM_DAYS[bi] * 86400;
    const ws = [];
    for (let j = 0; j < s; j++) ws.push(s <= 1 ? 1 : 0.25 + Math.pow(j / (s - 1), 1.35));
    const sw = ws.reduce((a, b) => a + b, 0);
    for (let q = 0; q < s; q++, cum++) {
      let label, isBigEnd = false;
      if (big.n === "凡人") {
        label = "凡人";
      } else if (big.n === "炼气") {
        label = `${big.n}·${cnNum(q + 1)}层`;
        isBigEnd = (q === s - 1);
      } else {
        label = `${big.n}·${SEG4[q]}`;
        isBigEnd = (q === s - 1);
      }
      // 凡人: 新手入门, 几分钟即可渡入炼气; 其余按目标时长 × 大境强度
      const need = big.n === "凡人" ? 2500
        : Math.max(120, Math.round(SEG_SCALE * Math.pow(bi + 1, 2.05) * dsecTotal * ws[q] / sw));
      SEG_META.push({ bigIdx: bi, big: big.n, label, need, isBigEnd,
        color: big.color, c: big.c, segNo: q + 1,
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
    "凝液化固 · 金丹大道", "丹破婴生 · 大道初成", "元婴化神 · 人界之巅",
    "炼神返虚 · 灵界初启", "法相天地 · 万法归一", "返璞归真 · 大乘无上",
    "度劫化凡 · 一步登仙", "羽化登仙 · 仙界之门", "位列仙班 · 天仙逍遥"
  ][bi] || "";
}

/* ============ 法宝(凡人修仙传梗致敬) ============ */
const QUALITY = [ // 名/权重/倍率/颜色(符器→玄天)
  { name: "粗制", w: 50, mult: 1.10, cls: "q1" },
  { name: "法器", w: 20, mult: 1.30, cls: "q2" },
  { name: "灵器", w: 15, mult: 1.58, cls: "q3" },
  { name: "古宝", w: 9,  mult: 2.00, cls: "q4" },
  { name: "灵宝", w: 5,  mult: 2.70, cls: "q5" },
  { name: "玄天", w: 1,  mult: 3.80, cls: "q6" },
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


/* ============ 守山灵兽「阿青」· 左栏洞天日常 ============ */
const PET = { name: "阿青", kind: "青丘灵狐" };
const PET_FORGE = [
  "在后院支起一口旧铁砧，叮叮当当敲到日头偏西",
  "翻出半截废弃古器，回炉熔了重铸",
  "拉了半夜风箱，炉火由红转青",
  "拿山溪水淬火，滋地腾起一片白雾",
  "把捡来的碎妖丹研成粉，掺进铁水",
  "对着块灵铁敲了又敲，敲得洞府都跟着震",
  "用尾巴卷着锤子抡了半天，竟也有模有样",
  "把三件破铜烂铁熔成一炉，只取其中精华",
  "炉火将熄时补了一口自己的灵气，火苗猛蹿",
  "寻了块雷击木烧炭，说这样的火性最烈",
  "天亮前最后一锤落下，火星溅了一地",
  "从尾巴上揪了撮毛添进炉里说是引子，竟真成了",
];
const PET_COIN = [
  "不知从哪儿刨出一小捧碎灵石，献宝似的堆在你门口",
  "把洞府犄角旮旯的碎石都舔得发亮——竟全是成色不错的灵石",
  "溜下山一趟，回来肚皮鼓鼓，藏着几颗亮晶晶的石头",
  "蹲在聚灵阵边看灵光流转，忍不住伸爪去拨，竟拢出几颗小晶石",
  "在灵田垄沟里打滚，起身时泥里带出几颗嵌着的灵石",
  "偷喝了一口你的灵泉水，呛得直打喷嚏，鼻尖上还粘着一颗碎灵石",
  "把你的灵石当玩具滚着玩，滚进它窝里好几颗，被你发现时装睡",
  "雨后在洞天门口的水洼里捞来捞去，捞出几颗冲下来的亮石子",
];
const PET_BONUS = [
  "卧在聚灵阵旁睡着了，灵气顺着尾巴尖往它身上淌，竟也牵动你的气机",
  "它绕着灵脉眼儿踩了一整夜，你早起只觉神清气爽",
  "趴在你膝头打盹，呼吸间竟与你吐纳的节奏渐渐合一",
  "忽然对着你打了个小喷嚏，一团灵光迎面扑来，丹田微微发暖",
  "叼来一片灵草叶，轻轻放在你眉心——凉意透体，杂念顿消",
  "夜里它守着阵眼不睡，你竟梦见一条地脉在脚下缓缓游动",
  "它蹭了蹭你手心，指尖一缕灵力顺着经脉悄悄转了一整圈",
  "对着你的丹炉吹了口气，炉火窜高一尺，满室药香更浓",
];
const PET_STILL = [
  "在檐下把自己团成一个毛球，尾巴盖住鼻子，睡得很香",
  "追着自己的尾巴转了三圈，然后若无其事地踱开",
  "趴在丹炉边烤火，舒服地打了个滚，肚皮朝天",
  "盯着墙上晃动的光影看了很久，像在参悟什么了不起的事",
  "叼着一片青枫叶回来，放在你打坐的蒲团边",
  "蹲在洞天门口望山，不知在想什么",
  "把尾巴浸进灵泉水里搅着玩，水面漾开一圈圈银光",
  "夜半爬上屋顶，对着月亮轻轻呜咽了一声，又若无其事地下来",
  "下雨了，它蹲在檐下看雨，尾巴尖一卷一卷的",
  "拿爪子拨弄一只路过的甲虫，甲虫装死，它吓了一跳",
  "把晒着的药草翻了个面，自己却滚了一身药香，连打三个喷嚏",
  "踩着初雪在院子里留了一串小梅花脚印",
  "它把脑袋枕在你鞋上睡着了，你一动，它迷迷糊糊换了个方向接着睡",
  "试着像你一样盘腿打坐，坚持了三息就歪倒，索性四脚朝天晒太阳",
  "从山门外衔回一枝野桃花，插在门缝里，自己蹲在旁边等着被夸",
  "对着聚灵阵的灵光扑来扑去，像在扑一只看不见的蝴蝶",
  "深夜你听见窸窣声，原是它在悄悄往自己窝里拖一片暖玉",
  "用尾巴扫净了你蒲团上的落叶，又装作什么都没发生",
];

/* 主角主线叙事(分大境界·右栏) */
const MAIN_STORY = [
 [
  "天未亮你去山溪担水，弯腰汲水时，指尖浸过水面，一缕极淡的气息顺水漫上腕骨。",
  "夜半醒来，月光铺满土炕。你平躺调息，听屋外虫鸣此起彼伏，胸口起伏之间，竟比白日安稳。",
  "午后你翻晒药草，把柴胡与陈皮分开码好。暖阳晒得后背发烫，你忽然觉得，药气仿佛也在学着游动。",
  "你倚着老槐读一本残破药书，读到经脉一篇时抬眼望树梢，叶子被风翻得哗哗响，像也在默念。",
  "井边洗衣，皂角泡顺指缝淌下。你盯着水面的倒影发怔，觉得眉心正中，似有一粒米大的清凉。",
  "砍柴归来你坐在门槛上歇脚，望着远山云气出神。暮色里山岚的形状，像一幅没画完的经络图。",
  "秋夜你扫净院落，燃半截艾草驱蚊。烟气盘旋，你盘腿静坐，试着让呼吸变长、变深、变得听不见。",
  "你替邻家阿婆碾药，石臼里砰砰作响。手酸停下揉腕，恍惚觉得那闷响，一声声敲进心口某处。",
  "入冬前你修补篱笆，指尖被竹篾划破。你吮去血珠，却觉那刺痛里，隐约有一丝草木初生的痒。",
  "你坐在溪边大石上濯足，水流过脚踝清清凉凉。你忽然想，水知道往哪里去，人是不是也该知道。",
  "晨起你推开木窗，浓雾涌进屋子。你伸手拨了拨雾气，掌心什么也没留下，却想起昨夜梦里那条发光山路。",
  "你种下一垄萝卜，覆土压得实实。浇完水蹲在地头看许久，泥土深处，仿佛有一声极轻的绵长吐纳。",
  "黄昏你在院中收衣裳，晚风把衣角吹得鼓起。你忽然停下，风穿过衣料那一下，竟与吐纳的节律相合。",
  "你替邻庙抄了半日经，墨香染了满袖。归途捻着腕间墨渍想，字写久了会熟，呼吸练久了，是否也会熟。"
 ],
 [
  "你盘坐于青枫谷溪石上吐纳，晨雾凝在发梢。气息入腹绕行三匝，呼出时，白雾竟比往常散得慢些。",
  "子夜你静坐观想，眼前漆黑如潭。许久，黑暗中浮起一点萤火般的微光，你不敢动，只任它明灭。",
  "你沿后山小径缓缓行走，一步一息。行至竹林深处，风声灌满衣袖，你觉得整座山都在陪你呼吸。",
  "白日你演练一套入门拳法，打得极慢。收势时掌心聚起一团难辨的薄雾，风一吹便散，你却怔立良久。",
  "你引一缕细如蛛丝的气息绕指盘旋，再轻轻送它游回气海。窗外麻雀叫了三声，你才想起收功。",
  "午后你捧出那只灵液小瓶，凑近瓶口闻了闻。只倒一滴于掌心搓化，便觉四肢百骸都透亮了些。",
  "你于瀑布下练定，水声轰鸣如雷。你偏要在此观想内视，从嘈杂中听出气血奔流，像听见自己的河。",
  "晨光里你翻开一卷旧功诀，读到「气走如珠走盘」一句，便搁下书，闭目将这句话在体内走了三遍。",
  "你给灵田药草浇水，指尖漏下的水珠沾到叶片，那株蔫了三日的草，似有若无地直了直腰。",
  "夜里你仰卧屋顶数星，瓦片晒得温热。数到第三十七颗时忘了数目，只觉满天星子都在缓缓呼吸。",
  "你以掌心贴住崖壁，循着石中一线灵泉的走向，沿那点凉意走了半里，直走到山腰的老松根下。",
  "连日阴雨，你在檐下临摹一页阵图残卷。笔锋落下时，窗外雨珠坠进石洼，竟与图上走势合了一拍。",
  "你试着重聚清晨第一缕天光，凝在指尖。光太轻，你捉了半晌只捉到满手暖意，却也乐在其中。",
  "你路过一片雷火燎过的焦地，在土缝里看见一株嫩芽。你蹲了许久，想，枯荣之间自有它的呼吸。",
  "你每日黄昏绕湖走三圈，边走边将气息推至足尖。一圈下来，鞋底竟比往日干净许多。",
  "静室中你置一炉青烟，看烟柱直上而散。你学着那烟气，把一口气吸得极满，再放得极尽。",
  "你以木剑演练剑诀，招式虽拙却招招带风。收剑时发现剑尖落着一片枯叶，被削成齐齐的两半。",
  "你替自己在灵田边搭了间小竹屋，夜里躺在竹榻上，能听见药草拔节的声音，一粒一粒，像在报数。",
  "观想内视时，你看见气海那团雾气又浓了一分，中间似藏着什么极小的东西。你不敢细看，缓缓睁眼。",
  "你蹲在溪边以气息搅动水面，一缕极细的气流拂过，落叶旋了半圈。你收功起身，假装只是风吹的。",
  "你采了些野茶用炭火慢焙，运息护住炉火。火苗稳得没有一丝跳动，茶香却比往日醇厚三分。",
  "山雨欲来，你立于崖边任衣袂翻飞，试着把呼吸放得与压低的云层同频。云不动，你的心也不动。",
  "你打坐至腿麻，索性躺下让气息自行游走。半梦半醒之间，你分不清是你在走气，还是气在走你。",
  "深夜里你以指代笔隔空描摹一轮满月，描到月心时指尖一热，仿佛真触到了那光里极淡的一点清辉。"
 ],
 [
  "清晨你踏剑离峰，掠过薄雾中的青枫谷。谷底溪流在脚下折成银线，你放慢剑速，看晨光一寸寸爬上药圃。",
  "你御剑绕后山飞了三圈，只为一枚初熟的灵果。果子悬在崖外，你并未摘取，只看它在风里轻轻点头。",
  "傍晚你盘坐峰顶，俯瞰云海慢慢吞没山脚。你忽然明白，所谓御剑，不过是让脚学会忘记大地。",
  "你于瀑布后寻了一处水帘洞，将本命剑浸在寒潭中温养，以掌心度入气息，看剑上细纹一点点亮起。",
  "你带着那只灵液小瓶回到洞府，瓶身已有些温润。你只舍得让它贴着心口放上一夜，并不急着用。",
  "你御剑掠过一处寻常村落，见炊烟正从瓦楞间升起。你刻意放低，闻了闻人间烟火气，才又拔剑而上。",
  "你在灵田边搭了座竹棚，夜里宿在棚中听虫。护田禁制微微发亮，像一盏不熄的灯，守着一畦安静。",
  "你取剑在月光下慢舞，剑气被月色洗得很淡。收势时捻住剑尖，那里凝着一滴露，凉得像句没说完的话。",
  "你御剑行至半途忽然停住，悬在云上看落日。霞光铺满剑身，你想，赶路的日子久了，也得记得看晚霞。",
  "你在洞府前以露水在石桌上画阵，边画边读阵道手札。日头西斜时，桌上已干了三层水痕。",
  "你于无人的崖顶打坐，将神识缓缓放出，像撒出一张极轻的网，网住风声、鸟鸣与松涛，再一一收回。",
  "你御剑去山外市集买盐，回来时捏着那包盐想，仙人也要吃饭，这念头让你格外踏实。",
  "深夜你以气血缓缓润过本命剑的剑脊，剑身嗡鸣如应。你便知它今日也饱足，可以安睡了。",
  "雪后你御剑巡山，剑下白茫茫一片。一只松鼠抱着松果横穿雪地，你忽然觉得，这山还须好好看护。",
  "你盘坐松树下观想内景，见气海澄澈如湖，湖心立着一柄小剑的虚影。你不动它，只任它映着天光。",
  "你御剑低飞过一片芦苇荡，惊起一滩水鸟。你放慢剑速让它们先过，扑棱声贴着水面，许久才散。",
  "你在洞府外新开一片药圃，移来几株云芝，每株喂上半缕灵气，像给幼童掖好被角。",
  "你对着月色翻旧日练气笔记，字迹稚嫩。读到「今日气感如春蚕吐丝」，你轻笑一声，小心合上。",
  "子时你立于峰顶，引月光入体。清辉顺着经脉缓缓流淌，像一条温凉的河，把白日的尘嚣一一洗去。",
  "御剑归来你不急着入洞，先绕到灵田上空看了一圈。苗都好好的，你才收了剑光，像归人先看过灯火。"
 ],
 [
  "卯时丹火初燃，你盘坐蒲团，将灵力一缕缕渡入丹海温养金丹，炉火不疾不徐，恰似修行人的心性。",
  "丹房窗棂透进一缕月光，你敛息内视，见金丹之上道纹流转如细浪，便知今夜火候又稳了几分。",
  "你以神识为引，牵动体内周天，丹火随呼吸起伏，将一缕杂气炼化，呵出的白雾竟带三分药香。",
  "后山灵泉旁，你掬水淬炼掌心丹火，水火相激的刹那，丹海深处传来一声低沉的钟磬之鸣。",
  "闭关石室里，你忽觉金丹轻颤，遂收摄心神凝神守一，待那颤动化作暖流游走四肢百骸，才缓缓睁眼。",
  "你于庭前负手而立，看云卷云舒，丹海内金丹随天光流转，恍惚间竟与这片天地同呼同吸。",
  "巡完山门灵脉归来，你坐在崖畔静坐良久，将地气引入丹田温养金丹，风中松涛也似与你应和。",
  "夜半醒来，丹火已自行运转七周天，你添了一炉静心香，复又阖目，任由金丹在混沌中沉沉浮浮。",
  "你取来一枚温润的灵玉，贴于脐下三寸，以丹火缓缓灼烤，将玉中清灵之气一丝丝送入丹海。",
  "打坐至日中，腹中丹火如金乌当空，你以灵识拨转丹丸令其慢转三匝，才觉满口生津，通体舒泰。",
  "你以文火温养金丹已有整夜，晨起时指尖犹带暖意，随手一挥，檐角积露竟凝成细小的金色水滴。",
  "丹炉前你调整了七次火候，终于令那缕丹火与金丹圆融如一，窗外雀鸣惊起，你才记起已是午后。",
  "你盘膝于古松下吐纳，灵息顺着经脉缓缓汇聚，丹田处金丹微旋，松针坠落竟不沾衣，自你身侧滑开。",
  "静室中，你以神识轻轻叩击金丹，每叩一声丹海便荡开一圈涟漪，直至涟漪尽敛，方知火候圆满。",
  "药香弥漫的丹房内，你守着炉温不敢稍离，偶有风过烛影摇动，你也只是以袖遮护，守住那一炉道心。",
  "你自溪涧取来无根之水，煮沸后以丹火隔空灼之，看水汽升腾幻化成形，竟暗合了金丹九转的走势。",
  "山巅观星归来，你将一夜星辉尽数收进丹海，金丹染上浅浅的银辉，运转时如裹着一层流动的月色。",
  "温养金丹至圆满时，你忽觉丹田一暖，仿佛有颗小小的太阳沉睡其中，不敢惊扰，只静静守着这炉丹火。"
 ],
 [
  "元婴端坐紫府，小手结印，与你的呼吸同频吐纳，你细细看去，小家伙眉眼间已有一丝与你一般的沉静。",
  "子夜时分，元婴遁出天门，在月下雾霭里游走一圈，归来时带回一缕天边云气，你含笑替它拂去衣上露水。",
  "你盘坐洞府，元婴于身侧凌空而坐，一大一小两道吐纳之声相和，仿佛山涧两道清泉汇于一处。",
  "紫府之内，元婴口吐婴火，将一缕驳杂的神识细细灼炼，你只觉眉心微痒，那刺痛过处竟清明了几分。",
  "元婴夜游归来，伏在你肩头酣睡，你以灵识替它梳理经脉，月光洒下，小家伙翻了个身，梦呓般念着道诀。",
  "你于崖壁前演练一门遁法，元婴与肉身气息相合，山风灌入衣袖，你忽然懂了何谓身与道合、神随意转。",
  "元婴捧着你的本命飞剑，以婴火温养剑脊，剑鸣渐渐低下去，直至温顺如一只伏在你膝头的灵鹤。",
  "你静观灵脉蜿蜒如龙，元婴也睁眼凝视，一前一后良久，元婴抬手摹其走势，指间有灵光流转不散。",
  "闭关小憩醒来，元婴仍在紫府吐纳不休，你伸个懒腰只觉周身轻灵，好似一片随时会乘风而去的落叶。",
  "元婴指尖托起一朵灵焰，你以神念引它在洞壁上游走，画了半幅云图，又于天明前轻轻抹去，不留痕迹。",
  "你与元婴分坐石台两端，同修一部吐纳之法，山外雷声隐隐，洞府内两道气息却稳如亘古不移的磐石。",
  "元婴学着你的模样盘膝掐诀，神态像极了你，你忍俊不禁，小家伙却一本正经，不肯理会你的笑意。",
  "月华如水，元婴悬于庭中吐纳月精，你倚门而望，忽然觉得这小小身影，已能替你挡下人间许多风雨。",
  "元婴遁地入山，循着灵脉潜游一圈，归来时发间沾了点点地髓灵光，你替它掸去，又教它收敛气息的诀窍。",
  "你将一缕剑意凝于指尖，元婴伸手来触，被震得指尖微麻，却倔强地再次探出，眼中满是好奇的光。",
  "灵雾升腾的清晨，元婴踏雾而舞，演练你新悟的步法，雾散时它已落在你肩头，得意地晃着小小的脚丫。",
  "元婴入你识海，与你并肩观一篇无字道经，字字皆无，偏偏你二人心间都泛起同样的明悟，相视而笑。",
  "静夜炉边，元婴替你守着丹炉，你枕石而眠，半梦半醒间听得它小声念叨火候，心头蓦地一暖。"
 ],
 [
  "你立于绝巅之上，任罡风拂面，只将神识缓缓散开覆盖整片山河，众生如蚁，你却从喧嚣里听出一线天机。",
  "一念千里，你于晨雾初散时去往东海南岸看了一回潮起，又于落日之前回到山巅，袖中只多了一粒湿沙。",
  "你的神识沉入大地深处，顺着灵脉脉络缓缓漫游，地火在极远处轰隆，你只当是天地打盹时的一串鼾声。",
  "静观云海翻涌，你忽然省得，人间风云与心间波澜原是同一种起伏，一念至此，胸中块垒竟自消融。",
  "你以神念淬炼那缕本源之火，火中竟映出草木枯荣、鸟兽生灭的幻影，你守在炉边，静静看了整整一夜。",
  "闭关十年，出关时门前老松已长过檐角，你抚过斑驳松皮，笑叹一句岁月，转身又去打水煮茶，如寻常一日。",
  "你在指尖凝出一方微缩的山川，看江河在其中奔流，忽然一弹指令山川归墟，方知造物原在一念之间。",
  "人界之巅风雪终年不化，你却只披一件单衣静坐，任霜雪在身周凝成弧线，远处似有飞升之念，隐隐生芽。",
  "你替山下的村子挡了一场倒春寒，又悄悄退去，凡人只道今年回暖得早，你在云上看他们笑，也跟着笑了笑。",
  "你以神识追一缕山风，从山脚追到天尽头，看它绕过城池掀起水波，最终停在野花的蕊心，才缓缓收回目光。",
  "月下无人处，你演练那门推演天机的神通，指间星砂起落，演到半途忽然停手，只因不想提前看破一个谜底。",
  "你温养本命法宝已有三载，今夜它终于嗡鸣一声，与你心神再无隔阂，你提壶为它斟了一杯山泉，权当庆贺。",
  "洞府檐下的铜铃响了九下，是旧友来访的讯号，你没有起身，只以神念推开山门，又替他斟好一盏温茶。",
  "你坐在潭边，看水面倒映的天空比真天还深，伸手搅碎倒影，又看它慢慢复原，心间一片澄明。",
  "山巅观星时你数到第一千零一颗星便停了手，已经记不清从前是数到第几颗会睡着，只觉那时的自己颇为可爱。",
  "你这一日哪里也没去，只在自己的道场里扫了扫地、喂了喂鱼，又看蚂蚁搬家看了许久，黄昏时身心俱安。"
 ]
];

/* ============ 存档 ============ */
let state = { realmIdx: 0, exp: 0, spirit: 0, arrayLv: 1, arts: [], journal: [],
  milestones: {}, peakSpirit: 0, bestArtQ: -1, lastTs: Date.now(),
  mats: {}, pills: {}, buffs: [], travel: null, mails: [], offlineBoostUntil: 0 };
let breaking = false;
let lastReadyHint = false;
const SAVE_KEY = "dongtian_xiuxian_v2";
const OFFLINE_CAP = 48 * 3600;   // 离线收益结算上限: 最多补 48 小时

/* ==================== P0 分身云游 · 材料/地界/丹方 ==================== */
const MATS = {   // 材料库: 9 种 —— 6 株主药按大境界分阶(1凡→6化神)，3 味辅料跨境通用
  /* —— 主药(灵植)：只在本阶及更高境界的游历中产出 —— */
  huangjing: { n: "黄精草", t: "灵植", src: "青牛镇一带" },
  shexian:  { n: "蛇涎果", t: "灵植", src: "镜州坊市" },
  zihou:    { n: "紫猴花", t: "灵植", src: "乱星海仙市" },
  xuancan:  { n: "玄冰参", t: "灵植", src: "极渊之海·寒涧" },
  jiuyou:   { n: "九幽芝", t: "灵植", src: "虚天殿·幽涧" },
  wenxin:   { n: "问心草", t: "灵植", src: "飞升台·天风崖" },
  /* —— 辅料(灵液/兽材)：凡有坊市灵脉处皆可得，跨境通用 —— */
  lingru:   { n: "千年灵乳", t: "灵液", src: "灵脉石乳" },
  dihuo:    { n: "地火灵液", t: "灵液", src: "地火洞窟" },
  yaodan:   { n: "妖丹·杂", t: "兽材", src: "游历奇遇" },
};
const ZONES = [
  { big: 0, name: "青牛镇一带", dur: [120, 3600],
    mats: [ { id: "huangjing", c: 1, a: 2, b: 4 }, { id: "yaodan", c: .12, a: 1, b: 1 } ],
    locs: [
      { id: "b0qnt", n: "青牛镇", d: "山脚市集 · 烟火人间",
        tale: [ "在茶棚歇脚，听卖卦老翁讲镇外山神庙的旧事", "替走货的镖头捎了封家书，得了一小篓山果", "市集角落有人兜售仙家药草，你认出是寻常黄精", "蹲在桥头看了一下午流水，什么也没做，却觉心静" ] },
      { id: "b0qil", n: "七里坡", d: "官道野店 · 行商歇脚",
        tale: [ "野店老板娘说后山半夜总有青光，没人敢去", "与一队行商拼桌，听他们讲境外战乱的消息", "坡上老槐挂了满树红绳，都是过路人的心愿", "在店后喂了匹瘦马半把草料，它蹭了蹭你手心" ] },
      { id: "b0qfc", n: "青枫村", d: "依山小村 · 灵枫成荫",
        tale: [ "村童追着你喊仙人，你从行囊摸出几颗糖丸分他们", "溪边浣衣妇人指了条进山的捷径", "村后灵枫下埋着半坛陈酿，你替主人守了一夜", "帮猎户修好塌了半边的篱笆，他送你一块熏肉" ] },
    ] },
  { big: 1, name: "镜州地界", dur: [1800, 43200],
    mats: [ { id: "shexian", c: .9, a: 1, b: 2 }, { id: "huangjing", c: .55, a: 1, b: 2 },
            { id: "lingru", c: .12, a: 1, b: 1 }, { id: "dihuo", c: .07, a: 1, b: 1 },
            { id: "yaodan", c: .18, a: 1, b: 1 } ],
    locs: [
      { id: "b1qxm", n: "七玄门", d: "山门之外 · 外门气象",
        tale: [ "混在外门弟子堆里听了一堂吐纳课，讲的都是入门货", "守山石阶上坐着一个白发杂役，看你的眼神像是看穿了什么", "后山演武场刀光剑影，你在崖边看了一夜", "下山时被巡山弟子盘问，你报了个假名，他竟信了" ] },
      { id: "b1jzh", n: "镜州城", d: "大城坊市 · 八方修士",
        tale: [ "坊市地摊有人卖假灵草，你戳穿后摊主讪讪送了你株真的", "城隍庙后巷有间不挂牌的当铺，掌柜只收来路不明之物", "茶楼里两个散修吹嘘探过某处古修洞府，多半是胡诌", "入夜城头挂起八十一盏灵灯，凡人只当是节庆" ] },
      { id: "b1moy", n: "墨府药园", d: "药香幽深 · 禁地边缘",
        tale: [ "循药香摸到一片围墙外，墙头趴着只打盹的黑猫", "药童出来倒药渣，你帮他拾掇，趁机认了半篓药性", "园内深处忽有人声，你屏息躲进柴垛后", "走时在墙根捡到一枚被踩进泥里的青翠叶片" ] },
      { id: "b1cln", n: "沧澜渡口", d: "江雾漫漫 · 渡口夜泊",
        tale: [ "雾夜江心有人唱渔歌，声调古拙，像祭文不像歌", "老艄公说这条江底下沉着一条旧龙脉", "帮船家卸了一夜货，得了些散碎银两", "你在渡口石碑下避雨，碑后刻着一副残缺阵图" ] },
      { id: "b1sps", n: "四平山猎场", d: "妖兽出没 · 猎队集结",
        tale: [ "一支猎妖队正缺个斥候，你替他们望了一夜风", "山涧里发现半具妖兽骸骨，妖丹被人取走了", "猎户老周分你半壶药酒，说是壮胆用的", "你在崖缝里抠出一块带灵光的碎石" ] },
      { id: "b1qys", n: "青阳坊", d: "半山集市 · 以物易物",
        tale: [ "山民以兽骨换盐，你看中一块磨得发亮的骨片", "坊口有个摆摊的盲眼道人，只跟有缘人搭话", "你拿一株路上采的黄精换到半张泛黄药方", "暮色里集市散场，山道上亮起一串灯笼" ] },
    ] },
  { big: 2, name: "筑基诸海", dur: [7200, 172800],
    mats: [ { id: "zihou", c: .9, a: 1, b: 3 }, { id: "shexian", c: .45, a: 1, b: 2 },
            { id: "lingru", c: .3, a: 1, b: 2 }, { id: "dihuo", c: .22, a: 1, b: 1 },
            { id: "yaodan", c: .4, a: 1, b: 1 } ],
    locs: [
      { id: "b2hfg", n: "黄枫谷", d: "宗门坊市 · 灵植灵药",
        tale: [ "坊市药铺掌柜眼毒，仍卖了你一株好药", "后山枫林下捡到一枚玉简残片，字迹已漶漫", "守山弟子的灵兽朝你嗅了嗅，竟没示警", "夜里坊市打烊，你在檐下听两个外门弟子聊宗门秘辛" ] },
      { id: "b2lxn", n: "乱星海", d: "夜航群岛 · 星罗棋布",
        tale: [ "夜航船上与一位跛脚散修对饮，他酒后吐露沉船灵藏", "小岛渔民把你当仙人，求你为出海的孙儿画道平安符", "潮落后礁石缝里卡着半截储物袋，只有一枚生锈妖丹", "海市蜃楼里看见一口灵气冲霄的古井" ] },
      { id: "b2kxd", n: "魁星岛", d: "洞府云集 · 海上仙市",
        tale: [ "岛上修士家家门前悬着测灵旗，见你经过猎猎作响", "你在仙市摆了半天摊，用黄精换到一瓶灵泉水", "岛主府设宴款待各方散修，你混进去吃了顿好的", "夜深人静时，整座岛的洞府灵光次第亮起，像一树星" ] },
      { id: "b2yjb", n: "燕家堡", d: "岛主城寨 · 铁血秩序",
        tale: [ "堡门前立着两尊吞海兽像，眼珠是打磨过的妖丹", "堡内不许私斗，伤了人要按岛规断一指", "你替堡中账房誊了一夜海贸册子，得了些酬劳", "离堡那日，海风里飘来堡主千金练剑的破空声" ] },
    ] },
  { big: 3, name: "极渊之海", dur: [28800, 518400],
    mats: [ { id: "xuancan", c: .9, a: 1, b: 3 }, { id: "zihou", c: .3, a: 1, b: 2 },
            { id: "lingru", c: .5, a: 1, b: 2 }, { id: "dihuo", c: .42, a: 1, b: 2 },
            { id: "yaodan", c: .6, a: 1, b: 2 } ],
    locs: [
      { id: "b3xtw", n: "虚天殿外", d: "古迹重门 · 云海之上",
        tale: [ "殿门前的石阶共九千九百级，走上去像是踩在云端", "云海里偶有修士御剑而过，谁也没看谁", "门楣古篆年深日久，你逐字揣摩，识得三成", "殿前空地上有座无字碑，有人用剑刻了半行诗" ] },
      { id: "b3hdx", n: "海底灵墟", d: "沉陆遗迹 · 灵光明灭",
        tale: [ "海沟里沉睡着一座旧城，屋宇俱是白玉砌成", "你捡到一枚贝壳，壳里藏着一滴千年蚌泪", "遗迹中心的灵脉像断弦的古琴，偶尔自己嗡鸣一声", "离开时一条老鲛人远远望着你，没入深蓝" ] },
      { id: "b3jyd", n: "极阴岛", d: "幽冥之滨 · 寒潮不息",
        tale: [ "岛上终年不见日光，却有一种白花在阴影里怒放", "渔家说月亮照不到的海面下，压着一条旧龙", "你在岛礁上发现半座残阵，像是上古封镇之物", "夜里潮声呜咽，分不清是浪还是叹息" ] },
      { id: "b3ymh", n: "幽冥海沟", d: "极深之处 · 灵压如山",
        tale: [ "越往深处，水中灵光越密，像坠入一条光的河", "压力大得连法器都微微变形，你不敢再深", "沟底有东西在缓慢翻动，你当机立断返身", "上浮时遇见一群灯笼鱼，为你照了一路" ] },
    ] },
  { big: 4, name: "天外诸域", dur: [86400, 1209600],
    mats: [ { id: "jiuyou", c: .9, a: 1, b: 3 }, { id: "xuancan", c: .32, a: 1, b: 2 },
            { id: "lingru", c: .7, a: 1, b: 2 }, { id: "dihuo", c: .6, a: 1, b: 2 },
            { id: "yaodan", c: .8, a: 1, b: 2 } ],
    locs: [
      { id: "b4xt", n: "虚天殿", d: "古迹重重 · 一步一禁",
        tale: [ "殿中长廊悬着历任闯殿者的名字，越深处越少", "你在偏殿找到一副残棋，棋局似乎还未下完", "墙上壁画画的是一场你没见过的战争", "殿深处传来钟声，这里早已没有活人" ] },
      { id: "b4bh", n: "冰海", d: "亘古寒域 · 万物凝霜",
        tale: [ "海面冻成整块墨玉，踩上去没有一丝声响", "冰层下有巨大的影子缓缓游过", "你呵出的气在空中凝成细小的冰晶，久久不散", "极北天光垂下，把整片冰海染成青碧" ] },
      { id: "b4ljx", n: "灵界裂隙", d: "两界夹缝 · 罡风如刀",
        tale: [ "裂隙中涌出的灵气浓得像酒，吸一口都醉人", "你看见对面有座比山还高的城，只露出一角", "罡风里裹着异界的沙尘，落在掌心竟自行聚成小塔", "裂隙边缘立着块碑，碑文用的是你从未见过的文字" ] },
    ] },
  { big: 5, name: "人界之巅", dur: [172800, 2592000],
    mats: [ { id: "wenxin", c: .9, a: 1, b: 3 }, { id: "jiuyou", c: .35, a: 1, b: 2 },
            { id: "lingru", c: .85, a: 1, b: 2 }, { id: "dihuo", c: .75, a: 1, b: 2 },
            { id: "yaodan", c: .85, a: 1, b: 2 } ],
    locs: [
      { id: "b5fst", n: "飞升台", d: "人界之巅 · 天劫留痕",
        tale: [ "台面焦黑，是历次飞升天劫留下的痕迹", "你在台边坐了一夜，看云海在脚下翻涌", "据说从这里望出去，能隐约看见灵界", "台基上刻满了历代飞升者的道号" ] },
      { id: "b5skl", n: "时空乱流", d: "光阴错乱 · 不可久留",
        tale: [ "在这里有时一瞬如一年，有时一年如一瞬", "你看见一个像你又不像你的背影，一闪即逝", "乱流里飘着各种年代的残片，有一片写着你的名字", "风把你吹回现世时，衣摆还带着异界的尘埃" ] },
    ] },
];
const RECIPES = {   // 丹方 v2 —— 每方带 big(所属大境0~5)，材料只用本境可集齐之物
  /* ---- 隐藏丹(丹方残页解锁, h:1; 纵向毕业向: 强力buff, 只取最强一道故须超越公开buff) ---- */
  xuanwu: { big: 0, h: 1, n: "玄牝丸", d: "上古残方：一个时辰内修为 +60%",
            need: { huangjing: 5, yaodan: 1 }, eff: { k: "buff", mult: 1.6, dur: 3600 } },
  tianyuan: { big: 1, h: 1, n: "天元聚气丹", d: "镜州古丹残篇：两个时辰内修为 +200%",
            need: { shexian: 5, lingru: 2, yaodan: 2 }, eff: { k: "buff", mult: 3, dur: 7200 } },
  jiuzhuan: { big: 2, h: 1, n: "九转玉髓丹", d: "乱星海沉船古方：三个时辰内修为 +300%",
            need: { zihou: 5, lingru: 3, dihuo: 2 }, eff: { k: "buff", mult: 4, dur: 10800 } },
  taishang: { big: 3, h: 1, n: "太上凝金丹", d: "虚天殿壁刻残方：三个时辰内修为 +400%",
            need: { xuancan: 5, lingru: 3, yaodan: 3 }, eff: { k: "buff", mult: 5, dur: 10800 } },
  jiutian: { big: 4, h: 1, n: "九天婴华丹", d: "灵界裂隙飘来的丹道：四个时辰内修为 +500%",
            need: { jiuyou: 5, lingru: 4, dihuo: 3 }, eff: { k: "buff", mult: 6, dur: 14400 } },
  hunyuan: { big: 5, h: 1, n: "混元无极丹", d: "飞升台前人界第一丹：六个时辰内修为 +700%",
            need: { wenxin: 5, lingru: 4, dihuo: 3, yaodan: 4 }, eff: { k: "buff", mult: 8, dur: 21600 } },

  /* ---- 凡人(凡草单方，未入丹道) ---- */
  hjing: { big: 0, n: "黄精膏", d: "凡草慢熬，聊胜于无：立时回复约一刻钟修为",
            need: { huangjing: 3 }, eff: { k: "inst", sec: 900 } },
  /* ---- 炼气(镜州丹道) ---- */
  buqi:  { big: 1, n: "补气丹", d: "炼气常备：立时回复约半个时辰修为",
            need: { shexian: 2, lingru: 1 }, eff: { k: "inst", sec: 1800 } },
  hlong: { big: 1, n: "黄龙丹", d: "药力绵长：一时辰内修为 +50%",
            need: { shexian: 3, lingru: 1 }, eff: { k: "buff", mult: 1.5, dur: 3600 } },
  jinzui:{ big: 1, n: "金髓丸", d: "冲境烈药：一时辰内修为 +120%",
            need: { shexian: 2, dihuo: 1 }, eff: { k: "buff", mult: 2.2, dur: 3600 } },
  zhuji: { big: 1, n: "筑基丹", d: "炼气圆满的叩门砖：立获约三时辰修为，此后两时辰修为翻倍",
            need: { shexian: 4, lingru: 2, yaodan: 2 }, eff: { k: "grand", sec: 10800, mult: 2, dur: 7200 } },
  /* ---- 筑基(海外丹道) ---- */
  xisui: { big: 2, n: "洗髓丹", d: "洗髓伐脉：十二时辰内离线收益 +30%",
            need: { zihou: 2, lingru: 1 }, eff: { k: "offline", dur: 43200, boost: .3 } },
  yuqing:{ big: 2, n: "玉清丹", d: "筑基培元：立时回复约两时辰修为",
            need: { zihou: 3, lingru: 1 }, eff: { k: "inst", sec: 7200 } },
  jiangchen: { big: 2, n: "降尘丹", d: "筑基圆满感结丹机缘：立获约六时辰修为，此后三时辰修为 +120%",
            need: { zihou: 4, lingru: 2, dihuo: 1, yaodan: 2 }, eff: { k: "grand", sec: 21600, mult: 2.2, dur: 10800 } },
  /* ---- 结丹(寒域丹道) ---- */
  guyuan:{ big: 3, n: "固元丹", d: "金丹固本：立时回复约两时辰修为",
            need: { xuancan: 2, dihuo: 1 }, eff: { k: "inst", sec: 7200 } },
  ningyuan: { big: 3, n: "凝元丹", d: "三时辰内修为 +200%，冲击金丹后期",
            need: { xuancan: 3, lingru: 2, yaodan: 2 }, eff: { k: "buff", mult: 3, dur: 10800 } },
  yingbian: { big: 3, n: "婴变丹", d: "结丹圆满窥元婴大道：立获约六时辰修为，此后四时辰修为 +150%",
            need: { xuancan: 4, dihuo: 2, lingru: 2, yaodan: 3 }, eff: { k: "grand", sec: 21600, mult: 2.5, dur: 14400 } },
  /* ---- 元婴(幽域丹道) ---- */
  yuying:{ big: 4, n: "育婴丹", d: "滋养元婴：立时回复约四时辰修为",
            need: { jiuyou: 2, lingru: 2 }, eff: { k: "inst", sec: 14400 } },
  yinghua: { big: 4, n: "婴华丹", d: "四时辰内修为 +250%，元婴期冲关利器",
            need: { jiuyou: 3, lingru: 2, dihuo: 1 }, eff: { k: "buff", mult: 3.5, dur: 14400 } },
  tongshen: { big: 4, n: "通神丹", d: "元婴圆满感化神天劫：立获约八时辰修为，此后六时辰修为 +200%",
            need: { jiuyou: 4, dihuo: 2, lingru: 2, yaodan: 3 }, eff: { k: "grand", sec: 28800, mult: 3, dur: 21600 } },
  /* ---- 化神(巅峰丹道，静候飞升) ---- */
  wendao:{ big: 5, n: "问道丹", d: "化神问道：立时回复约四时辰修为",
            need: { wenxin: 2, lingru: 2 }, eff: { k: "inst", sec: 14400 } },
  hunyuan: { big: 5, n: "混元一气丹", d: "六时辰内修为 +300%，人界绝巅的一口气",
            need: { wenxin: 3, dihuo: 2, yaodan: 3 }, eff: { k: "buff", mult: 4, dur: 21600 } },
  taiyi: { big: 5, n: "太一虚元丹", d: "化神圆满静候飞升的底蕴：立获约十二时辰修为，此后六时辰修为 +250%",
            need: { wenxin: 4, lingru: 3, dihuo: 2, yaodan: 4 }, eff: { k: "grand", sec: 43200, mult: 3.5, dur: 21600 } },
};


const $ = id => document.getElementById(id);
const fmt = n => n >= 1e8 ? (n / 1e8).toFixed(2).replace(/\.?0+$/, "") + "亿"
             : n >= 1e4 ? (n / 1e4).toFixed(1).replace(/\.0$/, "") + "万"
             : Math.floor(n).toLocaleString();

function seg(i) { return SEG_META[Math.min(i, TOTAL_SEGS - 1)]; }
function realm() { return seg(state.realmIdx); }
function bigIdx() { return realm().bigIdx; }

/* 存档对象清洗(本地/云端共用): 合法则返回清洗后的对象, 否则返回 null */
function adopt(s) {
  if (!s || !Array.isArray(s.arts)) return null;
  if (!Array.isArray(s.journal)) s.journal = [];
  if (!s.milestones || typeof s.milestones !== "object") s.milestones = {};
  if (typeof s.peakSpirit !== "number") s.peakSpirit = 0;
  if (typeof s.bestArtQ !== "number") s.bestArtQ = -1;
  if (typeof s.realmIdx !== "number" || s.realmIdx < 0) s.realmIdx = 0;
  if (typeof s.exp !== "number") s.exp = 0;
  if (typeof s.spirit !== "number") s.spirit = 0;
  if (typeof s.arrayLv !== "number" || s.arrayLv < 1) s.arrayLv = 1;
  if (typeof s.lastTs !== "number") s.lastTs = Date.now();
  if (!s.mats || typeof s.mats !== "object") s.mats = {};
  if (!s.pills || typeof s.pills !== "object") s.pills = {};
  if (!Array.isArray(s.buffs)) s.buffs = [];
  if (typeof s.offlineBoostUntil !== "number") s.offlineBoostUntil = 0;
  if (!s.travel || typeof s.travel !== "object") s.travel = null;
  if (!Array.isArray(s.mails)) s.mails = [];
  // 装备归一: 六槽旧档(兵兵护护佩诀)→四部位(兵护佩诀), 多余两件熔回灵石; 无属性旧件按部位补(确定性)
  if (Array.isArray(s.arts)) {
    const M4T = ["w", "a", "p", "s"];
    if (s.arts.length > 4) {
      const pick = [];
      const order = [0, 2, 4, 5];                       // 六槽中保留 兵(0)/护(2)/佩(4)/诀(5)
      for (const oi of order) { const it = s.arts[oi]; if (it) { it.slot = pick.length; it.tp = M4T[pick.length]; pick.push(it); } }
      let rc = 0;
      for (let i = 0; i < s.arts.length; i++) if (!pick.includes(s.arts[i])) rc += Math.round(40 * Math.pow(1.5, s.arts[i].q || 0));
      if (rc > 0) s.spirit = (s.spirit || 0) + rc;
      s.arts = pick;
    }
    s.arts.forEach((a, i) => {
      if (a && typeof a.a !== "number") {
        a.slot = Math.min(i, 3); a.tp = M4T[Math.min(i, 3)];
        a.lv = (typeof s.realmIdx === "number" ? s.realmIdx : 0) + 1;
        const q = typeof a.q === "number" ? a.q : 0, M = eqMult(q), lv = a.lv, s2 = hashRand((a.name || "") + q + i);
        if (i % 4 === 0) { a.a = Math.round((10 + s2 * 40) * lv * M); a.h = 0; a.d = 0; }
        else if (i % 4 === 1) { a.h = Math.round((100 + s2 * 300) * lv * M); a.d = Math.max(1, Math.round((1 + s2 * 11) * lv * M)); a.a = 0; }
        else if (i % 4 === 2) { a.h = Math.round((40 + s2 * 120) * lv * M); a.d = Math.max(1, Math.round((1 + s2 * 5) * lv * M)); a.a = Math.round((4 + s2 * 12) * lv * M); }
        else { a.a = Math.round((6 + s2 * 18) * lv * M); a.d = Math.max(1, Math.round((1 + s2 * 7) * lv * M)); a.h = 0; }
      }
    });
  }
  if (!s.pages || typeof s.pages !== "object") s.pages = {};
  return s;
}
/* 短档存取: 全链路(LZString)压缩, 不裸存汉字正文; 旧档(未压缩 JSON)自动兼容 */
function zPack(o) { return "z1:" + LZString.compressToBase64(JSON.stringify(o)); }
function zUnpack(s) {
  if (typeof s !== "string") return s;                       // 已是对象(老后端/云端老档)
  if (s.startsWith("z1:")) { try { return JSON.parse(LZString.decompressFromBase64(s.slice(3))); } catch (e) { return null; } }
  try { return JSON.parse(s); } catch (e) { return s; }      // 旧版未压缩 JSON
}
const JRN_CAP = 300;   // 修行录叙事有界: 超出丢弃最旧, 防存档无限膨胀
function trimJournal() {
  if (Array.isArray(state.journal) && state.journal.length > JRN_CAP) {
    state.journal = state.journal.slice(-JRN_CAP);
  }
}
function save() {
  state.lastTs = Date.now();
  trimJournal();
  try { localStorage.setItem(SAVE_KEY, zPack(state)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = zUnpack(raw);
    const c = adopt(s);
    if (c) {
      state = c; trimJournal();
      /* v1.3.0 修: 启动瞬间 save() 会无条件把 lastTs 刷成「现在」, 把真实离线段吞掉,
         导致 applyOffline 算出 dt≈0、云端 settle 也按 0 结算 —— 离线收益形同虚设。
         载入时先把存档里的原始 lastTs 存进 _lastTs0, 离线结算以它为基准。 */
      state._lastTs0 = (s && s.lastTs) || c.lastTs || 0;
    }
  } catch (e) {}
}

/* ============ 云存档 (save.devgo.cn, ECS 隧道) ============
 * 玩家码即钥匙: 换设备时在新设备输入同一玩家码即继承存档。
 * 本地永远可玩: 云不可用时静默降级为 localStorage。 */
function cldApiBase() {
  // 沙箱本地开发走本地结算后端；线上走 ECS(dongtian-save)
  try {
    if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
      return "http://127.0.0.1:8090/api/save";
    }
  } catch (e) {}
  return "https://save.devgo.cn/api/save";
}
const CLD_API = cldApiBase();
const CLD_KEY = "dongtian_cloud_id";
const CLD_ALPH = "abcdefghjkmnpqrstuvwxyz23456789";
const cld = { id: "", ready: false, dirty: false, lastOkTs: 0, lastOkLocal: 0, lastPushTs: 0, lastErr: "" };
function cldFail(e) {
  let msg = "";
  if (!e) msg = "unknown";
  else if (e && e.name === "AbortError") msg = "连接超时(网络慢?)";
  else if (e && e.message) msg = String(e.message).slice(0, 80);
  cld.lastErr = msg;
  try { cldUI("off"); } catch (err) {}
  const hint = $("cloudErr"); if (hint) hint.textContent = "最近错误: " + msg;
}

function cldId() {
  if (cld.id) return cld.id;
  try { cld.id = localStorage.getItem(CLD_KEY) || ""; } catch (e) {}
  if (!cld.id) {
    let s = "";
    for (let i = 0; i < 12; i++) s += CLD_ALPH[Math.floor(Math.random() * CLD_ALPH.length)];
    cld.id = "dt-" + s;
    try { localStorage.setItem(CLD_KEY, cld.id); } catch (e) {}
  }
  return cld.id;
}
function cldApi(method, body, extraQ) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 6000);   // 6s 超时, 弱网不阻塞启动/离线结算
  return fetch(CLD_API + "?id=" + encodeURIComponent(cldId()) + (extraQ ? "&" + extraQ : ""), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: ctl.signal,
  }).then(r => { clearTimeout(tm); if (!r.ok) throw new Error("http" + r.status); return r.json(); })
    .catch(e => { clearTimeout(tm); throw e; });
}
function cldChip() {
  const el = $("cloudTxt");
  if (!el) return null;
  return el;
}
function cldUI(mode) {
  const chip = $("cloudChip");
  if (!chip) return;
  chip.classList.remove("on", "off", "sync");
  chip.classList.add(mode);
  const el = cldChip();
  if (!el) return;
  if (mode === "sync") el.textContent = "云存·同步中";
  else if (mode === "off") el.textContent = "云存·未连接";
  else {
    const d = Date.now() - cld.lastOkTs;
    el.textContent = "云存·✓ " + (d < 60000 ? "刚才" : Math.floor(d / 60000) + "分前");
  }
  const idEl = $("cloudId");
  if (idEl) idEl.textContent = cldId();
}
function cldFlash(txt) {
  const el = cldChip();
  if (!el) return;
  const old = el.textContent;
  el.textContent = txt;
  setTimeout(() => { el.textContent = old; }, 1600);
}
function cldAdoptCloud(s) {
  const c = adopt(s);
  if (!c) return false;
  state = c;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  updateRealmUI(); updateHUD(); updateArts(); realmPlot();
  /* v1.5.0: 云端档可能没有 autoHunt / travel 字段(老档), 采纳后按钮与行迹要跟着重绘,
     否则会出现"state 已变、开关还停在旧态"的错看 */
  renderAutoHunt(); travelBtnLbl(); traceRefresh();
  return true;
}
async function cldPush() {
  state.lastTs = Date.now();
  trimJournal();
  try {
    const r = await cldApi("PUT", { __z: zPack(cloudSnap(state)) });
    state._cloudTs = r.ts || Date.now();
    save();
    cld.ready = true; cld.lastOkTs = Date.now(); cld.lastOkLocal = state.lastTs;
    cld.lastPushTs = Date.now();
    cldUI("on");
    cld.lastErr = "";
    const hint = $("cloudErr"); if (hint) hint.textContent = "";
    return true;
  } catch (e) { cldFail(e); return false; }
}
async function cldPull() {
  if (!window.fetch) { cldUI("off"); return; }
  cldUI("sync");
  try {
    const r = await cldApi("GET", undefined, "fmt=z1");
    if (r && r.data) r.data = zUnpack(r.data);
    if (r.found && r.data) {
      const cs = (r.ts || 0);               // 服务端存档时间(权威)
      const ls = (state._cloudTs || 0);
      if (cs > ls) {
        /* 云端比本地同步点新 → 采用云端档(冲突安全方向: 云新优先, 防旧档覆盖新云)。
         * 不在此立刻推送/调 save() —— 它们会把 lastTs 刷成"现在", 吞掉随后的离线结算;
         * 改为直写本地保留云端 lastTs, 离线收益由启动的 applyOffline 统一结算后再回写 */
        let hadLocal = false;
        try { hadLocal = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
        const adopted = cldAdoptCloud(r.data);
        state._cloudTs = cs;
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
        cld.ready = true; cld.lastOkTs = Date.now();
        if (adopted && hadLocal) {
          pushMsg("main", `<span class="b">云存</span>检测到云端进度更新，已采用云端存档（请勿同一玩家码多设备同时游玩）。`);
        }
        cldUI("on");
        return;
      }
      if (cs < ls || cld.dirty) {       // 本地有未上传进度 → 上传
        await cldPush();
        cld.dirty = false;
        return;
      }
      // 已同步一致
      cld.ready = true; cld.lastOkTs = Date.now(); cld.lastOkLocal = state.lastTs;
      cldUI("on");
      return;
    }
    // 云端还没有此玩家码 → 建档上传
    await cldPush();
    cld.dirty = false;
  } catch (e) { cldFail(e); }
}
function cloudPushNow() {
  if (!window.fetch) return;
  if (!cld.ready) { cld.dirty = true; return; }   // 尚未完成首次同步, 先标记等 pull 后再传
  cldUI("sync");
  cldPush().then(ok => { if (ok) cldUI("on"); });
}
function cloudPullNow() { cldPull(); }
const CLOUD_PUSH_MIN = 300000;   // v1.5.1: 静默兜底窗口 5 分钟(窗口内所有高频进度合并为 1 次 PUT)
function cloudSoon() { cld.dirty = true; }   // v1.5.1: 高频自动事件(战斗/秘境/装备择优/收信)只标脏, 由定时器合并上传, 不再每场推一次
function cloudFlush() {                       // v1.5.1: 关键节点/关页/切后台 → 强制立即推(不可逆操作不丢)
  if (!cld.ready) { cld.dirty = true; return; }
  cloudPushNow();
}
function cloudTogglePanel(ev) {
  ev = ev || window.event;
  if (ev) ev.stopPropagation();
  const p = $("cloudPanel");
  if (!p) return;
  const show = p.classList.toggle("show");
  if (show) { const inp = $("cloudInput"); if (inp) inp.value = ""; }
}
function cloudCopyId() {
  const id = cldId();
  const done = () => cldFlash("玩家码已复制");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id).then(done).catch(() => fallbackCopy(id, done));
  } else fallbackCopy(id, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (e) { cldFlash("复制失败, 请手动记下"); }
  document.body.removeChild(ta);
}
function cloudBind() {
  const v = (($("cloudInput") || {}).value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{3,23}$/.test(v)) { cldFlash("玩家码格式不对"); return; }
  try { localStorage.setItem(CLD_KEY, v); } catch (e) {}
  cld.id = v; cld.ready = false; cld.dirty = false;
  const idEl = $("cloudId"); if (idEl) idEl.textContent = v;
  cldPull();
}
function cloudInit() {
  cldId();
  const chip = $("cloudChip");
  document.addEventListener("click", e => {
    const p = $("cloudPanel");
    if (p && p.classList.contains("show") && chip &&
        !e.target.closest("#cloudPanel") && !e.target.closest("#cloudChip")) p.classList.remove("show");
  });
  cldUI("sync");
  addEventListener("online", () => { if (!cld.ready) cldPull(); });   // 断网恢复后自动补同步
  bootCloud();           // 首次: 先同步云端, 再统一结算一次离线收益
  /* 低频兜底上传: 每 60s 检查一次, 仅在"有未同步进度"且"距上次成功上传 ≥5 分钟"时才传,
   * 避免高频轮询; 关键节点(突破/升阵/离线结算/切后台)另行即时上传 */
  setInterval(() => {   // v1.5.1: 每 60s 检查, 有未同步进度且距上次成功推 ≥5 分钟才推(合并窗口内所有高频进度)
    if (!cld.ready) return;
    if (cld.dirty && Date.now() - cld.lastPushTs > CLOUD_PUSH_MIN) { cld.dirty = false; cloudPushNow(); }
  }, 60000);
}

/* 启动流程: 先尝试拉云端(网络失败静默, 本地照常可玩),
 * 再以"最终采用的存档"的基准(lastTs/_settledTs 取大)结算一次离线收益,
 * 保证换设备/清缓存也不会漏发或重发。 */
async function bootCloud() {
  await cldPull();
  /* 后端权威结算优先: 上传"不推进 lastTs"的快照 → 服务端按服务器时间结算离线区间与云游归来。
   * 成功 → 采纳返回的已结算档并展示; 云端不可用/非 settle 后端 → 本地 applyOffline 兜底(本地永远可玩)。 */
  let sr = null;
  try { sr = await cloudSettle(); } catch (e) { sr = null; }
  if (sr && sr.settled) presentSettle(sr);
  else if (!sr) applyOffline();
  cloudFlush();   // v1.5.1: 启动结算后尽快把建档/离线收益上云
  updateRealmUI(); updateHUD(); updateArts(); realmPlot();
}

/* ============ 数值 ============ */
function realmMult() { return Math.pow(bigIdx() + 1, 2.05); } // 大境界指数
function artMult() { return state.arts.reduce((m, a) => m * a.mult, 1); }
function buffMult() {
  const t = Date.now();
  state.buffs = (state.buffs || []).filter(b => b.until > t);
  // 药力相冲，只取当前最强的一道（防 buff 叠乘指数爆炸）
  if (!(state.buffs || []).length) return 1;
  return Math.max(...state.buffs.map(b => b.mult));
}
function rateNow() { return 4 * realmMult() * artMult() * arrMult(state.arrayLv) * buffMult(); }
function spiritRate() { return SPIRIT_RATE(state.arrayLv); }

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
function makeArt() {          // 六槽部位: 槽0兵 1兵 2护 3护 4佩 5诀
  const q = pickQ();
  const arts = state.arts || [];
  const slot = arts.length < 4 ? arts.length : Math.floor(Math.random() * 4);
  const tp = SLOT_TYPES[slot];
  const lv = (state.realmIdx || 0) + 1;
  let name = artName(tp.k, q);
  const art = { name, q, mult: QUALITY[q].mult, t: Date.now(), tp: tp.k, slot, lv };
  attrAssign(art, tp.k, q, lv);
  return art;
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
  /* 灵力辉光按大境界切换(读 #cult data-big); 试光环预览期间保持所选境界 */
  const cult0 = document.getElementById("cult");
  if (cult0 && !__auraBig) cult0.setAttribute("data-big", r.big);
}
/* v1.6.0-A 数值成长爽感: 缓动显示(数字滚动涌入) + 离散增益飘字 + chip 微脉冲 */
let _dsp = { spirit: 0, exp: 0 }, _floatPrev = { spirit: 0, exp: 0 };
function tickDsp(dt) {
  const k = Math.min(1, dt * 5);
  _dsp.spirit += (state.spirit - _dsp.spirit) * k;
  _dsp.exp += (state.exp - _dsp.exp) * k;
  if (Math.abs(state.spirit - _dsp.spirit) < 0.5) _dsp.spirit = state.spirit;
  if (Math.abs(state.exp - _dsp.exp) < 0.5) _dsp.exp = state.exp;
}
function spawnFloat(el, txt, neg) {
  if (!el) return;
  const s = document.createElement("span");
  s.className = "res-float" + (neg ? " neg" : "");
  s.textContent = txt; el.appendChild(s);
  setTimeout(() => s.remove(), 950);
}
function pulseChip(el) { if (!el) return; el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }
function updateHUD() {
  const r = realm();
  $("expText").textContent = fmt(_dsp.exp);
  $("expNeed").textContent = r.need === Infinity ? "∞" : fmt(r.need);
  const pct = Math.min(100, _dsp.exp / r.need * 100);
  $("expFill").style.width = pct + "%";
  $("spirit").textContent = fmt(_dsp.spirit);
  $("rateText").textContent = fmt(rateNow());
  $("arrayLv").textContent = state.arrayLv;
  // 可渡劫: 处于大境界末尾且修为圆满
  const can = state.exp >= r.need && r.isBigEnd && state.realmIdx < TOTAL_SEGS - 1;
  const btn = $("btnBreak");
  btn.disabled = !can;
  // 注意：绝不能 btn.textContent=...（会删除按钮内嵌的 SVG 墨块皮肤）→ 只更新文字标签
  const bt = btn.querySelector(".label");
  if (bt) bt.innerHTML = can ? "☯ 渡劫突破" : "☯ 立即突破";
  btn.classList.toggle("ready", can);
  if (can && !lastReadyHint) {
    lastReadyHint = true;
    const nextBig = seg(state.realmIdx + 1).big;
    pushMsg("main", `<span class="r">${r.big}·${段名(r)}已圆满</span>——你随时可亲手渡劫，踏入<span class="g">${nextBig}</span>`);
  }
  if (!can) lastReadyHint = false;
  /* v1.6.0-A: 离散增益飘字 — 单帧变化远超平滑增速阈值才视为一次获得/花费, 自动覆盖所有获得点(adventure/邮件/离线/精进) */
  const thr = Math.max(6, rateNow() * 0.6);
  const dS = state.spirit - _floatPrev.spirit;
  if (dS > thr) { spawnFloat($("spirit").parentElement, "+" + fmt(dS)); pulseChip($("spirit").parentElement); }
  else if (dS < -thr) { spawnFloat($("spirit").parentElement, fmt(dS), true); }
  _floatPrev.spirit = state.spirit;
  const dE = state.exp - _floatPrev.exp;
  if (dE > thr) spawnFloat($("expWrap"), "+" + fmt(dE));
  _floatPrev.exp = state.exp;
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
  // v1.6.0-C: 雷劫蓄力段 — 先 1.0s 天劫将至(屏幕电框 + 主角灵光蓄力), 再破境
  pushMsg("main", `<span class="r">天劫将至……</span>${r.label} 将渡 ${next.label}`);
  const trib = $("trib"); if (trib) { trib.classList.remove("show"); void trib.offsetWidth; trib.classList.add("show"); }
  const cult = $("cult"); if (cult) { cult.classList.remove("trib-glow"); void cult.offsetWidth; cult.classList.add("trib-glow"); }
  setTimeout(() => {
    if (trib) trib.classList.remove("show");
    if (cult) cult.classList.remove("trib-glow");
    // 破境: 金光闪 + 境界名弹字 + 粒子爆发
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
      cloudFlush();   // v1.5.1: 渡劫突破是不可逆的关键跃迁 → 立即上云
      const nr = realm();
      const greet = ["金丹凝形！", "元婴出窍！", "化神之姿！", "踏入筑基！"][nr.bigIdx - 2] || "";
      pushMsg("main", `<span class="g">${nr.big}</span>！${greet || "修行又进一步"}`);
      realmPlot();
    }, 950);
  }, 1000);
}
function manualBreak() { doBreak(); }

/* 聚灵阵 */
function arrayCostNow() { return ARRAY_COST(state.arrayLv); }
function tapArray() {
  const cost = arrayCostNow();
  if (state.spirit >= cost) {
    state.spirit -= cost; state.arrayLv++; save(); updateHUD(); cloudFlush();  // v1.5.1: 花灵石升阵 → 立即上云
    pushMsg("main", `聚灵阵升至 <span class="g">Lv.${state.arrayLv}</span>（下一级需灵石 ${fmt(arrayCostNow())}）`);
  } else {
    pushMsg("main", `灵石不足(升至 Lv.${state.arrayLv + 1} 需 ${fmt(cost)})，阿青见你叹气，尾巴一竖，满山替你找矿去了`);
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
  const cap = (side === "main") ? 6 : 5;
  // 超过条数上限：最旧一条立即淡出，形成"字幕滚动"节奏
  if (box.children.length > cap) {
    const old = box.lastChild;
    old.style.transition = "opacity .55s ease";
    old.style.opacity = "0";
    setTimeout(() => { if (old.parentNode) old.parentNode.removeChild(old); }, 560);
  }
  // 驻留时长：主线适中、分身更快
  const life = (side === "main") ? 11500 : 6000;
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, life + 300);
}

/* ============ 修行录: 主角亲身剧情(凡人→化神 六卷, 未历不显·不剧透) ============
 * 以凡人修仙传式际遇为骨, 主角一律为"你", 剧情卷由并行文案 Agent 充实。
 * PLOT[i] = 该大境剧情卷, beats 按【卷内修为进度】逐条解锁:
 *   进度 = (入境后小段数 + 段内修为比例) / 本境小段数; 节点 i 需 进度 ≥ i/len。
 *   大境之门须手动渡劫 → 离线最多走完当前卷, 绝不提前进入下一卷。
 */
const PLOT = [
 [
  {
   "key": "v0-01",
   "big": "凡人",
   "kind": "开篇",
   "title": "荒山残碑",
   "text": "迷路入荒山，暮色压林。疲极倚靠半截残碑，指腹摩过冰凉刻痕，忽觉一缕温热自掌心渗入经脉，转瞬即逝，只当是日头晒出的错觉。"
  },
  {
   "key": "v0-02",
   "big": "凡人",
   "kind": "际遇",
   "title": "猎户夜话",
   "text": "借宿山下老猎户棚屋，火光里听他嚼着干饼说怪事：北边断崖常有采药人有去无回，都道是撞见了仙人。你低头拨火，未敢全信，那话却像生了根。"
  },
  {
   "key": "v0-03",
   "big": "凡人",
   "kind": "际遇",
   "title": "市井谋生",
   "text": "镇上寻活不易，你在杂货铺做粗工，挑水劈柴、搬货算账，掌心新茧叠旧茧。夜里躺下肩背酸痛，总恍惚记起荒山残碑下那股转瞬即逝的温热。"
  },
  {
   "key": "v0-04",
   "big": "凡人",
   "kind": "际遇",
   "title": "茶棚闻仙",
   "text": "早市茶棚里，货郎压低嗓门：青枫谷秋收后山门外招杂役，不要身契，只收肯吃苦的活人。同桌老汉嗤笑是当牛做马。你低头添了茶钱，暗自心动。"
  },
  {
   "key": "v0-05",
   "big": "凡人",
   "kind": "际遇",
   "title": "辞别故里",
   "text": "你把存下的铜钱搁在矮桌上，权当谢过房东往日照拂。收拾好破旧行囊，临出门回望住了五年的小屋，檐下燕巢已空。没有送别的人，倒省了眼泪。"
  },
  {
   "key": "v0-06",
   "big": "凡人",
   "kind": "际遇",
   "title": "初叩山门",
   "text": "青枫谷山门石阶极长，你随百余名应募者排到日暮。管事在名簿上勾一笔，丢来粗布衣裳与竹牌：杂役丁字堂。夜宿通铺，窗外松涛一夜未歇。"
  },
  {
   "key": "v0-07",
   "big": "凡人",
   "kind": "际遇",
   "title": "得授薄册",
   "text": "扫地执事观你勤恳三月，收工后递来一卷薄册：睡不着就照它养神。是夜展看，册上小像盘膝而坐，鼻口间画着几道细线，是为引气吐纳初式。"
  },
  {
   "key": "v0-08",
   "big": "凡人",
   "kind": "际遇",
   "title": "初坐吐纳",
   "text": "更深露重，你独坐柴房外缓缓吐纳。冷风灌入肺腑，丹田处泛起一点若有若无的暖意，似有还无。你不敢睁眼，只怕一动作，便惊散了它。"
  }
 ],
 [
  {
   "key": "v1-01",
   "big": "炼气",
   "kind": "开篇",
   "title": "柴房气感",
   "text": "入谷半年，你白日洒扫药圃，夜里蜷在柴房吐纳。气息渐由游丝凝成涓流，稳稳落上炼气一层。同屋杂役笑你痴傻，你只当耳旁风。"
  },
  {
   "key": "v1-02",
   "big": "炼气",
   "kind": "际遇",
   "title": "溪底青瓶",
   "text": "后山挑水，桶绳磨断，木桶顺流漂远。你蹚水去捞，脚尖踢到一枚滑溜瓷物，捞起是巴掌大的青瓷小瓶，釉光温润。拔塞一嗅，草木气极淡。"
  },
  {
   "key": "v1-03",
   "big": "炼气",
   "kind": "际遇",
   "title": "枯药返青",
   "text": "药圃一株枯灵芝遭了虫蛀，眼看交不出份例。你想起那青瓷瓶，夜半偷偷滴了半滴露水。次日天光未亮便去瞧，枯茎抽新，灵芝泛着润泽水色。"
  },
  {
   "key": "v1-04",
   "big": "炼气",
   "kind": "际遇",
   "title": "床底药罐",
   "text": "自此你夜半潜进药圃，拣将死的枯药滴露救活，晒干收进陶罐。半年攒下二十余株灵药，顶寻常弟子数年月俸。此事你从不与人说。"
  },
  {
   "key": "v1-05",
   "big": "炼气",
   "kind": "际遇",
   "title": "供奉青眼",
   "text": "守药库的老供奉忽对你亲厚，说你上交的枯药成色奇佳，唤你进库房帮手。你躬身应下，心里却发毛——那浑浊眼底的亮光，不像是在看药。"
  },
  {
   "key": "v1-06",
   "big": "炼气",
   "kind": "际遇",
   "title": "夺舍之夜",
   "text": "夜里他唤你进库房深处，摆下收徒香案，命你饮引魂酒。你瞥见袖底压着泛黄的摄魂符，心下了然：寿元将尽之人，看上了你这具年轻肉身。"
  },
  {
   "key": "v1-07",
   "big": "炼气",
   "kind": "际遇",
   "title": "反手一击",
   "text": "你将酒含在舌下假作昏死。待他魂魄离壳扑来，你暴起，袖中药锄拍碎其天灵盖。他临死反手扬出一蓬腥粉，你喉头一甜，心知中毒。"
  },
  {
   "key": "v1-08",
   "big": "炼气",
   "kind": "际遇",
   "title": "半卷残经",
   "text": "三日后你指尖青黑，咯痰带铁锈味。搜遍密室只得半卷残经，解毒丹方夹在残页里。抄下后你原样放回，那两脉执事，却已为这半卷经动起手来。"
  },
  {
   "key": "v1-09",
   "big": "炼气",
   "kind": "际遇",
   "title": "献经换药",
   "text": "你把真本残经交到清正的巡查执事案头，说是老供奉遗物。执事验过收下，留你在身边跑腿，照残页配了解药——你这条命，算是捡回来了。"
  },
  {
   "key": "v1-10",
   "big": "炼气",
   "kind": "际遇",
   "title": "坊市一掷",
   "text": "你头回揣灵药下山进坊市，药铺符摊法器铺一字排开。掌柜验货眼睛发亮，你换了三叠低阶符纸、一把钝口法剑，又捎回半册《小法术杂抄》。"
  },
  {
   "key": "v1-11",
   "big": "炼气",
   "kind": "际遇",
   "title": "野林磨刀",
   "text": "谷外野林藏低阶妖兽。你日日揣符剑入林，专挑落单的独狼灰蟒下手，几场血战下来常有挂彩，出手却渐有章法，皮骨鳞甲也攒了小半袋。"
  },
  {
   "key": "v1-12",
   "big": "炼气",
   "kind": "际遇",
   "title": "火弹初成",
   "text": "夜里翻那半册杂抄，你挑一门火弹术苦练，掐诀掐得指节发僵。三个月后指尖终于腾起鸽卵大一团火，灼意燎人——自此出林，你腰杆硬了些。"
  },
  {
   "key": "v1-13",
   "big": "炼气",
   "kind": "际遇",
   "title": "溪谷援手",
   "text": "采药归途，灰衫同门被妖蟒缠上崖壁，挣扎将脱力。你甩出火弹燎其七寸，补符惊走蛇首，把他拽回石上。他咳着道谢，说这情分记下了。"
  },
  {
   "key": "v1-14",
   "big": "炼气",
   "kind": "际遇",
   "title": "西山矿洞",
   "text": "谷中分派矿洞轮值，同差的都嫌晦气。你下井一月，掘到的精矿不多，却在塌过的废巷道里扒出几块前人遗落的灵石与一截铁精，抵得上半年月俸。"
  },
  {
   "key": "v1-15",
   "big": "炼气",
   "kind": "际遇",
   "title": "无妄之灾",
   "text": "手里有了灵石，闲话也长了脚。炼气后期的灰袍师兄当众讨要采买之资，你不肯，他次日便扣了你药圃份例，扬言嘴硬有得是苦头吃。"
  },
  {
   "key": "v1-16",
   "big": "炼气",
   "kind": "际遇",
   "title": "秋后算账",
   "text": "你压下这口气，暗中记下他克扣的账，寻苦主逐一核证。待执事问罪，你递上名录便退到人后。灰袍师兄赔了双份赃银，从此见你绕道走。"
  },
  {
   "key": "v1-17",
   "big": "炼气",
   "kind": "际遇",
   "title": "山棚论道",
   "text": "炼气四层后你再难寸进，灵药越灌越虚。你领远差出谷散心，山道茶棚里遇个白发散修呷茶论道，他一句吐纳贵精纯不贵堆药，让你怔坐半晌。"
  },
  {
   "key": "v1-18",
   "big": "炼气",
   "kind": "际遇",
   "title": "村野除祟",
   "text": "途经山脚小村，村人夜不敢出，说有东西专叼落单孩童。你蹲守三夜，趁山魈扑食，一枚火弹打中胸口，补符了账。村老捧来灵石，你只取了三枚。"
  },
  {
   "key": "v1-19",
   "big": "炼气",
   "kind": "际遇",
   "title": "夜点家底",
   "text": "回谷后你脱了杂役差事，专接采药炼丹的活计，灵石渐厚，夜里点家底，只差一张丹方一味主药。筑基丹方与主药的下落，你开始托人打听。"
  },
  {
   "key": "v1-20",
   "big": "炼气",
   "kind": "际遇",
   "title": "丹讯暗涌",
   "text": "谷里暗流涌动：相传有一炉筑基丹将出世，只配给立大功的炼气圆满弟子。消息越传越真。你不动声色，只在无人处把吐纳磨得更纯。"
  },
  {
   "key": "v1-21",
   "big": "炼气",
   "kind": "际遇",
   "title": "禁地告示",
   "text": "执事堂外贴出告示：南疆血色禁地传闻将启，非炼气圆满不得请缨，赏格上却赫然列着筑基丹。你立在告示前良久，终究收回目光。"
  },
  {
   "key": "v1-22",
   "big": "炼气",
   "kind": "突破",
   "title": "闭关圆满",
   "text": "石室闭关，你将多年药力与搏杀磨出的锐气一并催发，内息冲撞七日，丹田一声轻鸣，气机圆融——炼气圆满。睁眼已是雪夜，该往下一步去了。"
  }
 ],
 [
  {
   "key": "v2-01",
   "big": "筑基",
   "kind": "突破",
   "title": "筑基功成",
   "text": "密室枯坐三月，丹田灵气终于凝成一汪旋转灵液，你筑基功成。推门出关，晨光正照青枫竹海，清风拂面，你长吐浊气，只觉寿元大涨，大道又近一步。"
  },
  {
   "key": "v2-02",
   "big": "筑基",
   "kind": "开篇",
   "title": "内门玉牌",
   "text": "传功长老宣读名录，你领得正式弟子玉牌及独立洞府，昔日同门见你渐生敬畏。你抚玉牌沉吟，深知筑基后不进则退，唯有勤修，方能不负这一线机缘。"
  },
  {
   "key": "v2-03",
   "big": "筑基",
   "kind": "际遇",
   "title": "听竹剑诀",
   "text": "长老传你本命剑诀「听竹剑诀」，以静制动，正合木灵根。自此你日夜在竹海下悟剑，一剑「风过千竿」劈出，剑气飒沓如竹浪，昔日根基尽数化作剑意。"
  },
  {
   "key": "v2-04",
   "big": "筑基",
   "kind": "际遇",
   "title": "游丝针成",
   "text": "剑诀小成，你另炼一套飞针「游丝针」，以灵火淬炼四十九日，针细如发、色作青碧。对敌以神识驱针，无声无息专破护体罡气，是你暗藏的保命手段。"
  },
  {
   "key": "v2-05",
   "big": "筑基",
   "kind": "际遇",
   "title": "初御飞剑",
   "text": "剑诀有成，你择一晴日将听竹剑踏于足下，缓缓升空。初时身形微晃，片刻渐稳，山风掠过衣袍。俯瞰脚下青枫谷云海，你心知御剑术成，从此万里山河皆可去得。"
  },
  {
   "key": "v2-06",
   "big": "筑基",
   "kind": "际遇",
   "title": "血禁将开",
   "text": "宗门传讯，血色禁地三百年一开，内中多外界绝迹灵药，唯筑基修士可入。同门闻讯皆动。你自知功行尚浅、丹药匮乏，仍咬牙报名，欲争筑基中期的机缘。"
  },
  {
   "key": "v2-07",
   "big": "筑基",
   "kind": "际遇",
   "title": "血色天地",
   "text": "禁地开启，你随众修踏入灰雾弥漫的血色天地，赤土寸草不生，山峦如浸血。未行半日便遭嗜血妖蝠扑袭，你御剑且战且退，暗自心惊，此地果然步步杀机。"
  },
  {
   "key": "v2-08",
   "big": "筑基",
   "kind": "际遇",
   "title": "绝壁并肩",
   "text": "深入禁地，一头三阶妖蟒将你逼至绝壁，危急间一道青白剑光横空而至，出手的是一名清冷女修。你二人合力死战，剑光针影齐出，终斩妖蟒，自此结缘。"
  },
  {
   "key": "v2-09",
   "big": "筑基",
   "kind": "际遇",
   "title": "险夺灵药",
   "text": "幽谷崖缝间长着一株极老的凝魂草，你方要采摘，守药毒蝎暴起伤人。剧毒入体，你强忍眩晕放出游丝针，破甲诛蝎后跌撞逃出幽谷，灵草终究落袋。"
  },
  {
   "key": "v2-10",
   "big": "筑基",
   "kind": "际遇",
   "title": "禁地惜别",
   "text": "禁地将闭，你与清冷女修会合，相互照应退向谷口，途中又联手料理了两头不长眼的妖兽。临别她只微微颔首，道声后会有期便没入人流。你望着那背影，暗记于心。"
  },
  {
   "key": "v2-11",
   "big": "筑基",
   "kind": "际遇",
   "title": "魔焰南侵",
   "text": "平静两年，你功行稳步踏入筑基中期。这一日，天南方向忽传急讯：北方魔道大举南侵，兵锋已直指青枫谷。山门上下剑拔弩张，你知安稳修行的日子到头了。"
  },
  {
   "key": "v2-12",
   "big": "筑基",
   "kind": "际遇",
   "title": "镇守矿脉",
   "text": "宗门聚议，筑基弟子悉数听调。你被派往西南边境一座灵石矿脉驻守，同行的多是初入筑基的同门。行前长老秘传音相嘱：魔修狡诈，遇强敌万勿恋战，保命为先。"
  },
  {
   "key": "v2-13",
   "big": "筑基",
   "kind": "际遇",
   "title": "押运血战",
   "text": "这日你奉命押运一船灵石回宗，途经黑雾峡遭魔修伏击，为首者已是筑基后期。你且战且退，放出游丝针阴掉一名敌人，负着几道剑伤，终于护住储物袋脱身。"
  },
  {
   "key": "v2-14",
   "big": "筑基",
   "kind": "际遇",
   "title": "谷破弃子",
   "text": "魔道主力倾巢围困青枫谷，精锐连夜西撤，你等守边弟子却未得只字传讯，仍死守外围。待你杀回山门，大阵已碎、火光冲天，方知自己早被当作弃子。"
  },
  {
   "key": "v2-15",
   "big": "筑基",
   "kind": "际遇",
   "title": "跃入古阵",
   "text": "身后魔修追杀愈近，你慌不择路遁入谷底残破石殿，殿心竟有一座上古传送阵。追兵将至，你无暇多想，将仅存灵石拍入阵眼，白光暴卷，天地倒转，人影杳然。"
  },
  {
   "key": "v2-16",
   "big": "筑基",
   "kind": "际遇",
   "title": "乱星孤影",
   "text": "再睁眼，眼前已是无边碧海、星罗礁屿，此地正是乱星海。你囊中羞涩，幸得商船捎带，在最大一座坊市落足。举目无亲，四下皆是陌生修士，只觉自己势单力薄。"
  },
  {
   "key": "v2-17",
   "big": "筑基",
   "kind": "际遇",
   "title": "坊市立足",
   "text": "你以仅存的灵石为引，低价收来坊市灵药，仗着青瓷小瓶每旬凝出的一滴灵液炼成培元丹，药好价公，回头客渐多，异乡孤身总算在坊市立住了脚。"
  },
  {
   "key": "v2-18",
   "big": "筑基",
   "kind": "际遇",
   "title": "海上望月",
   "text": "此后你随猎妖船队连年出海，斩妖取丹，家底渐厚，修为日深。这一夜泊船远海，你独立船头望月，海上清辉如霜，丹田盈满，结丹之念油然而生，只觉金丹在望。"
  }
 ],
 [
  {
   "key": "v3-01",
   "big": "结丹",
   "kind": "开篇",
   "title": "一朝丹成",
   "text": "你在乱星海孤岛坐死关，七十二日丹火不熄。一朝丹成如鸽卵，青光在腹中隐隐流转。自此踏入结丹期，御剑可一日千里。"
  },
  {
   "key": "v3-02",
   "big": "结丹",
   "kind": "际遇",
   "title": "丹名渐响",
   "text": "你在坊市悬炉设铺，专炼散修苦求无门的冲关灵丹。炉火纯青、成色上佳，不出半载，附近诸岛无人不晓你的名号，求丹者踏破门槛。"
  },
  {
   "key": "v3-03",
   "big": "结丹",
   "kind": "际遇",
   "title": "虚天开门",
   "text": "岛上一夜宴席，有散修醉语泄出：虚天殿三百年一开，殿中灵药秘术无数，历代入者皆有奇遇。你握杯不语，心底却隐隐起了波澜。"
  },
  {
   "key": "v3-04",
   "big": "结丹",
   "kind": "际遇",
   "title": "殿中夺宝",
   "text": "殿门洞开，你随众踏入禁制。幻阵妖潮轮番袭来，同行折损过半。你凭丹火遁速破禁入内殿，夺得古修遗下的丹鼎与残卷，满殿皆红了眼。"
  },
  {
   "key": "v3-05",
   "big": "结丹",
   "kind": "际遇",
   "title": "群狼环伺",
   "text": "出殿未及月余，你身怀至宝的消息自黑市泄开。接连三月，数路结丹修士明夺暗刺不绝。你连挫三批强手，知孤岛不可久留，连夜收了铺面远遁。"
  },
  {
   "key": "v3-06",
   "big": "结丹",
   "kind": "突破",
   "title": "猎妖冲关",
   "text": "你遁入乱星海外围无人海域，寻礁窟闭关。白日猎杀海妖、取丹自炼，夜里运功炼化。一年方过，金丹凝厚一层，终跨入结丹中期。"
  },
  {
   "key": "v3-07",
   "big": "结丹",
   "kind": "际遇",
   "title": "荒海恶斗",
   "text": "次年开春，一头结丹后期老妖循炼丹残香寻至。它掀起百丈浊浪，吐污秽妖光直取你性命。你以丹火硬撼百招，又暗布阵符，终将它重创驱走。"
  },
  {
   "key": "v3-08",
   "big": "结丹",
   "kind": "际遇",
   "title": "将计就计",
   "text": "那老妖败退后，竟又邀来同阶妖修，合力将你困于海底洞府，逼你以丹火为它们重炼本命妖器。你面上应承，暗中却在器胚里埋下自毁禁制。"
  },
  {
   "key": "v3-09",
   "big": "结丹",
   "kind": "际遇",
   "title": "反夺双翼",
   "text": "妖器炼成的当夜，两妖戒心稍懈，你猛地催动禁制，洞府轰然塌陷。趁乱丹火轰杀其一，另一头祭出风雷双翼欲逃，被你贴身缠斗夺命夺翼。"
  },
  {
   "key": "v3-10",
   "big": "结丹",
   "kind": "际遇",
   "title": "裂空扬名",
   "text": "你以秘法炼化双翼，紫青风雷缠身，振翅即掠百丈，裂空无声、来去如电。待你重现坊市，当年觊觎的几方势力尽皆敛手，一时声名大噪。"
  },
  {
   "key": "v3-11",
   "big": "结丹",
   "kind": "际遇",
   "title": "渊底异火",
   "text": "为避风头，你远遁深洋，打捞沉舟灵材时，无意瞥见海底火渊岩缝间一簇苍白异火。你以丹炉孕养收服，此后丹火大炽，炼丹炼器事半功倍。"
  },
  {
   "key": "v3-12",
   "big": "结丹",
   "kind": "突破",
   "title": "丹成后期",
   "text": "此后两年，你在外海无名岛礁结庐而居，以妖丹为引、异火为薪，日夜淬炼金丹。风雷遁法与丹道相互印证，一朝功成，稳稳修至结丹后期。"
  },
  {
   "key": "v3-13",
   "big": "结丹",
   "kind": "际遇",
   "title": "血战群敌",
   "text": "五名结丹后期散修循异火气息寻至，结阵围杀。你浴血半日，先斩阵首，又借风雷翼连诛二敌，余者胆寒遁走，可你也真元耗尽，赢得险极。"
  },
  {
   "key": "v3-14",
   "big": "结丹",
   "kind": "际遇",
   "title": "故人音讯",
   "text": "伤未养好，一位旧识行商寻到荒岛，捎来天南故人的消息：那位女修因一卷丹经被人觊觎，遭大宗锁入禁地，气息奄奄。你捏着信纸，沉默良久。"
  },
  {
   "key": "v3-15",
   "big": "结丹",
   "kind": "际遇",
   "title": "决意南归",
   "text": "乱星海虽利修行，故人的事却拖不得了。你将产业尽数托付同道，星夜立于礁顶，望定天南方向，缓缓张开风雷双翼。此去万里，凶险难料。"
  },
  {
   "key": "v3-16",
   "big": "结丹",
   "kind": "际遇",
   "title": "怒海兽潮",
   "text": "归途第七日，骤起黑风暴，海啸裹着成片结丹期妖兽卷来。你风雷翼连闪百次，寻隙斩了领潮妖王，兽群大乱，你方借裂空缝隙脱出风暴。"
  },
  {
   "key": "v3-17",
   "big": "结丹",
   "kind": "际遇",
   "title": "化名潜入",
   "text": "历尽风浪，你终于望见天南海岸线。你敛去乱星海留下的气机，改名换姓，扮作游方丹师混入沿海坊市，一面行医卖丹，一面打探禁地虚实。"
  },
  {
   "key": "v3-18",
   "big": "结丹",
   "kind": "际遇",
   "title": "回首沉心",
   "text": "夜深独坐，你回望乱星海数十年：夺宝、猎妖、夺翼、得火，桩桩凶险皆成脚下台阶。金丹凝实，心境愈发沉静。明日，该寻一处宗门安身潜修了。"
  }
 ],
 [
  {
   "key": "v4-01",
   "big": "元婴",
   "kind": "开篇",
   "title": "寄身小宗",
   "text": "你以游方丹师之名，入天南一座没落小宗做外聘供奉。白日只显炼气修为，指点杂役弟子；夜里独居后山，将当年所得结婴要诀细细揣摩。"
  },
  {
   "key": "v4-02",
   "big": "元婴",
   "kind": "际遇",
   "title": "灵泉结庐",
   "text": "巡山至断崖背阴处，你发觉地底灵脉异动，拨开浮土，竟见一眼灵泉自岩缝涌出，灵气浓稠如乳。你暗喜，布下禁制封洞，就此闭关。"
  },
  {
   "key": "v4-03",
   "big": "元婴",
   "kind": "突破",
   "title": "一朝结婴",
   "text": "三年苦修，金丹碎而元婴成。紫府中三寸小人睁目而坐，窗外骤起风雷，灵气倒卷千里。你以元婴应之，异象渐平，自此登临元婴大道。"
  },
  {
   "key": "v4-04",
   "big": "元婴",
   "kind": "际遇",
   "title": "太上长老",
   "text": "元婴修士入主小宗，掌教率诸长老奉你为太上长老。你冷眼旁观：两脉为矿脉归属斗了多年，皆想借你压过对方。你淡淡应下，权且看他们出牌。"
  },
  {
   "key": "v4-05",
   "big": "元婴",
   "kind": "际遇",
   "title": "血书故讯",
   "text": "你整理旧档，翻出一枚血渍玉简，竟是当年血色禁地故人的求救信：她被困魔修古阵，元婴难脱，弥留之际盼你念旧援手。你捏紧玉简，当即动身。"
  },
  {
   "key": "v4-06",
   "big": "元婴",
   "kind": "际遇",
   "title": "月夜踏光",
   "text": "是夜月满中天，你元婴出窍，化一道青虹飞渡千里。循玉简残息落入乱石荒原，古阵禁光幽幽流转，阵心处隐隐传来一声轻咳。"
  },
  {
   "key": "v4-07",
   "big": "元婴",
   "kind": "际遇",
   "title": "拦路一战",
   "text": "阵门外两名黑袍元婴修士掠出拦路，冷笑连连。你不答话，剑光暴起，五十合后斩一人于当场，另一人负伤遁逃。你破阵而入，将昏死的故人负出。"
  },
  {
   "key": "v4-08",
   "big": "元婴",
   "kind": "际遇",
   "title": "声名鹊起",
   "text": "她伤重垂危，你以真元护其心脉，一路昼夜赶回宗门，亲施灵药调养三月方醒。此事传出，天南散修纷纷传颂你道义无双，求见者络绎不绝。"
  },
  {
   "key": "v4-09",
   "big": "元婴",
   "kind": "际遇",
   "title": "旧敌登门",
   "text": "你这般声名，终引来当年逼你远走天南的旧敌。他携门人堵于山门，扬言雪耻。你立于峰顶应战，恶斗三昼夜，将其斩于剑下，余党一哄而散。"
  },
  {
   "key": "v4-10",
   "big": "元婴",
   "kind": "际遇",
   "title": "坠魔谷将启",
   "text": "坠魔谷裂隙将启的消息传遍天南。此谷号称第一凶地，魔气纵横，却藏上古遗宝与元婴中期秘法。各方老怪皆欲入谷一搏，你闻言，也动了心。"
  },
  {
   "key": "v4-11",
   "big": "元婴",
   "kind": "际遇",
   "title": "入谷夺宝",
   "text": "裂隙开启日，你混在诸修中遁入谷口。黑雾蚀骨、禁制如林，你绕过前人遗骸，于石台夺得半卷古经与一匣灵乳。方要收入怀中，身后剑光暴起。"
  },
  {
   "key": "v4-12",
   "big": "元婴",
   "kind": "际遇",
   "title": "魔潭余生",
   "text": "出剑者是名魔道元婴中期老者，领同伙夹攻。你力战不敌，被逼入谷底魔潭，绝境中引燃残卷炸开生路，重伤遁出数十里，伏于乱石间呕血不止。"
  },
  {
   "key": "v4-13",
   "big": "元婴",
   "kind": "际遇",
   "title": "魔渊镇魔",
   "text": "你于谷中暗处养伤，撞见魔道修士祭炼谷底被封印的万年魔物。你强压伤势，纠合落单正道元婴杀出，血战彻夜，终将魔物镇回深渊。"
  },
  {
   "key": "v4-14",
   "big": "元婴",
   "kind": "突破",
   "title": "谷中悟道",
   "text": "镇魔一战，你数度濒死，亦窥见大道另一面。战后独坐魔渊之畔，将搏杀所得反刍入道。旬日间瓶颈松动，元婴再凝一轮，踏入元婴中期。"
  },
  {
   "key": "v4-15",
   "big": "元婴",
   "kind": "际遇",
   "title": "行走诸宗",
   "text": "出谷后你不再掩藏行迹，游历天南各宗，为小宗补全残缺功法，调解门户恩怨，顺手除几窝妖修。一路道名渐响，处处有人执礼相迎。"
  },
  {
   "key": "v4-16",
   "big": "元婴",
   "kind": "突破",
   "title": "心魔之劫",
   "text": "参悟中期功诀时心魔骤起，陨落故人面孔一一浮现，声声质问缘何独活的是你。你抱元守一，七日七夜不食不眠，终斩心魔于识海，道心自此坚凝。"
  },
  {
   "key": "v4-17",
   "big": "元婴",
   "kind": "际遇",
   "title": "并肩了怨",
   "text": "当年被困的女修已养好伤势，寻来宗门与你相认，欲联手了结禁地旧怨。你欣然应允。是夜你们并肩出剑，直指仇家巢穴，恶战终宵，恩怨两清。"
  },
  {
   "key": "v4-18",
   "big": "元婴",
   "kind": "突破",
   "title": "元婴圆满",
   "text": "你立宗庇护一方，凡人修士安居，邪魔闻你名而远避。静修数十载，元婴圆满。夜望星河，遥想传说中化神大道，一念既起，再不回头。"
  }
 ],
 [
  {
   "key": "v5-01",
   "big": "化神",
   "kind": "开篇",
   "title": "重开死关",
   "text": "你在山巅旧府封死洞门，隔断人间烟火，决意冲击化神。元婴圆满已无路可进，灵气衰颓的预感却日重一日，此关不过，便是一抔黄土。"
  },
  {
   "key": "v5-02",
   "big": "化神",
   "kind": "突破",
   "title": "灵潮破障",
   "text": "闭关三载，你凝毕生精元冲那最后一层壁障。丹田灵力如海倒卷，天地元气自八方涌来，头顶气旋长鸣。某一夜，壁障终于裂开一道发丝细纹。"
  },
  {
   "key": "v5-03",
   "big": "化神",
   "kind": "突破",
   "title": "化神功成",
   "text": "轰然一声，壁障碎如琉璃，天地灵气倒灌入体。你长身而起，神念铺开千里，一念动处，风雨骤起。人界久违的化神天象，令各大宗门彻夜仰望。"
  },
  {
   "key": "v5-04",
   "big": "化神",
   "kind": "际遇",
   "title": "人界绝顶",
   "text": "此后数十年，你游历人界，诸宗老祖执礼相迎。偶一现身，万千修士屏息仰望。你独坐最高峰顶，却觉天地虽大，能并肩者已寥寥无几。"
  },
  {
   "key": "v5-05",
   "big": "化神",
   "kind": "际遇",
   "title": "灵气日薄",
   "text": "又是甲子过去，你忽觉天地间灵气淡了几分。分身遍查天下归来，灵脉枯竭，古井干涸，大宗渐为灵石起龃龉。你立于云头，为人界的衰朽心惊。"
  },
  {
   "key": "v5-06",
   "big": "化神",
   "kind": "际遇",
   "title": "遍阅古籍",
   "text": "你遍借诸宗秘藏，于残卷玉简中，只求一条通界之路。夜读万卷，所得不过数语：上古曾有修士撕开天幕而去。蛛丝马迹你一一记下，待日后查证。"
  },
  {
   "key": "v5-07",
   "big": "化神",
   "kind": "际遇",
   "title": "故友坐化",
   "text": "数十年间，故交一个个坐化，与你同行最久的那位老友，也在闭关中悄然去了。你赶到时，榻上只余一只褪色储物袋，遂于灵风中替他合上双目。"
  },
  {
   "key": "v5-08",
   "big": "化神",
   "kind": "际遇",
   "title": "墓前明心",
   "text": "安葬故友，你独坐孤峰七日。元婴尚难逃大限，化神亦多活千载，若不能破界而去，终归尘土。你抬手，接住一片飘落的枯叶，看它化作掌中齑粉。"
  },
  {
   "key": "v5-09",
   "big": "化神",
   "kind": "际遇",
   "title": "尽访禁地",
   "text": "你把那些上古禁地一一踏遍，西漠沙渊、南荒魔窟、北海绝域。处处留有撕裂天地的旧痕，却灵脉断绝、无一可用，只余残破阵纹，如巨兽骸骨。"
  },
  {
   "key": "v5-10",
   "big": "化神",
   "kind": "际遇",
   "title": "海上传闻",
   "text": "在东海渔村，你听老渔夫说起：雷暴海深处有座海眼，能撕裂虚空，海兽靠近便被绞成血雾。你心头一动，连夜翻遍海图，将那片海域圈了出来。"
  },
  {
   "key": "v5-11",
   "big": "化神",
   "kind": "际遇",
   "title": "独闯风暴眼",
   "text": "你直入雷暴海深处，万顷海水被龙卷拔起，雷电如蛇群游走。愈往深处，空间愈不稳，漆黑裂缝凭空开合。你顶着撕扯之力，贴着裂缝边缘推进。"
  },
  {
   "key": "v5-12",
   "big": "化神",
   "kind": "际遇",
   "title": "界息感应",
   "text": "风暴最深处，一道裂缝静静悬空。神念轻触，隔一层无形壁障，彼端灵气浓郁得近乎实质。你心下雪亮：人界灵气衰枯，出路或许就在裂缝之后。"
  },
  {
   "key": "v5-13",
   "big": "化神",
   "kind": "际遇",
   "title": "炼宝备物",
   "text": "回到洞府，你取出积攒数百年的天材地宝，炼成护体宝甲一件，又备齐丹药符箓与阵盘。跨界如渡天堑，你反复推演，不敢有半分疏漏。"
  },
  {
   "key": "v5-14",
   "big": "化神",
   "kind": "际遇",
   "title": "了却尘缘",
   "text": "启程前，你把护山禁制与传承口诀尽数传下，散尽积攒的丹药灵石。老友坟前，你种下一株灵松，深深一揖，转身离去，再未回头。"
  },
  {
   "key": "v5-15",
   "big": "化神",
   "kind": "际遇",
   "title": "共参飞升",
   "text": "数位隐世同阶故老寻来，与你海天论道数月。有人叹大限将至，有人决意一搏。你把推演尽数相告，与众人共参飞升之秘，临别互道珍重。"
  },
  {
   "key": "v5-16",
   "big": "化神",
   "kind": "际遇",
   "title": "静候飞升",
   "text": "这一日，你独立于裂缝前，风暴绕身，雷声震耳。你心神澄澈，静静候着那飞升之刻。良久，你望向来路，轻声自语：来日，灵界再见。"
  }
 ],
 [
  {
   "key": "v6-01",
   "big": "炼虚",
   "kind": "开篇",
   "title": "坠入灵界",
   "text": "你穿过空间裂缝，乱流如刀绞碎肉身，神识几近溃散。再睁眼时，已坠于灵界荒野。灵气浓得几乎凝成实质，法则却与人间迥异。你修为跌落，仅余炼虚入门之境，异乡为客，须从头立基。"
  },
  {
   "key": "v6-02",
   "big": "炼虚",
   "kind": "际遇",
   "title": "异土初醒",
   "text": "你盘坐古木之下，引灵界灵气入体。那气如冷水灌肺，寒意刺骨，经脉却久旱逢霖。你闭目调息，听风过蛮荒的腥涩，方知此界法则森严，非人间可比，唯有耐住性子，一寸寸重筑根基。"
  },
  {
   "key": "v6-03",
   "big": "炼虚",
   "kind": "突破",
   "title": "重立根基",
   "text": "你以异界灵气重洗经脉，将旧日法诀一一拆解，照灵界法则重演。三月苦修，灵力终与肉身相契，稳稳落于炼虚前期。你抚过尚带创痕的躯壳，知这一步，是客乡立命之始。"
  },
  {
   "key": "v6-04",
   "big": "炼虚",
   "kind": "际遇",
   "title": "故人重逢",
   "text": "这一日，你于幽潭边遇一素衣女子与灵貂。女子名元瑶，亦自人间飞升，在此飘零。她递来一枚疗伤灵果，低声说此地凶险，异族环伺。你点头，多了一位可托背的故人。"
  },
  {
   "key": "v6-05",
   "big": "炼虚",
   "kind": "际遇",
   "title": "天鹏遗脉",
   "text": "你随元瑶行至一族落，见翅影掠空，族人额生羽纹——乃飞灵族天鹏一脉。长老言真灵血脉可引动天地伟力，却也招来蛮荒异族觊觎。你默记于心，知此界修行，血脉与杀机并存。"
  },
  {
   "key": "v6-06",
   "big": "炼虚",
   "kind": "际遇",
   "title": "影族窥伺",
   "text": "夜半，你忽觉神识一凉，似有无形之物贴地潜行。那是影族，专噬修士魂识。你按剑不动，以灵力裹住周身，任其绕行三匝终不敢近。你冷眼送它退入暗处，晓得当真步步杀机。"
  },
  {
   "key": "v6-07",
   "big": "炼虚",
   "kind": "际遇",
   "title": "魔功残篇",
   "text": "你于一处古修遗府，得半卷梵圣真魔功与明王诀残篇。字痕斑驳，功理却直指肉身淬炼。你以神识细细拓印，不敢尽信，只取其中与己道相合者，潜修于无人深谷。"
  },
  {
   "key": "v6-08",
   "big": "炼虚",
   "kind": "突破",
   "title": "魔功小成",
   "text": "残篇功法在身，你于谷中日夜捶炼筋骨。某夜灵力自百骸奔涌而出，与真魔之气交融，终破瓶颈，晋入炼虚中期。你握拳，骨中雷音轻鸣，知异界之力，已能为我所用。"
  },
  {
   "key": "v6-09",
   "big": "炼虚",
   "kind": "际遇",
   "title": "广寒秘径",
   "text": "你随天鹏族入一方寸小世界，名广寒界。月中清辉如练，洗灵池水寒而润骨。你浸入池中，觉亿万年沉淀的月华缓缓渡入丹田，肉身旧伤一寸寸弥合，神识却愈发澄冷。"
  },
  {
   "key": "v6-10",
   "big": "炼虚",
   "kind": "际遇",
   "title": "遗蜕争锋",
   "text": "池中忽起波澜，数道身影同时扑向一具真灵遗蜕。你袖中灵剑出鞘，于月下与来者交锋三合，夺下一缕残存真灵之气。血溅寒池，你面不改色，只将那气息纳入眉心，缓缓炼化。"
  },
  {
   "key": "v6-11",
   "big": "炼虚",
   "kind": "际遇",
   "title": "巨猿附骨",
   "text": "真灵之气入体，你脊骨忽生伟力，恍若山岳巨猿附身，举手可移小山。你压下翻涌的蛮血，以明王诀收束神魂。镜中眸光转赤又复清明，你知这血脉，是把双刃。"
  },
  {
   "key": "v6-12",
   "big": "炼虚",
   "kind": "际遇",
   "title": "灵海复盈",
   "text": "经广寒淬炼，你灵海日渐充盈，距旧日巅峰不过咫尺。某日吐纳既毕，灵力自行周天大转，不费气力便稳落炼虚后期。你望向天外多重之天，心湖却无波。"
  },
  {
   "key": "v6-13",
   "big": "炼虚",
   "kind": "际遇",
   "title": "真灵之约",
   "text": "天鹏长老邀你立约：助其一脉寻回失落的真灵之血，他族亦助你窥更高之境。你未应允，只道容后再议。风过羽垣，你眸中映着远天异色，知这异界羁绊，才刚起头。"
  },
  {
   "key": "v6-14",
   "big": "炼虚",
   "kind": "突破",
   "title": "炼虚圆满",
   "text": "你立身灵界已非客卿，修为重返旧日巅峰，隐隐触到一道更高门槛。夜望多重天外的浩瀚法则，你收剑入鞘，晓得下一段路不在人前，而在自身未竟之处。风起，你转身没入长夜。"
  }
 ],
 [
  {
   "key": "v7-01",
   "big": "合体",
   "kind": "开篇",
   "title": "元神合一",
   "text": "你封洞出关，元神与肉身骤然合一，梵圣金光自百骸透出，法相初成。自此跻身灵界高层，却也踏入飞灵内斗与异族厮杀的漩涡。"
  },
  {
   "key": "v7-02",
   "big": "合体",
   "kind": "际遇",
   "title": "飞灵内斗",
   "text": "你隐姓行走飞灵境地，见族内嫡庶相残，天鹏一脉式微。你藏锋不露，暗中记下各派虚实，只待血脉觉醒那日再算旧账。"
  },
  {
   "key": "v7-03",
   "big": "合体",
   "kind": "际遇",
   "title": "初会老祖",
   "text": "你赴北冥会见敖啸、莫简离二位老祖，论道于万年玄冰之上。二老看透你深浅，以平等之礼相待，灵界高层自此有你一席。"
  },
  {
   "key": "v7-04",
   "big": "合体",
   "kind": "突破",
   "title": "二段金身",
   "text": "你闭关三载，梵圣法相再凝一段金身，骨如精金，气血如汞。破关而出时山风凝滞，合体中期之威已非昔日可比拟。"
  },
  {
   "key": "v7-05",
   "big": "合体",
   "kind": "际遇",
   "title": "广寒奇遇",
   "text": "你入广寒秘境，于月华深处得古仙遗蜕与真灵残魂。炼化之际神识暴涨，梵圣法相隐隐生变，一身修为自此脱胎换骨。"
  },
  {
   "key": "v7-06",
   "big": "合体",
   "kind": "际遇",
   "title": "天鹏血脉",
   "text": "你运功至此，背脊生风，血脉深处一头天鹏虚影振翅欲出。你化鹏冲霄，双翅割裂云海，飞灵旧耻于这一刻悄然翻篇。"
  },
  {
   "key": "v7-07",
   "big": "合体",
   "kind": "际遇",
   "title": "异族暗流",
   "text": "你巡守边域，见魔气自虚空裂隙渗出，元魇之影在界壁外游弋。圣祖之谋渐显，灵界看似太平，实则杀机已伏于九地之下。"
  },
  {
   "key": "v7-08",
   "big": "合体",
   "kind": "突破",
   "title": "法相三段",
   "text": "你于秘境深处再炼第三段金身，梵圣法相通体璀璨，举手可移山岳。合体后期既成，你已能嗅到那一道更遥远处传来的道韵。"
  },
  {
   "key": "v7-09",
   "big": "合体",
   "kind": "际遇",
   "title": "法相天地",
   "text": "你催动法相，身躯拔地千丈，顶天立地如山岳临世。一族守敌望之胆裂，你方知合体法相之威，已可独镇一方天地。"
  },
  {
   "key": "v7-10",
   "big": "合体",
   "kind": "际遇",
   "title": "真灵之约",
   "text": "你应天鹏真灵之召，立下血誓共御外侮。真灵残魂入体，与你血脉相融，自此灵界各族纷争中，你多了一份不可推卸的担当。"
  },
  {
   "key": "v7-11",
   "big": "合体",
   "kind": "际遇",
   "title": "大战将起",
   "text": "魔界圣祖之谋渐露锋芒，各族使者夜奔于你洞府之前。你抚剑不语，知一场牵动灵界气运的大战，已在弦上，不可不发。"
  },
  {
   "key": "v7-12",
   "big": "合体",
   "kind": "突破",
   "title": "法相大成",
   "text": "你历生死搏杀，终将梵圣法相淬至圆满，金身无瑕，神念可笼罩半域。合体圆满既成，你立于灵界之巅，遥望那一道无形的天堑。"
  },
  {
   "key": "v7-13",
   "big": "合体",
   "kind": "际遇",
   "title": "名动灵界",
   "text": "合体圆满之名传遍三境，各族老祖遣使结好，邪魔避你锋芒。你静坐高台，听风过万山，知自己已是谁也绕不开的那枚棋子。"
  },
  {
   "key": "v7-14",
   "big": "合体",
   "kind": "际遇",
   "title": "再启新途",
   "text": "你收法相归元，望向灵界极远处那片未涉足的迷雾。此身已至合体尽头，前路那道更高远的门槛，正等着你以血与火去叩开。"
  }
 ],
 [
  {
   "key": "v8-01",
   "big": "大乘",
   "kind": "开篇",
   "title": "灵界之巅",
   "text": "你立灵界之巅，法相余威未散，名已动八荒。闭目推演时空法则，星河流转间忽见魔界血光冲天——大劫将至，风雨满楼。"
  },
  {
   "key": "v8-02",
   "big": "大乘",
   "kind": "际遇",
   "title": "玄天斩灵",
   "text": "你祭出玄天斩灵剑，剑光如冻结的岁月劈开虚空。时间法则在掌心流转，你第一次触到那逆转乾坤的门槛，寒意自脊骨漫上。"
  },
  {
   "key": "v8-03",
   "big": "大乘",
   "kind": "突破",
   "title": "初入大乘",
   "text": "灵潮灌体，你正式踏入大乘前期。周身法则凝实一分，抬手可令光阴停滞。你知此境漫长，却已无退路，只将心神沉入推演。"
  },
  {
   "key": "v8-04",
   "big": "大乘",
   "kind": "际遇",
   "title": "收服神子",
   "text": "十二神子跪伏阶下，眸中战意未熄。你以时空禁制锁其神魂，收为己用。风过枯岭，你望这群桀骜之辈，只觉守望之责更重。"
  },
  {
   "key": "v8-05",
   "big": "大乘",
   "kind": "际遇",
   "title": "宝花周旋",
   "text": "宝花圣祖含笑而来，言语如丝缠人。你面不改色，以时间秘术试探其虚实。魔界暗流涌动，你与她虚与委蛇，静待变局。"
  },
  {
   "key": "v8-06",
   "big": "大乘",
   "kind": "际遇",
   "title": "元魇暗斗",
   "text": "元魇之影潜入灵界，噬魂无声。你布下时空囚笼，与其神念交锋于无声处。一局暗棋落定，你唇角微涩——魔劫比预想更深。"
  },
  {
   "key": "v8-07",
   "big": "大乘",
   "kind": "突破",
   "title": "大乘中期",
   "text": "你坐忘千日，修为再进，晋大乘中期。法则交织成网，可囚一界光阴。你睁眼时，山外魔气已浓，灵界根基却因你而稳了一分。"
  },
  {
   "key": "v8-08",
   "big": "大乘",
   "kind": "际遇",
   "title": "魔劫护界",
   "text": "魔潮席卷边荒，修士哀嚎。你一剑斩落血云，护住一方生灵。焦土之上你立而不语，袖中法则微鸣——这灵界，你既在，便不容倾覆。"
  },
  {
   "key": "v8-09",
   "big": "大乘",
   "kind": "际遇",
   "title": "逆转乾坤",
   "text": "你闭关自创时间秘术，逆转乾坤之奥初成。指尖轻拨，落花重归枝头。你凝视这违逆天道的手段，心知它终有一日要用在命数之上。"
  },
  {
   "key": "v8-10",
   "big": "大乘",
   "kind": "突破",
   "title": "大乘后期",
   "text": "秘术小成，你破入大乘后期。周身时空自成一国，万法难侵。你立于风雪之巅，远眺魔界裂隙，飞升之念却悄然在胸中生了根。"
  },
  {
   "key": "v8-11",
   "big": "大乘",
   "kind": "际遇",
   "title": "守望灵界",
   "text": "你暗中铺排飞升之机，却仍留形于灵界。夜巡诸域，见凡人安睡、修士苦修，你收拢掌心法则——有些守望，不必言明。"
  },
  {
   "key": "v8-12",
   "big": "大乘",
   "kind": "突破",
   "title": "大乘圆满",
   "text": "你修至大乘圆满，灵界再无可阻你之敌。法则圆融如镜，照见自身命数将变。你抚剑而立，知那悬于头顶的天劫，已近在咫尺。"
  },
  {
   "key": "v8-13",
   "big": "大乘",
   "kind": "际遇",
   "title": "飞升之念",
   "text": "圆满既至，天威隐隐压顶。你回望这座守望千载的灵界，将牵挂一一放下。心念一动，已是决意离去——只待那最后一跃，便赴未知之境。"
  }
 ],
 [
  {
   "key": "v9-01",
   "big": "渡劫",
   "kind": "开篇",
   "title": "雷劫叩仙",
   "text": "你引动飞升天劫，九天雷云压顶，雷火如瀑倾泻而下。你盘坐虚空不动，道心如铁，任雷光灼体、神魂剧颤，于生死之间叩问仙门。"
  },
  {
   "key": "v9-02",
   "big": "渡劫",
   "kind": "际遇",
   "title": "雷海淬体",
   "text": "雷劫层层叠加，你周身焦黑复又重生。你闭目引雷入体，将狂暴之力一寸寸炼入筋骨，于痛楚中体悟长生真意。"
  },
  {
   "key": "v9-03",
   "big": "渡劫",
   "kind": "际遇",
   "title": "故交遥寄",
   "text": "雷隙暂歇，你神念遥触灵界故交。你默然拱手，未发一言。千载同道，至此各归天地。你收拢心绪，复迎那森寒劫云。"
  },
  {
   "key": "v9-04",
   "big": "渡劫",
   "kind": "突破",
   "title": "初渡雷关",
   "text": "第一重雷劫将尽，你体内法力翻涌如潮。你运转秘法压下残雷，修为悄然叩向渡劫前期。你知真正凶险，方才初露端倪。"
  },
  {
   "key": "v9-05",
   "big": "渡劫",
   "kind": "际遇",
   "title": "紫电缠身",
   "text": "劫云再涌，紫电如蛇缠身。你以肉身硬撼雷霆，骨骼寸断又续。你在电光中静观己身，渐悟劫火非敌，乃登仙之阶。"
  },
  {
   "key": "v9-06",
   "big": "渡劫",
   "kind": "际遇",
   "title": "伤痕化纹",
   "text": "你于雷歇之际吐纳天地灵机，周身伤痕化作道纹。你抚过焦痕，想起昔日草木之身，如今已将这煌煌天威，视作寻常风雨。"
  },
  {
   "key": "v9-07",
   "big": "渡劫",
   "kind": "突破",
   "title": "中期破障",
   "text": "第二重雷劫渐弱，你丹田法力凝若实质。你引残雷淬炼元婴，修为破入渡劫中期。劫云之上，似有更古冷的眼眸，悄然垂落。"
  },
  {
   "key": "v9-08",
   "big": "渡劫",
   "kind": "际遇",
   "title": "心魔试炼",
   "text": "心魔乘劫隙骤起，幻出故人旧事、前尘爱憎。你神色淡然，一一看过后未予作答。万千执念碎于雷光，你道心愈发澄澈孤绝。"
  },
  {
   "key": "v9-09",
   "big": "渡劫",
   "kind": "突破",
   "title": "后期凝元",
   "text": "第三重雷劫加身，你血肉几近化灰。你拼死护住一点灵明，法力于毁灭中重聚，修为破入渡劫后期。仙门已遥遥在望。"
  },
  {
   "key": "v9-10",
   "big": "渡劫",
   "kind": "际遇",
   "title": "斩断因果",
   "text": "你将这方天地凡尘因果，尽数斩断。血脉、执念、旧名，皆付与雷火。你最后一次回望灵界山河，眸中无悲无喜，只余空明。"
  },
  {
   "key": "v9-11",
   "big": "渡劫",
   "kind": "突破",
   "title": "圆满将临",
   "text": "最后一重雷劫散尽，你法力圆融如璞。你立于劫后虚空，周身道韵自生，修为臻至渡劫圆满。只待一念，便可破界而去。"
  },
  {
   "key": "v9-12",
   "big": "渡劫",
   "kind": "突破",
   "title": "破界飞升",
   "text": "你斩却凡尘，纵身破开界壁。雷火为衣，孤身赴那未知仙途。界外风声呼啸，你回首低语：来日，仙界再见。"
  }
 ],
 [
  {
   "key": "v10-01",
   "big": "真仙",
   "kind": "开篇",
   "title": "北寒坠仙",
   "text": "你自灵界破界飞升，坠入北寒仙域。仙灵力如寒刃刺骨，法则与灵界迥异。你寄身北寒仙宫为执事差役，更名换姓，于最底层重立仙道根基，暗夜独念那未绝的旧缘。"
  },
  {
   "key": "v10-02",
   "big": "真仙",
   "kind": "际遇",
   "title": "仙宫执役",
   "text": "你扫地、守阁、炼粗劣仙器，仙宫执事视你如草芥。仙灵稀薄，运转滞涩，你每夜暗中吐纳，将凡躯一寸寸浸养入仙道，记挂轮回殿里纠缠未了的旧誓。"
  },
  {
   "key": "v10-03",
   "big": "真仙",
   "kind": "际遇",
   "title": "暗访轮回",
   "text": "你借差遣之便暗查轮回殿旧档，残简中浮出熟悉魂息。你心头一震——那转世之约未断，南宫婉一缕残魂仍游走仙域轮回，你攥紧指节，不敢声张。"
  },
  {
   "key": "v10-04",
   "big": "真仙",
   "kind": "际遇",
   "title": "寄身寒宫",
   "text": "仙界法则森严，你一介飞升散修无靠无山，稍有不慎便万劫不复。你低头敛锋，于北寒风雪里将真仙道基夯实，咽下所有孤寒，只等时机。"
  },
  {
   "key": "v10-05",
   "big": "真仙",
   "kind": "突破",
   "title": "初证真仙",
   "text": "这一夜仙灵倒灌，你闭关三月，识海翻涌如沸。你以仙宫所得残材重铸道基，气机破开凡仙之壁，终踏真仙前期。睁眼时，窗外北寒风雪似静了一瞬。"
  },
  {
   "key": "v10-06",
   "big": "真仙",
   "kind": "际遇",
   "title": "寒宫炼器",
   "text": "你受命为仙宫炼一柄仙剑，炉火映出旁人杀机。仙域暗流翻涌，你借炼器之便暗中结网，将一缕仙灵力炼入己身，于夹缝里寻得一丝向上之机。"
  },
  {
   "key": "v10-07",
   "big": "真仙",
   "kind": "际遇",
   "title": "旧影重逢",
   "text": "轮回殿夜宴，你奉酒侍立，帘后一抹侧影令你血气翻腾。那魂息与南宫婉依稀重合，你垂首掩惊色，指间酒盏微颤，险些露出破绽。"
  },
  {
   "key": "v10-08",
   "big": "真仙",
   "kind": "际遇",
   "title": "仙廷暗制",
   "text": "天庭巡察过境，仙宫人人自危。你被牵连问话，冷静应对，反借机窥得天庭一枚印记之法。退回陋室，你将所得化入道基，真仙之路愈发沉实。"
  },
  {
   "key": "v10-09",
   "big": "真仙",
   "kind": "突破",
   "title": "再破中境",
   "text": "你借仙宫秘藏静修十载，仙灵如潮灌体。某一刻筋骨齐鸣，前期壁垒轰然碎裂，你晋入真仙中期。收功而立，北寒仙宫的压迫，已难再拘你分毫。"
  },
  {
   "key": "v10-10",
   "big": "真仙",
   "kind": "际遇",
   "title": "寒域追影",
   "text": "你请差出北域，踏雪千里，循一缕残魂气息至荒古祭坛。坛上轮回纹流转，你以仙血引之，似见旧侣转世轮廓一闪，又散入风雪，抓之不得。"
  },
  {
   "key": "v10-11",
   "big": "真仙",
   "kind": "际遇",
   "title": "血染仙锋",
   "text": "仙域两脉火并，你被迫卷入，以中期修为护住一脉遗孤。剑光过处首次见仙人之血洒落如雨，你面无表情收剑，亦在乱中夺得一截可炼真仙之材。"
  },
  {
   "key": "v10-12",
   "big": "真仙",
   "kind": "际遇",
   "title": "遥望仙阶",
   "text": "你于仙宫藏书深处翻得一卷残碑，其上道痕指向一道更高仙阶。你心头剧震，知真仙不过中途，所立根基终要再破一重——按碑而坐，久不能言。"
  },
  {
   "key": "v10-13",
   "big": "真仙",
   "kind": "突破",
   "title": "道基圆满",
   "text": "你闭死关廿载，仙灵尽归一身。壁垒再碎，你晋真仙后期，道基圆满无漏。立于北寒之巅，望向仙域深处那道朦胧门槛——此身已非池中物，只待一脚踏出。"
  }
 ],
 [
  {
   "key": "v11-01",
   "big": "天仙",
   "kind": "开篇",
   "title": "跨入天仙",
   "text": "你于诸界交汇处引动真仙道果，光阴与轮回之理自掌心流淌。仙界高层之位既得，俯瞰万界因果如观掌纹，你却知此境非终，前路更阔。"
  },
  {
   "key": "v11-02",
   "big": "天仙",
   "kind": "际遇",
   "title": "光阴长河",
   "text": "你立于光阴长河之畔，见往昔一缕执念顺流而下。昔日人界旧事、灵界厮杀历历在目，你屈指一弹，岁月回流寸许，却终未改那命数分毫。"
  },
  {
   "key": "v11-03",
   "big": "天仙",
   "kind": "突破",
   "title": "初掌轮回",
   "text": "你闭关三万载，将轮回法理炼入仙魂。天仙前期功成那刻，幽冥深处万千亡魂齐喑，你睁眼，已能一眼望尽一界生灵的起落枯荣。"
  },
  {
   "key": "v11-04",
   "big": "天仙",
   "kind": "际遇",
   "title": "诸界巡览",
   "text": "你踏碎虚空巡览诸界，见仙域之外更有混沌未明之地。一处遗迹中，马良之流残留的凶煞之气犹在，你以时光法理将其寸寸磨灭，神色无波。"
  },
  {
   "key": "v11-05",
   "big": "天仙",
   "kind": "际遇",
   "title": "因果了断",
   "text": "你于星空深处了结一段旧因果——昔日魔界宿敌早已轮回转世。你未取他性命，只将一段记忆封入光阴，转身没入星河，背影如孤峰映雪。"
  },
  {
   "key": "v11-06",
   "big": "天仙",
   "kind": "突破",
   "title": "中期证道",
   "text": "你引动诸天法则共鸣，天仙中期水到渠成。周身道韵自成一方小天地，举手间令星河倒悬，你却敛去锋芒，只留一缕清气萦绕指尖不散。"
  },
  {
   "key": "v11-07",
   "big": "天仙",
   "kind": "际遇",
   "title": "仙域惊变",
   "text": "仙域边陲忽现裂隙，异域凶煞倾泻而出。你一步踏破万万里，掌中轮回轮转，将来犯之敌尽数纳入往生。仙界众仙遥望，只当你是一道掠影。"
  },
  {
   "key": "v11-08",
   "big": "天仙",
   "kind": "际遇",
   "title": "故人入梦",
   "text": "你于清修中偶有所感，旧友早已化作尘壤。你以光阴回溯短短一瞬，见当年并肩之景，旋即阖目，那一点温意沉入道心最深处。"
  },
  {
   "key": "v11-09",
   "big": "天仙",
   "kind": "突破",
   "title": "后期凝真",
   "text": "你将光阴、轮回二理交融归一，天仙后期壁垒应声而碎。眸开时，诸界兴衰尽收眼底，你已能改一界气运于无声，却始终未动那丝毫天机。"
  },
  {
   "key": "v11-10",
   "big": "天仙",
   "kind": "际遇",
   "title": "道途高寒",
   "text": "你独坐九霄绝顶，看仙界众生如蝼蚁营营。高处风冷，身边再无知交同列。你抚过掌中那道自人界带来的旧痕，忽觉道途愈上，寂寞愈深。"
  },
  {
   "key": "v11-11",
   "big": "天仙",
   "kind": "突破",
   "title": "天仙圆满",
   "text": "你融万法于一炉，天仙圆满之境功成。诸天法理为你低语，一念可生灭大界。你立于道之巅回望，人界、灵界、仙界一路风烟，皆成脚下一粒微尘。"
  },
  {
   "key": "v11-12",
   "big": "天仙",
   "kind": "际遇",
   "title": "道无涯际",
   "text": "天仙之上，更有缥缈道途隐现于混沌。你望向那无涯之境，未觉圆满，只觉初醒。你负手踏入未知的光阴尽头，山外有山，道外尚有道。"
  }
 ]
];

/* 叙事索引: 每条卷剧情分得全局数字编号 sid(按代码顺序稳定)。
 * 修行录存档只存 sid 数字引用(瘦存档), 渲染/回看时从静态表还原剧情 */
const STORY_BY_SID = {};
const STORY_BY_KEY = {};
(function () {
  let sid = 0;
  for (const vol of PLOT) for (const b of vol) {
    b.sid = ++sid;
    STORY_BY_SID[sid] = b;
    STORY_BY_KEY[b.key] = b;
  }
})();
function storyResolve(j) {          // journal 条目 → 剧情内容(数字引用还原 / 旧档直读)
  if (j && j.sid && STORY_BY_SID[j.sid]) return STORY_BY_SID[j.sid];
  return j;
}
function journalHasKey(b) {         // 兼容新旧两种记录格式
  return state.journal.some(j => (j.sid && j.sid === b.sid) || (j.key && j.key === b.key));
}
function addJournal(entry) {
  const b = entry.key && STORY_BY_KEY[entry.key];
  if (b) {                          // 预置剧情: 只存数字引用, 不存文本
    state.journal.push({ sid: b.sid, big: b.big || entry.big, kind: b.kind || entry.kind, ts: Date.now() });
  } else {                          // 动态事件(离线游历/纪事等): 仍存文本
    entry.ts = Date.now();
    state.journal.push(entry);
  }
  if (state.journal.length > 80) state.journal.shift();
  save();
}
/* 剧情推进器: 触发当前大境卷内所有"已达小层且未经历"的节点 */
function realmPlot() {
  const bi = bigIdx();
  const vol = PLOT[bi];
  if (!vol || !vol.length) return;
  const start = BIGS.slice(0, bi).reduce((s, x) => s + x.segs, 0);   // 该大境起始全局小段 idx
  const segCount = BIGS[bi].segs;
  const r = realm();
  const pos = Math.min(segCount, (state.realmIdx - start) + Math.min(1, state.exp / r.need));
  let fired = 0, last = null;
  for (let i = 0; i < vol.length; i++) {
    const b = vol[i];
    if (journalHasKey(b)) continue;
    if (pos >= segCount * i / vol.length) {
      addJournal({ key: b.key, big: b.big || realm().big, kind: b.kind || "际遇", title: b.title, text: b.text });
      fired++;
      if (fired === 1) {
        last = b;
        pushMsg("main", `<span class="b">${b.big || realm().big} · ${b.title}</span>｜${b.text}`);
      }
    }
  }
  if (fired > 1) pushMsg("main", `<span class="b">仙途拾遗</span>｜修行之间你又经历了 ${fired} 段际遇，均已记入修行录。`);
  if (fired > 0) cloudFlush();   // v1.5.1: 主线剧情入修行录 → 关键节点立即上云
  void last;
}

/* ---- 纪事里程碑: 灵石/聚灵阵/法宝的玩法节点 → 一次性叙事(不占境界剧情位) ---- */
const MS_SPIRIT = [
  [500, "灵石初丰", "你攒下第一笔像样的灵石——修行问道，总算不必为几枚碎灵石头疼。"],
  [2000, "小有身家", "灵石渐丰，你在坊市说话都硬气了几分。"],
  [10000, "万灵石", "万灵石入袋，你已称得上「有身家」的修士。"],
  [50000, "灵脉傍身", "五万灵石——当年在山村，这是你想都不敢想的数目。"],
  [200000, "视灵石如无物", "灵石渐成数字，你修的是长生，不是阿堵物。"],
];
const MS_ARRAY = [
  [3, "聚灵初成", "聚灵阵三转，灵气吞吐已胜过常人苦修。"],
  [6, "阵基叠塔", "六层阵基如叠塔，洞府灵气凝出肉眼可见的薄雾。"],
  [10, "小周天成", "阵成小周天，夜深时阵中灵光自鸣，如钟磬相和。"],
  [15, "自成洞天", "大阵自成一方小洞天，你端坐其中，修为如水入海。"],
  [20, "地脉来朝", "阵道登堂入室，方圆十里灵脉都隐隐向你汇聚。"],
  [25, "地肺吐纳", "此阵已可自行吐纳地肺之火，灵气取之不竭。"],
  [30, "阵道圆满", "阵成圆满，灵光冲霄——这已是聚灵阵道的极限。"],
];
const MS_ART = [
  ["法器之始", "你得了第一件趁手法器，神识附着其上，如臂使指。"],
  ["灵器入手", "灵器入体，宝光隐现——往后斗法，总算有了依仗。"],
  ["古宝临身", "古宝到手，道纹流转，你隐约摸到一丝岁月的痕迹。"],
  ["灵宝认主", "灵宝认主，灵性自鸣，连洞府外的灵兽都朝此低伏。"],
  ["玄天之宝", "玄天之宝现世，真元都为之战栗——此物一出，足以动一方风云。"],
];
function fireMilestone(flagKey, title, text) {
  const M = state.milestones || (state.milestones = {});
  if (M[flagKey]) return false;
  M[flagKey] = 1;
  addJournal({ key: "ms-" + flagKey, big: realm().big, kind: "纪事", title, text });
  pushMsg("main", `<span class="b">纪事</span>·${title}｜${text}`);
  return true;
}
function checkMilestones() {
  if (state.spirit > state.peakSpirit) state.peakSpirit = state.spirit;
  const q = state.arts.reduce((m, a) => Math.max(m, a.q), -1);
  if (q > state.bestArtQ) state.bestArtQ = q;
  let fired = false;
  for (const [th, t, x] of MS_SPIRIT) if (state.peakSpirit >= th && fireMilestone("s" + th, t, x)) fired = true;
  for (const [L, t, x] of MS_ARRAY) if (state.arrayLv >= L && fireMilestone("r" + L, t, x)) fired = true;
  for (let g = 1; g <= 5; g++) { const [t, x] = MS_ART[g - 1]; if (state.bestArtQ >= g && fireMilestone("a" + g, t, x)) fired = true; }
  if (fired) save();
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
/* 修行录渲染: 分章(chips) + 章内滚动分批, 避免一次注入大量 DOM 卡顿 */
const STORY_PAGE = 12;
let _storyChap = "";
function storyItemHtml(j) {
  const pad = n => String(n).padStart(2, "0");
  const rec = storyResolve(j);                       // sid → 静态剧情; 老档/动态事件直接读自身
  const tm = new Date(j.ts);
  const big = j.big || rec.big || "";
  const kind = j.kind || rec.kind || "际遇";
  return `<div class="j-card k-${kind}">` +
    `<div class="j-head"><span class="j-big">${big}</span>` +
    `<span class="j-kind k-${kind}">${kind}</span>` +
    `<span class="j-time">${pad(tm.getMonth() + 1)}-${pad(tm.getDate())} ${pad(tm.getHours())}:${pad(tm.getMinutes())}</span></div>` +
    `<h5>${rec.title || j.title || "仙途拾遗"}</h5><p>${rec.text || j.text || ""}</p></div>`;
}
function storyLoadMore(reset) {
  const body = $("storyBody");
  if (!body) return;
  const big = body.dataset.big || _storyChap;
  if (!big) return;
  const list = state.journal.filter(j => j.big === big).reverse(); // 最新在前
  let page = parseInt(body.dataset.page || "0", 10);
  if (reset) { page = 0; body.innerHTML = ""; }
  const slice = list.slice(page * STORY_PAGE, (page + 1) * STORY_PAGE);
  if (reset || slice.length) { page++; body.dataset.page = String(page); }
  if (slice.length) body.insertAdjacentHTML("beforeend", slice.map(storyItemHtml).join(""));
  if (reset) body.scrollTop = 0;
  if (reset && !slice.length) {
    body.innerHTML = `<div class="empty-hint">${big}期的际遇尚未写就。<br>先修行，路会自己走出来。</div>`;
  }
}
function showChapter(bigName) {
  const chips = $("storyChips");
  const body = $("storyBody");
  if (!body) return;
  _storyChap = bigName;
  body.dataset.big = bigName;
  body.onscroll = () => {
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 60) storyLoadMore(false);
  };
  if (chips) chips.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.textContent === bigName));
  storyLoadMore(true);
}
function renderStory() {
  const body = $("storyBody");
  const chips = $("storyChips");
  if (!body || !chips) return;
  const bi = Math.min(bigIdx(), PLOT.length - 1);
  const walked = PLOT.slice(0, bi + 1).map(x => x[0].big).join(" → ");
  let sum = $("storySum");
  if (!sum) {
    sum = document.createElement("div");
    sum.className = "story-sum"; sum.id = "storySum";
    chips.parentNode.insertBefore(sum, chips);
  }
  sum.innerHTML = `已历仙途：<b>${walked}</b>` +
    (state.realmIdx >= TOTAL_SEGS - 1 ? "（仙途漫漫 · 已臻极巅）" : "");
  // 只显示有记载的大境章
  const order = PLOT.slice(0, bi + 1).map(v => v[0].big);
  const chapters = order.filter(b => state.journal.some(j => j.big === b));
  chips.innerHTML = "";
  if (!chapters.length) {
    body.innerHTML = `<div class="empty-hint">尚无记载。<br>仙途伊始，一切从你打坐感应灵气开始。</div>`;
    return;
  }
  chapters.forEach(name => {
    const c = document.createElement("div");
    c.className = "chip";
    c.textContent = name;
    c.onclick = () => showChapter(name);
    chips.appendChild(c);
  });
  // 默认打开当前大境章, 否则最后一章
  const last = state.journal[state.journal.length - 1];
  showChapter(chapters.includes(realm().big) ? realm().big : (last && last.big) || chapters[0]);
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
  const petTag = `<span class="pet">阿青</span>`;
  const artChance = 0.05 + bi * 0.005;
  if (roll < artChance) {
    const a = makeArt();
    const r = QUALITY[a.q];
    pushMsg("avatar", `${petTag}${pickNoRepeat(PET_FORGE, "petF")}，一件<span class="r">${a.name}</span>(<span class="${r.cls}">${r.name}</span>)出炉`);
    smartEquip(a);
  } else if (roll < 0.30) {
    const g = Math.round(8 + Math.random() * 30 + bigIdx() * 10);
    state.spirit += g;
    pushMsg("avatar", `${petTag}${pickNoRepeat(PET_COIN, "petC")}　灵石+${fmt(g)}`);
  } else if (roll < 0.62) {
    const g = Math.round(14 + Math.random() * 50 + bigIdx() * 16);
    state.spirit += g;
    pushMsg("avatar", `${petTag}${pickNoRepeat(PET_BONUS, "petB")}　气机渐盛`);
  } else if (roll < 0.84) {
    const bonus = rateNow() * (4 + Math.random() * 8);
    state.exp += bonus;
    pushMsg("avatar", `${petTag}${pickNoRepeat(PET_BONUS, "petB")}　修为+${fmt(bonus)}`);
  } else {
    state.exp += rateNow() * 1.5;
    pushMsg("avatar", `${petTag}${pickNoRepeat(PET_STILL, "petS")}`);
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
  while (state.arts.length > 4) {
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
/* ============ v1.3.0 离线巡猎(本地兜底, 与后端 huntSettle 同式) ============
 * 云端不可用时照样有巡猎收益: dt ÷ ENC_PERIOD 波, 八成斗法/两成秘境,
 * 每战修为 = 挂机速率 × FIGHT_EXP_W × 0.6(挂机离线折扣), 灵石 = 灵石速率 × FIGHT_SP_W × 0.7;
 * 每战必掉一件 → 阿青静默择优: 能顶替就换上(旧件熔灵石), 不入眼当场熔炼。 */
function keepArtQuiet(a) {          // 静默版 smartEquip: 批量结算不发消息、不存档
  if (!state.arts || !Array.isArray(state.arts)) state.arts = [];
  const arts = state.arts;
  const idx = (typeof a.slot === "number" && a.slot < 4) ? a.slot : arts.length;
  if (idx >= arts.length) { arts.push(a); return true; }
  const w = arts[idx];
  if (!w) { arts[idx] = a; return true; }
  if (a.q > w.q || (a.q === w.q && a.mult > w.mult)) {
    state.spirit += Math.round(50 * Math.pow(1.6, w.q));    // 旧件熔回
    arts[idx] = a; return true;
  }
  state.spirit += Math.round(40 * Math.pow(1.5, a.q));      // 新件不入眼, 当场熔作灵石
  return false;
}
function huntOffline(dtSec) {
  const H = { waves: 0, fights: 0, wins: 0, loses: 0, mysts: 0, exp: 0, spirit: 0, kept: 0, keptName: "", melted: 0, meltSp: 0 };
  const waves = Math.floor((dtSec || 0) / ENC_PERIOD);
  if (waves <= 0) return H;
  H.waves = waves;
  const rate = rateNow(), spr = spiritRate();
  for (let i = 0; i < waves; i++) {
    if (Math.random() < HUNT_FIGHT_RATE) {
      H.fights++;
      const lv = (state.realmIdx || 0) + 1, eb = equipBonus();
      const php = 100 + 620 * lv + eb.hp, patk = 10 + 58 * lv + eb.atk, pdef = 5 + 42 * lv + eb.def;
      const mhp = 300 * lv, matk = 100 * lv, mdef = 8 * lv;              // 同尺中值怪
      const win = Math.ceil(mhp / Math.max(1, patk - mdef)) <= Math.ceil(php / Math.max(1, matk - pdef)) && Math.random() > 0.04;
      if (!win) { H.loses++; continue; }
      H.wins++;
      const ge = Math.round(rate * FIGHT_EXP_W * 0.6), gs = Math.round(spr * FIGHT_SP_W * 0.7);
      state.exp += ge; state.spirit += gs; H.exp += ge; H.spirit += gs;
      const a = makeArt();
      if (keepArtQuiet(a)) { H.kept++; if (!H.keptName) H.keptName = a.name; }
      else { H.melted++; H.meltSp += Math.round(40 * Math.pow(1.5, a.q)); }
    } else {
      H.mysts++;
      const k = Math.random();
      if (k < 0.45) { const gs = Math.round(spr * MYST_W * 1.2 * 0.7); state.spirit += gs; H.spirit += gs; }
      else if (k < 0.8) { const ge = Math.round(rate * MYST_W * 0.6); state.exp += ge; H.exp += ge; }
    }
  }
  H.equipped = (state.arts || []).length;
  return H;
}
function huntTxtOf(H) {                 // 离线巡猎纪要(云端 gains.hunt / 本地兜底 共用)
  if (!H || !H.waves) return "";
  const kN = H.keptCount != null ? H.keptCount : (Array.isArray(H.kept) ? H.kept.length : (H.kept || 0));
  const kName = H.keptName || (Array.isArray(H.kept) && H.kept.length ? H.kept[0].name : "");
  return `<br><br><span style="color:#f0c98a">主身巡猎 ${H.waves} 波</span>：斗法 ${H.fights} 场（胜 ${H.wins} · 负 ${H.loses}）、秘境 ${H.mysts} 处<br>` +
    `斩获修为 +<span class="num"> ${fmt(H.exp || 0)}</span>、灵石 +<span class="num"> ${fmt(H.spirit || 0)}</span>` +
    (kN ? `<br>阿青收下 <b>${kN}</b> 件新宝${kName ? `（${kName} 等）` : ""}，藏宝阁在架 ${H.equipped || kN} 件` : "") +
    (H.melted ? `；余下 <b>${H.melted}</b> 件不入眼，尽数投炉熔作灵石 +<span class="num"> ${fmt(H.meltSp || 0)}</span>` : "");
}
function applyOffline() {
  const now = Date.now();
  /* 结算基准 = 载入时的原始 lastTs(_lastTs0) 与上次结算推进点取大 → 多设备/换档不重不漏
     (不能用 state.lastTs —— 它已被启动瞬间的 save() 刷成现在, 见 load 处注释) */
  const base = Math.max(state._lastTs0 || state.lastTs || 0, state._settledTs || 0);
  let dt = (now - base) / 1000;
  if (dt < 30) return;
  dt = Math.min(dt, OFFLINE_CAP);
  // 洗髓丹: 12时辰内离线收益+30%
  const offBoost = Date.now() < (state.offlineBoostUntil || 0) ? 1.3 : 1;
  const gainExp = rateNow() * dt * 0.6 * offBoost;
  const gainSpirit = spiritRate() * dt * 0.7;
  // 修复: 离线收益真正入账(此前版本只显示未累加)
  state.exp += gainExp;
  state.spirit += gainSpirit;
  // 离线自动精进(与在线 loop / 后端 settle 一致): 推过已修满的小境界段,
  // 大境界圆满前停——大境界渡劫留待亲手, 剧情绝不越卷
  {
    let jg = 0;
    while (jg++ < 60) {
      const r0 = realm();
      if (r0.isBigEnd) break;
      if (state.realmIdx >= TOTAL_SEGS - 1) break;
      if (state.exp >= r0.need) { state.exp -= r0.need; state.realmIdx++; }
      else break;
    }
  }
  /* v1.3.0 离线巡猎: 与在线同一波次模型(dt ÷ 180s 一波)，本地兜底(云端结算走后端 huntSettle) */
  const HUNT = huntOffline(dt);
  if (HUNT.waves) { updateArts(false); }
  state._settledTs = now;   // 结算推进点(防跨会话重复领取)
  /* —— 化身归来结算：外出的化身带回材料与见闻 —— */
  let retTxt = "";
  if (state.travel) {
    const loc = locById(state.travel.loc);
    if (loc) {
      const z = zoneOfLoc(loc.id);
      const dur = Math.min(dt, (Date.now() - state.travel.since) / 1000);
      const early = dur < (z ? z.dur[0] : 120);
      const ret = { mats: {}, lines: [] };
      const pool = z ? z.mats : [];
      if (early) {
        // 时辰尚短：不空手，但只捋回零星一点
        for (const dp of pool) {
          if (Math.random() < dp.c * 0.3) { ret.mats[dp.id] = 1; break; }
        }
      } else {
        for (const dp of pool) {
          if (Math.random() < dp.c) {
            const q = dp.a + Math.floor(Math.random() * (dp.b - dp.a + 1));
            if (q > 0) ret.mats[dp.id] = (ret.mats[dp.id] || 0) + q;
          }
        }
      }
      ret.lines.push(loc.tale[Math.floor(Math.random() * loc.tale.length)]);
      if (dur > 7200 && loc.tale.length > 1) ret.lines.push(loc.tale[Math.floor(Math.random() * loc.tale.length)]);
      for (const k in ret.mats) state.mats[k] = (state.mats[k] || 0) + ret.mats[k];
      if (z && Math.random() < PAGE_RATE) {
        if (!state.pages || typeof state.pages !== "object") state.pages = {};
        state.pages["b" + z.big] = (state.pages["b" + z.big] || 0) + 1;
        ret.page = true;
      }
      const matTxt = Object.keys(ret.mats).map(k => `${MATS[k].n}×${ret.mats[k]}`).join("、");
      retTxt = (early ? (matTxt
                      ? `化身往${loc.n}走了一遭，时辰尚短便折返，只捋回 <b>${matTxt}</b>。阿青在门口迎它，嗅了嗅，又趴回去打盹。`
                      : `化身往${loc.n}走了一遭，时辰尚短便折返，此行只带回一囊清风。阿青在门口等它，嗅了嗅空气，又趴回去打盹。`)
                      : `化身自<span class="num">${loc.n}</span>归来，带回 <b>${matTxt || "一囊清风"}</b>。阿青绕着你转了三圈，又嗅了嗅化身衣摆，才心满意足地回去守门。`);
      if (ret.page) retTxt += " ｜ 行囊里多出一页<b>丹方残页</b>";
      retTxt += " 见闻：" + ret.lines.join("｜");
      if (ret.lines.length) {
        addJournal({ key: "tr-" + Date.now(), big: realm().big, kind: "游历",
          title: "云游·" + loc.n, text: ret.lines.join(" ") });
      }
      pushMsg("avatar", `阿青迎到山门口｜化身自${loc.n}归来`);
      state.travel = null;
    } else state.travel = null;
  }
  travelBtnLbl(); traceRefresh();            // 本地兜底化身归来 → 云游按钮与行迹立刻复位
  // 离线面板正文(主身闭关 + 灵石 + 化身归来) —— 修复: 历史版本此段在重构中丢失
  const hh = Math.floor(dt / 3600), mm = Math.floor((dt % 3600) / 60);
  $("offlineText").innerHTML =
    `你于洞天闭关打坐 <b>${hh ? hh + " 小时 " : ""}${mm ? mm + " 分钟" : "片刻"}</b>。<br>` +
    `主身周天自行运转，修为 +<span class="num"> ${fmt(gainExp)}</span><br>聚灵阵凝出灵石 +<span class="num"> ${fmt(gainSpirit)}</span>` +
    huntTxtOf(HUNT) +
    (retTxt ? `<br><br>${retTxt}` : "");
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
/* ===== 光环预览(调试工具): 只改 #cult data-big 让 fx2d 换境界, 不动修为 ===== */
function toggleAuraTest() {
  const box = document.getElementById("auraTest");
  if (!box) return;
  const show = !box.style.display || box.style.display === "none";
  box.style.display = show ? "flex" : "none";
  if (show) buildAuraChips();
}
function buildAuraChips() {
  const row = document.getElementById("auraTestChips");
  if (!row || row.children.length) return;
  BIGS.forEach(big => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "aura-chip";
    chip.textContent = big.n;
    chip.onclick = () => previewRealmVisual(big.n);
    row.appendChild(chip);
  });
  syncAuraChips();
}
function previewRealmVisual(big) {
  const cult = document.getElementById("cult");
  if (cult) cult.setAttribute("data-big", big);
  __auraBig = big;
  syncAuraChips();
}
function resetAuraPreview() {
  __auraBig = null;
  const cult = document.getElementById("cult");
  if (cult) cult.setAttribute("data-big", realm().big);
  syncAuraChips();
}
function syncAuraChips() {
  const row = document.getElementById("auraTestChips");
  if (!row) return;
  const cur = __auraBig || realm().big;
  [...row.querySelectorAll(".aura-chip")].forEach(c => c.classList.toggle("on", c.textContent === cur));
}

/* 灵力辉光层: 动态载入 fx2d.js, 挂一层 canvas 到角色容器(与立绘同频呼吸) */
function initFxLayer() {
  const cult = document.getElementById("cult");
  if (!cult || document.getElementById("cultFx")) return;
  const cv = document.createElement("canvas");
  cv.id = "cultFx";
  cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;"
    + "pointer-events:none;z-index:3;animation:breath 4.6s ease-in-out infinite";
  cult.appendChild(cv);
  import("./fx2d.js?v=50539d63")
    .then(m => { try { m.initFx(cv); } catch (e) { console.error("[fx2d] init:", e); } })
    .catch(e => console.error("[fx2d] load:", e));
}
/* 特效诊断浮层: 引擎错误/降级模式直接显示, 便于排查 */
function initFxDiag() {
  try {
    let pill = document.getElementById("fxDiag");
    if (!pill) {
      pill = document.createElement("div");
      pill.id = "fxDiag";
      pill.style.cssText = "position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99;"
        + "max-width:86vw;background:rgba(120,20,20,.92);color:#ffd7d7;font-size:11px;"
        + "padding:6px 12px;border-radius:999px;display:none;pointer-events:none";
      document.body.appendChild(pill);
    }
    const show = msg => {
      pill.textContent = msg; pill.style.display = "block";
      clearTimeout(pill._t); pill._t = setTimeout(() => { pill.style.display = "none"; }, 6000);
    };
    window.addEventListener("error", e => show("运行错误: " + (e.message || e.type)));
    setInterval(() => {
      if (window.__fxMode === "2d") { show("特效模式: 2D 兜底 (WebGL不可用)"); window.__fxMode = null; }
      if (window.__fxErr) { show("特效错误: " + window.__fxErr); window.__fxErr = null; }
    }, 3500);
  } catch (e) { console.warn(e); }
}

async function initBg() {
  try { await initBg3D(); }
  catch (e) { console.warn("WebGL 不可用，降级星空", e); document.body.classList.add("no-webgl"); }
}
async function initBg3D() {
  const canvas = $("bg");
  const mod = await import("./bg.js?v=926b5d17");
  window.__bgCtrl = await mod.initDeepSpace(canvas);
}
/* v1.6.0-B 灵气道场叠加层: 随大境界变色调的流动云雾 + 上升灵气粒子(叠在深空背景之上, 不动 bg.js) */
const AURA_COLORS = [
  [103,201,171], [103,201,171], [91,143,214], [233,196,126],
  [180,138,214], [207,232,224], [207,232,224]
];
let _auraCv, _auraCtx, _auraP = [], _auraT = 0, _auraColor = AURA_COLORS[0].slice();
function auraColorNow() { return AURA_COLORS[Math.min(bigIdx(), AURA_COLORS.length - 1)]; }
function initAura() {
  _auraCv = $("aura"); if (!_auraCv) return;
  _auraCtx = _auraCv.getContext("2d");
  const fit = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    _auraCv.width = innerWidth * dpr; _auraCv.height = innerHeight * dpr;
    _auraCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit(); addEventListener("resize", fit);
  for (let i = 0; i < 36; i++)
    _auraP.push({ x: Math.random()*innerWidth, y: Math.random()*innerHeight, r: 1+Math.random()*2.4, s: 8+Math.random()*22, a: .25+Math.random()*.5, ph: Math.random()*7 });
}
function tickAura(dt) {
  if (!_auraCtx) return;
  _auraT += dt;
  const W = innerWidth, H = innerHeight, c = auraColorNow();
  for (let i = 0; i < 3; i++) _auraColor[i] += (c[i] - _auraColor[i]) * Math.min(1, dt * 1.5);
  const [r,g,b] = _auraColor.map(v => Math.round(v));
  _auraCtx.clearRect(0, 0, W, H);
  _auraCtx.globalCompositeOperation = "lighter";
  const blobs = [[.25,.3,.5],[.7,.25,.42],[.5,.7,.55],[.82,.72,.4]];
  for (let i = 0; i < blobs.length; i++) {
    const [bx,by,bz] = blobs[i];
    const cx = (bx + Math.sin(_auraT*0.06 + i)*0.05)*W, cy = (by + Math.cos(_auraT*0.05 + i*1.3)*0.05)*H, rad = bz*Math.min(W,H)*0.6;
    const grd = _auraCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grd.addColorStop(0, `rgba(${r},${g},${b},.07)`); grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    _auraCtx.fillStyle = grd; _auraCtx.beginPath(); _auraCtx.arc(cx, cy, rad, 0, 7); _auraCtx.fill();
  }
  for (const p of _auraP) {
    p.y -= p.s*dt; p.x += Math.sin(_auraT*0.6 + p.ph)*6*dt;
    if (p.y < -10) { p.y = H + 10; p.x = Math.random()*W; }
    const a = p.a * (0.5 + 0.5*Math.sin(_auraT*1.2 + p.ph));
    _auraCtx.fillStyle = `rgba(${r},${g},${b},${a*0.5})`;
    _auraCtx.beginPath(); _auraCtx.arc(p.x, p.y, p.r, 0, 7); _auraCtx.fill();
  }
  _auraCtx.globalCompositeOperation = "source-over";
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
  tickDsp(dt);
  tickAura(dt);
  updateHUD();
  checkMilestones();
  if (Math.random() < dt * 0.35) adventure();
  if (Math.random() < dt * 0.06) mainMoment();
  tickBurst(dt);
}

/* ============ 启动 ============ */
load();                       // 先本地存档
updateRealmUI();
_dsp.spirit = state.spirit; _dsp.exp = state.exp;
_floatPrev.spirit = state.spirit; _floatPrev.exp = state.exp;
updateHUD();
updateArts();
realmPlot(); // 启动即按当前境界推进已及剧情
{
  const o0 = PLOT[0] && PLOT[0][0];
  if (o0 && state.journal.length && !journalHasKey(o0) && bigIdx() > 0) {
    addJournal({ key: o0.key, big: o0.big, kind: o0.kind, title: o0.title, text: o0.text }); // 老档补记起点
  }
}
setInterval(save, 8000);
addEventListener("pagehide", () => { save(); cloudFlush(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { save(); cloudFlush(); }  // 切后台/关页即同步"最后活跃"(关页时刻必须立刻推, 不能等节流窗口)
});
cloudInit();       // 云存档: 先拉云端 → 统一结算离线收益 → 回写(本地永远可玩, 云失败静默)
setInterval(stayMailCheck, 60000);   // 在线寄包: iOS 常驻标签页也能收到化身手札
initAura();
initBg();
initFxDiag();
initFxLayer();
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


/* ==================== P0 分身云游 ==================== */
function matCount(id) { return (state.mats || {})[id] || 0; }
function pillCount(id) { return (state.pills || {})[id] || 0; }
function zoneOfBig(bi) { const z = ZONES[bi]; return z ? z : ZONES[ZONES.length - 1]; }
function zoneOfLoc(id) { for (const z of ZONES) if (z.locs.some(l => l.id === id)) return z; return null; }
function locById(id) { for (const z of ZONES) { const l = z.locs.find(x => x.id === id); if (l) return l; } return null; }
function pickLoc() { const z = zoneOfBig(bigIdx()); return { z, l: z.locs[(Math.random() * z.locs.length) | 0] }; }
function durTxt(sec) {
  if (sec >= 86400) { const d = Math.round(sec / 86400 * 10) / 10; return (d % 1 === 0 ? d : d.toFixed(1)) + " 天"; }
  if (sec >= 3600) return Math.round(sec / 3600) + " 时辰";
  return Math.max(1, Math.round(sec / 60)) + " 分钟";
}
function travelBtnLbl() {
  const b = $("btnTravel"); if (!b) return;
  const lb = b.querySelector(".label"); if (!lb) return;
  if (state.travel) {
    const l = locById(state.travel.loc);
    lb.innerHTML = "云游中";
    b.classList.add("traveling");
    b.title = l ? "化身正于 " + l.n : "化身在外游历";
  } else { lb.innerHTML = "云游"; b.classList.remove("traveling"); b.title = ""; }
}
function openTravel() {
  const m = $("travelModal"); if (!m) return;
  const box = $("travelBody"); if (!box) return;
  // 行囊材料盘点（全部已知材料，0 则为暗色）
  const matChips = Object.keys(MATS).map(k => {
    const has = (state.mats || {})[k] || 0;
    return `<span style="color:${has > 0 ? "#c9b98a" : "#4b5468"}">${MATS[k].n}${has > 0 ? "×" + has : ""}</span>`;
  }).join("　");
  const bagHtml = `<div style="font-size:11px;color:#9aa5ba;margin:10px 0 2px">行囊</div>
    <div style="font-size:11.5px;line-height:2">${matChips || ""}</div>`;
  // 丹药匣
  const pk = Object.keys(state.pills || {});
  const pillRow = (pk.length ? pk.map(id => {
    const rp = RECIPES[id];
    return `<span style="display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(201,168,106,.3);border-radius:4px;padding:3px 8px;margin:2px;font-size:11px;color:#e8d6a4" title="${rp.d}">${rp.n}×${state.pills[id]}<button class="cp-btn" style="color:#a88" onclick="consumePill('${id}')">服</button></span>`;
  }).join("") : `<span style="color:#6d7688;font-size:11px">尚无丹药</span>`);
  if (state.travel) {
    const l = locById(state.travel.loc);
    const z = zoneOfLoc(state.travel.loc);
    const sinceMin = Math.floor((Date.now() - state.travel.since) / 60000);
    box.innerHTML = `<div style="font-size:11px;color:#9aa5ba;margin-bottom:6px">丹药匣</div>
      <div style="margin-bottom:10px">${pillRow}</div>
      ${bagHtml}
      <div style="text-align:center;padding:14px 4px">
        <div style="font-family:var(--font-brush);font-size:18px;color:#d8b06a;letter-spacing:.12em">化身在${l ? l.n : "远方"} · ${Math.max(0, sinceMin)}分钟</div>
        <p style="color:#a7b0c4;margin-top:10px;line-height:1.9">山高路远，人在外头是唤不回的。<br>${z ? "这一带传闻归期" + durTxt(z.dur[1]) + "上下。" : ""}<br>化身在外会不时<b style="color:#c9b98a">寄回手札</b>，捎来途中所得；真见了大世面才肯回来。<br>阿青守着洞天，等你哪一日归来。</p></div>`;
  } else {
    const z = zoneOfBig(bigIdx());
    const placeNames = z.locs.map(x => x.n).join("、");
    box.innerHTML = `<div style="padding:10px 4px 14px;text-align:center;border-bottom:1px dashed rgba(201,168,106,.16)">
        <div style="font-family:var(--font-brush);font-size:16px;color:#d8b06a;letter-spacing:.06em">${z.name}</div>
        <p style="color:#8b94a8;font-size:11.5px;margin-top:6px;line-height:1.9">化身会顺着自己的心意，在 ${placeNames} 一带游历。<br>归期大约 ${durTxt(z.dur[0])} 到 ${durTxt(z.dur[1])}，无需盘缠。</p>
        <button class="btn" style="margin-top:10px" onclick="startTravel()"><svg class="skin" viewBox="0 0 200 60" preserveAspectRatio="none"><path class="ink" d="M12 9 C28 3 44 10 60 6 C76 2 92 8 108 6 C124 4 140 8 158 6 C174 4 192 8 197 16 C199 26 198 34 195 41 C193 46 196 52 182 53 C168 55 154 50 140 53 C124 56 110 50 96 53 C82 56 68 51 56 53 C42 55 30 50 20 52 C8 54 2 46 3 38 C3 28 2 20 5 15 C7 12 9 10 12 9 Z"/></svg><span class="label">遣化身出门</span></button>
      </div>
      ${bagHtml}
      <div style="font-size:11px;color:#9aa5ba;margin:12px 0 6px">丹药匣</div>
      <div style="margin-bottom:10px">${pillRow}</div>
      ${craftAreaHTML()}`;
  }
  m.classList.add("show");
  travelBtnLbl();
}
function closeTravel() { const m = $("travelModal"); if (m) m.classList.remove("show"); }
function startTravel() {
  if (state.travel) { pushMsg("main", "化身尚在云游，归期未至"); closeTravel(); return; }
  const { l } = pickLoc();
  state.travel = { loc: l.id, since: Date.now() };
  _encNext = autoHuntOn() ? Date.now() + searchMs() : 0;   // 重置巡猎: 自动斗法开则重新起算搜寻
  pushMsg("main", `你为化身备好行囊。它往<span class="r">${l.n}</span>的方向去了，阿青蹲在门口目送，尾巴搭在你脚边。`);
  pushMsg("avatar", `阿青送化身到山门口，回来在你蒲团边卧下`);
  travelBtnLbl(); traceRefresh(); updateHUD(); save(); cloudFlush();   // v1.5.0: 立刻刷行迹, 别再挂着"遣它下山?"  v1.5.1: 云游派发是关键节点 → 立即上云
  closeTravel();
}
function consumePill(id) {
  const rp = RECIPES[id]; if (!rp) return;
  if (!state.pills || !state.pills[id]) return;
  const now = Date.now(); const e = rp.eff;
  state.pills[id]--;
  if (state.pills[id] <= 0) delete state.pills[id];
  if (e.k === "buff") { state.buffs.push({ mult: e.mult, until: now + e.dur * 1000 }); pushMsg("main", `药力化开，周天运转如飞`); }
  else if (e.k === "inst") { const gg = rateNow() * e.sec; state.exp += gg; pushMsg("main", `药力化开，修为<span class="g">+${fmt(gg)}</span>`); }
  else if (e.k === "grand") { const gg = rateNow() * e.sec; state.exp += gg; state.buffs.push({ mult: e.mult, until: now + e.dur * 1000 }); pushMsg("main", `感悟天劫真意，修为<span class="g">+${fmt(gg)}</span>，道韵萦绕`); }
  else if (e.k === "offline") { state.offlineBoostUntil = Math.max(state.offlineBoostUntil || 0, now + e.dur * 1000); pushMsg("main", "洗髓伐脉，此后离线游历更有所得"); }
  updateHUD(); save(); cloudSoon(); openTravel(); renderPillHints();
}
function renderPillHints() {
  const now = Date.now();
  const n = (state.buffs || []).length;
  const o = (state.offlineBoostUntil || 0) > now;
  const el = $("pillHints");
  if (el) el.innerHTML = (n ? `<span style="color:#f0c98a">丹力正盛 ×${buffMult().toFixed(1)}</span>` : "") +
    (o ? (n ? " · " : "") + `<span style="color:#8fd8bd">洗髓·离线+30%</span>` : "");
}

/* P0 启动引导 */
travelBtnLbl();
renderPillHints();
mailDot();


/* ==================== P1 炼丹炉（v2 丹方体系） ==================== */
/* ==================== v0.8.0 丹方残页 ==================== */
const PAGE_RATE = 0.15;      // 每趟云游带回残页概率(前后端一致)
const PAGES_NEED = [2, 3, 3, 3, 3, 3];   // 各境需集齐页数解锁隐藏丹
function pagesOf(bi) { return (state.pages && state.pages["b" + bi]) || 0; }
function hiddenUnlocked(bi) { return pagesOf(bi) >= PAGES_NEED[bi]; }
const DAN_ZONE = ["凡尘", "炼气", "筑基", "结丹", "元婴", "化神"];
function craftAreaHTML() {
  const bi = bigIdx();
  const groups = {};
  for (const id of Object.keys(RECIPES)) {
    const big = RECIPES[id].big;
    (groups[big] = groups[big] || []).push(id);
  }
  let html = `<div style="font-size:11px;color:#8a7a55;margin:12px 0 2px;letter-spacing:.1em">【 开炉炼丹 】</div>`;
  for (let big = 0; big <= bi; big++) {
    const list = groups[big];
    if (!list || !list.length) continue;
    html += `<div style="font-size:10.5px;color:#a98a5a;margin:8px 0 3px">· ${DAN_ZONE[big] || big} · 丹道</div>`;
    for (const id of list) {
      const rp = RECIPES[id];
      if (rp.h) {
        if (hiddenUnlocked(big)) html += recipeCardHTML(id);
        else {
          const got = pagesOf(big);
          html += `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;margin:5px 0;background:rgba(120,120,160,.06);border-left:2px dashed rgba(150,140,200,.35)">
            <div style="flex:1;min-width:0">
              <div style="font-size:12.5px;color:#8d84b8">???.${DAN_ZONE[big]}古方残卷<span style="font-size:10px;color:#6d6677">　残页 ${got}/${PAGES_NEED[big]}</span></div>
              <div style="font-size:10px;color:#6d7688;margin-top:2px">云游${DAN_ZONE[big]}一带有机会拾得残页，凑齐自见丹方真容。</div>
            </div>
          </div>`;
        }
        continue;
      }
      html += recipeCardHTML(id);
    }
  }
  if (bi < 5) html += `<div style="font-size:10.5px;color:#545d6f;margin-top:9px;font-style:italic">更高一境的丹方，待你亲临其境，自有丹师相授。</div>`;
  return html;
}
function recipeCardHTML(id) {
  const rp = RECIPES[id];
  const needTxt = Object.keys(rp.need).map(mid => {
    const have = (state.mats || {})[mid] || 0, nd = rp.need[mid];
    const ok = have >= nd;
    return `<span style="color:${ok ? "#9fd0a8" : "#cf8a7a"}">${MATS[mid].n} ${have}/${nd}</span>`;
  }).join("　");
  const can = Object.keys(rp.need).every(mid => ((state.mats || {})[mid] || 0) >= rp.need[mid]);
  return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;margin:5px 0;background:rgba(255,255,255,.035);border-left:2px solid ${can ? "rgba(159,208,168,.7)" : "rgba(130,130,160,.3)"}">
    <div style="flex:1;min-width:0">
      <div style="font-size:12.5px;color:${can ? "#e8d6a4" : "#9099ae"}">${rp.n}<span style="font-size:10px;color:#6d7688">　需 ${needTxt}</span></div>
      <div style="font-size:10px;color:#8b94a8;margin-top:2px;line-height:1.5">${rp.d}</div>
    </div>
    <button class="cp-btn" style="flex:none;font-size:12px;padding:4px 12px;color:${can ? "#a9d8ae" : "#5d6677"}" ${can ? `onclick="craftPill('${id}')"` : "disabled"}>开炉</button>
  </div>`;
}
function craftPill(id) {
  const rp = RECIPES[id]; if (!rp) return;
  if (rp.h && !hiddenUnlocked(rp.big)) { pushMsg("main", "丹方残页未集齐，此丹方还锁在雾里"); return; }
  for (const mid in rp.need) {
    if (((state.mats || {})[mid] || 0) < rp.need[mid]) {
      pushMsg("main", "材料不齐，丹炉难以为继"); return;
    }
  }
  for (const mid in rp.need) state.mats[mid] -= rp.need[mid];
  state.pills[id] = (state.pills[id] || 0) + 1;
  pushMsg("main", `丹炉开火，一炉<span class="r">${rp.n}</span>成了，药香满室。`);
  pushMsg("avatar", `阿青闻到药香，在丹炉边蹲成一团，尾巴尖轻轻晃`);
  save(); cloudSoon(); updateHUD(); openTravel();
}


/* ==================== v0.7.0 后端权威结算(Cloud Settle) ==================== */
/* 云端档案净化: 动态叙事(云游/离线见闻等随机正文)不上云,
 * 只保留可还原的 剧情 sid 引用 与 纪事; 本地存档保持完整不受影响 */
function cloudSnap(src) {
  const s = src || state;
  const out = Object.assign({}, s);
  out.journal = (s.journal || []).filter(j => !(j && !j.sid && j.kind === "游历"));
  return out;
}
/* ==================== v0.8.1 在线寄包: 化身不归, 周期寄回手札 ==================== */
let _stayLast = 0;
function adoptKeep(st) {          // 采用结算后的存档, 但本地叙事(非云端净化)不回退
  const keep = (state.journal || []).slice();
  const c = adopt(st);
  if (!c) return false;
  c.journal = keep.length >= (c.journal || []).length ? keep : c.journal;
  state = c;
  try { localStorage.setItem(SAVE_KEY, zPack(state)); } catch (e) {}
  travelBtnLbl();            // 云端结算可能清 travel(化身归来) → 按钮文字同步
  mailDot();
  return true;
}
function mailLine(locId, ts) {
  const loc = locById(locId);
  if (!loc || !loc.tale || !loc.tale.length) return "";
  const t = loc.tale.length;
  return loc.tale[(((ts || 0) / 60000 | 0) % t + t) % t];
}
function mailDot() {
  const n = (state.mails || []).length;
  const d = $("mailDot"); if (d) d.style.display = n ? "block" : "none";
  const b = $("mailChip"); if (b) b.classList.toggle("has-mail", !!n);
}
function showTravelMail(mail) {
  const loc = locById(mail.loc);
  const where = loc ? loc.n : "远方";
  pushMsg("avatar", `鸿雁衔书而至｜化身自${where}寄回一封手札`);
  pushMsg("main", `<span class="b">雁书已入信匣</span>：化身在${where}写了封信，内附几样远行收获。<br>点右上角鸿雁展开，收取后方才归你。`);
  if ($("mailModal") && $("mailModal").classList.contains("show")) renderMailBox();
  mailDot();
}
async function stayMailCheck() {
  if (!window.fetch || !cld.id || !cld.ready) return;
  if (!state.travel || !state.travel.loc) return;          // 化身不在外无需寄包
  const now0 = Date.now();
  if (now0 - _stayLast < 240000) return;                   // 4 分钟节流
  _stayLast = now0;
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(CLD_API + "?id=" + encodeURIComponent(cld.id) + "&stay=1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ __z: zPack(cloudSnap(state)) }),
      signal: ctl.signal,
    });
    clearTimeout(tm);
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.ok && j.data) {
      const c0 = zUnpack(j.data);
      if (c0 && adoptKeep(c0)) { updateHUD(); mailDot(); }
      if (j.stay && j.stay.id && ((j.stay.mats && j.stay.mats.length) || j.stay.page)) {
        showTravelMail(j.stay);
        updateRealmUI();
      }
    }
  } catch (e) { clearTimeout(tm); }
}
/* ==================== v0.8.0 丹方残页(Cloud Settle) 辅助 ==================== */
async function cloudSettle() {
  if (!window.fetch || !cld.id) return null;
  cldUI("sync");
  // 上传“原样快照”，绝不刷新 state.lastTs —— 后端才能看到真实离线区间
  let snap = null;
  try { snap = cloudSnap(JSON.parse(JSON.stringify(state))); } catch (e) { return null; }
  /* 上传快照必须以「载入时原始 lastTs」为基准(state.lastTs 已被启动的 save() 刷成现在),
     后端 settle 取 max(lastTs, _settledAt) 才能算出完整离线区间 */
  snap.lastTs = Math.max(state._lastTs0 || 0, state._settledTs || 0) || snap.lastTs || 0;
  snap._settledAt = state._settledTs || 0;
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(CLD_API + "?id=" + encodeURIComponent(cld.id) + "&settle=1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ __z: zPack(snap) }),
      signal: ctl.signal,
    });
    clearTimeout(tm);
    if (!r.ok) throw new Error("http" + r.status);
    const j = await r.json();
    if (j && j.ok && j.data) {
      const j0 = zUnpack(j.data);
      if (!adoptKeep(j0)) return null;
      state._lastTs0 = Date.now(); state._settledTs = Date.now();   // 云端已结算 → 基准推进, 防重复领取
      mailDot();
      state._cloudTs = j.ts || Date.now();
      cld.ready = true; cld.lastOkTs = Date.now(); cld.lastOkLocal = state.lastTs;
      cld.lastPushTs = Date.now();
      cldUI("on");
      return j;               // { settled, gains, data }
    }
    return null;
  } catch (e) {
    clearTimeout(tm);
    cldFail(e);
    return null;
  }
}
function presentSettle(r) {
  const gg = (r && r.gains) || {};
  if (!gg || !gg.settled) return;
  const dt = gg.dt || 0;
  const hh = Math.floor(dt / 3600), mm = Math.floor((dt % 3600) / 60);
  let retTxt = "";
  // 化身归来叙事(数值已由后端入账; 文案与见闻在本地补全)
  if (gg.travel) {
    const tv = gg.travel;
    const loc = locById(tv.loc);
    const matTxt = (tv.mats || []).map(x => `${MATS[x.id].n}×${x.q}`).join("、")
      + (tv.pages ? " ｜ <b>丹方残页×1</b>" : "");
    const taleLines = [];
    if (loc) {
      taleLines.push(loc.tale[Math.floor(Math.random() * loc.tale.length)]);
      if (dt > 7200 && loc.tale.length > 1) {
        taleLines.push(loc.tale[Math.floor(Math.random() * loc.tale.length)]);
      }
      retTxt = tv.early
        ? (matTxt ? `化身往${loc.n}走了一遭，时辰尚短便折返，只捎回 <b>${matTxt}</b>。阿青在门口迎它，嗅了嗅，又趴回去打盹。`
                  : `化身往${loc.n}走了一遭，时辰尚短便折返，此行只带回一囊清风。阿青在门口等它，嗅了嗅空气，又趴回去打盹。`)
        : `化身自<span class="num">${loc.n}</span>归来，带回 <b>${matTxt || "一囊清风"}</b>。阿青绕着你转了三圈，又嗅了嗅化身衣摆，才心满意足地回去守门。`;
      retTxt += " 见闻：" + taleLines.join("｜");
      if (taleLines.length) {
        addJournal({ key: "tr-" + Date.now(), big: realm().big, kind: "游历",
          title: "云游·" + loc.n, text: taleLines.join(" ") });
      }
    } else {
      retTxt = matTxt ? `化身归来，带回 <b>${matTxt}</b>。` : "";
    }
    pushMsg("avatar", `阿青迎到山门口｜化身自${loc ? loc.n : "远方"}归来`);
  }
  const jumpTxt = (gg.jumps && gg.jumps > 0)
    ? `<br><span style="color:#8fd8bd">修为精进，连破 ${gg.jumps} 个小境界</span>` : "";
  $("offlineText").innerHTML =
    `你于洞天闭关打坐 <b>${hh ? hh + " 小时 " : ""}${mm ? mm + " 分钟" : "片刻"}</b>。<br>` +
    `主身周天自行运转，修为 +<span class="num"> ${fmt(gg.exp)}</span><br>聚灵阵凝出灵石 +<span class="num"> ${fmt(gg.spirit)}</span>${jumpTxt}` +
    huntTxtOf(gg.hunt) +
    (retTxt ? `<br><br>${retTxt}` : "");
  // 离线际遇叙事(每满 1 时辰一段, 至多 3 段; 纯叙事)
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


/* ============ v0.8.1 鸿雁信匣: 收信 → 展信 → 点收取入账 ============ */
const MAIL_BTN_PATH = "M12 8 C28 2 44 10 62 6 C78 3 94 9 112 6 C128 3 146 8 162 5 C178 2 192 8 197 15 C200 24 197 33 194 40 C192 46 196 52 182 53 C168 55 152 49 138 53 C122 57 108 50 92 54 C76 58 60 52 46 55 C32 58 20 52 10 54 C2 54 2 46 3 38 C4 28 2 20 6 14 C8 11 10 9 12 8 Z";
function openMail() {
  const m = $("mailModal"); if (!m) return;
  renderMailBox();
  m.classList.add("show");
}
function closeMail() { const m = $("mailModal"); if (m) m.classList.remove("show"); }
function mailGoodsTxt(mail) {
  const g = [];
  for (const mk of (mail.mats || [])) if (MATS[mk.id]) g.push(`${MATS[mk.id].n}×${mk.q}`);
  if (mail.page) g.push("丹方残页×1");
  return g;
}
function renderMailBox() {
  const box = $("mailBody"); if (!box) return;
  const ml = (state.mails || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (!ml.length) {
    box.innerHTML = `<div class="mail-empty">信匣空空。<br>遣化身出门远行，它自会托雁足捎信回来——<br>到时候，记得拆开看看。</div>`;
    return;
  }
  box.innerHTML = ml.map(m => {
    const loc = locById(m.loc);
    const where = loc ? loc.n : "远方";
    const mins = Math.max(1, Math.round((Date.now() - (m.ts || Date.now())) / 60000));
    const ag = mins >= 60 ? (mins / 60 >= 24 ? Math.round(mins / 1440) + " 天前" : Math.round(mins / 60) + " 小时前") : mins + " 分钟前";
    const g = mailGoodsTxt(m);
    return `<div class="mail-item">
      <div class="mail-head">
        <span class="m-from">${where} · 化身亲笔</span>
        <span class="m-age">${ag}</span>
      </div>
      <p class="mail-txt">“${mailLine(m.loc, m.ts)}”</p>
      <div class="mail-foot">
        <span class="m-goods">${g.length ? "内附 " + g.join("、") : "一封平安信，无甚物什"}</span>
        <button class="btn primary seal" onclick="collectMail('${m.id}')"><svg class="skin" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path class="ink" d="${MAIL_BTN_PATH}"/></svg><span class="label">收 取</span></button>
      </div>
    </div>`;
  }).join("");
}
function collectMail(id) {
  const ml = state.mails || [];
  const i = ml.findIndex(x => String(x.id) === String(id));
  if (i < 0) return;
  const m = ml[i];
  const got = [];
  for (const mk of (m.mats || [])) {
    if (!MATS[mk.id]) continue;
    state.mats[mk.id] = (state.mats[mk.id] || 0) + mk.q;
    got.push(MATS[mk.id].n + "×" + mk.q);
  }
  if (m.page) {
    const z = zoneOfLoc(m.loc);
    if (z) { state.pages["b" + z.big] = (state.pages["b" + z.big] || 0) + 1; got.push("丹方残页×1"); }
  }
  ml.splice(i, 1);
  const loc = locById(m.loc);
  const where = loc ? loc.n : "远方";
  const gotTxt = got.length ? '收下 <span class="r">' + got.join("、") + "</span>" : "只余一纸见闻";
  pushMsg("main", "你拆开" + where + "的来信，" + gotTxt + "。");
  pushMsg("avatar", "展信收取 · 化身自" + where + "寄回");
  renderMailBox(); mailDot(); updateHUD();
  save(); cloudSoon();
}


/* ============ v0.9.3 文字斗法横幅 · v1.2.0 主身斗法 ============ */
/* 叙事分工: 化身 = 云游(离线跑腿, 替主身搜罗材料/丹方残页/见闻, 书信寄回);
   主身 = 斗法(在线遭遇, 巡猎/秘境以战证道)。
   数值参考开源「我的文字修仙全靠刷」: 减伤公式 max(1, atk-def) + 闪避/暴击,
   怪物与玩家均带 攻/防/血 三围, 每合双方各出手一次 -> 逐条滚动日志 */
const MON_NAMES = [
  ["野狼妖", "灰鬃豺獠", "山道石魅", "赤目獠牙鬼"],
  ["夜叉山魈", "雾隐狸妖", "枯藤树魅", "磷火孤魂"],
  ["赤鬃熊罴", "黑风蛮蟒", "铁背蜈蚣", "嚎风狼王"],
  ["摄魂夜叉", "白骨将军", "玄甲鬼修", "血煞妖姬"],
  ["化形蛟妖", "吞云蟒王", "妖目金蟾", "夺魄狐王"],
  ["域外天魔", "虚空妖影", "蚀心魔君", "混沌妖胎"],
  ["裂空妖将", "虚妄魔影", "太阴魅妖", "星陨兽王"],
  ["九婴相柳", "金甲尸王", "阴阳魔傀", "混元妖圣"],
  ["真龙残魂", "金鹏魔禽", "界外妖主", "古荒兽尊"],
  ["天劫雷兽", "不死妖皇", "噬界魔尊", "洪荒古兽"],
  ["堕落金仙", "太初凶兽", "仙宫叛将", "灭世魔罗"],
  ["天道残影", "域外天魔尊", "混沌魔神", "太古魔主"],
];
const SKILLS = [
  ["乱拳",      "死命一搏"],
  ["火弹术",    "青锋剑芒"],
  ["流火刃",    "玄水剑澜"],
  ["离火神雷",  "庚金剑气"],
  ["九幽鬼火",  "裂天剑域"],
  ["太虚神雷",  "乾坤一掷"],
  ["虚空湮灭",  "裂天剑罡"],
  ["混元一气",  "太初剑诀"],
  ["大衍天雷",  "无极剑域"],
  ["劫灭神光",  "开天一剑"],
  ["九霄仙雷",  "诛仙剑阵"],
  ["混沌仙光",  "太初开天"],
];
const TRACE_ACT = [
  "正翻山赶路，脚步带起尘烟",
  "在渡口候船，看江上雾起",
  "沿溪而行，鞋袜尽湿",
  "在林间歇脚，就着泉水啃干粮",
  "于市集闲逛，东瞧西望",
  "蹲在路边逗一只不怕人的小兽",
  "对一株古树出神，站了许久",
  "被骤雨淋了个透，躲进路边破庙",
  "在崖边盘膝打坐，吐纳调息",
  "向路过的樵夫问路，绕了个远",
];
const MYST_TALE = [
  "洞中石壁上刻着半卷心法残篇，你默诵三遍，略有所悟",
  "一只通体雪白的守洞灵兽与你对视良久，让开了路",
  "洞底灵泉涌出三滴乳白灵液，你小心收好",
  "石匣空空，只压着一句旧语：「机缘不取，亦是机缘」",
];
let BTL = null;                       // 战斗状态(不入存档)
let MYST = null;                      // 秘境探索状态
let _traceT = 0, _tracePool = [], _traceLoc = "", _encNext = 0;
const slp = ms => new Promise(r => setTimeout(r, ms));

/* ============ v1.3.0 巡猎波次(在线/离线同一模型) / v1.4.0 周期收紧 ============
 * 一波 = 一次遭遇（八成斗法 / 两成秘境），周期固定 ENC_PERIOD 秒，自上一波收场起算。
 *   在线：搜寻 SEARCH_MIN~MAX 秒 + 真实演出(约 20~25s) 即一波，「速战」只省眼睛、不加速。
 *   离线：后端按 dt ÷ ENC_PERIOD 折算波次逐波结算（game-core.js 的 huntSettle，与此同式）。
 * 产出同尺：每战修为 = 挂机速率 × FIGHT_EXP_W（「打一场 ≈ 打坐 155 秒」），
 *   修为随境界曲线增长，占比不随境界漂移。
 *   （旧式 lv×120 为线性，挂机却是 (大境+1)^2.05 阶梯 —— 占比从 5.6% 一路掉到化神 3.8%）
 * v1.4.0 用户反馈「升级还是慢」→ 周期 180s 收紧到 90s（一天 960 波 / 768 场，原 480/384），
 *   W 不动 → 战斗占修为总产出由 40% 抬到 57%，整体修为产出 +42%。 */
const ENC_PERIOD = 90;         // 波次周期(秒) —— v1.4.0: 180 → 90
const FIGHT_EXP_W = 155;       // 每战修为 = rateNow × 此秒数(x = W/P×0.8×胜率 ≈ 1.32 → 占 57%)
const FIGHT_SP_W = 90;         // 每战灵石 = spiritRate × 此秒数(x ≈ 0.77 → 挂机灵石约占四成三)
const MYST_W = 45;             // 秘境机缘等效秒数
const HUNT_FIGHT_RATE = 0.8;   // 波次中斗法占比(余下为秘境)

/* ============ v1.4.0 自动斗法(在线表现层) ============
 * 「自动斗法」开启 → 主身持续巡山, 搜寻 SEARCH_MIN~MAX 秒后遇妖开打(行迹下方有搜寻动态提示);
 * 关闭 → 只打坐吐纳, 不主动寻妖(可随时再开)。
 * 注意: 这只是在线的表现层与节奏档, 底层产出/波次模型与离线结算完全一致(同 W/同公式)。
 * 在线开了自动斗法 ≈ 45~50s 一波(搜寻 ~25s + 斗法 ~20s + 收尾 ~4s), 比离线 90s 一波更密
 * —— 在线要盯着看, 演出占时间, 给一份「守着屏幕的甜头」; 关掉则退回纯挂机。 */
const SEARCH_MIN = 18, SEARCH_MAX = 32;
const SEEK_TALE = [
  "沿溪涧循妖气而上", "拨开雾色，四下张望", "忽闻林深处有异响",
  "剑意微鸣，前方有物", "踏破山脊，搜寻妖踪", "拾级而上，草木皆兵",
  "风里有腥气，循迹而去", "拨草寻径，屏息前行",
];
function autoHuntOn() { return !state || state.autoHunt !== false; }     // 默认开(懒人)
function searchMs() { return (SEARCH_MIN + Math.random() * (SEARCH_MAX - SEARCH_MIN)) * 1000; }
function toggleAutoHunt() {
  if (!state) return;
  state.autoHunt = !autoHuntOn();
  if (state.autoHunt) { _encNext = Date.now() + searchMs(); seekPick(); }
  else { _encNext = 0; seekHide(); }
  renderAutoHunt();
  pushMsg("main", state.autoHunt
    ? `<span class="b">自动战斗</span>已开 —— 你佩剑出府，主身自此巡山不止，遇妖即斩。`
    : `<span class="b">自动战斗</span>已收 —— 你回洞天只打坐吐纳，妖兽暂不来扰。`);
  save(); cloudSoon();
}
function renderAutoHunt() {
  /* v1.5.0: 小开关 —— 文案恒为「⚔ 自动」, 开/关只切 .on 激活态(朱砂亮 / 熄墨灰) */
  const b = $("btnAuto"); if (!b) return;
  const on = autoHuntOn();
  b.classList.toggle("on", on);
  b.title = on ? "自动战斗 · 开（点击关闭）" : "自动战斗 · 关（点击开启）";
  if (!on) seekHide();
}
function seekPick() { _seekLine = SEEK_TALE[Math.floor(Math.random() * SEEK_TALE.length)]; }
let _seekLine = SEEK_TALE[0];
/* 只在换句时重绘: traceBeat 每 2.5s 调一次 seekShow, 整锅重设会把跳动/淡入动画掐断重放 */
let _seekShown = "", _seekAt = 0;
function seekShow() {
  const el = $("huntSeek"); if (!el) return;
  if (!autoHuntOn()) { el.style.display = "none"; _seekShown = ""; return; }
  const now = Date.now();
  if (!_seekShown || now - _seekAt > 9000) { seekPick(); _seekAt = now; _seekShown = _seekLine; }
  if (el.dataset.line !== _seekShown) {
    el.dataset.line = _seekShown;
    el.innerHTML = `<span class="sk-txt">${_seekShown}</span><span class="sk-dots"><i></i><i></i><i></i></span>`;
  }
  el.style.display = "flex";
}
function seekHide() { const el = $("huntSeek"); if (el) { el.style.display = "none"; _seekShown = ""; } }
function huntBarShow(v) { const bar = $("huntBar"); if (bar) bar.style.display = v ? "flex" : "none"; }
function huntNext() {                  // 一波收场 → 重新起算搜寻时刻(自动斗法开时才生效)
  _traceT = Date.now();
  huntBarShow(true);                   // 收场 → 自动斗法条归位
  if (autoHuntOn()) { _encNext = Date.now() + searchMs(); seekPick(); }
  else { _encNext = 0; seekHide(); }
}

function warZone() {                   // 斗法地界 = 主身当前大境地界(与化身云游无关)
  return zoneOfBig(bigIdx());
}
/* ---------- 节拍: 行迹句 2.5 分钟一换; 主身巡猎按固定波次周期(与离线同频) ---------- */
function traceBeat() {
  if (!state) return;
  if (!BTL && !MYST) {
    if (autoHuntOn()) {
      if (!_encNext) { _encNext = Date.now() + searchMs(); seekPick(); }
      if (Date.now() >= _encNext) {
        try { fireEvent(); } catch (e) { _encNext = Date.now() + searchMs(); huntBarShow(true); console.warn("遭遇异常:", e); }
      } else seekShow();
    } else seekHide();
  } else seekHide();
  if (!BTL && !MYST && Date.now() - _traceT > 150000) { _traceT = Date.now(); traceRefresh(); }
}
function fireEvent() {                // 遇事分发: 八成妖兽伏击, 两成秘境机缘 —— 皆挂主身
  if (BTL || MYST) return;
  seekHide();                          // 妖已现踪 → 收起搜寻提示
  _encNext = Date.now() + 3600 * 1000; // 占位保险: 真正的下一波时刻由收场时(搜寻)重设
  if (Math.random() < HUNT_FIGHT_RATE) fireFight(); else fireMyst();
}
function fireFight() {                // 主身斗法: 不再借化身行迹, 出洞天巡猎遇妖
  if (BTL) return;
  const z = warZone();
  const big = z.big;
  const lv = (state.realmIdx || 0) + 1;              // 同尺: 怪=你的境界级
  const mon = genMonster(big, lv);
  const eb = equipBonus();
  /* 主身三围 = 基础(随 lv 线性, 懒人免加点——折算参考"每级+3属性点自动分配") + 装备加总;
     裸装对同尺中值怪约 5~9 合可胜, 有法宝更稳 */
  const php = 100 + 620 * lv + eb.hp;
  const patk = 10 + 58 * lv + eb.atk;
  const pdef = 5 + 42 * lv + eb.def;
  BTL = { mon, big, lv, turn: 0, round: 0, php, phpMax: php, patk, pdef, mhp: mon.hp, mhpMax: mon.hp, logs: [], ended: false, skip: false };
  traceSay(`妖气扑面 —— 一头 <b>${mon.n}</b> 拦住去路，斗法已起!`);
  warStart(`妖战`, `${mon.n} 拦住去路，龇牙低吼，妖风卷起一地枯叶。`);
  pushMsg("main", `妖气骤起!你行至<span class="r">${z.name}</span>一带巡山，撞见一头 ${mon.n}，你来我往斗了起来。`);
  const fl = $("flash"); if (fl) { fl.style.transition = "none"; fl.style.opacity = .38; void fl.offsetWidth; fl.style.transition = "opacity .6s ease"; fl.style.opacity = "0"; }
  btlRun();
}
async function btlRun() {
  while (BTL && !BTL.ended) {
    await slp(BTL.skip ? 40 : 1250);      // 每合玩家出手前; 首合更长(留出读开场白的空)
    if (!BTL || BTL.ended) break;
    BTL.round++;
    fieldLine();
    btlHeroAct();
    if (!BTL || BTL.ended) break;
    await slp(BTL.skip ? 40 : 900);       // 怪物还手前略顿, 一来一回看得清
    if (BTL && !BTL.ended) btlFoeAct();
  }
}
/* 速战: 懒人按钮 —— 不再逐合播报, 直接同步结算到分出胜负 */
function warSkip() {
  if (!BTL || BTL.ended || BTL.skip) return;
  BTL.skip = true;
  const m = BTL.mon;
  const btn = $("warSkipBtn"); if (btn) btn.style.opacity = ".45";
  for (let n = 0; n < 200000 && BTL && !BTL.ended; n++) {
    if (Math.random() >= 0.05) {
      let d = Math.max(1, Math.round((BTL.patk - m.def) * (0.85 + Math.random() * 0.3)));
      if (Math.random() < 0.10) d = Math.round(d * 1.6);
      BTL.mhp = Math.max(0, BTL.mhp - d);
      if (BTL.mhp <= 0) { btlWin(); return; }
    }
    if (Math.random() >= 0.07) {
      let d = Math.max(1, Math.round((m.atk - BTL.pdef) * (0.85 + Math.random() * 0.3)));
      BTL.php = Math.max(0, BTL.php - d);
      if (BTL.php <= 0) { btlLose(); return; }
    }
  }
  if (BTL && !BTL.ended) (BTL.mhp <= BTL.php ? btlWin() : btlLose());
}
window.warSkip = warSkip;
function btlHeroAct() {
  if (!BTL || BTL.ended) return;
  const si = (BTL.turn++ % 2), pool = SKILLS[BTL.big] || SKILLS[SKILLS.length - 1], name = pool[si];
  const m = BTL.mon;
  const miss = Math.random() < 0.05;
  if (miss) { btlLog(`你祭出「${name}」攻向${m.n} —— 被它侧身闪开，未伤分毫。`); }
  else {
    let dmg = Math.max(1, Math.round((BTL.patk - m.def) * (0.85 + Math.random() * 0.3)));
    const crit = Math.random() < 0.10;
    if (crit) dmg = Math.round(dmg * 1.6);
    BTL.mhp = Math.max(0, BTL.mhp - dmg);
    btlLog(`你使出「${name}」，${crit ? "正中要害、会心一击，" : "结结实实打中，"}<b class="r">${m.n}</b> 受创 ${dmg} 点，余 ${BTL.mhp}/${BTL.mhpMax} 气血。`);
  }
  fieldLine();
  if (BTL.mhp <= 0) { btlWin(); }
}
function btlFoeAct() {
  if (!BTL || BTL.ended) return;
  const m = BTL.mon;
  if (Math.random() < 0.07) { btlLog(`${m.n} 扑向你 —— 你侧身避开，溅起一地尘土。`); }
  else {
    let d = Math.max(1, Math.round((m.atk - BTL.pdef) * (0.85 + Math.random() * 0.3)));
    BTL.php = Math.max(0, BTL.php - d);
    btlLog(`${m.n} 反扑而至，你受创 ${d} 点，余 ${BTL.php}/${BTL.phpMax} 气血。`);
  }
  fieldLine();
  if (BTL.php <= 0) { btlLose(); }
}
/* 战场日志: 逐条 append, 只留最近 9 行, 新行淡入 */
function warAppend(s, cls) {
  const el = $("warLog"); if (!el) return;
  const d = document.createElement("div");
  d.className = "wl" + (cls ? " " + cls : "");
  d.innerHTML = s;
  el.appendChild(d);
  while (el.children.length > 9) el.removeChild(el.firstChild);
}
function btlLog(s, cls) { if (!BTL) return; BTL.logs.push(s); warAppend(s, cls); }
function fieldLine() {
  if (!BTL) return;
  const el = $("tfFoe"), el2 = $("tfHero"), el3 = $("tfTurn");
  if (el) el.innerHTML = `敌·${BTL.mhp}/${BTL.mhpMax}`;
  if (el2) el2.innerHTML = `主身·${BTL.php}/${BTL.phpMax}`;
  if (el3) el3.innerHTML = BTL.round ? `${BTL.round}合` : "";
}
function traceSay(txt) {
  const el = $("traceArea"); if (!el) return;
  el.dataset.k = "fight";
  el.className = "trace fight";
  el.innerHTML = `<span class="t-row"><span class="t-ic">战</span><span class="t-txt">${txt}</span></span>`;
}
function warStart(title, lead) {
  const el = $("warBanner"); if (!el) return;
  huntBarShow(false);                    // v1.4.0: 开打/探秘时整条让位给横幅(二者同一行, 互斥)
  el.style.display = "flex";
  el.innerHTML = `<div class="war-hd"><span class="war-t">${title}</span><span class="war-hp"><i id="tfFoe">—</i>　<i id="tfHero">—</i>　<i id="tfTurn" style="color:#a8904f"></i></span><button class="war-skip" id="warSkipBtn" onclick="warSkip()">⚡</button></div><div class="war-bd" id="warLog"></div>`;
  fieldLine();
  if (lead) warAppend(lead, "lead");
}
function warEnd(finalTxt, cls) {
  if (finalTxt) warAppend(finalTxt, cls || "win");
  const wb = $("warBanner");
  const wait = (BTL && BTL.skip) ? 2100 : (MYST ? 2400 : 2700);   // 速战后短留即可
  setTimeout(() => { if (wb) wb.style.display = "none"; }, wait);
}
function btlWin() {
  if (!BTL || BTL.ended) return; BTL.ended = true;
  const m = BTL.mon;
  /* 产出同尺(参考 exp = maxCultivation/100 = 2^境界, 即「指数曲线 + 每境百战」)：
     折算成我们的挂机速率 —— 每战 ≈ 打坐 FIGHT_EXP_W 秒、≈ 聚灵 FIGHT_SP_W 秒。
     修为/灵石随境界同步增长，战斗占修为总产出恒为 40%（见 ENC_PERIOD 注释） */
  const g = Math.round(spiritRate() * FIGHT_SP_W);
  const ge = Math.round(rateNow() * FIGHT_EXP_W);
  state.spirit += g; state.exp += ge;
  // 参考"每战必掉装备": 掉落一件同级法宝(品质概率), 走自动择优穿戴
  try { const dr = makeArt(); smartEquip(dr); } catch (e) {}
  pushMsg("main", `你击退 <span class="r">${m.n}</span>，<span class="g">+${fmt(g)} 灵石</span>、修为+<span class="g">${fmt(ge)}</span>。`);
  addJournal({ key: "bt-" + Date.now(), big: realm().big, kind: "纪事", title: "斗法 · 退" + m.n,
    text: `你于${warZone().name}巡猎，遇 ${m.n} 拦路，施「${(SKILLS[BTL.big] || SKILLS[SKILLS.length - 1])[0]}」「${(SKILLS[BTL.big] || SKILLS[SKILLS.length - 1])[1]}」数合将其击退，捡得灵石 ${fmt(g)}。` });
  warEnd(`妖雾散尽 · 斗法得胜! 灵石 <b>+${fmt(g)}</b>，修为 +${fmt(ge)}`);
  traceSay(`你击退 ${m.n}，<b>+${fmt(g)} 灵石</b>`);
  const wait = (BTL && BTL.skip) ? 2400 : 3800;
  setTimeout(() => { if (BTL) { BTL = null; huntNext(); traceRefresh(); save(); cloudSoon(); } }, wait);
  return;
}
function btlLose() {
  if (!BTL || BTL.ended) return; BTL.ended = true;
  const m = BTL.mon;
  warEnd(`你力竭不支，被 ${m.n} 击倒在地 …… 败退 · 回洞天休养`, "lose");
  pushMsg("main", `<span class="r">你不敌 ${m.n}</span>，狼狈遁回洞天。阿青在旁呜咽，叼来药囊替你敷上。`);
  addJournal({ key: "bt-" + Date.now(), big: realm().big, kind: "纪事", title: "斗法 · 败于" + m.n,
    text: `你于${warZone().name}巡猎，不敌 ${m.n}，负伤遁回洞天休养。` });
  traceSay(`你不敌 ${m.n}，负伤归府休养`);
  const wait = (BTL && BTL.skip) ? 2400 : 3800;
  setTimeout(() => { if (BTL) { BTL = null; huntNext(); traceRefresh(); save(); cloudSoon(); } }, wait);
}
/* ---------- 秘境机缘: 文字探索(主身奇遇) ---------- */
function fireMyst() {
  if (MYST) return;
  const z = warZone();
  MYST = { i: 0, logs: [] };
  traceSay(`灵光隐现 —— 你在<b>${z.name}</b>发现一处<b>秘境入口</b>，踏入其中。`);
  warStart(`秘境`, `你循着灵光拨开藤蔓，露出一道幽深的石阶入口。`);
  pushMsg("main", `<span class="b">秘境!</span> 你在${z.name}一带发现一处隐秘入口，进去一探。`);
  mystRun();
}
async function mystRun() {
  const lines = [
    "沿湿滑石阶下行，壁上青苔泛着微光……",
    MYST_TALE[Math.floor(Math.random() * MYST_TALE.length)],
    "忽闻阴风呼啸 —— ",
  ];
  for (const ln of lines) {
    if (!MYST) return;
    await slp(950);
    MYST.logs.push(ln); warAppend(ln);
  }
  if (!MYST) return;
  // 洞中也可能撞妖(30%): 顺接成一场主身斗法
  if (Math.random() < 0.3) { MYST = null; fireFight(); if (BTL) warAppend("话音未落，洞中妖气骤起 —— "); }
  else {
    const kind = Math.random();
    let txt;
    if (kind < 0.45) { const g = Math.round(spiritRate() * MYST_W * 1.2); state.spirit += g; txt = `你寻到一匣旧藏灵石 —— <b>+${fmt(g)} 灵石</b>`; }
    else if (kind < 0.8) { const g = Math.round(rateNow() * MYST_W); state.exp += g; txt = `壁刻心法令你顿悟片刻 —— 修为+${fmt(g)}`; }
    else txt = "此处只有一室清风，你原路退出，不虚此行。";
    pushMsg("main", `你探秘境归来，${txt.replace(/<[^>]+>/g, "")}`);
    warEnd(txt);
    setTimeout(() => { if (MYST) { MYST = null; huntNext(); traceRefresh(); save(); cloudSoon(); } }, 3200);
  }
}
/* ---------- 行迹刷新(含战斗/秘境中的顶行) ---------- */
function traceRefresh() {
  const el = $("traceArea"); if (!el) return;
  if (BTL || MYST) { if (el.dataset.k === "fight") return; }
  if (state.travel) {
    const loc = locById(state.travel.loc);
    const where = loc ? loc.n : "远方";
    const lid = state.travel.loc;
    if (el.dataset.k !== lid || !_tracePool.length) {
      el.dataset.k = lid;
      _tracePool = (loc && loc.tale && loc.tale.length ? loc.tale.slice() : []).concat(TRACE_ACT.slice());
      if (!_tracePool.length) _tracePool = TRACE_ACT.slice();
    }
    const s = _tracePool.shift(); _tracePool.push(s);
    el.className = "trace travel";
    el.innerHTML = `<span class="t-row"><span class="t-ic">迹</span><span class="t-txt">化身在 <b>${where}</b>：${s}</span></span>`;
    return;
  }
  if (el.dataset.k === "idle") return;
  el.dataset.k = "idle";
  el.className = "trace idle";
  el.innerHTML = `<span class="t-row"><span class="t-ic">云</span><span class="t-txt">化身尚未出行 —— 遣它下山?</span><button class="trace-go" onclick="event.stopPropagation();openTravel()">云游</button></span>`;
}
function traceTap() { if (!BTL && !MYST) openTravel(); }
setInterval(traceBeat, 2500);
traceRefresh();
renderAutoHunt();                  // v1.4.0: 自动斗法按钮初态(跟存档里的 autoHunt 走)
/* v1.5.0: 行迹起点跟随 HUD 实高 —— 窄屏顶部资源栏折行、HUD 变高时自动下移, 永不挤压 */
(function () {
  const ts = $("topStack"), hud = document.querySelector(".hud");
  if (!ts || !hud) return;
  const sync = () => { ts.style.top = Math.round(hud.getBoundingClientRect().bottom + 8) + "px"; };
  if (window.ResizeObserver) new ResizeObserver(sync).observe(hud);
  window.addEventListener("resize", sync);
  sync();
})();
/* ============ 调试入口: 立即遇妖 —— v1.4.2 已撤下 UI, 需要时在控制台敲 debugEncounter() ============ */
function debugEncounter() {
  if (BTL || MYST) { pushMsg("main", "正在斗法/探秘中，且待收场。"); return; }
  closeTravel();
  fireEvent();                              // 立即遇事(妖兽伏击/秘境)
}
window.debugEncounter = debugEncounter;     // 仅控制台可用, 界面不再摆按钮


/* ============ v0.9.4 法宝·装备: 自动择优穿戴 + 装备面板 ============ */
/* 数值参考「我的文字修仙全靠刷」品质乘子滚雪球思路, 但保留本作"阿青打铁"法宝叙事;
   自动装: 阿青出炉新法宝 → 若强于身上最弱一件则自动顶替, 被换旧件熔回灵石 */
let _eqRecycle = [];
function equipBonus() {                 // 斗法三维 = 六槽装备属性加总(参考加法)
  let atk = 0, def = 0, hp = 0;
  for (const a of (state.arts || [])) {
    if (typeof a.a === "number") atk += a.a;
    if (typeof a.d === "number") def += a.d;
    if (typeof a.h === "number") hp += a.h;
  }
  return { atk, def, hp };
}
function smartEquip(a) {
  const arts = state.arts || [];
  const idx = (typeof a.slot === "number" && a.slot < 4) ? a.slot : arts.length;
  const q0 = QUALITY[a.q];
  if (idx >= arts.length) {                 // 空槽: 直接穿戴
    arts.push(a); state.arts = arts;
    pushMsg("avatar", `阿青把 ${a.name}（${q0.name}·${SLOT_TYPES[idx].n}）放进藏宝阁 —— 已替穿戴。`);
    updateArts(true); save(); cloudSoon(); return;
  }
  const w = arts[idx];
  if (!w) { arts[idx] = a; updateArts(true); save(); cloudSoon(); return; }
  if (a.q > w.q || (a.q === w.q && a.mult > w.mult)) {
    const g = Math.round(50 * Math.pow(1.6, w.q));
    state.spirit += g;
    arts[idx] = a;
    _eqRecycle.unshift(`熔回 ${w.name}(${QUALITY[w.q].name}) +${fmt(g)}`);
    if (_eqRecycle.length > 3) _eqRecycle.pop();
    pushMsg("avatar", `阿青见 ${a.name}(${q0.name}·${SLOT_TYPES[idx].n}) 胜过旧佩，把那 ${w.name} 熔回灵石 +${fmt(g)}，新宝自动换上。`);
    updateArts(true); save(); cloudSoon();
  } else {
    const g = Math.round(40 * Math.pow(1.5, a.q));
    state.spirit += g;
    pushMsg("avatar", `${a.name}(${q0.name}) 不及身上同槽所佩，阿青炼作灵石 +${fmt(g)}。`);
    updateArts(false); save(); cloudSoon();
  }
}
function openEquip() {
  const m = $("equipModal"); if (!m) return;
  renderEquip();
  m.classList.add("show");
}
function closeEquip() { const m = $("equipModal"); if (m) m.classList.remove("show"); }
function renderEquip() {
  const box = $("equipBody"); if (!box) return;
  const eb = equipBonus();
  const arr = (state.arts || []).slice(-6);
  let cells = "";
  for (let i = 0; i < 4; i++) {
    const a = arr[i];
    if (!a) { cells += `<div class="eq-cell empty"><span class="eq-cn dim">空位</span></div>`; continue; }
    const q = QUALITY[a.q] || QUALITY[0];
    const tn = SLOT_TYPES[i].n;
    cells += `<div class="eq-cell qc${a.q}">
      <span class="eq-ql ${q.cls}">${q.name} · ${tn}</span>
      <span class="eq-cn">${a.name}</span>
      <span class="eq-cm">修为×${a.mult.toFixed(2)}</span>
      <span class="eq-bt">攻+${a.a||0} 防+${a.d||0} 血+${a.h||0}</span>
    </div>`;
  }
  const rec = _eqRecycle.length ? `<div class="eq-rec">近记：${_eqRecycle.join(" · ")}</div>` : "";
  box.innerHTML = `
    <div class="eq-sum">
      <span>修为加成 <b>×${artMult().toFixed(2)}</b></span>
      <span>斗法 <b>攻+${eb.atk}</b> <b>防+${eb.def}</b> <b>血+${eb.hp}</b></span>
    </div>
    <div class="eq-grid">${cells}</div>
    <div class="eq-note">阿青出炉新宝会自动择优：胜过六件中最弱一件才换上，旧件熔回灵石；<br>不如身上所佩的，当场炼作灵石。全程无需你费心。</div>
    ${rec}`;
}



/* ============ v1.0.0 参考数值骨架(同尺+加法) ============ */
/* 对接「我的文字修仙全靠刷」: 玩家攻/血/防 = 基础 + 装备加总; 怪物按玩家境界级线性;
   装备属性 = 随机基础 × 境界级 lv × 品质乘子 QM; 品质概率 50/20/15/9/5/1 */
function eqMult(q) { return [1.2, 2, 3, 5, 7, 10][q] || 1.2; }  // q0..q5 属性乘子(参考)
const SLOT_TYPES = [                                        // 四部位(参考): 兵/护/佩/诀
  { n: "兵器", k: "w" }, { n: "护体", k: "a" },
  { n: "灵佩", k: "p" }, { n: "功法", k: "s" },
];
const ARMOR_POOL = ["云纹软甲", "玄铁道衣", "天蚕宝衣", "碧鳞内甲", "朱雀羽衣", "金刚袈裟", "鲛绡冰纱", "紫绶仙衣", "龙鳞软铠", "九曜战衣"];
const PEND_POOL = ["避尘佩", "养神玉", "锁魂珠", "聚灵环", "玄冰坠", "火灵佩", "护心古镜", "九宫清铃", "碧玉如意", "血珀珠"];
const SCROLL_POOL = ["太清剑诀", "青元剑经", "大衍残篇", "庚金真解", "紫电玄功", "御风诀", "五行遁法", "斩灵诀", "御剑心经", "长春化生功"];
function artName(kind, q) {
  const sp = ART_SPECIAL.filter(s => q >= s[0]);
  if (sp.length && Math.random() < 0.35) return sp[Math.floor(Math.random() * sp.length)][1];
  if (kind === "w") return ART_PREFIX[Math.floor(Math.random() * ART_PREFIX.length)] + ART_SUFFIX[Math.floor(Math.random() * ART_SUFFIX.length)];
  const P = kind === "a" ? ARMOR_POOL : kind === "p" ? PEND_POOL : SCROLL_POOL;
  return P[Math.floor(Math.random() * P.length)];
}
function attrAssign(art, kind, q, lv) {
  const M = eqMult(q);
  const r1 = Math.random(), r2 = Math.random(), r3 = Math.random();
  if (kind === "w") { art.a = Math.max(1, Math.round((10 + r1 * 40) * lv * M)); art.h = 0; art.d = 0; }
  else if (kind === "a") { art.h = Math.round((100 + r1 * 300) * lv * M); art.d = Math.max(1, Math.round((1 + r2 * 11) * lv * M)); art.a = 0; }
  else if (kind === "p") { art.h = Math.round((40 + r1 * 120) * lv * M); art.d = Math.max(1, Math.round((1 + r2 * 5) * lv * M)); art.a = Math.round((4 + r3 * 12) * lv * M); }
  else { art.a = Math.round((6 + r1 * 18) * lv * M); art.d = Math.max(1, Math.round((1 + r2 * 7) * lv * M)); art.h = 0; }
}
function genMonster(big, lv) {                            // 怪物 = 参考线性公式(随玩家境界级)
  const names = MON_NAMES[big] || MON_NAMES[0];
  return {
    n: names[Math.floor(Math.random() * names.length)],
    hp: Math.round((100 + Math.random() * 400) * lv),
    atk: Math.round((50 + Math.random() * 100) * lv),
    def: Math.max(1, Math.round((1 + Math.random() * 14) * lv)),
  };
}
function hashRand(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
