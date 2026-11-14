/* ==========================================================================
   ptitngon - AI Catalog Generator (js/db-manager-ai.js)
   - Nhờ AI tạo hàng loạt mặt hàng (mặc định 5) theo chủ đề: có thể cùng 1 hoặc nhiều cửa hàng,
     dùng danh mục có sẵn hoặc tự tạo danh mục mới, kèm tag / dinh dưỡng / nguyên liệu.
   - HÀNG ĐỢI: gửi nhiều yêu cầu, chạy lần lượt (mỗi dòng trong ô nhập = 1 yêu cầu).
   - Ảnh: tạo bằng API (Pollinations / Gemini / OpenAI-compatible) hoặc dự phòng khi bị giới hạn:
     món nhận ảnh tạm, người dùng thả ảnh thủ công (1 ảnh có thể gán cho nhiều món).
   - Kết quả vào khu "duyệt" trước khi lưu (hoặc bật tự động lưu).
   Dùng lại cấu hình API của khung Chat AI (aiConfig / invokeSingleTurnLLM).
   ========================================================================== */

const DBM_AI_QUEUE_KEY = 'ptitngon_dbm_ai_queue_v1';
const DBM_AI_MAX_JOBS = 40;

let dbmAiJobs = [];
let dbmAiRunning = false;
let dbmAiPaused = false;
let dbmAiForm = { themes: '', count: 5, storeMode: 'auto', storeId: '', catMode: 'auto', catId: '', notes: '' };
let dbmAiOpenJobs = new Set(); // job đang mở rộng phần duyệt

function dbmAiPrefs() {
  const p = dbmLoadPrefs().ai || {};
  return {
    autoSave: Boolean(p.autoSave),
    imageMode: p.imageMode || 'google', // none | google (multi-engine free) | pixabay | google_cse | pollinations | gemini | openai
    googleRank: p.googleRank || '1', // '1' | '2' | '1or2'
    googleSuffix: p.googleSuffix !== undefined ? p.googleSuffix : 'món ăn',
    googleApiKey: p.googleApiKey || '',
    googleCx: p.googleCx || '',
    pixabayKey: p.pixabayKey || '',
    pexelsKey: p.pexelsKey || '',
    geminiKey: p.geminiKey || '',
    geminiModel: p.geminiModel || 'gemini-2.5-flash-image',
    openaiEndpoint: p.openaiEndpoint || 'https://api.openai.com/v1/images/generations',
    openaiKey: p.openaiKey || '',
    openaiModel: p.openaiModel || 'dall-e-3'
  };
}

function dbmAiSetPref(patch) {
  dbmSavePrefs({ ai: { ...dbmAiPrefs(), ...patch } });
}

// ─────────────────────────────────────────────────────────────────────────
// Lưu / nạp hàng đợi
// ─────────────────────────────────────────────────────────────────────────

function dbmAiPersist() {
  try {
    const slim = dbmAiJobs.slice(0, DBM_AI_MAX_JOBS).map(job => {
      const copy = { ...job };
      if (job.result) {
        copy.result = {
          ...job.result,
          items: job.result.items.map(it => ({
            ...it,
            // Ảnh data URL lớn không lưu vào localStorage (đã nằm trong file nếu có server)
            image: it.image && !String(it.image).startsWith('data:') ? it.image : null
          }))
        };
      }
      return copy;
    });
    localStorage.setItem(DBM_AI_QUEUE_KEY, JSON.stringify(slim));
  } catch (_) { /* đầy bộ nhớ: bỏ qua */ }
}

function dbmAiLoad() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DBM_AI_QUEUE_KEY) || '[]');
    dbmAiJobs = Array.isArray(parsed) ? parsed : [];
    dbmAiJobs.forEach(j => { if (j.status === 'running') j.status = 'queued'; });
  } catch (_) {
    dbmAiJobs = [];
  }
}
dbmAiLoad();

function dbmAiPendingReviewCount() {
  return dbmAiJobs.filter(j => j.status === 'review').length;
}

// ─────────────────────────────────────────────────────────────────────────
// Gọi LLM (dùng cấu hình API của Chat AI) + thử lại khi bị giới hạn
// ─────────────────────────────────────────────────────────────────────────

function dbmAiIsConfigured() {
  return typeof isExternalAPIConfigured === 'function' && isExternalAPIConfigured();
}

async function dbmAiEnsureProxyChecked() {
  try {
    if (typeof localProxyStatus !== 'undefined' && !localProxyStatus.checked && typeof checkLocalProxyHealth === 'function') {
      await checkLocalProxyHealth();
    }
  } catch (_) { }
}

const dbmSleep = ms => new Promise(r => setTimeout(r, ms));
const DBM_RATE_LIMIT_RE = /429|rate.?limit|quota|too many|overload|503|unavailable|exhausted/i;

async function dbmAiCallLLM(systemPrompt, userPrompt, { maxTokens = 6000, temperature = 0.8, onRetry = null } = {}) {
  await dbmAiEnsureProxyChecked();
  const tokens = aiConfig.provider === 'gemini' ? Math.max(maxTokens, 8192) : maxTokens;
  const waits = [0, 6000, 15000];
  let lastErr = null;
  for (let attempt = 0; attempt < waits.length; attempt++) {
    if (waits[attempt]) {
      if (onRetry) onRetry(attempt, waits[attempt]);
      await dbmSleep(waits[attempt]);
    }
    try {
      const out = await invokeSingleTurnLLM(systemPrompt, [{ role: 'user', content: userPrompt }], {
        maxTokens: tokens, temperature, stageLabel: 'Quản lý Database - AI tạo hàng'
      });
      if (!out || !String(out.text || '').trim()) throw new Error('AI trả về nội dung rỗng');
      return out.text;
    } catch (err) {
      lastErr = err;
      // Chỉ thử lại với lỗi tạm thời (giới hạn tốc độ / quá tải / rỗng); lỗi key sai thì dừng ngay
      if (!DBM_RATE_LIMIT_RE.test(String(err.message)) && !/rỗng/.test(String(err.message))) break;
    }
  }
  throw lastErr || new Error('Không gọi được AI');
}

