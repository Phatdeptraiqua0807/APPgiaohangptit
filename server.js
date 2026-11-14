/* ==========================================================================
   ptitngon - Local Proxy, App Server & Indexed Catalog Search Engine (server.js)
   - Chạy trực tiếp bằng Node.js chuẩn (không cần cài thêm thư viện ngoài)
   - Chuyển tiếp (Proxy) mọi request AI API (DeepSeek, OpenAI, Groq, Gemini...)
     từ Server-to-Server giúp loại bỏ hoàn toàn lỗi chặn CORS trên trình duyệt
   - Cung cấp Hệ thống Tìm kiếm Chỉ mục Ngược (Inverted Index) sẵn sàng mở rộng
     tới hàng trăm nghìn - 1 triệu mặt hàng cho Kiến trúc AI Đa Giai Đoạn:
       + GET  /api/catalog/overview     : Thống kê tổng quan & lược đồ danh mục nhẹ
       + POST /api/catalog/search       : Truy vấn mặt hàng theo bộ lọc đa chiều + từ khóa
       + POST /api/catalog/items-by-ids : Lấy chi tiết sâu theo danh sách mã mặt hàng
       + POST /api/catalog/stores       : Tra cứu cửa hàng & thực đơn tiêu biểu
   - Phục vụ giao diện web tĩnh & đồng bộ trực tiếp database.json
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DB_FILE_PATH = path.join(ROOT_DIR, 'database.json');
const FOOD_DATA_PATH = path.join(ROOT_DIR, 'js', 'food-data.js');
const AI_PROFILES_FILE_PATH = path.join(ROOT_DIR, 'ai-profiles.json');
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

function syncFoodDataSeedFile(parsedData) {
  try {
    const code = `/* Auto-synced seed mirror of database.json for offline file:// protocol compatibility */\nwindow.__DATABASE_SEED__ = ${JSON.stringify(parsedData, null, 2)};\n`;
    if (fs.existsSync(FOOD_DATA_PATH)) {
      const currentCode = fs.readFileSync(FOOD_DATA_PATH, 'utf8');
      if (currentCode === code) return; // Nội dung giống hệt thì không ghi đè để tránh kích hoạt Live Server reload
    }
    fs.writeFileSync(FOOD_DATA_PATH, code, 'utf8');
  } catch (err) {
    console.warn('Không thể đồng bộ js/food-data.js:', err.message);
  }
}

try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
    syncFoodDataSeedFile(JSON.parse(raw));
  }
} catch (_) {}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'X-PTITNGON-DB, X-Proxy-Normalized-Url');
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  setCorsHeaders(res);
  Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', chunk => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('Dữ liệu gửi lên vượt quá giới hạn 10MB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

// ==========================================================================
// 1. BỘ CHỈ MỤC TÌM KIẾM MẶT HÀNG TỐC ĐỘ CAO (INVERTED INDEX ENGINE)
//    Thiết kế tối ưu cho quy mô lớn (100.000 - 1.000.000+ mặt hàng)
// ==========================================================================

function removeVnTones(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function tokenizeText(asciiStr) {
  return asciiStr
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 2);
}

function hashCodeStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function estimateItemNutritionServer(item) {
  const catAscii = removeVnTones(item.category || '');
  const nameAscii = removeVnTones(item.name || '');
  const tagsAscii = removeVnTones(Array.isArray(item.tags) ? item.tags.join(' ') : '');
  const blob = `${catAscii} ${nameAscii} ${tagsAscii}`;
  const seed = hashCodeStr((item.id || '') + (item.name || ''));
  const explicitScore = Number(item.healthyScore);
  const hasExplicitScore = Number.isFinite(explicitScore) && explicitScore > 0;
  const explicitLevel = String(item.healthyLevel || '').trim();

  let calories = 480 + (seed % 60);
  let protein = 23 + (seed % 6);
  let fallbackScore = 8.2;

  if (/goi cuon|salad|sushi|chay|hap|luoc|eat clean|gao lut|uc ga/.test(blob)) {
    calories = 290 + (seed % 70); protein = 18 + (seed % 7); fallbackScore = 9.2;
  } else if (/tra sua|kem cheese|che/.test(blob)) {
    calories = 340 + (seed % 90); protein = 4 + (seed % 4); fallbackScore = 6.4;
  } else if (/ca phe|coffee|tra dao|nuoc ep/.test(blob)) {
    calories = 130 + (seed % 70); protein = 2 + (seed % 3); fallbackScore = 8.1;
  } else if (/chien|gion|ran|burger|pizza|banh xeo|xuc xich/.test(blob)) {
    calories = 560 + (seed % 75); protein = 27 + (seed % 7); fallbackScore = 6.7;
  } else if (/pho|bun|mien|hu tieu|chao|mi quang|cao lau/.test(blob)) {
    calories = 460 + (seed % 65); protein = 26 + (seed % 7); fallbackScore = 8.5;
  } else if (/com|suon|ga nuong|bo/.test(blob)) {
    calories = 580 + (seed % 70); protein = 31 + (seed % 8); fallbackScore = 8.2;
  }

  if (item.nutrition && (item.nutrition.calories || item.nutrition.protein)) {
    calories = Number(item.nutrition.calories) || calories;
    protein = Number(item.nutrition.protein) || protein;
    if (!hasExplicitScore) {
      let s = 8.0;
      const fat = Number(item.nutrition.fat);
      const fib = Number(item.nutrition.fiber);
      const sug = Number(item.nutrition.sugar);
      const sod = Number(item.nutrition.sodium);
      if (protein >= 28) s += 0.6; else if (protein >= 20) s += 0.35; else if (protein < 8 && calories > 260) s -= 0.45;
      if (Number.isFinite(fib)) { if (fib >= 6) s += 0.7; else if (fib >= 3.5) s += 0.35; }
      if (Number.isFinite(fat)) { if (fat > 30) s -= 1.1; else if (fat > 22) s -= 0.65; else if (fat <= 12) s += 0.35; }
      if (Number.isFinite(sug)) { if (sug > 32) s -= 1.4; else if (sug > 20) s -= 0.85; else if (sug <= 6) s += 0.2; }
      if (Number.isFinite(sod) && sod > 1400) s -= 0.5;
      if (calories > 800) s -= 0.7; else if (calories >= 200 && calories <= 520) s += 0.25;
      if (/salad|goi cuon|eat clean|luoc|hap|gao lut|uc ga/.test(blob)) s += 0.45;
      if (/chien|ran|gion|pho mai|kem cheese/.test(blob)) s -= 0.6;
      fallbackScore = Number(Math.max(3.5, Math.min(9.8, s)).toFixed(1));
    }
  } else if (item.calories && item.protein) {
    calories = Number(item.calories);
    protein = Number(item.protein);
  }

  const healthyScore = hasExplicitScore ? Number(Math.min(10, Math.max(0.1, explicitScore)).toFixed(1)) : fallbackScore;
  const healthyLevel = explicitLevel || (healthyScore >= 8.5 ? 'Rất lành mạnh' : healthyScore >= 8.0 ? 'Cân bằng lành mạnh' : healthyScore >= 6.5 ? 'Cân bằng vừa phải' : 'Ăn điều độ');

  return { calories, protein, healthyScore, healthyLevel };
}

const CatalogIndex = {
  lastMtimeMs: -1,
  rawDb: null,
  items: [],
  itemById: new Map(),
  storeById: new Map(),
  categories: [],
  invertedTokens: new Map(), // token -> Set/Array of item indices
  categoryMap: new Map(),    // catAscii -> Array of item indices
  storeItemsMap: new Map(),  // restaurantId -> Array of item indices
  overviewCache: null,

  ensureFresh() {
    try {
      const stat = fs.statSync(DB_FILE_PATH);
      if (stat.mtimeMs !== this.lastMtimeMs || !this.rawDb) {
        this.rebuild(stat.mtimeMs);
      }
    } catch (err) {
      if (!this.rawDb) {
        console.warn('⚠️ Không thể nạp database.json vào chỉ mục:', err.message);
      }
    }
  },

  rebuild(mtimeMs) {
    const t0 = performance.now();
    const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
    const db = JSON.parse(content);

    this.rawDb = db;
    this.lastMtimeMs = mtimeMs;
    this.categories = Array.isArray(db.categories) ? db.categories : [];
    const stores = Array.isArray(db.restaurants) ? db.restaurants : [];
    const rawItems = Array.isArray(db.items) ? db.items : [];

    this.storeById.clear();
    stores.forEach(s => this.storeById.set(Number(s.id), s));

    this.items = [];
    this.itemById.clear();
    this.invertedTokens.clear();
    this.categoryMap.clear();
    this.storeItemsMap.clear();

    let minPrice = Infinity;
    let maxPrice = 0;
    let sumPrice = 0;
    let inStockCount = 0;
    const catStats = new Map();

    rawItems.forEach((it, idx) => {
      const store = this.storeById.get(Number(it.restaurantId)) || null;
      const nameLower = String(it.name || '').toLowerCase();
      const catLower = String(it.category || '').toLowerCase();
      const descLower = String(it.description || '').toLowerCase();
      const storeLower = String(it.restaurantName || store?.name || '').toLowerCase();

      const nameAscii = removeVnTones(nameLower);
      const catAscii = removeVnTones(catLower);
      const descAscii = removeVnTones(descLower);
      const storeAscii = removeVnTones(storeLower);
      const skuAscii = removeVnTones(it.sku || '');
      const tagsAscii = removeVnTones(Array.isArray(it.tags) ? it.tags.join(' ') : '');
      const ingAscii = removeVnTones(Array.isArray(it.ingredients) ? it.ingredients.map(g => (typeof g === 'string' ? g : g?.name || '')).join(' ') : '');
      const fullAscii = `${nameAscii} ${catAscii} ${storeAscii} ${descAscii} ${skuAscii} ${tagsAscii} ${ingAscii}`;
      const nutri = estimateItemNutritionServer(it);
      const price = Number(it.price) || 0;
      const inStock = it.inStock !== false;

      const nameTokenSet = new Set(tokenizeText(nameAscii));
      const catTokenSet = new Set(tokenizeText(`${catAscii} ${tagsAscii}`));
      const storeTokenSet = new Set(tokenizeText(storeAscii));
      const descTokenSet = new Set(tokenizeText(`${descAscii} ${ingAscii}`));

      const indexedRecord = {
        idx,
        raw: it,
        id: it.id,
        sku: it.sku || '',
        name: it.name,
        price,
        category: it.category || 'Khác',
        categoryId: it.categoryId || '',
        restaurantId: Number(it.restaurantId) || 0,
        restaurantName: store ? store.name : (it.restaurantName || ''),
        isFreeship: store ? Boolean(store.isFreeship) : true,
        rating: Number(it.rating) || Number(store?.rating) || 4.8,
        soldCount: Number(it.soldCount) || 0,
        tags: Array.isArray(it.tags) ? it.tags : [],
        vouchers: Array.isArray(it.vouchers) ? it.vouchers : [],
        distance: Number(store?.distance) || 1.0,
        deliveryTime: store?.deliveryTime || '15 - 20 phút',
        inStock,
        calories: nutri.calories,
        protein: nutri.protein,
        healthyScore: nutri.healthyScore,
        healthyLevel: nutri.healthyLevel,
        nameLower,
        catLower,
        descLower,
        storeLower,
        nameAscii,
        catAscii,
        descAscii,
        storeAscii,
        fullAscii,
        nameTokenSet,
        catTokenSet,
        storeTokenSet,
        descTokenSet
      };

      this.items.push(indexedRecord);
      this.itemById.set(String(it.id), indexedRecord);

      // Đánh chỉ mục ngược theo từ khóa (Inverted Index)
      const uniqueTokens = new Set(tokenizeText(fullAscii));
      uniqueTokens.forEach(tk => {
        let bucket = this.invertedTokens.get(tk);
        if (!bucket) {
          bucket = [];
          this.invertedTokens.set(tk, bucket);
        }
        bucket.push(idx);
      });

      // Chỉ mục theo Danh mục
      if (catAscii) {
        let cBucket = this.categoryMap.get(catAscii);
        if (!cBucket) {
          cBucket = [];
          this.categoryMap.set(catAscii, cBucket);
        }
        cBucket.push(idx);
      }

      // Chỉ mục theo Cửa hàng
      const rId = indexedRecord.restaurantId;
      let sBucket = this.storeItemsMap.get(rId);
      if (!sBucket) {
        sBucket = [];
        this.storeItemsMap.set(rId, sBucket);
      }
      sBucket.push(idx);

      // Thống kê tổng quan
      if (inStock) inStockCount++;
      if (price > 0) {
        if (price < minPrice) minPrice = price;
        if (price > maxPrice) maxPrice = price;
        sumPrice += price;
      }

      const cStat = catStats.get(indexedRecord.category) || {
        name: indexedRecord.category,
        count: 0,
        inStockCount: 0,
        minPrice: Infinity,
        maxPrice: 0
      };
      cStat.count++;
      if (inStock) cStat.inStockCount++;
      if (price > 0 && price < cStat.minPrice) cStat.minPrice = price;
      if (price > cStat.maxPrice) cStat.maxPrice = price;
      catStats.set(indexedRecord.category, cStat);
    });

    // Đánh chỉ mục cho các danh mục dựa trên Tag (type === 'tag')
    this.tagCategoryMap = new Map();
    this.categories.filter(c => c.type === 'tag' && Array.isArray(c.tagRule) && c.tagRule.length > 0).forEach(c => {
      const ruleSet = new Set(c.tagRule.map(t => removeVnTones(t).trim()).filter(Boolean));
      const matchedIdx = [];
      let minP = Infinity;
      let maxP = 0;
      let inStockCnt = 0;
      this.items.forEach(rec => {
        const hasTag = (rec.tags || []).some(t => ruleSet.has(removeVnTones(t).trim()));
        if (hasTag) {
          matchedIdx.push(rec.idx);
          if (rec.inStock) inStockCnt++;
          if (rec.price > 0 && rec.price < minP) minP = rec.price;
          if (rec.price > maxP) maxP = rec.price;
        }
      });
      const key = removeVnTones(c.name).trim();
      if (key && matchedIdx.length > 0) {
        this.categoryMap.set(key, matchedIdx);
        this.tagCategoryMap.set(key, new Set(matchedIdx));
      }
      catStats.set(c.name, { name: c.name, count: matchedIdx.length, inStockCount: inStockCnt, minPrice: minP, maxPrice: maxP });
    });

    const categoriesSummary = this.categories.map(c => {
      const st = catStats.get(c.name) || { count: 0, inStockCount: 0, minPrice: 0, maxPrice: 0 };
      return {
        id: c.id,
        name: c.name,
        icon: c.icon || '🍽️',
        itemCount: st.count,
        inStockCount: st.inStockCount,
        minPrice: st.minPrice === Infinity ? 0 : st.minPrice,
        maxPrice: st.maxPrice
      };
    });

    // Bổ sung các category phát sinh ngoài danh sách gốc (nếu có)
    for (const [cName, st] of catStats.entries()) {
      if (!categoriesSummary.some(x => x.name === cName)) {
        categoriesSummary.push({
          id: removeVnTones(cName).replace(/\s+/g, '_'),
          name: cName,
          icon: '🍽️',
          itemCount: st.count,
          inStockCount: st.inStockCount,
          minPrice: st.minPrice === Infinity ? 0 : st.minPrice,
          maxPrice: st.maxPrice
        });
      }
    }

    this.overviewCache = {
      totalItems: this.items.length,
      inStockCount,
      outOfStockCount: this.items.length - inStockCount,
      totalStores: stores.length,
      freeshipStoreCount: stores.filter(s => s.isFreeship).length,
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice,
        avg: this.items.length ? Math.round(sumPrice / this.items.length) : 0
      },
      categories: categoriesSummary,
      indexedTokensCount: this.invertedTokens.size
    };

    const elapsed = (performance.now() - t0).toFixed(1);
    console.log(`📚 Đã lập chỉ mục ${this.items.length} mặt hàng (${this.invertedTokens.size} từ khóa) trong ${elapsed}ms`);
  },

  formatCompactItem(rec) {
    const it = rec.raw;
    return {
      id: rec.id,
      sku: rec.sku,
      name: rec.name,
      price: rec.price,
      category: rec.category,
      restaurantId: rec.restaurantId,
      restaurantName: rec.restaurantName,
      isFreeship: rec.isFreeship,
      rating: rec.rating,
      distance: rec.distance,
      deliveryTime: rec.deliveryTime,
      inStock: rec.inStock,
      calories: rec.calories,
      protein: rec.protein,
      healthyScore: rec.healthyScore,
      healthyLevel: rec.healthyLevel || '',
      sizes: (it.sizes || []).map(s => ({ name: s.name, extraPrice: s.extraPrice || 0 })),
      toppingsCount: Array.isArray(it.toppings) ? it.toppings.length : 0,
      description: it.description || '',
      image: it.image || 'assets/images/hung_chien_gion.webp',
      toppings: it.toppings || []
    };
  },

  search(params = {}) {
    this.ensureFresh();
    const t0 = performance.now();

    const rawQuery = Array.isArray(params.keywords)
      ? params.keywords.join(' ')
      : String(params.query || params.keyword || '');
    const qLower = rawQuery.toLowerCase().trim();
    const hasAccents = qLower !== removeVnTones(qLower);
    const qAscii = removeVnTones(qLower).trim();
    const stopWords = new Set(['mon', 'an', 'do', 'quan', 'ngon', 'cho', 'minh', 'tim', 'goi', 'cac', 'nhung', 'ptit', 'quanh', 'gia', 'duoi', 'tren']);
    const queryTokens = tokenizeText(qAscii).filter(tk => !stopWords.has(tk));

    const catInputs = Array.isArray(params.categories)
      ? params.categories
      : (params.category ? [params.category] : []);
    const catFiltersLower = catInputs.map(c => String(c).toLowerCase().trim()).filter(Boolean);
    const catFiltersAscii = catInputs.map(c => removeVnTones(c).trim()).filter(Boolean);

    const tagInputs = Array.isArray(params.tags)
      ? params.tags
      : (params.tag ? [params.tag] : []);
    const tagsAscii = tagInputs.map(t => removeVnTones(t).trim()).filter(Boolean);

    const minPrice = params.minPrice !== undefined && params.minPrice !== null && params.minPrice !== ''
      ? Number(params.minPrice)
      : null;
    const maxPrice = params.maxPrice !== undefined && params.maxPrice !== null && params.maxPrice !== ''
      ? Number(params.maxPrice)
      : null;
    const freeshipOnly = Boolean(params.freeshipOnly);
    const inStockOnly = params.inStockOnly !== false;
    const restaurantId = params.restaurantId ? Number(params.restaurantId) : null;
    const storeQueryAscii = params.storeQuery ? removeVnTones(params.storeQuery).trim() : '';
    const maxCalories = params.maxCalories ? Number(params.maxCalories) : null;
    const minProtein = params.minProtein ? Number(params.minProtein) : null;
    const minHealthyScore = params.minHealthyScore ? Number(params.minHealthyScore) : null;
    const dietMode = String(params.dietMode || '').toLowerCase();
    const excludeSet = new Set(Array.isArray(params.excludeIds) ? params.excludeIds.map(String) : []);
    const sortBy = String(params.sortBy || 'relevance').toLowerCase();
    const limit = Math.max(1, Math.min(20, Number(params.limit) || 8));
    const offset = Math.max(0, Number(params.offset) || 0);

    // Thu hẹp tập ứng viên qua Chỉ mục (Inverted Index / Store Index / Category Index)
    let candidateIndices = null;

    if (restaurantId && this.storeItemsMap.has(restaurantId)) {
      candidateIndices = new Set(this.storeItemsMap.get(restaurantId));
    }

    let tagCatMatched = null;
    if (catFiltersAscii.length > 0) {
      const catMatched = new Set();
      for (const [indexedCat, idxList] of this.categoryMap.entries()) {
        if (catFiltersAscii.some(cf => indexedCat.includes(cf) || cf.includes(indexedCat))) {
          idxList.forEach(i => catMatched.add(i));
        }
      }
      if (this.tagCategoryMap) {
        for (const [tagCatKey, idxSet] of this.tagCategoryMap.entries()) {
          if (catFiltersAscii.some(cf => tagCatKey.includes(cf) || cf.includes(tagCatKey))) {
            if (!tagCatMatched) tagCatMatched = new Set();
            idxSet.forEach(i => tagCatMatched.add(i));
          }
        }
      }
      if (catMatched.size > 0) {
        candidateIndices = candidateIndices
          ? new Set([...candidateIndices].filter(i => catMatched.has(i)))
          : catMatched;
      }
    }

    // Nếu có queryTokens và chưa thu hẹp quá nhỏ, gom tập hợp từ Inverted Index (OR union + chấm điểm TF)
    if (queryTokens.length > 0 && (!candidateIndices || candidateIndices.size > 500)) {
      const tokenHits = new Set();
      queryTokens.forEach(tk => {
        // Khớp chính xác token trong bảng băm O(1)
        const exactList = this.invertedTokens.get(tk);
        if (exactList) exactList.forEach(i => tokenHits.add(i));
        // Chỉ khớp tiền tố khi từ khóa dài >= 5 ký tự (tránh "pho" khớp nhầm "phong")
        if (tk.length >= 5) {
          for (const [indexedTk, list] of this.invertedTokens.entries()) {
            if (indexedTk !== tk && indexedTk.startsWith(tk)) {
              list.forEach(i => tokenHits.add(i));
            }
          }
        }
      });
      if (tokenHits.size > 0) {
        candidateIndices = candidateIndices
          ? new Set([...candidateIndices].filter(i => tokenHits.has(i)))
          : tokenHits;
      } else if (!candidateIndices && catFiltersAscii.length === 0 && tagsAscii.length === 0) {
        // Không có token nào tồn tại trong toàn bộ chỉ mục
        candidateIndices = new Set();
      }
    }

    const iterIndices = candidateIndices
      ? Array.from(candidateIndices)
      : this.items.map((_, i) => i);

    const results = [];

    for (const i of iterIndices) {
      const rec = this.items[i];
      if (!rec) continue;

      // 1. Lọc cứng (Hard Filters)
      if (inStockOnly && !rec.inStock) continue;
      if (excludeSet.has(rec.id)) continue;
      if (restaurantId && rec.restaurantId !== restaurantId) continue;
      if (storeQueryAscii && !rec.storeAscii.includes(storeQueryAscii)) continue;
      if (minPrice !== null && rec.price < minPrice) continue;
      if (maxPrice !== null && rec.price > maxPrice) continue;
      if (freeshipOnly && !rec.isFreeship) continue;
      if (maxCalories !== null && rec.calories > maxCalories) continue;
      if (minProtein !== null && rec.protein < minProtein) continue;
      if (minHealthyScore !== null && rec.healthyScore < minHealthyScore) continue;

      if (catFiltersAscii.length > 0) {
        const matchesCat = (tagCatMatched && tagCatMatched.has(i)) || catFiltersLower.some((cl, idx) => {
          const cf = catFiltersAscii[idx];
          const clHasTone = cl !== cf;
          if (clHasTone) {
            return rec.catLower.includes(cl) || cl.includes(rec.catLower) || rec.nameLower.includes(cl);
          }
          return rec.catAscii === cf || rec.catTokenSet.has(cf) || rec.nameTokenSet.has(cf) || (cf.length >= 5 && rec.catAscii.includes(cf));
        });
        if (!matchesCat) continue;
      }

      // 2. Chấm điểm độ phù hợp (Relevance Scoring)
      let score = 10;

      if (qLower.length >= 2 && hasAccents) {
        if (rec.nameLower.includes(qLower)) score += 80;
        if (rec.catLower.includes(qLower)) score += 60;
        if (rec.storeLower.includes(qLower)) score += 35;
      } else if (qAscii.length >= 4) {
        if (rec.nameAscii.includes(qAscii)) score += 55;
        if (rec.catAscii.includes(qAscii)) score += 40;
      }

      let matchedTokenCount = 0;
      queryTokens.forEach(tk => {
        let hit = false;
        if (rec.nameTokenSet.has(tk)) { score += 28; hit = true; }
        if (rec.catTokenSet.has(tk)) { score += 22; hit = true; }
        if (rec.storeTokenSet.has(tk)) { score += 10; hit = true; }
        if (rec.descTokenSet.has(tk)) { score += 6; hit = true; }
        if (hit) matchedTokenCount++;
      });

      // Nếu người dùng truyền từ khóa có dấu tiếng Việt, kiểm tra khớp dấu để phân biệt (VD "phở" vs "phố")
      if (hasAccents && queryTokens.length > 0 && catFiltersAscii.length === 0 && tagsAscii.length === 0) {
        const accentedWords = qLower.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(removeVnTones(w)));
        const anyAccentMatch = accentedWords.some(aw =>
          rec.nameLower.includes(aw) || rec.catLower.includes(aw) || rec.storeLower.includes(aw) || rec.descLower.includes(aw)
        );
        if (!anyAccentMatch) continue;
      }

      // Nếu người dùng truyền từ khóa cụ thể nhưng không có danh mục/tag nào khác, yêu cầu ít nhất 1 token khớp
      if (queryTokens.length > 0 && catFiltersAscii.length === 0 && tagsAscii.length === 0 && matchedTokenCount === 0) {
        continue;
      }

      // Khớp theo Tags ngữ nghĩa (cay, giòn, nóng, thanh đạm, ngọt...)
      tagsAscii.forEach(tg => {
        if (rec.fullAscii.includes(tg)) score += 20;
        if ((tg.includes('cay') || tg === 'spicy') && /cay|ot|sa te|hoa nguc|bun bo|lau/.test(rec.fullAscii)) score += 22;
        if ((tg.includes('gion') || tg.includes('chien') || tg === 'crispy') && /chien|gion|ran|nuong|banh mi|banh xeo/.test(rec.fullAscii)) score += 22;
        if ((tg.includes('nong') || tg.includes('nuoc') || tg === 'hot') && /pho|bun|chao|lau|mien|hu tieu|sup/.test(rec.fullAscii)) score += 20;
        if ((tg.includes('thanh dam') || tg.includes('healthy') || tg.includes('rau')) && rec.healthyScore >= 8.5) score += 24;
        if ((tg.includes('ngot') || tg.includes('giai khat') || tg.includes('uong')) && /tra sua|ca phe|che|tra|nuoc/.test(rec.fullAscii)) score += 22;
      });

      // Chế độ dinh dưỡng
      if (dietMode === 'high_protein') score += rec.protein * 1.2;
      if (dietMode === 'low_cal') score += Math.max(0, (650 - rec.calories) / 15);
      if (dietMode === 'healthy') score += rec.healthyScore * 3;

      // Điểm cộng chất lượng quán & freeship
      score += rec.rating * 1.5;
      if (rec.isFreeship) score += 4;

      results.push({ rec, score });
    }

    // 3. Sắp xếp
    results.sort((a, b) => {
      if (sortBy === 'price_asc') return a.rec.price - b.rec.price || b.score - a.score;
      if (sortBy === 'price_desc') return b.rec.price - a.rec.price || b.score - a.score;
      if (sortBy === 'rating_desc') return b.rec.rating - a.rec.rating || b.score - a.score;
      if (sortBy === 'distance_asc') return a.rec.distance - b.rec.distance || b.score - a.score;
      if (sortBy === 'calories_asc') return a.rec.calories - b.rec.calories || b.score - a.score;
      if (sortBy === 'protein_desc') return b.rec.protein - a.rec.protein || b.score - a.score;
      if (sortBy === 'healthy_desc') return b.rec.healthyScore - a.rec.healthyScore || b.score - a.score;
      return b.score - a.score || a.rec.price - b.rec.price;
    });

    const sliced = results.slice(offset, offset + limit).map(r => this.formatCompactItem(r.rec));
    const elapsedMs = Number((performance.now() - t0).toFixed(2));

    return {
      totalCatalogSize: this.items.length,
      totalMatched: results.length,
      returnedCount: sliced.length,
      offset,
      limit,
      elapsedMs,
      items: sliced
    };
  },

  getItemsByIds(ids = []) {
    this.ensureFresh();
    const list = (Array.isArray(ids) ? ids : [ids]).slice(0, 15);
    const found = [];
    list.forEach(id => {
      const rec = this.itemById.get(String(id));
      if (!rec) return;
      const store = this.storeById.get(rec.restaurantId) || {};
      found.push({
        ...this.formatCompactItem(rec),
        storeAddress: store.address || '',
        storeVouchers: store.vouchers || []
      });
    });
    return { count: found.length, items: found };
  },

  searchStores(params = {}) {
    this.ensureFresh();
    const stores = Array.isArray(this.rawDb?.restaurants) ? this.rawDb.restaurants : [];
    const qAscii = removeVnTones(params.query || '').trim();
    const catAscii = removeVnTones(params.category || '').trim();
    const freeshipOnly = Boolean(params.freeshipOnly);
    const sortBy = String(params.sortBy || 'distance_asc').toLowerCase();
    const limit = Math.max(1, Math.min(12, Number(params.limit) || 6));

    let matched = stores.filter(s => {
      if (s.id === 1000 && (this.storeItemsMap.get(1000) || []).length === 0) return false;
      if (freeshipOnly && !s.isFreeship) return false;
      const sName = removeVnTones(s.name || '');
      const sCat = removeVnTones(s.category || '');
      if (qAscii && !sName.includes(qAscii) && !sCat.includes(qAscii)) return false;
      if (catAscii && !sCat.includes(catAscii) && !sName.includes(catAscii)) return false;
      return true;
    });

    matched.sort((a, b) => {
      if (sortBy === 'rating_desc') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      return (Number(a.distance) || 1) - (Number(b.distance) || 1);
    });

    const out = matched.slice(0, limit).map(s => {
      const itemIndices = this.storeItemsMap.get(Number(s.id)) || [];
      const sampleItems = itemIndices.slice(0, 5).map(idx => {
        const r = this.items[idx];
        return { id: r.id, name: r.name, price: r.price, inStock: r.inStock };
      });
      return {
        id: s.id,
        name: s.name,
        category: s.category,
        rating: s.rating,
        distanceText: s.distanceText || `${s.distance || 0.8} km`,
        deliveryTime: s.deliveryTime,
        shippingFee: s.shippingFee,
        isFreeship: Boolean(s.isFreeship),
        vouchers: s.vouchers || [],
        address: s.address || '',
        totalMenuItems: itemIndices.length,
        sampleItems
      };
    });

    return { totalMatched: matched.length, stores: out };
  }
};

// Khởi tạo chỉ mục ngay khi bật Server
CatalogIndex.ensureFresh();

// ==========================================================================
// 2. AI PROXY & API ROUTES
// ==========================================================================

function normalizeTargetEndpoint(rawUrl, provider = '') {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  if (provider === 'gemini' || trimmed.includes('generativelanguage.googleapis.com') || trimmed.includes(':generateContent')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, '');

    if (pathname === '' || pathname === '/') {
      if (parsed.hostname.includes('deepseek.com')) {
        parsed.pathname = '/chat/completions';
      } else {
        parsed.pathname = '/v1/chat/completions';
      }
      return parsed.toString();
    }

    if (pathname === '/v1' || pathname === '/api/v1' || pathname === '/openai/v1') {
      parsed.pathname = `${pathname}/chat/completions`;
      return parsed.toString();
    }
  } catch (_) {}

  return trimmed;
}

async function handleAIProxy(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    let proxyReq;
    try {
      proxyReq = JSON.parse(rawBody || '{}');
    } catch (_) {
      return sendJson(res, 400, { error: { message: 'Body gửi lên Proxy không phải JSON hợp lệ.' } });
    }

    const method = (proxyReq.method || 'POST').toUpperCase();
    const rawTarget = String(proxyReq.targetUrl || '').trim();
    const normalizedUrl = method === 'GET'
      ? rawTarget
      : normalizeTargetEndpoint(rawTarget, proxyReq.provider);
    if (!normalizedUrl) {
      return sendJson(res, 400, { error: { message: 'Thiếu địa chỉ API Endpoint (targetUrl).' } });
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(normalizedUrl);
    } catch (_) {
      return sendJson(res, 400, { error: { message: `URL không hợp lệ: "${normalizedUrl}"` } });
    }

    if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
      return sendJson(res, 400, { error: { message: 'Chỉ hỗ trợ giao thức http:// hoặc https://' } });
    }

    const forwardHeaders = method === 'GET'
      ? { Accept: 'application/json' }
      : { 'Content-Type': 'application/json' };
    if (proxyReq.headers && typeof proxyReq.headers === 'object') {
      for (const [key, val] of Object.entries(proxyReq.headers)) {
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          forwardHeaders[key] = String(val);
        }
      }
    }

    const upstreamPayload = typeof proxyReq.body === 'string'
      ? proxyReq.body
      : JSON.stringify(proxyReq.body || {});

    const stageTag = proxyReq.stage ? ` [${proxyReq.stage}]` : '';
    const timeLabel = new Date().toLocaleTimeString('vi-VN');
    console.log(`[${timeLabel}] 🤖 AI Proxy${stageTag} -> ${method} ${normalizedUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let upstreamRes;
    try {
      upstreamRes = await fetch(normalizedUrl, {
        method,
        headers: forwardHeaders,
        body: method === 'GET' ? undefined : upstreamPayload,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await upstreamRes.text();
    setCorsHeaders(res);
    res.setHeader('X-Proxy-Normalized-Url', normalizedUrl);
    res.writeHead(upstreamRes.status, {
      'Content-Type': upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8'
    });
    res.end(responseText);
  } catch (err) {
    console.error('❌ Lỗi AI Proxy:', err.message);
    const msg = err.name === 'AbortError'
      ? 'Quá thời gian chờ phản hồi từ máy chủ AI (Timeout 90s).'
      : `Local Proxy không thể kết nối tới máy chủ AI: ${err.message}`;
    sendJson(res, 502, { error: { message: msg } });
  }
}

async function handleCatalogRoutes(req, res, pathname, reqUrl) {
  if (pathname === '/api/catalog/overview' && req.method === 'GET') {
    CatalogIndex.ensureFresh();
    return sendJson(res, 200, CatalogIndex.overviewCache);
  }

  if (pathname === '/api/catalog/search') {
    try {
      let params = {};
      if (req.method === 'POST') {
        const raw = await readRequestBody(req);
        params = JSON.parse(raw || '{}');
      } else {
        reqUrl.searchParams.forEach((v, k) => { params[k] = v; });
      }
      const result = CatalogIndex.search(params);
      const timeLabel = new Date().toLocaleTimeString('vi-VN');
      console.log(
        `[${timeLabel}] 🔎 Catalog Search -> Khớp ${result.totalMatched}/${result.totalCatalogSize} món (trả về ${result.returnedCount}) trong ${result.elapsedMs}ms`
      );
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: `Lỗi truy vấn mặt hàng: ${err.message}` });
    }
  }

  if (pathname === '/api/catalog/items-by-ids' && req.method === 'POST') {
    try {
      const raw = await readRequestBody(req);
      const body = JSON.parse(raw || '{}');
      return sendJson(res, 200, CatalogIndex.getItemsByIds(body.ids || body.itemIds || []));
    } catch (err) {
      return sendJson(res, 400, { error: `Lỗi lấy chi tiết món: ${err.message}` });
    }
  }

  if (pathname === '/api/catalog/stores') {
    try {
      let params = {};
      if (req.method === 'POST') {
        const raw = await readRequestBody(req);
        params = JSON.parse(raw || '{}');
      } else {
        reqUrl.searchParams.forEach((v, k) => { params[k] = v; });
      }
      return sendJson(res, 200, CatalogIndex.searchStores(params));
    } catch (err) {
      return sendJson(res, 400, { error: `Lỗi truy vấn cửa hàng: ${err.message}` });
    }
  }

  return false;
}

