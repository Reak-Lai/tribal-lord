# 音效出處（阿斑下樓梯 v1.7）

- 來源：卡斯伯免費音效庫 <https://www.casper.tw/sound-effects/zh-tw/>
- 授權頁：<https://www.casper.tw/sound-effects/zh-tw/license/>（2026-11-21 確認：可商用、可放遊戲，出處非必要；不可重新包裝成音效包、不可訓練 AI、不可登記 Content ID）
- 下載日期：2026-11-21
- 音檔直接用原始 MP3，沒有剪輯、沒有轉檔。只在遊戲內使用（內嵌在 index.html 裡），不另外提供下載。

## 音檔不在 repo 裡

為了授權保險，12 個 mp3 不放進這個公開 repo（`.gitignore` 排除 `src/sfx/*.mp3`），只內嵌在打包好的 `index.html` 裡。
自己從原始碼打包（`node build.js`）的話，先從下表的原始網址把音檔重新下載到 `src/sfx/`，檔名改成表中「遊戲裡的檔名」（例如 `src/sfx/fall.mp3`），不要剪輯或轉檔。
例：`curl -L -o src/sfx/fall.mp3 https://sound-effects.casper.tw/audio/stone-dropped-deep-well-distant-plop.5c52a429.mp3`

| 遊戲裡的檔名 | 事件 | 原始網址 |
|---|---|---|
| fall.mp3 | 落下 | https://sound-effects.casper.tw/audio/stone-dropped-deep-well-distant-plop.5c52a429.mp3 |
| fire.mp3 | 吐火 | https://sound-effects.casper.tw/audio/fire-dragon-breath.533b88f5.mp3 |
| ceiling-hurt.mp3 | 頂刺受傷 | https://sound-effects.casper.tw/audio/retro-damage-blip.d6b2df24.mp3 |
| land.mp3 | 著地 | https://sound-effects.casper.tw/audio/arcade-jump-land.5387a480.mp3 |
| spike-hurt.mp3 | 釘板受傷（著火平台也用） | https://sound-effects.casper.tw/audio/doink-toy-mallet-hollow.8cbb9b96.mp3 |
| spring.mp3 | 彈簧 | https://sound-effects.casper.tw/audio/arcade-jump-springy.113f9fb0.mp3 |
| heal.mp3 | 回血 | https://sound-effects.casper.tw/audio/magic-heal-harp.d71651d0.mp3 |
| dragon-in.mp3 | 火龍出場 | https://sound-effects.casper.tw/audio/dragon-leathery-wingbeat.3597f393.mp3 |
| floor100.mp3 | 100 層祝賀 | https://sound-effects.casper.tw/audio/fanfare-horn-sting.b480f8ac.mp3 |
| record.mp3 | 新紀錄 | https://sound-effects.casper.tw/audio/quiz-correct-dingdong.552455cb.mp3 |
| gameover.mp3 | 遊戲結束 | https://sound-effects.casper.tw/audio/life-lost-short-cartoon-fail-tones.23c6ff4b.mp3 |
| click.mp3 | 按鈕點擊 | https://sound-effects.casper.tw/audio/ui-click-crisp.a663dfec.mp3 |