function dbmAiExtractJson(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI không trả về JSON (có thể bị cắt giữa chừng)');
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch (_) {
    try {
      return JSON.parse(t.replace(/,\s*([}\]])/g, '$1'));
    } catch (e2) {
      throw new Error('JSON do AI trả về bị lỗi hoặc bị cắt — hãy thử lại hoặc giảm số lượng món');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────

function dbmAiBuildPrompt(job) {
  const manualCats = DB.getManualCategories();
  const stores = DB.getStores();
  const tags = DB.getAllTags().slice(0, 40).map(t => t.tag);
  const vouchers = DB.getVouchers().filter(v => v.active !== false);
  const existingNames = DB.getItems().slice(0, 160).map(i => i.name);

  let storeRule;
  if (job.storeMode === 'existing') {
    const st = DB.getStoreById(job.storeId);
    storeRule = `Mọi mặt hàng thuộc cửa hàng CÓ SẴN "${st ? st.name : ''}" (id ${job.storeId}). Mảng "stores" để rỗng [].`;
  } else if (job.storeMode === 'new-one') {
    storeRule = 'Tạo ĐÚNG 1 cửa hàng mới (existingId = null) và mọi mặt hàng thuộc cửa hàng đó.';
  } else {
    storeRule = 'Bạn tự quyết: gom vào 1 cửa hàng hoặc chia nhiều cửa hàng (tối đa 3) cho hợp lý. Dùng cửa hàng có sẵn (điền existingId) nếu phù hợp, hoặc tạo cửa hàng mới (existingId = null).';
  }

  let catRule;
  if (job.catMode === 'specific') {
    const c = DB.getCategoryById(job.catId);
    catRule = `Mọi mặt hàng thuộc danh mục "${c ? c.name : ''}". Mảng "categories" để rỗng [].`;
  } else if (job.catMode === 'existing-only') {
    catRule = 'CHỈ được dùng danh mục có sẵn trong danh sách (ghi đúng tên). Mảng "categories" để rỗng [].';
  } else {
    catRule = 'Ưu tiên danh mục có sẵn nếu phù hợp (ghi đúng tên). Nếu chủ đề cần danh mục riêng thì khai báo trong "categories" (tối đa 2) rồi dùng tên đó.';
  }

  return `Bạn là chuyên gia xây dựng thực đơn cho ứng dụng giao đồ ăn dành cho sinh viên PTIT (Hà Đông, Hà Nội).
Nhiệm vụ: tạo dữ liệu mặt hàng mới theo chủ đề người dùng đưa ra.
CHỈ TRẢ VỀ DUY NHẤT MỘT KHỐI JSON HỢP LỆ — không giải thích, không markdown.

QUY TẮC:
- Tạo ĐÚNG ${job.count} mặt hàng, tên đa dạng, tự nhiên bằng tiếng Việt, KHÔNG trùng các mặt hàng đã có.
- Giá bằng VNĐ, thực tế với sinh viên, là bội số của 1000.
- Cửa hàng: ${storeRule}
- Danh mục: ${catRule}
- "tags": 2-5 tag ngắn tiếng Việt viết thường; ưu tiên dùng lại tag đã có.
- "voucherCodes": chỉ chọn trong danh sách mã có sẵn hoặc [] nếu không hợp.
- "nutrition": ước tính hợp lý cho MỖI PHẦN (calories kcal; protein, carbs, fat, fiber, sugar đơn vị g; sodium mg).
- "healthyScore": chấm điểm mức độ lành mạnh (Healthy) khách quan trên thang 1.0 đến 10.0 (1 chữ số thập phân) dựa trên phương pháp chế biến và chỉ số dinh dưỡng (VD: salad/gỏi cuốn/luộc hấp/eat clean 8.6–9.6; phở/bún/cơm cân bằng 7.8–8.5; món xào/nướng đậm vị 7.0–7.7; đồ chiên rán ngập dầu/mì cay béo/trà sữa nhiều đường 5.2–6.8).
- "healthyLevel": nhận xét ngắn gọn 4-10 từ tiếng Việt giải thích mức độ healthy (VD: "Rất lành mạnh • Giàu chất xơ, ít béo" hoặc "Ăn điều độ • Khá nhiều đường & chất béo").
- "ingredients": 3-6 mục {name, amount}.
- "sizes": 1-3 cỡ (cỡ đầu extraPrice = 0). "toppings": 0-3 mục.
- "imageSearchQuery": khai báo rõ ràng từ khóa tìm ảnh chụp món ăn thật theo cú pháp "<tên món cốt lõi tiếng Việt 2-4 từ> | <mô tả món bằng tiếng Anh 3-5 từ>" (VD: "bún bò huế giò heo | spicy vietnamese beef noodle soup", TUYỆT ĐỐI KHÔNG chứa từ PTIT, Hà Đông, KTX, sinh viên, combo, size).
- "imagePrompt": mô tả ảnh bằng TIẾNG ANH (food photography, góc chụp, ánh sáng, bối cảnh).
- "emoji": 1 emoji đại diện món.
- Với cửa hàng mới: điền address thực tế quanh Học viện PTIT (Km10 Nguyễn Trãi / Trần Phú, Hà Đông), phone dạng 09xx xxx xxx, deliveryTime như "15 - 20 phút", shippingFeeNum (0, 10000 hoặc 15000), priceLevel ("$", "$$" hoặc "$$$").

DỮ LIỆU HIỆN CÓ:
- Danh mục có sẵn: ${manualCats.map(c => c.name).join(' | ')}
- Cửa hàng có sẵn: ${stores.map(s => `${s.id}:${s.name}`).join(' | ')}
- Tag đã dùng: ${tags.join(', ') || '(chưa có)'}
- Mã giảm giá: ${vouchers.map(v => `${v.code} (${v.title})`).join(' | ') || '(chưa có)'}
- Mặt hàng đã có (tránh trùng): ${existingNames.join(' | ')}

ĐỊNH DẠNG JSON:
{
  "stores": [{"key":"s1","existingId":null,"name":"","address":"","phone":"","categoryName":"","deliveryTime":"","shippingFeeNum":0,"priceLevel":"$","shortReview":"","badge":"","emoji":"🍜"}],
  "categories": [{"name":"","icon":"🍢","description":""}],
  "items": [{"name":"","price":35000,"storeKey":"s1","categoryName":"","description":"","tags":[],"ingredients":[{"name":"","amount":""}],"nutrition":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sodium":0,"sugar":0},"healthyScore":8.2,"healthyLevel":"","sizes":[{"name":"","extraPrice":0}],"toppings":[{"name":"","price":0}],"noteSuggestions":[""],"voucherCodes":[],"imageSearchQuery":"","imagePrompt":"","emoji":"🍜"}]
}`;
}

function dbmAiUserPrompt(job) {
  return `Chủ đề: ${job.theme}${job.notes ? `\nYêu cầu thêm: ${job.notes}` : ''}\nHãy tạo ${job.count} mặt hàng.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Chuẩn hóa kết quả AI
// ─────────────────────────────────────────────────────────────────────────

function dbmAiFindCategory(name) {
  const n = dbmNormText(name);
  if (!n) return null;
  const manual = DB.getManualCategories();
  return manual.find(c => dbmNormText(c.name) === n)
    || manual.find(c => dbmNormText(c.name).includes(n) || n.includes(dbmNormText(c.name)))
    || null;
}

function dbmAiNormalizeResult(raw, job) {
  const warnings = [];
  const seenNames = new Set(DB.getItems().map(i => dbmNormText(i.name)));
  const rawStores = Array.isArray(raw.stores) ? raw.stores : [];
  const rawCats = Array.isArray(raw.categories) ? raw.categories : [];
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  if (rawItems.length === 0) throw new Error('AI không tạo được mặt hàng nào — thử diễn đạt chủ đề rõ hơn');

  // ── Cửa hàng ──
  let stores = [];
  if (job.storeMode === 'existing') {
    const st = DB.getStoreById(job.storeId) || DB.getStoreById(1000);
    stores = [{ key: '__existing__', existingId: st.id, name: st.name }];
  } else {
    rawStores.slice(0, job.storeMode === 'new-one' ? 1 : 3).forEach((s, i) => {
      const byId = s.existingId ? DB.getStoreById(s.existingId) : null;
      const byName = !byId && s.name ? DB.findStoreByName(s.name) : null;
      const existing = byId || byName;
      const key = String(s.key || `s${i + 1}`);
      if (existing) {
        stores.push({ key, existingId: existing.id, name: existing.name });
      } else if (String(s.name || '').trim()) {
        stores.push({
          key, existingId: null,
          name: String(s.name).trim().slice(0, 80),
          address: String(s.address || '').trim().slice(0, 140),
          phone: String(s.phone || '').trim().slice(0, 20),
          categoryName: String(s.categoryName || '').trim(),
          deliveryTime: String(s.deliveryTime || '').trim().slice(0, 30),
          shippingFeeNum: [0, 10000, 15000].includes(Number(s.shippingFeeNum)) ? Number(s.shippingFeeNum) : 0,
          priceLevel: ['$', '$$', '$$$'].includes(s.priceLevel) ? s.priceLevel : '$',
          shortReview: String(s.shortReview || '').trim().slice(0, 200),
          badge: String(s.badge || '').trim().slice(0, 24) || 'Mới ✨',
          emoji: String(s.emoji || '🍽️').slice(0, 4)
        });
      }
    });
    if (job.storeMode === 'new-one' && stores.length === 0) {
      stores.push({
        key: 's1', existingId: null, name: `Quán ${job.theme}`.slice(0, 60), address: 'Khu vực Học viện PTIT, Hà Đông',
        phone: '', categoryName: '', deliveryTime: '15 - 20 phút', shippingFeeNum: 0, priceLevel: '$',
        shortReview: '', badge: 'Mới ✨', emoji: '🍽️'
      });
      warnings.push('AI không mô tả cửa hàng mới — đã tạo cửa hàng tạm theo chủ đề, bạn có thể sửa sau.');
    }
    if (stores.length === 0) {
      const gen = DB.getStoreById(1000);
      stores.push({ key: '__general__', existingId: gen ? gen.id : 1000, name: gen ? gen.name : 'Gian hàng tự chọn' });
    }
  }
  const storeKeys = new Set(stores.map(s => s.key));

  // ── Danh mục mới (AI khai báo) ──
  const newCats = [];
  if (job.catMode === 'auto') {
    rawCats.slice(0, 3).forEach(c => {
      const name = String(c.name || '').trim().slice(0, 40);
      if (name && !dbmAiFindCategory(name) && !newCats.some(x => dbmNormText(x.name) === dbmNormText(name))) {
        newCats.push({ name, icon: String(c.icon || '🍽️').slice(0, 4), description: String(c.description || '').trim().slice(0, 140) });
      }
    });
  }
  const fixedCat = job.catMode === 'specific' ? DB.getCategoryById(job.catId) : null;
  const firstManual = DB.getManualCategories()[0];

  // ── Mặt hàng ──
  const items = [];
  rawItems.slice(0, job.count).forEach(r => {
    const name = String(r.name || '').trim().slice(0, 90);
    if (!name) return;
    const key = dbmNormText(name);
    if (seenNames.has(key)) { warnings.push(`Bỏ qua "${name}" vì trùng tên mặt hàng đã có.`); return; }
    seenNames.add(key);

    let price = Math.round((Number(r.price) || 0) / 1000) * 1000;
    if (price < 5000) price = 25000;
    price = Math.min(price, 2000000);

    // Danh mục
    let categoryName;
    if (fixedCat) {
      categoryName = fixedCat.name;
    } else {
      const found = dbmAiFindCategory(r.categoryName);
      if (found) categoryName = found.name;
      else if (job.catMode === 'existing-only') categoryName = (firstManual || {}).name || 'Khác';
      else {
        const nm = String(r.categoryName || '').trim().slice(0, 40);
        categoryName = nm || (firstManual || {}).name || 'Khác';
        if (nm && !newCats.some(x => dbmNormText(x.name) === dbmNormText(nm)) && newCats.length < 3) {
          newCats.push({ name: nm, icon: '🍽️', description: '' });
        }
      }
    }

    const storeKey = job.storeMode === 'existing' ? '__existing__'
      : (job.storeMode === 'new-one' ? stores[0].key : (storeKeys.has(String(r.storeKey)) ? String(r.storeKey) : stores[0].key));

    const validCodes = new Set(DB.getVouchers().map(v => v.code));
    const description = String(r.description || '').trim().slice(0, 400);
    const tags = dbmParseTags(r.tags);
    const ingredients = dbmCleanIngredients(r.ingredients);
    const nutrition = dbmCleanNutrition(r.nutrition);
    const rawHScore = dbmCleanHealthyScore(r.healthyScore ?? r.nutrition?.healthyScore);
    const rawHLevel = dbmCleanHealthyLevel(r.healthyLevel ?? r.nutrition?.healthyLevel);
    const assessedH = dbmComputeHealthyAssessment({
      name,
      category: categoryName,
      description,
      tags,
      ingredients,
      nutrition,
      healthyScore: rawHScore
    });

    items.push({
      name, price, storeKey, categoryName,
      description,
      tags,
      ingredients,
      nutrition,
      healthyScore: rawHScore !== null ? rawHScore : assessedH.healthyScore,
      healthyLevel: rawHLevel || assessedH.healthyLevel,
      sizes: dbmCleanSizes(r.sizes),
      toppings: dbmCleanToppings(r.toppings),
      noteSuggestions: (Array.isArray(r.noteSuggestions) ? r.noteSuggestions : []).map(n => String(n).trim()).filter(Boolean).slice(0, 5),
      voucherCodes: (Array.isArray(r.voucherCodes) ? r.voucherCodes : []).map(c => String(c).toUpperCase()).filter(c => validCodes.has(c)),
      imageSearchQuery: String(r.imageSearchQuery || '').trim().slice(0, 160)
        || dbmBuildCulinarySearchPlan(name, { category: categoryName }).primaryQuery,
      imagePrompt: String(r.imagePrompt || `${name}, vietnamese street food, food photography, natural light`).slice(0, 300),
      emoji: String(r.emoji || '🍽️').slice(0, 4),
      image: null,
      imageIsPlaceholder: true,
      include: true,
      saved: false
    });
  });

  if (items.length === 0) throw new Error('Tất cả mặt hàng AI tạo đều trùng tên với mặt hàng đã có — hãy đổi chủ đề');
  if (items.length < job.count) warnings.push(`Chỉ tạo được ${items.length}/${job.count} mặt hàng hợp lệ.`);

  return { stores, categories: newCats, items, warnings };
}

// ─────────────────────────────────────────────────────────────────────────
// Tạo ảnh (có phương án dự phòng)
// ─────────────────────────────────────────────────────────────────────────

function dbmAiItemImage(it) {
  return it.image || dbmMakePlaceholderImage(it.emoji, it.name);
}

function dbmBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dbmShrinkDataUrl(dataUrl, maxWidth = 640, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function dbmCheckImageLoads(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; reject(new Error('Quá thời gian chờ tạo ảnh')); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Dịch vụ tạo ảnh không phản hồi (có thể đang giới hạn)')); };
    img.src = url;
  });
}

function dbmResolvePreferredGoogleRank(rankMode) {
  if (rankMode === '2') return 2;
  if (rankMode === '1or2') return Math.random() < 0.5 ? 1 : 2;
  return 1;
}

async function dbmAiGenerateImage(it, overrideGoogleRank = null) {
  const prefs = dbmAiPrefs();
  const prompt = `${it.imagePrompt}. Appetizing, high quality, 4:3.`;
  const isSearchMode = ['google', 'pixabay', 'google_cse'].includes(prefs.imageMode) || overrideGoogleRank !== null;

  if (isSearchMode) {
    const query = dbmBuildFoodImageQuery(it.name, prefs.googleSuffix, it.categoryName, it.imageSearchQuery);
    const preferredRank = overrideGoogleRank || dbmResolvePreferredGoogleRank(prefs.googleRank);
    const res = await dbmSearchGoogleImages(query, {
      limit: 6,
      autoDownload: true,
      preferredRank,
      name: it.name,
      category: it.categoryName || '',
      extraQuery: it.imageSearchQuery || '',
      googleApiKey: prefs.googleApiKey,
      googleCx: prefs.googleCx,
      pixabayKey: prefs.pixabayKey,
      pexelsKey: prefs.pexelsKey
    });
    const finalSrc = res.localPath || res.originalUrl;
    if (!finalSrc) throw new Error('Không tìm được ảnh phù hợp');
    DB.addLibraryImage({ name: it.name, src: finalSrc });
    it._googlePickedRank = res.pickedRank || preferredRank;
    it._imageSource = res.source;
    return finalSrc;
  }

  if (prefs.imageMode === 'pollinations') {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=480&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
    await dbmCheckImageLoads(url, 60000);
    if (DB.hasBackendApi) {
      try {
        const blob = await (await fetch(url)).blob();
        const dataUrl = await dbmShrinkDataUrl(await dbmBlobToDataUrl(blob));
        return await dbmPersistImageDataUrl(dataUrl, it.name);
      } catch (_) { /* giữ URL gốc */ }
    }
    return url;
  }

  if (prefs.imageMode === 'gemini') {
    const key = prefs.geminiKey || (aiConfig.provider === 'gemini' ? aiConfig.apiKey : '');
    if (!key) throw new Error('Chưa có Gemini API key cho tạo ảnh');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(prefs.geminiModel)}:generateContent?key=${encodeURIComponent(key)}`;
    const { res } = await fetchViaLocalProxyOrDirect(url, 'gemini', { 'Content-Type': 'application/json' }, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    }, 'Tạo ảnh');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const inline = parts.map(p => p.inlineData || p.inline_data).find(Boolean);
    if (!inline?.data) throw new Error('Gemini không trả về ảnh');
    const dataUrl = await dbmShrinkDataUrl(`data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`);
    return await dbmPersistImageDataUrl(dataUrl, it.name);
  }

  if (prefs.imageMode === 'openai') {
    if (!prefs.openaiKey) throw new Error('Chưa có API key cho tạo ảnh');
    const body = { model: prefs.openaiModel, prompt, n: 1, size: '1024x1024' };
    if (!/^gpt-image/i.test(prefs.openaiModel)) body.response_format = 'b64_json';
    const { res } = await fetchViaLocalProxyOrDirect(prefs.openaiEndpoint, 'custom', {
      'Content-Type': 'application/json', Authorization: `Bearer ${prefs.openaiKey}`
    }, body, 'Tạo ảnh');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const first = data?.data?.[0];
    if (first?.b64_json) {
      const dataUrl = await dbmShrinkDataUrl(`data:image/png;base64,${first.b64_json}`);
      return await dbmPersistImageDataUrl(dataUrl, it.name);
    }
    if (first?.url) return first.url;
    throw new Error('API không trả về ảnh');
  }

  throw new Error('Đang tắt tạo ảnh');
}