async function handleDatabaseApi(req, res) {
  if (req.method === 'GET') {
    try {
      const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
      setCorsHeaders(res);
      res.setHeader('X-PTITNGON-DB', '1');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(content);
    } catch (err) {
      sendJson(res, 500, { error: `Không thể đọc database.json: ${err.message}` });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody);
      const newFormatted = JSON.stringify(parsed, null, 2);
      if (fs.existsSync(DB_FILE_PATH)) {
        const curContent = fs.readFileSync(DB_FILE_PATH, 'utf8');
        if (curContent !== newFormatted) {
          fs.writeFileSync(DB_FILE_PATH, newFormatted, 'utf8');
        }
      } else {
        fs.writeFileSync(DB_FILE_PATH, newFormatted, 'utf8');
      }
      syncFoodDataSeedFile(parsed);
      CatalogIndex.ensureFresh();
      sendJson(res, 200, { ok: true }, { 'X-PTITNGON-DB': '1' });
    } catch (err) {
      sendJson(res, 400, { error: `Không thể lưu database.json: ${err.message}` });
    }
    return;
  }

  sendJson(res, 405, { error: 'Method Not Allowed' });
}

async function handleAIProfilesApi(req, res) {
  if (req.method === 'GET') {
    try {
      if (!fs.existsSync(AI_PROFILES_FILE_PATH)) {
        return sendJson(res, 200, { activeProfileId: null, profiles: [], updatedAt: null });
      }
      const raw = fs.readFileSync(AI_PROFILES_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      return sendJson(res, 200, {
        activeProfileId: parsed.activeProfileId || null,
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        updatedAt: parsed.updatedAt || null
      });
    } catch (err) {
      return sendJson(res, 500, { error: `Không thể đọc ai-profiles.json: ${err.message}` });
    }
  }

  if (req.method === 'POST') {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody || '{}');
      const payload = {
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        activeProfileId: parsed.activeProfileId || null,
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : []
      };
      fs.writeFileSync(AI_PROFILES_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
      return sendJson(res, 200, { ok: true, count: payload.profiles.length });
    } catch (err) {
      return sendJson(res, 400, { error: `Không thể lưu ai-profiles.json: ${err.message}` });
    }
  }

  sendJson(res, 405, { error: 'Method Not Allowed' });
}

