/* ==========================================================================
   ptitngon - Database Manager Core (js/db-manager-core.js)
   Lớp dữ liệu mở rộng cho trình Quản lý Cơ sở dữ liệu:
   - Mặt hàng: tag, đánh giá, đã bán, mã giảm giá áp dụng, dinh dưỡng, nguyên liệu
   - Cửa hàng / địa điểm, Danh mục (thủ công hoặc theo TAG, ẩn/hiện trên trang chủ)
   - Sổ mã giảm giá (voucher) dùng chung cho Giỏ hàng / Thanh toán
   - Thư viện ảnh (thả ảnh, gắn 1 ảnh cho nhiều mặt hàng)
   Tải SAU database.js, app.js, catalog-profile.js, dish-detail.js.
   ========================================================================== */

const DBM_PREFS_KEY = 'ptitngon_dbm_prefs_v1';

const DBM_DEFAULT_VOUCHERS = [
  { code: 'PTITNGON50', title: 'Giảm 50% tối đa 50K', desc: 'Đặc quyền PTITer - Giảm 50% tối đa 50K', type: 'percent', value: 50, maxDiscount: 50000, minOrder: 0, scope: 'all', active: true, aliases: ['VIETFOOD50'], icon: 'giftRegular' },
  { code: 'PTITNGON10', title: 'Giảm 10% tổng đơn', desc: 'Ưu đãi PTITer - Giảm 10% tổng đơn', type: 'percent', value: 10, maxDiscount: 0, minOrder: 0, scope: 'all', active: true, aliases: ['VIETFOOD10'], icon: 'tagRegular' },
  { code: 'HUNGCHIENGION', title: 'Giảm 50.000đ đặc quyền Hùng Chiên Giòn', desc: 'Đặc quyền Hùng Chiên Giòn - Giảm 50.000đ', type: 'fixed', value: 50000, maxDiscount: 0, minOrder: 50000, scope: 'all', active: true, aliases: ['HUNGCHENGION'], icon: 'flameRegular' },
  { code: 'FREESHIP', title: 'Miễn phí vận chuyển 15K', desc: 'Miễn phí vận chuyển tối đa 15.000đ', type: 'freeship', value: 15000, maxDiscount: 0, minOrder: 0, scope: 'all', active: true, aliases: [], icon: 'truckRegular' },
  { code: 'MONCAY15K', title: 'Giảm 15K cho Món Cay & Chiên Giòn', desc: 'Giảm 15.000đ áp dụng riêng cho các món cay & chiên giòn', type: 'fixed', value: 15000, maxDiscount: 0, minOrder: 40000, scope: 'selected', active: true, aliases: [], icon: 'flameRegular' },
  { code: 'HEALTHY20', title: 'Giảm 20% tối đa 25K Món Healthy', desc: 'Ưu đãi 20% (tối đa 25K) cho thực đơn Healthy & Thanh đạm', type: 'percent', value: 20, maxDiscount: 25000, minOrder: 30000, scope: 'selected', active: true, aliases: [], icon: 'sparkleRegular' },
  { code: 'TRASUA10K', title: 'Giảm 10K Trà Sữa, Cà Phê & Chè', desc: 'Giảm 10.000đ áp dụng cho nhóm Đồ uống & Tráng miệng', type: 'fixed', value: 10000, maxDiscount: 0, minOrder: 25000, scope: 'selected', active: true, aliases: [], icon: 'giftRegular' }
];

const DBM_BASE_SHIPPING_FEE = 15000;
const DBM_FREE_SHIPPING_THRESHOLD = 150000;

// ─────────────────────────────────────────────────────────────────────────
// Tiện ích chung
// ─────────────────────────────────────────────────────────────────────────

