/* ==========================================================================
   ptitngon - Database Manager Editors (js/db-manager-editors.js)
   Trình soạn thảo đầy đủ: Mặt hàng • Cửa hàng • Danh mục (thủ công / theo tag) • Mã giảm giá
   cùng các tab danh sách tương ứng. Ghi đè các hàm cùng tên trong catalog-profile.js.
   ========================================================================== */

let dbmEditingItemId = null;
let dbmEditorImageIsPlaceholder = false;
let dbmEditorIngredients = [];
let dbmStoreImage = '';
let dbmStoreReturnDraft = null;
let dbmCatType = 'manual';

// ─────────────────────────────────────────────────────────────────────────
// MODAL: MẶT HÀNG
// ─────────────────────────────────────────────────────────────────────────

function dbmBlankItemForm() {
  return {
    name: '', price: 35000, categoryId: '', restaurantId: 1000, location: '', image: '', imageIsPlaceholder: false,
    description: '', tags: [], rating: '', reviewCount: '', soldCount: '', vouchers: [],
    healthyScore: '', healthyLevel: '',
    nutrition: {}, ingredients: [],
    sizes: [{ name: 'Phần Tiêu Chuẩn', extraPrice: 0 }, { name: 'Phần Lớn Đặc Biệt', extraPrice: 15000 }],
    toppings: [], notes: 'Giao nóng, Đóng gói kỹ, Ít cay', inStock: true
  };
}

function dbmItemToForm(it) {
  return {
    name: it.name, price: it.price, categoryId: it.categoryId, restaurantId: it.restaurantId,
    location: it.location || '',
    image: it.image, imageIsPlaceholder: dbmIsPlaceholderImage(it), description: it.description || '',
    tags: [...(it.tags || [])], rating: it.rating ?? '', reviewCount: it.reviewCount ?? '', soldCount: it.soldCount ?? '',
    vouchers: [...(it.vouchers || [])],
    healthyScore: it.healthyScore ?? '', healthyLevel: it.healthyLevel || '',
    nutrition: { ...(it.nutrition || {}) },
    ingredients: JSON.parse(JSON.stringify(it.ingredients || [])),
    sizes: JSON.parse(JSON.stringify(it.sizes || [])), toppings: JSON.parse(JSON.stringify(it.toppings || [])),
    notes: (it.noteSuggestions || []).join(', '), inStock: it.inStock !== false
  };
}

