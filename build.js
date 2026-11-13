// 把 src/ 的三個檔合成一個 index.html（file:// 直接開）
const fs = require('fs'), path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const html = src('index.html')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + src('style.css') + '</style>')
  .replace('<script src="game.js"></script>', () => '<script>\n' + src('game.js').replace(/<\/script/gi, '<\\/script') + '</script>');
if (html.includes('href="style.css"') || html.includes('src="game.js"')) throw new Error('inline failed');
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', html.length, 'bytes');