function dbmNormText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function dbmLoadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(DBM_PREFS_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

function dbmSavePrefs(patch) {
  const next = { ...dbmLoadPrefs(), ...patch };
  try { localStorage.setItem(DBM_PREFS_KEY, JSON.stringify(next)); } catch (_) { }
  return next;
}

// "Cay, ăn vặt  #Chiên giòn" -> ['cay','ăn vặt','chiên giòn']
function dbmParseTags(input) {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[,;\n]+/);
  const seen = new Set();
  const out = [];
  raw.forEach(t => {
    const clean = String(t || '').replace(/['"`\\<>]/g, '').replace(/^#+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!clean || clean.length > 32 || seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  });
  return out.slice(0, 16);
}

function dbmHash(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Ảnh tạm (SVG) khi chưa có ảnh thật: người dùng thả ảnh vào sau
function dbmMakePlaceholderImage(emoji, name) {
  const hues = [152, 24, 205, 340, 45, 270, 190, 10];
  const h = hues[dbmHash(name) % hues.length];
  const label = String(name || '').slice(0, 26).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="hsl(${h},85%,92%)"/><stop offset="1" stop-color="hsl(${(h + 40) % 360},80%,80%)"/>`
    + `</linearGradient></defs><rect width="640" height="480" fill="url(#g)"/>`
    + `<text x="320" y="250" font-size="150" text-anchor="middle">${emoji || '🍽️'}</text>`
    + `<text x="320" y="400" font-size="30" font-family="sans-serif" font-weight="700" fill="rgba(0,0,0,0.45)" text-anchor="middle">${label}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function dbmIsPlaceholderImage(item) {
  if (!item) return false;
  return item.imageIsPlaceholder === true || String(item.image || '').startsWith('data:image/svg+xml');
}

const DBM_TAG_KEYWORDS = [
  [/cay|sa tế|kim chi|hỏa ngục|tứ xuyên/i, 'cay'],
  [/chiên|rán|giòn|tempura|xèo|khoai tây/i, 'chiên giòn'],
  [/trà sữa|trà|matcha|sinh tố|nước ép|nước|soda|cacao|smoothie/i, 'đồ uống'],
  [/cà phê|coffee|cafe|bạc xỉu/i, 'cà phê'],
  [/bún|phở|miến|mì |hủ tiếu|cháo|lẩu|bánh canh|súp/i, 'món nước'],
  [/cơm|xôi|bánh mì|burger|sandwich|pizza|cuốn/i, 'no bụng'],
  [/chay|salad|rau|gỏi|healthy|yến mạch|ức gà/i, 'healthy'],
  [/chè|kem|bánh ngọt|bánh flan|tráng miệng|pudding|sữa chua/i, 'tráng miệng'],
  [/xiên|bánh tráng|snack|ăn vặt|nem chua|há cảo|bắp|cá viên/i, 'ăn vặt']
];

function dbmInferTags(item) {
  const hay = `${item.name || ''} ${item.category || ''} ${item.description || ''}`;
  const tags = [];
  DBM_TAG_KEYWORDS.forEach(([re, tag]) => { if (re.test(hay) && !tags.includes(tag)) tags.push(tag); });
  return tags.slice(0, 4);
}

function dbmToNumberOrNull(v, { min = -Infinity, max = Infinity, int = false } = {}) {
  if (v === '' || v === null || v === undefined) return null;
  let n = Number(v);
  if (!Number.isFinite(n)) return null;
  n = Math.min(max, Math.max(min, n));
  return int ? Math.round(n) : n;
}

// ─────────────────────────────────────────────────────────────────────────
// Lưu ảnh: ghi ra file thật qua server (nếu có) hoặc nén thành data URL
// ─────────────────────────────────────────────────────────────────────────

async function dbmPersistImageDataUrl(dataUrl, nameHint = 'image') {
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(String(dataUrl || ''))) return dataUrl;
  if (typeof DB !== 'undefined' && DB.hasBackendApi) {
    try {
      const endpoint = DB.apiBaseUrl ? `${DB.apiBaseUrl}/api/upload-image` : './api/upload-image';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, name: nameHint })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.path) return data.path;
      }
    } catch (_) { /* rơi xuống data URL */ }
  }
  return dataUrl;
}

async function dbmImportImageFile(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('File không phải ảnh');
  const useServer = typeof DB !== 'undefined' && DB.hasBackendApi;
  const dataUrl = await readAndCompressImageFile(file, useServer ? 800 : 560, useServer ? 0.84 : 0.76);
  const src = await dbmPersistImageDataUrl(dataUrl, file.name || 'image');
  return { src, name: (file.name || 'Ảnh').replace(/\.[a-z0-9]+$/i, '') };
}

// Lấy danh sách file ảnh + URL ảnh từ sự kiện kéo thả
function dbmExtractDroppedImages(dataTransfer) {
  const files = Array.from(dataTransfer?.files || []).filter(f => /^image\//.test(fileTypeOrEmpty(f)));
  let urls = [];
  if (files.length === 0 && dataTransfer) {
    const uriList = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain') || '';
    urls = uriList.split(/\r?\n/).map(s => s.trim()).filter(s => /^https?:\/\/\S+$/i.test(s));
  }
  return { files, urls };
}
function fileTypeOrEmpty(f) { return (f && f.type) || ''; }

// ─────────────────────────────────────────────────────────────────────────
// Tìm & tải ảnh Google (#1 / #2 / Top kết quả) qua Server Proxy hoặc Google CSE
// ─────────────────────────────────────────────────────────────────────────

const DBM_CULINARY_RULES = [
  { re: /\bpho bo\b/, vi: 'phở bò tái nạm hà nội', en: 'vietnamese beef pho noodle soup bowl', mealDb: 'Pho', local: 'assets/images/pho_bo_1792459676492.jpg' },
  { re: /\bpho ga\b/, vi: 'phở gà ta nước trong', en: 'vietnamese chicken pho noodle soup', mealDb: 'Pho', local: 'assets/images/pho_bo_1792459676492.jpg' },
  { re: /\bpho\b/, vi: 'phở truyền thống việt nam', en: 'vietnamese pho noodle soup bowl', mealDb: 'Pho', local: 'assets/images/pho_bo_1792459676492.jpg' },
  { re: /\bbun bo\b/, vi: 'bún bò huế giò heo', en: 'bun bo hue spicy beef noodle soup', local: 'assets/images/bun_bo_hue_1792459733043.jpg' },
  { re: /\bbun cha\b|\bbun thit nuong\b/, vi: 'bún chả thịt nướng hà nội', en: 'vietnamese bun cha grilled pork vermicelli', local: 'assets/images/bun_cha_1792459712673.jpg' },
  { re: /\bbun dau\b/, vi: 'bún đậu mắm tôm mẹt đầy đủ', en: 'vietnamese bun dau mam tom fried tofu platter', local: 'assets/images/bun_cha_1792459712673.jpg' },
  { re: /\bbun rieu\b|\bbun ca\b|\bbun hai san\b/, vi: 'bún riêu cua hải sản nóng hổi', en: 'vietnamese crab seafood noodle soup', local: 'assets/images/bun_bo_hue_1792459733043.jpg' },
  { re: /\bmi cay\b/, vi: 'mì cay hải sản bò mỹ hàn quốc', en: 'korean spicy seafood ramen noodles bowl', local: 'assets/images/bun_bo_hue_1792459733043.jpg' },
  { re: /\bmi tron\b|\bmi xao\b|\bramen\b|\budon\b|\bhu tieu\b|\bmien\b/, vi: 'mì trộn xào thập cẩm trứng lòng đào', en: 'asian stir fried noodles egg dish', local: 'assets/images/bun_cha_1792459712673.jpg' },
  { re: /\bmi y\b|\bspaghetti\b|\bpasta\b/, vi: 'mì ý sốt bò bằm phô mai', en: 'spaghetti bolognese pasta plate', mealDb: 'Spaghetti', local: 'assets/images/pizza.jpg' },
  { re: /\bbanh mi\b/, vi: 'bánh mì thịt nướng pate giòn rụm', en: 'vietnamese banh mi crispy baguette sandwich', mealDb: 'Banh Mi', local: 'assets/images/banh_mi_1792459688980.jpg' },
  { re: /\bcom tam\b|\bcom suon\b/, vi: 'cơm tấm sườn bì chả trứng ốp la', en: 'vietnamese broken rice grilled pork chop com tam', local: 'assets/images/com_tam_1792459701659.jpg' },
  { re: /\bcom ga\b|\bcom rang\b|\bcom chien\b|\bcom tron\b|\bbibimbap\b/, vi: 'cơm gà xối mỡ da giòn', en: 'crispy chicken rice plate asian food', local: 'assets/images/com_tam_1792459701659.jpg' },
  { re: /\bgoi cuon\b|\bpho cuon\b|\bnem cuon\b|\bnem nuong\b/, vi: 'gỏi cuốn tôm thịt tươi nước chấm', en: 'vietnamese fresh shrimp spring rolls', local: 'assets/images/goi_cuon_1792459722505.jpg' },
  { re: /\bga ran\b|\bga chien\b|\bcanh ga\b/, vi: 'gà rán sốt cay giòn rụm', en: 'crispy golden korean fried chicken', mealDb: 'Chicken', local: 'assets/images/ga_ran.jpg' },
  { re: /\bxien nuong\b|\bthit xien\b|\bnuong bbq\b|\bdo nuong\b/, vi: 'thịt xiên nướng than hoa đường phố', en: 'grilled bbq meat skewers street food', local: 'assets/images/hung_chien_gion.jpg' },
  { re: /\bnem chua ran\b|\bca vien\b|\bxien ban\b|\bkhoai tay chien\b|\bchien gion\b/, vi: 'đồ ăn vặt xiên que chiên giòn', en: 'crispy fried street food snacks platter', local: 'assets/images/hung_chien_gion.jpg' },
  { re: /\bbanh xeo\b|\bbanh khot\b|\bbanh cuon\b|\bbanh trang\b/, vi: 'bánh xèo tôm thịt vàng giòn rau sống', en: 'vietnamese crispy crepe banh xeo', local: 'assets/images/banh_xeo_1792459745179.jpg' },
  { re: /\btokbokki\b|\bbanh gao\b/, vi: 'bánh gạo cay tokbokki phô mai hàn quốc', en: 'korean spicy tteokbokki cheese rice cakes', local: 'assets/images/hung_chien_gion.jpg' },
  { re: /\bkimbap\b|\bsushi\b/, vi: 'cơm cuộn rong biển sushi kimbap', en: 'sushi kimbap rolls platter', mealDb: 'Sushi', local: 'assets/images/sushi.jpg' },
  { re: /\bpizza\b|\bburger\b|\bhamburger\b|\bbit tet\b|\bbo ne\b|\bsteak\b/, vi: 'bánh pizza phô mai hải sản nóng hổi', en: 'cheesy pizza burger food photography', mealDb: 'Pizza', local: 'assets/images/pizza.jpg' },
  { re: /\bsalad\b|\buc ga\b|\beat clean\b|\bgao lut\b/, vi: 'salad ức gà áp chảo bơ rau xanh eat clean', en: 'healthy grilled chicken avocado salad bowl', mealDb: 'Salad', local: 'assets/images/goi_cuon_1792459722505.jpg' },
  { re: /\blau\b|\bhotpot\b|\bchao\b|\bsup\b|\bxoi\b|\bdimsum\b|\bha cao\b/, vi: 'nồi lẩu thái hải sản chua cay', en: 'asian spicy seafood hotpot soup bowl', local: 'assets/images/bun_bo_hue_1792459733043.jpg' },
  { re: /\btra sua\b|\btran chau\b|\bkem cheese\b|\bmatcha\b|\btra dao\b|\btra chanh\b|\btra trai cay\b/, vi: 'ly trà sữa trân châu đường đen kem phô mai', en: 'brown sugar boba pearl milk tea cup', local: 'assets/images/tra_sua.jpg' },
  { re: /\bca phe\b|\bbac xiu\b|\blatte\b|\bamericano\b/, vi: 'ly cà phê sữa đá phin việt nam', en: 'vietnamese iced condensed milk coffee glass', cocktailDb: 'Coffee', local: 'assets/images/ca_phe.jpg' },
  { re: /\bnuoc ep\b|\bsinh to\b|\bsmoothie\b|\bsua chua\b|\bche\b|\btau hu\b|\bflan\b|\bbanh ngot\b|\btiramisu\b/, vi: 'ly sinh tố chè trái cây tươi mát lạnh', en: 'fresh tropical fruit smoothie dessert bowl', cocktailDb: 'Smoothie', local: 'assets/images/tra_sua.jpg' },
  { re: /\bcom\b/, vi: 'cơm phần món mặn việt nam', en: 'vietnamese savory rice dish plate', local: 'assets/images/com_tam_1792459701659.jpg' }
];

const DBM_IMAGE_SOURCE_LABELS = {
  'pixabay': 'Pixabay HD',
  'pexels': 'Pexels HD',
  'google-cse': 'Google CSE',
  'google': 'Google Ảnh',
  'bing': 'Bing Food',
  'bing-cdn': 'Bing Ảnh Món',
  'duckduckgo': 'DuckDuckGo',
  'openverse': 'Openverse CC',
  'themealdb': 'TheMealDB',
  'thecocktaildb': 'CocktailDB',
  'pollinations': 'AI Food Photo',
  'local': 'Kho nội bộ'
};

function dbmImageSourceLabel(code) {
  return DBM_IMAGE_SOURCE_LABELS[String(code || '').toLowerCase()] || 'Đa nguồn Free';
}

function dbmStripDishPromoNoise(str) {
  return String(str || '')
    .replace(/\s*\(bản sao\)\s*/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(ptit|ha dong|hà đông|ao sen|mo lao|mộ lao|nguyen trai|nguyễn trãi|tran phu|trần phú|ktx|b1|b2|cong truong|cổng trường|sinh vien|sinh viên|gia re|giá rẻ|gia truyen|gia truyền|chinh hieu|chính hiệu|so\s*\d+|số\s*\d+|combo\s*\d*|suat|suất|phan|phần|full topping|freeship|0đ)\b/giu, ' ')
    .replace(/(?:^|\s)(siêu to|khổng lồ|giá sinh viên|cấp độ sinh viên|cấp độ\s*\d+|chuẩn vị|nhà làm|đặc biệt|thượng hạng|nóng hổi|dẻo béo|giòn rụm|size\s*[smlxl]+)(?=\s|$)/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dbmBuildCulinarySearchPlan(name, { suffix = 'món ăn', category = '', extraQuery = '' } = {}) {
  const explicitParts = String(extraQuery || '').split('|').map(s => s.trim()).filter(Boolean);
  const cleanedName = dbmStripDishPromoNoise(name).replace(/\s*\bmón ăn(\s+ngon)?\s*$/iu, '').trim();
  const baseVi = explicitParts[0] || cleanedName || String(name || '').trim() || 'món ăn ngon';
  const explicitEn = explicitParts[1] || '';

  const normBlob = dbmNormText(`${baseVi} ${name} ${category} ${extraQuery}`);
  const rule = DBM_CULINARY_RULES.find(r => r.re.test(normBlob)) || null;
  const cleanSuffix = String(suffix ?? 'món ăn').trim();

  const viQueries = [];
  const enQueries = [];
  const addUnique = (arr, s) => {
    const v = String(s || '').replace(/\s+/g, ' ').trim();
    if (v && !arr.some(x => x.toLowerCase() === v.toLowerCase())) arr.push(v);
  };

  addUnique(viQueries, cleanSuffix && !dbmNormText(baseVi).includes(dbmNormText(cleanSuffix)) ? `${baseVi} ${cleanSuffix}` : baseVi);
  if (rule?.vi) addUnique(viQueries, rule.vi);
  const words = baseVi.split(/\s+/).filter(Boolean);
  if (words.length > 3) addUnique(viQueries, `${words.slice(0, 3).join(' ')} món ăn ngon`);
  if (category) addUnique(viQueries, `${dbmStripDishPromoNoise(category)} món ngon`);

  if (explicitEn) addUnique(enQueries, explicitEn);
  if (rule?.en) addUnique(enQueries, rule.en);
  addUnique(enQueries, `${dbmNormText(words.slice(0, 4).join(' '))} vietnamese food dish`);

  return {
    baseVi,
    primaryQuery: viQueries[0] || baseVi,
    viQueries: viQueries.slice(0, 4),
    enQueries: enQueries.slice(0, 3),
    mealDb: rule?.mealDb || '',
    cocktailDb: rule?.cocktailDb || '',
    localFallback: rule?.local || 'assets/images/hung_chien_gion.jpg'
  };
}

function dbmBuildFoodImageQuery(name, suffix = 'món ăn', category = '', extraQuery = '') {
  return dbmBuildCulinarySearchPlan(name, { suffix, category, extraQuery }).primaryQuery;
}

async function dbmFetchJsonWithTimeout(url, headers = {}, timeoutMs = 5000) {
  if (typeof fetch !== 'function') return null;
  const hasAbort = typeof AbortController === 'function';
  const ctrl = hasAbort ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (_) { } }, timeoutMs) : 0;
  try {
    const res = await fetch(url, { headers, signal: ctrl ? ctrl.signal : undefined });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function dbmSearchBrowserFreeFoodImages(query, {
  limit = 6,
  preferredRank = 1,
  name = '',
  category = '',
  extraQuery = '',
  googleApiKey = '',
  googleCx = '',
  pixabayKey = '',
  pexelsKey = ''
} = {}) {
  const maxItems = Math.max(1, Math.min(10, Number(limit) || 6));
  const plan = dbmBuildCulinarySearchPlan(name || query, { suffix: '', category, extraQuery: extraQuery || query });
  const results = [];
  const seen = new Set();
  let primarySource = '';

  const pushCandidate = item => {
    if (!item?.url || seen.has(item.url)) return;
    seen.add(item.url);
    if (!primarySource && item.provider) primarySource = item.provider;
    results.push(item);
  };

  const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

  if (isOnline) {
    // 1. Pixabay Official Free API (CORS enabled)
    if (pixabayKey) {
      const pData = await dbmFetchJsonWithTimeout(
        `https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey)}&q=${encodeURIComponent(plan.viQueries[0] || plan.baseVi)}&image_type=photo&safesearch=true&per_page=${maxItems + 2}`
      );
      (pData?.hits || []).forEach(h => {
        if (h.webformatURL) {
          pushCandidate({ url: h.webformatURL, thumbUrl: h.previewURL || h.webformatURL, title: h.tags || '', provider: 'pixabay' });
        }
      });
    }

    // 2. Pexels Official Free API (CORS enabled)
    if (pexelsKey && results.length < maxItems) {
      const pxData = await dbmFetchJsonWithTimeout(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(plan.enQueries[0] || plan.baseVi)}&per_page=${maxItems + 2}`,
        { Authorization: pexelsKey }
      );
      (pxData?.photos || []).forEach(p => {
        if (p.src?.large || p.src?.medium) {
          pushCandidate({ url: p.src.large || p.src.medium, thumbUrl: p.src.medium || p.src.small, title: p.alt || '', provider: 'pexels' });
        }
      });
    }

    // 3. Google Custom Search JSON API (CORS enabled)
    if (googleApiKey && googleCx && results.length < maxItems) {
      const gData = await dbmFetchJsonWithTimeout(
        `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleApiKey)}&cx=${encodeURIComponent(googleCx)}&searchType=image&safe=active&num=${Math.min(10, maxItems)}&q=${encodeURIComponent(plan.viQueries[0] || query)}`
      );
      (gData?.items || []).forEach(it => {
        if (it.link && !/wikimedia|wikipedia|svg|\.pdf/i.test(it.link)) {
          pushCandidate({ url: it.link, thumbUrl: it.image?.thumbnailLink || it.link, title: it.title || '', provider: 'google-cse' });
        }
      });
    }

    // 4. TheMealDB / TheCocktailDB Free JSON APIs (CORS *, không cần key)
    if (plan.mealDb && results.length < maxItems) {
      const mData = await dbmFetchJsonWithTimeout(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(plan.mealDb)}`);
      (mData?.meals || []).slice(0, 3).forEach(m => {
        if (m.strMealThumb) pushCandidate({ url: m.strMealThumb, thumbUrl: m.strMealThumb, title: m.strMeal || '', provider: 'themealdb' });
      });
    }
    if (plan.cocktailDb && results.length < maxItems) {
      const cData = await dbmFetchJsonWithTimeout(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(plan.cocktailDb)}`);
      (cData?.drinks || []).slice(0, 3).forEach(d => {
        if (d.strDrinkThumb) pushCandidate({ url: d.strDrinkThumb, thumbUrl: d.strDrinkThumb, title: d.strDrink || '', provider: 'thecocktaildb' });
      });
    }

    // 5. Openverse Official Public REST API (CORS *, không cần key)
    if (results.length < maxItems) {
      const ovData = await dbmFetchJsonWithTimeout(
        `https://api.openverse.org/v1/images/?q=${encodeURIComponent(plan.enQueries[0] || `${plan.baseVi} food`)}&page_size=12`
      );
      (ovData?.results || []).forEach(r => {
        if (results.length >= maxItems) return;
        if (/wikimedia|svg|diagram|logo|icon|book|page/i.test(`${r.source || ''} ${r.title || ''} ${r.url || ''}`)) return;
        if (r.url) pushCandidate({ url: r.url, thumbUrl: r.thumbnail || r.url, title: r.title || '', provider: 'openverse' });
      });
    }

    // 6. Direct Bing Food Image CDN + Pollinations AI (luôn hoạt động trực tiếp trên trình duyệt không cần server/key)
    const directQueries = [...plan.viQueries, ...plan.enQueries, `${plan.baseVi} ẩm thực đường phố`];
    directQueries.forEach((dq, i) => {
      if (results.length >= maxItems - 1) return;
      const hostIdx = (i % 4) + 1;
      const u = `https://tse${hostIdx}.mm.bing.net/th?q=${encodeURIComponent(dq)}&w=640&h=480&c=7&rs=1&p=0`;
      pushCandidate({ url: u, thumbUrl: u, title: dq, provider: 'bing-cdn' });
    });

    if (results.length < maxItems) {
      const aiPrompt = `${plan.enQueries[0] || plan.baseVi}, appetizing vietnamese food photography, natural light`;
      const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(aiPrompt)}?width=640&height=480&nologo=true&seed=${Math.abs(plan.baseVi.length * 137 + 19)}`;
      pushCandidate({ url: aiUrl, thumbUrl: aiUrl, title: `${plan.baseVi} (AI)`, provider: 'pollinations' });
    }
  }

  // 7. Dự phòng khi mất mạng hoàn toàn: ảnh món thật có sẵn trong assets/images/
  if (results.length === 0) {
    pushCandidate({ url: plan.localFallback, thumbUrl: plan.localFallback, title: plan.baseVi, provider: 'local' });
  }

  const ranked = results.slice(0, maxItems).map((it, idx) => ({ ...it, rank: idx + 1 }));
  const idx = Math.max(0, Math.min(ranked.length - 1, (Number(preferredRank) || 1) - 1));
  const picked = ranked[idx] || ranked[0];

  return {
    ok: true,
    source: picked.provider || primarySource || 'bing-cdn',
    query: plan.primaryQuery,
    pickedRank: idx + 1,
    localPath: picked.url,
    originalUrl: picked.url,
    results: ranked
  };
}

async function dbmSearchGoogleImages(query, {
  limit = 6,
  autoDownload = false,
  preferredRank = 1,
  name = '',
  category = '',
  extraQuery = '',
  googleApiKey = '',
  googleCx = '',
  pixabayKey = '',
  pexelsKey = ''
} = {}) {
  const savedAi = dbmLoadPrefs().ai || {};
  const apiKey = googleApiKey || savedAi.googleApiKey || '';
  const cx = googleCx || savedAi.googleCx || '';
  const pxbKey = pixabayKey || savedAi.pixabayKey || '';
  const pxlKey = pexelsKey || savedAi.pexelsKey || '';
  const q = String(query || name || '').trim();
  if (!q) throw new Error('Chưa có tên món hoặc từ khóa để tìm ảnh');

  // 1. Ưu tiên gọi qua Local Server (/api/image-search) để gộp đa nguồn & tự tải file về assets/images/uploads/
  const hasBackend = (typeof DB !== 'undefined' && DB.hasBackendApi);
  if (hasBackend || (typeof location !== 'undefined' && location.protocol !== 'file:')) {
    try {
      const endpoint = (typeof DB !== 'undefined' && DB.apiBaseUrl) ? `${DB.apiBaseUrl}/api/image-search` : './api/image-search';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          category,
          extraQuery,
          limit,
          autoDownload,
          preferredRank,
          name: name || q,
          googleApiKey: apiKey,
          googleCx: cx,
          pixabayKey: pxbKey,
          pexelsKey: pxlKey
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.results) && data.results.length > 0) {
        return data;
      }
    } catch (_) {
      // Nếu mở qua Live Server (:5500) hoặc chưa bật node server.js -> tự chuyển sang tìm trực tiếp trên trình duyệt
    }
  }

  // 2. Tự động tìm trực tiếp trên trình duyệt qua Đa nguồn Miễn Phí (Openverse + MealDB + Bing Food CDN + Pixabay/CSE)
  return dbmSearchBrowserFreeFoodImages(q, {
    limit,
    preferredRank,
    name: name || q,
    category,
    extraQuery,
    googleApiKey: apiKey,
    googleCx: cx,
    pixabayKey: pxbKey,
    pexelsKey: pxlKey
  });
}

const dbmSearchFoodImages = dbmSearchGoogleImages;

async function dbmFetchRemoteImageToLocal(url, fallbackUrl = '', nameHint = 'food') {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) throw new Error('Thiếu đường dẫn ảnh');
  const hasBackend = (typeof DB !== 'undefined' && DB.hasBackendApi);
  if (hasBackend || (typeof location !== 'undefined' && location.protocol !== 'file:')) {
    try {
      const endpoint = (typeof DB !== 'undefined' && DB.apiBaseUrl) ? `${DB.apiBaseUrl}/api/fetch-remote-image` : './api/fetch-remote-image';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl, fallbackUrl, name: nameHint })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && data.path) return data.path;
    } catch (_) { /* rơi về URL trực tiếp hoặc fallbackUrl */ }
  }
  return fallbackUrl || cleanUrl;
}

// ─────────────────────────────────────────────────────────────────────────
// Mở rộng schema database
// ─────────────────────────────────────────────────────────────────────────

function dbmExtendSchema(data) {
  if (!data) return;

  const seed = (typeof window !== 'undefined' && window.__DATABASE_SEED__) ? window.__DATABASE_SEED__ : null;
  const seedItems = new Map((seed?.items || []).map(it => [it.id, it]));
  const seedStores = new Map((seed?.restaurants || []).map(r => [Number(r.id), r]));

  if (!Array.isArray(data.vouchers) || data.vouchers.length === 0) {
    data.vouchers = JSON.parse(JSON.stringify(seed?.vouchers || DBM_DEFAULT_VOUCHERS));
  } else {
    // Bổ sung các mã mặc định mới nếu bản lưu cũ trong localStorage chưa có
    DBM_DEFAULT_VOUCHERS.forEach(def => {
      if (!data.vouchers.some(v => v.code === def.code)) data.vouchers.push(JSON.parse(JSON.stringify(def)));
    });
  }

  if (!Array.isArray(data.imageLibrary)) {
    data.imageLibrary = JSON.parse(JSON.stringify(seed?.imageLibrary || []));
  } else if (data.imageLibrary.length === 0 && seed?.imageLibrary?.length) {
    data.imageLibrary = JSON.parse(JSON.stringify(seed.imageLibrary));
  }

  // Bổ sung các danh mục theo tag mẫu từ seed nếu bản lưu cũ chưa từng có danh mục theo tag
  if (seed?.categories && !(data.categories || []).some(c => c.type === 'tag') && !data.meta?.tagSeedChecked) {
    seed.categories.filter(c => c.type === 'tag').forEach(tc => {
      if (!data.categories.some(c => c.id === tc.id)) data.categories.push(JSON.parse(JSON.stringify(tc)));
    });
    if (data.meta) data.meta.tagSeedChecked = true;
  }

  const seedCats = new Map((seed?.categories || []).map(c => [c.id, c]));
  (data.categories || []).forEach(c => {
    const sc = seedCats.get(c.id);
    if (c.type !== 'tag') c.type = 'manual';
    if (!Array.isArray(c.tagRule)) c.tagRule = [];
    if (c.showAsRestaurantSection === undefined) {
      c.showAsRestaurantSection = sc?.showAsRestaurantSection !== undefined
        ? Boolean(sc.showAsRestaurantSection)
        : (c.type === 'tag');
    }
    if (c.showOnHome === undefined) {
      c.showOnHome = sc?.showOnHome !== undefined ? Boolean(sc.showOnHome) : !c.showAsRestaurantSection;
    }
  });

  const storeAddr = new Map();
  (data.restaurants || []).forEach(r => {
    if (!Array.isArray(r.vouchers)) r.vouchers = [];
    const sr = seedStores.get(Number(r.id));
    if (sr && (!r.address || r.address === 'Khu ẩm thực quanh Học viện PTIT')) r.address = sr.address;
    storeAddr.set(Number(r.id), r.address || 'Khu vực Học viện PTIT');
  });

  (data.items || []).forEach(it => {
    const si = seedItems.get(it.id);
    if (!Array.isArray(it.tags) || it.tags.length === 0) {
      it.tags = si?.tags ? [...si.tags] : dbmInferTags(it);
    }
    if (!Array.isArray(it.vouchers)) {
      it.vouchers = si?.vouchers ? [...si.vouchers] : [];
    }
    if (!it.location) {
      it.location = si?.location || storeAddr.get(Number(it.restaurantId)) || 'Khu vực Học viện PTIT';
    }
    if (si) {
      if (it.rating === undefined) it.rating = si.rating;
      if (it.reviewCount === undefined) it.reviewCount = si.reviewCount;
      if (it.soldCount === undefined) it.soldCount = si.soldCount;
      if (!it.nutrition && si.nutrition) it.nutrition = JSON.parse(JSON.stringify(si.nutrition));
      if (!it.ingredients && si.ingredients) it.ingredients = JSON.parse(JSON.stringify(si.ingredients));
      if (it.healthyScore === undefined && si.healthyScore !== undefined) it.healthyScore = si.healthyScore;
      if (!it.healthyLevel && si.healthyLevel) it.healthyLevel = si.healthyLevel;
    }
    if (it.healthyScore === undefined || !it.healthyLevel) {
      const assessed = dbmComputeHealthyAssessment(it);
      if (it.healthyScore === undefined) it.healthyScore = assessed.healthyScore;
      if (!it.healthyLevel) it.healthyLevel = assessed.healthyLevel;
    }
  });
}

(function dbmWrapDatabaseEngine() {
  if (typeof DB === 'undefined') return;

  const origEnsure = DB._ensureSchemaIntegrity.bind(DB);
  DB._ensureSchemaIntegrity = function () {
    origEnsure();
    dbmExtendSchema(this.data);
  };

  const origSync = DB.syncToGlobals.bind(DB);
  DB.syncToGlobals = function () {
    origSync();
    if (typeof window.dbmAfterSync === 'function') window.dbmAfterSync();
  };

  if (typeof DB.recordOrderForCurrentUser === 'function') {
    const origRecordOrder = DB.recordOrderForCurrentUser.bind(DB);
    DB.recordOrderForCurrentUser = function (newOrder) {
      (newOrder?.items || []).forEach(ci => {
        const item = this.getItemById(ci.dishId || ci.id);
        if (item) item.soldCount = (Number(item.soldCount) || 0) + (Number(ci.quantity) || 1);
      });
      return origRecordOrder(newOrder);
    };
  }
})();

// ─────────────────────────────────────────────────────────────────────────
// Tag & danh mục
// ─────────────────────────────────────────────────────────────────────────

function getHomeCategories() {
  return (Array.isArray(foodCategories) ? foodCategories : []).filter(c => c.showOnHome !== false);
}

function getHomeRestaurantSections() {
  return (Array.isArray(foodCategories) ? foodCategories : []).filter(c => c.showAsRestaurantSection === true);
}

// ── Bộ xáo trộn Fisher–Yates công bằng (không món nào thường xuyên dẫn trước món nào) ──
function dbmGenerateRandomSeed() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return (buf[0] >>> 0) || 1;
    }
  } catch (_) { }
  return ((Math.floor(Math.random() * 0xffffffff) ^ (Date.now() & 0xffffffff)) >>> 0) || 1;
}

let dbmHomeShuffleSeed = dbmGenerateRandomSeed();

function dbmRollHomeShuffleSeed() {
  let next = dbmGenerateRandomSeed();
  if (next === dbmHomeShuffleSeed) next = (next + 0x9e3779b9) >>> 0;
  dbmHomeShuffleSeed = next || 1;
  return dbmHomeShuffleSeed;
}

function dbmHashSalt(str) {
  let h = 2166136261 >>> 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function dbmMulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dbmFairShuffle(list, salt = '') {
  const arr = Array.isArray(list) ? [...list] : [];
  if (arr.length <= 1) return arr;
  const rng = dbmMulberry32((dbmHomeShuffleSeed ^ dbmHashSalt(salt)) >>> 0);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function dbmPickFairDiverseItems(items, maxCount = 12, groupKeyFn = it => it.restaurantId, maxPerGroup = 2, salt = '') {
  const shuffled = dbmFairShuffle(items, salt);
  if (shuffled.length <= maxCount) return shuffled;

  const picked = [];
  const overflow = [];
  const groupCounts = new Map();

  // Duyệt theo thứ tự đã xáo trộn đồng đều -> phần tử đầu tiên có xác suất 1/N hoàn toàn bình đẳng cho mọi món
  for (const it of shuffled) {
    const key = String(groupKeyFn ? groupKeyFn(it) : '');
    const used = groupCounts.get(key) || 0;
    if (used < maxPerGroup) {
      picked.push(it);
      groupCounts.set(key, used + 1);
      if (picked.length >= maxCount) return picked;
    } else {
      overflow.push(it);
    }
  }

  for (const it of overflow) {
    picked.push(it);
    if (picked.length >= maxCount) break;
  }
  return picked;
}

function openDishDetailById(itemId) {
  if (typeof DB === 'undefined' || !DB.isReady) return;
  const item = DB.getItemById(itemId);
  if (!item) return;
  const store = (Array.isArray(restaurants) ? restaurants : []).find(r => Number(r.id) === Number(item.restaurantId))
    || DB.getStoreById(item.restaurantId) || null;
  if (typeof openDishDetailView === 'function') {
    openDishDetailView(item, store);
  } else {
    openSearchView(item.name);
  }
}

function renderHomeCategoryRestaurantSections() {
  if (typeof DB === 'undefined' || !DB.isReady) return '';
  const sectionCats = getHomeRestaurantSections();
  if (!sectionCats.length) return '';
  const allItems = DB.getItems().filter(it => it.inStock !== false);

  return sectionCats.map(cat => {
    const matchedItems = allItems.filter(it =>
      cat.type === 'tag'
        ? dbmItemMatchesTagRule(it, cat.tagRule)
        : (it.categoryId === cat.id || it.category === cat.name)
    );
    if (matchedItems.length === 0) return '';

    // Xáo trộn công bằng toàn bộ món khớp danh mục — không món nào thường dẫn trước món nào
    const displayDishes = dbmPickFairDiverseItems(
      matchedItems,
      12,
      it => it.restaurantId,
      2,
      `cat-res-dishes-${cat.id}`
    );

    const scrollId = `cat-res-scroll-${String(cat.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const kw = escapeHtml(cat.keyword || cat.name);

    const cardsHtml = displayDishes.map(it => {
      const r = (Array.isArray(restaurants) ? restaurants : []).find(s => Number(s.id) === Number(it.restaurantId))
        || DB.getStoreById(it.restaurantId) || {};
      const hInfo = dbmGetItemHealthy(it);
      const scoreNum = Number(hInfo.score) || 0;
      const scoreBadgeClass = scoreNum >= 8.0 ? 'score-high' : (scoreNum >= 6.5 ? 'score-mid' : 'score-low');
      const isDishFav = (typeof it.fav === 'boolean')
        ? it.fav
        : (typeof DB !== 'undefined' && DB.isItemFavorite ? DB.isItemFavorite(it.id) : false);
      const dishIdEsc = escapeHtml(String(it.id));
      return `
        <div class="restaurant-card" role="button" tabindex="0" onclick="openDishDetailById('${dishIdEsc}')">
          <div class="restaurant-card-img-wrapper">
            <img class="restaurant-card-img" data-vt-dish="${dishIdEsc}" src="${escapeHtml(it.image)}" alt="${escapeHtml(it.name)}" loading="lazy" decoding="async" onerror="this.src='assets/images/hung_chien_gion.jpg'">
            <span class="restaurant-card-badge ${scoreBadgeClass}">🥗 ${scoreNum.toFixed(1)}/10 • ${hInfo.badgeLabel || 'Lành mạnh'}</span>
            <button type="button"
              class="restaurant-card-fav ${isDishFav ? 'active' : ''}"
              data-fav-dish-id="${dishIdEsc}"
              onclick="event.stopPropagation(); toggleDishFav('${dishIdEsc}', ${Number(r.id) || 1})"
              title="Lưu món yêu thích"
              aria-label="Lưu món yêu thích"
            >
              ${isDishFav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
            </button>
          </div>
          <div class="restaurant-card-body">
            <div class="restaurant-card-name">${escapeHtml(it.name)}</div>
            <div class="restaurant-card-subdish"><strong class="restaurant-card-price">${formatVND(it.price)}</strong> • 🏪 ${escapeHtml(r.name || it.restaurantName || 'Quán PTIT')}</div>
            <div class="restaurant-card-meta">
              <span class="restaurant-card-rating">${FluentIcons.starFilled} ${Number(it.rating || r.rating || 4.8).toFixed(1)}</span>
              <span class="restaurant-card-dot"></span>
              <span style="display:inline-flex;align-items:center;gap:3px;">${FluentIcons.clockRegular} ${escapeHtml(r.deliveryTime || '15 - 20 phút')}</span>
              <span class="restaurant-card-dot"></span>
              <span style="display:inline-flex;align-items:center;gap:3px;">${FluentIcons.locationRegular} ${escapeHtml(r.distanceText || '0.6 km')}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="restaurants-section category-restaurants-section fade-in">
        <div class="section-head">
          <h2 class="section-title">${cat.icon} ${escapeHtml(cat.name)}</h2>
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="scroll-arrow-controls">
              <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('${scrollId}', -280)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
                ${FluentIcons.chevronLeft}
              </button>
              <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('${scrollId}', 280)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
                ${FluentIcons.chevronRight}
              </button>
            </div>
            <button type="button" class="section-see-all" onclick="openSearchView('${kw}')">Xem tất cả</button>
          </div>
        </div>
        <div class="restaurants-scroll category-restaurants-scroll" id="${scrollId}">
          ${cardsHtml}
        </div>
      </div>`;
  }).join('');
}

function dbmItemMatchesTagRule(item, tagRule) {
  const rule = (tagRule || []).map(dbmNormText).filter(Boolean);
  if (rule.length === 0) return false;
  const tags = (item.tags || []).map(dbmNormText);
  return rule.some(r => tags.includes(r));
}

// Khớp mặt hàng với từ khóa tìm kiếm: theo tag hoặc theo danh mục dựa trên tag
function dbmItemMatchesQuery(item, qLower) {
  const q = dbmNormText(qLower);
  if (!q) return false;
  if ((item.tags || []).some(t => dbmNormText(t).includes(q))) return true;
  if (typeof DB !== 'undefined' && DB.isReady) {
    const tagCat = DB.getCategories().find(c =>
      c.type === 'tag' && (dbmNormText(c.keyword) === q || dbmNormText(c.name) === q));
    if (tagCat) return dbmItemMatchesTagRule(item, tagCat.tagRule);
  }
  return false;
}

function toggleHomeCategoryEditMode() {
  homeCatEditMode = !homeCatEditMode;
  render();
}

function removeCategoryFromHome(catId) {
  const cat = DB.getCategoryById(catId);
  if (!cat) return;
  if (!confirm(`Gỡ ô "${cat.name}" khỏi trang chủ?\n\nDanh mục vẫn nằm trong Database, bạn có thể bật lại hoặc xóa hẳn trong Quản lý → Danh mục.`)) return;
  cat.showOnHome = false;
  DB.syncToGlobals();
  DB.save('hide_category_on_home');
  showToast('checkmarkFilled', `Đã gỡ ô "${cat.name}" khỏi trang chủ`);
  render();
}

// ─────────────────────────────────────────────────────────────────────────
// Mở rộng DB: Danh mục
// ─────────────────────────────────────────────────────────────────────────

Object.assign(DB, {
  getManualCategories() {
    return this.data.categories.filter(c => c.type !== 'tag');
  },

  countItemsInCategory(cat) {
    if (!cat) return 0;
    if (cat.type === 'tag') {
      return this.data.items.filter(it => dbmItemMatchesTagRule(it, cat.tagRule)).length;
    }
    return this.data.items.filter(it => it.categoryId === cat.id || it.category === cat.name).length;
  },

  getAllTags() {
    const counts = new Map();
    this.data.items.forEach(it => (it.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'vi'));
  },

  findCategoryByName(name, excludeId = null) {
    const n = dbmNormText(name);
    if (!n) return null;
    return this.data.categories.find(c => c.id !== excludeId && (dbmNormText(c.name) === n || dbmNormText(c.keyword) === n)) || null;
  },

  saveCategory(p, editId = null) {
    const name = String(p.name || '').trim();
    if (!name) return { ok: false, message: 'Vui lòng nhập tên danh mục!' };
    if (this.findCategoryByName(name, editId)) {
      return { ok: false, message: `Danh mục "${name}" đã tồn tại!` };
    }
    const type = p.type === 'tag' ? 'tag' : 'manual';
    const tagRule = type === 'tag' ? dbmParseTags(p.tagRule) : [];
    if (type === 'tag' && tagRule.length === 0) {
      return { ok: false, message: 'Danh mục theo tag cần ít nhất 1 tag!' };
    }

    let cat = editId ? this.data.categories.find(c => c.id === editId) : null;
    if (editId && !cat) return { ok: false, message: 'Không tìm thấy danh mục!' };

    const oldName = cat ? cat.name : null;
    const fields = {
      name,
      visualName: name,
      keyword: name,
      icon: String(p.icon || '').trim() || (cat ? cat.icon : (type === 'tag' ? '#️⃣' : '🛍️')),
      image: String(p.image || '').trim() || (cat ? cat.image : 'assets/images/hung_chien_gion.jpg'),
      description: String(p.description ?? '').trim() || (cat ? cat.description : `Danh mục ${name}`),
      showInVisualSuggestions: p.showInVisualSuggestions !== false,
      showOnHome: p.showOnHome !== false,
      showAsRestaurantSection: p.showAsRestaurantSection !== undefined
        ? Boolean(p.showAsRestaurantSection)
        : Boolean(cat && cat.showAsRestaurantSection),
      type,
      tagRule
    };

    if (cat) {
      Object.assign(cat, fields);
      cat.updatedAt = new Date().toISOString();
      if (oldName !== name && type === 'manual') {
        this.data.items.forEach(it => {
          if (it.categoryId === cat.id || it.category === oldName) { it.categoryId = cat.id; it.category = name; }
        });
        this.data.restaurants.forEach(r => {
          if (r.categoryId === cat.id || r.category === oldName) { r.categoryId = cat.id; r.category = name; }
        });
      }
    } else {
      cat = {
        id: slugifyId(name, type === 'tag' ? 'cat_tag' : 'cat_custom'),
        ...fields,
        isCustom: true,
        createdAt: new Date().toISOString()
      };
      this.data.categories.push(cat);
    }

    this.syncToGlobals();
    this.save('save_category');
    return { ok: true, category: cat };
  },

  moveCategory(catId, dir) {
    const list = this.data.categories;
    const idx = list.findIndex(c => c.id === catId);
    const target = idx + (dir < 0 ? -1 : 1);
    if (idx < 0 || target < 0 || target >= list.length) return false;
    [list[idx], list[target]] = [list[target], list[idx]];
    this.syncToGlobals();
    this.save('reorder_category');
    return true;
  },

  setCategoryOnHome(catId, show) {
    const cat = this.data.categories.find(c => c.id === catId);
    if (!cat) return false;
    cat.showOnHome = Boolean(show);
    this.syncToGlobals();
    this.save('toggle_category_home');
    return true;
  },

  setCategoryRestaurantSection(catId, show) {
    const cat = this.data.categories.find(c => c.id === catId);
    if (!cat) return false;
    cat.showAsRestaurantSection = Boolean(show);
    this.syncToGlobals();
    this.save('toggle_category_restaurant_section');
    return true;
  },

  // Ghi đè: không chuyển mặt hàng sang danh mục theo tag; luôn có danh mục thủ công để chứa mặt hàng
  deleteCategory(catId) {
    const idx = this.data.categories.findIndex(c => c.id === catId);
    if (idx === -1) return { ok: false, message: 'Không tìm thấy danh mục!' };

    const cat = this.data.categories[idx];
    let linkedItems = [];
    if (cat.type !== 'tag') {
      linkedItems = this.data.items.filter(it => it.categoryId === cat.id || it.category === cat.name);
    }
    this.data.categories.splice(idx, 1);

    if (linkedItems.length > 0) {
      let fallback = this.data.categories.find(c => c.type !== 'tag');
      if (!fallback) {
        fallback = {
          id: 'cat_other', name: 'Khác', visualName: 'Khác', keyword: 'Khác', icon: '🛍️',
          image: 'assets/images/hung_chien_gion.jpg', description: 'Mặt hàng chưa phân loại',
          showInVisualSuggestions: false, showOnHome: true, type: 'manual', tagRule: [],
          isCustom: true, createdAt: new Date().toISOString()
        };
        this.data.categories.push(fallback);
      }
      linkedItems.forEach(it => { it.categoryId = fallback.id; it.category = fallback.name; });
    }

    this.syncToGlobals();
    this.save('delete_category');
    return { ok: true, deleted: cat, movedCount: linkedItems.length };
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Mở rộng DB: Cửa hàng / địa điểm
// ─────────────────────────────────────────────────────────────────────────

Object.assign(DB, {
  getStores() {
    return this.data.restaurants;
  },

  getStoreById(id) {
    return this.data.restaurants.find(r => Number(r.id) === Number(id)) || null;
  },

  findStoreByName(name) {
    const n = dbmNormText(name);
    if (!n) return null;
    return this.data.restaurants.find(r => dbmNormText(r.name) === n) || null;
  },

  saveStore(p, editId = null) {
    const name = String(p.name || '').trim();
    if (!name) return { ok: false, message: 'Vui lòng nhập tên cửa hàng!' };

    const dup = this.findStoreByName(name);
    if (dup && Number(dup.id) !== Number(editId)) {
      return { ok: false, message: `Cửa hàng "${name}" đã tồn tại!` };
    }

    const cat = this.data.categories.find(c => c.id === p.categoryId && c.type !== 'tag')
      || this.getManualCategories()[0] || null;
    const shipNum = Math.max(0, Number(p.shippingFeeNum) || 0);
    const distance = Math.max(0, Number(p.distance) || 0.5);
    const rating = dbmToNumberOrNull(p.rating, { min: 0, max: 5 });
    const priceLevel = ['$', '$$', '$$$'].includes(p.priceLevel) ? p.priceLevel : '$';
    const priceTierMap = { '$': 'Giá sinh viên', '$$': 'Trung bình', '$$$': 'Cao cấp' };

    const fields = {
      name,
      image: String(p.image || '').trim(),
      categoryId: cat ? cat.id : 'cat_custom',
      category: cat ? cat.name : 'Tùy chỉnh',
      rating: rating === null ? 5 : Number(rating.toFixed(1)),
      reviewCount: String(p.reviewCount || '').trim() || 'Quán mới mở',
      priceLevel,
      priceTier: String(p.priceTier || '').trim() || priceTierMap[priceLevel],
      distance,
      distanceText: `${distance} km`,
      deliveryTime: String(p.deliveryTime || '').trim() || '15 - 20 phút',
      shippingFee: shipNum === 0 ? '0đ (Freeship)' : formatPriceVND(shipNum),
      shippingFeeNum: shipNum,
      isFreeship: shipNum === 0,
      vouchers: String(Array.isArray(p.vouchers) ? p.vouchers.join(',') : (p.vouchers || ''))
        .split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 8),
      shortReview: String(p.shortReview || '').trim() || 'Gian hàng chất lượng phục vụ tận nơi nhanh chóng!',
      badge: String(p.badge || '').trim() || 'Mới ✨',
      address: String(p.address || '').trim() || 'Khu vực Học viện PTIT',
      phone: String(p.phone || '').trim() || '0901 234 567'
    };

    let store = editId ? this.getStoreById(editId) : null;
    if (editId && !store) return { ok: false, message: 'Không tìm thấy cửa hàng!' };

    if (store) {
      if (!fields.image) fields.image = store.image;
      Object.assign(store, fields);
      store.updatedAt = new Date().toISOString();
      this.data.items.forEach(it => {
        if (Number(it.restaurantId) === Number(store.id)) it.restaurantName = store.name;
      });
    } else {
      if (!fields.image) fields.image = cat?.image || 'assets/images/hung_chien_gion.jpg';
      const maxId = this.data.restaurants.reduce((m, r) => Math.max(m, Number(r.id) || 0), 1000);
      store = {
        id: maxId + 1,
        ...fields,
        isCustom: true,
        isAIGenerated: Boolean(p.isAIGenerated),
        createdAt: new Date().toISOString()
      };
      this.data.restaurants.unshift(store);
    }

    this.syncToGlobals();
    this.save('save_store');
    return { ok: true, store };
  },

  deleteStore(storeId, moveToStoreId = 1000) {
    if (Number(storeId) === 1000) return { ok: false, message: 'Không thể xóa Gian hàng tự chọn mặc định!' };
    const idx = this.data.restaurants.findIndex(r => Number(r.id) === Number(storeId));
    if (idx === -1) return { ok: false, message: 'Không tìm thấy cửa hàng!' };

    const store = this.data.restaurants[idx];
    const target = this.getStoreById(moveToStoreId) || this.getStoreById(1000);
    const moved = this.data.items.filter(it => Number(it.restaurantId) === Number(store.id));
    moved.forEach(it => { it.restaurantId = target.id; it.restaurantName = target.name; });
    this.data.restaurants.splice(idx, 1);

    this.data.users.forEach(u => {
      u.favoriteRestaurantIds = (u.favoriteRestaurantIds || []).filter(id => Number(id) !== Number(store.id));
    });

    this.syncToGlobals();
    this.save('delete_store');
    return { ok: true, deleted: store, movedCount: moved.length, movedTo: target };
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Mở rộng DB: Mặt hàng (upsert đầy đủ + thao tác hàng loạt)
// ─────────────────────────────────────────────────────────────────────────

function dbmNextSku() {
  const nums = DB.data.items.map(it => parseInt(String(it.sku || '').replace(/\D/g, ''), 10)).filter(Number.isFinite);
  return `SP-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

function dbmCleanSizes(sizes) {
  const list = (Array.isArray(sizes) ? sizes : [])
    .filter(s => s && String(s.name || '').trim())
    .map(s => ({ name: String(s.name).trim(), extraPrice: Math.max(0, Number(s.extraPrice) || 0) }));
  return list.length ? list : [{ name: 'Phần Tiêu Chuẩn', extraPrice: 0 }];
}

function dbmCleanToppings(toppings) {
  return (Array.isArray(toppings) ? toppings : [])
    .filter(t => t && String(t.name || '').trim())
    .map((t, i) => ({
      id: t.id || `top_${Date.now()}_${i}`,
      name: String(t.name).trim(),
      price: Math.max(0, Number(t.price) || 0)
    }));
}

function dbmCleanIngredients(list) {
  return (Array.isArray(list) ? list : [])
    .map(g => (typeof g === 'string' ? { name: g } : g))
    .filter(g => g && String(g.name || '').trim())
    .map(g => ({ name: String(g.name).trim(), amount: String(g.amount || '').trim() }))
    .slice(0, 20);
}

function dbmCleanNutrition(n) {
  if (!n || typeof n !== 'object') return null;
  const keys = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar'];
  const out = {};
  keys.forEach(k => {
    const v = dbmToNumberOrNull(n[k], { min: 0, max: 99999 });
    if (v !== null) out[k] = Number(v.toFixed(1));
  });
  return Object.keys(out).length ? out : null;
}

function dbmHealthyColor(score) {
  const s = Number(score) || 0;
  if (s >= 8.0) return '#059669';
  if (s >= 6.5) return '#d97706';
  return '#dc2626';
}

function dbmHealthyTier(score) {
  const s = Number(score) || 0;
  if (s >= 8.0) return 'good';
  if (s >= 6.5) return 'moderate';
  return 'indulgent';
}

function dbmHealthyBadgeLabel(score) {
  const s = Number(score) || 0;
  if (s >= 8.8) return 'Rất lành mạnh';
  if (s >= 8.0) return 'Lành mạnh';
  if (s >= 6.5) return 'Cân bằng vừa phải';
  return 'Ăn điều độ';
}

function dbmCleanHealthyScore(val) {
  const v = dbmToNumberOrNull(val, { min: 0.1, max: 10 });
  return v !== null ? Number(v.toFixed(1)) : null;
}

function dbmCleanHealthyLevel(val) {
  const s = String(val || '').trim().slice(0, 140);
  return s || null;
}

function dbmComputeHealthyAssessment(input = {}) {
  const name = String(input.name || '');
  const category = String(input.category || '');
  const desc = String(input.description || '');
  const tags = Array.isArray(input.tags) ? input.tags.join(' ') : String(input.tags || '');
  const ingText = Array.isArray(input.ingredients)
    ? input.ingredients.map(g => (typeof g === 'string' ? g : g?.name || '')).join(' ')
    : '';
  const blob = dbmNormText(`${name} ${category} ${tags} ${desc} ${ingText}`);
  const nutri = (input.nutrition && typeof input.nutrition === 'object') ? input.nutrition : {};

  const cal = Number(nutri.calories);
  const pro = Number(nutri.protein);
  const fat = Number(nutri.fat);
  const fib = Number(nutri.fiber);
  const sod = Number(nutri.sodium);
  const sug = Number(nutri.sugar);
  const hasMacros = [cal, pro, fat, fib, sod, sug].some(v => Number.isFinite(v) && v > 0);

  let score = 8.0;

  if (hasMacros) {
    if (Number.isFinite(pro)) {
      if (pro >= 28) score += 0.6;
      else if (pro >= 20) score += 0.35;
      else if (pro < 8 && Number.isFinite(cal) && cal > 260) score -= 0.45;
    }
    if (Number.isFinite(fib)) {
      if (fib >= 6) score += 0.7;
      else if (fib >= 3.5) score += 0.35;
      else if (fib < 1.5 && Number.isFinite(cal) && cal > 300) score -= 0.35;
    }
    if (Number.isFinite(fat)) {
      if (fat > 30) score -= 1.1;
      else if (fat > 22) score -= 0.65;
      else if (fat <= 12) score += 0.35;
    }
    if (Number.isFinite(sug)) {
      if (sug > 32) score -= 1.4;
      else if (sug > 20) score -= 0.85;
      else if (sug > 12) score -= 0.35;
      else if (sug <= 6) score += 0.2;
    }
    if (Number.isFinite(sod)) {
      if (sod > 1600) score -= 0.75;
      else if (sod > 1150) score -= 0.35;
    }
    if (Number.isFinite(cal)) {
      if (cal > 820) score -= 0.8;
      else if (cal > 660) score -= 0.4;
      else if (cal >= 200 && cal <= 520) score += 0.25;
    }
  } else {
    if (/goi cuon|salad|sushi|chay|hap|luoc|eat clean|gao lut|uc ga/.test(blob)) score = 9.2;
    else if (/nuoc ep|sinh to khong duong|tra thao moc|sua chua/.test(blob)) score = 8.8;
    else if (/pho|bun|mien|hu tieu|chao|sup/.test(blob)) score = 8.5;
    else if (/com|ga nuong|bo|suon/.test(blob)) score = 8.1;
    else if (/ca phe|tra dao|tra chanh/.test(blob)) score = 7.9;
    else if (/mi cay|lau|tokbokki|xao/.test(blob)) score = 7.2;
    else if (/chien|gion|ran|burger|pizza|banh xeo|xuc xich|pho mai/.test(blob)) score = 6.6;
    else if (/tra sua|kem cheese|tran chau duong den|che ngot/.test(blob)) score = 6.1;
  }

  if (/salad|goi cuon|eat clean|luoc|hap|gao lut|uc ga|thanh dam|it duong|khong duong/.test(blob)) score += 0.45;
  if (/chien|ran|gion|mo hanh|pho mai|kem cheese|top mo|xuc xich|ngap dau/.test(blob)) score -= 0.6;
  if (/tra sua|duong den|sieu ngot/.test(blob) && !/it duong|khong duong|healthy/.test(blob)) score -= 0.45;

  const explicit = dbmCleanHealthyScore(input.healthyScore);
  const finalScore = explicit !== null ? explicit : Number(Math.max(3.5, Math.min(9.8, score)).toFixed(1));

  // Tạo nhận xét ngắn gọn, giàu thông tin theo chỉ số thực tế
  const pros = [];
  const cons = [];
  if (Number.isFinite(pro) && pro >= 24) pros.push('giàu đạm');
  if (Number.isFinite(fib) && fib >= 4.5) pros.push('nhiều chất xơ');
  if (Number.isFinite(fat) && fat > 0 && fat <= 12) pros.push('ít béo');
  if (Number.isFinite(cal) && cal > 0 && cal <= 380) pros.push('nhẹ bụng, ít calo');
  if (Number.isFinite(sug) && sug > 20) cons.push('nhiều đường');
  if (Number.isFinite(fat) && fat > 23) cons.push('nhiều dầu mỡ');
  if (Number.isFinite(sod) && sod > 1250) cons.push('đậm gia vị');
  if (Number.isFinite(cal) && cal > 680) cons.push('cao năng lượng');

  let level;
  if (finalScore >= 8.8) {
    level = `Rất lành mạnh • ${pros.length ? pros.slice(0, 2).join(', ').replace(/^./, c => c.toUpperCase()) : 'Thanh đạm, phù hợp Eat Clean'}`;
  } else if (finalScore >= 8.0) {
    level = `Cân bằng lành mạnh • ${pros.length ? pros.slice(0, 2).join(', ').replace(/^./, c => c.toUpperCase()) : 'Đủ chất, dễ tiêu hóa'}`;
  } else if (finalScore >= 6.5) {
    const detail = cons.length ? `Hơi ${cons[0]}, nên ăn kèm rau xanh` : (pros.length ? `${pros[0].replace(/^./, c => c.toUpperCase())}, năng lượng vừa phải` : 'Nạp năng lượng, dùng điều độ');
    level = `Cân bằng vừa phải • ${detail}`;
  } else {
    const detail = cons.length ? `Khá ${cons.slice(0, 2).join(' & ')}, nên dùng vừa phải` : 'Nhiều năng lượng, hạn chế ăn khuya';
    level = `Ăn điều độ • ${detail}`;
  }

  return {
    healthyScore: finalScore,
    healthyLevel: level,
    healthyColor: dbmHealthyColor(finalScore),
    tier: dbmHealthyTier(finalScore),
    badgeLabel: dbmHealthyBadgeLabel(finalScore)
  };
}

function dbmGetItemHealthy(item) {
  if (!item) return { score: 8.0, level: 'Cân bằng lành mạnh', color: '#059669', tier: 'good', badgeLabel: 'Lành mạnh', isCustomScore: false };
  const explicitScore = dbmCleanHealthyScore(item.healthyScore);
  const assessed = dbmComputeHealthyAssessment(item);
  const score = explicitScore !== null ? explicitScore : assessed.healthyScore;
  const level = dbmCleanHealthyLevel(item.healthyLevel) || assessed.healthyLevel;
  return {
    score,
    level,
    color: dbmHealthyColor(score),
    tier: dbmHealthyTier(score),
    badgeLabel: dbmHealthyBadgeLabel(score),
    isCustomScore: explicitScore !== null
  };
}

Object.assign(DB, {
  getItemsByStore(storeId) {
    return this.data.items.filter(it => Number(it.restaurantId) === Number(storeId));
  },

  saveItem(p, editId = null) {
    const name = String(p.name || '').trim();
    if (!name) return { ok: false, message: 'Vui lòng nhập tên mặt hàng!' };
    const price = Math.max(0, Math.round(Number(p.price) || 0));
    if (price <= 0) return { ok: false, message: 'Giá mặt hàng phải lớn hơn 0đ!' };

    let item = editId ? this.getItemById(editId) : null;
    if (editId && !item) return { ok: false, message: 'Không tìm thấy mặt hàng!' };

    const cat = this.data.categories.find(c => (c.id === p.categoryId || c.name === p.category) && c.type !== 'tag')
      || (item ? this.getCategoryById(item.categoryId) : null)
      || this.getManualCategories()[0];
    const store = this.getStoreById(p.restaurantId) || (item ? this.getStoreById(item.restaurantId) : null) || this.getStoreById(1000);
    const validCodes = new Set(this.getVouchers().map(v => v.code));

    const fields = {
      restaurantId: store ? store.id : 1000,
      restaurantName: store ? store.name : 'Gian Hàng Tự Chọn PTIT',
      location: String(p.location || '').trim() || (store && store.address) || 'Khu vực Học viện PTIT',
      categoryId: cat ? cat.id : 'cat_custom',
      category: cat ? cat.name : 'Tùy chỉnh',
      name,
      price,
      priceFormatted: formatPriceVND(price),
      description: String(p.description || '').trim()
        || `${name} thuộc danh mục ${cat ? cat.name : 'mặt hàng mới'}, đảm bảo chất lượng tươi ngon.`,
      sizes: dbmCleanSizes(p.sizes),
      toppings: dbmCleanToppings(p.toppings),
      noteSuggestions: (Array.isArray(p.noteSuggestions) ? p.noteSuggestions : []).map(n => String(n).trim()).filter(Boolean),
      inStock: p.inStock !== false,
      tags: dbmParseTags(p.tags),
      vouchers: (Array.isArray(p.vouchers) ? p.vouchers : []).map(c => String(c).toUpperCase()).filter(c => validCodes.has(c))
    };
    if (fields.noteSuggestions.length === 0) fields.noteSuggestions = ['Giao nhanh', 'Đóng gói kỹ'];

    const imageIn = String(p.image || '').trim();
    if (imageIn) {
      fields.image = imageIn;
      fields.imageIsPlaceholder = Boolean(p.imageIsPlaceholder) || imageIn.startsWith('data:image/svg+xml');
    } else if (!item) {
      fields.image = (cat && cat.image) || 'assets/images/hung_chien_gion.jpg';
      fields.imageIsPlaceholder = true;
    }

    const cleanNutrition = dbmCleanNutrition(p.nutrition);
    const cleanIngredients = dbmCleanIngredients(p.ingredients);
    const explicitHScore = dbmCleanHealthyScore(p.healthyScore);
    const explicitHLevel = dbmCleanHealthyLevel(p.healthyLevel);
    const autoHealthy = dbmComputeHealthyAssessment({
      ...fields,
      nutrition: cleanNutrition,
      ingredients: cleanIngredients,
      healthyScore: explicitHScore
    });

    const optional = {
      rating: dbmToNumberOrNull(p.rating, { min: 0, max: 5 }),
      reviewCount: dbmToNumberOrNull(p.reviewCount, { min: 0, int: true }),
      soldCount: dbmToNumberOrNull(p.soldCount, { min: 0, int: true }),
      nutrition: cleanNutrition,
      ingredients: cleanIngredients.length ? cleanIngredients : null,
      healthyScore: explicitHScore !== null ? explicitHScore : autoHealthy.healthyScore,
      healthyLevel: explicitHLevel || autoHealthy.healthyLevel
    };

    if (item) {
      Object.assign(item, fields);
      item.updatedAt = new Date().toISOString();
    } else {
      item = {
        id: slugifyId(name, 'item_custom'),
        sku: dbmNextSku(),
        ...fields,
        isCustom: true,
        createdByUserId: this.getCurrentUser()?.id || null,
        createdAt: new Date().toISOString()
      };
      if (p.isAIGenerated) {
        item.isAIGenerated = true;
        if (p.aiTheme) item.aiTheme = String(p.aiTheme).slice(0, 120);
      }
      this.data.items.unshift(item);
    }
    Object.entries(optional).forEach(([k, v]) => {
      if (v === null || v === undefined) delete item[k]; else item[k] = v;
    });

    this.syncToGlobals();
    this.save(editId ? 'update_item_full' : 'add_item_full');
    return { ok: true, item };
  },

  bulkUpdateItems(ids, patch) {
    const idSet = new Set(ids);
    const targets = this.data.items.filter(it => idSet.has(it.id));
    if (targets.length === 0) return { ok: false, message: 'Chưa chọn mặt hàng nào!' };

    const cat = patch.categoryId ? this.data.categories.find(c => c.id === patch.categoryId && c.type !== 'tag') : null;
    const store = patch.restaurantId ? this.getStoreById(patch.restaurantId) : null;
    const addTags = dbmParseTags(patch.addTags);
    const removeTags = dbmParseTags(patch.removeTags);
    const validCodes = new Set(this.getVouchers().map(v => v.code));
    const addVouchers = (patch.addVouchers || []).filter(c => validCodes.has(c));
    const removeVouchers = new Set(patch.removeVouchers || []);
    const patchHScore = dbmCleanHealthyScore(patch.healthyScore);
    const patchHLevel = dbmCleanHealthyLevel(patch.healthyLevel);

    targets.forEach(it => {
      if (cat) { it.categoryId = cat.id; it.category = cat.name; }
      if (store) { it.restaurantId = store.id; it.restaurantName = store.name; if (store.address) it.location = store.address; }
      if (patch.image) { it.image = patch.image; it.imageIsPlaceholder = false; }
      if (patch.inStock !== undefined) it.inStock = Boolean(patch.inStock);
      if (addTags.length || removeTags.length) {
        const set = new Set([...(it.tags || []), ...addTags]);
        removeTags.forEach(t => set.delete(t));
        it.tags = Array.from(set).slice(0, 16);
      }
      if (addVouchers.length || removeVouchers.size) {
        const set = new Set([...(it.vouchers || []), ...addVouchers]);
        removeVouchers.forEach(c => set.delete(c));
        it.vouchers = Array.from(set);
      }
      if (patch.healthyMode === 'auto') {
        const assessed = dbmComputeHealthyAssessment({ ...it, healthyScore: null });
        it.healthyScore = assessed.healthyScore;
        it.healthyLevel = assessed.healthyLevel;
      } else {
        if (patchHScore !== null) {
          it.healthyScore = patchHScore;
          if (!patchHLevel) {
            it.healthyLevel = dbmComputeHealthyAssessment({ ...it, healthyScore: patchHScore }).healthyLevel;
          }
        }
        if (patchHLevel) it.healthyLevel = patchHLevel;
      }
      it.updatedAt = new Date().toISOString();
    });

    this.syncToGlobals();
    this.save('bulk_update_items');
    return { ok: true, count: targets.length };
  },

  deleteItems(ids) {
    const idSet = new Set(ids);
    const before = this.data.items.length;
    this.data.items = this.data.items.filter(it => !idSet.has(it.id));
    const removed = before - this.data.items.length;
    this.syncToGlobals();
    this.save('delete_items');
    return { ok: true, count: removed };
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Mở rộng DB: Mã giảm giá & thư viện ảnh
// ─────────────────────────────────────────────────────────────────────────

Object.assign(DB, {
  getVouchers() {
    return this.data.vouchers || [];
  },

  findVoucher(code, onlyActive = false) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return null;
    const v = this.getVouchers().find(x => x.code === c || (x.aliases || []).includes(c)) || null;
    return v && (!onlyActive || v.active !== false) ? v : null;
  },

  saveVoucher(p, originalCode = null) {
    const code = String(p.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
      return { ok: false, message: 'Mã chỉ gồm chữ/số/gạch (3-24 ký tự), VD: SINHVIEN20' };
    }
    const clash = this.findVoucher(code);
    if (clash && clash.code !== originalCode) return { ok: false, message: `Mã "${code}" đã tồn tại!` };

    const type = ['percent', 'fixed', 'freeship'].includes(p.type) ? p.type : 'percent';
    let value = Math.max(0, Number(p.value) || 0);
    if (type === 'freeship' && value <= 0) value = DBM_BASE_SHIPPING_FEE;
    if (value <= 0) return { ok: false, message: 'Giá trị giảm phải lớn hơn 0!' };
    if (type === 'percent' && value > 100) return { ok: false, message: 'Giảm theo % tối đa 100!' };

    const existing = originalCode ? this.getVouchers().find(v => v.code === originalCode) : null;
    const title = String(p.title || '').trim()
      || (type === 'percent' ? `Giảm ${value}%` : type === 'fixed' ? `Giảm ${formatPriceVND(value)}` : 'Miễn phí vận chuyển');
    const fields = {
      code,
      title,
      desc: String(p.desc || '').trim() || title,
      type,
      value,
      maxDiscount: type === 'percent' ? Math.max(0, Number(p.maxDiscount) || 0) : 0,
      minOrder: Math.max(0, Number(p.minOrder) || 0),
      scope: p.scope === 'selected' ? 'selected' : 'all',
      active: p.active !== false
    };

    if (existing) {
      const oldCode = existing.code;
      Object.assign(existing, fields);
      if (oldCode !== code) {
        this.data.items.forEach(it => { it.vouchers = (it.vouchers || []).map(c => (c === oldCode ? code : c)); });
      }
    } else {
      this.data.vouchers.push({ ...fields, aliases: [], createdAt: new Date().toISOString() });
    }
    this.save('save_voucher');
    return { ok: true, voucher: fields };
  },

  deleteVoucher(code) {
    const idx = this.getVouchers().findIndex(v => v.code === code);
    if (idx === -1) return { ok: false, message: 'Không tìm thấy mã!' };
    const [removed] = this.data.vouchers.splice(idx, 1);
    this.data.items.forEach(it => { it.vouchers = (it.vouchers || []).filter(c => c !== code); });
    this.save('delete_voucher');
    return { ok: true, deleted: removed };
  },

  getLibraryImages() {
    return this.data.imageLibrary || [];
  },

  addLibraryImage({ name, src }) {
    const clean = String(src || '').trim();
    if (!clean) return null;
    const existing = this.getLibraryImages().find(i => i.src === clean);
    if (existing) return existing;
    const entry = {
      id: slugifyId(name || 'anh', 'img'),
      name: String(name || 'Ảnh').slice(0, 60),
      src: clean,
      createdAt: new Date().toISOString()
    };
    this.data.imageLibrary.unshift(entry);
    this.save('add_library_image');
    return entry;
  },

  removeLibraryImage(imageId) {
    const before = this.getLibraryImages().length;
    this.data.imageLibrary = this.getLibraryImages().filter(i => i.id !== imageId);
    this.save('remove_library_image');
    return before !== this.data.imageLibrary.length;
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Áp dụng mã giảm giá (dùng chung cho Giỏ hàng, Thanh toán, Đặt đơn)
// ─────────────────────────────────────────────────────────────────────────

function dbmItemHasVoucher(itemId, code) {
  const item = DB.getItemById(itemId);
  return Boolean(item && (item.vouchers || []).includes(code));
}

function dbmEligibleSubtotal(voucher, cartItems) {
  const list = Array.isArray(cartItems) ? cartItems : [];
  if (voucher.scope !== 'selected') return list.reduce((s, ci) => s + (Number(ci.totalPrice) || 0), 0);
  return list
    .filter(ci => dbmItemHasVoucher(ci.dishId, voucher.code))
    .reduce((s, ci) => s + (Number(ci.totalPrice) || 0), 0);
}

function computeVoucherDiscount(applied, subtotal, cartItems) {
  if (!applied || typeof DB === 'undefined' || !DB.isReady) return 0;
  const v = DB.findVoucher(applied.code, true);
  if (!v) return 0;
  if (v.minOrder && subtotal < v.minOrder) return 0;

  const base = dbmEligibleSubtotal(v, cartItems);
  if (base <= 0) return 0;

  if (v.type === 'percent') {
    let d = Math.round(base * v.value / 100);
    if (v.maxDiscount) d = Math.min(d, v.maxDiscount);
    return Math.min(d, subtotal);
  }
  if (v.type === 'fixed') return Math.min(v.value, base, subtotal);
  // freeship: chỉ trừ tối đa đúng phí vận chuyển thực tế của đơn
  const shippingFee = subtotal > DBM_FREE_SHIPPING_THRESHOLD ? 0 : DBM_BASE_SHIPPING_FEE;
  return Math.min(v.value || DBM_BASE_SHIPPING_FEE, shippingFee);
}

function dbmResolvePromo(rawCode, cartItems) {
  const code = String(rawCode || '').trim().toUpperCase();
  const v = (typeof DB !== 'undefined' && DB.isReady) ? DB.findVoucher(code) : null;
  if (!v) return { ok: false, message: `Mã "${code}" không hợp lệ hoặc đã hết hạn` };
  if (v.active === false) return { ok: false, message: `Mã "${v.code}" đang tạm ngưng áp dụng` };

  const subtotal = (cartItems || []).reduce((s, ci) => s + (Number(ci.totalPrice) || 0), 0);
  if (v.minOrder && subtotal < v.minOrder) {
    return { ok: false, message: `Mã "${v.code}" áp dụng cho đơn từ ${formatPriceVND(v.minOrder)}` };
  }
  if (v.scope === 'selected' && dbmEligibleSubtotal(v, cartItems) <= 0) {
    return { ok: false, message: `Mã "${v.code}" chỉ áp dụng cho một số mặt hàng — giỏ hàng chưa có món phù hợp` };
  }
  return {
    ok: true,
    applied: { code: v.code, desc: v.desc || v.title },
    icon: v.icon || 'tagRegular',
    toast: `Áp dụng mã ${v.code} thành công! ${v.title}`
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Ghi đè dinh dưỡng / nguyên liệu / đã bán / đánh giá khi mặt hàng có dữ liệu riêng
// ─────────────────────────────────────────────────────────────────────────

(function dbmWrapDishProfile() {
  if (typeof window.getDishNutritionAndSafetyProfile !== 'function') return;
  const original = window.getDishNutritionAndSafetyProfile;

  window.getDishNutritionAndSafetyProfile = function (dish, restaurant) {
    const profile = original(dish, restaurant);
    const item = (dish && dish.id && typeof DB !== 'undefined' && DB.isReady) ? DB.getItemById(dish.id) : dish;
    if (!item || !profile) return profile;

    if (item.nutrition && typeof item.nutrition === 'object') {
      ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar'].forEach(k => {
        if (Number.isFinite(Number(item.nutrition[k]))) profile[k] = Number(item.nutrition[k]);
      });
    }
    const explicitScore = dbmCleanHealthyScore(item.healthyScore);
    const explicitLevel = dbmCleanHealthyLevel(item.healthyLevel);
    if (explicitScore !== null) {
      profile.healthyScore = explicitScore;
      profile.healthyColor = dbmHealthyColor(explicitScore);
    } else if (item.nutrition && typeof item.nutrition === 'object') {
      const assessed = dbmComputeHealthyAssessment({ ...item, nutrition: profile });
      profile.healthyScore = assessed.healthyScore;
      profile.healthyColor = assessed.healthyColor;
      if (!explicitLevel) profile.healthyLevel = assessed.healthyLevel;
    }
    if (explicitLevel) {
      profile.healthyLevel = explicitLevel;
    }
    if (Number.isFinite(Number(profile.healthyScore))) {
      profile.healthyColor = dbmHealthyColor(profile.healthyScore);
    }
    if (Array.isArray(item.ingredients) && item.ingredients.length > 0) {
      const icons = ['🥩', '🍚', '🥬', '🧂', '🥚', '🍅', '🌿', '🧄'];
      profile.ingredients = item.ingredients.map((g, i) => ({
        icon: g.icon || icons[i % icons.length],
        name: g.name,
        amount: g.amount || '—',
        origin: g.origin || `Do ${restaurant?.name || item.restaurantName || 'cửa hàng'} cung cấp`,
        role: g.role || 'Nguyên liệu cấu thành món'
      }));
    }
    if (Number.isFinite(Number(item.soldCount))) profile.soldCount = Number(item.soldCount);
    if (Number.isFinite(Number(item.rating)) && Number(item.rating) > 0) profile.ratingVal = Number(item.rating);
    return profile;
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Hiển thị chip Mã giảm giá động trên trang Sản phẩm, Giỏ hàng & Thanh toán
// ─────────────────────────────────────────────────────────────────────────

function dbmVoucherShortBadge(v) {
  if (v.type === 'percent') return `-${v.value}%`;
  if (v.type === 'freeship') return '0đ ship';
  return `-${Math.round((Number(v.value) || 0) / 1000)}K`;
}

function dbmGetEligibleVouchersForCart(cartItems) {
  if (typeof DB === 'undefined' || !DB.isReady) return [];
  const list = Array.isArray(cartItems) ? cartItems : [];
  return DB.getVouchers().filter(v => {
    if (v.active === false) return false;
    if (v.scope !== 'selected') return true;
    return list.some(ci => dbmItemHasVoucher(ci.dishId, v.code));
  });
}

function dbmRenderCartVoucherChipsHtml(cartItems) {
  const list = dbmGetEligibleVouchersForCart(cartItems);
  if (!list.length) return '';
  return `<div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
    ${list.map(v => {
    const hot = v.code === 'HUNGCHIENGION' || v.scope === 'selected';
    return `<button type="button" class="note-chip" ${hot ? 'style="background:#fff1f0;border-color:#ffa39e;color:#cf1322;"' : ''} onclick="applyPromoCode('${escapeHtml(v.code)}')" title="${escapeHtml(v.desc || v.title)}">${hot ? '🔥' : '🎟️'} ${escapeHtml(v.code)} (${escapeHtml(dbmVoucherShortBadge(v))})</button>`;
  }).join('')}
  </div>`;
}

function dbmRenderCheckoutVoucherChipsHtml(cartItems, activeCode) {
  const list = dbmGetEligibleVouchersForCart(cartItems);
  if (!list.length) return '';
  return list.map(v => {
    const isActive = activeCode === v.code || (v.aliases || []).includes(activeCode);
    const iconSvg = (typeof FluentIcons !== 'undefined' && FluentIcons[v.icon]) ? FluentIcons[v.icon] : (typeof FluentIcons !== 'undefined' ? FluentIcons.tagRegular : '🎟️');
    return `<button type="button" class="cart-voucher-chip ${isActive ? 'active' : ''}" onclick="applyPromoCodeFromCheckout('${escapeHtml(v.code)}')" title="${escapeHtml(v.desc || v.title)}">${iconSvg} ${escapeHtml(v.code)} (${escapeHtml(dbmVoucherShortBadge(v))})</button>`;
  }).join('');
}

function dbmRenderPdpVouchersHtml(dish) {
  if (typeof DB === 'undefined' || !DB.isReady || !dish) return '';
  const itemCodes = new Set(Array.isArray(dish.vouchers) ? dish.vouchers : []);
  const vouchers = DB.getVouchers().filter(v => v.active !== false && (itemCodes.has(v.code) || v.code === 'FREESHIP'));
  if (!vouchers.length) return '';
  return `
    <div class="pdp-vouchers-strip">
      <span class="pdp-vouchers-label">🎟️ Mã giảm giá áp dụng:</span>
      ${vouchers.map(v => `
        <button type="button" class="pdp-voucher-pill" onclick="applyPromoCode('${escapeHtml(v.code)}')" title="${escapeHtml(v.desc || v.title)}">
          <strong>${escapeHtml(v.code)}</strong> <span>${escapeHtml(dbmVoucherShortBadge(v))}</span>
        </button>`).join('')}
    </div>`;
}
