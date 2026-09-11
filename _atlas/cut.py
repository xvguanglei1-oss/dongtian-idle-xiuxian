# -*- coding: utf-8 -*-
"""图集裁切管线：2x3 图集(1024x1536 或实际返回尺寸) -> 6 个 100x100 webp 图标
用法: python3 cut.py <图集.png> <key1,key2,...(行优先)> <输出目录>
管线: 512 等分网格裁切 -> 角落取样背景 -> 右下水印检测涂盖 -> 背景归一 #161c2b -> 100x100 webp + 质检
"""
import sys, os
import numpy as np
from PIL import Image

TARGET = np.array([22, 28, 43])  # #161c2b 丹房背包格渲染色

def main(src, keys, outdir):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    cw, ch = W // 2, H // 3
    print(f"atlas {W}x{H} cell {cw}x{ch}")
    os.makedirs(outdir, exist_ok=True)
    keys = keys.split(',')

    report = []
    for i, key in enumerate(keys):
        r, c = divmod(i, 2)
        cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        a = np.array(cell).astype(int)
        h, w = a.shape[:2]

        # 1) 角落取样背景 (右上角内侧 16x16, 避开主体与水印)
        patch = a[24:40, w - 40:w - 24]
        bg = patch.reshape(-1, 3).mean(axis=0)
        bgl = bg.mean()

        # 2) 分块中值背景模型校正: AI 常给每格画卡片底面(两个离散色阶), 线性拟合拉不平。
        #    8x8 分块取背景候选中值为锚点, 双线性插值出每像素背景估计, 校正到 #161c2b。主体不动。
        lum0 = a.mean(axis=2)
        sat0 = a.max(axis=2) - a.min(axis=2)
        bmask = (lum0 < 70) & (sat0 < 34)
        G = 8
        bh, bw = max(1, h // G), max(1, w // G)
        anchors = np.full((G, G, 3), np.nan)
        for by in range(G):
            for bx in range(G):
                bm = bmask[by*bh:(by+1)*bh, bx*bw:(bx+1)*bw]
                if bm.sum() > 50:
                    blk = a[by*bh:(by+1)*bh, bx*bw:(bx+1)*bw]
                    anchors[by, bx] = np.median(blk[bm], axis=0)
        if np.isnan(anchors).any() and (~np.isnan(anchors[..., 0])).any():
            # 无效锚点(纯主体块)用全局均值邻域传播填充: 迭代取有效邻居均值
            for _ in range(G):
                bad = np.isnan(anchors[..., 0])
                if not bad.any():
                    break
                for by in range(G):
                    for bx in range(G):
                        if bad[by, bx]:
                            nb = [anchors[yy, xx] for yy, xx in ((by-1,bx),(by+1,bx),(by,bx-1),(by,bx+1))
                                  if 0 <= yy < G and 0 <= xx < G and not np.isnan(anchors[yy, xx, 0])]
                            if nb:
                                anchors[by, bx] = np.mean(nb, axis=0)
        if not np.isnan(anchors).any():
            gy = np.clip((np.arange(h) - bh / 2) / bh, 0, G - 1.001)
            gx = np.clip((np.arange(w) - bw / 2) / bw, 0, G - 1.001)
            y0 = np.floor(gy).astype(int); y0c = y0[:, None]
            x0 = np.floor(gx).astype(int); x0r = x0[None, :]
            fy2 = np.broadcast_to((gy - y0)[:, None], (h, w))[..., None]
            fx2 = np.broadcast_to((gx - x0)[None, :], (h, w))[..., None]
            bgm = (anchors[y0c, x0r] * (1 - fy2) * (1 - fx2) + anchors[y0c + 1, x0r] * fy2 * (1 - fx2)
                   + anchors[y0c, x0r + 1] * (1 - fy2) * fx2 + anchors[y0c + 1, x0r + 1] * fy2 * fx2)
            a[bmask] = np.clip(a[bmask] - bgm[bmask] + TARGET, 0, 255)

        # 3) 水印涂盖: 归一后按固定阈值检测(背景≈31, 水印灰文字 40~190, 低饱和), 区域收紧到右下真水印位
        lum = a.mean(axis=2)
        sat = a.max(axis=2) - a.min(axis=2)
        region = np.zeros((h, w), bool)
        region[int(h * .84):, int(w * .70):] = True
        wm = region & (lum > 40) & (lum < 190) & (sat < 60)
        n_wm = int(wm.sum())
        if n_wm:
            try:
                from scipy import ndimage as ndi
                wm = ndi.binary_dilation(wm, iterations=2)
            except ImportError:
                pass
            a[wm] = TARGET

        # 4) 质检: 主体 bbox(lum>=95) 中心偏移 + 残留水印像素
        lum = a.mean(axis=2)
        ys, xs = np.where(lum >= 95)
        if len(ys):
            cx, cy = xs.mean() / w, ys.mean() / h
            bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
            cover = len(ys) / (w * h)
        else:
            cx = cy = cover = 0
            bbox = None
        # 归一涂盖后右下角残留(>45 的低饱和灰像素, 避开背景噪声自报)
        res = region & (a.mean(axis=2) > 45) & ((a.max(axis=2) - a.min(axis=2)) < 55)

        out = Image.fromarray(a.astype('uint8')).resize((100, 100), Image.LANCZOS)
        if key != "-":
            out.save(os.path.join(outdir, f"{key}.webp"), quality=90)
        report.append((key, n_wm, int(res.sum()), round(cx, 2), round(cy, 2), round(cover * 100, 1)))

    print(f"{'key':<10} wm_px  res_px  cx    cy    cover%")
    for k, n, rr, cx, cy, cv in report:
        flag = " <-- CHECK" if (rr > 40 or cx == 0 or abs(cx - .5) > .18 or abs(cy - .5) > .18 or cv < 2) else ""
        print(f"{k:<10} {n:<6} {rr:<7} {cx:<5} {cy:<5} {cv:<6}{flag}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
