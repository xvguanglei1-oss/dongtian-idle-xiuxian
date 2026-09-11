# 《闲人修仙》存档体系规范（v1.10.0 终态）

> 版本 v2.0 · 2026-09-11 · 全新设计（greenfield），**无任何历史格式兼容**。
> 本文档是存档相关后续开发的行为基准：任何 agent/开发者改存档相关代码前必读，改完对齐本文。

---

## 〇、设计立场（先读这个）

1. **没有旧玩家**。v1.10.0 起不存在任何历史存档格式（z1/LZString、旧 JSON 落盘、六槽法宝等全部退役）。**永远不要为"兼容旧档"写代码**——包括探测旧键名、旧编码、旧字段布局的任何分支。
2. **单一格式**。本地档 = 明文 JSON；云档 = `g1`（唯一云端编码）。不存在"双格式识别"逻辑。
3. **服务端权威**。结算、时间锚、信匣存在性以服务端为准；客户端的钟只作显示参考。
4. **向前兼容靠 schema 版本，不靠猜测**。字段演进走 `state.ver` + `MIGRATIONS` 链，永远显式。

---

## 一、数据流总览

```
┌─ 客户端 ──────────────────────────────────────────────┐
│ state (内存)                                          │
│  ↕ save()/load()  localStorage["dongtian_save_v1"]    │  ← 明文 JSON，同步写
│  ↕ g1Pack/g1Unpack  "g1:"+base64(gzip(剪枝JSON))      │  ← 唯一云端编码
└──────────────┬────────────────────────────────────────┘
               │ PUT /api/save?id=..&settle=1|stay=1|claim=..
               │ GET /api/save?id=..    PUT /api/name    GET /api/rank
┌──────────────▼────────────────────────────────────────┐
│ save-server v7 (ECS, better-sqlite3, WAL)             │
│   saves 表(权威账本) + names 表(道号唯一)               │
└───────────────────────────────────────────────────────┘
```

- **写路径只有一个**：`cloudSettle()`。普通进度上传也走 settle（结算即上传）。普通 PUT/claim/stay 只推进锚、不发收益。
- **读路径只有一个**：`cldPull()`（启动门禁 / 换设备导入）。
- 启动门禁 `bootGate()`：拉云档 → 服务端结算一次 → 通过才进游戏；连不上服务器停在失败页（断网不发钱）。

---

## 二、本地存档规范

| 项 | 规定 |
|---|---|
| 键名 | `dongtian_save_v1`（跟随 schema 大版本；升 ver 大版本时换键名） |
| 内容 | `JSON.stringify(state)`，明文，同步写（`pagehide` 可靠） |
| 旧键清理 | `load()` 开头 `localStorage.removeItem("dongtian_xiuxian_v2")`（v1.10.0 退役动作，保留） |
| 失败策略 | try/catch 静默——本地档只是缓存，云才是权威 |

### schema 版本骨架（新增字段唯一正确姿势）

```js
state.ver = 1                 // state 字面量里显式带 ver
const CUR_VER = 1;            // 当前 schema 版本
const MIGRATIONS = {          // 键 = 目标版本号
  // 2: s => { s.newField = s.newField || 0; return s; },   ← v2 上线时这样写
};
function migrate(s) { /* while 链式升级, 已在 game.js */ }
```

**规则（agent 必守）：**
1. 加字段：字段名加进 `G1_TPL`（game.js 客户端与服务端各一份模板）+ `state` 初始值，**不动 `CUR_VER`**（模板补默认即兼容）。
2. 加**语义变化**的字段（老值含义变了/结构变了）：`CUR_VER+1`，写 `MIGRATIONS[新ver]`，**已发布的迁移函数永不删除、永不修改**。
3. `state.ver` 只由 `migrate()` 写，别处不许碰。
4. `adopt()` 只做防御性钳制（范围/类型），**永远不再塞历史转换逻辑**。

---

## 三、云存档 g1 协议（唯一格式）

```
编码: "g1:" + base64( gzip( JSON( g1prune(state, G1_TPL) ) ) )
解码: gunzip → JSON.parse → g1merge(json, G1_TPL)   （gzip CRC32 自带完整性）
```

- **上行剪枝** `g1prune`：与模板深度相等的默认值整段剔除；模板外字段原样保留 → **字段演进天然向后兼容**。
- **下行补齐** `g1merge`：模板铺默认 → 档值覆盖递归。服务端收到恶意缺字段 PUT 也先补齐再结算（纵深防御）。
- 客户端 `G1_TPL`（game.js）与服务端 `G1_TPL`（save-server.js）**必须同步改**；改完跑 `test-g1.js` + `test-v7.js`。
- **禁止**：再引入第二种编码前缀；对非 g1 上行做"善意解析"（服务器对非 g1 一律 400 bad_format）。

---

## 四、服务器存储（save-server v7, SQLite）

