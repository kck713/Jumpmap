// src/ 의 파일을 하나로 합쳐 index.html(단일 파일, 바로 실행 가능)을 만듭니다.
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const shell = src('shell.html');                                   // <title>, <style>, 마크업, 마지막 줄이 <script>
const core = src('core.js').replace(/^if \(typeof module.*$/m, ''); // Node용 export 줄 제거
const ui = src('ui.js');
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>[hidden]{display:none!important}</style>
</head>
<body>
${shell}
${core}
${ui}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('index.html 생성 완료 (' + (html.length / 1024).toFixed(1) + ' KB)');