// Lưu ảnh người dùng thả / AI tạo ra thành file thật trong assets/images/uploads/
// (tránh nhồi ảnh base64 vào database.json & localStorage)
const UPLOAD_DIR = path.join(ROOT_DIR, 'assets', 'images', 'uploads');
const UPLOAD_EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function slugifyUploadName(rawName) {
  return String(rawName || 'image')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'image';
}

function saveImageBufferToUploads(buffer, ext, nameHint) {
  const safeExt = ['.jpg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
  const baseName = slugifyUploadName(nameHint);
  const fileName = `${baseName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${safeExt}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);
  return `assets/images/uploads/${fileName}`;
}

function detectImageExtFromBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return '.gif';
  return null;
}

function isSafePublicUrl(urlStr) {
  try {
    const u = new URL(String(urlStr || '').trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host === '::1' || host === '0.0.0.0') return false;
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^(127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    if (/^(fc|fd|fe80):/i.test(host)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

async function fetchTextWithTimeout(url, headers = {}, timeoutMs = 7500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', headers, redirect: 'follow', signal: controller.signal });
    if (!res.ok) return { ok: false, status: res.status, text: '', finalUrl: res.url || url };
    const text = await res.text();
    return { ok: true, status: res.status, text, finalUrl: res.url || url };
  } catch (_) {
    return { ok: false, status: 0, text: '', finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

const BLOCKED_DOC_OR_UI_HOST_RE = /(?:^|\/\/|\.)(google\.[a-z.]+|gstatic\.com|googleapis\.com|ggpht\.com|googleusercontent\.com\/a\/|youtube\.com|ytimg\.com\/yts|wikimedia\.org|wikipedia\.org|wikisource\.org|wiktionary\.org|gallica\.bnf\.fr|archive\.org|openlibrary\.org|scribd\.com|slideshare\.net|studocu\.com|researchgate\.net|123doc[a-z0-9.]*|tailieu[a-z0-9.]*|doc24\.vn|loigiaihay\.com|vietjack\.com|hoc247\.net)/i;
const BLOCKED_DOC_PATH_RE = /\.(svg|ico|pdf|djvu|tif|tiff|eps)(\?|$)|\/page\d+-\d+px-/i;

function isAllowedFoodImageUrl(urlStr) {
  if (!isSafePublicUrl(urlStr)) return false;
  if (BLOCKED_DOC_PATH_RE.test(urlStr)) return false;
  if (BLOCKED_DOC_OR_UI_HOST_RE.test(urlStr)) return false;
  return true;
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

const CULINARY_SEARCH_RULES = [
  { re: /\bpho bo\b/, vi: 'phở bò tái nạm hà nội', en: 'vietnamese beef pho noodle soup bowl', mealDb: 'Pho' },
  { re: /\bpho ga\b/, vi: 'phở gà ta nước trong', en: 'vietnamese chicken pho noodle soup', mealDb: 'Pho' },
  { re: /\bpho cuon\b/, vi: 'phở cuốn thịt bò rau thơm', en: 'vietnamese fresh beef rice noodle rolls' },
  { re: /\bpho\b/, vi: 'phở truyền thống việt nam', en: 'vietnamese pho noodle soup bowl', mealDb: 'Pho' },
  { re: /\bbun bo\b/, vi: 'bún bò huế giò heo', en: 'bun bo hue spicy beef noodle soup' },
  { re: /\bbun cha\b/, vi: 'bún chả thịt nướng hà nội', en: 'vietnamese bun cha grilled pork vermicelli' },
  { re: /\bbun dau\b/, vi: 'bún đậu mắm tôm mẹt đầy đủ', en: 'vietnamese bun dau mam tom fried tofu platter' },
  { re: /\bbun rieu\b/, vi: 'bún riêu cua đồng đậu phụ', en: 'vietnamese crab tomato noodle soup bun rieu' },
  { re: /\bbun thit nuong\b/, vi: 'bún thịt nướng chả giò', en: 'vietnamese grilled pork spring roll vermicelli' },
  { re: /\bbun ca\b|\bbun hai san\b/, vi: 'bún cá hải sản dọc mùng', en: 'vietnamese fish seafood noodle soup' },
  { re: /\bmi cay\b/, vi: 'mì cay hải sản bò mỹ hàn quốc', en: 'korean spicy seafood ramen noodles bowl' },
  { re: /\bmi tron\b|\bmi xao\b/, vi: 'mì trộn xào thập cẩm trứng lòng đào', en: 'asian stir fried noodles egg dish' },
  { re: /\bmi y\b|\bspaghetti\b|\bpasta\b/, vi: 'mì ý sốt bò bằm phô mai', en: 'spaghetti bolognese pasta plate', mealDb: 'Spaghetti' },
  { re: /\bramen\b|\budon\b/, vi: 'mì ramen nhật bản trứng ngâm tương', en: 'japanese ramen noodle soup soft boiled egg' },
  { re: /\bhu tieu\b|\bmien\b/, vi: 'hủ tiếu nam vang tôm thịt', en: 'vietnamese clear pork shrimp noodle soup' },
  { re: /\bbanh mi\b/, vi: 'bánh mì thịt nướng pate giòn rụm', en: 'vietnamese banh mi crispy baguette sandwich', mealDb: 'Banh Mi' },
  { re: /\bcom tam\b|\bcom suon\b/, vi: 'cơm tấm sườn bì chả trứng ốp la', en: 'vietnamese broken rice grilled pork chop com tam' },
  { re: /\bcom ga\b/, vi: 'cơm gà xối mỡ da giòn', en: 'crispy fried chicken rice plate asian food' },
  { re: /\bcom rang\b|\bcom chien\b/, vi: 'cơm rang dưa bò dương châu', en: 'asian golden egg fried rice bowl' },
  { re: /\bcom tron\b|\bbibimbap\b/, vi: 'cơm trộn hàn quốc bibimbap', en: 'korean bibimbap mixed rice bowl' },
  { re: /\bgoi cuon\b|\bnem cuon\b/, vi: 'gỏi cuốn tôm thịt tươi nước chấm', en: 'vietnamese fresh shrimp spring rolls' },
  { re: /\bnem nuong\b/, vi: 'nem nướng nha trang cuốn rau sống', en: 'vietnamese grilled pork sausage rolls platter' },
  { re: /\bnem chua ran\b/, vi: 'nem chua rán phố cổ hà nội', en: 'crispy fried pork sticks vietnamese street snack' },
  { re: /\bga ran\b|\bga chien\b|\bcanh ga\b/, vi: 'gà rán sốt cay giòn rụm', en: 'crispy golden korean fried chicken', mealDb: 'Chicken' },
  { re: /\bxien nuong\b|\bthit xien\b|\bnuong bbq\b|\bdo nuong\b/, vi: 'thịt xiên nướng than hoa đường phố', en: 'grilled bbq meat skewers street food' },
  { re: /\bca vien\b|\bxien ban\b|\bkhoai tay chien\b|\bchien gion\b/, vi: 'đồ ăn vặt xiên que chiên giòn', en: 'crispy fried street food snacks platter' },
  { re: /\bbanh xeo\b|\bbanh khot\b/, vi: 'bánh xèo tôm thịt vàng giòn rau sống', en: 'vietnamese crispy turmeric crepe banh xeo' },
  { re: /\bbanh cuon\b|\bbanh uot\b/, vi: 'bánh cuốn nóng chả quế hành phi', en: 'vietnamese steamed rice rolls banh cuon' },
  { re: /\bbanh trang tron\b|\bbanh trang nuong\b/, vi: 'bánh tráng trộn bò khô trứng cút xoài', en: 'vietnamese rice paper street snack salad' },
  { re: /\btokbokki\b|\bbanh gao\b/, vi: 'bánh gạo cay tokbokki phô mai hàn quốc', en: 'korean spicy tteokbokki cheese rice cakes' },
  { re: /\bkimbap\b|\bsushi\b/, vi: 'cơm cuộn rong biển sushi kimbap', en: 'sushi kimbap rolls platter', mealDb: 'Sushi' },
  { re: /\bpizza\b/, vi: 'bánh pizza hải sản phô mai kéo sợi', en: 'cheesy pizza slice food photography', mealDb: 'Pizza' },
  { re: /\bburger\b|\bhamburger\b/, vi: 'bánh burger bò nướng phô mai khoai chiên', en: 'juicy beef cheeseburger fries', mealDb: 'Burger' },
  { re: /\bbit tet\b|\bbo ne\b|\bsteak\b/, vi: 'bò né bít tết chảo gang trứng pate', en: 'sizzling beef steak egg skillet', mealDb: 'Steak' },
  { re: /\bsalad\b|\buc ga\b|\beat clean\b|\bgao lut\b/, vi: 'salad ức gà áp chảo bơ rau xanh eat clean', en: 'healthy grilled chicken avocado salad bowl', mealDb: 'Salad' },
  { re: /\blau\b|\bhotpot\b/, vi: 'nồi lẩu thái hải sản chua cay sôi sùng sục', en: 'asian spicy seafood hotpot soup pot' },
  { re: /\bchao\b|\bsup\b/, vi: 'cháo sườn súp cua trứng bắc thảo nóng', en: 'asian savory rice porridge soup bowl' },
  { re: /\bxoi\b/, vi: 'xôi xéo thịt kho trứng chả mỡ hành', en: 'vietnamese savory sticky rice toppings bowl' },
  { re: /\bdimsum\b|\bha cao\b|\bbanh bao\b/, vi: 'há cảo tôm thịt dimsum hấp xửng tre', en: 'steamed shrimp dim sum dumplings basket' },
  { re: /\btra sua\b|\btran chau\b|\bkem cheese\b|\bmatcha\b/, vi: 'ly trà sữa trân châu đường đen kem phô mai', en: 'brown sugar boba pearl milk tea cup' },
  { re: /\btra dao\b|\btra vai\b|\btra chanh\b|\btra tac\b|\btra trai cay\b/, vi: 'ly trà đào cam sả trái cây tươi đá mát', en: 'iced peach orange fruit tea glass' },
  { re: /\bca phe\b|\bbac xiu\b|\blatte\b|\bamericano\b/, vi: 'ly cà phê sữa đá phin việt nam', en: 'vietnamese iced condensed milk coffee glass', cocktailDb: 'Coffee' },
  { re: /\bnuoc ep\b|\bsinh to\b|\bsmoothie\b|\bsua chua\b/, vi: 'ly sinh tố nước ép trái cây tươi nhiệt đới', en: 'fresh tropical fruit smoothie juice glass', cocktailDb: 'Smoothie' },
  { re: /\bche\b|\btau hu\b|\bflan\b/, vi: 'bát chè khúc bạch đậu đỏ nước cốt dừa', en: 'asian sweet dessert bowl coconut milk' },
  { re: /\bbanh ngot\b|\btiramisu\b|\bmochi\b|\bbong lan\b|\bcroissant\b/, vi: 'bánh ngọt tiramisu kem phô mai mềm mịn', en: 'artisan cake pastry dessert plate', mealDb: 'Cake' },
  { re: /\bcom\b/, vi: 'cơm phần món mặn việt nam đầy đặn', en: 'vietnamese savory rice dish plate' }
];

function stripCampusAndPromoNoise(str) {
  return String(str || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(ptit|ha dong|hà đông|ao sen|mo lao|mộ lao|nguyen trai|nguyễn trãi|tran phu|trần phú|ktx|b1|b2|cong truong|cổng trường|sinh vien|sinh viên|gia re|giá rẻ|gia truyen|gia truyền|chinh hieu|chính hiệu|so\s*\d+|số\s*\d+|combo\s*\d*|suat|suất|phan|phần|full topping|freeship|0đ)\b/giu, ' ')
    .replace(/(?:^|\s)(siêu to|khổng lồ|giá sinh viên|cấp độ sinh viên|cấp độ\s*\d+|chuẩn vị|nhà làm|đặc biệt|thượng hạng|nóng hổi|dẻo béo|giòn rụm|size\s*[smlxl]+)(?=\s|$)/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCulinarySearchPlan(rawQuery, { category = '', extraQuery = '' } = {}) {
  const explicitParts = String(extraQuery || '').split('|').map(s => s.trim()).filter(Boolean);
  const rawClean = stripCampusAndPromoNoise(rawQuery)
    .replace(/\s*\bmón ăn(\s+ngon)?\s*$/iu, '')
    .trim();
  const baseVi = explicitParts[0] || rawClean || String(rawQuery || '').trim() || 'món ăn ngon';
  const explicitEn = explicitParts[1] || '';

  const normBlob = removeVnTones(`${baseVi} ${rawQuery} ${category} ${extraQuery}`);
  const matchedRule = CULINARY_SEARCH_RULES.find(r => r.re.test(normBlob)) || null;

  const viQueries = [];
  const enQueries = [];
  const pushVi = s => {
    const v = String(s || '').replace(/\s+/g, ' ').trim();
    if (v && !viQueries.some(x => x.toLowerCase() === v.toLowerCase())) viQueries.push(v);
  };
  const pushEn = s => {
    const v = String(s || '').replace(/\s+/g, ' ').trim();
    if (v && !enQueries.some(x => x.toLowerCase() === v.toLowerCase())) enQueries.push(v);
  };

  pushVi(`${baseVi} món ăn`);
  if (matchedRule?.vi) pushVi(matchedRule.vi);
  const words = baseVi.split(/\s+/).filter(Boolean);
  if (words.length > 3) pushVi(`${words.slice(0, 3).join(' ')} món ăn ngon`);
  if (category) pushVi(`${stripCampusAndPromoNoise(category)} món ngon`);

  if (explicitEn) pushEn(explicitEn);
  if (matchedRule?.en) pushEn(matchedRule.en);
  pushEn(`${removeVnTones(words.slice(0, 4).join(' '))} vietnamese food dish`);

  return {
    baseVi,
    viQueries: viQueries.slice(0, 4),
    enQueries: enQueries.slice(0, 3),
    mealDb: matchedRule?.mealDb || '',
    cocktailDb: matchedRule?.cocktailDb || ''
  };
}

function buildFoodQueryVariants(rawQuery) {
  const base = String(rawQuery || '').replace(/\s+/g, ' ').trim();
  if (!base) return [];
  const cleaned = base
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(?:^|\s)(siêu to|khổng lồ|giá sinh viên|cấp độ sinh viên|cấp độ\s*\d+|chuẩn vị|nhà làm|đặc biệt|thượng hạng|nóng hổi|dẻo béo|giòn rụm|size\s*[smlxl]+)(?=\s|$)/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const variants = [];
  const pushUnique = v => {
    const s = String(v || '').replace(/\s+/g, ' ').trim();
    if (s && !variants.some(x => x.toLowerCase() === s.toLowerCase())) variants.push(s);
  };

  pushUnique(cleaned || base);
  if (cleaned !== base) pushUnique(base);

  // Nếu tên món do AI đặt quá dài (> 5 từ), tạo thêm truy vấn cốt lõi (4 từ đầu + "món ăn") để luôn khớp ảnh thật
  const withoutSuffix = (cleaned || base).replace(/\s*\bmón ăn(\s+ngon)?\s*$/i, '').trim();
  const words = withoutSuffix.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    pushUnique(`${words.slice(0, 4).join(' ')} món ăn`);
  }
  if (words.length > 2) {
    pushUnique(`${words.slice(0, 3).join(' ')} món ăn`);
  }
  return variants.slice(0, 3);
}

function parseGoogleImagesHtml(rawHtml, limit = 8) {
  if (!rawHtml || rawHtml.includes('/sorry/index') || rawHtml.includes('Our systems have detected unusual traffic')) {
    return [];
  }
  const unescaped = rawHtml
    .replace(/\\x22/gi, '"')
    .replace(/\\u0022/gi, '"')
    .replace(/\\"/g, '"')
    .replace(/\\x3d|\\u003d/gi, '=')
    .replace(/\\x26|\\u0026/gi, '&')
    .replace(/\\x2f|\\u002f/gi, '/')
    .replace(/\\u0025/gi, '%')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&');

  const results = [];
  const fallbackThumbs = [];
  const seen = new Set();
  let lastThumb = '';

  // 1. Cấu trúc mảng kích thước ["https://...", h, w] trong AF_initDataCallback / WIZ state
  const re = /\["(https?:\/\/[^"\s<>\\]+)",\s*(\d{2,4}),\s*(\d{2,4})\]/g;
  let m;
  while ((m = re.exec(unescaped)) !== null) {
    const url = m[1];
    const n1 = Number(m[2]);
    const n2 = Number(m[3]);
    if (!isSafePublicUrl(url)) continue;

    if (/encrypted-tbn\d*\.gstatic\.com\/images\?q=tbn:/i.test(url)) {
      lastThumb = url;
      if (!seen.has(url) && fallbackThumbs.length < limit) {
        seen.add(url);
        fallbackThumbs.push({ url, thumbUrl: url, width: n2, height: n1 });
      }
      continue;
    }

    if (!isAllowedFoodImageUrl(url)) continue;
    if (Math.max(n1, n2) < 180 || Math.min(n1, n2) < 120) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    results.push({
      url,
      thumbUrl: lastThumb || url,
      width: n2,
      height: n1
    });
    if (results.length >= limit) return results;
  }

  // 2. Đường dẫn imgurl= trực tiếp (nếu có trong HTML tĩnh / gbv=1)
  const imgUrlRe = /[?&]imgurl=(https?(?:%3A%2F%2F|:\/\/)[^&"'\s<>]+)/gi;
  while ((m = imgUrlRe.exec(unescaped)) !== null) {
    let decoded = m[1];
    try { decoded = decodeURIComponent(decoded); } catch (_) {}
    if (!isAllowedFoodImageUrl(decoded) || seen.has(decoded)) continue;
    seen.add(decoded);
    results.push({ url: decoded, thumbUrl: decoded, width: 0, height: 0 });
    if (results.length >= limit) return results;
  }

  // 3. Thẻ <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:..."> (chế độ HTML cơ bản gbv=1)
  const domThumbRe = /src="(https:\/\/encrypted-tbn\d*\.gstatic\.com\/images\?q=tbn:[^"\s<>]+)"/gi;
  while ((m = domThumbRe.exec(unescaped)) !== null) {
    const tUrl = decodeHtmlEntities(m[1]);
    if (isSafePublicUrl(tUrl) && !seen.has(tUrl) && fallbackThumbs.length < limit) {
      seen.add(tUrl);
      fallbackThumbs.push({ url: tUrl, thumbUrl: tUrl, width: 0, height: 0 });
    }
  }

  return results.length > 0 ? results : fallbackThumbs.slice(0, limit);
}

function upgradeBingThumbUrl(turl) {
  if (!isSafePublicUrl(turl)) return '';
  if (/(?:tse\d*\.mm\.bing\.net|th\.bing\.com)\/th/i.test(turl) && !/[?&]w=\d+/i.test(turl)) {
    return `${turl}${turl.includes('?') ? '&' : '?'}w=640&h=480&c=7&rs=1`;
  }
  return turl;
}

function parseBingImagesHtml(rawHtml, limit = 8) {
  if (!rawHtml) return [];
  const results = [];
  const seen = new Set();

  // 1. Giải mã JSON từ thuộc tính m="{...}" của <a class="iusc" m="..."> (không phụ thuộc thứ tự murl/turl)
  const attrRe = /\bm=(?:"([^"]*(?:murl|turl)[^"]*)"|'([^']*(?:murl|turl)[^']*)')/gi;
  let m;
  while ((m = attrRe.exec(rawHtml)) !== null) {
    const rawAttr = decodeHtmlEntities(m[1] || m[2] || '');
    try {
      const meta = JSON.parse(rawAttr);
      const murl = String(meta.murl || '').trim();
      const thumbUpgraded = upgradeBingThumbUrl(String(meta.turl || '').trim());
      const primaryUrl = isAllowedFoodImageUrl(murl) ? murl : (isAllowedFoodImageUrl(thumbUpgraded) ? thumbUpgraded : '');
      if (!primaryUrl || seen.has(primaryUrl) || (thumbUpgraded && seen.has(thumbUpgraded))) continue;
      seen.add(primaryUrl);
      if (thumbUpgraded) seen.add(thumbUpgraded);
      results.push({
        url: primaryUrl,
        thumbUrl: thumbUpgraded || primaryUrl,
        title: String(meta.t || '').slice(0, 100),
        provider: 'bing'
      });
      if (results.length >= limit) return results;
    } catch (_) {}
  }

  // 2. Dự phòng: quét JSON đã giải mã HTML entities (bất kể thứ tự trường)
  const decoded = decodeHtmlEntities(rawHtml).replace(/\\\//g, '/');
  const murlRe = /"murl"\s*:\s*"(https?:\/\/[^"\s<>]+)"/gi;
  while ((m = murlRe.exec(decoded)) !== null) {
    const url = m[1];
    if (!isAllowedFoodImageUrl(url) || seen.has(url)) continue;
    seen.add(url);
    results.push({ url, thumbUrl: url, provider: 'bing' });
    if (results.length >= limit) return results;
  }

  // 3. Quét trực tiếp các ảnh OIP chất lượng cao trên CDN th.bing.com / mm.bing.net
  const oipRe = /(https:\/\/(?:th\.bing\.com\/th\/id\/OIP\.[A-Za-z0-9_-]+|tse\d*\.mm\.bing\.net\/th\?id=OIP\.[A-Za-z0-9_.-]+)[^"'\s<>\\]*)/gi;
  while ((m = oipRe.exec(decoded)) !== null) {
    const cleanOip = upgradeBingThumbUrl(m[1].replace(/&amp;/gi, '&'));
    if (!isAllowedFoodImageUrl(cleanOip) || seen.has(cleanOip)) continue;
    seen.add(cleanOip);
    results.push({ url: cleanOip, thumbUrl: cleanOip, provider: 'bing' });
    if (results.length >= limit) break;
  }
  return results;
}

function parseYahooImagesHtml(rawHtml, limit = 8) {
  if (!rawHtml) return [];
  const decoded = decodeHtmlEntities(rawHtml).replace(/\\\//g, '/');
  const results = [];
  const seen = new Set();
  const re = /["']iurl["']\s*:\s*["'](https?:\/\/[^"'\s<>]+)["'](?:[\s\S]{0,300}?["']ith["']\s*:\s*["'](https?:\/\/[^"'\s<>]+)["'])?/gi;
  let m;
  while ((m = re.exec(decoded)) !== null) {
    const url = m[1];
    const thumb = m[2] || '';
    if (!isAllowedFoodImageUrl(url) || seen.has(url)) continue;
    seen.add(url);
    results.push({ url, thumbUrl: isSafePublicUrl(thumb) ? thumb : url, provider: 'yahoo' });
    if (results.length >= limit) break;
  }
  return results;
}

const SEARCH_BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none'
};

const BING_SEARCH_HEADERS = {
  ...SEARCH_BROWSER_HEADERS,
  'Cookie': 'SRCHHPGUSR=ADLT=MODERATE&CW=1366&CH=768'
};

const GOOGLE_SEARCH_HEADERS = {
  ...SEARCH_BROWSER_HEADERS,
  'Cookie': 'CONSENT=YES+cb.20240116-07-p0.vi+FX+410; SOCS=CAISHAgBEhJnd3NfMjAyNDA1MTUtMF9SQzIaAnZpIAEaBgiA_LyaBg'
};

async function searchOfficialStockApis({ plan, maxItems, pixabayKey = '', pexelsKey = '', googleApiKey = '', googleCx = '' }) {
  const qVi = plan.viQueries[0] || plan.baseVi;
  const qEn = plan.enQueries[0] || qVi;

  // 1. Pixabay Official Free API (key miễn phí, 100 req/phút, ảnh món ăn sắc nét)
  if (pixabayKey) {
    for (const q of [qVi, qEn]) {
      const pUrl = `https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey)}&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true&per_page=${Math.min(15, maxItems + 4)}`;
      const pRes = await fetchTextWithTimeout(pUrl, { Accept: 'application/json' }, 6500);
      if (pRes.ok) {
        try {
          const parsed = JSON.parse(pRes.text || '{}');
          const items = (parsed.hits || [])
            .filter(h => isAllowedFoodImageUrl(h.webformatURL || h.largeImageURL))
            .map(h => ({
              url: h.webformatURL || h.largeImageURL,
              thumbUrl: h.previewURL || h.webformatURL,
              width: Number(h.webformatWidth) || 640,
              height: Number(h.webformatHeight) || 480,
              title: String(h.tags || '').slice(0, 100),
              provider: 'pixabay'
            }));
          if (items.length > 0) return { source: 'pixabay', results: items.slice(0, maxItems) };
        } catch (_) {}
      }
    }
  }

  // 2. Pexels Official Free API
  if (pexelsKey) {
    const pxUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(qEn)}&per_page=${Math.min(15, maxItems + 4)}`;
    const pxRes = await fetchTextWithTimeout(pxUrl, { Accept: 'application/json', Authorization: pexelsKey }, 6500);
    if (pxRes.ok) {
      try {
        const parsed = JSON.parse(pxRes.text || '{}');
        const items = (parsed.photos || [])
          .filter(p => isAllowedFoodImageUrl(p.src?.large || p.src?.medium))
          .map(p => ({
            url: p.src.large || p.src.medium,
            thumbUrl: p.src.medium || p.src.small,
            width: Number(p.width) || 800,
            height: Number(p.height) || 600,
            title: String(p.alt || '').slice(0, 100),
            provider: 'pexels'
          }));
        if (items.length > 0) return { source: 'pexels', results: items.slice(0, maxItems) };
      } catch (_) {}
    }
  }

  // 3. Official Google Custom Search JSON API (nếu có Key + CX)
  if (googleApiKey && googleCx) {
    for (const q of [qVi, qEn]) {
      const cseUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(googleApiKey)}&cx=${encodeURIComponent(googleCx)}&searchType=image&safe=active&num=${Math.min(10, maxItems)}&q=${encodeURIComponent(q)}`;
      const cseRes = await fetchTextWithTimeout(cseUrl, { Accept: 'application/json' }, 7500);
      if (cseRes.ok) {
        try {
          const parsed = JSON.parse(cseRes.text || '{}');
          const items = (parsed.items || [])
            .filter(it => isAllowedFoodImageUrl(it.link))
            .map(it => ({
              url: it.link,
              thumbUrl: isSafePublicUrl(it.image?.thumbnailLink) ? it.image.thumbnailLink : it.link,
              width: Number(it.image?.width) || 0,
              height: Number(it.image?.height) || 0,
              title: String(it.title || '').slice(0, 100),
              provider: 'google-cse'
            }));
          if (items.length > 0) return { source: 'google-cse', results: items.slice(0, maxItems) };
        } catch (_) {}
      }
    }
  }

  return { source: 'none', results: [] };
}

async function searchDuckDuckGoImages(q, maxItems = 8) {
  const tokenPage = await fetchTextWithTimeout(
    `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`,
    SEARCH_BROWSER_HEADERS,
    5000
  );
  if (!tokenPage.ok) return [];
  const vqdMatch = /vqd=['"]?([0-9-]+)['"]?/i.exec(tokenPage.text);
  if (!vqdMatch) return [];
  const apiUrl = `https://duckduckgo.com/i.js?l=vn-vi&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqdMatch[1])}&f=,,,&p=1`;
  const jsonRes = await fetchTextWithTimeout(apiUrl, {
    ...SEARCH_BROWSER_HEADERS,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: 'https://duckduckgo.com/'
  }, 5500);
  if (!jsonRes.ok) return [];
  try {
    const parsed = JSON.parse(jsonRes.text || '{}');
    const out = [];
    const seen = new Set();
    for (const r of (parsed.results || [])) {
      const url = String(r.image || '').trim();
      const thumb = String(r.thumbnail || '').trim();
      if (!isAllowedFoodImageUrl(url) || seen.has(url)) continue;
      seen.add(url);
      out.push({
        url,
        thumbUrl: isSafePublicUrl(thumb) ? thumb : url,
        width: Number(r.width) || 0,
        height: Number(r.height) || 0,
        title: String(r.title || '').slice(0, 100),
        provider: 'duckduckgo'
      });
      if (out.length >= maxItems) break;
    }
    return out;
  } catch (_) {
    return [];
  }
}

