'use strict';
/* Đồng bộ bản build web (quan-ly-kho.html) vào gói desktop trước khi chạy / đóng gói.
   Dùng: node sync.js  (tự chạy qua các script npm "start" và "dist:*") */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'quan-ly-kho.html');
const dst = path.join(__dirname, 'app.html');

if (!fs.existsSync(src)) {
  console.error('❌ Không tìm thấy ' + src);
  console.error('   Hãy chạy "python3 build.py" ở thư mục gốc để tạo quan-ly-kho.html trước.');
  process.exit(1);
}
fs.copyFileSync(src, dst);
const kb = Math.round(fs.statSync(dst).size / 1024);
console.log('✅ Đã đồng bộ quan-ly-kho.html → desktop/app.html (' + kb + ' KB)');

/* Giải mã icon từ base64 (icon lưu dạng text trong repo để thân thiện với mọi kênh push) */
const iconB64 = path.join(__dirname, 'build', 'icon.png.b64');
const iconPng = path.join(__dirname, 'build', 'icon.png');
if (fs.existsSync(iconB64)) {
  fs.writeFileSync(iconPng, Buffer.from(fs.readFileSync(iconB64, 'utf8').trim(), 'base64'));
  console.log('✅ Đã giải mã build/icon.png (' + Math.round(fs.statSync(iconPng).size / 1024) + ' KB)');
} else if (!fs.existsSync(iconPng)) {
  console.warn('⚠️ Thiếu build/icon.png — app sẽ dùng icon Electron mặc định.');
}
