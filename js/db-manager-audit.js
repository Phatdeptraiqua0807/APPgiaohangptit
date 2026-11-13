/* ==========================================================================
   ptitngon - AI Multi-Select Database Evaluator & Advisor (js/db-manager-audit.js)
   - Cho phép chọn nhiều Mặt hàng (items), Danh mục (categories) hoặc Nhà hàng (stores)
     để nhờ AI đánh giá lại tổng thể & chỉ ra chi tiết cần điều chỉnh điều gì.
   - Hỗ trợ song song 2 động cơ phân tích:
     1) LLM API thực tế (Gemini, OpenRouter, DeepSeek, Groq, OpenAI, Custom...) theo lô tự động
     2) Chuyên gia AI Nội bộ (Smart Culinary & Catalog Heuristic Engine) — chạy tức thì không cần API Key
   - Cho phép xem so sánh Trước ➡️ Sau cho từng trường đề xuất, tick chọn từng mục và áp dụng 1 chạm.
   ========================================================================== */

let dbmAuditState = {
  entityType: 'items', // 'items' | 'categories' | 'stores'
  targetIds: [],
  focusNote: '',
  engineMode: 'auto', // 'auto' | 'local'
  filterMode: 'all', // 'all' | 'needs_fix' | 'has_changes'
  running: false,
  progressText: '',
  engineUsed: '', // 'llm' | 'local'
  engineLabel: '',
  overallSummary: '',
  errorNote: '',
  results: []
};