function openItemEditorModal(editItemId = null, preselectedCatId = null, restoredDraft = null) {
  const editing = editItemId ? DB.getItemById(editItemId) : null;
  const manualCats = DB.getManualCategories();
  const stores = DB.getStores();

  const base = { ...dbmBlankItemForm(), ...(restoredDraft || (editing ? dbmItemToForm(editing) : {})) };

  // Mở từ danh mục theo tag -> điền sẵn tag đó
  let selectedCatId = base.categoryId;
  const preCat = preselectedCatId ? DB.getCategoryById(preselectedCatId) : null;
  if (preCat && preCat.type === 'tag') {
    base.tags = dbmParseTags([...(base.tags || []), ...preCat.tagRule]);
  } else if (preCat) {
    selectedCatId = preCat.id;
  }
  if (!selectedCatId || !manualCats.some(c => c.id === selectedCatId)) {
    selectedCatId = manualCats.find(c => c.isCustom)?.id || manualCats[0]?.id || '';
  }
  const selectedCat = DB.getCategoryById(selectedCatId);

  dbmEditingItemId = editItemId;
  tempItemImage = base.image || '';
  dbmEditorImageIsPlaceholder = Boolean(base.imageIsPlaceholder);
  tempItemSizes = (base.sizes && base.sizes.length) ? JSON.parse(JSON.stringify(base.sizes)) : dbmBlankItemForm().sizes;
  tempItemToppings = JSON.parse(JSON.stringify(base.toppings || []));
  dbmEditorIngredients = JSON.parse(JSON.stringify(base.ingredients || []));
  dbmTagState.item = dbmParseTags(base.tags);
  const nutri = base.nutrition || {};
  const previewSrc = tempItemImage || (selectedCat ? selectedCat.image : 'assets/images/hung_chien_gion.webp');
  const aiReady = typeof dbmAiFillItemForm === 'function';

  dbmDropHandlers['itemimg'] = async dropped => {
    const imported = await dbmImportDropped(dropped);
    if (imported.length === 0) { showToast('alertRegular', 'Không đọc được ảnh'); return; }
    imported.forEach(img => DB.addLibraryImage(img));
    dbmSetEditorImage(imported[0].src);
    showToast('checkmarkFilled', 'Đã đặt ảnh cho mặt hàng!');
  };

  const numField = (id, label, val, attrs = '') => `
    <div class="delivery-input-group">
      <label class="delivery-input-label">${label}</label>
      <input type="number" id="${id}" class="delivery-input-field" ${attrs} value="${escapeHtml(val)}">
    </div>`;

  const selectedCatObj = manualCats.find(c => c.id === selectedCatId) || manualCats[0] || {};
  const suggestedImgQuery = base.name
    ? dbmBuildCulinarySearchPlan(base.name, { suffix: (dbmLoadPrefs().ai || {}).googleSuffix ?? 'món ăn', category: selectedCatObj.name || '' }).primaryQuery
    : '';
  dbmEditorImgQueryTouched = false;

  dbmOpenSheet(`
    ${dbmSheetHeader(
    '📦',
    editing ? 'Chỉnh sửa mặt hàng' : 'Thêm mặt hàng mới',
    '<button type="button" class="dbm-expand-all-btn" onclick="dbmToggleAllSections(this)">↕ Mở rộng tất cả</button>'
  )}
    <div class="delivery-modal-body dbm-editor-body">
      <details class="dbm-section" open>
        <summary><span>📋 Thông tin cơ bản</span></summary>
        <div class="dbm-section-body">
          <div class="db-form-two-col">
            <div class="delivery-input-group">
              <label class="delivery-input-label">Tên mặt hàng (*)</label>
              <input type="text" id="item-editor-name" class="delivery-input-field" placeholder="VD: Xoài lắc muối tôm" value="${escapeHtml(base.name)}" oninput="dbmOnEditorNameOrCatInput()">
            </div>
            <div class="delivery-input-group">
              <label class="delivery-input-label">Giá bán (VNĐ) (*)</label>
              <input type="number" id="item-editor-price" class="delivery-input-field" min="1000" step="1000" value="${escapeHtml(base.price)}">
            </div>
          </div>
          <div class="db-form-two-col">
            <div class="delivery-input-group">
              <div class="dbm-label-row">
                <label class="delivery-input-label">Danh mục (*)</label>
                <button type="button" class="db-inline-link-btn" onclick="jumpToNewCategoryFromItemModal('${editItemId ? escapeHtml(editItemId) : ''}')">${FluentIcons.addRegular} Danh mục mới</button>
              </div>
              <select id="item-editor-category" class="delivery-input-field" onchange="dbmOnEditorNameOrCatInput()">
                ${manualCats.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === selectedCatId ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}${c.isCustom ? ' ✨' : ''}</option>`).join('')}
              </select>
            </div>
            <div class="delivery-input-group">
              <div class="dbm-label-row">
                <label class="delivery-input-label">Cửa hàng / quán bán</label>
                <button type="button" class="db-inline-link-btn" onclick="dbmJumpToNewStoreFromItemModal()">${FluentIcons.addRegular} Cửa hàng mới</button>
              </div>
              <select id="item-editor-store" class="delivery-input-field" onchange="dbmOnItemStoreSelectChange(this.value)">
                ${stores.slice().sort((a, b) => (b.id === 1000 ? 1 : 0) - (a.id === 1000 ? 1 : 0)).map(s => `
                  <option value="${s.id}" ${Number(s.id) === Number(base.restaurantId) ? 'selected' : ''}>${s.id === 1000 ? '🌟 ' : '🏪 '}${escapeHtml(s.name)}${s.address ? ' — ' + escapeHtml(s.address) : ''}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="delivery-input-group">
            <label class="delivery-input-label">Địa điểm / khu vực bán (để trống = lấy theo địa chỉ cửa hàng)</label>
            <input type="text" id="item-editor-location" class="delivery-input-field" placeholder="VD: 18 Phố Ao Sen, P. Mộ Lao, Hà Đông" value="${escapeHtml(base.location || (DB.getStoreById(base.restaurantId)?.address || ''))}">
          </div>
          <label class="db-checkbox-row" style="margin:0;">
            <input type="checkbox" id="item-editor-instock" ${base.inStock !== false ? 'checked' : ''}>
            <span>Đang còn hàng & sẵn sàng nhận đơn</span>
          </label>
        </div>
      </details>

      <details class="dbm-section" open>
        <summary><span>🖼️ Hình ảnh mặt hàng (Đa nguồn Free & Kéo thả)</span></summary>
        <div class="dbm-section-body">
          <div class="dbm-image-editor">
            <div class="dbm-image-preview"><img id="item-editor-img-preview" src="${escapeHtml(previewSrc)}" alt="Ảnh mặt hàng" onerror="this.src='assets/images/hung_chien_gion.webp'">
              <span class="dbm-image-state" id="item-editor-img-state">${tempItemImage && !dbmEditorImageIsPlaceholder ? '' : 'Chưa có ảnh thật'}</span>
            </div>
            <div class="dbm-image-source">
              ${dbmDropzoneHtml('itemimg', 'Thả ảnh vào đây hoặc bấm để chọn', { multiple: false, compact: true })}
              <input type="text" id="item-editor-image" class="delivery-input-field" placeholder="...hoặc dán URL ảnh trực tiếp"
                     value="${escapeHtml(tempItemImage && !tempItemImage.startsWith('data:') ? tempItemImage : '')}"
                     onchange="dbmSetEditorImage(this.value.trim())">
              <div class="dbm-img-query-box">
                <div class="dbm-label-row">
                  <span class="dbm-img-query-label">🔎 Từ khóa tìm ảnh chi tiết (càng rõ món càng chuẩn):</span>
                  <button type="button" class="db-inline-link-btn" onclick="dbmResetEditorImageQuery()" title="Tự động tạo lại từ khóa chi tiết từ tên & loại món">↻ Gợi ý lại</button>
                </div>
                <input type="text" id="item-editor-img-query" class="delivery-input-field"
                       placeholder="VD: tô bún bò huế giò heo | spicy beef noodle soup"
                       value="${escapeHtml(suggestedImgQuery)}"
                       oninput="dbmEditorImgQueryTouched = true">
              </div>
              <div class="dbm-google-btn-row">
                <button type="button" class="db-secondary-btn compact" onclick="dbmQuickGoogleImageForEditor(1)" title="Tìm tự động qua Bing Food + Openverse + MealDB (không cần API key)">⚡ Tự lấy ảnh #1 (Free)</button>
                <button type="button" class="db-secondary-btn compact" onclick="dbmQuickGoogleImageForEditor(2)" title="Lấy ảnh vị trí #2 từ kho đa nguồn miễn phí">⚡ Lấy ảnh #2</button>
                <button type="button" class="db-secondary-btn compact" onclick="dbmPreviewGoogleImagesForEditor()">🖼️ Chọn trong Top 6</button>
                <button type="button" class="db-secondary-btn compact" onclick="dbmQuickFreeAiImageForEditor()" title="Vẽ ảnh món ăn mới miễn phí bằng Pollinations Flux AI">🎨 Vẽ AI Free</button>
              </div>
            </div>
          </div>
          <div id="item-editor-google-results" class="dbm-google-results-strip" style="display:none;"></div>
          <div class="dbm-library-strip" id="item-editor-library">${dbmLibraryStripHtml('dbmSetEditorImage')}</div>
        </div>
      </details>

      <details class="dbm-section" open>
        <summary><span>📝 Mô tả & Tag phân loại</span></summary>
        <div class="dbm-section-body">
          <div class="delivery-input-group">
            <label class="delivery-input-label">Mô tả chi tiết</label>
            <textarea id="item-editor-desc" class="delivery-input-field" rows="2" placeholder="Hương vị, thành phần, điểm nổi bật...">${escapeHtml(base.description)}</textarea>
          </div>
          <div class="delivery-input-group">
            <label class="delivery-input-label">Tag (dùng để lọc & tự gom vào danh mục theo tag)</label>
            ${dbmTagWidgetHtml('item', 'VD: cay, ăn vặt, healthy rồi Enter')}
          </div>
        </div>
      </details>

      <details class="dbm-section">
        <summary><span>⭐ Đánh giá & Số lượng đã bán</span></summary>
        <div class="dbm-section-body">
          <div class="dbm-three-col">
            ${numField('item-editor-rating', 'Điểm đánh giá (0-5)', base.rating, 'min="0" max="5" step="0.1" placeholder="theo quán"')}
            ${numField('item-editor-reviews', 'Số lượt đánh giá', base.reviewCount, 'min="0" step="1" placeholder="0"')}
            ${numField('item-editor-sold', 'Đã bán', base.soldCount, 'min="0" step="1" placeholder="tự tính"')}
          </div>
          <div class="dbm-hint">Để trống để hệ thống dùng điểm đánh giá của cửa hàng / số liệu ước tính.</div>
        </div>
      </details>

      <details class="dbm-section">
        <summary><span>🎟️ Mã giảm giá áp dụng được (${(base.vouchers || []).length})</span></summary>
        <div class="dbm-section-body">
          ${DB.getVouchers().length === 0 ? '<div class="dbm-empty-note">Chưa có mã giảm giá nào. Tạo ở tab “Mã giảm giá”.</div>' : `
            <div class="dbm-voucher-pick-grid">
              ${DB.getVouchers().map(v => `
                <label class="dbm-voucher-pick">
                  <input type="checkbox" class="dbm-item-voucher" value="${escapeHtml(v.code)}" ${(base.vouchers || []).includes(v.code) ? 'checked' : ''}>
                  <div class="dbm-voucher-pick-info">
                    <strong>${escapeHtml(v.code)}</strong>
                    <span>${escapeHtml(v.title)} • ${v.scope === 'all' ? 'mọi món' : 'món được tick'}${v.active === false ? ' • đang tắt' : ''}</span>
                  </div>
                </label>`).join('')}
            </div>`}
        </div>
      </details>

      <details class="dbm-section" open>
        <summary><span>🥗 Đánh giá độ Healthy & Dinh dưỡng (mỗi phần)</span></summary>
        <div class="dbm-section-body">
          <div class="dbm-healthy-eval-box">
            <div class="dbm-healthy-eval-head">
              <div id="item-editor-healthy-preview" class="dbm-healthy-preview-wrap"></div>
              <button type="button" class="db-secondary-btn compact" onclick="dbmAutoCalcEditorHealthy()" title="Tự động tính điểm & nhận xét Healthy dựa trên tên món, tag và các chỉ số dinh dưỡng bên dưới">
                ⚡ Tự đánh giá từ dinh dưỡng
              </button>
            </div>
            <div class="db-form-two-col">
              <div class="delivery-input-group">
                <label class="delivery-input-label">Điểm Healthy (0 – 10)</label>
                <input type="number" id="item-editor-healthy-score" class="delivery-input-field" min="0.1" max="10" step="0.1"
                       placeholder="VD: 8.6 (trống = tự tính)" value="${escapeHtml(base.healthyScore)}"
                       oninput="dbmRefreshEditorHealthyPreview()">
              </div>
              <div class="delivery-input-group">
                <label class="delivery-input-label">Nhận xét mức độ Healthy</label>
                <input type="text" id="item-editor-healthy-level" class="delivery-input-field"
                       placeholder="VD: Cân bằng lành mạnh • Giàu đạm, ít dầu mỡ" value="${escapeHtml(base.healthyLevel)}"
                       oninput="dbmRefreshEditorHealthyPreview()">
              </div>
            </div>
            <div class="dbm-healthy-presets">
              <span class="dbm-healthy-presets-label">Gán nhanh:</span>
              <button type="button" class="dbm-healthy-preset-chip good" onclick="dbmApplyHealthyPreset(9.2, 'Rất lành mạnh • Thanh đạm, giàu chất xơ & ít béo')">🥗 Eat Clean (9.2)</button>
              <button type="button" class="dbm-healthy-preset-chip good" onclick="dbmApplyHealthyPreset(8.4, 'Cân bằng lành mạnh • Đủ đạm & năng lượng cho bữa chính')">⚖️ Cân bằng tốt (8.4)</button>
              <button type="button" class="dbm-healthy-preset-chip moderate" onclick="dbmApplyHealthyPreset(7.2, 'Cân bằng vừa phải • Năng lượng dồi dào, nên ăn kèm rau')">🍱 Vừa phải (7.2)</button>
              <button type="button" class="dbm-healthy-preset-chip indulgent" onclick="dbmApplyHealthyPreset(5.9, 'Ăn điều độ • Nhiều calo/đường/dầu mỡ, hạn chế ăn khuya')">🍟 Ăn điều độ (5.9)</button>
            </div>
          </div>

          <div class="dbm-nutri-grid">
            ${numField('item-nutri-calories', 'Calo (kcal)', nutri.calories ?? '', 'min="0" oninput="dbmRefreshEditorHealthyPreview()"')}
            ${numField('item-nutri-protein', 'Đạm (g)', nutri.protein ?? '', 'min="0" oninput="dbmRefreshEditorHealthyPreview()"')}
            ${numField('item-nutri-carbs', 'Tinh bột (g)', nutri.carbs ?? '', 'min="0" oninput="dbmRefreshEditorHealthyPreview()"')}
            ${numField('item-nutri-fat', 'Béo (g)', nutri.fat ?? '', 'min="0" oninput="dbmRefreshEditorHealthyPreview()"')}
            ${numField('item-nutri-fiber', 'Chất xơ (g)', nutri.fiber ?? '', 'min="0" step="0.1" oninput="dbmRefreshEditorHealthyPreview()"')}
            ${numField('item-nutri-sodium', 'Natri (mg)', nutri.sodium ?? '', 'min="0" oninput="dbmRefreshEditorHealthyPreview()"')}
            ${numField('item-nutri-sugar', 'Đường (g)', nutri.sugar ?? '', 'min="0" oninput="dbmRefreshEditorHealthyPreview()"')}
          </div>
          <div class="dbm-hint">Để trống ô nào thì hệ thống tự ước tính ô đó theo loại món & tự động chấm điểm Healthy tương ứng.</div>
        </div>
      </details>

      <details class="dbm-section">
        <summary><span>🥬 Nguyên liệu cấu thành (${base.ingredients?.length || 0})</span></summary>
        <div class="dbm-section-body">
          <div id="item-editor-ingredients" class="db-dynamic-rows"></div>
          <div><button type="button" class="db-inline-link-btn" onclick="dbmAddIngredientRow()">+ Thêm nguyên liệu</button></div>
        </div>
      </details>

      <details class="dbm-section">
        <summary><span>🍱 Kích cỡ, Topping & Ghi chú</span></summary>
        <div class="dbm-section-body">
          <div class="delivery-input-group">
            <div class="dbm-label-row"><label class="delivery-input-label">Kích cỡ / khẩu phần</label>
              <button type="button" class="db-inline-link-btn" onclick="addItemSizeRow()">+ Thêm cỡ</button></div>
            <div id="item-editor-sizes-list" class="db-dynamic-rows"></div>
          </div>
          <div class="delivery-input-group">
            <div class="dbm-label-row"><label class="delivery-input-label">Topping / tùy chọn thêm</label>
              <button type="button" class="db-inline-link-btn" onclick="addItemToppingRow()">+ Thêm topping</button></div>
            <div id="item-editor-toppings-list" class="db-dynamic-rows"></div>
          </div>
          <div class="delivery-input-group">
            <label class="delivery-input-label">Gợi ý ghi chú nhanh (cách nhau bằng dấu phẩy)</label>
            <input type="text" id="item-editor-notes" class="delivery-input-field" value="${escapeHtml(base.notes)}">
          </div>
        </div>
      </details>
    </div>
    <div class="dbm-editor-footer">
      ${aiReady ? `<button type="button" class="db-secondary-btn" onclick="dbmAiFillItemForm()" title="AI điền tag, nguyên liệu, dinh dưỡng, độ healthy và mô tả dựa trên tên món">🤖 AI điền giúp</button>` : ''}
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="submitItemEditor('${editItemId ? escapeHtml(editItemId) : ''}')">
        ${FluentIcons.saveFilled} ${editing ? 'Cập nhật & lưu mặt hàng' : 'Thêm & lưu mặt hàng'}
      </button>
    </div>`);

  renderItemSizesRows();
  renderItemToppingsRows();
  dbmRenderIngredientRows();
  dbmRefreshEditorHealthyPreview();
}

function dbmReadEditorDraftForHealthy() {
  const val = id => (document.getElementById(id)?.value ?? '');
  const catObj = DB.getCategoryById(val('item-editor-category'));
  return {
    name: val('item-editor-name').trim(),
    category: catObj ? catObj.name : '',
    description: val('item-editor-desc').trim(),
    tags: [...(dbmTagState.item || [])],
    ingredients: dbmEditorIngredients,
    healthyScore: val('item-editor-healthy-score'),
    healthyLevel: val('item-editor-healthy-level').trim(),
    nutrition: dbmCleanNutrition({
      calories: val('item-nutri-calories'),
      protein: val('item-nutri-protein'),
      carbs: val('item-nutri-carbs'),
      fat: val('item-nutri-fat'),
      fiber: val('item-nutri-fiber'),
      sodium: val('item-nutri-sodium'),
      sugar: val('item-nutri-sugar')
    }) || {}
  };
}