async function dbmAiGenerateJobImages(job) {
  const prefs = dbmAiPrefs();
  if (prefs.imageMode === 'none') {
    job.imageNote = 'Chưa bật tạo ảnh — các món đang dùng ảnh tạm. Hãy thả ảnh vào từng thẻ hoặc dùng “Gán ảnh cho nhiều món”.';
    return;
  }
  let failed = 0;
  let stopped = false;
  for (let i = 0; i < job.result.items.length; i++) {
    const it = job.result.items[i];
    if (stopped) { failed++; continue; }
    job.progress = `Đang tạo ảnh ${i + 1}/${job.result.items.length}: ${it.name}`;
    dbmAiRenderQueue();
    try {
      it.image = await dbmAiGenerateImage(it);
      it.imageIsPlaceholder = false;
    } catch (err) {
      failed++;
      if (DBM_RATE_LIMIT_RE.test(String(err.message))) stopped = true; // chạm giới hạn: dừng, không gọi thêm
      job.imageError = err.message;
    }
    if (i < job.result.items.length - 1) await dbmSleep(900);
  }
  if (failed > 0) {
    job.imageNote = `${failed} món chưa có ảnh${job.imageError ? ` (${job.imageError})` : ''} — thả ảnh thủ công vào thẻ món, hoặc chọn nhiều món rồi gán chung 1 ảnh.`;
  }
}

async function dbmAiRegenImage(jobId, idx) {
  const job = dbmAiJobs.find(j => j.id === jobId);
  const it = job?.result?.items?.[idx];
  if (!it || it.regen) return;
  if (dbmAiPrefs().imageMode === 'none') {
    showToast('alertRegular', 'Hãy bật tạo ảnh trong “Cài đặt tạo ảnh” trước');
    return;
  }
  it.regen = true;
  dbmAiRenderQueue();
  try {
    it.image = await dbmAiGenerateImage(it);
    it.imageIsPlaceholder = false;
    showToast('checkmarkFilled', `Đã tạo ảnh cho "${it.name}"`);
  } catch (err) {
    showToast('alertRegular', `Không tạo được ảnh: ${err.message}`);
  }
  it.regen = false;
  dbmAiPersist();
  dbmAiRenderQueue();
}

async function dbmAiGrabGoogleImage(jobId, idx) {
  const job = dbmAiJobs.find(j => j.id === jobId);
  const it = job?.result?.items?.[idx];
  if (!it || it.regen) return;
  const nextRank = ((Number(it._googleRankCursor) || 0) % 6) + 1;
  it.regen = true;
  dbmAiRenderQueue();
  try {
    it.image = await dbmAiGenerateImage(it, nextRank);
    it.imageIsPlaceholder = false;
    it._googleRankCursor = nextRank;
    if (it.saved && it.savedItemId) {
      DB.bulkUpdateItems([it.savedItemId], { image: it.image });
    }
    const srcLabel = typeof dbmImageSourceLabel === 'function' ? dbmImageSourceLabel(it._imageSource) : 'Đa nguồn';
    showToast('checkmarkFilled', `Đã lấy ảnh #${it._googlePickedRank || nextRank} (${srcLabel}) cho "${it.name}" — bấm lại để đổi sang ảnh kế tiếp`);
  } catch (err) {
    showToast('alertRegular', `Không lấy được ảnh: ${err.message}`);
  }
  it.regen = false;
  dbmAiPersist();
  dbmAiRenderQueue();
}

async function dbmAiEditImageQuery(jobId, idx) {
  const job = dbmAiJobs.find(j => j.id === jobId);
  const it = job?.result?.items?.[idx];
  if (!it || it.regen) return;
  const currentQ = it.imageSearchQuery || dbmBuildFoodImageQuery(it.name, 'món ăn', it.categoryName);
  const nextQ = prompt(
    `Nhập từ khóa tìm ảnh chi tiết cho "${it.name}":\n(Mẹo: ghi rõ tên món cốt lõi, có thể kèm tiếng Anh sau dấu "|" — VD: "mì cay hải sản | korean spicy seafood noodles")`,
    currentQ
  );
  if (nextQ === null || !nextQ.trim()) return;
  it.imageSearchQuery = nextQ.trim();
  it._googleRankCursor = 0;
  dbmAiPersist();
  await dbmAiGrabGoogleImage(jobId, idx);
}