async function searchOpenFreeJsonFoodApis(plan, maxItems = 8) {
  const out = [];
  const seen = new Set();
  const pushItem = item => {
    if (!item?.url || !isAllowedFoodImageUrl(item.url) || seen.has(item.url)) return;
    seen.add(item.url);
    out.push(item);
  };

  // 1. TheMealDB / TheCocktailDB Official Public JSON API (100% Free, No Key)
  if (plan.mealDb) {
    const mRes = await fetchTextWithTimeout(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(plan.mealDb)}`,
      { Accept: 'application/json' },
      4500
    );
    if (mRes.ok) {
      try {
        const parsed = JSON.parse(mRes.text || '{}');
        (parsed.meals || []).slice(0, 4).forEach(m => {
          pushItem({
            url: m.strMealThumb,
            thumbUrl: m.strMealThumb,
            width: 700,
            height: 700,
            title: String(m.strMeal || ''),
            provider: 'themealdb'
          });
        });
      } catch (_) {}
    }
  }
  if (plan.cocktailDb) {
    const cRes = await fetchTextWithTimeout(
      `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(plan.cocktailDb)}`,
      { Accept: 'application/json' },
      4500
    );
    if (cRes.ok) {
      try {
        const parsed = JSON.parse(cRes.text || '{}');
        (parsed.drinks || []).slice(0, 4).forEach(d => {
          pushItem({
            url: d.strDrinkThumb,
            thumbUrl: d.strDrinkThumb,
            width: 700,
            height: 700,
            title: String(d.strDrink || ''),
            provider: 'thecocktaildb'
          });
        });
      } catch (_) {}
    }
  }

  // 2. Openverse Official Public REST API (WordPress/CC — 100% Free, No Key)
  const enQ = plan.enQueries[0] || `${plan.baseVi} food`;
  const ovUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(enQ)}&page_size=${Math.min(16, maxItems * 2)}`;
  const ovRes = await fetchTextWithTimeout(ovUrl, { Accept: 'application/json', 'User-Agent': 'PtitNgonFoodCatalog/1.0' }, 5500);
  if (ovRes.ok) {
    try {
      const parsed = JSON.parse(ovRes.text || '{}');
      for (const r of (parsed.results || [])) {
        if (/wikimedia|svg|diagram|map|logo|icon|illustration|book|page/i.test(`${r.source || ''} ${r.title || ''} ${r.url || ''}`)) continue;
        const u = String(r.url || '').trim();
        const th = String(r.thumbnail || u).trim();
        pushItem({
          url: u,
          thumbUrl: isSafePublicUrl(th) ? th : u,
          width: Number(r.width) || 640,
          height: Number(r.height) || 480,
          title: String(r.title || '').slice(0, 100),
          provider: 'openverse'
        });
        if (out.length >= maxItems) break;
      }
    } catch (_) {}
  }

  return out;
}

