#!/usr/bin/env python3
# 部落領主 v2-land.5：把 art/ 裡的 PNG 轉成 WebP（有損＋透明），寫成 assets.js：var TL_ASSETS = { 名稱: 'data:image/webp;base64,...' }
# 用法：python3 pack-assets.py [--src art資料夾] [--out assets.js] [--quality 85]
# 檔名（不含 .png）就是遊戲裡的名稱，例如 ter_farm.png → ter_farm。art/ 是空的就寫出空物件。
# 規格（1 du = 2 px）：地形 192×192 px；樹 obj_tree_0..2 128×160；建築 192×240；議事廳 224×272；居民 56×112；營火 fire_0..5 各 192×192。
# v2-land.8 檔名：地形 ter_farm ter_pasture ter_hunt ter_stone、河 ter_river_00..15；ter_grass、ter_forest、ter_river、ter_meadow、ter_rock 已不用（會警告）。
import argparse, base64, io, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--src', default=os.path.join(HERE, 'art'))
ap.add_argument('--out', default=os.path.join(HERE, 'assets.js'))
ap.add_argument('--quality', type=int, default=85)
a = ap.parse_args()

EXPECT = {'ter_': (192, 192), 'obj_tree_': (128, 160), 'bld_': (192, 240), 'ppl_': (56, 112), 'fire_': (192, 192), 'bubble_tool_': (72, 72)}
JOBS = 'lumber|hunt|fish|farm|herd|stock|mine|idle|soldier|hero'
KNOWN = re.compile(r'^(ter_(farm|pasture|hunt|stone)|ter_river_(0\d|1[0-5])|obj_tree_[0-2]|bld_(house|lumber|lodge|fishery|field|ranch|pen|mine|barracks|clinic|storage|council)|ppl_(%s)(_[mf])?|ppl_hero_hat|bubble_tool_(farm|fish|herd|hunt|lumber|mine|stock)|fire_[0-5])$' % JOBS)   # v2-land.19：英雄帽、工具泡泡
files = sorted(f for f in os.listdir(a.src) if f.lower().endswith('.png')) if os.path.isdir(a.src) else []
entries, total_png, total_webp = [], 0, 0
for f in files:
    name = os.path.splitext(f)[0]
    if not name.replace('_', '').isalnum():
        sys.exit('檔名只能用英數字和底線：' + f)
    path = os.path.join(a.src, f)
    im = Image.open(path).convert('RGBA')
    want = (224, 272) if name == 'bld_council' else next((v for k, v in EXPECT.items() if name.startswith(k)), None)
    warn = '' if want is None or im.size == want else '  （注意：尺寸 %dx%d，規格是 %dx%d）' % (im.size + want)
    if not KNOWN.match(name):
        warn += '  （注意：遊戲不認得這個名稱，不會用到）'
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=a.quality, alpha_quality=100, method=6)
    data = buf.getvalue()
    png = os.path.getsize(path)
    total_png += png; total_webp += len(data)
    entries.append((name, base64.b64encode(data).decode('ascii')))
    print('%-24s %4dx%-4d PNG %8.1f KB → WebP %7.1f KB%s' % (f, im.size[0], im.size[1], png / 1024, len(data) / 1024, warn))

head = '// 由 pack-assets.py 產生，不要手改。來源：art/*.png → WebP（quality %d），1 du = 2 px。\n' % a.quality
if entries:
    body = 'var TL_ASSETS = {\n' + ',\n'.join("  %s: 'data:image/webp;base64,%s'" % (n, b) for n, b in entries) + '\n};\n'
else:
    body = 'var TL_ASSETS = {};\n'
with open(a.out, 'w', encoding='utf-8') as fp:
    fp.write(head + body)
print('共 %d 張：PNG %.1f KB → WebP %.1f KB；%s = %.1f KB（base64 後）' % (len(entries), total_png / 1024, total_webp / 1024, a.out, os.path.getsize(a.out) / 1024))