function dbmRefreshEditorHealthyPreview() {
  const el = document.getElementById('item-editor-healthy-preview');
  if (!el) return;
  const draft = dbmReadEditorDraftForHealthy();
  const explicitScore = dbmCleanHealthyScore(draft.healthyScore);
  const assessed = dbmComputeHealthyAssessment({ ...draft, healthyScore: explicitScore });
  const score = explicitScore !== null ? explicitScore : assessed.healthyScore;
  const level = draft.healthyLevel || assessed.healthyLevel;
  const tier = dbmHealthyTier(score);
  const modeNote = explicitScore !== null ? 'Điểm tùy chỉnh' : 'Ước tính tự động';

  el.innerHTML = `
    <span class="dbm-healthy-pill ${tier}">🥗 ${score}/10</span>
    <div class="dbm-healthy-preview-text">
      <strong>${escapeHtml(level)}</strong>
      <span>${modeNote} • thang 0–10</span>
    </div>`;
}

function dbmAutoCalcEditorHealthy() {
  const draft = dbmReadEditorDraftForHealthy();
  const assessed = dbmComputeHealthyAssessment({ ...draft, healthyScore: null });
  const sEl = document.getElementById('item-editor-healthy-score');
  const lEl = document.getElementById('item-editor-healthy-level');
  if (sEl) sEl.value = assessed.healthyScore;
  if (lEl) lEl.value = assessed.healthyLevel;
  dbmRefreshEditorHealthyPreview();
  showToast('checkmarkFilled', `Đã đánh giá Healthy: ${assessed.healthyScore}/10 — ${assessed.healthyLevel}`);
}

function dbmApplyHealthyPreset(score, level) {
  const sEl = document.getElementById('item-editor-healthy-score');
  const lEl = document.getElementById('item-editor-healthy-level');
  if (sEl) sEl.value = score;
  if (lEl) lEl.value = level;
  dbmRefreshEditorHealthyPreview();
}

function dbmSetEditorImage(src) {
  tempItemImage = src || '';
  dbmEditorImageIsPlaceholder = false;
  const input = document.getElementById('item-editor-image');
  const prev = document.getElementById('item-editor-img-preview');
  const state = document.getElementById('item-editor-img-state');
  if (input) input.value = src && !src.startsWith('data:') ? src : '';
  if (prev && src) prev.src = src;
  if (state) state.textContent = '';
}

let dbmEditorGoogleCandidates = [];
let dbmEditorGoogleBusy = false;
let dbmEditorImgQueryTouched = false;

function dbmGetEditorCategoryName() {
  const catId = document.getElementById('item-editor-category')?.value || '';
  return DB.getCategoryById(catId)?.name || '';
}

function dbmOnEditorNameOrCatInput() {
  dbmRefreshEditorHealthyPreview();
  if (!dbmEditorImgQueryTouched) {
    const qEl = document.getElementById('item-editor-img-query');
    const name = document.getElementById('item-editor-name')?.value.trim() || '';
    if (qEl) {
      const suffix = (dbmLoadPrefs().ai || {}).googleSuffix ?? 'món ăn';
      qEl.value = name ? dbmBuildCulinarySearchPlan(name, { suffix, category: dbmGetEditorCategoryName() }).primaryQuery : '';
    }
  }
}

function dbmResetEditorImageQuery() {
  dbmEditorImgQueryTouched = false;
  const name = document.getElementById('item-editor-name')?.value.trim() || '';
  const qEl = document.getElementById('item-editor-img-query');
  if (!name) {
    showToast('alertRegular', 'Hãy nhập tên mặt hàng trước để gợi ý từ khóa');
    return;
  }
  const plan = dbmBuildCulinarySearchPlan(name, {
    suffix: (dbmLoadPrefs().ai || {}).googleSuffix ?? 'món ăn',
    category: dbmGetEditorCategoryName()
  });
  const detailed = `${plan.viQueries[1] || plan.primaryQuery} | ${plan.enQueries[0] || ''}`.replace(/\s*\|\s*$/, '');
  if (qEl) qEl.value = detailed;
  showToast('checkmarkFilled', 'Đã tạo từ khóa mô tả món chi tiết (Việt + Anh)!');
}

function dbmResolveEditorImageSearchParams() {
  const name = document.getElementById('item-editor-name')?.value.trim() || '';
  const customQuery = document.getElementById('item-editor-img-query')?.value.trim() || '';
  const category = dbmGetEditorCategoryName();
  const suffix = (dbmLoadPrefs().ai || {}).googleSuffix ?? 'món ăn';
  const query = customQuery ? customQuery.split('|')[0].trim() : dbmBuildFoodImageQuery(name, suffix, category);
  return { name: name || query, query, extraQuery: customQuery, category };
}

async function dbmQuickGoogleImageForEditor(preferredRank = 1) {
  if (dbmEditorGoogleBusy) return;
  const { name, query, extraQuery, category } = dbmResolveEditorImageSearchParams();
  if (!query) {
    showToast('alertRegular', 'Hãy nhập tên mặt hàng hoặc từ khóa tìm ảnh trước');
    document.getElementById('item-editor-name')?.focus();
    return;
  }
  dbmEditorGoogleBusy = true;
  showToast('sparkleRegular', `⚡ Đang tìm ảnh đồ ăn #${preferredRank} cho "${query}"...`);
  try {
    const res = await dbmSearchGoogleImages(query, {
      limit: 6,
      autoDownload: true,
      preferredRank,
      name,
      category,
      extraQuery
    });
    const src = res.localPath || res.originalUrl;
    if (!src) throw new Error('Không tìm được ảnh phù hợp');
    DB.addLibraryImage({ name, src });
    dbmSetEditorImage(src);
    const libEl = document.getElementById('item-editor-library');
    if (libEl) libEl.innerHTML = dbmLibraryStripHtml('dbmSetEditorImage');
    const srcLabel = typeof dbmImageSourceLabel === 'function' ? dbmImageSourceLabel(res.source) : 'Đa nguồn';
    showToast('checkmarkFilled', `Đã chèn ảnh #${res.pickedRank || preferredRank} (${srcLabel}) cho "${name}"!`);
  } catch (err) {
    showToast('alertRegular', err.message || 'Không lấy được ảnh');
  } finally {
    dbmEditorGoogleBusy = false;
  }
}

async function dbmQuickFreeAiImageForEditor() {
  if (dbmEditorGoogleBusy) return;
  const { name, query, extraQuery, category } = dbmResolveEditorImageSearchParams();
  if (!query) {
    showToast('alertRegular', 'Hãy nhập tên mặt hàng hoặc từ khóa mô tả món trước');
    document.getElementById('item-editor-name')?.focus();
    return;
  }
  dbmEditorGoogleBusy = true;
  const plan = dbmBuildCulinarySearchPlan(name, { category, extraQuery });
  const prompt = `${plan.enQueries[0] || query}, appetizing close-up vietnamese food photography, natural lighting, restaurant quality, 4:3`;
  const aiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=480&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
  showToast('sparkleRegular', '🎨 Đang tạo ảnh món ăn bằng Pollinations Flux AI...');
  try {
    const localSrc = await dbmFetchRemoteImageToLocal(aiUrl, aiUrl, name);
    DB.addLibraryImage({ name, src: localSrc });
    dbmSetEditorImage(localSrc);
    const libEl = document.getElementById('item-editor-library');
    if (libEl) libEl.innerHTML = dbmLibraryStripHtml('dbmSetEditorImage');
    showToast('checkmarkFilled', `Đã tạo ảnh AI miễn phí cho "${name}"!`);
  } catch (_) {
    dbmSetEditorImage(aiUrl);
    showToast('checkmarkFilled', 'Đã gán đường dẫn ảnh AI (đang tải hiển thị)!');
  } finally {
    dbmEditorGoogleBusy = false;
  }
}

async function dbmPreviewGoogleImagesForEditor() {
  if (dbmEditorGoogleBusy) return;
  const { name, query, extraQuery, category } = dbmResolveEditorImageSearchParams();
  if (!query) {
    showToast('alertRegular', 'Hãy nhập tên mặt hàng hoặc từ khóa tìm ảnh trước');
    document.getElementById('item-editor-name')?.focus();
    return;
  }
  const strip = document.getElementById('item-editor-google-results');
  if (!strip) return;
  dbmEditorGoogleBusy = true;
  strip.style.display = 'block';
  strip.innerHTML = `<div class="dbm-hint">🔎 Đang tìm ảnh đa nguồn miễn phí (Bing Food • Openverse • MealDB) cho <strong>${escapeHtml(query)}</strong>...</div>`;
  try {
    const res = await dbmSearchGoogleImages(query, { limit: 6, autoDownload: false, name, category, extraQuery });
    dbmEditorGoogleCandidates = res.results || [];
    strip.innerHTML = `
      <div class="dbm-google-strip-head">
        <span>Tìm thấy <strong>${dbmEditorGoogleCandidates.length}</strong> ảnh cho <strong>${escapeHtml(query)}</strong> — bấm chọn ảnh ưng ý nhất:</span>
        <button type="button" class="db-inline-link-btn" onclick="document.getElementById('item-editor-google-results').style.display='none'">Ẩn</button>
      </div>
      <div class="dbm-google-thumbs-grid">
        ${dbmEditorGoogleCandidates.map((c, idx) => {
      const badge = typeof dbmImageSourceLabel === 'function' ? dbmImageSourceLabel(c.provider || res.source) : '';
      return `
          <button type="button" class="dbm-google-thumb-btn" onclick="dbmPickGooglePreviewResult(${idx})" title="Dùng ảnh #${idx + 1} (${escapeHtml(badge)})">
            <img src="${escapeHtml(c.thumbUrl || c.url)}" alt="Ảnh #${idx + 1}" loading="lazy" onerror="this.closest('button').style.opacity='0.35'">
            <span class="dbm-google-rank-badge">#${idx + 1}${badge ? ` • ${escapeHtml(badge)}` : ''}</span>
          </button>`;
    }).join('')}
      </div>`;
  } catch (err) {
    strip.innerHTML = `<div class="dbm-hint warn">⚠️ ${escapeHtml(err.message || 'Không tìm được ảnh')}</div>`;
  } finally {
    dbmEditorGoogleBusy = false;
  }
}

async function dbmPickGooglePreviewResult(idx) {
  const c = dbmEditorGoogleCandidates[idx];
  if (!c || dbmEditorGoogleBusy) return;
  const name = document.getElementById('item-editor-name')?.value.trim() || 'food';
  dbmEditorGoogleBusy = true;
  showToast('sparkleRegular', `Đang tải ảnh #${idx + 1} về máy...`);
  try {
    const localSrc = await dbmFetchRemoteImageToLocal(c.url, c.thumbUrl, name);
    DB.addLibraryImage({ name, src: localSrc });
    dbmSetEditorImage(localSrc);
    const libEl = document.getElementById('item-editor-library');
    if (libEl) libEl.innerHTML = dbmLibraryStripHtml('dbmSetEditorImage');
    showToast('checkmarkFilled', `Đã áp dụng ảnh #${idx + 1}!`);
  } catch (err) {
    showToast('alertRegular', err.message || 'Không tải được ảnh');
  } finally {
    dbmEditorGoogleBusy = false;
  }
}

// Giữ tên cũ để các nơi khác vẫn gọi được
function selectItemPresetImage(path) { dbmSetEditorImage(path); }