function buildDirectFreeFoodResults(plan, limit = 6) {
  const queries = [
    ...plan.viQueries,
    ...plan.enQueries,
    `${plan.baseVi} ẩm thực đường phố`,
    `${plan.baseVi} chụp cận cảnh`
  ];
  const uniqueQ = [];
  queries.forEach(q => {
    const clean = String(q || '').trim();
    if (clean && !uniqueQ.some(x => x.toLowerCase() === clean.toLowerCase())) uniqueQ.push(clean);
  });

  const out = [];
  uniqueQ.slice(0, Math.max(4, limit - 1)).forEach((q, i) => {
    const hostIdx = (i % 4) + 1;
    const directUrl = `https://tse${hostIdx}.mm.bing.net/th?q=${encodeURIComponent(q)}&w=640&h=480&c=7&rs=1&p=0`;
    out.push({
      url: directUrl,
      thumbUrl: directUrl,
      width: 640,
      height: 480,
      title: q,
      provider: 'bing-cdn'
    });
  });

  const aiPrompt = `${plan.enQueries[0] || plan.baseVi}, appetizing vietnamese food photography, natural lighting, 4k`;
  const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(aiPrompt)}?width=640&height=480&nologo=true&seed=${Math.abs(plan.baseVi.length * 137 + 42)}`;
  out.push({
    url: aiUrl,
    thumbUrl: aiUrl,
    width: 640,
    height: 480,
    title: `${plan.baseVi} (AI Food Photo)`,
    provider: 'pollinations'
  });

  return out.slice(0, limit);
}

async function searchSingleQueryAcrossEngines({ q, maxItems }) {
  // 1. Bing Images Async HTML (nhanh, ít chặn CAPTCHA hơn Google, hỗ trợ tiếng Việt rất tốt)
  const bingEndpoints = [
    `https://www.bing.com/images/async?q=${encodeURIComponent(q)}&first=1&count=${Math.max(16, maxItems * 2)}&adlt=moderate&mmasync=1&mkt=vi-VN`,
    `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1&mkt=vi-VN`
  ];
  for (const bUrl of bingEndpoints) {
    const bRes = await fetchTextWithTimeout(bUrl, BING_SEARCH_HEADERS, 5500);
    if (bRes.ok) {
      const items = parseBingImagesHtml(bRes.text, maxItems);
      if (items.length > 0) return { source: 'bing', results: items };
    }
  }

  // 2. DuckDuckGo Images JSON API
  const ddgItems = await searchDuckDuckGoImages(q, maxItems);
  if (ddgItems.length > 0) return { source: 'duckduckgo', results: ddgItems };

  // 3. Google Images (udm=2)
  const gUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=2&hl=vi&gl=vn&safe=active`;
  const gRes = await fetchTextWithTimeout(gUrl, GOOGLE_SEARCH_HEADERS, 5000);
  if (gRes.ok && !String(gRes.finalUrl || '').includes('/sorry/')) {
    const items = parseGoogleImagesHtml(gRes.text, maxItems);
    if (items.length > 0) return { source: 'google', results: items.map(it => ({ ...it, provider: 'google' })) };
  }

  // 4. Dự phòng Yahoo Images
  const yUrl = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(q)}`;
  const yRes = await fetchTextWithTimeout(yUrl, SEARCH_BROWSER_HEADERS, 5000);
  if (yRes.ok) {
    const items = parseYahooImagesHtml(yRes.text, maxItems);
    if (items.length > 0) return { source: 'yahoo', results: items };
  }

  return { source: 'none', results: [] };
}

