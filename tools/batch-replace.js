#!/usr/bin/env node
/**
 * ============================================================================
 * tools/batch-replace.js - CÔNG CỤ TÌM KIẾM & THAY THẾ HÀNG LOẠT (BATCH REPLACE)
 * ============================================================================
 * 
 * Tính năng chính:
 * 1. Thay thế tùy chỉnh (Custom Search & Replace):
 *    - Hỗ trợ chuỗi thông thường hoặc Biểu thức chính quy (Regex + Capturing Groups $1, $2).
 *    - Lọc linh hoạt theo đuôi file (--ext "js,html,css") và thư mục (--dir "js,tools").
 *    - Chế độ Dry-Run an toàn: Mặc định CHỈ XEM TRƯỚC các dòng thay đổi, KHÔNG sửa file
 *      trừ khi truyền cờ --write hoặc --fix.
 *    - Tùy chọn sao lưu an toàn (--backup).
 *    - Tự động kiểm tra cú pháp (Syntax Check) qua 'node --check' sau khi sửa file JS.
 * 
 * 2. Bộ quy tắc chuẩn hóa có sẵn (--rule <tên-quy-tắc>):
 *    - fix-button-types : Chuẩn hóa 100% thẻ <button> có thuộc tính type="button".
 *    - fix-dead-links   : Thay thế các thẻ <a href="#"> làm nút sang <button type="button">.
 *    - fix-back-buttons : Chuẩn hóa các nút page-back sang gọi window.goBack().
 *    - bump-versions    : Tự động tăng version cache buster ?v=... trong index.html.
 *    - all-audits       : Chạy liên hoàn toàn bộ các quy tắc trên một lần.
 * 
 * ============================================================================
 * CÁC VÍ DỤ SỬ DỤNG:
 * 
 * 1. Xem trước thay thế (Dry-Run an toàn):
 *    node tools/batch-replace.js -f "openHomeView()" -r "window.goBack()"
 * 
 * 2. Thực hiện ghi đè thay thế vào file nguồn:
 *    node tools/batch-replace.js -f "openHomeView()" -r "window.goBack()" --write
 * 
 * 3. Thay thế bằng Regex (bảo toàn class hoặc text):
 *    node tools/batch-replace.js -e -f "<span class=\"note-chip\"([^>]*)>" -r "<button type=\"button\" class=\"note-chip\"$1>" --write
 * 
 * 4. Chạy quy tắc chuẩn hóa có sẵn:
 *    node tools/batch-replace.js --rule fix-button-types --write
 *    node tools/batch-replace.js --rule fix-dead-links --write
 *    node tools/batch-replace.js --rule fix-back-buttons --write
 *    node tools/batch-replace.js --rule all-audits --write
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

// ============================================================================
// ANSI Color Formatting
// ============================================================================
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

// ============================================================================
// CLI Arguments Parsing
// ============================================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    find: null,
    replace: '',
    isRegex: false,
    flags: 'g',
    exts: ['js', 'html', 'css'],
    dirs: ['js', 'css', 'index.html'],
    excludes: ['node_modules', '.git', '.gemini', 'assets', 'dist', 'build', '.system_generated', 'tools'],
    isWrite: false,
    isBackup: false,
    rule: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-f' || arg === '--find') {
      options.find = args[++i];
    } else if (arg === '-r' || arg === '--replace') {
      options.replace = args[++i] !== undefined ? args[i] : '';
    } else if (arg === '-e' || arg === '--regex') {
      options.isRegex = true;
    } else if (arg === '--flags') {
      options.flags = args[++i];
    } else if (arg === '-w' || arg === '--write' || arg === '--fix') {
      options.isWrite = true;
    } else if (arg === '-n' || arg === '--dry-run') {
      options.isWrite = false;
    } else if (arg === '-b' || arg === '--backup') {
      options.isBackup = true;
    } else if (arg === '-x' || arg === '--ext') {
      options.exts = args[++i].split(',').map(s => s.trim().replace(/^\./, ''));
    } else if (arg === '-d' || arg === '--dir') {
      options.dirs = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--exclude') {
      options.excludes = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--rule') {
      options.rule = args[++i];
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${C.cyan}${C.bold}================================================================================${C.reset}
${C.bold}   ptitngon - BATCH REPLACE CLI (SCRIPT THAY THẾ HÀNG LOẠT TOÀN DỰ ÁN)${C.reset}
${C.cyan}================================================================================${C.reset}

${C.yellow}${C.bold}CÚ PHÁP:${C.reset}
  node tools/batch-replace.js [tùy_chọn]

${C.yellow}${C.bold}TÙY CHỌN TÌM KIẾM & THAY THẾ TÙY CHỌN:${C.reset}
  ${C.green}-f, --find <chuỗi|regex>${C.reset}     Chuỗi hoặc Regex cần tìm kiếm.
  ${C.green}-r, --replace <chuỗi>${C.reset}        Chuỗi thay thế (hỗ trợ $1, $2 nếu dùng regex).
  ${C.green}-e, --regex${C.reset}                  Bật chế độ Regex (mặc định tìm theo chuỗi thường).
  ${C.green}--flags <flags>${C.reset}              Flags cho Regex (mặc định: "g", ví dụ "gi", "gm").
  ${C.green}-w, --write, --fix${C.reset}           Thực hiện ghi đè vào file (mặc định chỉ là Dry-Run).
  ${C.green}-n, --dry-run${C.reset}                Chỉ xem trước các dòng thay đổi, KHÔNG sửa file.
  ${C.green}-b, --backup${C.reset}                 Tạo file sao lưu .bak trước khi ghi đè.
  ${C.green}-x, --ext <ds_đuôi>${C.reset}          Đuôi file cần quét (mặc định: "js,html,css").
  ${C.green}-d, --dir <ds_thư_mục>${C.reset}       Thư mục cần quét (mặc định: "js,css,tools,.").

${C.yellow}${C.bold}BỘ QUY TẮC CHUẨN HÓA CÓ SẴN (--rule):${C.reset}
  ${C.magenta}--rule fix-button-types${C.reset}      Bổ sung type="button" cho 100% thẻ <button> bị thiếu.
  ${C.magenta}--rule fix-dead-links${C.reset}        Đổi các thẻ <a href="#"> làm nút sang <button type="button">.
  ${C.magenta}--rule fix-back-buttons${C.reset}      Chuẩn hóa các nút quay lại sang onclick="window.goBack()".
  ${C.magenta}--rule bump-versions${C.reset}         Tự động tăng version cache buster ?v=... trong index.html.
  ${C.magenta}--rule all-audits${C.reset}            Thực hiện toàn bộ các quy tắc chuẩn hóa trên.

${C.yellow}${C.bold}VÍ DỤ THỰC TẾ:${C.reset}
  # 1. Xem trước thay thế chữ 'openHomeView()' thành 'window.goBack()' trong các file js
  node tools/batch-replace.js -f "openHomeView()" -r "window.goBack()"

  # 2. Thực hiện ghi đè chính thức:
  node tools/batch-replace.js -f "openHomeView()" -r "window.goBack()" --write

  # 3. Chạy quy tắc chuẩn hóa tự động:
  node tools/batch-replace.js --rule fix-button-types --write
`);
}

// ============================================================================
// File Discovery
// ============================================================================
function collectTargetFiles(options) {
  const fileSet = new Set();
  const exts = new Set(options.exts.map(e => '.' + e.toLowerCase()));
  const excludeSet = new Set(options.excludes.map(e => e.toLowerCase()));

  function scanDir(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const baseName = path.basename(currentDir).toLowerCase();
    if (excludeSet.has(baseName)) return;

    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const ent of entries) {
      const fullPath = path.join(currentDir, ent.name);
      const entNameLower = ent.name.toLowerCase();

      if (excludeSet.has(entNameLower)) continue;

      if (ent.isDirectory()) {
        scanDir(fullPath);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (exts.has(ext)) {
          fileSet.add(fullPath);
        }
      }
    }
  }

  for (const dir of options.dirs) {
    const fullDir = path.resolve(ROOT_DIR, dir);
    if (!fs.existsSync(fullDir)) continue;
    const stat = fs.statSync(fullDir);
    if (stat.isDirectory()) {
      scanDir(fullDir);
    } else if (stat.isFile()) {
      const ext = path.extname(fullDir).toLowerCase();
      if (exts.has(ext)) fileSet.add(fullDir);
    }
  }

  return Array.from(fileSet);
}

// ============================================================================
// Core Batch Replacement Engine
// ============================================================================
function performBatchReplace(files, matcher, replacer, options) {
  let totalFilesScanned = files.length;
  let modifiedFilesCount = 0;
  let totalMatchesCount = 0;
  const changeReport = [];

  for (const filePath of files) {
    let originalText = '';
    try {
      originalText = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.warn(`${C.yellow}Không thể đọc file:${C.reset} ${filePath} (${err.message})`);
      continue;
    }

    // Kiểm tra có match không
    let matchesInFile = 0;
    if (matcher instanceof RegExp) {
      const clonedRegex = new RegExp(matcher.source, matcher.flags);
      const matches = originalText.match(clonedRegex);
      matchesInFile = matches ? matches.length : 0;
    } else {
      let idx = 0;
      while ((idx = originalText.indexOf(matcher, idx)) !== -1) {
        matchesInFile++;
        idx += matcher.length;
      }
    }

    if (matchesInFile === 0) continue;

    // Thực hiện thay thế
    let newText = '';
    if (typeof replacer === 'function') {
      newText = originalText.replace(matcher, replacer);
    } else if (matcher instanceof RegExp) {
      newText = originalText.replace(matcher, replacer);
    } else {
      newText = originalText.split(matcher).join(replacer);
    }

    if (newText === originalText) continue;

    modifiedFilesCount++;
    totalMatchesCount += matchesInFile;

    const relPath = path.relative(ROOT_DIR, filePath);
    changeReport.push({
      filePath,
      relPath,
      matchesInFile,
      originalText,
      newText
    });

    // Nếu ở chế độ ghi đè
    if (options.isWrite) {
      if (options.isBackup) {
        fs.writeFileSync(filePath + '.bak', originalText, 'utf8');
      }
      fs.writeFileSync(filePath, newText, 'utf8');
    }
  }

  return {
    totalFilesScanned,
    modifiedFilesCount,
    totalMatchesCount,
    changeReport
  };
}

// ============================================================================
// Diff Line Viewer
// ============================================================================
function printDiffPreview(reportItem, maxDiffLines = 4) {
  const oldLines = reportItem.originalText.split('\n');
  const newLines = reportItem.newText.split('\n');

  console.log(`\n${C.cyan}${C.bold}File:${C.reset} ${C.bold}${reportItem.relPath}${C.reset} ${C.gray}(${reportItem.matchesInFile} chỗ khớp)${C.reset}`);

  let shown = 0;
  const len = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < len; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o !== n) {
      shown++;
      if (shown <= maxDiffLines) {
        console.log(`  ${C.gray}Dòng ${i + 1}:${C.reset}`);
        if (o !== undefined) console.log(`    ${C.red}- ${o.trim()}${C.reset}`);
        if (n !== undefined) console.log(`    ${C.green}+ ${n.trim()}${C.reset}`);
      }
    }
  }

  if (shown > maxDiffLines) {
    console.log(`    ${C.gray}... và ${shown - maxDiffLines} dòng thay đổi khác trong file này.${C.reset}`);
  }
}

// ============================================================================
// Built-in Rules Execution
// ============================================================================
function executeRule(ruleName, options) {
  const files = collectTargetFiles(options);
  console.log(`\n${C.cyan}${C.bold}--- THỰC THI QUY TẮC CHUẨN HÓA: "${ruleName.toUpperCase()}" ---${C.reset}`);

  if (ruleName === 'fix-button-types') {
    // Tìm thẻ <button ...> thiếu type="..."
    const buttonRegex = /<button\b([^>]*)>/gi;
    const matcher = buttonRegex;
    const replacer = (fullMatch, attrs) => {
      const hasType = /\btype\s*=\s*['"][^'"]+['"]/i.test(attrs);
      if (hasType) return fullMatch;
      return `<button type="button"${attrs}>`;
    };
    return performBatchReplace(files, matcher, replacer, options);
  }

  if (ruleName === 'fix-dead-links') {
    // Tìm thẻ <a href="#" ...> hoặc <a href="javascript:void(0)" ...>
    const linkRegex = /<a\b([^>]*\bhref\s*=\s*['"](?:#|javascript:void\(0\);?)['"][^>]*)>(.*?)<\/a>/gis;
    const replacer = (fullMatch, attrs, innerHtml) => {
      // Bỏ thuộc tính href
      let cleanAttrs = attrs.replace(/\bhref\s*=\s*['"][^'"]+['"]/gi, '').trim();
      return `<button type="button"${cleanAttrs ? ' ' + cleanAttrs : ''}>${innerHtml}</button>`;
    };
    return performBatchReplace(files, linkRegex, replacer, options);
  }

  if (ruleName === 'fix-back-buttons') {
    // Chuẩn hóa các nút back chi tiết (mặt hàng, an toàn thực phẩm) sang window.goBack()
    const matcher = /(<button\b[^>]*class\s*=\s*['"][^'"]*page-back-icon-btn[^'"]*['"][^>]*)\bonclick\s*=\s*['"](?:goBackFromDishDetail|backToProductDetailView)\(\)['"]/gi;
    const replacer = (fullMatch, prefix) => {
      return `${prefix}onclick="window.goBack()"`;
    };
    return performBatchReplace(files, matcher, replacer, options);
  }

  if (ruleName === 'bump-versions') {
    const indexPath = path.resolve(ROOT_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) {
      console.log(`${C.yellow}Không tìm thấy index.html để tăng version.${C.reset}`);
      return null;
    }
    let content = fs.readFileSync(indexPath, 'utf8');
    let bumpCount = 0;
    const updated = content.replace(/(<script\b[^>]*src\s*=\s*['"])([^'"]+)\?v=([0-9]+)\.([0-9]+)(['"][^>]*><\/script>)/gi, (match, p1, file, major, minor, p3) => {
      bumpCount++;
      const nextMinor = parseInt(minor, 10) + 1;
      return `${p1}${file}?v=${major}.${nextMinor}${p3}`;
    });

    if (options.isWrite) {
      fs.writeFileSync(indexPath, updated, 'utf8');
    }

    return {
      totalFilesScanned: 1,
      modifiedFilesCount: bumpCount > 0 ? 1 : 0,
      totalMatchesCount: bumpCount,
      changeReport: [{
        filePath: indexPath,
        relPath: 'index.html',
        matchesInFile: bumpCount,
        originalText: content,
        newText: updated
      }]
    };
  }

  if (ruleName === 'all-audits') {
    const subRules = ['fix-button-types', 'fix-dead-links', 'fix-back-buttons', 'bump-versions'];
    let totalScanned = 0;
    let totalModified = 0;
    let totalMatches = 0;
    for (const r of subRules) {
      const res = executeRule(r, options);
      if (res) {
        totalScanned = Math.max(totalScanned, res.totalFilesScanned);
        totalModified += res.modifiedFilesCount;
        totalMatches += res.totalMatchesCount;
        for (const item of res.changeReport) {
          printDiffPreview(item);
        }
      }
    }
    return {
      totalFilesScanned: totalScanned,
      modifiedFilesCount: totalModified,
      totalMatchesCount: totalMatches,
      changeReport: []
    };
  }

  console.error(`${C.red}Lỗi: Không nhận diện được quy tắc "${ruleName}".${C.reset}`);
  console.log(`Các quy tắc hỗ trợ: fix-button-types, fix-dead-links, fix-back-buttons, bump-versions, all-audits`);
  return null;
}

// ============================================================================
// Post-check Syntax Validator for JS Files
// ============================================================================
function runPostSyntaxCheck(changeReport) {
  const jsFiles = changeReport.filter(r => r.filePath.endsWith('.js'));
  if (jsFiles.length === 0) return true;

  console.log(`\n${C.cyan}${C.bold}--- KIỂM TRA CÚ PHÁP TỰ ĐỘNG (NODE --CHECK) ---${C.reset}`);
  let allPass = true;

  for (const item of jsFiles) {
    try {
      execSync(`node --check "${item.filePath}"`, { stdio: 'pipe' });
      console.log(`  ${C.green}✔ Hợp lệ:${C.reset} ${item.relPath}`);
    } catch (err) {
      allPass = false;
      console.error(`  ${C.red}✖ LỖI CÚ PHÁP:${C.reset} ${item.relPath}`);
      console.error(`    ${C.red}${err.message.trim()}${C.reset}`);
    }
  }

  return allPass;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
function main() {
  const options = parseArgs();

  if (options.help || (!options.find && !options.rule)) {
    showHelp();
    process.exit(0);
  }

  console.log(`\n${C.cyan}${C.bold}================================================================================${C.reset}`);
  console.log(`${C.bold}   ptitngon - BATCH REPLACE ENGINE (CHẠY THAY THẾ HÀNG LOẠT)${C.reset}`);
  console.log(`${C.cyan}================================================================================${C.reset}`);

  if (!options.isWrite) {
    console.log(`${C.yellow}${C.bold}[CHẾ ĐỘ AN TOÀN - DRY RUN]:${C.reset} ${C.yellow}Chỉ quét và xem trước, KHÔNG thay đổi file.${C.reset}`);
    console.log(`${C.gray}Thêm cờ ${C.bold}--write${C.reset}${C.gray} hoặc ${C.bold}--fix${C.reset}${C.gray} vào lệnh để thực sự ghi đè lên file.${C.reset}\n`);
  } else {
    console.log(`${C.green}${C.bold}[CHẾ ĐỘ GHI ĐÈ CHÍNH THỨC]:${C.reset} ${C.green}Đang áp dụng thay đổi vào các file nguồn...${C.reset}\n`);
  }

  let result = null;

  if (options.rule) {
    result = executeRule(options.rule, options);
  } else {
    // Custom find & replace
    let matcher = options.find;
    if (options.isRegex) {
      try {
        matcher = new RegExp(options.find, options.flags);
      } catch (err) {
        console.error(`${C.red}Lỗi định dạng Regular Expression:${C.reset} ${err.message}`);
        process.exit(1);
      }
    }

    const files = collectTargetFiles(options);
    result = performBatchReplace(files, matcher, options.replace, options);
  }

  if (result && Array.isArray(result.changeReport) && result.changeReport.length > 0) {
    for (const item of result.changeReport) {
      printDiffPreview(item);
    }
  }

  if (!result) {
    process.exit(1);
  }

  console.log(`\n${C.cyan}${C.bold}================================================================================${C.reset}`);
  console.log(`${C.bold}   TỔNG KẾT KẾT QUẢ BATCH REPLACE:${C.reset}`);
  console.log(`${C.cyan}================================================================================${C.reset}`);
  console.log(`- Tổng số file đã quét:        ${result.totalFilesScanned}`);
  console.log(`- Số file có thay đổi:         ${C.bold}${result.modifiedFilesCount}${C.reset}`);
  console.log(`- Tổng số vị trí đã thay thế:  ${C.bold}${result.totalMatchesCount}${C.reset}`);

  if (options.isWrite && result.modifiedFilesCount > 0) {
    console.log(`\n${C.green}${C.bold}✔ ĐÃ GHI ĐÈ THÀNH CÔNG VÀO TẤT CẢ FILE NGUỒN!${C.reset}`);
    if (result.changeReport.length > 0) {
      runPostSyntaxCheck(result.changeReport);
    }
  } else if (!options.isWrite && result.modifiedFilesCount > 0) {
    console.log(`\n${C.yellow}👉 Để áp dụng các thay đổi trên, hãy chạy lại lệnh kèm cờ: ${C.bold}--write${C.reset}`);
  } else {
    console.log(`\n${C.green}✔ Không tìm thấy nội dung nào cần thay thế (Codebase đã hoàn toàn sạch sẽ).${C.reset}`);
  }

  console.log(`${C.cyan}================================================================================\n${C.reset}`);
}

main();