async function handleUploadItemImage(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  try {
    const img = await dbmImportImageFile(file);
    DB.addLibraryImage(img);
    dbmSetEditorImage(img.src);
  } catch (_) {
    showToast('alertRegular', 'Không thể đọc ảnh này');
  }
}

function dbmRenderIngredientRows() {
  const wrap = document.getElementById('item-editor-ingredients');
  if (!wrap) return;
  if (dbmEditorIngredients.length === 0) {
    wrap.innerHTML = `<div class="dbm-empty-note">Chưa có nguyên liệu (hệ thống sẽ dùng mẫu theo loại món)</div>`;
    return;
  }
  wrap.innerHTML = dbmEditorIngredients.map((g, i) => `
    <div class="db-dyn-row">
      <input type="text" class="delivery-input-field" placeholder="Tên nguyên liệu" value="${escapeHtml(g.name)}" oninput="dbmEditorIngredients[${i}].name = this.value">
      <input type="text" class="delivery-input-field price-in" placeholder="Khối lượng" value="${escapeHtml(g.amount || '')}" oninput="dbmEditorIngredients[${i}].amount = this.value">
      <button type="button" class="db-row-del-btn" onclick="dbmEditorIngredients.splice(${i},1); dbmRenderIngredientRows();">✕</button>
    </div>`).join('');
}

function dbmAddIngredientRow() {
  dbmEditorIngredients.push({ name: '', amount: '' });
  dbmRenderIngredientRows();
}

function dbmOnItemStoreSelectChange(storeId) {
  const st = DB.getStoreById(storeId);
  const locEl = document.getElementById('item-editor-location');
  if (st && st.address && locEl) locEl.value = st.address;
}

function dbmCollectItemForm() {
  const val = id => (document.getElementById(id)?.value ?? '');
  return {
    name: val('item-editor-name').trim(),
    price: Number(val('item-editor-price')) || 0,
    categoryId: val('item-editor-category'),
    restaurantId: Number(val('item-editor-store')) || 1000,
    location: val('item-editor-location').trim(),
    image: val('item-editor-image').trim() || tempItemImage,
    imageIsPlaceholder: dbmEditorImageIsPlaceholder,
    description: val('item-editor-desc').trim(),
    tags: [...dbmTagState.item],
    rating: val('item-editor-rating'),
    reviewCount: val('item-editor-reviews'),
    soldCount: val('item-editor-sold'),
    vouchers: Array.from(document.querySelectorAll('.dbm-item-voucher:checked')).map(el => el.value),
    healthyScore: val('item-editor-healthy-score'),
    healthyLevel: val('item-editor-healthy-level').trim(),
    nutrition: {
      calories: val('item-nutri-calories'), protein: val('item-nutri-protein'), carbs: val('item-nutri-carbs'),
      fat: val('item-nutri-fat'), fiber: val('item-nutri-fiber'), sodium: val('item-nutri-sodium'), sugar: val('item-nutri-sugar')
    },
    ingredients: JSON.parse(JSON.stringify(dbmEditorIngredients)),
    sizes: JSON.parse(JSON.stringify(tempItemSizes)),
    toppings: JSON.parse(JSON.stringify(tempItemToppings)),
    notes: val('item-editor-notes'),
    inStock: document.getElementById('item-editor-instock')?.checked !== false
  };
}

function submitItemEditor(editItemId) {
  const form = dbmCollectItemForm();
  const payload = {
    ...form,
    noteSuggestions: String(form.notes || '').split(',').map(s => s.trim()).filter(Boolean)
  };
  const res = DB.saveItem(payload, editItemId || null);
  if (!res.ok) {
    showToast('alertRegular', res.message);
    return;
  }
  closeModal();
  showToast('checkmarkFilled', `Đã lưu "${res.item.name}" (${res.item.priceFormatted})!`);
  render();
}

function jumpToNewCategoryFromItemModal(editItemId) {
  const draft = dbmCollectItemForm();
  draft.editItemId = editItemId || null;
  openCategoryEditorModal(null, draft);
}

function dbmJumpToNewStoreFromItemModal() {
  const draft = dbmCollectItemForm();
  draft.editItemId = dbmEditingItemId || null;
  openStoreEditorModal(null, draft);
}

// ─────────────────────────────────────────────────────────────────────────
// MODAL: DANH MỤC (thủ công hoặc theo tag)
// ─────────────────────────────────────────────────────────────────────────

function openCategoryEditorModal(editCatId = null, fromItemModalDraft = null, presetTags = null) {
  pendingReturnToItemModal = fromItemModalDraft;
  const editing = editCatId ? DB.getCategoryById(editCatId) : null;

  tempCatIcon = editing ? editing.icon : (presetTags ? '#️⃣' : '🛍️');
  tempCatImage = editing ? editing.image : 'assets/images/hung_chien_gion.webp';
  dbmCatType = editing ? (editing.type || 'manual') : (presetTags ? 'tag' : 'manual');
  dbmTagState.cat = dbmParseTags(editing ? editing.tagRule : (presetTags || []));

  dbmDropHandlers['catimg'] = async dropped => {
    const imported = await dbmImportDropped(dropped);
    if (imported.length === 0) return;
    imported.forEach(img => DB.addLibraryImage(img));
    dbmSetCatImage(imported[0].src);
  };

  dbmOpenSheet(`
    ${dbmSheetHeader(dbmCatType === 'tag' ? '#️⃣' : '🏷️', editing ? 'Chỉnh sửa danh mục' : 'Tạo danh mục mới')}
    <div class="delivery-modal-body dbm-editor-body">
      <div class="delivery-input-group">
        <label class="delivery-input-label">Tên danh mục (*)</label>
        <input type="text" id="cat-editor-name" class="delivery-input-field" placeholder="VD: Đồ ăn vặt, Món cay, Combo KTX..." value="${escapeHtml(editing ? editing.name : '')}">
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Kiểu danh mục</label>
        <div class="dbm-seg">
          <button type="button" id="dbm-cat-type-manual" class="${dbmCatType === 'manual' ? 'active' : ''}" onclick="dbmSetCatType('manual')">🏷️ Thủ công<small>mặt hàng chọn đúng 1 danh mục</small></button>
          <button type="button" id="dbm-cat-type-tag" class="${dbmCatType === 'tag' ? 'active' : ''}" onclick="dbmSetCatType('tag')"># Theo tag<small>tự gom mọi món có tag</small></button>
        </div>
      </div>

      <div class="delivery-input-group" id="dbm-cat-tagrule" style="${dbmCatType === 'tag' ? '' : 'display:none;'}">
        <label class="delivery-input-label">Gom các mặt hàng có tag (chỉ cần khớp 1 trong các tag)</label>
        ${dbmTagWidgetHtml('cat', 'VD: cay rồi Enter')}
        <div class="dbm-hint" id="dbm-cat-tag-count"></div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Biểu tượng (emoji)</label>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <input type="text" id="cat-editor-icon" class="delivery-input-field" style="width:76px; text-align:center; font-size:24px; padding:6px;" value="${escapeHtml(tempCatIcon)}" oninput="tempCatIcon = this.value">
          <span style="font-size:12px; color:var(--gray-500);">Chọn nhanh bên dưới hoặc tự nhập</span>
        </div>
        <div class="emoji-picker-grid">
          ${CATEGORY_EMOJI_PRESETS.map(em => `<button type="button" class="emoji-pick-btn ${tempCatIcon === em ? 'active' : ''}" onclick="selectCategoryEmoji('${em}', this)">${em}</button>`).join('')}
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Ảnh đại diện (thả ảnh, chọn từ thư viện hoặc dán URL)</label>
        <div class="dbm-image-editor">
          <div class="dbm-image-preview small"><img id="cat-editor-img-preview" src="${escapeHtml(tempCatImage)}" alt="Ảnh danh mục" onerror="this.src='assets/images/hung_chien_gion.webp'"></div>
          <div class="dbm-image-source">
            ${dbmDropzoneHtml('catimg', 'Thả ảnh hoặc bấm để chọn', { multiple: false, compact: true })}
            <input type="text" id="cat-editor-image" class="delivery-input-field" placeholder="URL ảnh"
                   value="${escapeHtml(tempCatImage.startsWith('data:') ? '' : tempCatImage)}" onchange="dbmSetCatImage(this.value.trim())">
          </div>
        </div>
        <div class="dbm-library-strip">${dbmLibraryStripHtml('dbmSetCatImage')}</div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Mô tả ngắn</label>
        <input type="text" id="cat-editor-desc" class="delivery-input-field" placeholder="VD: Món ăn vặt khuya cho sinh viên KTX..." value="${escapeHtml(editing ? (editing.description || '') : '')}">
      </div>

      <label class="db-checkbox-row">
        <input type="checkbox" id="cat-editor-home" ${(editing ? editing.showOnHome !== false : dbmCatType !== 'tag') ? 'checked' : ''}>
        <span>Hiện ô danh mục này trong lưới 2 dòng trên <strong>trang chủ</strong></span>
      </label>
      <label class="db-checkbox-row">
        <input type="checkbox" id="cat-editor-res-section" ${(editing ? Boolean(editing.showAsRestaurantSection) : dbmCatType === 'tag') ? 'checked' : ''}>
        <span>Hiện thành dãy quán/món ngang (<strong>restaurants-section</strong>) trên trang chủ</span>
      </label>
      <label class="db-checkbox-row">
        <input type="checkbox" id="cat-editor-visual" ${(!editing || editing.showInVisualSuggestions !== false) ? 'checked' : ''}>
        <span>Hiện trong thanh gợi ý hình ảnh khi tìm kiếm</span>
      </label>
    </div>
    <div class="dbm-editor-footer">
      ${editing ? `<button type="button" class="db-danger-outline-btn" onclick="closeModal(); handleDeleteCategory('${escapeHtml(editing.id)}')">🗑️ Xóa</button>` : ''}
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="submitCategoryEditor('${editing ? escapeHtml(editing.id) : ''}')">
        ${FluentIcons.saveFilled} ${editing ? 'Lưu cập nhật' : 'Tạo & lưu danh mục'}
      </button>
    </div>`);
  dbmUpdateCatTagCount();
  setTimeout(() => document.getElementById('cat-editor-name')?.focus(), 80);
}

function dbmSetCatType(type) {
  dbmCatType = type;
  document.getElementById('dbm-cat-type-manual')?.classList.toggle('active', type === 'manual');
  document.getElementById('dbm-cat-type-tag')?.classList.toggle('active', type === 'tag');
  const box = document.getElementById('dbm-cat-tagrule');
  if (box) box.style.display = type === 'tag' ? '' : 'none';
}

function dbmOnTagsChanged(key) {
  if (key === 'cat') dbmUpdateCatTagCount();
  if (key === 'item') dbmRefreshEditorHealthyPreview();
}

function dbmUpdateCatTagCount() {
  const el = document.getElementById('dbm-cat-tag-count');
  if (!el) return;
  const rule = dbmTagState.cat;
  if (rule.length === 0) { el.textContent = 'Chưa có tag nào — danh mục sẽ trống.'; return; }
  const n = DB.getItems().filter(it => dbmItemMatchesTagRule(it, rule)).length;
  el.textContent = `Hiện có ${n} mặt hàng khớp. Mặt hàng thêm tag này sau này sẽ tự vào danh mục.`;
}