async function searchWebImages({
  query,
  category = '',
  extraQuery = '',
  limit = 8,
  googleApiKey = '',
  googleCx = '',
  pixabayKey = '',
  pexelsKey = ''
}) {
  const maxItems = Math.max(1, Math.min(12, Number(limit) || 8));
  const cleanQ = String(query || '').trim();
  if (!cleanQ) return { source: 'none', results: [] };

  const plan = buildCulinarySearchPlan(cleanQ, { category, extraQuery });
  const merged = [];
  let primarySource = 'none';
  const seenUrls = new Set();

  const appendItems = (list, srcName) => {
    if (!Array.isArray(list) || list.length === 0) return;
    if (primarySource === 'none' && srcName) primarySource = srcName;
    for (const item of list) {
      if (item?.url && !seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        merged.push(item);
      }
    }
  };

  // Tầng 1: API chính thức nếu người dùng có điền key (Pixabay / Pexels / Google CSE)
  const stock = await searchOfficialStockApis({ plan, maxItems, pixabayKey, pexelsKey, googleApiKey, googleCx });
  appendItems(stock.results, stock.source);

  // Tầng 2: Đa công cụ tìm ảnh web (Bing -> DuckDuckGo -> Google -> Yahoo) theo các biến thể từ khóa món ăn
  if (merged.length < Math.min(4, maxItems)) {
    const searchCandidates = [...new Set([...plan.viQueries.slice(0, 2), ...buildFoodQueryVariants(cleanQ).slice(0, 1), ...plan.enQueries.slice(0, 1)])];
    for (const q of searchCandidates.slice(0, 3)) {
      const res = await searchSingleQueryAcrossEngines({ q, maxItems });
      appendItems(res.results, res.source);
      if (merged.length >= Math.min(4, maxItems)) break;
    }
  }

  // Tầng 3: API JSON Mở Miễn Phí không cần key (TheMealDB / TheCocktailDB + Openverse CC)
  if (merged.length < maxItems) {
    const openItems = await searchOpenFreeJsonFoodApis(plan, maxItems);
    appendItems(openItems, openItems[0]?.provider || 'openverse');
  }

  // Tầng 4: Bổ sung đảm bảo luôn đủ ảnh thật từ Bing Food Direct CDN + Pollinations AI (không bao giờ trả về rỗng!)
  if (merged.length < maxItems) {
    const directItems = buildDirectFreeFoodResults(plan, maxItems);
    appendItems(directItems, 'bing-cdn');
  }

  return {
    source: primarySource === 'none' ? 'bing-cdn' : primarySource,
    plan,
    results: merged.slice(0, maxItems).map((it, idx) => ({ ...it, rank: idx + 1 }))
  };
}