// ─────────────────────────────────────────────────────────────────────────
// Hàng đợi
// ─────────────────────────────────────────────────────────────────────────

function dbmAiEnqueueFromForm() {
  if (!dbmAiIsConfigured()) {
    showToast('alertRegular', 'Chưa cấu hình API AI — bấm “Cài đặt API” trước nhé');
    return;
  }
  const lines = String(dbmAiForm.themes || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) {
    showToast('alertRegular', 'Hãy nhập chủ đề (mỗi dòng là một yêu cầu)');
    return;
  }
  if (dbmAiForm.storeMode === 'existing' && !DB.getStoreById(dbmAiForm.storeId)) {
    showToast('alertRegular', 'Hãy chọn cửa hàng có sẵn');
    return;
  }
  if (dbmAiForm.catMode === 'specific' && !DB.getCategoryById(dbmAiForm.catId)) {
    showToast('alertRegular', 'Hãy chọn danh mục cụ thể');
    return;
  }

  const count = Math.max(1, Math.min(10, parseInt(dbmAiForm.count, 10) || 5));
  lines.slice(0, 20).forEach(theme => {
    dbmAiJobs.unshift({
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      theme: theme.slice(0, 200),
      count,
      storeMode: dbmAiForm.storeMode,
      storeId: dbmAiForm.storeId,
      catMode: dbmAiForm.catMode,
      catId: dbmAiForm.catId,
      notes: String(dbmAiForm.notes || '').trim().slice(0, 300),
      status: 'queued',
      createdAt: new Date().toISOString()
    });
  });
  dbmAiForm.themes = '';
  const ta = document.getElementById('dbm-ai-themes');
  if (ta) ta.value = '';
  dbmAiPersist();
  dbmAiRenderQueue();
  showToast('sparkleRegular', `Đã thêm ${lines.length} yêu cầu vào hàng đợi`);
  dbmAiProcessQueue();
}

async function dbmAiProcessQueue() {
  if (dbmAiRunning) return;
  dbmAiRunning = true;
  try {
    while (!dbmAiPaused) {
      // Chạy theo thứ tự thêm vào (cũ nhất trước)
      const job = [...dbmAiJobs].reverse().find(j => j.status === 'queued');
      if (!job) break;
      await dbmAiRunJob(job);
    }
  } finally {
    dbmAiRunning = false;
    dbmAiRenderQueue();
  }
}

async function dbmAiRunJob(job) {
  job.status = 'running';
  job.error = null;
  job.progress = 'Đang nhờ AI lên danh sách món...';
  dbmAiRenderQueue();

  try {
    const text = await dbmAiCallLLM(dbmAiBuildPrompt(job), dbmAiUserPrompt(job), {
      onRetry: (attempt, wait) => {
        job.progress = `AI đang bận/giới hạn — thử lại lần ${attempt + 1} sau ${Math.round(wait / 1000)}s...`;
        dbmAiRenderQueue();
      }
    });
    if (job.cancelRequested) { job.status = 'cancelled'; return; }

    job.result = dbmAiNormalizeResult(dbmAiExtractJson(text), job);
    job.imageNote = '';
    job.imageError = '';
    await dbmAiGenerateJobImages(job);
    if (job.cancelRequested) { job.status = 'cancelled'; job.result = null; return; }

    job.status = 'review';
    job.progress = '';
    dbmAiOpenJobs.add(job.id);

    if (dbmAiPrefs().autoSave) {
      const res = dbmAiCommit(job.id, false);
      showToast('checkmarkFilled', `✨ AI đã tạo & lưu ${res.count} món cho “${job.theme}”`);
    } else {
      showToast('sparkleRegular', `✨ AI đã tạo ${job.result.items.length} món cho “${job.theme}” — vào tab AI để duyệt`);
    }
  } catch (err) {
    job.status = 'error';
    job.error = err.message || String(err);
    job.progress = '';
  } finally {
    dbmAiPersist();
    dbmAiRenderQueue();
  }
}

function dbmAiCancelJob(id) {
  const job = dbmAiJobs.find(j => j.id === id);
  if (!job) return;
  if (job.status === 'running') {
    job.cancelRequested = true;
    job.progress = 'Đang hủy...';
  } else if (job.status === 'queued') {
    job.status = 'cancelled';
  }
  dbmAiPersist();
  dbmAiRenderQueue();
}

function dbmAiRetryJob(id) {
  const job = dbmAiJobs.find(j => j.id === id);
  if (!job) return;
  job.status = 'queued';
  job.error = null;
  job.cancelRequested = false;
  dbmAiPersist();
  dbmAiRenderQueue();
  dbmAiProcessQueue();
}

function dbmAiRemoveJob(id) {
  const job = dbmAiJobs.find(j => j.id === id);
  if (job && job.status === 'review' && job.result?.items.some(i => i.include && !i.saved)) {
    if (!confirm('Bỏ kết quả này? Các món AI vừa tạo chưa lưu sẽ mất.')) return;
  }
  dbmAiJobs = dbmAiJobs.filter(j => j.id !== id || j.status === 'running');
  dbmAiPersist();
  dbmAiRenderQueue();
  if (currentView === 'catalog') renderCatalogManagerView();
}

function dbmAiClearFinished() {
  dbmAiJobs = dbmAiJobs.filter(j => ['queued', 'running', 'review'].includes(j.status));
  dbmAiPersist();
  dbmAiRenderQueue();
}

function dbmAiTogglePause() {
  dbmAiPaused = !dbmAiPaused;
  if (!dbmAiPaused) dbmAiProcessQueue();
  dbmAiRenderQueue();
}

// ─────────────────────────────────────────────────────────────────────────
// Lưu kết quả vào Database
// ─────────────────────────────────────────────────────────────────────────

function dbmAiCommit(jobId, onlyIncluded = true) {
  const job = dbmAiJobs.find(j => j.id === jobId);
  if (!job || !job.result) return { ok: false, count: 0 };

  const todo = job.result.items.filter(it => !it.saved && (!onlyIncluded || it.include));
  if (todo.length === 0) return { ok: false, count: 0 };

  // 1) Danh mục
  const catIdByName = new Map();
  const resolveCategoryId = name => {
    const key = dbmNormText(name);
    if (catIdByName.has(key)) return catIdByName.get(key);
    let cat = dbmAiFindCategory(name);
    if (!cat) {
      const decl = job.result.categories.find(c => dbmNormText(c.name) === key);
      const sample = todo.find(it => dbmNormText(it.categoryName) === key && it.image && !it.imageIsPlaceholder);
      const res = DB.saveCategory({
        name, icon: decl?.icon || '🍽️', description: decl?.description || '',
        image: sample ? sample.image : '', showOnHome: true, showInVisualSuggestions: true, type: 'manual'
      });
      cat = res.ok ? res.category : DB.getManualCategories()[0];
    }
    catIdByName.set(key, cat.id);
    return cat.id;
  };

  // 2) Cửa hàng
  const storeIdByKey = new Map();
  const resolveStoreId = key => {
    if (storeIdByKey.has(key)) return storeIdByKey.get(key);
    const decl = job.result.stores.find(s => s.key === key) || job.result.stores[0];
    let id;
    if (decl.existingId && DB.getStoreById(decl.existingId)) {
      id = decl.existingId;
    } else {
      const sample = todo.find(it => it.storeKey === decl.key && it.image && !it.imageIsPlaceholder);
      const catName = decl.categoryName || todo.find(it => it.storeKey === decl.key)?.categoryName;
      const res = DB.saveStore({
        name: decl.name, address: decl.address, phone: decl.phone, deliveryTime: decl.deliveryTime,
        shippingFeeNum: decl.shippingFeeNum, priceLevel: decl.priceLevel, shortReview: decl.shortReview,
        badge: decl.badge, image: sample ? sample.image : '',
        categoryId: catName ? resolveCategoryId(catName) : undefined, isAIGenerated: true
      });
      if (res.ok) id = res.store.id;
      else {
        const existing = DB.findStoreByName(decl.name);
        id = existing ? existing.id : 1000;
      }
    }
    storeIdByKey.set(key, id);
    return id;
  };

  let count = 0;
  todo.forEach(it => {
    const res = DB.saveItem({
      name: it.name, price: it.price,
      categoryId: resolveCategoryId(it.categoryName),
      restaurantId: resolveStoreId(it.storeKey),
      image: it.image || '', imageIsPlaceholder: !it.image || it.imageIsPlaceholder,
      description: it.description, tags: it.tags, ingredients: it.ingredients, nutrition: it.nutrition,
      healthyScore: it.healthyScore, healthyLevel: it.healthyLevel,
      sizes: it.sizes, toppings: it.toppings, noteSuggestions: it.noteSuggestions,
      vouchers: it.voucherCodes, soldCount: 0,
      isAIGenerated: true, aiTheme: job.theme
    });
    if (res.ok) {
      it.saved = true;
      it.savedItemId = res.item.id;
      count++;
    }
  });

  if (job.result.items.every(it => it.saved || !it.include)) job.status = 'saved';
  dbmAiPersist();
  syncGlobalChromeUI();
  return { ok: count > 0, count };
}

