/**
 * tools/check-buttons.js
 * Script tự động kiểm tra và chuẩn hóa thuộc tính type="button" trên tất cả thẻ <button>
 * 
 * Cách dùng:
 *   node tools/check-buttons.js          -> Kiểm tra và xuất báo cáo
 *   node tools/check-buttons.js --fix    -> Tự động bổ sung type="button" vào các thẻ thiếu
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const isFixMode = process.argv.includes('--fix');

const targetDirs = ['js', 'css'];
const directFiles = ['index.html'];

function collectFiles() {
  const files = [];
  targetDirs.forEach(dir => {
    const dirPath = path.join(ROOT_DIR, dir);
    if (!fs.existsSync(dirPath)) return;
    fs.readdirSync(dirPath).forEach(f => {
      if (f.endsWith('.js') || f.endsWith('.html')) {
        files.push(path.join(dirPath, f));
      }
    });
  });
  directFiles.forEach(f => {
    const full = path.join(ROOT_DIR, f);
    if (fs.existsSync(full)) files.push(full);
  });
  return files;
}

function auditButtons() {
  const files = collectFiles();
  let totalButtons = 0;
  let missingCount = 0;
  let fixedCount = 0;
  const violations = [];

  files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let fileChanged = false;
    let lineIdx = 0;

    // Pattern tìm thẻ mở <button ...>
    // Kiểm tra xem đã có type="button" | type="submit" | type="reset" chưa
    const updatedContent = content.replace(/<button\b([^>]*)>/gi, (match, attrs) => {
      totalButtons++;
      const hasType = /\btype\s*=\s*['"][^'"]+['"]/i.test(attrs);
      if (hasType) {
        return match;
      }

      missingCount++;
      violations.push({
        file: path.relative(ROOT_DIR, filePath),
        rawTag: match
      });

      if (isFixMode) {
        fileChanged = true;
        fixedCount++;
        // Thêm type="button" ngay sau <button
        return `<button type="button"${attrs}>`;
      }
      return match;
    });

    if (isFixMode && fileChanged) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
    }
  });

  console.log('\n======================================================');
  console.log('   BÁO CÁO KIỂM TRA THUỘC TÍNH type="button" TRÊN <button>');
  console.log('======================================================');
  console.log(`- Tổng số thẻ <button> được quét: ${totalButtons}`);
  console.log(`- Số thẻ thiếu type="button":      ${missingCount}`);
  if (isFixMode) {
    console.log(`- Số thẻ đã tự động chuẩn hóa:   ${fixedCount}`);
    console.log('=> ĐÃ CẬP NHẬT THÀNH CÔNG VÀO CÁC FILE NGUỒN!');
  } else {
    console.log(`=> Hãy chạy 'node tools/check-buttons.js --fix' để tự động sửa!`);
  }
  console.log('======================================================\n');

  if (!isFixMode && violations.length > 0) {
    const summary = {};
    violations.forEach(v => {
      summary[v.file] = (summary[v.file] || 0) + 1;
    });
    console.table(summary);
  }

  return { totalButtons, missingCount, fixedCount };
}

auditButtons();