function dbmSetCatImage(src) {
  if (!src) return;
  tempCatImage = src;
  const input = document.getElementById('cat-editor-image');
  const prev = document.getElementById('cat-editor-img-preview');
  if (input) input.value = src.startsWith('data:') ? '' : src;
  if (prev) prev.src = src;
}

function selectCategoryPresetImage(path) { dbmSetCatImage(path); }

async function handleUploadCategoryImage(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  try {
    const img = await dbmImportImageFile(file);
    DB.addLibraryImage(img);
    dbmSetCatImage(img.src);
  } catch (_) {
    showToast('alertRegular', 'Không thể đọc file ảnh này');
  }
}

function submitCategoryEditor(editCatId) {
  const name = document.getElementById('cat-editor-name')?.value.trim();
  if (!name) {
    showToast('alertRegular', 'Vui lòng nhập tên danh mục!');
    document.getElementById('cat-editor-name')?.focus();
    return;
  }
  const res = DB.saveCategory({
    name,
    type: dbmCatType,
    tagRule: dbmTagState.cat,
    icon: document.getElementById('cat-editor-icon')?.value.trim() || tempCatIcon,
    image: tempCatImage,
    description: document.getElementById('cat-editor-desc')?.value.trim() || '',
    showOnHome: document.getElementById('cat-editor-home')?.checked !== false,
    showAsRestaurantSection: Boolean(document.getElementById('cat-editor-res-section')?.checked),
    showInVisualSuggestions: document.getElementById('cat-editor-visual')?.checked !== false
  }, editCatId || null);

  if (!res.ok) { showToast('alertRegular', res.message); return; }

  syncGlobalChromeUI();
  showToast('checkmarkFilled', `Đã lưu danh mục "${res.category.icon} ${res.category.name}"!`);

  if (pendingReturnToItemModal) {
    const draft = pendingReturnToItemModal;
    pendingReturnToItemModal = null;
    openItemEditorModal(draft.editItemId || null, res.category.id, draft);
    return;
  }
  closeModal();
  render();
}

