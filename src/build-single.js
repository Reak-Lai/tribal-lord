// 橫式 v2：把 index.html + style.css + assets.js + game.js 合成單一檔案 tribal-lord-mobile.html（美術圖由 assets.js 以 data URL 內嵌，單檔上限 1.5 MB）
// v2-land.12：芫荽 Iansui Regular 子集（font/iansui-sub.woff2）換成 woff2 data URL 嵌進 @font-face，並把 SIL OFL 1.1 授權全文放在 <style> 開頭的註解裡
const fs = require('fs');
const D = process.env.TL_OUT || '/workspace/tribal-lord-land/';   // TL_OUT：測試用的暫時輸出資料夾（結尾要有 /）
const FONTDIR = process.env.TL_FONTDIR || '/workspace/v2land-src/font/';
const woff2 = fs.readFileSync(FONTDIR + 'iansui-sub.woff2'), ofl = fs.readFileSync(FONTDIR + 'OFL.txt', 'utf8').replace(/\r/g, '').trim();
if (/\*\/|<\/style/i.test(ofl)) throw new Error('OFL.txt 含 */ 或 </style，不能放進 CSS 註解');
const FONT_URL = 'url("font/iansui-sub.woff2")';
let css0 = fs.readFileSync(D + 'style.css', 'utf8');
if (css0.split(FONT_URL).length !== 2) throw new Error('style.css 找不到唯一的 ' + FONT_URL);
const css = '/* 字型：芫荽 Iansui Regular（子集，' + woff2.length + ' bytes woff2，以 data URL 內嵌）\n' + ofl + '\n*/\n' +
  css0.replace(FONT_URL, () => 'url("data:font/woff2;base64,' + woff2.toString('base64') + '")'),
  js = fs.readFileSync(D + 'game.js', 'utf8'), as = fs.readFileSync(D + 'assets.js', 'utf8');
for (const [n, s] of [['game.js', js], ['assets.js', as]]) if (/<\/script/i.test(s)) throw new Error(n + ' 含 </script，無法直接內嵌');
let html = fs.readFileSync(D + 'index.html', 'utf8')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + css + '</style>')
  .replace('<script src="assets.js"></script>', () => '<script>\n' + as + '</script>')
  .replace('<script src="game.js"></script>', () => '<script>\n' + js + '</script>');
if (/href="style.css"|src="game.js"|src="assets.js"/.test(html)) throw new Error('替換失敗');
fs.writeFileSync(D + 'tribal-lord-mobile.html', html);
const size = fs.statSync(D + 'tribal-lord-mobile.html').size;
console.log('wrote', D + 'tribal-lord-mobile.html', (size / 1024).toFixed(1) + ' KB');
if (size >= 1.5 * 1024 * 1024) throw new Error('單檔超過 1.5 MB');