const DBM_AUDIT_ENTITY_META = {
  items: {
    icon: '🍜',
    singular: 'mặt hàng',
    plural: 'mặt hàng',
    title: 'AI Đánh Giá & Đề Xuất Chỉnh Sửa Mặt Hàng',
    focusChips: [
      { label: '🎯 Rà soát toàn diện', prompt: 'Rà soát toàn diện giá bán, mô tả, calo, điểm Healthy, tag tìm kiếm, phân loại danh mục và hình ảnh.' },
      { label: '💸 Cân đối giá SV PTIT', prompt: 'Kiểm tra kỹ mức giá bán đã hợp túi tiền sinh viên PTIT (20K–55K cho món lẻ) và làm tròn nghìn đồng chưa.' },
      { label: '🥗 Chuẩn hóa Calo & Healthy', prompt: 'Đánh giá kỹ bảng dinh dưỡng (kcal, đạm, xơ, béo, đường) và chấm lại điểm Healthy + nhận xét khách quan.' },
      { label: '🔎 Tối ưu Mô tả & Tag', prompt: 'Viết lại mô tả hấp dẫn hơn và bổ sung đầy đủ bộ tag tiếng Việt để khách dễ tìm thấy món.' }
    ]
  },
  categories: {
    icon: '🏷️',
    singular: 'danh mục',
    plural: 'danh mục',
    title: 'AI Đánh Giá & Đề Xuất Chỉnh Sửa Danh Mục',
    focusChips: [
      { label: '🎯 Rà soát toàn diện', prompt: 'Đánh giá độ phủ món ăn, tên danh mục, biểu tượng emoji, mô tả, bộ tag gom món và chế độ hiển thị Trang chủ.' },
      { label: '#️⃣ Tối ưu Tag gom món', prompt: 'Kiểm tra các danh mục theo tag và gợi ý bổ sung các tag liên quan đang có trong kho để gom đủ món.' },
      { label: '🏠 Bố cục Trang chủ', prompt: 'Cân đối hiển thị giữa Lưới 2 dòng (food-categories-section) và Dãy quán ngang (restaurants-section), ẩn danh mục rỗng.' },
      { label: '✨ Chuẩn hóa Tên & Mô tả', prompt: 'Làm gọn tên danh mục cho vừa ô 2 dòng và viết lại mô tả ngắn thu hút sinh viên.' }
    ]
  },
  stores: {
    icon: '🏪',
    singular: 'nhà hàng',
    plural: 'nhà hàng',
    title: 'AI Đánh Giá & Đề Xuất Chỉnh Sửa Nhà Hàng',
    focusChips: [
      { label: '🎯 Rà soát toàn diện', prompt: 'Đánh giá thực đơn, danh mục chính, tầm giá $/$$/$$$, địa chỉ quanh PTIT, phí ship, thời gian giao và lời giới thiệu.' },
      { label: '🚚 Tối ưu Ship & Giao hàng', prompt: 'Kiểm tra tính hợp lý giữa khoảng cách tới Học viện PTIT, thời gian giao dự kiến và phí vận chuyển cho sinh viên.' },
      { label: '🍽️ Khớp Thực đơn & Mức giá', prompt: 'Đối chiếu danh mục chính và mức giá ($/$$/$$$) của quán với các món thực tế đang bán trong quán.' },
      { label: '🏅 Nâng cấp Giới thiệu & Ưu đãi', prompt: 'Viết lại lời giới thiệu ngắn nổi bật món tủ của quán, huy hiệu và nhãn ưu đãi thu hút đơn.' }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 1. TIỆN ÍCH CHUẨN HÓA & ĐỊNH DẠNG SO SÁNH
// ─────────────────────────────────────────────────────────────────────────

function dbmAuditSeverityInfo(score, changesCount) {
  if (score < 72 || changesCount >= 3) {
    return { key: 'warn', icon: '⚠️', label: 'Cần điều chỉnh' };
  }
  if (score < 88 || changesCount >= 1) {
    return { key: 'suggest', icon: '💡', label: 'Nên tinh chỉnh' };
  }
  return { key: 'ok', icon: '✅', label: 'Đã tối ưu tốt' };
}

function dbmAuditFormatNutritionSummary(nutri) {
  if (!nutri || typeof nutri !== 'object') return 'Chưa khai báo';
  const parts = [];
  if (Number.isFinite(Number(nutri.calories))) parts.push(`${Math.round(Number(nutri.calories))} kcal`);
  if (Number.isFinite(Number(nutri.protein))) parts.push(`${Number(nutri.protein)}g đạm`);
  if (Number.isFinite(Number(nutri.carbs))) parts.push(`${Number(nutri.carbs)}g tinh bột`);
  if (Number.isFinite(Number(nutri.fat))) parts.push(`${Number(nutri.fat)}g béo`);
  if (Number.isFinite(Number(nutri.fiber))) parts.push(`${Number(nutri.fiber)}g xơ`);
  if (Number.isFinite(Number(nutri.sugar))) parts.push(`${Number(nutri.sugar)}g đường`);
  return parts.length ? parts.join(' • ') : 'Chưa khai báo';
}

function dbmAuditFormatIngredientsSummary(ings) {
  if (!Array.isArray(ings) || !ings.length) return 'Chưa khai báo';
  return ings.slice(0, 5).map(g => `${g.name}${g.amount ? ` (${g.amount})` : ''}`).join(', ');
}

function dbmAuditEstimateNutritionForDish(item) {
  const blob = dbmNormText(`${item.name || ''} ${item.category || ''} ${(item.tags || []).join(' ')} ${item.description || ''}`);
  let calories = 490, protein = 22, carbs = 58, fat = 16, fiber = 3.5, sodium = 880, sugar = 5;

  if (/goi cuon|salad|eat clean|uc ga|gao lut|luoc|hap|healthy/.test(blob)) {
    calories = 330; protein = 26; carbs = 34; fat = 8; fiber = 6.5; sodium = 540; sugar = 4;
  } else if (/pho|bun|mien|hu tieu|chao|sup|banh canh/.test(blob)) {
    calories = 460; protein = 25; carbs = 56; fat = 13; fiber = 3.8; sodium = 1080; sugar = 4.5;
  } else if (/com tam|com suon|com ga|com rang|com van phong|com/.test(blob)) {
    calories = 610; protein = 28; carbs = 74; fat = 20; fiber = 3.5; sodium = 980; sugar = 6;
  } else if (/mi cay|lau|tokbokki|han quoc/.test(blob)) {
    calories = 590; protein = 24; carbs = 68; fat = 22; fiber = 3.2; sodium = 1380; sugar = 8;
  } else if (/chien|ran|gion|ga ran|khoai tay|nem chua ran|xuc xich|pho mai|burger|pizza/.test(blob)) {
    calories = 540; protein = 19; carbs = 46; fat = 29; fiber = 2.0; sodium = 960; sugar = 6;
  } else if (/tra sua|kem cheese|tran chau|che|banh ngot|flan|tiramisu/.test(blob)) {
    calories = 380; protein = 5; carbs = 62; fat = 12; fiber = 1.0; sodium = 150; sugar = 30;
  } else if (/tra dao|tra chanh|tra trai cay|nuoc ep|sinh to|sua chua|ca phe/.test(blob)) {
    calories = 190; protein = 3; carbs = 36; fat = 3.5; fiber = 2.2; sodium = 95; sugar = 18;
  } else if (/banh mi|xoi/.test(blob)) {
    calories = 450; protein = 18; carbs = 54; fat = 17; fiber = 2.8; sodium = 820; sugar = 5;
  }

  return { calories, protein, carbs, fat, fiber, sodium, sugar };
}

function dbmAuditInferSampleIngredients(item) {
  const blob = dbmNormText(`${item.name || ''} ${item.category || ''}`);
  if (/pho|bun bo|bun cha|bun rieu|bun|mien|hu tieu/.test(blob)) {
    return [
      { name: 'Bánh phở / bún tươi trong ngày', amount: '180g' },
      { name: 'Thịt bò / thịt heo tuyển chọn', amount: '95g' },
      { name: 'Nước dùng ninh xương & thảo mộc', amount: '350ml' },
      { name: 'Rau sống, hành ngò, giá đỗ sạch', amount: '60g' }
    ];
  }
  if (/com/.test(blob)) {
    return [
      { name: 'Cơm gạo dẻo nóng', amount: '200g' },
      { name: 'Thịt / đạm chính tẩm ướp', amount: '120g' },
      { name: 'Rau củ luộc / dưa góp ăn kèm', amount: '70g' },
      { name: 'Canh rau thanh mát', amount: '150ml' }
    ];
  }
  if (/tra sua|tra |ca phe|nuoc ep|sinh to|che/.test(blob)) {
    return [
      { name: 'Cốt trà / nguyên liệu pha chế tươi', amount: '220ml' },
      { name: 'Sữa tươi / trái cây tự nhiên', amount: '80ml' },
      { name: 'Topping ăn kèm chuẩn vị', amount: '50g' }
    ];
  }
  if (/salad|goi cuon|healthy|uc ga|gao lut/.test(blob)) {
    return [
      { name: 'Rau xà lách & củ quả tươi VietGAP', amount: '140g' },
      { name: 'Ức gà / tôm thịt ít béo', amount: '100g' },
      { name: 'Sốt trộn thanh nhẹ ít calo', amount: '30ml' }
    ];
  }
  return [
    { name: `Nguyên liệu chính món ${item.name}`, amount: '150g' },
    { name: 'Rau thơm & đồ ăn kèm tươi sạch', amount: '50g' },
    { name: 'Nước sốt pha chế riêng của quán', amount: '30ml' }
  ];
}

function dbmAuditSuggestCategoryEmoji(name) {
  const n = dbmNormText(name);
  if (/pho|bun|mien|mon nuoc/.test(n)) return '🍜';
  if (/com|van phong/.test(n)) return '🍱';
  if (/chien|ran|gion|ga/.test(n)) return '🍗';
  if (/cay|mi cay|lau/.test(n)) return '🌶️';
  if (/healthy|salad|chay|thanh dam|eat clean/.test(n)) return '🥗';
  if (/tra sua|do uong|giai khat/.test(n)) return '🧋';
  if (/ca phe|coffee/.test(n)) return '☕';
  if (/banh mi|sandwich/.test(n)) return '🥖';
  if (/banh|trang mieng|che|kem/.test(n)) return '🍰';
  if (/pizza|burger|au/.test(n)) return '🍕';
  if (/an vat|an xe|khuya|xiên/.test(n)) return '🍢';
  if (/hai san|oc|sushi/.test(n)) return '🦐';
  return '🍽️';
}

function dbmAuditDetectIdealManualCategory(item, manualCats) {
  if (!manualCats || !manualCats.length) return null;
  const nameNorm = dbmNormText(item.name || '');
  const curCatNorm = dbmNormText(item.category || '');

  // Chỉ đề xuất đổi danh mục khi tên món rõ ràng lệch hẳn với danh mục hiện tại
  const rules = [
    { itemRe: /\b(tra sua|hong tra|luc tra|o long|matcha latte|macchiato|sinh to|nuoc ep|ca phe|bac xiu|americano)\b/, badCatRe: /\b(pho|bun|com|lau|ga ran|pizza)\b/, targetRe: /tra sua|do uong|ca phe|giai khat/ },
    { itemRe: /\b(pho bo|pho ga|bun bo|bun cha|bun rieu|bun dau|hu tieu|mien ga|banh da cua)\b/, badCatRe: /\b(tra sua|do uong|ca phe|trang mieng|banh ngot|pizza)\b/, targetRe: /pho|bun|mien|mon nuoc/ },
    { itemRe: /\b(com tam|com suon|com rang|com ga|com bo|com nieu)\b/, badCatRe: /\b(tra sua|do uong|ca phe|trang mieng|che)\b/, targetRe: /com/ }
  ];

  for (const r of rules) {
    if (r.itemRe.test(nameNorm) && r.badCatRe.test(curCatNorm)) {
      const found = manualCats.find(c => r.targetRe.test(dbmNormText(c.name)));
      if (found && found.id !== item.categoryId) return found;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. CHUYÊN GIA AI NỘI BỘ (LOCAL DIAGNOSTIC & ADJUSTMENT ENGINE)
// ─────────────────────────────────────────────────────────────────────────

function dbmAuditBuildContext() {
  const items = DB.getItems();
  const stores = DB.getStores();
  const categories = DB.getCategories();
  const manualCategories = DB.getManualCategories();
  const allTags = DB.getAllTags();
  const vouchers = DB.getVouchers();

  const catPrices = new Map();
  items.forEach(it => {
    const cid = it.categoryId || it.category || 'default';
    if (!catPrices.has(cid)) catPrices.set(cid, []);
    if (Number(it.price) > 0) catPrices.get(cid).push(Number(it.price));
  });

  const catAvgPrice = new Map();
  catPrices.forEach((arr, cid) => {
    const sum = arr.reduce((a, b) => a + b, 0);
    catAvgPrice.set(cid, Math.round(sum / arr.length));
  });

  return {
    items,
    stores,
    categories,
    manualCategories,
    allTags,
    vouchers,
    catAvgPrice,
    homeGridCount: categories.filter(c => c.showOnHome !== false).length,
    homeResSectionCount: categories.filter(c => c.showAsRestaurantSection === true).length
  };
}

function dbmAuditAnalyzeItemLocally(item, ctx, focusNote = '') {
  const issues = [];
  const strengths = [];
  const changes = [];
  let score = 96;
  const focusNorm = dbmNormText(focusNote);

  const pushChange = (field, label, beforeText, afterText, value, include = true) => {
    if (String(beforeText).trim() === String(afterText).trim()) return;
    changes.push({ field, label, beforeText, afterText, value, include });
  };

  // 1. Kiểm tra Giá bán
  const price = Number(item.price) || 0;
  const avgCat = ctx.catAvgPrice.get(item.categoryId) || 38000;
  const isComboOrHotpot = /combo|lau|set|nhom|2 nguoi|4 nguoi|pizza lon/.test(dbmNormText(item.name));
  const isSimpleDrinkOrSnack = /tra da|banh trang|nem chua|khoai tay|xuc xich|sua chua|tra chanh/.test(dbmNormText(item.name));

  if (price % 1000 !== 0 || price < 8000) {
    const fixedPrice = Math.max(15000, Math.round(price / 1000) * 1000);
    score -= 14;
    issues.push(`Giá hiện tại (${formatVND(price)}) bị lẻ hoặc quá thấp — nên làm tròn bội số 1.000đ.`);
    pushChange('price', 'Giá bán', formatVND(price), formatVND(fixedPrice), fixedPrice, true);
  } else if (!isComboOrHotpot && isSimpleDrinkOrSnack && price > 65000) {
    const suggested = Math.min(35000, Math.round(avgCat / 1000) * 1000);
    score -= 12;
    issues.push(`Món ăn vặt / giải khát lẻ nhưng giá ${formatVND(price)} hơi cao so với sinh viên PTIT.`);
    pushChange('price', 'Giá bán', formatVND(price), formatVND(suggested), suggested, false);
  } else if (!isComboOrHotpot && price > 95000) {
    const suggested = Math.max(45000, Math.min(65000, Math.round((avgCat * 1.25) / 1000) * 1000));
    score -= 10;
    issues.push(`Giá ${formatVND(price)} cao hơn mặt bằng sinh viên quanh trường (trung bình danh mục ~${formatVND(avgCat)}).`);
    pushChange('price', 'Giá bán', formatVND(price), formatVND(suggested), suggested, /gia|re|sinh vien/.test(focusNorm));
  } else {
    strengths.push(`Mức giá ${formatVND(price)} hợp túi tiền sinh viên`);
  }

  // 2. Kiểm tra Mô tả món
  const desc = String(item.description || '').trim();
  const isTemplateDesc = !desc || desc.length < 32 || /thuoc danh muc .* dam bao chat luong tuoi ngon/i.test(dbmNormText(desc));
  if (isTemplateDesc) {
    score -= 11;
    const storePart = item.restaurantName && !/gian hang tu chon/i.test(dbmNormText(item.restaurantName))
      ? ` tại ${item.restaurantName}`
      : '';
    const newDesc = `${item.name}${storePart} chế biến nóng sốt trong ngày, nguyên liệu tươi sạch, hương vị đậm đà vừa miệng và đóng gói giữ nhiệt kỹ khi giao tới cổng trường / KTX PTIT.`;
    issues.push(desc ? 'Mô tả mặt hàng còn sơ sài hoặc đang dùng câu mẫu tự động.' : 'Mặt hàng chưa có mô tả chi tiết cho khách xem.');
    pushChange('description', 'Mô tả món ăn', desc || '(Trống)', newDesc, newDesc, true);
  } else {
    strengths.push('Mô tả món rõ ràng, giàu thông tin');
  }

  // 3. Kiểm tra Dinh dưỡng & Đánh giá Healthy
  const curNutri = item.nutrition && typeof item.nutrition === 'object' ? item.nutrition : null;
  const hasFullNutri = curNutri && Number(curNutri.calories) > 0 && Number(curNutri.protein) >= 0 && Number(curNutri.carbs) >= 0 && Number(curNutri.fat) >= 0;
  let effectiveNutri = curNutri;

  if (!hasFullNutri) {
    score -= 10;
    effectiveNutri = dbmAuditEstimateNutritionForDish(item);
    issues.push('Chưa khai báo đầy đủ chỉ số dinh dưỡng (Calo, Đạm, Tinh bột, Chất béo, Chất xơ) cho hồ sơ dinh dưỡng.');
    pushChange(
      'nutrition',
      'Chỉ số Dinh dưỡng',
      dbmAuditFormatNutritionSummary(curNutri),
      dbmAuditFormatNutritionSummary(effectiveNutri),
      effectiveNutri,
      true
    );
  } else {
    const macroKcal = (Number(curNutri.protein) || 0) * 4 + (Number(curNutri.carbs) || 0) * 4 + (Number(curNutri.fat) || 0) * 9;
    if (macroKcal > 40 && Math.abs(Number(curNutri.calories) - macroKcal) > 180) {
      const recalibrated = { ...curNutri, calories: Math.round(macroKcal / 5) * 5 };
      effectiveNutri = recalibrated;
      score -= 8;
      issues.push(`Lượng Calo (${curNutri.calories} kcal) lệch nhiều so với tổng năng lượng từ Đạm/Bột/Béo (~${Math.round(macroKcal)} kcal).`);
      pushChange(
        'nutrition',
        'Chuẩn hóa Calo',
        dbmAuditFormatNutritionSummary(curNutri),
        dbmAuditFormatNutritionSummary(recalibrated),
        recalibrated,
        true
      );
    } else {
      strengths.push(`Có hồ sơ dinh dưỡng (${Math.round(Number(curNutri.calories))} kcal)`);
    }
  }

  const objectiveHealthy = dbmComputeHealthyAssessment({
    ...item,
    nutrition: effectiveNutri,
    healthyScore: null
  });
  const curHealthy = dbmGetItemHealthy(item);
  const scoreDiff = Math.abs(curHealthy.score - objectiveHealthy.healthyScore);
  const rawLevel = String(item.healthyLevel || '').trim();

  if (scoreDiff >= 0.9 || !rawLevel || rawLevel.length < 10) {
    score -= scoreDiff >= 0.9 ? 10 : 5;
    if (scoreDiff >= 0.9) {
      issues.push(`Điểm Healthy hiện tại (${curHealthy.score}/10) chưa sát với thành phần & cách chế biến (mức khách quan khoảng ${objectiveHealthy.healthyScore}/10).`);
      pushChange('healthyScore', 'Điểm Healthy', `${curHealthy.score}/10`, `${objectiveHealthy.healthyScore}/10`, objectiveHealthy.healthyScore, true);
    }
    if (!rawLevel || rawLevel.length < 10 || scoreDiff >= 0.9) {
      if (!rawLevel || rawLevel.length < 10) {
        issues.push('Nhận xét mức độ Healthy còn ngắn hoặc chưa lưu tường minh.');
      }
      pushChange('healthyLevel', 'Nhận xét Healthy', rawLevel || curHealthy.level, objectiveHealthy.healthyLevel, objectiveHealthy.healthyLevel, true);
    }
  } else {
    strengths.push(`Điểm Healthy ${curHealthy.score}/10 cân đối`);
  }

  // 4. Kiểm tra Bộ Tag tìm kiếm
  const curTags = Array.isArray(item.tags) ? item.tags : [];
  const inferred = dbmInferTags({ ...item, price });
  const extraTags = [];
  if (objectiveHealthy.healthyScore >= 8.3 && !curTags.includes('healthy')) extraTags.push('healthy');
  if (price <= 35000 && !curTags.includes('giá sinh viên')) extraTags.push('giá sinh viên');
  const mergedTags = dbmParseTags([...curTags, ...inferred, ...extraTags]).slice(0, 7);

  if (curTags.length < 3 && mergedTags.length > curTags.length) {
    score -= 8;
    issues.push(`Món mới có ${curTags.length} tag — ít tag khiến thanh tìm kiếm và các danh mục theo tag dễ bỏ sót.`);
    pushChange(
      'tags',
      'Bộ Tag tìm kiếm',
      curTags.length ? curTags.map(t => `#${t}`).join(', ') : '(Chưa có tag)',
      mergedTags.map(t => `#${t}`).join(', '),
      mergedTags,
      true
    );
  }

  // 5. Kiểm tra Nguyên liệu
  if (!Array.isArray(item.ingredients) || item.ingredients.length < 2) {
    score -= 6;
    const sampleIngs = dbmAuditInferSampleIngredients(item);
    issues.push('Chưa liệt kê danh sách nguyên liệu định lượng (hiển thị trong trang chi tiết món & ATTP).');
    pushChange(
      'ingredients',
      'Nguyên liệu cấu thành',
      dbmAuditFormatIngredientsSummary(item.ingredients),
      dbmAuditFormatIngredientsSummary(sampleIngs),
      sampleIngs,
      true
    );
  }

  // 6. Kiểm tra Danh mục & Cửa hàng
  const betterCat = dbmAuditDetectIdealManualCategory(item, ctx.manualCategories);
  if (betterCat) {
    score -= 12;
    issues.push(`Tên món "${item.name}" có vẻ phù hợp với danh mục "${betterCat.icon} ${betterCat.name}" hơn là "${item.category}".`);
    pushChange('categoryId', 'Danh mục mặt hàng', item.category || '—', `${betterCat.icon} ${betterCat.name}`, betterCat.id, true);
  }

  if (Number(item.restaurantId) === 1000) {
    const matchingStore = ctx.stores.find(s => Number(s.id) !== 1000 && (s.categoryId === item.categoryId || s.category === item.category));
    if (matchingStore) {
      score -= 6;
      issues.push(`Món đang nằm ở "Gian hàng tự chọn" chung — có thể gắn về quán chuyên "${matchingStore.name}" cùng danh mục.`);
      pushChange('restaurantId', 'Cửa hàng phục vụ', item.restaurantName || 'Gian hàng tự chọn', matchingStore.name, matchingStore.id, false);
    }
  }

  // 7. Kiểm tra Hình ảnh
  const missingImg = dbmIsPlaceholderImage(item);
  if (missingImg) {
    score -= 14;
    const plan = dbmBuildCulinarySearchPlan(item.name, { category: item.category });
    issues.push(`Mặt hàng đang dùng ảnh tạm (placeholder) — nên tự động lấy ảnh chụp món ăn thật với từ khóa "${plan.primaryQuery}".`);
    pushChange('autoFetchImage', 'Hình ảnh mặt hàng', 'Ảnh tạm (Placeholder)', `Tự lấy ảnh thật: "${plan.primaryQuery}"`, plan.primaryQuery, true);
  } else {
    strengths.push('Đã có hình ảnh món ăn');
  }

  score = Math.max(38, Math.min(98, Math.round(score)));
  const sev = dbmAuditSeverityInfo(score, changes.length);
  const summary = issues.length === 0
    ? 'Dữ liệu mặt hàng đầy đủ, giá bán, dinh dưỡng và điểm Healthy đều hợp lý.'
    : `Phát hiện ${issues.length} điểm cần lưu ý (${changes.length} trường có thể chuẩn hóa ngay).`;

  return {
    id: item.id,
    title: item.name,
    subtitle: `🏪 ${item.restaurantName || 'Quán PTIT'} • ${item.category || ''} • ${formatVND(price)}`,
    thumb: item.image,
    icon: '🍜',
    score,
    severity: sev.key,
    summary,
    issues,
    strengths,
    changes,
    includeCard: changes.length > 0,
    applied: false
  };
}

function dbmAuditAnalyzeCategoryLocally(cat, ctx, focusNote = '') {
  const issues = [];
  const strengths = [];
  const changes = [];
  let score = 96;

  const pushChange = (field, label, beforeText, afterText, value, include = true) => {
    if (String(beforeText).trim() === String(afterText).trim()) return;
    changes.push({ field, label, beforeText, afterText, value, include });
  };

  const count = DB.countItemsInCategory(cat);
  const isTag = cat.type === 'tag';

  // 1. Độ phủ mặt hàng & quy tắc Tag
  if (isTag) {
    const curRule = Array.isArray(cat.tagRule) ? cat.tagRule : [];
    const nameWords = dbmNormText(cat.name).split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    const relatedTags = ctx.allTags
      .map(t => t.tag)
      .filter(tag => {
        if (curRule.includes(tag)) return false;
        const tn = dbmNormText(tag);
        return nameWords.some(w => tn.includes(w) || w.includes(tn));
      })
      .slice(0, 4);

    if (count === 0) {
      score -= 22;
      issues.push(`Danh mục theo tag đang khớp 0 mặt hàng (tag hiện tại: ${curRule.length ? curRule.map(t => '#' + t).join(', ') : 'trống'}).`);
      if (relatedTags.length > 0) {
        const nextRule = dbmParseTags([...curRule, ...relatedTags]);
        pushChange('tagRule', 'Bộ Tag gom món', curRule.join(', ') || '(Trống)', nextRule.join(', '), nextRule, true);
      } else if (cat.showOnHome !== false || cat.showAsRestaurantSection) {
        pushChange('showOnHome', 'Hiện lưới 2 dòng Trang chủ', 'Đang bật', 'Tạm ẩn (vì 0 món)', false, true);
        if (cat.showAsRestaurantSection) {
          pushChange('showAsRestaurantSection', 'Hiện dãy quán Trang chủ', 'Đang bật', 'Tắt (vì 0 món)', false, true);
        }
      }
    } else if (count < 4 && relatedTags.length > 0) {
      const nextRule = dbmParseTags([...curRule, ...relatedTags]);
      const nextCount = ctx.items.filter(it => dbmItemMatchesTagRule(it, nextRule)).length;
      if (nextCount > count) {
        score -= 9;
        issues.push(`Danh mục mới gom được ${count} món — có thể mở rộng thêm tag liên quan để gom lên ${nextCount} món.`);
        pushChange('tagRule', 'Mở rộng Tag gom món', curRule.map(t => `#${t}`).join(', '), nextRule.map(t => `#${t}`).join(', '), nextRule, true);
      }
    } else {
      strengths.push(`Tự động gom tốt ${count} mặt hàng theo tag`);
    }
  } else {
    if (count === 0) {
      score -= 20;
      issues.push('Danh mục thủ công hiện có 0 mặt hàng — khách bấm vào trên Trang chủ sẽ thấy danh sách trống.');
      if (cat.showOnHome !== false) {
        pushChange('showOnHome', 'Hiện ô trên Trang chủ', 'Đang bật', 'Tạm ẩn cho tới khi có món', false, true);
      }
      if (cat.showAsRestaurantSection) {
        pushChange('showAsRestaurantSection', 'Hiện dãy quán Trang chủ', 'Đang bật', 'Tắt (chưa có món)', false, true);
      }
    } else if (count < 3) {
      score -= 8;
      issues.push(`Danh mục mới chỉ có ${count} mặt hàng — nên thêm hoặc chuyển thêm món vào để phong phú hơn.`);
      if (cat.showAsRestaurantSection) {
        pushChange('showAsRestaurantSection', 'Hiện dãy quán (restaurants-section)', 'Đang bật (quá ít món)', 'Tắt dãy ngang, chỉ giữ ô danh mục', false, true);
      }
    } else {
      strengths.push(`Có ${count} mặt hàng đang hoạt động`);
    }
  }

  // 2. Chế độ hiển thị Trang chủ (2 dòng vs restaurants-section)
  if (count >= 6 && cat.showOnHome === false && !cat.showAsRestaurantSection) {
    score -= 7;
    issues.push(`Danh mục có tới ${count} mặt hàng nhưng đang tắt cả Ô danh mục lẫn Dãy quán trên Trang chủ.`);
    if (isTag && ctx.homeResSectionCount < 6) {
      pushChange('showAsRestaurantSection', 'Hiện dãy quán Trang chủ', 'Đang tắt', 'Bật dãy ngang (restaurants-section)', true, false);
    } else {
      pushChange('showOnHome', 'Hiện lưới 2 dòng Trang chủ', 'Đang tắt', 'Bật hiển thị', true, false);
    }
  }

  // 3. Tên danh mục cho lưới 2 dòng
  const name = String(cat.name || '').trim();
  if (name.length > 22) {
    score -= 8;
    const shortName = name.split(/[•\-–(]/)[0].trim().slice(0, 20).trim();
    issues.push(`Tên danh mục "${name}" dài ${name.length} ký tự — dễ bị cắt chữ trong ô lưới 2 dòng trên điện thoại.`);
    if (shortName && shortName.length >= 4 && !DB.findCategoryByName(shortName, cat.id)) {
      pushChange('name', 'Tên danh mục ngắn gọn', name, shortName, shortName, false);
    }
  }

  // 4. Biểu tượng Emoji
  const icon = String(cat.icon || '').trim();
  if (!icon || icon === '🛍️' || icon === '#️⃣') {
    const suggestedEmoji = dbmAuditSuggestCategoryEmoji(name);
    if (suggestedEmoji && suggestedEmoji !== icon) {
      score -= 6;
      issues.push(`Biểu tượng hiện tại (${icon || 'trống'}) còn chung chung — nên đổi sang emoji ẩm thực trực quan hơn.`);
      pushChange('icon', 'Biểu tượng Emoji', icon || '(Trống)', suggestedEmoji, suggestedEmoji, true);
    }
  } else {
    strengths.push(`Biểu tượng ${icon} trực quan`);
  }

  // 5. Mô tả danh mục
  const desc = String(cat.description || '').trim();
  if (!desc || desc.length < 16 || /^danh muc /i.test(dbmNormText(desc))) {
    score -= 8;
    const newDesc = isTag
      ? `Tuyển tập các món ${name.toLowerCase()} được yêu thích quanh Học viện PTIT, tự động cập nhật theo tag.`
      : `Thực đơn ${name.toLowerCase()} nóng hổi, chuẩn vị sinh viên PTIT, giao nhanh tận cổng trường & KTX.`;
    issues.push('Mô tả danh mục còn trống hoặc chỉ lặp lại tên danh mục.');
    pushChange('description', 'Mô tả ngắn', desc || '(Trống)', newDesc, newDesc, true);
  } else {
    strengths.push('Có mô tả danh mục rõ ràng');
  }

  score = Math.max(40, Math.min(98, Math.round(score)));
  const sev = dbmAuditSeverityInfo(score, changes.length);
  const summary = issues.length === 0
    ? `Danh mục "${cat.name}" (${count} món) đã cấu hình chuẩn xác cho cả tìm kiếm và Trang chủ.`
    : `Có ${issues.length} góp ý tối ưu độ phủ món & hiển thị cho danh mục "${cat.name}".`;

  return {
    id: cat.id,
    title: `${cat.icon || '🏷️'} ${cat.name}`,
    subtitle: `${isTag ? '# Theo tag' : '🏷️ Thủ công'} • ${count} mặt hàng • ${cat.showOnHome !== false ? 'Hiện lưới 2 dòng' : 'Ẩn lưới'}${cat.showAsRestaurantSection ? ' • Hiện dãy quán' : ''}`,
    thumb: cat.image,
    icon: cat.icon || '🏷️',
    score,
    severity: sev.key,
    summary,
    issues,
    strengths,
    changes,
    includeCard: changes.length > 0,
    applied: false
  };
}

function dbmAuditAnalyzeStoreLocally(store, ctx, focusNote = '') {
  const issues = [];
  const strengths = [];
  const changes = [];
  let score = 96;
  const isDefaultPool = Number(store.id) === 1000;
  const storeItems = DB.getItemsByStore(store.id);

  const pushChange = (field, label, beforeText, afterText, value, include = true) => {
    if (String(beforeText).trim() === String(afterText).trim()) return;
    changes.push({ field, label, beforeText, afterText, value, include });
  };

  // 1. Kiểm tra quy mô thực đơn & Danh mục chính của quán
  if (!isDefaultPool && storeItems.length === 0) {
    score -= 22;
    issues.push('Nhà hàng hiện chưa có món ăn nào trong thực đơn (0 món) — cần thêm món hoặc chuyển món về quán.');
  } else if (!isDefaultPool && storeItems.length < 3) {
    score -= 8;
    issues.push(`Thực đơn của quán mới có ${storeItems.length} món — nên bổ sung lên ít nhất 4–6 món để tăng tỷ lệ đặt ghép đơn.`);
  } else if (storeItems.length >= 3) {
    strengths.push(`Thực đơn có ${storeItems.length} món hoạt động`);
  }

  if (!isDefaultPool && storeItems.length >= 2) {
    const catCounts = new Map();
    storeItems.forEach(it => {
      if (it.categoryId) catCounts.set(it.categoryId, (catCounts.get(it.categoryId) || 0) + 1);
    });
    let topCatId = null, topCnt = 0;
    catCounts.forEach((cnt, cid) => { if (cnt > topCnt) { topCnt = cnt; topCatId = cid; } });
    const dominantCat = topCatId ? ctx.manualCategories.find(c => c.id === topCatId) : null;
    if (dominantCat && dominantCat.id !== store.categoryId && topCnt / storeItems.length >= 0.65) {
      score -= 10;
      issues.push(`Đa số món của quán (${topCnt}/${storeItems.length} món) thuộc "${dominantCat.name}", nhưng danh mục chính của quán đang để "${store.category}".`);
      pushChange('categoryId', 'Danh mục chính của quán', store.category || '—', `${dominantCat.icon} ${dominantCat.name}`, dominantCat.id, true);
    }
  }

  // 2. Đối chiếu Mức giá ($ / $$ / $$$) với giá trung bình thực đơn
  if (storeItems.length > 0) {
    const avgPrice = Math.round(storeItems.reduce((s, it) => s + (Number(it.price) || 0), 0) / storeItems.length);
    const expectedPriceLevel = avgPrice <= 45000 ? '$' : (avgPrice <= 80000 ? '$$' : '$$$');
    if (store.priceLevel && store.priceLevel !== expectedPriceLevel) {
      score -= 9;
      issues.push(`Mức giá hiển thị "${store.priceLevel}" chưa khớp với giá món trung bình thực tế của quán (${formatVND(avgPrice)}/món).`);
      pushChange('priceLevel', 'Phân khúc giá', store.priceLevel, `${expectedPriceLevel} (TB ~${formatVND(avgPrice)})`, expectedPriceLevel, true);
    } else {
      strengths.push(`Phân khúc giá ${store.priceLevel || '$'} khớp thực đơn (TB ${formatVND(avgPrice)})`);
    }
  }

  // 3. Địa chỉ, Khoảng cách, Thời gian giao & Phí vận chuyển
  const addr = String(store.address || '').trim();
  if (!isDefaultPool && (!addr || addr.length < 18 || /^khu vuc hoc vien ptit$/i.test(dbmNormText(addr)))) {
    score -= 10;
    const specificAddr = `Số 18 Ngõ Ao Sen (đối diện Học viện PTIT), P. Mộ Lao, Hà Đông, Hà Nội`;
    issues.push(`Địa chỉ quán ("${addr || 'Trống'}") còn chung chung — nên ghi rõ số nhà / phố quanh Học viện PTIT để tăng độ tin cậy.`);
    pushChange('address', 'Địa chỉ chi tiết', addr || '(Trống)', specificAddr, specificAddr, true);
  }

  const dist = Number(store.distance) || 0.6;
  const delivText = String(store.deliveryTime || '').trim();
  const numsInDeliv = (delivText.match(/\d+/g) || []).map(Number);
  const maxDelivMin = numsInDeliv.length ? Math.max(...numsInDeliv) : 0;

  if (!delivText || (dist <= 0.9 && maxDelivMin > 30) || (dist >= 2.5 && maxDelivMin > 0 && maxDelivMin < 18)) {
    score -= 8;
    const idealDeliv = dist <= 0.8 ? '12 - 18 phút' : (dist <= 1.8 ? '15 - 22 phút' : '22 - 30 phút');
    issues.push(`Thời gian giao "${delivText || 'Trống'}" chưa tương xứng với khoảng cách ${dist} km tới PTIT.`);
    pushChange('deliveryTime', 'Thời gian giao dự kiến', delivText || '(Trống)', idealDeliv, idealDeliv, true);
  }

  const shipFee = Number(store.shippingFeeNum) || 0;
  if (shipFee > 15000 && dist <= 1.8) {
    score -= 9;
    issues.push(`Quán chỉ cách trường ${dist} km nhưng phí giao ${formatVND(shipFee)} hơi cao so với sinh viên.`);
    pushChange('shippingFeeNum', 'Phí giao hàng', formatVND(shipFee), '10.000đ', 10000, true);
  } else if (shipFee === 0) {
    strengths.push('Hỗ trợ Freeship 0đ thu hút sinh viên');
  }

  // 4. Lời giới thiệu ngắn, Huy hiệu, SĐT & Nhãn ưu đãi
  const review = String(store.shortReview || '').trim();
  if (!review || review.length < 25 || /gian hang chat luong phuc vu tan noi nhanh chong/i.test(dbmNormText(review))) {
    score -= 9;
    const topDishes = storeItems.slice(0, 2).map(i => i.name).join(', ');
    const newReview = topDishes
      ? `Quán quen sinh viên PTIT nổi tiếng với ${topDishes} — chế biến nóng sốt, đóng gói sạch sẽ, giao nhanh tận sảnh giảng đường & KTX.`
      : `${store.name} phục vụ thực đơn tươi ngon chuẩn vị mỗi ngày, ưu đãi tốt cho sinh viên Học viện PTIT.`;
    issues.push('Giới thiệu ngắn của quán còn sơ sài hoặc đang dùng câu mặc định hệ thống.');
    pushChange('shortReview', 'Giới thiệu ngắn', review || '(Trống)', newReview, newReview, true);
  }

  const vouchers = Array.isArray(store.vouchers) ? store.vouchers : [];
  if (!isDefaultPool && vouchers.length === 0) {
    score -= 6;
    const suggestedVouchers = shipFee === 0 ? ['Freeship 0đ', 'Ưu đãi SV PTIT'] : ['Giảm 10K đơn từ 45K', 'Ưu đãi SV PTIT'];
    issues.push('Quán chưa gắn nhãn ưu đãi nổi bật (hiển thị thu hút khách trên trang cửa hàng).');
    pushChange('vouchers', 'Nhãn ưu đãi hiển thị', '(Chưa có)', suggestedVouchers.join(', '), suggestedVouchers, true);
  }

  if (String(store.phone || '').trim() === '0901 234 567' && !isDefaultPool) {
    score -= 4;
    issues.push('Số điện thoại liên hệ đang là số mẫu mặc định (0901 234 567).');
  }

  score = Math.max(40, Math.min(98, Math.round(score)));
  const sev = dbmAuditSeverityInfo(score, changes.length);
  const summary = issues.length === 0
    ? `Thông tin nhà hàng "${store.name}" đầy đủ, đồng bộ tốt với thực đơn ${storeItems.length} món.`
    : `Phát hiện ${issues.length} điểm cần hoàn thiện cho nhà hàng "${store.name}".`;

  return {
    id: store.id,
    title: store.name,
    subtitle: `📍 ${store.distanceText || `${dist} km`} • 🍽️ ${storeItems.length} món • ${store.shippingFee || formatVND(shipFee)} • ${store.priceLevel || '$'}`,
    thumb: store.image,
    icon: '🏪',
    score,
    severity: sev.key,
    summary,
    issues,
    strengths,
    changes,
    includeCard: changes.length > 0,
    applied: false
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 3. PHÂN TÍCH CHUYÊN SÂU BẰNG LLM API (KẾT HỢP CHUẨN HÓA AN TOÀN)
// ─────────────────────────────────────────────────────────────────────────

function dbmAuditBuildLLMPrompts(entityType, batchRecords, ctx, focusNote) {
  const manualCatsStr = ctx.manualCategories.map(c => `${c.id}:"${c.name}"`).join(' | ');
  const storesStr = ctx.stores.slice(0, 35).map(s => `${s.id}:"${s.name}"`).join(' | ');
  const topTagsStr = ctx.allTags.slice(0, 45).map(t => t.tag).join(', ');
  const vouchersStr = ctx.vouchers.filter(v => v.active !== false).map(v => v.code).join(', ');

  let schemaGuide = '';
  let payloadRecords = [];

  if (entityType === 'items') {
    payloadRecords = batchRecords.map(it => ({
      id: it.id,
      name: it.name,
      price: it.price,
      categoryId: it.categoryId,
      category: it.category,
      restaurantId: it.restaurantId,
      restaurantName: it.restaurantName,
      description: it.description,
      tags: it.tags || [],
      nutrition: it.nutrition || null,
      healthyScore: dbmGetItemHealthy(it).score,
      healthyLevel: it.healthyLevel || '',
      ingredientsCount: Array.isArray(it.ingredients) ? it.ingredients.length : 0,
      hasPlaceholderImage: dbmIsPlaceholderImage(it)
    }));
    schemaGuide = `"proposed" chỉ điền các trường THỰC SỰ CẦN SỬA (bỏ qua trường đã tốt):
      - "name": string (nếu tên lỗi chính tả / lủng củng)
      - "price": number (VNĐ, bội số 1000, hợp lý cho SV PTIT)
      - "categoryId": string (chỉ chọn id trong Danh mục thủ công có sẵn)
      - "restaurantId": number (chỉ chọn id trong Cửa hàng có sẵn nếu quán hiện tại sai lệch)
      - "description": string (mô tả hấp dẫn 1-2 câu tiếng Việt)
      - "tags": string[] (3-6 tag tiếng Việt viết thường)
      - "healthyScore": number (1.0 - 10.0, khách quan theo món chiên/ngọt/thanh đạm)
      - "healthyLevel": string (nhận xét ngắn 5-12 từ tiếng Việt)
      - "nutrition": {"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sodium":number,"sugar":number}
      - "autoFetchImage": string (từ khóa tìm ảnh món ăn nếu hasPlaceholderImage = true)`;
  } else if (entityType === 'categories') {
    payloadRecords = batchRecords.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type || 'manual',
      tagRule: c.tagRule || [],
      icon: c.icon,
      description: c.description || '',
      matchedItemCount: DB.countItemsInCategory(c),
      showOnHome: c.showOnHome !== false,
      showAsRestaurantSection: Boolean(c.showAsRestaurantSection)
    }));
    schemaGuide = `"proposed" chỉ điền các trường THỰC SỰ CẦN SỬA (bỏ qua trường đã tốt):
      - "name": string (ngắn gọn <= 20 ký tự để đẹp trên lưới 2 dòng)
      - "icon": string (1 emoji ẩm thực phù hợp nhất)
      - "description": string (mô tả ngắn thu hút 1 câu)
      - "tagRule": string[] (CHỈ dùng khi type="tag" để gom món tốt hơn từ danh sách tag có sẵn)
      - "showOnHome": boolean (ẩn nếu 0 món, bật nếu danh mục chính giàu món)
      - "showAsRestaurantSection": boolean (bật cho bộ sưu tập nhiều món >= 4, tắt nếu < 3 món)`;
  } else {
    payloadRecords = batchRecords.map(s => {
      const sItems = DB.getItemsByStore(s.id);
      const avgP = sItems.length ? Math.round(sItems.reduce((a, b) => a + (Number(b.price) || 0), 0) / sItems.length) : 0;
      return {
        id: s.id,
        name: s.name,
        categoryId: s.categoryId,
        category: s.category,
        address: s.address,
        phone: s.phone,
        distance: s.distance,
        deliveryTime: s.deliveryTime,
        shippingFeeNum: s.shippingFeeNum,
        priceLevel: s.priceLevel,
        badge: s.badge,
        shortReview: s.shortReview,
        vouchers: s.vouchers || [],
        menuItemCount: sItems.length,
        avgItemPrice: avgP,
        sampleDishes: sItems.slice(0, 5).map(i => `${i.name} (${i.price}đ)`)
      };
    });
    schemaGuide = `"proposed" chỉ điền các trường THỰC SỰ CẦN SỬA (bỏ qua trường đã tốt):
      - "name": string (nếu cần chuẩn hóa)
      - "categoryId": string (chỉ chọn id trong Danh mục thủ công khớp thực đơn nhất)
      - "address": string (địa chỉ cụ thể quanh Học viện PTIT, Hà Đông)
      - "deliveryTime": string (VD "12 - 18 phút", khớp với distance km)
      - "shippingFeeNum": number (0, 10000 hoặc 15000)
      - "priceLevel": "$" | "$$" | "$$$" (khớp avgItemPrice: <=45k "$", 46-80k "$$", >80k "$$$")
      - "badge": string (ngắn gọn <= 20 ký tự)
      - "shortReview": string (giới thiệu 1-2 câu nêu bật món đặc trưng của quán)
      - "vouchers": string[] (1-3 nhãn ưu đãi ngắn gọn, VD ["Freeship 0đ", "Ưu đãi SV PTIT"])`;
  }

  const systemPrompt = `Bạn là Chuyên gia Kiểm toán Cơ sở dữ liệu Thực đơn & Vận hành của ứng dụng giao đồ ăn sinh viên PTIT (ptitngon - Hà Đông, Hà Nội).
Nhiệm vụ: Đánh giá khách quan danh sách ${DBM_AUDIT_ENTITY_META[entityType].plural} người dùng đã chọn, chỉ rõ CẦN ĐIỀU CHỈNH ĐIỀU GÌ (issues) và đề xuất giá trị chỉnh sửa cụ thể (proposed).
CHỈ TRẢ VỀ DUY NHẤT MỘT KHỐI JSON HỢP LỆ — tuyệt đối không giải thích ngoài JSON.

THAM CHIẾU HỆ THỐNG:
- Danh mục thủ công có sẵn (id:"tên"): ${manualCatsStr}
- Cửa hàng có sẵn (id:"tên"): ${storesStr}
- Tag phổ biến đang có: ${topTagsStr}
- Mã voucher đang chạy: ${vouchersStr}
- Thống kê Trang chủ hiện tại: ${ctx.homeGridCount} danh mục trên lưới 2 dòng, ${ctx.homeResSectionCount} danh mục dạng dãy quán (restaurants-section).

QUY TẮC ĐẦU RA:
1. Đánh giá đúng TỪNG phần tử theo "id" đã gửi.
2. "score": thang 0-100 (90-100: rất tốt, 72-89: nên tinh chỉnh, <72: cần điều chỉnh).
3. "issues": mảng các nhận xét tiếng Việt cụ thể, dễ hiểu chỉ ra điểm bất hợp lý / thiếu sót cần chỉnh sửa. Nếu mục nào đã hoàn hảo thì để [].
4. "strengths": 1-2 điểm mạnh ngắn gọn.
5. ${schemaGuide}

ĐỊNH DẠNG JSON BẮT BUỘC:
{
  "overallSummary": "Nhận xét tổng quan 1-2 câu về nhóm dữ liệu được chọn",
  "evaluations": [
    {
      "id": "...",
      "score": 78,
      "summary": "Tóm tắt ngắn 1 câu",
      "issues": ["..."],
      "strengths": ["..."],
      "proposed": {}
    }
  ]
}`;

  const userPrompt = `${focusNote ? `Trọng tâm người dùng yêu cầu: "${focusNote}"\n\n` : ''}Hãy đánh giá và đề xuất điều chỉnh cho ${payloadRecords.length} ${DBM_AUDIT_ENTITY_META[entityType].plural} sau:\n${JSON.stringify(payloadRecords, null, 2)}`;

  return { systemPrompt, userPrompt };
}

function dbmAuditMergeLLMWithCard(baseCard, llmEval, rawRecord, entityType, ctx) {
  if (!llmEval || typeof llmEval !== 'object') return baseCard;

  const changes = [];
  const seenFields = new Set();
  const prop = (llmEval.proposed && typeof llmEval.proposed === 'object') ? llmEval.proposed : {};

  const addDiff = (field, label, beforeText, afterText, value, include = true) => {
    if (seenFields.has(field)) return;
    if (String(beforeText).trim() === String(afterText).trim()) return;
    seenFields.add(field);
    changes.push({ field, label, beforeText, afterText, value, include });
  };

  if (entityType === 'items') {
    if (prop.name && String(prop.name).trim() && String(prop.name).trim() !== rawRecord.name) {
      const nm = String(prop.name).trim().slice(0, 90);
      addDiff('name', 'Tên mặt hàng', rawRecord.name, nm, nm, true);
    }
    if (prop.price !== undefined) {
      const p = Math.round((Number(prop.price) || 0) / 1000) * 1000;
      if (p >= 5000 && p <= 2000000 && p !== Number(rawRecord.price)) {
        addDiff('price', 'Giá bán', formatVND(rawRecord.price), formatVND(p), p, true);
      }
    }
    if (prop.categoryId) {
      const c = ctx.manualCategories.find(x => x.id === prop.categoryId || dbmNormText(x.name) === dbmNormText(prop.categoryId));
      if (c && c.id !== rawRecord.categoryId) {
        addDiff('categoryId', 'Danh mục mặt hàng', rawRecord.category || '—', `${c.icon} ${c.name}`, c.id, true);
      }
    }
    if (prop.restaurantId !== undefined) {
      const st = DB.getStoreById(prop.restaurantId);
      if (st && Number(st.id) !== Number(rawRecord.restaurantId)) {
        addDiff('restaurantId', 'Cửa hàng phục vụ', rawRecord.restaurantName || '—', st.name, st.id, true);
      }
    }
    if (prop.description && String(prop.description).trim().length >= 20 && String(prop.description).trim() !== String(rawRecord.description || '').trim()) {
      const d = String(prop.description).trim().slice(0, 400);
      addDiff('description', 'Mô tả món ăn', rawRecord.description || '(Trống)', d, d, true);
    }
    if (Array.isArray(prop.tags) && prop.tags.length > 0) {
      const cleanTags = dbmParseTags(prop.tags);
      const curStr = (rawRecord.tags || []).map(t => `#${t}`).join(', ');
      const nextStr = cleanTags.map(t => `#${t}`).join(', ');
      if (cleanTags.length && curStr !== nextStr) {
        addDiff('tags', 'Bộ Tag tìm kiếm', curStr || '(Chưa có)', nextStr, cleanTags, true);
      }
    }
    if (prop.nutrition && typeof prop.nutrition === 'object') {
      const cleanN = dbmCleanNutrition(prop.nutrition);
      if (cleanN && Number(cleanN.calories) > 0) {
        addDiff('nutrition', 'Chỉ số Dinh dưỡng', dbmAuditFormatNutritionSummary(rawRecord.nutrition), dbmAuditFormatNutritionSummary(cleanN), cleanN, true);
      }
    }
    if (prop.healthyScore !== undefined) {
      const hs = dbmCleanHealthyScore(prop.healthyScore);
      const curHs = dbmGetItemHealthy(rawRecord).score;
      if (hs !== null && Math.abs(hs - curHs) >= 0.2) {
        addDiff('healthyScore', 'Điểm Healthy', `${curHs}/10`, `${hs}/10`, hs, true);
      }
    }
    if (prop.healthyLevel) {
      const hl = dbmCleanHealthyLevel(prop.healthyLevel);
      if (hl && hl !== String(rawRecord.healthyLevel || '').trim()) {
        addDiff('healthyLevel', 'Nhận xét Healthy', rawRecord.healthyLevel || dbmGetItemHealthy(rawRecord).level, hl, hl, true);
      }
    }
    if (prop.autoFetchImage && dbmIsPlaceholderImage(rawRecord)) {
      const q = String(prop.autoFetchImage).trim();
      addDiff('autoFetchImage', 'Hình ảnh mặt hàng', 'Ảnh tạm (Placeholder)', `Tự lấy ảnh thật: "${q}"`, q, true);
    }
  } else if (entityType === 'categories') {
    if (prop.name && String(prop.name).trim() && String(prop.name).trim() !== rawRecord.name) {
      const nm = String(prop.name).trim().slice(0, 40);
      if (!DB.findCategoryByName(nm, rawRecord.id)) {
        addDiff('name', 'Tên danh mục', rawRecord.name, nm, nm, true);
      }
    }
    if (prop.icon && String(prop.icon).trim() && String(prop.icon).trim() !== rawRecord.icon) {
      const ic = String(prop.icon).trim().slice(0, 4);
      addDiff('icon', 'Biểu tượng Emoji', rawRecord.icon || '(Trống)', ic, ic, true);
    }
    if (prop.description && String(prop.description).trim() && String(prop.description).trim() !== String(rawRecord.description || '').trim()) {
      const desc = String(prop.description).trim().slice(0, 160);
      addDiff('description', 'Mô tả ngắn', rawRecord.description || '(Trống)', desc, desc, true);
    }
    if (rawRecord.type === 'tag' && Array.isArray(prop.tagRule) && prop.tagRule.length > 0) {
      const tr = dbmParseTags(prop.tagRule);
      if (tr.length > 0 && tr.join(',') !== (rawRecord.tagRule || []).join(',')) {
        addDiff('tagRule', 'Bộ Tag gom món', (rawRecord.tagRule || []).map(t => `#${t}`).join(', ') || '(Trống)', tr.map(t => `#${t}`).join(', '), tr, true);
      }
    }
    if (typeof prop.showOnHome === 'boolean' && prop.showOnHome !== (rawRecord.showOnHome !== false)) {
      addDiff('showOnHome', 'Hiện lưới 2 dòng Trang chủ', rawRecord.showOnHome !== false ? 'Đang bật' : 'Đang tắt', prop.showOnHome ? 'Bật hiển thị' : 'Tạm ẩn', prop.showOnHome, true);
    }
    if (typeof prop.showAsRestaurantSection === 'boolean' && prop.showAsRestaurantSection !== Boolean(rawRecord.showAsRestaurantSection)) {
      addDiff('showAsRestaurantSection', 'Hiện dãy quán Trang chủ', rawRecord.showAsRestaurantSection ? 'Đang bật' : 'Đang tắt', prop.showAsRestaurantSection ? 'Bật dãy ngang' : 'Tắt dãy ngang', prop.showAsRestaurantSection, true);
    }
  } else if (entityType === 'stores') {
    if (prop.name && String(prop.name).trim() && String(prop.name).trim() !== rawRecord.name && Number(rawRecord.id) !== 1000) {
      const nm = String(prop.name).trim().slice(0, 80);
      const dup = DB.findStoreByName(nm);
      if (!dup || Number(dup.id) === Number(rawRecord.id)) {
        addDiff('name', 'Tên nhà hàng', rawRecord.name, nm, nm, true);
      }
    }
    if (prop.categoryId) {
      const c = ctx.manualCategories.find(x => x.id === prop.categoryId || dbmNormText(x.name) === dbmNormText(prop.categoryId));
      if (c && c.id !== rawRecord.categoryId) {
        addDiff('categoryId', 'Danh mục chính', rawRecord.category || '—', `${c.icon} ${c.name}`, c.id, true);
      }
    }
    if (prop.address && String(prop.address).trim().length >= 12 && String(prop.address).trim() !== String(rawRecord.address || '').trim()) {
      const ad = String(prop.address).trim().slice(0, 140);
      addDiff('address', 'Địa chỉ chi tiết', rawRecord.address || '(Trống)', ad, ad, true);
    }
    if (prop.deliveryTime && String(prop.deliveryTime).trim() !== String(rawRecord.deliveryTime || '').trim()) {
      const dt = String(prop.deliveryTime).trim().slice(0, 30);
      addDiff('deliveryTime', 'Thời gian giao', rawRecord.deliveryTime || '(Trống)', dt, dt, true);
    }
    if (prop.shippingFeeNum !== undefined) {
      const sf = Math.max(0, Math.round((Number(prop.shippingFeeNum) || 0) / 1000) * 1000);
      if (sf <= 30000 && sf !== Number(rawRecord.shippingFeeNum || 0)) {
        addDiff('shippingFeeNum', 'Phí giao hàng', formatVND(rawRecord.shippingFeeNum || 0), sf === 0 ? '0đ (Freeship)' : formatVND(sf), sf, true);
      }
    }
    if (['$', '$$', '$$$'].includes(prop.priceLevel) && prop.priceLevel !== rawRecord.priceLevel) {
      addDiff('priceLevel', 'Phân khúc giá', rawRecord.priceLevel || '$', prop.priceLevel, prop.priceLevel, true);
    }
    if (prop.badge && String(prop.badge).trim() !== String(rawRecord.badge || '').trim()) {
      const bg = String(prop.badge).trim().slice(0, 24);
      addDiff('badge', 'Huy hiệu quán', rawRecord.badge || '(Trống)', bg, bg, true);
    }
    if (prop.shortReview && String(prop.shortReview).trim().length >= 18 && String(prop.shortReview).trim() !== String(rawRecord.shortReview || '').trim()) {
      const sr = String(prop.shortReview).trim().slice(0, 220);
      addDiff('shortReview', 'Giới thiệu ngắn', rawRecord.shortReview || '(Trống)', sr, sr, true);
    }
    if (Array.isArray(prop.vouchers) && prop.vouchers.length > 0) {
      const vc = prop.vouchers.map(v => String(v).trim()).filter(Boolean).slice(0, 5);
      if (vc.length && vc.join(', ') !== (rawRecord.vouchers || []).join(', ')) {
        addDiff('vouchers', 'Nhãn ưu đãi hiển thị', (rawRecord.vouchers || []).join(', ') || '(Chưa có)', vc.join(', '), vc, true);
      }
    }
  }

  // Bổ sung những trường hợp thiết thực do bộ kiểm tra nội bộ phát hiện (VD thiếu ảnh thật) nếu LLM bỏ sót
  baseCard.changes.forEach(c => {
    if (!seenFields.has(c.field) && (c.field === 'autoFetchImage' || changes.length === 0)) {
      seenFields.add(c.field);
      changes.push(c);
    }
  });

  const llmIssues = (Array.isArray(llmEval.issues) ? llmEval.issues : []).map(s => String(s).trim()).filter(Boolean);
  const llmStrengths = (Array.isArray(llmEval.strengths) ? llmEval.strengths : []).map(s => String(s).trim()).filter(Boolean);
  const mergedIssues = llmIssues.length ? llmIssues : baseCard.issues;
  const mergedStrengths = llmStrengths.length ? llmStrengths : baseCard.strengths;
  const rawScore = Number(llmEval.score);
  const finalScore = Number.isFinite(rawScore) ? Math.max(30, Math.min(100, Math.round(rawScore))) : baseCard.score;
  const sev = dbmAuditSeverityInfo(finalScore, changes.length);

  return {
    ...baseCard,
    score: finalScore,
    severity: sev.key,
    summary: String(llmEval.summary || '').trim() || baseCard.summary,
    issues: mergedIssues,
    strengths: mergedStrengths,
    changes,
    includeCard: changes.length > 0
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 4. ĐIỀU PHỐI MỞ MODAL & CHẠY ĐÁNH GIÁ
// ─────────────────────────────────────────────────────────────────────────

function dbmResolveAuditRecords(entityType, targetIds) {
  if (entityType === 'items') {
    const map = new Map(DB.getItems().map(it => [String(it.id), it]));
    return targetIds.map(id => map.get(String(id))).filter(Boolean);
  }
  if (entityType === 'categories') {
    const map = new Map(DB.getCategories().map(c => [String(c.id), c]));
    return targetIds.map(id => map.get(String(id))).filter(Boolean);
  }
  const map = new Map(DB.getStores().map(s => [String(s.id), s]));
  return targetIds.map(id => map.get(String(id))).filter(Boolean);
}

function dbmOpenAiAuditModal(entityType = 'items', explicitIds = null) {
  const meta = DBM_AUDIT_ENTITY_META[entityType] || DBM_AUDIT_ENTITY_META.items;
  let ids = [];

  if (Array.isArray(explicitIds) && explicitIds.length > 0) {
    ids = explicitIds.map(x => (entityType === 'stores' ? Number(x) : String(x)));
  } else if (entityType === 'items') {
    ids = [...dbmSelectedIds];
    if (ids.length === 0 && typeof getFilteredCatalogItems === 'function') {
      ids = getFilteredCatalogItems().slice(0, 12).map(it => it.id);
    }
  } else if (entityType === 'categories') {
    ids = typeof dbmSelectedCategoryIds !== 'undefined' ? [...dbmSelectedCategoryIds] : [];
    if (ids.length === 0) ids = DB.getCategories().slice(0, 12).map(c => c.id);
  } else if (entityType === 'stores') {
    ids = typeof dbmSelectedStoreIds !== 'undefined' ? [...dbmSelectedStoreIds] : [];
    if (ids.length === 0) ids = DB.getStores().slice(0, 12).map(s => s.id);
  }

  const records = dbmResolveAuditRecords(entityType, ids);
  if (records.length === 0) {
    showToast('alertRegular', `Hãy chọn ít nhất 1 ${meta.singular} để AI đánh giá!`);
    return;
  }

  dbmAuditState = {
    entityType,
    targetIds: records.map(r => r.id),
    focusNote: '',
    engineMode: 'auto',
    filterMode: 'all',
    running: false,
    progressText: '',
    engineUsed: '',
    engineLabel: '',
    overallSummary: '',
    errorNote: '',
    results: []
  };

  // Nếu dùng Chuyên gia AI Nội bộ (không gọi LLM bất đồng bộ), tính toán đồng bộ ngay trước khi mở modal để hiển thị tức thì 0ms không nháy khung
  const useLlmImmediately = dbmAiIsConfigured() && records.length <= 16;
  if (!useLlmImmediately) {
    dbmRunAiAudit('local');
    dbmRenderAiAuditModalShell();
  } else {
    dbmRenderAiAuditModalShell();
    dbmRunAiAudit('auto');
  }
}

function dbmRenderAiAuditModalShell() {
  const st = dbmAuditState;
  const meta = DBM_AUDIT_ENTITY_META[st.entityType] || DBM_AUDIT_ENTITY_META.items;
  const configured = typeof dbmAiIsConfigured === 'function' && dbmAiIsConfigured();
  const providerBadge = configured && typeof AI_PROVIDER_PRESETS !== 'undefined'
    ? `${(AI_PROVIDER_PRESETS[aiConfig.provider] || {}).badge || aiConfig.provider} • ${aiConfig.model}`
    : '';

  dbmOpenSheet(`
    ${dbmSheetHeader('🤖', `${meta.title} (${st.targetIds.length} ${meta.plural})`)}
    <div class="delivery-modal-body dbm-editor-body">
      <div class="dbm-audit-control-box">
        <div class="dbm-audit-engine-row">
          <div class="dbm-audit-engine-badge ${configured ? 'ok' : 'local'}">
            ${configured
      ? ` API AI đã sẵn sàng: <strong>${escapeHtml(providerBadge)}</strong>`
      : `🧠 Đang dùng <strong>Chuyên gia AI Nội bộ</strong> (chạy ngay không cần Key • có thể gắn thêm Gemini/OpenRouter API nếu muốn)`}
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <select id="dbm-audit-engine-select" class="db-select-box" style="padding:5px 10px; font-size:12px;" onchange="dbmAuditState.engineMode = this.value">
              <option value="auto" ${st.engineMode === 'auto' ? 'selected' : ''}>⚡ Tự động (${configured ? 'Ưu tiên LLM API' : 'AI Nội bộ'})</option>
              <option value="local" ${st.engineMode === 'local' ? 'selected' : ''}>🧠 Chỉ dùng Chuyên gia AI Nội bộ (Tức thì)</option>
            </select>
            <button type="button" class="db-inline-link-btn" onclick="openAISettingsModal()">⚙️ Cài đặt API</button>
          </div>
        </div>

        <div class="dbm-audit-focus-row">
          <input type="text" id="dbm-audit-focus-input" class="delivery-input-field"
                 placeholder="Nhập yêu cầu cụ thể cho AI (VD: ưu tiên giá sinh viên dưới 40K, kiểm tra kỹ độ healthy, tối ưu tag...)"
                 value="${escapeHtml(st.focusNote)}"
                 oninput="dbmAuditState.focusNote = this.value"
                 onkeydown="if (event.key === 'Enter') { event.preventDefault(); dbmRunAiAudit(); }">
          <button type="button" class="db-primary-btn dbm-audit-run-btn" onclick="dbmRunAiAudit()">
            ✨ Đánh giá lại
          </button>
        </div>

        <div class="dbm-audit-chips-row">
          ${meta.focusChips.map((ch, idx) => `
            <button type="button" class="db-chip" onclick="dbmAuditPickFocusChip(${idx})">${escapeHtml(ch.label)}</button>
          `).join('')}
        </div>
      </div>

      <div id="dbm-audit-results-Mount">${dbmRenderAiAuditResultsHtml()}</div>
    </div>
    <div class="dbm-editor-footer" id="dbm-audit-footer-Mount">
      ${dbmRenderAiAuditFooterHtml()}
    </div>
  `);
}

function dbmAuditPickFocusChip(chipIdx) {
  const meta = DBM_AUDIT_ENTITY_META[dbmAuditState.entityType] || DBM_AUDIT_ENTITY_META.items;
  const chip = meta.focusChips[chipIdx];
  if (!chip) return;
  dbmAuditState.focusNote = chip.prompt;
  const input = document.getElementById('dbm-audit-focus-input');
  if (input) input.value = chip.prompt;
  dbmRunAiAudit();
}

function dbmRefreshAuditDynamicDOM() {
  const resMount = document.getElementById('dbm-audit-results-Mount');
  const footMount = document.getElementById('dbm-audit-footer-Mount');
  if (resMount) resMount.innerHTML = dbmRenderAiAuditResultsHtml();
  if (footMount) footMount.innerHTML = dbmRenderAiAuditFooterHtml();
}

async function dbmRunAiAudit(forceMode = null) {
  if (dbmAuditState.running) return;
  const st = dbmAuditState;
  const records = dbmResolveAuditRecords(st.entityType, st.targetIds);
  if (records.length === 0) return;

  const mode = forceMode || st.engineMode || 'auto';
  const canUseLLM = mode !== 'local' && typeof dbmAiIsConfigured === 'function' && dbmAiIsConfigured();

  st.running = true;
  st.errorNote = '';
  st.progressText = canUseLLM
    ? `AI đang đọc dữ liệu & phân tích chi tiết ${records.length} ${DBM_AUDIT_ENTITY_META[st.entityType].plural}...`
    : `Đang kiểm toán dữ liệu ${records.length} ${DBM_AUDIT_ENTITY_META[st.entityType].plural}...`;
  dbmRefreshAuditDynamicDOM();

  const ctx = dbmAuditBuildContext();
  const localCards = records.map(rec => {
    if (st.entityType === 'items') return dbmAuditAnalyzeItemLocally(rec, ctx, st.focusNote);
    if (st.entityType === 'categories') return dbmAuditAnalyzeCategoryLocally(rec, ctx, st.focusNote);
    return dbmAuditAnalyzeStoreLocally(rec, ctx, st.focusNote);
  });

  if (!canUseLLM) {
    st.results = localCards;
    st.engineUsed = 'local';
    st.engineLabel = 'Chuyên gia AI Nội bộ';
    const warnCount = localCards.filter(c => c.issues.length > 0).length;
    const changeCount = localCards.reduce((s, c) => s + c.changes.length, 0);
    st.overallSummary = warnCount === 0
      ? `Toàn bộ ${localCards.length} ${DBM_AUDIT_ENTITY_META[st.entityType].plural} đã đạt chuẩn tốt, không phát hiện lệch chuẩn dữ liệu.`
      : `Qua rà soát ${localCards.length} ${DBM_AUDIT_ENTITY_META[st.entityType].plural}, phát hiện ${warnCount} mục có điểm cần lưu ý với ${changeCount} đề xuất điều chỉnh cụ thể.`;
    st.running = false;
    dbmRefreshAuditDynamicDOM();
    return;
  }

  // Chạy qua LLM theo từng lô tối đa 8 mục để JSON luôn đầy đủ, không bị cắt
  try {
    const batchSize = 8;
    const evalById = new Map();
    const summaries = [];

    for (let start = 0; start < records.length; start += batchSize) {
      const batch = records.slice(start, start + batchSize);
      if (records.length > batchSize) {
        st.progressText = `Đang phân tích bằng AI LLM (${Math.min(records.length, start + batch.length)}/${records.length} ${DBM_AUDIT_ENTITY_META[st.entityType].plural})...`;
        dbmRefreshAuditDynamicDOM();
      }
      const { systemPrompt, userPrompt } = dbmAuditBuildLLMPrompts(st.entityType, batch, ctx, st.focusNote);
      const rawText = await dbmAiCallLLM(systemPrompt, userPrompt, {
        maxTokens: 6500,
        temperature: 0.35,
        onRetry: (attempt, ms) => {
          st.progressText = `API đang bận — tự thử lại lần ${attempt} sau ${Math.round(ms / 1000)}s...`;
          dbmRefreshAuditDynamicDOM();
        }
      });
      const parsed = dbmAiExtractJson(rawText);
      if (parsed?.overallSummary) summaries.push(String(parsed.overallSummary).trim());
      (Array.isArray(parsed?.evaluations) ? parsed.evaluations : []).forEach(ev => {
        if (ev && ev.id !== undefined) evalById.set(String(ev.id), ev);
      });
    }

    st.results = records.map((rec, idx) =>
      dbmAuditMergeLLMWithCard(localCards[idx], evalById.get(String(rec.id)), rec, st.entityType, ctx)
    );
    st.engineUsed = 'llm';
    st.engineLabel = `${(AI_PROVIDER_PRESETS[aiConfig.provider] || {}).badge || aiConfig.provider} (${aiConfig.model})`;
    st.overallSummary = summaries.join(' ') || `AI đã hoàn tất đánh giá chuyên sâu cho ${records.length} ${DBM_AUDIT_ENTITY_META[st.entityType].plural}.`;
  } catch (err) {
    st.results = localCards;
    st.engineUsed = 'local';
    st.engineLabel = 'Chuyên gia AI Nội bộ (Dự phòng tự động)';
    st.errorNote = `Không gọi được API ngoài (${err.message || 'lỗi kết nối'}) — hệ thống đã tự động chuyển sang Chuyên gia AI Nội bộ để bạn không bị gián đoạn.`;
    const warnCount = localCards.filter(c => c.issues.length > 0).length;
    st.overallSummary = `Rà soát hoàn tất: ${warnCount}/${localCards.length} mục có gợi ý điều chỉnh.`;
  } finally {
    st.running = false;
    dbmRefreshAuditDynamicDOM();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 5. GIAO DIỆN HIỂN THỊ KẾT QUẢ & BẢNG SO SÁNH TRƯỚC ➡️ SAU
// ─────────────────────────────────────────────────────────────────────────

function dbmGetFilteredAuditCards() {
  const list = dbmAuditState.results || [];
  if (dbmAuditState.filterMode === 'needs_fix') return list.map((c, idx) => ({ c, idx })).filter(x => x.c.issues.length > 0);
  if (dbmAuditState.filterMode === 'has_changes') return list.map((c, idx) => ({ c, idx })).filter(x => x.c.changes.length > 0);
  return list.map((c, idx) => ({ c, idx }));
}

function dbmRenderAiAuditResultsHtml() {
  const st = dbmAuditState;
  const meta = DBM_AUDIT_ENTITY_META[st.entityType] || DBM_AUDIT_ENTITY_META.items;

  if (st.running) {
    return `
      <div class="dbm-audit-loading">
        <span class="dbm-spinner"></span>
        <div class="dbm-audit-loading-title">${escapeHtml(st.progressText || 'AI đang phân tích dữ liệu...')}</div>
        <div class="dbm-audit-loading-sub">Đang đối chiếu mức giá, mô tả, chỉ số dinh dưỡng, tag và cấu trúc hiển thị trên toàn hệ thống</div>
      </div>`;
  }

  if (!st.results.length) {
    return `<div class="dbm-empty-note">Bấm "✨ Đánh giá lại" để AI bắt đầu phân tích.</div>`;
  }

  const warnCards = st.results.filter(r => r.severity === 'warn').length;
  const suggestCards = st.results.filter(r => r.severity === 'suggest').length;
  const okCards = st.results.filter(r => r.severity === 'ok').length;
  const totalChanges = st.results.reduce((s, r) => s + r.changes.length, 0);
  const visible = dbmGetFilteredAuditCards();

  return `
    ${st.errorNote ? `<div class="dbm-hint warn" style="margin-bottom:10px;">⚠️ ${escapeHtml(st.errorNote)}</div>` : ''}
    <div class="dbm-audit-summary-card">
      <div class="dbm-audit-summary-top">
        <span class="dbm-audit-source-tag">${st.engineUsed === 'llm' ? '🤖 LLM:' : '🧠'} ${escapeHtml(st.engineLabel)}</span>
        <div class="dbm-audit-stats-pills">
          <span class="pill warn">⚠️ Cần chỉnh: ${warnCards}</span>
          <span class="pill suggest">💡 Tinh chỉnh: ${suggestCards}</span>
          <span class="pill ok">✅ Đã tốt: ${okCards}</span>
          <span class="pill changes">🔧 ${totalChanges} đề xuất</span>
        </div>
      </div>
      <div class="dbm-audit-summary-text">${escapeHtml(st.overallSummary)}</div>
      <div class="dbm-audit-filter-tabs">
        <button type="button" class="db-chip ${st.filterMode === 'all' ? 'active' : ''}" onclick="dbmAuditState.filterMode='all'; dbmRefreshAuditDynamicDOM();">Tất cả (${st.results.length})</button>
        <button type="button" class="db-chip ${st.filterMode === 'needs_fix' ? 'active' : ''}" onclick="dbmAuditState.filterMode='needs_fix'; dbmRefreshAuditDynamicDOM();">Có điểm cần lưu ý (${st.results.filter(r => r.issues.length > 0).length})</button>
        <button type="button" class="db-chip ${st.filterMode === 'has_changes' ? 'active' : ''}" onclick="dbmAuditState.filterMode='has_changes'; dbmRefreshAuditDynamicDOM();">Có trường đề xuất sửa (${st.results.filter(r => r.changes.length > 0).length})</button>
      </div>
    </div>

    ${visible.length === 0 ? `<div class="dbm-empty-note" style="padding:24px;">Không có ${meta.singular} nào trong bộ lọc này.</div>` : ''}

    <div class="dbm-audit-cards-list">
      ${visible.map(({ c, idx }) => dbmRenderSingleAuditCardHtml(c, idx)).join('')}
    </div>`;
}

function dbmRenderSingleAuditCardHtml(card, cardIdx) {
  const sev = dbmAuditSeverityInfo(card.score, card.changes.length);
  const selectedChangesCount = card.changes.filter(ch => ch.include).length;
  const openEditorCall = dbmAuditOpenManualEditorJs(dbmAuditState.entityType, card.id);

  return `
    <div class="dbm-audit-card ${sev.key} ${card.applied ? 'applied' : ''}">
      <div class="dbm-audit-card-head">
        <label class="dbm-audit-card-check" title="Chọn áp dụng cho mục này">
          <input type="checkbox" ${card.includeCard && !card.applied ? 'checked' : ''} ${card.changes.length === 0 || card.applied ? 'disabled' : ''}
                 onchange="dbmAuditToggleCard(${cardIdx}, this.checked)">
        </label>
        <div class="dbm-audit-card-thumb">
          ${card.thumb ? dbmThumb(card.thumb, card.title) : `<span>${escapeHtml(card.icon || '📦')}</span>`}
        </div>
        <div class="dbm-audit-card-meta">
          <div class="dbm-audit-card-title-row">
            <span class="dbm-audit-card-title">${escapeHtml(card.title)}</span>
            <span class="dbm-audit-score-pill ${sev.key}">${sev.icon} ${card.score}/100 • ${sev.label}</span>
            ${card.applied ? `<span class="dbm-audit-applied-pill">✓ Đã cập nhật</span>` : ''}
          </div>
          <div class="dbm-audit-card-sub">${escapeHtml(card.subtitle)}</div>
          <div class="dbm-audit-card-sum">${escapeHtml(card.summary)}</div>
        </div>
      </div>

      ${card.issues.length > 0 ? `
        <div class="dbm-audit-issues-box">
          <div class="dbm-audit-box-label">🔍 Điểm cần điều chỉnh:</div>
          <ul>
            ${card.issues.map(iss => `<li>${escapeHtml(iss)}</li>`).join('')}
          </ul>
        </div>` : ''}

      ${card.strengths.length > 0 ? `
        <div class="dbm-audit-strengths-row">
          ${card.strengths.map(s => `<span class="dbm-audit-strength-chip">✓ ${escapeHtml(s)}</span>`).join('')}
        </div>` : ''}

      ${card.changes.length > 0 ? `
        <div class="dbm-audit-diffs-box">
          <div class="dbm-audit-box-label">🛠️ Đề xuất chỉnh sửa tự động (tick chọn các trường muốn áp dụng):</div>
          <div class="dbm-audit-diffs-list">
            ${card.changes.map((ch, chIdx) => `
              <label class="dbm-audit-diff-row ${ch.include ? 'checked' : ''}">
                <input type="checkbox" ${ch.include ? 'checked' : ''} ${card.applied ? 'disabled' : ''}
                       onchange="dbmAuditToggleChange(${cardIdx}, ${chIdx}, this.checked)">
                <span class="dbm-audit-diff-field">${escapeHtml(ch.label)}</span>
                <div class="dbm-audit-diff-vals">
                  <span class="dbm-audit-before" title="Giá trị hiện tại">${escapeHtml(ch.beforeText)}</span>
                  <span class="dbm-audit-arrow">➜</span>
                  <span class="dbm-audit-after" title="Giá trị AI đề xuất">${escapeHtml(ch.afterText)}</span>
                </div>
              </label>
            `).join('')}
          </div>
        </div>` : ''}

      <div class="dbm-audit-card-actions">
        ${card.changes.length > 0 && !card.applied ? `
          <button type="button" class="db-act-btn order" ${selectedChangesCount === 0 ? 'disabled' : ''} onclick="dbmAuditApplySingle(${cardIdx})">
            ✅ Áp dụng mục này (${selectedChangesCount})
          </button>` : ''}
        <button type="button" class="db-act-btn edit" onclick="${openEditorCall}">
          ✏️ Mở trình sửa chi tiết
        </button>
      </div>
    </div>`;
}

function dbmAuditOpenManualEditorJs(entityType, rawId) {
  if (entityType === 'items') return `openItemEditorModal('${escapeHtml(String(rawId))}')`;
  if (entityType === 'categories') return `openCategoryEditorModal('${escapeHtml(String(rawId))}')`;
  return `openStoreEditorModal(${Number(rawId)})`;
}

function dbmRenderAiAuditFooterHtml() {
  const st = dbmAuditState;
  const meta = DBM_AUDIT_ENTITY_META[st.entityType] || DBM_AUDIT_ENTITY_META.items;
  const actionableCards = st.results.filter(c => !c.applied && c.includeCard && c.changes.some(ch => ch.include));
  const totalSelectedFields = actionableCards.reduce((s, c) => s + c.changes.filter(ch => ch.include).length, 0);
  const anyUnappliedWithChanges = st.results.some(c => !c.applied && c.changes.length > 0);
  const allChecked = anyUnappliedWithChanges && st.results.filter(c => !c.applied && c.changes.length > 0).every(c => c.includeCard && c.changes.some(ch => ch.include));

  return `
    ${anyUnappliedWithChanges ? `
      <label class="db-checkbox-row compact" style="margin-right:auto;">
        <input type="checkbox" ${allChecked ? 'checked' : ''} onchange="dbmAuditToggleAll(this.checked)">
        <span>Chọn tất cả đề xuất (${actionableCards.length} ${meta.plural} • ${totalSelectedFields} trường)</span>
      </label>` : `<span style="margin-right:auto; font-size:12.5px; color:var(--gray-500);">Đã kiểm tra ${st.results.length} ${meta.plural}</span>`}
    <button type="button" class="db-secondary-btn" onclick="closeModal()">Đóng</button>
    <button type="button" class="btn-primary-large" style="flex:0 1 auto; min-width:220px;"
            ${st.running || actionableCards.length === 0 ? 'disabled' : ''}
            onclick="dbmAuditApplySelected()">
      ${FluentIcons.saveFilled} Áp dụng ${actionableCards.length} ${meta.plural} đã chọn
    </button>`;
}

// ─────────────────────────────────────────────────────────────────────────
// 6. TƯƠNG TÁC TICK CHỌN & ÁP DỤNG ĐỀ XUẤT VÀO DATABASE (LOSSLESS MERGE)
// ─────────────────────────────────────────────────────────────────────────

function dbmAuditToggleCard(cardIdx, checked) {
  const card = dbmAuditState.results[cardIdx];
  if (!card || card.applied) return;
  card.includeCard = Boolean(checked);
  if (checked && !card.changes.some(ch => ch.include)) {
    card.changes.forEach(ch => { ch.include = true; });
  }
  dbmRefreshAuditDynamicDOM();
}

function dbmAuditToggleChange(cardIdx, chIdx, checked) {
  const card = dbmAuditState.results[cardIdx];
  if (!card || !card.changes[chIdx] || card.applied) return;
  card.changes[chIdx].include = Boolean(checked);
  card.includeCard = card.changes.some(ch => ch.include);
  dbmRefreshAuditDynamicDOM();
}

function dbmAuditToggleAll(checked) {
  dbmAuditState.results.forEach(card => {
    if (card.applied || card.changes.length === 0) return;
    card.includeCard = Boolean(checked);
    card.changes.forEach(ch => { ch.include = Boolean(checked); });
  });
  dbmRefreshAuditDynamicDOM();
}

async function dbmAuditCommitCardChanges(card, entityType) {
  const activeChanges = (card.changes || []).filter(ch => ch.include);
  if (!activeChanges.length) return false;

  const patch = {};
  activeChanges.forEach(ch => { patch[ch.field] = ch.value; });

  if (entityType === 'items') {
    const existing = DB.getItemById(card.id);
    if (!existing) return false;

    let fetchedImgSrc = null;
    if (patch.autoFetchImage) {
      try {
        const imgRes = await dbmSearchGoogleImages(patch.autoFetchImage, {
          limit: 4,
          autoDownload: true,
          preferredRank: 1,
          name: patch.name || existing.name,
          category: existing.category || ''
        });
        fetchedImgSrc = imgRes.localPath || imgRes.originalUrl || null;
        if (fetchedImgSrc) DB.addLibraryImage({ name: patch.name || existing.name, src: fetchedImgSrc });
      } catch (_) { }
      delete patch.autoFetchImage;
    }

    const mergedPayload = {
      ...existing,
      ...patch,
      image: fetchedImgSrc || patch.image || existing.image,
      imageIsPlaceholder: fetchedImgSrc ? false : Boolean(existing.imageIsPlaceholder),
      nutrition: patch.nutrition ? { ...(existing.nutrition || {}), ...patch.nutrition } : existing.nutrition,
      ingredients: patch.ingredients || existing.ingredients,
      sizes: existing.sizes,
      toppings: existing.toppings,
      noteSuggestions: existing.noteSuggestions,
      vouchers: existing.vouchers
    };

    const res = DB.saveItem(mergedPayload, existing.id);
    if (res.ok && fetchedImgSrc) card.thumb = fetchedImgSrc;
    return Boolean(res.ok);
  }

  if (entityType === 'categories') {
    const existing = DB.getCategoryById(card.id);
    if (!existing) return false;
    const mergedCat = {
      ...existing,
      ...patch,
      type: patch.type || existing.type || 'manual',
      tagRule: patch.tagRule !== undefined ? patch.tagRule : existing.tagRule,
      showOnHome: patch.showOnHome !== undefined ? patch.showOnHome : (existing.showOnHome !== false),
      showAsRestaurantSection: patch.showAsRestaurantSection !== undefined ? patch.showAsRestaurantSection : Boolean(existing.showAsRestaurantSection),
      showInVisualSuggestions: existing.showInVisualSuggestions !== false
    };
    const res = DB.saveCategory(mergedCat, existing.id);
    return Boolean(res.ok);
  }

  if (entityType === 'stores') {
    const existing = DB.getStoreById(card.id);
    if (!existing) return false;
    const mergedStore = {
      ...existing,
      ...patch,
      vouchers: patch.vouchers !== undefined ? patch.vouchers : existing.vouchers
    };
    const res = DB.saveStore(mergedStore, existing.id);
    return Boolean(res.ok);
  }

  return false;
}

async function dbmAuditApplySingle(cardIdx) {
  const card = dbmAuditState.results[cardIdx];
  if (!card || card.applied) return;
  const ok = await dbmAuditCommitCardChanges(card, dbmAuditState.entityType);
  if (!ok) {
    showToast('alertRegular', 'Không thể áp dụng thay đổi cho mục này');
    return;
  }
  card.applied = true;
  if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
  dbmRefreshAuditDynamicDOM();
  dbmRefreshManager();
  showToast('checkmarkFilled', `Đã áp dụng đề xuất chỉnh sửa cho "${card.title}"!`);
}

async function dbmAuditApplySelected() {
  const st = dbmAuditState;
  const meta = DBM_AUDIT_ENTITY_META[st.entityType] || DBM_AUDIT_ENTITY_META.items;
  const targets = st.results.filter(c => !c.applied && c.includeCard && c.changes.some(ch => ch.include));
  if (targets.length === 0) {
    showToast('alertRegular', 'Chưa có đề xuất nào được tick chọn');
    return;
  }

  let appliedCount = 0;
  for (let i = 0; i < targets.length; i++) {
    const ok = await dbmAuditCommitCardChanges(targets[i], st.entityType);
    if (ok) {
      targets[i].applied = true;
      appliedCount++;
    }
  }

  if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
  dbmRefreshAuditDynamicDOM();
  dbmRefreshManager();
  showToast('checkmarkFilled', `Đã cập nhật thành công ${appliedCount}/${targets.length} ${meta.plural} theo đề xuất của AI!`);
}