async function downloadRemoteImageToUploads(candidateUrls, nameHint = 'food') {
  const urls = [...new Set((candidateUrls || []).map(u => String(u || '').trim()).filter(isSafePublicUrl))];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    try {
      const origin = new URL(url).origin;
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': SEARCH_BROWSER_HEADERS['User-Agent'],
          'Accept': 'image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8,*/*;q=0.5',
          'Referer': `${origin}/`
        }
      });
      if (!res.ok) continue;
      const lenHeader = Number(res.headers.get('content-length') || 0);
      if (lenHeader > 8 * 1024 * 1024) continue;
      const ab = await res.arrayBuffer();
      const buffer = Buffer.from(ab);
      if (buffer.length < 1200 || buffer.length > 8 * 1024 * 1024) continue;
      const ext = detectImageExtFromBuffer(buffer);
      if (!ext) continue; // Bỏ qua trang HTML lỗi hoặc định dạng không hỗ trợ
      const localPath = saveImageBufferToUploads(buffer, ext, nameHint);
      return { ok: true, path: localPath, bytes: buffer.length, sourceUrl: url };
    } catch (_) {
      // Thử ứng viên tiếp theo
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: 'Không tải được file ảnh hợp lệ từ kết quả tìm kiếm.' };
}

async function handleImageSearchApi(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }
  try {
    const rawBody = await readRequestBody(req);
    const body = JSON.parse(rawBody || '{}');
    const query = String(body.query || '').trim();
    if (!query) {
      return sendJson(res, 400, { error: 'Thiếu từ khóa tìm ảnh (query).' });
    }

    const found = await searchWebImages({
      query,
      category: String(body.category || '').trim(),
      extraQuery: String(body.extraQuery || '').trim(),
      limit: body.limit || 8,
      googleApiKey: String(body.googleApiKey || '').trim(),
      googleCx: String(body.googleCx || '').trim(),
      pixabayKey: String(body.pixabayKey || '').trim(),
      pexelsKey: String(body.pexelsKey || '').trim()
    });

    if (!body.autoDownload || found.results.length === 0) {
      return sendJson(res, 200, {
        ok: found.results.length > 0,
        source: found.source,
        resolvedQueries: found.plan?.viQueries || [query],
        query,
        results: found.results
      });
    }

    // Sắp xếp thứ tự ưu tiên theo vị trí người dùng chọn (VD: ảnh #1 trước rồi #2, hoặc ảnh #2 trước rồi #1/#3)
    const total = found.results.length;
    const prefIdx = Math.max(0, Math.min(total - 1, (Number(body.preferredRank) || 1) - 1));
    const orderedIndices = [prefIdx];
    for (let i = 0; i < total; i++) {
      if (i !== prefIdx) orderedIndices.push(i);
    }

    for (const idx of orderedIndices.slice(0, 6)) {
      const item = found.results[idx];
      const dl = await downloadRemoteImageToUploads([item.url, item.thumbUrl], body.name || query);
      if (dl.ok) {
        const timeLabel = new Date().toLocaleTimeString('vi-VN');
        console.log(`[${timeLabel}] 🖼️ Image Search (${item.provider || found.source} #${idx + 1}) -> ${dl.path}`);
        return sendJson(res, 200, {
          ok: true,
          source: item.provider || found.source,
          query,
          pickedRank: idx + 1,
          localPath: dl.path,
          originalUrl: dl.sourceUrl,
          results: found.results
        });
      }
    }

    // Nếu không tải được về máy, vẫn trả về URL thumbnail cache để hiển thị được ngay
    const fallbackItem = found.results[prefIdx] || found.results[0];
    return sendJson(res, 200, {
      ok: true,
      source: fallbackItem.provider || found.source,
      query,
      pickedRank: prefIdx + 1,
      localPath: fallbackItem.thumbUrl || fallbackItem.url,
      originalUrl: fallbackItem.url,
      results: found.results
    });
  } catch (err) {
    return sendJson(res, 500, { error: `Lỗi tìm ảnh: ${err.message}` });
  }
}

