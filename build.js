// 把 src/ 的三個檔合成一個 dist/index.html（file:// 直接開）；v1.7：src/sfx/ 的 12 個 mp3 原檔以 base64 內嵌（不轉檔）
const fs = require('fs'), path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const SFX = ['fall', 'fire', 'ceiling-hurt', 'land', 'spike-hurt', 'spring', 'heal', 'dragon-in', 'floor100', 'record', 'gameover', 'click'];
const sfx = '{' + SFX.map(n => JSON.stringify(n) + ':"' + fs.readFileSync(path.join(__dirname, 'src', 'sfx', n + '.mp3')).toString('base64') + '"').join(',') + '}';
const js = src('game.js');
if (js.split('const SFX_DATA = null;').length !== 2) throw new Error('SFX_DATA marker');
const html = src('index.html')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + src('style.css') + '</style>')
  .replace('<script src="game.js"></script>', () => '<script>\n' + js.replace('const SFX_DATA = null;', () => 'const SFX_DATA = ' + sfx + ';').replace(/<\/script/gi, '<\\/script') + '</script>');
if (html.includes('href="style.css"') || html.includes('src="game.js"')) throw new Error('inline failed');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
console.log('dist/index.html', html.length, 'bytes');
