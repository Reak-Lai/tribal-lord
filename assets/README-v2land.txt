demo v2-land.16：assets.js 裡有 3 張試作圖（ter_farm、bld_house、ppl_lumber_m）；其他照舊是程式畫的色塊＋文字標籤。預覽圖在 art-preview/（不打包）。
放圖的方法：把 PNG 放進 v2land-src/art/，執行 python3 pack-assets.py（轉成 WebP、寫進 assets.js；名稱不對或尺寸不對會印出注意），再執行 sh assemble.sh。
有圖的就畫圖，沒有圖的照舊畫色塊。比例 1 du = 2 px。檔名（設計確認，v2-land.8）：
- 地形 ter_farm（農地）/ ter_pasture（牧草地）/ ter_hunt（獵場）/ ter_stone（石坡）：192×192 px（96×96 du）
- 河 ter_river_00 … ter_river_15：192×192 px，autotile。編號＝遮罩：上 1＋右 2＋下 4＋左 8，那一邊的鄰格也是水才加（地圖外面算不是水）。例：只有上下是水 → 05；四邊都是水 → 15。
- 草地沒有圖：程式畫純色。森林＝草地＋樹物件（之後再做擺放；目前森林還是程式畫的深色圓）。
- 樹 obj_tree_0 / obj_tree_1 / obj_tree_2：128×160 px（64×80 du），樹幹底部在圖的底邊中央。目前只認名稱，還沒擺到地圖上。
- 不再使用：ter_grass、ter_forest、ter_river（單張）、ter_meadow（改叫 ter_pasture）、ter_rock（改叫 ter_stone）。
- 建築 bld_<建築內部代碼>：192×240 px（96×120 du），圖的底邊＝格子底邊（建築底部在底邊往上 8 du）。代碼：house lumber lodge fishery field ranch pen mine barracks clinic storage
- 議事廳 bld_council：224×272 px（112×136 du），水平置中，左右各凸出 8 du
- 居民 ppl_<職業>_m / ppl_<職業>_f（沒有分性別時可用 ppl_<職業>）：56×112 px（28×56 du），腳底在底邊中央。職業：lumber hunt fish farm herd stock mine idle soldier hero
- 營火 fire_0 … fire_5：各 192×192 px（96×96 du），8 格／秒循環（一輪 0.75 秒，0→5 再接 0）；有營火圖時不畫石圈和「營火」字
- 圖裡不要畫影子：腳下的淡橢圓影子由程式畫。
單一檔案上限 1.5 MB（build-single.js 會檢查）。