**运行环境**：ECS `/usr/local/bin/node`（官方 Node 22 LTS，ABI 127），`/opt/dongtian/node_modules/better-sqlite3@11`。
> ⚠️ 系统 `/usr/bin/node` 是 Ubuntu 打包版（ABI 109 非官方），**禁用**——原生模块官方预编译包与之不兼容。systemd unit/cron 一律写 `/usr/local/bin/node`。

**表结构：**

```sql
saves(id TEXT PRIMARY KEY, ver INT, gen INT, ts INT, created INT,
      last_settle INT, name TEXT, rid INT, exp REAL, spirit REAL, data BLOB)
  -- data = gzip(JSON(state))  原始二进制
  -- ts       = 每次写档的服务器时刻（在线/活跃统计口径）
  -- created = 首次建档时刻，只增不减（新晋统计口径）
  -- gen     = 每写 +1
names(name TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE)   -- 道号全服唯一
```

**Pragma 组**（初始化必须全带）：

```js
journal_mode = WAL;  synchronous = NORMAL;  busy_timeout = 5000;
foreign_keys = ON;   cache_size = -16000
```

better-sqlite3 单写连接同步 API 天然串行，无需进程内加锁；多语句写必须包 `db.transaction(...)( )`（`immediate`）。

### 结算锚（防回滚重放，核心安全机制）

```
anchor = min( max( 服务端旧档 state.lastTs,  row.last_settle ), now )
```

- `last_settle` 只在 settle 时推进，服务端权威、单调不减 → **旧档回滚 PUT 无法把锚拉回已结算时刻**，重复结算刷收益不可能。
- 普通 PUT 也把 `state.lastTs/_settledAt` 推进到 now（在线活跃即锚前进），配合抖动保护 `MIN_SETTLE_DT` 实现"立即重复 settle → dt=0"。

### 信匣权威

- **存在性归服务端**：settle 时信匣列表 = 服务端旧档信匣 ∩ 客户端声称保留的 id（收了不重发）。
- 无旧档时客户端带来的信匣**一律清空**（防首次伪造）。

### 道号

- `PUT /api/name`：占名 409（他人）、本人重名 ok；改名成功写 `names` 表。
- 普通写档直带他人已占名 → 服务端直接剥离（`name=""`），不报错。

### HTTP 约定

- 响应 `data` 恒为 g1 串；PUT 上行非 g1 → `400 bad_format`；坏 JSON 400；超大 body 413；非法 id 400。
- 榜单 `GET /api/rank?top=&self=`：SQL 排序 `rid DESC, exp DESC, spirit DESC`。
- 心跳 90s：`keepAliveTimeout=130s / headersTimeout=135s` 必须大于心跳间隔。

---

## 五、安全模型清单（改动不得削弱）

| 威胁 | 对策（已实现） |
|---|---|
| 直改内存/封包刷数值 | 服务端 `sanitize` 全量钳制（realmIdx/exp/spirit/arrayLv/arts/journal 上限） |
| 重复结算刷离线收益 | 结算锚 + `last_settle` 单调 + `MIN_SETTLE_DT` 抖动保护 |
| 旧档回滚重放 | 锚取服务端旧档与 `last_settle` 的较大者，客户端谎报无效 |
| 伪造信匣 | 信匣存在性以服务端旧档为准；无旧档清空 |
| 抢注/冒用道号 | names 表 UNIQUE + 409 + 直写剥离 |
| 存档损坏 | gzip CRC32 校验，损坏即拒绝（不自愈，靠每日快照兜底） |
| 深度炸弹/超大包 | `MAX_DEPTH=80`、`MAX_BODY=512KB` |

---

## 六、运维

- **服务**：`systemctl restart dongtian-save`（unit 里 ExecStart 必须是 `/usr/local/bin/node`）。
- **每日快照（待配 cron）**：4:00 `tar` 打包 `/var/lib/dongtian/dongtian.db*` → `/var/backups/dongtian/`，保留 7 代。
- **日报**：`node daily-report.js [--dry]`（better-sqlite3 只读连接；在线/活跃口径=`saves.ts`，新晋=`saves.created`）。
- **测试**（改任何存档代码后必跑）：
  - `node test-g1.js`（编码层 11 项）
  - `node test-v7.js`（服务器 41 项：roundtrip/格式拒绝/锚/信匣/占名/榜单/坏请求）
  - 浏览器 E2E：`_probe_e2e.html`（真 CompressionStream + 真服务器全链路 7 项，不入库）

---

## 七、已知边界（有意为之，勿"修复"）

1. 本地档明文不加密——本地档只是缓存，作弊只会坑玩家自己，云上服务端钳制兜底。
2. 损坏档不尝试自愈——静默当作无档重开，每日 7 代快照兜底。
3. `gen` 字段目前仅调试可见，为未来乐观并发预留。
4. SQLite 单文件单机——量级（单服 ≤ 万级玩家）内不需要也不引入更重的数据库。
