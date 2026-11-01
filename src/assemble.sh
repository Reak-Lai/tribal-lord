#!/bin/sh
# 橫式 v2 組裝：v2land-src → /workspace/tribal-lord-land（不碰 v1a.3 的 /workspace/tribal-lord）
set -e
S=/workspace/v2land-src D=/workspace/tribal-lord-land
mkdir -p $D/assets
cat $S/part1.js $S/part2.js $S/part3.js > $D/game.js
node -e "new Function(require('fs').readFileSync('$D/game.js','utf8'))"
cp $S/style.css $S/index.html $S/assets.js $D/
mkdir -p $D/font && cp $S/font/iansui-sub.woff2 $S/font/OFL.txt $D/font/   # 多檔版用（單檔版把字型內嵌）
cp $S/assets-README.txt $D/assets/README.txt
node $S/build-single.js