function dbmAiSaveJob(jobId, all) {
  const res = dbmAiCommit(jobId, !all);
  if (!res.ok) {
    showToast('alertRegular', 'Không có món nào để lưu (hãy tick chọn món)');
    return;
  }
  showToast('checkmarkFilled', `Đã lưu ${res.count} mặt hàng vào Database`);
  dbmRefreshManager();
}

// ─────────────────────────────────────────────────────────────────────────
// Giao diện tab AI
// ─────────────────────────────────────────────────────────────────────────

function renderDbmAITab() {
  const prefs = dbmAiPrefs();
  const configured = dbmAiIsConfigured();
  const manualCats = DB.getManualCategories();
  const stores = DB.getStores();
  const f = dbmAiForm;
  const providerLabel = configured
    ? `${(AI_PROVIDER_PRESETS[aiConfig.provider] || {}).badge || aiConfig.provider} • ${aiConfig.model}`
    : '';

  return `
    <div class="dbm-panel">
      <div class="dbm-panel-title">✨ Nhờ AI tạo mặt hàng hàng loạt</div>
      <div class="dbm-ai-status ${configured ? 'ok' : 'warn'}">
        ${configured
      ? ` Đang dùng API: <strong>${escapeHtml(providerLabel)}</strong>`
      : '⚠️ Chưa cấu hình API AI. Cần có API key (Gemini, OpenRouter, Groq, NVIDIA/Custom...) để AI tạo hàng.'}
        <button type="button" class="db-inline-link-btn" onclick="openAISettingsModal()">⚙️ Cài đặt API</button>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Chủ đề (mỗi dòng = 1 yêu cầu riêng trong hàng đợi)</label>
        <textarea id="dbm-ai-themes" class="delivery-input-field" rows="3"
          placeholder="VD:&#10;5 món ăn vặt cay cho sinh viên&#10;5 loại trà sữa healthy ít đường&#10;Combo cơm văn phòng giá rẻ"
          oninput="dbmAiForm.themes = this.value"
          onkeydown="if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); dbmAiEnqueueFromForm(); }">${escapeHtml(f.themes)}</textarea>
      </div>

      <div class="dbm-ai-grid">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Số món mỗi yêu cầu</label>
          <input type="number" min="1" max="10" class="delivery-input-field" value="${escapeHtml(f.count)}" oninput="dbmAiForm.count = this.value">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Cửa hàng</label>
          <select class="delivery-input-field" onchange="dbmAiForm.storeMode = this.value; dbmAiToggleModeFields();">
            <option value="auto" ${f.storeMode === 'auto' ? 'selected' : ''}>AI tự quyết (1 hoặc nhiều quán)</option>
            <option value="new-one" ${f.storeMode === 'new-one' ? 'selected' : ''}>Tất cả vào 1 quán mới</option>
            <option value="existing" ${f.storeMode === 'existing' ? 'selected' : ''}>Vào quán có sẵn…</option>
          </select>
          <select id="dbm-ai-store" class="delivery-input-field" style="margin-top:6px; ${f.storeMode === 'existing' ? '' : 'display:none;'}" onchange="dbmAiForm.storeId = this.value">
            <option value="">— chọn cửa hàng —</option>
            ${stores.map(s => `<option value="${s.id}" ${String(f.storeId) === String(s.id) ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Danh mục</label>
          <select class="delivery-input-field" onchange="dbmAiForm.catMode = this.value; dbmAiToggleModeFields();">
            <option value="auto" ${f.catMode === 'auto' ? 'selected' : ''}>AI tự quyết (có sẵn hoặc tạo mới)</option>
            <option value="existing-only" ${f.catMode === 'existing-only' ? 'selected' : ''}>Chỉ dùng danh mục có sẵn</option>
            <option value="specific" ${f.catMode === 'specific' ? 'selected' : ''}>Một danh mục cụ thể…</option>
          </select>
          <select id="dbm-ai-cat" class="delivery-input-field" style="margin-top:6px; ${f.catMode === 'specific' ? '' : 'display:none;'}" onchange="dbmAiForm.catId = this.value">
            <option value="">— chọn danh mục —</option>
            ${manualCats.map(c => `<option value="${escapeHtml(c.id)}" ${f.catId === c.id ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Yêu cầu thêm (tùy chọn: tầm giá, phong cách, khu vực...)</label>
        <input type="text" class="delivery-input-field" placeholder="VD: giá dưới 40K, phong cách Hàn Quốc, phù hợp ăn đêm" value="${escapeHtml(f.notes)}" oninput="dbmAiForm.notes = this.value">
      </div>

      <details class="dbm-section" ${prefs.imageMode !== 'none' ? 'open' : ''}>
        <summary><span>🖼️ Công cụ Tìm & Tạo Ảnh Đồ Ăn (Miễn phí, Đa nguồn)</span></summary>
        <div class="dbm-section-body">
          <div class="dbm-hint">AI sẽ tự khai báo từ khóa món ăn chi tiết (Việt + Anh) cho từng món để lấy ảnh chuẩn xác, không còn bị lỗi chặn bot của Google. Ngoài ra bạn luôn có thể thả ảnh thủ công hoặc bấm đổi ảnh trên từng thẻ món.</div>
          <div class="delivery-input-group">
            <label class="delivery-input-label">Chọn công cụ kiếm / tạo hình ảnh</label>
            <select class="delivery-input-field" onchange="dbmAiSetPref({ imageMode: this.value }); dbmAiRefreshImageFields();">
              <option value="google" ${prefs.imageMode === 'google' ? 'selected' : ''}>🌐 Đa nguồn Đồ Ăn Miễn Phí (Khuyên dùng • Bing Food + Openverse + MealDB — Không cần Key)</option>
              <option value="pixabay" ${prefs.imageMode === 'pixabay' ? 'selected' : ''}>📸 Kho ảnh Pixabay / Pexels HD (Miễn phí • Ảnh chụp thật độ nét cao)</option>
              <option value="pollinations" ${prefs.imageMode === 'pollinations' ? 'selected' : ''}>🎨 Pollinations Flux AI (Miễn phí, không cần key — Tự vẽ ảnh món mới)</option>
              <option value="google_cse" ${prefs.imageMode === 'google_cse' ? 'selected' : ''}>🔍 Google Custom Search API Chính Thức (Cần khai báo API Key + CX)</option>
              <option value="gemini" ${prefs.imageMode === 'gemini' ? 'selected' : ''}>✨ Gemini Image (Google AI)</option>
              <option value="openai" ${prefs.imageMode === 'openai' ? 'selected' : ''}>🔌 OpenAI-compatible (/images/generations)</option>
              <option value="none" ${prefs.imageMode === 'none' ? 'selected' : ''}>⏸ Không tự lấy ảnh (dùng ảnh tạm, tự thả ảnh sau)</option>
            </select>
          </div>
          <div id="dbm-ai-image-fields">${dbmAiImageFieldsHtml(prefs)}</div>
        </div>
      </details>

      <div class="dbm-ai-actions">
        <label class="db-checkbox-row compact">
          <input type="checkbox" ${prefs.autoSave ? 'checked' : ''} onchange="dbmAiSetPref({ autoSave: this.checked })">
          <span>Tự động lưu vào Database khi AI tạo xong (không cần duyệt)</span>
        </label>
        <button type="button" class="btn-primary-large dbm-ai-submit" onclick="dbmAiEnqueueFromForm()">➕ Thêm vào hàng đợi <small>Ctrl+Enter</small></button>
      </div>
    </div>

    <div id="dbm-ai-queue">${dbmAiQueueHtml()}</div>`;
}

function dbmAiImageFieldsHtml(prefs) {
  const rankAndSuffixRow = `
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Vị trí ảnh ưu tiên lấy</label>
          <select class="delivery-input-field" onchange="dbmAiSetPref({ googleRank: this.value })">
            <option value="1" ${prefs.googleRank === '1' ? 'selected' : ''}>Ảnh đầu tiên (#1 — lỗi tự lùi sang #2)</option>
            <option value="2" ${prefs.googleRank === '2' ? 'selected' : ''}>Ảnh thứ 2 (#2 — lỗi tự lùi sang #1, #3)</option>
            <option value="1or2" ${prefs.googleRank === '1or2' ? 'selected' : ''}>Ngẫu nhiên #1 hoặc #2 (đỡ trùng ảnh giữa các món)</option>
          </select>
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Hậu tố tìm kiếm kèm theo tên món</label>
          <input type="text" class="delivery-input-field" placeholder="VD: món ăn" value="${escapeHtml(prefs.googleSuffix)}" onchange="dbmAiSetPref({ googleSuffix: this.value.trim() })">
        </div>
      </div>`;

  if (prefs.imageMode === 'google') {
    return `
      ${rankAndSuffixRow}
      <div class="dbm-hint">
        ✅ <strong>Miễn phí 100% & không cần khai báo API Key</strong>: Hệ thống tự chuẩn hóa tên món sang từ khóa ẩm thực chi tiết (Việt + Anh) rồi tìm song song qua <strong>Bing Food Images • DuckDuckGo • Openverse CC • TheMealDB • Bing Direct CDN</strong>.<br>
        • Khi chạy <code>node server.js</code>: tự tải ảnh thật về lưu trong <code>assets/images/uploads/</code>.<br>
        • Kể cả khi mở trực tiếp trên trình duyệt (Live Server / <code>file://</code>): vẫn tự lấy được ảnh online ngay lập tức!
      </div>`;
  }
  if (prefs.imageMode === 'pixabay') {
    return `
      ${rankAndSuffixRow}
      <div class="dbm-hint">
        📸 <strong>Kho ảnh chụp thực tế chất lượng cao (Free 100%)</strong>: Chỉ mất 30 giây đăng ký lấy key miễn phí tại <code>pixabay.com/api/docs/</code> (100 lượt/phút) hoặc <code>pexels.com/api/</code>. Nếu để trống, hệ thống vẫn tự lùi về kho Đa nguồn Miễn Phí.
      </div>
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Pixabay API Key (miễn phí tại pixabay.com/api/docs)</label>
          <input type="password" class="delivery-input-field" placeholder="Dán Pixabay Key (VD: 44123456-abcdef...)" value="${escapeHtml(prefs.pixabayKey || '')}" onchange="dbmAiSetPref({ pixabayKey: this.value.trim() })">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Pexels API Key (tùy chọn tại pexels.com/api)</label>
          <input type="password" class="delivery-input-field" placeholder="Dán Pexels Key (tùy chọn)" value="${escapeHtml(prefs.pexelsKey || '')}" onchange="dbmAiSetPref({ pexelsKey: this.value.trim() })">
        </div>
      </div>`;
  }
  if (prefs.imageMode === 'google_cse') {
    return `
      ${rankAndSuffixRow}
      <div class="dbm-hint warn">
        ℹ️ <strong>Vì sao tìm Google không có Key hay báo "không tìm thấy ảnh"?</strong> Google hiện chặn các truy vấn tự động không qua trình duyệt thật bằng CAPTCHA/JavaScript. Để lấy trực tiếp từ <strong>Google Images chính chủ</strong> ổn định, cần khai báo đủ 2 thông số miễn phí (100 lượt/ngày):<br>
        1️⃣ <strong>Google API Key</strong>: Vào <code>console.cloud.google.com/apis/library/customsearch.googleapis.com</code> → Bật <em>Custom Search API</em> → Tạo <em>API Key</em>.<br>
        2️⃣ <strong>Search Engine ID (CX)</strong>: Vào <code>programmablesearchengine.google.com</code> → Tạo bộ máy mới → Bật <strong>Image search (Tìm kiếm hình ảnh)</strong> + <strong>Search the entire web</strong> → Copy mã <code>cx</code>.<br>
        <em>(Nếu chưa điền hoặc hết hạn mức trong ngày, hệ thống tự động dự phòng sang Đa nguồn Miễn Phí để không bị gián đoạn!)</em>
      </div>
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Google Custom Search API Key (*)</label>
          <input type="password" class="delivery-input-field" placeholder="AIzaSy..." value="${escapeHtml(prefs.googleApiKey)}" onchange="dbmAiSetPref({ googleApiKey: this.value.trim() })">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Search Engine ID / Mã CX (*)</label>
          <input type="text" class="delivery-input-field" placeholder="VD: a1b2c3d4e5f6g7h8i" value="${escapeHtml(prefs.googleCx)}" onchange="dbmAiSetPref({ googleCx: this.value.trim() })">
        </div>
      </div>`;
  }
  if (prefs.imageMode === 'gemini') {
    return `
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Gemini API key (để trống = dùng key Chat AI nếu đang chọn Gemini)</label>
          <input type="password" class="delivery-input-field" value="${escapeHtml(prefs.geminiKey)}" onchange="dbmAiSetPref({ geminiKey: this.value.trim() })">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Model ảnh</label>
          <input type="text" class="delivery-input-field" value="${escapeHtml(prefs.geminiModel)}" onchange="dbmAiSetPref({ geminiModel: this.value.trim() })">
        </div>
      </div>`;
  }
  if (prefs.imageMode === 'openai') {
    return `
      <div class="delivery-input-group">
        <label class="delivery-input-label">Endpoint</label>
        <input type="text" class="delivery-input-field" value="${escapeHtml(prefs.openaiEndpoint)}" onchange="dbmAiSetPref({ openaiEndpoint: this.value.trim() })">
      </div>
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">API key</label>
          <input type="password" class="delivery-input-field" value="${escapeHtml(prefs.openaiKey)}" onchange="dbmAiSetPref({ openaiKey: this.value.trim() })">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Model</label>
          <input type="text" class="delivery-input-field" value="${escapeHtml(prefs.openaiModel)}" onchange="dbmAiSetPref({ openaiModel: this.value.trim() })">
        </div>
      </div>`;
  }
  if (prefs.imageMode === 'pollinations') {
    return `<div class="dbm-hint">Ảnh được tạo qua image.pollinations.ai (có thể chậm 10-40s/ảnh và đôi khi quá tải).</div>`;
  }
  return '';
}

function dbmAiRefreshImageFields() {
  const el = document.getElementById('dbm-ai-image-fields');
  if (el) el.innerHTML = dbmAiImageFieldsHtml(dbmAiPrefs());
}

function dbmAiToggleModeFields() {
  const storeSel = document.getElementById('dbm-ai-store');
  const catSel = document.getElementById('dbm-ai-cat');
  if (storeSel) storeSel.style.display = dbmAiForm.storeMode === 'existing' ? '' : 'none';
  if (catSel) catSel.style.display = dbmAiForm.catMode === 'specific' ? '' : 'none';
}

function dbmAiAfterRender() { /* hook dành cho mở rộng */ }

function dbmAiRenderQueue() {
  if (currentView !== 'catalog' || catalogActiveTab !== 'ai') return;
  const el = document.getElementById('dbm-ai-queue');
  if (el) el.innerHTML = dbmAiQueueHtml();
}

const DBM_AI_STATUS = {
  queued: ['⏳', 'Đang chờ', 'queued'],
  running: ['⚙️', 'Đang tạo', 'running'],
  review: ['📝', 'Chờ duyệt', 'review'],
  saved: ['💾', 'Đã lưu', 'saved'],
  error: ['❌', 'Lỗi', 'error'],
  cancelled: ['🚫', 'Đã hủy', 'cancelled']
};

function dbmAiQueueHtml() {
  const jobs = dbmAiJobs;
  if (jobs.length === 0) {
    return `<div class="dbm-panel"><div class="dbm-empty-note">Hàng đợi trống. Nhập chủ đề phía trên rồi bấm “Thêm vào hàng đợi”.</div></div>`;
  }
  const counts = jobs.reduce((m, j) => { m[j.status] = (m[j.status] || 0) + 1; return m; }, {});
  return `
    <div class="dbm-panel">
      <div class="dbm-queue-head">
        <div class="dbm-panel-title" style="margin:0;">Hàng đợi (${jobs.length})</div>
        <div class="dbm-queue-stats">
          ${counts.running ? `⚙️ ${counts.running} đang chạy • ` : ''}${counts.queued ? `⏳ ${counts.queued} chờ • ` : ''}${counts.review ? `📝 ${counts.review} chờ duyệt • ` : ''}${counts.saved ? `💾 ${counts.saved} đã lưu` : ''}
        </div>
        <div class="dbm-queue-controls">
          <button type="button" class="db-secondary-btn" onclick="dbmAiTogglePause()">${dbmAiPaused ? '▶ Chạy tiếp' : '⏸ Tạm dừng'}</button>
          <button type="button" class="db-secondary-btn" onclick="dbmAiClearFinished()">🧹 Xóa việc đã xong</button>
        </div>
      </div>
      ${dbmAiPaused ? `<div class="dbm-hint warn">Hàng đợi đang tạm dừng — các yêu cầu chờ sẽ không chạy cho tới khi bạn bấm “Chạy tiếp”.</div>` : ''}
      ${jobs.map(dbmAiJobHtml).join('')}
    </div>`;
}

function dbmAiJobHtml(job) {
  const [icon, label, cls] = DBM_AI_STATUS[job.status] || DBM_AI_STATUS.queued;
  const id = escapeHtml(job.id);
  const storeModeText = job.storeMode === 'existing' ? `quán: ${escapeHtml(DB.getStoreById(job.storeId)?.name || '?')}` : job.storeMode === 'new-one' ? '1 quán mới' : 'quán tự động';
  const catModeText = job.catMode === 'specific' ? `danh mục: ${escapeHtml(DB.getCategoryById(job.catId)?.name || '?')}` : job.catMode === 'existing-only' ? 'danh mục có sẵn' : 'danh mục tự động';

  let actions = '';
  if (job.status === 'queued' || job.status === 'running') actions = `<button type="button" class="db-act-btn delete" onclick="dbmAiCancelJob('${id}')">Hủy</button>`;
  else if (job.status === 'error') actions = `<button type="button" class="db-act-btn order" onclick="dbmAiRetryJob('${id}')">🔁 Thử lại</button><button type="button" class="db-act-btn delete" onclick="dbmAiRemoveJob('${id}')">🗑️</button>`;
  else if (job.status === 'review') actions = `<button type="button" class="db-act-btn edit" onclick="dbmAiToggleOpen('${id}')">${dbmAiOpenJobs.has(job.id) ? 'Thu gọn' : 'Xem & duyệt'}</button><button type="button" class="db-act-btn delete" onclick="dbmAiRemoveJob('${id}')">Bỏ</button>`;
  else actions = `<button type="button" class="db-act-btn edit" onclick="dbmAiToggleOpen('${id}')">${dbmAiOpenJobs.has(job.id) ? 'Thu gọn' : 'Xem'}</button><button type="button" class="db-act-btn delete" onclick="dbmAiRemoveJob('${id}')">🗑️</button>`;

  return `
    <div class="dbm-job ${cls}">
      <div class="dbm-job-head">
        <span class="dbm-job-status ${cls}">${icon} ${label}</span>
        <div class="dbm-job-main">
          <div class="dbm-job-theme">${escapeHtml(job.theme)}</div>
          <div class="dbm-job-meta">${job.count} món • ${storeModeText} • ${catModeText}${job.notes ? ` • ${escapeHtml(job.notes)}` : ''}</div>
          ${job.status === 'running' ? `<div class="dbm-job-progress"><span class="dbm-spinner"></span>${escapeHtml(job.progress || 'Đang xử lý...')}</div>` : ''}
          ${job.status === 'error' ? `<div class="dbm-job-error">${escapeHtml(job.error || 'Lỗi không xác định')}</div>` : ''}
        </div>
        <div class="dbm-job-actions">${actions}</div>
      </div>
      ${(job.status === 'review' || job.status === 'saved') && dbmAiOpenJobs.has(job.id) ? dbmAiReviewHtml(job) : ''}
    </div>`;
}

function dbmAiToggleOpen(id) {
  if (dbmAiOpenJobs.has(id)) dbmAiOpenJobs.delete(id); else dbmAiOpenJobs.add(id);
  dbmAiRenderQueue();
}

function dbmAiReviewHtml(job) {
  const r = job.result;
  if (!r) return '';
  const jid = escapeHtml(job.id);
  const saved = job.status === 'saved';
  const selected = r.items.filter(i => i.include && !i.saved).length;
  const storeName = key => (r.stores.find(s => s.key === key) || r.stores[0] || {}).name || '';
  const isNewStore = key => { const s = r.stores.find(x => x.key === key) || r.stores[0]; return s && !s.existingId; };
  const isNewCat = name => !dbmAiFindCategory(name);
  const missing = r.items.filter(i => !i.image).length;

  return `
    <div class="dbm-review">
      ${r.warnings.length ? `<div class="dbm-hint warn">${r.warnings.map(w => `• ${escapeHtml(w)}`).join('<br>')}</div>` : ''}
      ${job.imageNote ? `<div class="dbm-hint warn">🖼️ ${escapeHtml(job.imageNote)}</div>` : ''}
      <div class="dbm-review-meta">
        ${r.stores.filter(s => !s.existingId).length ? `<span>🏪 Cửa hàng mới: <strong>${r.stores.filter(s => !s.existingId).map(s => escapeHtml(s.name)).join(', ')}</strong></span>` : ''}
        ${r.categories.length ? `<span>🏷️ Danh mục mới: <strong>${r.categories.map(c => `${escapeHtml(c.icon)} ${escapeHtml(c.name)}`).join(', ')}</strong></span>` : ''}
      </div>
      <div class="dbm-review-grid">
        ${r.items.map((it, idx) => {
    const hInfo = dbmGetItemHealthy({ ...it, category: it.categoryName });
    return `
          <div class="dbm-ai-card ${it.saved ? 'saved' : ''} ${it.include ? '' : 'excluded'}"
               ondragover="dbmCardDragOver(event)" ondragleave="dbmCardDragLeave(event)" ondrop="dbmAiCardDrop(event, '${jid}', ${idx})">
            <div class="dbm-ai-card-img">
              <img src="${escapeHtml(dbmAiItemImage(it))}" alt="${escapeHtml(it.name)}" onerror="this.src='assets/images/hung_chien_gion.webp'">
              ${!it.image ? `<span class="dbm-noimg-badge">Chưa có ảnh</span>` : ''}
              ${it.regen ? `<div class="dbm-card-busy"><span class="dbm-spinner"></span></div>` : ''}
              ${it.saved ? `<span class="dbm-saved-badge">✓ Đã lưu</span>` : `<label class="dbm-card-check"><input type="checkbox" ${it.include ? 'checked' : ''} onchange="dbmAiToggleInclude('${jid}', ${idx}, this.checked)"></label>`}
              <div class="dbm-drop-hint">Thả ảnh để đổi</div>
            </div>
            <div class="dbm-ai-card-body">
              <div class="dbm-ai-card-name">${escapeHtml(it.emoji)} ${escapeHtml(it.name)}</div>
              <div class="dbm-ai-card-price">${formatVND(it.price)}</div>
              <div class="dbm-ai-card-line">🏪 ${escapeHtml(storeName(it.storeKey))}${isNewStore(it.storeKey) ? ' <em>(mới)</em>' : ''}</div>
              <div class="dbm-ai-card-line">🏷️ ${escapeHtml(it.categoryName)}${isNewCat(it.categoryName) ? ' <em>(mới)</em>' : ''}</div>
              <div class="dbm-item-healthy-row ai-card" title="${escapeHtml(hInfo.level)}${it.saved ? '' : ' — bấm để chỉnh điểm Healthy'}"
                   ${it.saved ? '' : `onclick="dbmAiEditHealthy('${jid}', ${idx})"`}>
                <span class="dbm-healthy-pill ${hInfo.tier}">🥗 ${hInfo.score}/10</span>
                <span class="dbm-item-healthy-note">${escapeHtml(hInfo.level)}</span>
                ${it.nutrition?.calories ? `<span class="dbm-item-kcal">🔥 ${Math.round(Number(it.nutrition.calories))} kcal</span>` : ''}
              </div>
              <div class="dbm-tag-row">${it.tags.map(t => `<span class="dbm-tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
              ${it.description ? `<div class="dbm-ai-card-desc">${escapeHtml(it.description)}</div>` : ''}
              <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <button type="button" class="db-inline-link-btn" onclick="dbmAiGrabGoogleImage('${jid}', ${idx})" title="Từ khóa đang dùng: ${escapeHtml(it.imageSearchQuery || it.name)} — Bấm nhiều lần để đổi ảnh #1 → #2 → #3...">⚡ Đổi ảnh Free${it._googleRankCursor ? ` (#${(it._googleRankCursor % 6) + 1})` : ''}</button>
                <button type="button" class="db-inline-link-btn" onclick="dbmAiEditImageQuery('${jid}', ${idx})" title="Khai báo rõ từ khóa tìm ảnh riêng cho món này rồi tải ảnh ngay">🔎 Từ khóa ảnh</button>
                ${!it.saved && !['none', 'google', 'pixabay', 'google_cse'].includes(dbmAiPrefs().imageMode) ? `<button type="button" class="db-inline-link-btn" onclick="dbmAiRegenImage('${jid}', ${idx})">🔄 Tạo lại ảnh</button>` : ''}
                ${!it.saved ? `<button type="button" class="db-inline-link-btn" onclick="dbmAiEditHealthy('${jid}', ${idx})" title="Chỉnh sửa đánh giá độ Healthy của món này">🥗 Sửa Healthy</button>` : ''}
                ${it.saved ? `<button type="button" class="db-inline-link-btn" onclick="openItemEditorModal('${escapeHtml(it.savedItemId || '')}')">✏️ Sửa trong Database</button>` : ''}
              </div>
            </div>
          </div>`;
  }).join('')}
      </div>
      ${saved ? '' : `
        <div class="dbm-review-footer">
          ${missing ? `<button type="button" class="db-secondary-btn" onclick="dbmAiAssignOneImage('${jid}')">${FluentIcons.imageFilled} Gán 1 ảnh cho nhiều món</button>` : ''}
          <button type="button" class="db-secondary-btn" onclick="dbmAiSelectAll('${jid}', ${selected === 0})">${selected === 0 ? 'Chọn tất cả' : 'Bỏ chọn tất cả'}</button>
          <button type="button" class="btn-primary-large" style="flex:1; min-width:200px;" onclick="dbmAiSaveJob('${jid}', false)">${FluentIcons.saveFilled} Lưu ${selected} món đã chọn vào Database</button>
        </div>`}
    </div>`;
}

function dbmAiToggleInclude(jobId, idx, checked) {
  const it = dbmAiJobs.find(j => j.id === jobId)?.result?.items?.[idx];
  if (!it) return;
  it.include = checked;
  dbmAiPersist();
  dbmAiRenderQueue();
}

function dbmAiEditHealthy(jobId, idx) {
  const it = dbmAiJobs.find(j => j.id === jobId)?.result?.items?.[idx];
  if (!it || it.saved) return;
  const hInfo = dbmGetItemHealthy({ ...it, category: it.categoryName });

  window.dbmAiSaveEditedHealthy = () => {
    const rawScore = document.getElementById('dbm-ai-edit-hscore')?.value;
    const rawLevel = document.getElementById('dbm-ai-edit-hlevel')?.value || '';
    const s = dbmCleanHealthyScore(rawScore);
    if (s === null) {
      showToast('alertRegular', 'Điểm Healthy phải từ 0.1 đến 10.0');
      return;
    }
    it.healthyScore = s;
    it.healthyLevel = dbmCleanHealthyLevel(rawLevel)
      || dbmComputeHealthyAssessment({ ...it, category: it.categoryName, healthyScore: s }).healthyLevel;
    dbmAiPersist();
    closeModal();
    dbmAiRenderQueue();
    showToast('checkmarkFilled', `Đã cập nhật Healthy cho "${it.name}" (${it.healthyScore}/10)`);
  };

  window.dbmAiAutoRecalcHealthy = () => {
    const assessed = dbmComputeHealthyAssessment({ ...it, category: it.categoryName, healthyScore: null });
    const sEl = document.getElementById('dbm-ai-edit-hscore');
    const lEl = document.getElementById('dbm-ai-edit-hlevel');
    if (sEl) sEl.value = assessed.healthyScore;
    if (lEl) lEl.value = assessed.healthyLevel;
  };

  dbmOpenSheet(`
    ${dbmSheetHeader('🥗', `Đánh giá độ Healthy: ${it.name}`)}
    <div class="delivery-modal-body dbm-editor-body">
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Điểm Healthy (0 – 10)</label>
          <input type="number" id="dbm-ai-edit-hscore" class="delivery-input-field" min="0.1" max="10" step="0.1" value="${escapeHtml(hInfo.score)}">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Nhận xét mức độ Healthy</label>
          <input type="text" id="dbm-ai-edit-hlevel" class="delivery-input-field" value="${escapeHtml(hInfo.level)}">
        </div>
      </div>
      <div>
        <button type="button" class="db-secondary-btn compact" onclick="dbmAiAutoRecalcHealthy()">⚡ Tự tính lại theo chỉ số dinh dưỡng</button>
      </div>
    </div>
    <div class="dbm-editor-footer">
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="dbmAiSaveEditedHealthy()">${FluentIcons.saveFilled} Lưu đánh giá Healthy</button>
    </div>`);
}

function dbmAiSelectAll(jobId, checked) {
  const job = dbmAiJobs.find(j => j.id === jobId);
  if (!job?.result) return;
  job.result.items.forEach(it => { if (!it.saved) it.include = checked; });
  dbmAiPersist();
  dbmAiRenderQueue();
}

// Thả ảnh lên thẻ món AI (chưa lưu) -> đặt ảnh ngay; nếu món đang được tick, áp dụng cho tất cả món đang tick
async function dbmAiCardDrop(e, jobId, idx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const job = dbmAiJobs.find(j => j.id === jobId);
  if (!job?.result) return;
  const dropped = dbmExtractDroppedImages(e.dataTransfer);
  if (dropped.files.length === 0 && dropped.urls.length === 0) return;

  showToast('sparkleRegular', 'Đang xử lý ảnh...');
  const imported = await dbmImportDropped(dropped);
  if (imported.length === 0) { showToast('alertRegular', 'Không đọc được ảnh'); return; }
  imported.forEach(img => DB.addLibraryImage(img));

  const target = job.result.items[idx];
  const pendingSelected = job.result.items.filter(i => i.include && !i.saved);
  const group = (target.include && pendingSelected.length > 1) ? pendingSelected : [target];
  group.forEach(it => {
    if (it.saved) return;
    it.image = imported[0].src;
    it.imageIsPlaceholder = false;
  });
  // Món đã lưu: cập nhật thẳng vào Database
  if (target.saved && target.savedItemId) DB.bulkUpdateItems([target.savedItemId], { image: imported[0].src });
  dbmAiPersist();
  dbmAiRenderQueue();
  showToast('checkmarkFilled', `Đã gán ảnh cho ${group.length} món`);
}

// Gán 1 ảnh cho nhiều món chưa có ảnh trong cùng job (chưa lưu vào DB)
function dbmAiAssignOneImage(jobId) {
  const job = dbmAiJobs.find(j => j.id === jobId);
  if (!job?.result) return;
  const pending = job.result.items.map((it, idx) => ({ it, idx })).filter(x => !x.it.saved);
  dbmChk = { selected: new Set(pending.filter(x => !x.it.image).map(x => String(x.idx))), query: '', onlyMissing: false, onConfirm: null };
  let src = '';

  dbmDropHandlers['aijobimg'] = async dropped => {
    const imported = await dbmImportDropped(dropped);
    if (imported.length === 0) return;
    imported.forEach(img => DB.addLibraryImage(img));
    window.dbmAiPickImage(imported[0].src);
  };
  window.dbmAiPickImage = s => {
    src = s;
    const p = document.getElementById('dbm-aiassign-preview');
    if (p) p.innerHTML = `<img src="${escapeHtml(s)}" alt="">`;
  };
  window.dbmAiToggleAssignRow = (i, checked) => { if (checked) dbmChk.selected.add(String(i)); else dbmChk.selected.delete(String(i)); };
  window.dbmAiApplyAssign = () => {
    if (!src) { showToast('alertRegular', 'Hãy chọn hoặc thả một ảnh'); return; }
    let n = 0;
    dbmChk.selected.forEach(i => {
      const it = job.result.items[Number(i)];
      if (it && !it.saved) { it.image = src; it.imageIsPlaceholder = false; n++; }
    });
    DB.addLibraryImage({ name: 'Ảnh đã gán', src });
    dbmAiPersist();
    closeModal();
    showToast('checkmarkFilled', `Đã gán ảnh cho ${n} món`);
    dbmRefreshManager();
  };

  dbmOpenSheet(`
    ${dbmSheetHeader('🖼️', 'Gán 1 ảnh cho nhiều món AI')}
    <div class="delivery-modal-body dbm-editor-body">
      <div class="dbm-assign-top">
        <div class="dbm-assign-preview" id="dbm-aiassign-preview"><div class="dbm-assign-empty">Chưa chọn ảnh</div></div>
        <div class="dbm-assign-source">
          ${dbmDropzoneHtml('aijobimg', 'Thả ảnh vào đây hoặc bấm để chọn', { multiple: false, compact: true })}
        </div>
      </div>
      <div class="dbm-library-strip">${dbmLibraryStripHtml('dbmAiPickImage')}</div>
      <div class="delivery-input-group">
        <label class="delivery-input-label">Chọn các món dùng ảnh này:</label>
        <div class="dbm-chk-list">
          ${pending.map(x => `
            <label class="dbm-chk-row">
              <input type="checkbox" ${dbmChk.selected.has(String(x.idx)) ? 'checked' : ''} onchange="dbmAiToggleAssignRow(${x.idx}, this.checked)">
              <div class="dbm-chk-thumb"><img src="${escapeHtml(dbmAiItemImage(x.it))}" alt=""></div>
              <div class="dbm-chk-info"><div class="dbm-chk-name">${escapeHtml(x.it.name)}${x.it.image ? '' : ' <em>• chưa có ảnh</em>'}</div>
              <div class="dbm-chk-sub">${formatVND(x.it.price)}</div></div>
            </label>`).join('')}
        </div>
      </div>
    </div>
    <div class="dbm-editor-footer">
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="dbmAiApplyAssign()">✅ Áp dụng ảnh</button>
    </div>`);
}

// ─────────────────────────────────────────────────────────────────────────
// AI điền giúp form mặt hàng (tag, nguyên liệu, dinh dưỡng, mô tả)
// ─────────────────────────────────────────────────────────────────────────

let dbmAiFillBusy = false;

async function dbmAiFillItemForm() {
  if (dbmAiFillBusy) return;
  if (!dbmAiIsConfigured()) {
    showToast('alertRegular', 'Chưa cấu hình API AI — vào “AI tạo hàng” → Cài đặt API');
    return;
  }
  const name = document.getElementById('item-editor-name')?.value.trim();
  if (!name) {
    showToast('alertRegular', 'Hãy nhập tên mặt hàng trước');
    return;
  }
  dbmAiFillBusy = true;
  showToast('sparkleRegular', 'AI đang điền thông tin...');
  try {
    const catName = DB.getCategoryById(document.getElementById('item-editor-category')?.value)?.name || '';
    const system = `Bạn là chuyên gia dinh dưỡng & ẩm thực Việt Nam. CHỈ trả về MỘT khối JSON hợp lệ, không giải thích.
Định dạng: {"description":"1-2 câu hấp dẫn","tags":["2-5 tag ngắn tiếng Việt viết thường"],"ingredients":[{"name":"","amount":""}],"nutrition":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sodium":0,"sugar":0},"healthyScore":8.4,"healthyLevel":"Nhận xét ngắn gọn 4-10 từ về mức độ healthy"}
Dinh dưỡng ước tính cho MỖI PHẦN (kcal, g, sodium mg). healthyScore thang 1.0-10.0 chấm khách quan theo cách chế biến & dinh dưỡng. ingredients 3-6 mục.
Tag đã dùng (ưu tiên dùng lại): ${DB.getAllTags().slice(0, 30).map(t => t.tag).join(', ')}`;
    const text = await dbmAiCallLLM(system, `Món: ${name}\nDanh mục: ${catName}\nMô tả hiện có: ${document.getElementById('item-editor-desc')?.value || ''}`, { maxTokens: 2000, temperature: 0.5 });
    const data = dbmAiExtractJson(text);

    const desc = document.getElementById('item-editor-desc');
    if (desc && !desc.value.trim() && data.description) desc.value = String(data.description).trim();
    dbmTagState.item = dbmParseTags([...dbmTagState.item, ...dbmParseTags(data.tags)]);
    dbmTagRerender('item');
    const ing = dbmCleanIngredients(data.ingredients);
    if (dbmEditorIngredients.length === 0 && ing.length) { dbmEditorIngredients = ing; dbmRenderIngredientRows(); }
    const nutri = dbmCleanNutrition(data.nutrition) || {};
    Object.entries(nutri).forEach(([k, v]) => {
      const el = document.getElementById(`item-nutri-${k}`);
      if (el && el.value === '') el.value = v;
    });
    const hScore = dbmCleanHealthyScore(data.healthyScore ?? data.nutrition?.healthyScore);
    const hLevel = dbmCleanHealthyLevel(data.healthyLevel ?? data.nutrition?.healthyLevel);
    const sEl = document.getElementById('item-editor-healthy-score');
    const lEl = document.getElementById('item-editor-healthy-level');
    if (sEl && !sEl.value && hScore !== null) sEl.value = hScore;
    if (lEl && !lEl.value.trim() && hLevel) lEl.value = hLevel;
    if (typeof dbmRefreshEditorHealthyPreview === 'function') dbmRefreshEditorHealthyPreview();
    showToast('checkmarkFilled', 'AI đã điền tag, nguyên liệu, dinh dưỡng & đánh giá độ Healthy — hãy kiểm tra lại trước khi lưu');
  } catch (err) {
    showToast('alertRegular', `AI không điền được: ${err.message}`);
  } finally {
    dbmAiFillBusy = false;
  }
}

// Tiếp tục các yêu cầu còn dang dở sau khi tải lại trang (khi người dùng mở tab AI)
(function dbmAiResumeOnLoad() {
  if (dbmAiJobs.some(j => j.status === 'queued')) {
    window.addEventListener('load', () => setTimeout(() => {
      if (dbmAiIsConfigured()) dbmAiProcessQueue();
    }, 1500));
  }
})();