function handleDeleteCategory(catId) {
  const cat = DB.getCategoryById(catId);
  if (!cat) return;
  const count = DB.countItemsInCategory(cat);
  const msg = cat.type === 'tag'
    ? `Xóa danh mục theo tag "${cat.name}"? (Các mặt hàng và tag của chúng không bị ảnh hưởng)`
    : (count > 0
      ? `Danh mục "${cat.name}" đang có ${count} mặt hàng — nếu xóa, chúng sẽ chuyển sang danh mục thủ công đầu tiên. Xóa?`
      : `Xóa  danh mục "${cat.name}"?`);
  if (!confirm(msg)) return;
  const res = DB.deleteCategory(catId);
  if (res.ok) {
    dbmSelectedCategoryIds.delete(catId);
    syncGlobalChromeUI();
    if (catalogCategoryFilter === catId) catalogCategoryFilter = 'all';
    showToast('deleteRegular', `Đã xóa danh mục "${cat.name}"`);
    render();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TAB: DANH MỤC (hỗ trợ chọn nhiều + AI đánh giá điều chỉnh)
// ─────────────────────────────────────────────────────────────────────────

let dbmSelectedCategoryIds = new Set();
let dbmCategorySearchQuery = '';

function getFilteredDbmCategories() {
  const cats = DB.getCategories();
  const q = dbmNormText(dbmCategorySearchQuery);
  if (!q) return cats;
  return cats.filter(c =>
    dbmNormText(c.name).includes(q) ||
    dbmNormText(c.description).includes(q) ||
    (c.tagRule || []).some(t => dbmNormText(t).includes(q))
  );
}

function renderDbmCategoryBulkBar(visibleCats) {
  const aliveIds = new Set(DB.getCategories().map(c => c.id));
  dbmSelectedCategoryIds.forEach(id => { if (!aliveIds.has(id)) dbmSelectedCategoryIds.delete(id); });

  const n = dbmSelectedCategoryIds.size;
  const allVisibleSelected = visibleCats.length > 0 && visibleCats.every(c => dbmSelectedCategoryIds.has(c.id));

  if (n > 0) {
    return `
      <div class="dbm-bulk-bar active" role="region" aria-label="Thanh công cụ danh mục đã chọn">
        <div class="dbm-bulk-bar-inner">
          <div class="dbm-bulk-top-row">
            <div class="dbm-bulk-left">
              <label class="dbm-bulk-selectall">
                <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisibleCategories(this.checked)">
                <span>Đã chọn <strong>${n}</strong> danh mục</span>
              </label>
            </div>
            <div class="dbm-bulk-top-actions">
              <button type="button" class="danger" onclick="dbmBulkDeleteCategories()" title="Xóa các danh mục đã chọn">🗑️ Xóa</button>
              <button type="button" class="dbm-bulk-clear-btn" onclick="dbmClearCategorySelection()" title="Bỏ chọn tất cả">✕ Bỏ chọn</button>
            </div>
          </div>
          <div class="dbm-bulk-actions">
            <button type="button" class="ai-audit-btn" onclick="dbmOpenAiAuditModal('categories')" title="Dùng AI đánh giá các danh mục đã chọn cần điều chỉnh gì">🤖 AI đánh giá (${n})</button>
            <button type="button" onclick="dbmBulkCategoriesHome(true)">🏠 Hiện lưới 2 dòng</button>
            <button type="button" onclick="dbmBulkCategoriesHome(false)">🙈 Ẩn lưới 2 dòng</button>
            <button type="button" onclick="dbmBulkCategoriesResSection(true)">🍽️ Bật dãy quán</button>
            <button type="button" onclick="dbmBulkCategoriesResSection(false)">➖ Tắt dãy quán</button>
          </div>
        </div>
      </div>
      <div class="dbm-bulk-inline-status">
        <label class="dbm-bulk-selectall">
          <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisibleCategories(this.checked)">
          <span>Đang chọn <strong>${n}</strong> danh mục — bấm <strong>🤖 AI đánh giá</strong> trên thanh công cụ để xem đề xuất điều chỉnh</span>
        </label>
        <div style="display:flex; align-items:center; gap:10px;">
          <button type="button" class="db-inline-link-btn" onclick="dbmOpenAiAuditModal('categories')">🤖 AI đánh giá (${n})</button>
          <button type="button" class="db-inline-link-btn" onclick="dbmClearCategorySelection()">Bỏ chọn</button>
        </div>
      </div>`;
  }

  return `
    <div class="dbm-bulk-bar">
      <label class="dbm-bulk-selectall">
        <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisibleCategories(this.checked)">
        <span>Chọn tất cả danh mục đang hiện</span>
      </label>
      <span class="dbm-bulk-hint">Tip: tick chọn nhiều danh mục để nhờ <strong>🤖 AI đánh giá độ phủ món, tag & bố cục hiển thị</strong></span>
      ${visibleCats.length > 0 ? `<button type="button" class="db-inline-link-btn" onclick="dbmOpenAiAuditModal('categories')">🤖 AI rà soát danh mục</button>` : ''}
    </div>`;
}

function renderDbmCategoriesGridHtml(catsList) {
  const allCats = DB.getCategories();
  const bulk = renderDbmCategoryBulkBar(catsList);
  if (catsList.length === 0) {
    return `${bulk}<div class="dbm-empty-note" style="padding:28px;">Không tìm thấy danh mục nào khớp từ khóa.</div>`;
  }

  return `${bulk}
    <div class="db-categories-grid">
      ${catsList.map(cat => {
    const idx = allCats.findIndex(c => c.id === cat.id);
    const count = DB.countItemsInCategory(cat);
    const onHome = cat.showOnHome !== false;
    const selected = dbmSelectedCategoryIds.has(cat.id);
    const id = escapeHtml(cat.id);
    return `
          <div class="db-category-card ${cat.isCustom ? 'is-custom' : ''} ${onHome ? '' : 'dbm-hidden-cat'} ${selected ? 'selected' : ''}">
            <div class="db-cat-card-top">
              <div class="db-cat-card-icon">${cat.icon}</div>
              <div class="db-cat-card-info">
                <div class="db-cat-card-name">
                  ${escapeHtml(cat.name)}
                  ${cat.type === 'tag' ? `<span class="custom-pill" style="background:#e0f2fe;color:#0369a1;"># Theo tag</span>` : `<span class="system-pill">Thủ công</span>`}
                </div>
                <div class="db-cat-card-count">${count} mặt hàng${cat.type === 'tag' ? ` • tag: ${(cat.tagRule || []).map(t => '#' + escapeHtml(t)).join(' ')}` : ''}</div>
              </div>
              <label class="dbm-cat-select-check" onclick="event.stopPropagation()" title="Chọn danh mục này">
                <input type="checkbox" ${selected ? 'checked' : ''} onchange="dbmToggleCategorySelect('${id}', this.checked)">
              </label>
            </div>
            ${cat.description ? `<div class="db-cat-card-desc">${escapeHtml(cat.description)}</div>` : ''}
            <label class="dbm-switch-row">
              <input type="checkbox" ${onHome ? 'checked' : ''} onchange="dbmToggleCategoryHome('${id}', this.checked)">
              <span>Hiện ô trong lưới 2 dòng trang chủ</span>
            </label>
            <label class="dbm-switch-row">
              <input type="checkbox" ${cat.showAsRestaurantSection ? 'checked' : ''} onchange="dbmToggleCategoryRestaurantSection('${id}', this.checked)">
              <span>Hiện dạng dãy quán (restaurants-section)</span>
            </label>
            <div class="db-cat-card-actions">
              <button type="button" class="db-act-btn order" onclick="dbmViewCategoryItems('${id}')">${FluentIcons.boxFilled} Xem món</button>
              <button type="button" class="db-act-btn edit" onclick="openItemEditorModal(null, '${id}')">+ Món</button>
              <button type="button" class="db-act-btn edit" onclick="dbmOpenAiAuditModal('categories', ['${id}'])" title="AI đánh giá & gợi ý chỉnh sửa danh mục này">🤖</button>
              <button type="button" class="db-act-btn edit" onclick="openCategoryEditorModal('${id}')">✏️</button>
              <button type="button" class="db-act-btn edit" onclick="dbmMoveCategory('${id}', -1)" ${idx <= 0 ? 'disabled' : ''} title="Đưa lên">↑</button>
              <button type="button" class="db-act-btn edit" onclick="dbmMoveCategory('${id}', 1)" ${idx === allCats.length - 1 ? 'disabled' : ''} title="Đưa xuống">↓</button>
              <button type="button" class="db-act-btn delete" onclick="handleDeleteCategory('${id}')">🗑️</button>
            </div>
          </div>`;
  }).join('')}
    </div>`;
}

function renderDbmCategoriesTab() {
  const cats = DB.getCategories();
  const tags = DB.getAllTags();
  return `
    <div class="db-section-toolbar">
      <div>
        <div style="font-size:15px; font-weight:800; color:var(--gray-900);">Danh mục (${cats.length}) — ${cats.filter(c => c.showOnHome !== false).length} ô lưới 2 dòng • ${cats.filter(c => c.showAsRestaurantSection).length} dãy quán (restaurants-section)</div>
        <div style="font-size:12px; color:var(--gray-500);">Danh mục <strong>thủ công</strong>: mỗi món thuộc 1 danh mục. Danh mục <strong>theo tag</strong>: tự gom mọi món có tag đã chọn.</div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="db-secondary-btn" onclick="openCategoryEditorModal(null, null, [])"># Danh mục theo tag</button>
        <button type="button" class="db-primary-btn" onclick="openCategoryEditorModal()">${FluentIcons.addRegular} Danh mục thủ công</button>
      </div>
    </div>

    <div class="db-controls-card" style="margin-bottom:12px;">
      <div class="db-search-row">
        <div class="db-search-input-wrap">
          <span>${FluentIcons.searchRegular}</span>
          <input type="text" placeholder="Tìm danh mục theo tên, mô tả hoặc tag..."
                 value="${escapeHtml(dbmCategorySearchQuery)}"
                 oninput="dbmCategorySearchQuery = this.value; updateCatalogCategoriesListDOM();">
          ${dbmCategorySearchQuery ? `<button type="button" onclick="dbmCategorySearchQuery=''; renderCatalogManagerView();">✕</button>` : ''}
        </div>
      </div>
    </div>

    ${tags.length ? `
      <div class="dbm-panel">
        <div class="dbm-panel-title">Tag đang dùng (${tags.length})</div>
        <div class="dbm-tag-cloud">
          ${tags.slice(0, 60).map(t => `
            <span class="dbm-tag-chip cloud">
              <span onclick="dbmTagFilter='${escapeHtml(t.tag)}'; switchCatalogTab('items')" title="Xem mặt hàng có tag này">#${escapeHtml(t.tag)} <em>${t.count}</em></span>
              <button type="button" title="Tạo danh mục theo tag này" onclick="openCategoryEditorModal(null, null, ['${escapeHtml(t.tag)}'])">＋</button>
            </span>`).join('')}
        </div>
      </div>` : ''}

    <div id="catalog-categories-list-container">${renderDbmCategoriesGridHtml(getFilteredDbmCategories())}</div>`;
}

function updateCatalogCategoriesListDOM() {
  const el = document.getElementById('catalog-categories-list-container');
  if (el) el.innerHTML = renderDbmCategoriesGridHtml(getFilteredDbmCategories());
  if (typeof updateFloatingTopBar === 'function') updateFloatingTopBar();
}

function dbmToggleCategorySelect(id, checked) {
  if (checked) dbmSelectedCategoryIds.add(id);
  else dbmSelectedCategoryIds.delete(id);
  updateCatalogCategoriesListDOM();
}

function dbmSelectAllVisibleCategories(checked) {
  getFilteredDbmCategories().forEach(c => {
    if (checked) dbmSelectedCategoryIds.add(c.id);
    else dbmSelectedCategoryIds.delete(c.id);
  });
  updateCatalogCategoriesListDOM();
}

function dbmClearCategorySelection() {
  dbmSelectedCategoryIds.clear();
  updateCatalogCategoriesListDOM();
}

function dbmBulkCategoriesHome(show) {
  if (!dbmSelectedCategoryIds.size) return;
  let count = 0;
  dbmSelectedCategoryIds.forEach(id => {
    if (DB.setCategoryOnHome(id, show)) count++;
  });
  syncGlobalChromeUI();
  showToast('checkmarkFilled', `${show ? 'Đã hiện' : 'Đã ẩn'} ${count} danh mục trên lưới 2 dòng trang chủ`);
  renderCatalogManagerView();
}

function dbmBulkCategoriesResSection(show) {
  if (!dbmSelectedCategoryIds.size) return;
  let count = 0;
  dbmSelectedCategoryIds.forEach(id => {
    if (DB.setCategoryRestaurantSection(id, show)) count++;
  });
  showToast('checkmarkFilled', `${show ? 'Đã bật' : 'Đã tắt'} chế độ dãy quán cho ${count} danh mục`);
  renderCatalogManagerView();
}

function dbmBulkDeleteCategories() {
  const ids = [...dbmSelectedCategoryIds];
  if (!ids.length) return;
  if (!confirm(`Xóa ${ids.length} danh mục đã chọn? (Các mặt hàng thuộc danh mục thủ công bị xóa sẽ tự chuyển về danh mục thủ công đầu tiên)`)) return;
  let deleted = 0;
  ids.forEach(id => {
    const res = DB.deleteCategory(id);
    if (res.ok) deleted++;
  });
  dbmSelectedCategoryIds.clear();
  syncGlobalChromeUI();
  showToast('deleteRegular', `Đã xóa ${deleted} danh mục`);
  renderCatalogManagerView();
}

function dbmToggleCategoryHome(id, show) {
  DB.setCategoryOnHome(id, show);
  syncGlobalChromeUI();
  showToast('checkmarkFilled', show ? 'Đã hiện ô trên trang chủ' : 'Đã ẩn ô khỏi trang chủ');
  renderCatalogManagerView();
}

function dbmToggleCategoryRestaurantSection(id, show) {
  DB.setCategoryRestaurantSection(id, show);
  showToast('checkmarkFilled', show ? 'Đã bật hiển thị dạng restaurants-section trên trang chủ' : 'Đã tắt hiển thị dạng restaurants-section');
  renderCatalogManagerView();
}

function dbmMoveCategory(id, dir) {
  if (DB.moveCategory(id, dir)) {
    syncGlobalChromeUI();
    renderCatalogManagerView();
  }
}

function dbmViewCategoryItems(id) {
  catalogCategoryFilter = id;
  catalogActiveTab = 'items';
  dbmSelectedIds.clear();
  renderCatalogManagerView();
}

// ─────────────────────────────────────────────────────────────────────────
// MODAL + TAB: CỬA HÀNG / ĐỊA ĐIỂM
// ─────────────────────────────────────────────────────────────────────────

function openStoreEditorModal(editStoreId = null, returnDraft = null) {
  dbmStoreReturnDraft = returnDraft;
  const st = editStoreId ? DB.getStoreById(editStoreId) : null;
  const cats = DB.getManualCategories();
  dbmStoreImage = st ? st.image : '';

  dbmDropHandlers['storeimg'] = async dropped => {
    const imported = await dbmImportDropped(dropped);
    if (imported.length === 0) return;
    imported.forEach(img => DB.addLibraryImage(img));
    dbmSetStoreImage(imported[0].src);
  };

  const field = (id, label, value, attrs = '', type = 'text') => `
    <div class="delivery-input-group">
      <label class="delivery-input-label">${label}</label>
      <input type="${type}" id="${id}" class="delivery-input-field" ${attrs} value="${escapeHtml(value)}">
    </div>`;

  dbmOpenSheet(`
    ${dbmSheetHeader('🏪', st ? 'Chỉnh sửa cửa hàng' : 'Tạo cửa hàng mới')}
    <div class="delivery-modal-body dbm-editor-body">
      ${field('store-editor-name', 'Tên cửa hàng (*)', st ? st.name : '', 'placeholder="VD: Bếp Cô Lan - Cổng sau PTIT"')}
      <div class="delivery-input-group">
        <label class="delivery-input-label">Ảnh cửa hàng</label>
        <div class="dbm-image-editor">
          <div class="dbm-image-preview small"><img id="store-editor-img-preview" src="${escapeHtml(dbmStoreImage || 'assets/images/hung_chien_gion.webp')}" alt="" onerror="this.src='assets/images/hung_chien_gion.webp'"></div>
          <div class="dbm-image-source">
            ${dbmDropzoneHtml('storeimg', 'Thả ảnh hoặc bấm để chọn', { multiple: false, compact: true })}
            <input type="text" id="store-editor-image" class="delivery-input-field" placeholder="URL ảnh" value="${escapeHtml(dbmStoreImage.startsWith('data:') ? '' : dbmStoreImage)}" onchange="dbmSetStoreImage(this.value.trim())">
          </div>
        </div>
        <div class="dbm-library-strip">${dbmLibraryStripHtml('dbmSetStoreImage')}</div>
      </div>
      <div class="delivery-input-group">
        <label class="delivery-input-label">Danh mục chính</label>
        <select id="store-editor-category" class="delivery-input-field">
          ${cats.map(c => `<option value="${escapeHtml(c.id)}" ${st && st.categoryId === c.id ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      ${field('store-editor-address', 'Địa chỉ / địa điểm', st ? st.address : '', 'placeholder="VD: 12 Ngõ 5, Km10 Nguyễn Trãi, Hà Đông"')}
      <div class="db-form-two-col">
        ${field('store-editor-phone', 'Số điện thoại', st ? st.phone : '', 'placeholder="09xx xxx xxx"')}
        ${field('store-editor-distance', 'Khoảng cách tới PTIT (km)', st ? st.distance : 0.5, 'min="0" step="0.1"', 'number')}
      </div>
      <div class="db-form-two-col">
        ${field('store-editor-delivery', 'Thời gian giao', st ? st.deliveryTime : '15 - 20 phút')}
        ${field('store-editor-ship', 'Phí giao (VNĐ, 0 = Freeship)', st ? st.shippingFeeNum : 0, 'min="0" step="1000"', 'number')}
      </div>
      <div class="dbm-three-col">
        ${field('store-editor-rating', 'Điểm đánh giá (0-5)', st ? st.rating : 5, 'min="0" max="5" step="0.1"', 'number')}
        ${field('store-editor-reviewtext', 'Số đánh giá (chữ)', st ? st.reviewCount : 'Quán mới mở')}
        <div class="delivery-input-group">
          <label class="delivery-input-label">Mức giá</label>
          <select id="store-editor-price" class="delivery-input-field">
            ${['$', '$$', '$$$'].map(p => `<option value="${p}" ${(st ? st.priceLevel : '$') === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      ${field('store-editor-badge', 'Huy hiệu', st ? st.badge : 'Mới ✨')}
      <div class="delivery-input-group">
        <label class="delivery-input-label">Giới thiệu ngắn</label>
        <textarea id="store-editor-review" class="delivery-input-field" rows="2">${escapeHtml(st ? st.shortReview : '')}</textarea>
      </div>
      ${field('store-editor-vouchers', 'Nhãn ưu đãi hiển thị (cách nhau bằng dấu phẩy)', st ? (st.vouchers || []).join(', ') : '', 'placeholder="VD: Freeship 0đ, Giảm 50K"')}
    </div>
    <div class="dbm-editor-footer">
      ${st && st.id !== 1000 ? `<button type="button" class="db-danger-outline-btn" onclick="closeModal(); dbmDeleteStore(${st.id})">${FluentIcons.deleteRegular} Xóa</button>` : ''}
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="dbmSubmitStoreEditor(${st ? st.id : 'null'})">${FluentIcons.saveFilled} ${st ? 'Lưu cập nhật' : 'Tạo cửa hàng'}</button>
    </div>`);
}

function dbmSetStoreImage(src) {
  if (!src) return;
  dbmStoreImage = src;
  const input = document.getElementById('store-editor-image');
  const prev = document.getElementById('store-editor-img-preview');
  if (input) input.value = src.startsWith('data:') ? '' : src;
  if (prev) prev.src = src;
}

function dbmSubmitStoreEditor(editId) {
  const val = id => (document.getElementById(id)?.value ?? '').trim();
  const res = DB.saveStore({
    name: val('store-editor-name'),
    image: dbmStoreImage,
    categoryId: val('store-editor-category'),
    address: val('store-editor-address'),
    phone: val('store-editor-phone'),
    distance: val('store-editor-distance'),
    deliveryTime: val('store-editor-delivery'),
    shippingFeeNum: val('store-editor-ship'),
    rating: val('store-editor-rating'),
    reviewCount: val('store-editor-reviewtext'),
    priceLevel: val('store-editor-price'),
    badge: val('store-editor-badge'),
    shortReview: val('store-editor-review'),
    vouchers: val('store-editor-vouchers')
  }, editId);

  if (!res.ok) { showToast('alertRegular', res.message); return; }
  showToast('checkmarkFilled', `Đã lưu cửa hàng "${res.store.name}"`);

  if (dbmStoreReturnDraft) {
    const draft = dbmStoreReturnDraft;
    dbmStoreReturnDraft = null;
    openItemEditorModal(draft.editItemId || null, null, { ...draft, restaurantId: res.store.id });
    return;
  }
  closeModal();
  render();
}

function dbmDeleteStore(id) {
  const st = DB.getStoreById(id);
  if (!st) return;
  const n = DB.getItemsByStore(id).length;
  if (!confirm(`Xóa cửa hàng "${st.name}"?${n ? `\n${n} mặt hàng của quán sẽ được chuyển về "Gian hàng tự chọn".` : ''}`)) return;
  const res = DB.deleteStore(id);
  if (!res.ok) { showToast('alertRegular', res.message); return; }
  dbmSelectedStoreIds.delete(Number(id));
  if (String(dbmStoreFilter) === String(id)) dbmStoreFilter = 'all';
  showToast('deleteRegular', `Đã xóa cửa hàng "${st.name}"`);
  render();
}

let dbmSelectedStoreIds = new Set();
let dbmStoreSearchQuery = '';

function getFilteredDbmStores() {
  const stores = DB.getStores();
  const q = dbmNormText(dbmStoreSearchQuery);
  if (!q) return stores;
  return stores.filter(s =>
    dbmNormText(s.name).includes(q) ||
    dbmNormText(s.address).includes(q) ||
    dbmNormText(s.category).includes(q) ||
    dbmNormText(s.shortReview).includes(q)
  );
}

function renderDbmStoreBulkBar(visibleStores) {
  const aliveIds = new Set(DB.getStores().map(s => Number(s.id)));
  dbmSelectedStoreIds.forEach(id => { if (!aliveIds.has(Number(id))) dbmSelectedStoreIds.delete(id); });

  const n = dbmSelectedStoreIds.size;
  const allVisibleSelected = visibleStores.length > 0 && visibleStores.every(s => dbmSelectedStoreIds.has(Number(s.id)));

  if (n > 0) {
    return `
      <div class="dbm-bulk-bar active" role="region" aria-label="Thanh công cụ nhà hàng đã chọn">
        <div class="dbm-bulk-bar-inner">
          <div class="dbm-bulk-top-row">
            <div class="dbm-bulk-left">
              <label class="dbm-bulk-selectall">
                <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisibleStores(this.checked)">
                <span>Đã chọn <strong>${n}</strong> nhà hàng</span>
              </label>
            </div>
            <div class="dbm-bulk-top-actions">
              <button type="button" class="danger" onclick="dbmBulkDeleteStores()" title="Xóa các nhà hàng đã chọn">🗑️ Xóa</button>
              <button type="button" class="dbm-bulk-clear-btn" onclick="dbmClearStoreSelection()" title="Bỏ chọn tất cả">✕ Bỏ chọn</button>
            </div>
          </div>
          <div class="dbm-bulk-actions">
            <button type="button" class="ai-audit-btn" onclick="dbmOpenAiAuditModal('stores')" title="Dùng AI đánh giá các nhà hàng đã chọn cần điều chỉnh gì">🤖 AI đánh giá (${n})</button>
            <button type="button" onclick="dbmBulkStoresFreeship()">🚚 Đặt Freeship 0đ</button>
          </div>
        </div>
      </div>
      <div class="dbm-bulk-inline-status">
        <label class="dbm-bulk-selectall">
          <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisibleStores(this.checked)">
          <span>Đang chọn <strong>${n}</strong> nhà hàng — bấm <strong>🤖 AI đánh giá</strong> trên thanh công cụ để xem đề xuất điều chỉnh</span>
        </label>
        <div style="display:flex; align-items:center; gap:10px;">
          <button type="button" class="db-inline-link-btn" onclick="dbmOpenAiAuditModal('stores')">🤖 AI đánh giá (${n})</button>
          <button type="button" class="db-inline-link-btn" onclick="dbmClearStoreSelection()">Bỏ chọn</button>
        </div>
      </div>`;
  }

  return `
    <div class="dbm-bulk-bar">
      <label class="dbm-bulk-selectall">
        <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisibleStores(this.checked)">
        <span>Chọn tất cả nhà hàng đang hiện</span>
      </label>
      <span class="dbm-bulk-hint">Tip: tick chọn nhiều nhà hàng để nhờ <strong>🤖 AI đánh giá thực đơn, mức giá, phí ship & địa chỉ</strong></span>
      ${visibleStores.length > 0 ? `<button type="button" class="db-inline-link-btn" onclick="dbmOpenAiAuditModal('stores')">🤖 AI rà soát nhà hàng</button>` : ''}
    </div>`;
}

function renderDbmStoresGridHtml(storesList) {
  const bulk = renderDbmStoreBulkBar(storesList);
  if (storesList.length === 0) {
    return `${bulk}<div class="dbm-empty-note" style="padding:28px;">Không tìm thấy nhà hàng nào khớp từ khóa.</div>`;
  }

  return `${bulk}
    <div class="dbm-store-grid">
      ${storesList.map(s => {
    const count = DB.getItemsByStore(s.id).length;
    const selected = dbmSelectedStoreIds.has(Number(s.id));
    return `
        <div class="dbm-store-card ${selected ? 'selected' : ''}">
          <div class="dbm-store-img">
            ${dbmThumb(s.image, s.name)}
            ${s.isAIGenerated ? '<span class="dbm-ai-flag">🤖 AI</span>' : ''}
            <label class="dbm-card-check" onclick="event.stopPropagation()" title="Chọn nhà hàng này">
              <input type="checkbox" ${selected ? 'checked' : ''} onchange="dbmToggleStoreSelect(${s.id}, this.checked)">
            </label>
          </div>
          <div class="dbm-store-body">
            <div class="dbm-store-name">${escapeHtml(s.name)} ${s.badge ? `<span class="dbm-store-badge">${escapeHtml(s.badge)}</span>` : ''}</div>
            <div class="dbm-store-line">📍 ${escapeHtml(s.address || '—')}${s.distanceText ? ` • ${escapeHtml(s.distanceText)}` : ''}</div>
            <div class="dbm-store-line">📞 ${escapeHtml(s.phone || '—')} • ⏱️ ${escapeHtml(s.deliveryTime || '')}</div>
            <div class="dbm-store-line">⭐ ${s.rating} (${escapeHtml(s.reviewCount || '')}) • 🚚 ${escapeHtml(s.shippingFee || '')} • ${escapeHtml(s.priceLevel || '')}</div>
            <div class="dbm-store-line"><strong>${count}</strong> mặt hàng • ${escapeHtml(s.category || '')}</div>
            <div class="db-cat-card-actions">
              <button type="button" class="db-act-btn order" onclick="dbmViewStoreItems(${s.id})">${FluentIcons.boxFilled} Xem món</button>
              <button type="button" class="db-act-btn edit" onclick="openItemEditorModal(null, null, { restaurantId: ${s.id} })">+ Món</button>
              <button type="button" class="db-act-btn edit" onclick="dbmOpenAiAuditModal('stores', [${s.id}])" title="AI đánh giá & gợi ý chỉnh sửa nhà hàng này">🤖</button>
              <button type="button" class="db-act-btn edit" onclick="openStoreEditorModal(${s.id})">✏️ Sửa</button>
              ${s.id !== 1000 ? `<button type="button" class="db-act-btn delete" onclick="dbmDeleteStore(${s.id})">🗑️</button>` : ''}
            </div>
          </div>
        </div>`;
  }).join('')}
    </div>`;
}

function renderDbmStoresTab() {
  const stores = DB.getStores();
  return `
    <div class="db-section-toolbar">
      <div>
        <div style="font-size:15px; font-weight:800; color:var(--gray-900);">Cửa hàng & địa điểm (${stores.length})</div>
        <div style="font-size:12px; color:var(--gray-500);">Mỗi mặt hàng thuộc một cửa hàng. Cửa hàng có địa chỉ, phí giao, thời gian giao, đánh giá riêng.</div>
      </div>
      <button type="button" class="db-primary-btn" onclick="openStoreEditorModal()">${FluentIcons.addRegular} Tạo cửa hàng</button>
    </div>

    <div class="db-controls-card" style="margin-bottom:12px;">
      <div class="db-search-row">
        <div class="db-search-input-wrap">
          <span>${FluentIcons.searchRegular}</span>
          <input type="text" placeholder="Tìm nhà hàng theo tên, địa chỉ, danh mục..."
                 value="${escapeHtml(dbmStoreSearchQuery)}"
                 oninput="dbmStoreSearchQuery = this.value; updateCatalogStoresListDOM();">
          ${dbmStoreSearchQuery ? `<button type="button" onclick="dbmStoreSearchQuery=''; renderCatalogManagerView();">✕</button>` : ''}
        </div>
      </div>
    </div>

    <div id="catalog-stores-list-container">${renderDbmStoresGridHtml(getFilteredDbmStores())}</div>`;
}

function updateCatalogStoresListDOM() {
  const el = document.getElementById('catalog-stores-list-container');
  if (el) el.innerHTML = renderDbmStoresGridHtml(getFilteredDbmStores());
  if (typeof updateFloatingTopBar === 'function') updateFloatingTopBar();
}

function dbmToggleStoreSelect(id, checked) {
  const numId = Number(id);
  if (checked) dbmSelectedStoreIds.add(numId);
  else dbmSelectedStoreIds.delete(numId);
  updateCatalogStoresListDOM();
}

function dbmSelectAllVisibleStores(checked) {
  getFilteredDbmStores().forEach(s => {
    const numId = Number(s.id);
    if (checked) dbmSelectedStoreIds.add(numId);
    else dbmSelectedStoreIds.delete(numId);
  });
  updateCatalogStoresListDOM();
}

function dbmClearStoreSelection() {
  dbmSelectedStoreIds.clear();
  updateCatalogStoresListDOM();
}

function dbmBulkStoresFreeship() {
  const ids = [...dbmSelectedStoreIds];
  if (!ids.length) return;
  let updated = 0;
  ids.forEach(id => {
    const st = DB.getStoreById(id);
    if (!st) return;
    const res = DB.saveStore({ ...st, shippingFeeNum: 0 }, st.id);
    if (res.ok) updated++;
  });
  showToast('checkmarkFilled', `Đã đặt Freeship 0đ cho ${updated} nhà hàng`);
  renderCatalogManagerView();
}

function dbmBulkDeleteStores() {
  const ids = [...dbmSelectedStoreIds].filter(id => Number(id) !== 1000);
  if (!ids.length) {
    showToast('alertRegular', 'Gian hàng tự chọn mặc định (ID 1000) không thể xóa!');
    return;
  }
  if (!confirm(`Xóa ${ids.length} nhà hàng đã chọn? Các mặt hàng thuộc những quán này sẽ được chuyển về "Gian hàng tự chọn".`)) return;
  let deleted = 0;
  ids.forEach(id => {
    const res = DB.deleteStore(id);
    if (res.ok) deleted++;
  });
  dbmSelectedStoreIds.clear();
  showToast('deleteRegular', `Đã xóa ${deleted} nhà hàng`);
  renderCatalogManagerView();
}

function dbmViewStoreItems(id) {
  dbmStoreFilter = String(id);
  catalogActiveTab = 'items';
  dbmSelectedIds.clear();
  renderCatalogManagerView();
}

// ─────────────────────────────────────────────────────────────────────────
// MODAL + TAB: MÃ GIẢM GIÁ
// ─────────────────────────────────────────────────────────────────────────

function dbmVoucherSummary(v) {
  let s = v.type === 'percent'
    ? `Giảm ${v.value}%${v.maxDiscount ? ` (tối đa ${formatVND(v.maxDiscount)})` : ''}`
    : v.type === 'fixed' ? `Giảm ${formatVND(v.value)}` : `Trừ phí giao tối đa ${formatVND(v.value)}`;
  if (v.minOrder) s += ` • đơn từ ${formatVND(v.minOrder)}`;
  return s;
}

function renderDbmVouchersTab() {
  const vouchers = DB.getVouchers();
  const items = DB.getItems();
  return `
    <div class="db-section-toolbar">
      <div>
        <div style="font-size:15px; font-weight:800; color:var(--gray-900);">Mã giảm giá (${vouchers.length})</div>
        <div style="font-size:12px; color:var(--gray-500);">Mã <strong>mọi món</strong>: áp dụng cho cả giỏ. Mã <strong>chỉ món được gán</strong>: chỉ giảm trên các món bạn tick trong trình sửa mặt hàng (hoặc nút “Chọn mặt hàng”).</div>
      </div>
      <button type="button" class="db-primary-btn" onclick="openVoucherEditorModal()">${FluentIcons.addRegular} Tạo mã giảm giá</button>
    </div>
    <div class="dbm-voucher-grid">
      ${vouchers.map(v => {
    const code = escapeHtml(v.code);
    const applicable = items.filter(it => (it.vouchers || []).includes(v.code)).length;
    return `
        <div class="dbm-voucher-card ${v.active === false ? 'inactive' : ''}">
          <div class="dbm-voucher-code">${code}</div>
          <div class="dbm-voucher-title">${escapeHtml(v.title)}</div>
          <div class="dbm-voucher-sum">${escapeHtml(dbmVoucherSummary(v))}</div>
          <div class="dbm-voucher-scope">${v.scope === 'all' ? '🌐 Áp dụng mọi mặt hàng' : `📌 Chỉ ${applicable} mặt hàng được gán`}</div>
          <label class="dbm-switch-row">
            <input type="checkbox" ${v.active !== false ? 'checked' : ''} onchange="dbmToggleVoucher('${code}', this.checked)">
            <span>${v.active !== false ? 'Đang hoạt động' : 'Đang tắt'}</span>
          </label>
          <div class="db-cat-card-actions">
            <button type="button" class="db-act-btn edit" onclick="openVoucherEditorModal('${code}')">✏️ Sửa</button>
            <button type="button" class="db-act-btn order" onclick="dbmOpenVoucherItemsModal('${code}')">📌 Chọn mặt hàng</button>
            <button type="button" class="db-act-btn delete" onclick="dbmDeleteVoucher('${code}')">🗑️</button>
          </div>
        </div>`;
  }).join('')}
    </div>`;
}

function dbmToggleVoucher(code, active) {
  const v = DB.findVoucher(code);
  if (!v) return;
  v.active = Boolean(active);
  DB.save('toggle_voucher');
  renderCatalogManagerView();
}

function dbmDeleteVoucher(code) {
  if (!confirm(`Xóa mã "${code}"? Mã cũng sẽ được gỡ khỏi các mặt hàng đang dùng.`)) return;
  DB.deleteVoucher(code);
  showToast('deleteRegular', `Đã xóa mã ${code}`);
  renderCatalogManagerView();
}

function openVoucherEditorModal(code = null) {
  const v = code ? DB.findVoucher(code) : null;
  const type = v ? v.type : 'percent';

  dbmOpenSheet(`
    ${dbmSheetHeader('🎟️', v ? `Sửa mã ${v.code}` : 'Tạo mã giảm giá')}
    <div class="delivery-modal-body dbm-editor-body">
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Mã (*)</label>
          <input type="text" id="vch-code" class="delivery-input-field" style="text-transform:uppercase;" placeholder="SINHVIEN20" value="${escapeHtml(v ? v.code : '')}">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Loại giảm</label>
          <select id="vch-type" class="delivery-input-field" onchange="dbmVoucherTypeChanged()">
            <option value="percent" ${type === 'percent' ? 'selected' : ''}>Giảm theo %</option>
            <option value="fixed" ${type === 'fixed' ? 'selected' : ''}>Giảm số tiền cố định</option>
            <option value="freeship" ${type === 'freeship' ? 'selected' : ''}>Miễn phí giao hàng</option>
          </select>
        </div>
      </div>
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label" id="vch-value-label">Giá trị</label>
          <input type="number" id="vch-value" class="delivery-input-field" min="0" step="1" value="${v ? v.value : 20}">
        </div>
        <div class="delivery-input-group" id="vch-max-wrap">
          <label class="delivery-input-label">Giảm tối đa (VNĐ, 0 = không giới hạn)</label>
          <input type="number" id="vch-max" class="delivery-input-field" min="0" step="1000" value="${v ? v.maxDiscount : 0}">
        </div>
      </div>
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Đơn tối thiểu (VNĐ)</label>
          <input type="number" id="vch-min" class="delivery-input-field" min="0" step="1000" value="${v ? v.minOrder : 0}">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Phạm vi</label>
          <select id="vch-scope" class="delivery-input-field">
            <option value="all" ${(!v || v.scope === 'all') ? 'selected' : ''}>Mọi mặt hàng</option>
            <option value="selected" ${v && v.scope === 'selected' ? 'selected' : ''}>Chỉ mặt hàng được gán</option>
          </select>
        </div>
      </div>
      <div class="delivery-input-group">
        <label class="delivery-input-label">Tiêu đề ngắn</label>
        <input type="text" id="vch-title" class="delivery-input-field" placeholder="VD: Giảm 20% cho sinh viên" value="${escapeHtml(v ? v.title : '')}">
      </div>
      <div class="delivery-input-group">
        <label class="delivery-input-label">Mô tả hiển thị khi áp dụng</label>
        <input type="text" id="vch-desc" class="delivery-input-field" value="${escapeHtml(v ? v.desc : '')}">
      </div>
      <label class="db-checkbox-row"><input type="checkbox" id="vch-active" ${(!v || v.active !== false) ? 'checked' : ''}><span>Đang hoạt động</span></label>
    </div>
    <div class="dbm-editor-footer">
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="dbmSubmitVoucherEditor('${v ? escapeHtml(v.code) : ''}')">${FluentIcons.saveFilled} ${v ? 'Lưu cập nhật' : 'Tạo mã'}</button>
    </div>`);
  dbmVoucherTypeChanged();
}

function dbmVoucherTypeChanged() {
  const type = document.getElementById('vch-type')?.value;
  const label = document.getElementById('vch-value-label');
  const max = document.getElementById('vch-max-wrap');
  if (label) label.textContent = type === 'percent' ? 'Giảm (%)' : type === 'fixed' ? 'Số tiền giảm (VNĐ)' : 'Trừ phí giao tối đa (VNĐ)';
  if (max) max.style.display = type === 'percent' ? '' : 'none';
}

function dbmSubmitVoucherEditor(originalCode) {
  const val = id => (document.getElementById(id)?.value ?? '');
  const res = DB.saveVoucher({
    code: val('vch-code'),
    type: val('vch-type'),
    value: val('vch-value'),
    maxDiscount: val('vch-max'),
    minOrder: val('vch-min'),
    scope: val('vch-scope'),
    title: val('vch-title'),
    desc: val('vch-desc'),
    active: document.getElementById('vch-active')?.checked !== false
  }, originalCode || null);

  if (!res.ok) { showToast('alertRegular', res.message); return; }
  closeModal();
  showToast('checkmarkFilled', `Đã lưu mã ${res.voucher.code}`);
  renderCatalogManagerView();
  if (res.voucher.scope === 'selected' && !originalCode) {
    setTimeout(() => dbmOpenVoucherItemsModal(res.voucher.code), 250);
  }
}

function dbmOpenVoucherItemsModal(code) {
  const current = DB.getItems().filter(it => (it.vouchers || []).includes(code)).map(it => it.id);
  dbmChk = { selected: new Set(current), query: '', onlyMissing: false, onConfirm: null };
  dbmOpenSheet(`
    ${dbmSheetHeader('📌', `Mặt hàng áp dụng mã ${code}`)}
    <div class="delivery-modal-body dbm-editor-body">
      <div class="dbm-hint">Tick các mặt hàng có thể dùng mã <strong>${escapeHtml(code)}</strong> (<span class="dbm-chk-count">${dbmChk.selected.size}</span> đã chọn).</div>
      ${dbmChecklistHtml(false)}
    </div>
    <div class="dbm-editor-footer">
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="dbmSaveVoucherItems('${escapeHtml(code)}')">${FluentIcons.saveFilled} Lưu danh sách áp dụng</button>
    </div>`);
}

function dbmSaveVoucherItems(code) {
  const all = DB.getItems().map(it => it.id);
  const on = all.filter(id => dbmChk.selected.has(id));
  const off = all.filter(id => !dbmChk.selected.has(id));
  if (on.length) DB.bulkUpdateItems(on, { addVouchers: [code] });
  if (off.length) DB.bulkUpdateItems(off, { removeVouchers: [code] });
  closeModal();
  showToast('checkmarkFilled', `Mã ${code} áp dụng cho ${on.length} mặt hàng`);
  renderCatalogManagerView();
}