async function handleFetchRemoteImageApi(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }
  try {
    const rawBody = await readRequestBody(req);
    const body = JSON.parse(rawBody || '{}');
    const dl = await downloadRemoteImageToUploads([body.url, body.fallbackUrl].filter(Boolean), body.name || 'food');
    if (!dl.ok) {
      return sendJson(res, 422, { ok: false, error: dl.error });
    }
    return sendJson(res, 200, { ok: true, path: dl.path, bytes: dl.bytes });
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: `Không tải được ảnh: ${err.message}` });
  }
}

async function handleUploadImageApi(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }
  try {
    const rawBody = await readRequestBody(req);
    const parsed = JSON.parse(rawBody || '{}');
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(parsed.dataUrl || ''));
    if (!match) {
      return sendJson(res, 400, { error: 'Chỉ nhận ảnh dạng data URL (jpeg, png, webp, gif).' });
    }
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
      return sendJson(res, 400, { error: 'Ảnh rỗng hoặc vượt quá 8MB.' });
    }
    const localPath = saveImageBufferToUploads(buffer, UPLOAD_EXT_BY_MIME[match[1]], parsed.name || 'image');
    return sendJson(res, 200, { ok: true, path: localPath });
  } catch (err) {
    return sendJson(res, 400, { error: `Không thể lưu ảnh: ${err.message}` });
  }
}

function handleStaticFile(req, res, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (_) {
    decodedPath = pathname;
  }

  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const fullPath = path.resolve(ROOT_DIR, relativePath);

  if (!fullPath.startsWith(ROOT_DIR) || path.basename(fullPath).toLowerCase() === 'ai-profiles.json') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheControl = ['.html', '.css', '.js', '.json', '.webmanifest'].includes(ext)
      ? 'no-cache, must-revalidate'
      : 'public, max-age=3600';
    setCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
    fs.createReadStream(fullPath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = reqUrl.pathname;

  if (pathname === '/api/health' && req.method === 'GET') {
    CatalogIndex.ensureFresh();
    sendJson(res, 200, {
      ok: true,
      service: 'ptitngon-local-proxy',
      port: PORT,
      catalogSearchReady: true,
      indexedItems: CatalogIndex.items.length
    });
    return;
  }

  if (pathname === '/api/ai-proxy' && req.method === 'POST') {
    await handleAIProxy(req, res);
    return;
  }

  if (pathname.startsWith('/api/catalog/')) {
    const handled = await handleCatalogRoutes(req, res, pathname, reqUrl);
    if (handled !== false) return;
  }

  if (pathname === '/api/database') {
    await handleDatabaseApi(req, res);
    return;
  }

  if (pathname === '/api/ai-profiles') {
    await handleAIProfilesApi(req, res);
    return;
  }

  if (pathname === '/api/upload-image') {
    await handleUploadImageApi(req, res);
    return;
  }

  if (pathname === '/api/image-search') {
    await handleImageSearchApi(req, res);
    return;
  }

  if (pathname === '/api/fetch-remote-image') {
    await handleFetchRemoteImageApi(req, res);
    return;
  }

  handleStaticFile(req, res, pathname);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('======================================================================');
    console.log(`🍜 PTITNGON SERVER (AI PROXY + INDEXED CATALOG API) ĐANG CHẠY!`);
    console.log(`🌐 Mở ứng dụng tại     : http://localhost:${PORT}`);
    console.log(`🔌 AI Proxy Endpoint   : http://localhost:${PORT}/api/ai-proxy`);
    console.log(`🔎 Catalog Search API  : http://localhost:${PORT}/api/catalog/search`);
    console.log('======================================================================');
  });
}

module.exports = { server, CatalogIndex, normalizeTargetEndpoint, parseGoogleImagesHtml, parseBingImagesHtml, isSafePublicUrl, isAllowedFoodImageUrl, buildFoodQueryVariants, buildCulinarySearchPlan, buildDirectFreeFoodResults };
