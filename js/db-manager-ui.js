/* ==========================================================================
   ptitngon - Database Manager UI (js/db-manager-ui.js)
   Thay thế giao diện "Quản Lý Mặt Hàng & Database" bằng trình quản lý đầy đủ:
   Mặt hàng • Cửa hàng • Danh mục • Mã giảm giá • Thư viện ảnh • AI tạo hàng • File JSON
   Tải SAU catalog-profile.js (ghi đè các hàm cùng tên).
   ========================================================================== */

let dbmSelectedIds = new Set();
let dbmStoreFilter = 'all';
let dbmTagFilter = '';
let dbmHealthyFilter = 'all';
let dbmMissingImageOnly = false;
let dbmSortBy = 'newest';

// ─────────────────────────────────────────────────────────────────────────
// Tiện ích giao diện dùng chung
// ─────────────────────────────────────────────────────────────────────────

function dbmOpenSheet(html) {
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return false;
  sheet.classList.add('dbm-wide-sheet');
  sheet.innerHTML = `<div class="dbm-modal-shell">${html}</div>`;
  overlay.classList.add('active');
  return true;
}

(function dbmWrapCloseModal() {
  if (typeof window.closeModal !== 'function' || window.__dbmCloseWrapped) return;
  const origClose = window.closeModal;
  window.closeModal = function (...args) {
    const out = origClose.apply(this, args);
    setTimeout(() => {
      const overlay = document.getElementById('modal-overlay');
      const sheet = document.getElementById('modal-bottom-sheet');
      if (sheet && overlay && !overlay.classList.contains('active')) {
        sheet.classList.remove('dbm-wide-sheet');
      }
    }, 320);
    return out;
  };
  window.__dbmCloseWrapped = true;
})();

function dbmSheetHeader(icon, title, extraActionsHtml = '') {
  return `
    <div class="delivery-modal-header dbm-modal-header">
      <div class="delivery-modal-title"><span>${icon}</span><span>${escapeHtml(title)}</span></div>
      <div class="dbm-modal-header-actions">
        ${extraActionsHtml}
        <button type="button" class="dbm-close-btn" onclick="closeModal()" title="Đóng">${FluentIcons.dismiss}</button>
      </div>
    </div>`;
}

function dbmToggleAllSections(btn) {
  const sections = Array.from(document.querySelectorAll('#modal-bottom-sheet details.dbm-section'));
  if (!sections.length) return;
  const anyClosed = sections.some(d => !d.open);
  sections.forEach((d, idx) => { d.open = anyClosed ? true : idx < 2; });
  if (btn) btn.textContent = anyClosed ? '↕ Thu gọn bớt' : '↕ Mở rộng tất cả';
}

function dbmRefreshManager() {
  if (currentView === 'catalog') renderCatalogManagerView();
  else render();
}

function dbmThumb(src, alt = '') {
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">`;
}

// ── Vùng thả ảnh dùng chung ──
const dbmDropHandlers = {};

function dbmDropzoneHtml(key, label, { multiple = true, compact = false } = {}) {
  return `
    <div class="dbm-dropzone ${compact ? 'compact' : ''}"
         ondragover="dbmDzOver(event)" ondragleave="dbmDzLeave(event)"
         ondrop="dbmDzDrop(event, '${key}')"
         onclick="this.querySelector('input').click()">
      <input type="file" accept="image/*" ${multiple ? 'multiple' : ''} style="display:none;"
             onclick="event.stopPropagation()" onchange="dbmDzPick(event, '${key}')">
      <div class="dbm-dropzone-icon">${FluentIcons.imageFilled}</div>
      <div class="dbm-dropzone-text">${label}</div>
    </div>`;
}

function dbmDzOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function dbmDzLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function dbmDzDrop(e, key) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  const dropped = dbmExtractDroppedImages(e.dataTransfer);
  if (dropped.files.length === 0 && dropped.urls.length === 0) {
    showToast('alertRegular', 'Hãy thả file ảnh (jpg, png, webp...)');
    return;
  }
  if (dbmDropHandlers[key]) await dbmDropHandlers[key](dropped);
}

async function dbmDzPick(e, key) {
  const files = Array.from(e.target.files || []).filter(f => /^image\//.test(f.type));
  e.target.value = '';
  if (files.length === 0) return;
  if (dbmDropHandlers[key]) await dbmDropHandlers[key]({ files, urls: [] });
}

// Nhập danh sách ảnh đã thả -> mảng {src,name}
async function dbmImportDropped(dropped) {
  const out = [];
  for (const f of dropped.files) {
    try { out.push(await dbmImportImageFile(f)); } catch (_) { /* bỏ qua file lỗi */ }
  }
  dropped.urls.forEach(u => out.push({ src: u, name: 'Ảnh từ web' }));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Khung chính
// ─────────────────────────────────────────────────────────────────────────

function renderCatalogManagerView() {
  const prevSubtabsEl = document.getElementById('dbm-subtabs-scroll');
  const prevSubtabsScrollLeft = prevSubtabsEl ? prevSubtabsEl.scrollLeft : 0;

  const cats = DB.getCategories();
  const items = DB.getItems();
  const stores = DB.getStores();
  const vouchers = DB.getVouchers();
  const lib = DB.getLibraryImages();
  const missingImages = items.filter(dbmIsPlaceholderImage).length;
  const aiPending = typeof dbmAiPendingReviewCount === 'function' ? dbmAiPendingReviewCount() : 0;

  const syncLabel = DB.fileSyncStatus === 'file-linked'
    ? `🔗 Đang ghi trực tiếp: ${DB.linkedFileName}`
    : DB.fileSyncStatus === 'server-api'
      ? '🟢 Đang đồng bộ trực tiếp database.json'
      : `${FluentIcons.saveFilled} Đã lưu tự động`;

  const tabs = [
    ['items', `${FluentIcons.boxFilled}`, 'Mặt hàng', items.length],
    ['stores', `${FluentIcons.shop}`, 'Cửa hàng', stores.length],
    ['categories', `${FluentIcons.tagFilled}`, 'Danh mục', cats.length],
    ['vouchers', `${FluentIcons.ticketHorizontalFilled}`, 'Mã giảm giá', vouchers.length],
    ['images', `${FluentIcons.imageFilled}`, 'Thư viện ảnh', lib.length],
    ['ai', `${FluentIcons.sparkleFilled}`, 'AI tạo hàng', aiPending || ''],
    ['database', '🗄️', 'File .JSON', '']
  ];

  app.innerHTML = `
    <div class="catalog-view-container dbm-container fade-in">
      <div class="page-nav-header">
        <button type="button" class="page-back-icon-btn" onclick="window.goBack()" title="Quay lại" aria-label="Quay lại">${FluentIcons.arrowLeft}</button>
        <div class="page-nav-title">Quản Lý Cơ Sở Dữ Liệu</div>
        <button type="button" class="db-quick-export-btn" onclick="DB.exportJsonFile(); showToast('checkmarkFilled', 'Đã xuất file database.json!')" title="Tải xuống file database.json">⬇️ .JSON</button>
      </div>

      <div class="db-hero-banner">
        <div class="db-hero-top">
          <div>
            <div class="db-hero-badge">${syncLabel}</div>
            <div class="db-hero-title">Mặt hàng • Cửa hàng • Danh mục • Mã giảm giá</div>
            <div class="db-hero-sub">Tạo thủ công hoặc nhờ AI tạo hàng loạt — mọi thay đổi lưu </div>
          </div>
          <div class="db-hero-actions">
            <button type="button" class="db-btn-white" onclick="switchCatalogTab('ai')">✨ AI tạo hàng</button>
            <button type="button" class="db-btn-accent" onclick="openItemEditorModal(null, catalogCategoryFilter !== 'all' ? catalogCategoryFilter : null)">➕ Thêm mặt hàng</button>
          </div>
        </div>
        <div class="db-stats-grid">
          <div class="db-stat-box" onclick="switchCatalogTab('items')">
            <div class="db-stat-num">${items.length}</div>
            <div class="db-stat-label">Mặt hàng (${items.filter(i => i.inStock === false).length} tạm hết)</div>
          </div>
          <div class="db-stat-box" onclick="dbmShowMissingImages()">
            <div class="db-stat-num">${missingImages}</div>
            <div class="db-stat-label">Mặt hàng chưa có ảnh thật</div>
          </div>
          <div class="db-stat-box" onclick="switchCatalogTab('stores')">
            <div class="db-stat-num">${stores.length}</div>
            <div class="db-stat-label">Cửa hàng / địa điểm</div>
          </div>
          <div class="db-stat-box" onclick="switchCatalogTab('categories')">
            <div class="db-stat-num">${cats.length}</div>
            <div class="db-stat-label">Danh mục (${cats.filter(c => c.type === 'tag').length} theo tag)</div>
          </div>
        </div>
      </div>

      <div class="dbm-subtabs-nav-wrap">
        <button type="button" class="scroll-arrow-btn small dbm-subtab-arrow" onclick="scrollHorizontally('dbm-subtabs-scroll', -220)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
          ${FluentIcons.chevronLeft}
        </button>
        <div class="db-subtabs-bar" id="dbm-subtabs-scroll">
          ${tabs.map(([key, icon, label, count]) => `
            <button type="button" class="db-subtab-btn ${catalogActiveTab === key ? 'active' : ''}" onclick="switchCatalogTab('${key}')">
              ${icon} ${label}${count !== '' ? ` (${count})` : ''}
            </button>`).join('')}
        </div>
        <button type="button" class="scroll-arrow-btn small dbm-subtab-arrow" onclick="scrollHorizontally('dbm-subtabs-scroll', 220)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
          ${FluentIcons.chevronRight}
        </button>
      </div>

      <div class="db-tab-body">
        ${catalogActiveTab === 'items' ? renderDbmItemsTab(cats) : ''}
        ${catalogActiveTab === 'stores' ? renderDbmStoresTab() : ''}
        ${catalogActiveTab === 'categories' ? renderDbmCategoriesTab() : ''}
        ${catalogActiveTab === 'vouchers' ? renderDbmVouchersTab() : ''}
        ${catalogActiveTab === 'images' ? renderDbmImagesTab() : ''}
        ${catalogActiveTab === 'ai' ? (typeof renderDbmAITab === 'function' ? renderDbmAITab() : '') : ''}
        ${catalogActiveTab === 'database' ? renderCatalogDatabaseTab() : ''}
      </div>
      <div class="bottom-spacer"></div>
    </div>`;

  const nextSubtabsEl = document.getElementById('dbm-subtabs-scroll');
  if (nextSubtabsEl && prevSubtabsScrollLeft > 0) {
    nextSubtabsEl.scrollLeft = prevSubtabsScrollLeft;
  }

  if (catalogActiveTab === 'images') dbmBindLibraryDropzone();
  if (catalogActiveTab === 'ai' && typeof dbmAiAfterRender === 'function') dbmAiAfterRender();
}

function switchCatalogTab(tab) {
  catalogActiveTab = tab;
  renderCatalogManagerView();
}

function dbmShowMissingImages() {
  catalogActiveTab = 'items';
  dbmMissingImageOnly = true;
  renderCatalogManagerView();
}

// ─────────────────────────────────────────────────────────────────────────
// TAB: MẶT HÀNG
// ─────────────────────────────────────────────────────────────────────────

function getFilteredCatalogItems() {
  let list = [...DB.getItems()];

  if (catalogCategoryFilter && catalogCategoryFilter !== 'all') {
    const cat = DB.getCategoryById(catalogCategoryFilter) || DB.getCategories().find(c => c.name === catalogCategoryFilter);
    list = list.filter(it => (cat && cat.type === 'tag')
      ? dbmItemMatchesTagRule(it, cat.tagRule)
      : (it.categoryId === catalogCategoryFilter || it.category === catalogCategoryFilter));
  }
  if (dbmStoreFilter !== 'all') {
    list = list.filter(it => String(it.restaurantId) === String(dbmStoreFilter));
  }
  if (dbmTagFilter) {
    list = list.filter(it => (it.tags || []).includes(dbmTagFilter));
  }
  if (catalogStatusFilter === 'custom') list = list.filter(it => it.isCustom);
  else if (catalogStatusFilter === 'instock') list = list.filter(it => it.inStock !== false);
  else if (catalogStatusFilter === 'outofstock') list = list.filter(it => it.inStock === false);
  else if (catalogStatusFilter === 'ai') list = list.filter(it => it.isAIGenerated);

  if (dbmMissingImageOnly) list = list.filter(dbmIsPlaceholderImage);
  if (dbmHealthyFilter === 'high') list = list.filter(it => dbmGetItemHealthy(it).score >= 8.0);
  else if (dbmHealthyFilter === 'moderate') list = list.filter(it => { const s = dbmGetItemHealthy(it).score; return s >= 6.5 && s < 8.0; });
  else if (dbmHealthyFilter === 'low') list = list.filter(it => dbmGetItemHealthy(it).score < 6.5);

  if (catalogSearchQuery.trim()) {
    const q = dbmNormText(catalogSearchQuery);
    list = list.filter(it =>
      dbmNormText(it.name).includes(q) ||
      dbmNormText(it.sku).includes(q) ||
      dbmNormText(it.category).includes(q) ||
      dbmNormText(it.restaurantName).includes(q) ||
      dbmNormText(it.location).includes(q) ||
      dbmNormText(it.healthyLevel).includes(q) ||
      (it.tags || []).some(t => dbmNormText(t).includes(q)));
  }

  if (dbmSortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  else if (dbmSortBy === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (dbmSortBy === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (dbmSortBy === 'sold') list.sort((a, b) => (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0));
  else if (dbmSortBy === 'healthy-desc') list.sort((a, b) => dbmGetItemHealthy(b).score - dbmGetItemHealthy(a).score);
  else if (dbmSortBy === 'healthy-asc') list.sort((a, b) => dbmGetItemHealthy(a).score - dbmGetItemHealthy(b).score);
  return list;
}

function renderDbmItemsTab(allCats) {
  const stores = DB.getStores();
  const topTags = DB.getAllTags().slice(0, 40);
  const allItems = DB.getItems();
  const missingCount = allItems.filter(dbmIsPlaceholderImage).length;
  const highHealthyCount = allItems.filter(it => dbmGetItemHealthy(it).score >= 8.0).length;
  const chip = (cond, handler, label) =>
    `<button type="button" class="db-chip ${cond ? 'active' : ''}" onclick="${handler}">${label}</button>`;

  return `
    <div class="db-controls-card">
      <div class="db-search-row">
        <div class="db-search-input-wrap">
          <span>${FluentIcons.searchRegular}</span>
          <input type="text" placeholder="Tìm theo tên, mã SP, tag, danh mục, cửa hàng, nhận xét healthy..."
                 value="${escapeHtml(catalogSearchQuery)}"
                 oninput="catalogSearchQuery = this.value; updateCatalogItemsListDOM();">
          ${catalogSearchQuery ? `<button type="button" onclick="catalogSearchQuery=''; renderCatalogManagerView();">✕</button>` : ''}
        </div>
      </div>
      <div class="dbm-filter-row">
        <select class="db-select-box" onchange="catalogCategoryFilter = this.value; dbmSelectedIds.clear(); renderCatalogManagerView();">
          <option value="all">Tất cả danh mục (${allCats.length})</option>
          ${allCats.map(c => `
            <option value="${escapeHtml(c.id)}" ${(catalogCategoryFilter === c.id || catalogCategoryFilter === c.name) ? 'selected' : ''}>
              ${c.icon} ${c.type === 'tag' ? '# ' : ''}${escapeHtml(c.name)}
            </option>`).join('')}
        </select>
        <select class="db-select-box" onchange="dbmStoreFilter = this.value; renderCatalogManagerView();">
          <option value="all">Tất cả cửa hàng (${stores.length})</option>
          ${stores.map(s => `<option value="${s.id}" ${String(dbmStoreFilter) === String(s.id) ? 'selected' : ''}>🏪 ${escapeHtml(s.name)}</option>`).join('')}
        </select>
        <select class="db-select-box" onchange="dbmTagFilter = this.value; renderCatalogManagerView();">
          <option value="">Mọi tag</option>
          ${topTags.map(t => `<option value="${escapeHtml(t.tag)}" ${dbmTagFilter === t.tag ? 'selected' : ''}># ${escapeHtml(t.tag)} (${t.count})</option>`).join('')}
        </select>
        <select class="db-select-box" onchange="dbmSortBy = this.value; updateCatalogItemsListDOM();">
          <option value="newest" ${dbmSortBy === 'newest' ? 'selected' : ''}>Mới nhất</option>
          <option value="name" ${dbmSortBy === 'name' ? 'selected' : ''}>Tên A → Z</option>
          <option value="price-asc" ${dbmSortBy === 'price-asc' ? 'selected' : ''}>Giá tăng dần</option>
          <option value="price-desc" ${dbmSortBy === 'price-desc' ? 'selected' : ''}>Giá giảm dần</option>
          <option value="sold" ${dbmSortBy === 'sold' ? 'selected' : ''}>Bán chạy nhất</option>
          <option value="healthy-desc" ${dbmSortBy === 'healthy-desc' ? 'selected' : ''}>🥗 Healthy cao → thấp</option>
          <option value="healthy-asc" ${dbmSortBy === 'healthy-asc' ? 'selected' : ''}>Healthy thấp → cao</option>
        </select>
      </div>
      <div class="db-filter-chips-row">
        ${chip(catalogStatusFilter === 'all' && dbmHealthyFilter === 'all', "catalogStatusFilter='all'; dbmHealthyFilter='all'; renderCatalogManagerView();", 'Tất cả')}
        ${chip(catalogStatusFilter === 'custom', "catalogStatusFilter='custom'; renderCatalogManagerView();", '✨ Do bạn thêm')}
        ${chip(catalogStatusFilter === 'ai', "catalogStatusFilter='ai'; renderCatalogManagerView();", '🤖 AI tạo')}
        ${chip(dbmHealthyFilter === 'high', "dbmHealthyFilter = dbmHealthyFilter === 'high' ? 'all' : 'high'; renderCatalogManagerView();", `🥗 Healthy tốt ≥8.0 (${highHealthyCount})`)}
        ${chip(dbmHealthyFilter === 'moderate', "dbmHealthyFilter = dbmHealthyFilter === 'moderate' ? 'all' : 'moderate'; renderCatalogManagerView();", '⚖️ Vừa phải (6.5–7.9)')}
        ${chip(dbmHealthyFilter === 'low', "dbmHealthyFilter = dbmHealthyFilter === 'low' ? 'all' : 'low'; renderCatalogManagerView();", '🍟 Ăn điều độ (<6.5)')}
        ${chip(catalogStatusFilter === 'instock', "catalogStatusFilter='instock'; renderCatalogManagerView();", '✅ Đang bán')}
        ${chip(catalogStatusFilter === 'outofstock', "catalogStatusFilter='outofstock'; renderCatalogManagerView();", '⛔ Tạm hết')}
        ${chip(dbmMissingImageOnly, 'dbmMissingImageOnly = !dbmMissingImageOnly; renderCatalogManagerView();', `${FluentIcons.imageFilled} Thiếu ảnh (${missingCount})`)}
        ${(dbmTagFilter || dbmStoreFilter !== 'all' || catalogCategoryFilter !== 'all' || catalogStatusFilter !== 'all' || dbmHealthyFilter !== 'all' || dbmMissingImageOnly || catalogSearchQuery)
      ? `<button type="button" class="db-chip" onclick="dbmResetItemFilters()">↺ Xóa lọc</button>` : ''}
      </div>
    </div>
    <div id="catalog-items-list-container">${renderCatalogItemsGridHtml(getFilteredCatalogItems())}</div>`;
}

function dbmResetItemFilters() {
  catalogSearchQuery = '';
  catalogCategoryFilter = 'all';
  catalogStatusFilter = 'all';
  dbmStoreFilter = 'all';
  dbmTagFilter = '';
  dbmHealthyFilter = 'all';
  dbmMissingImageOnly = false;
  renderCatalogManagerView();
}

function renderDbmBulkBar(visibleList) {
  const n = dbmSelectedIds.size;
  const allVisibleSelected = visibleList.length > 0 && visibleList.every(it => dbmSelectedIds.has(it.id));
  if (n > 0) {
    return `
      <div class="dbm-bulk-bar active" role="region" aria-label="Thanh công cụ mặt hàng đã chọn">
        <div class="dbm-bulk-bar-inner">
          <div class="dbm-bulk-top-row">
            <div class="dbm-bulk-left">
              <label class="dbm-bulk-selectall">
                <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisible(this.checked)">
                <span>Đã chọn <strong>${n}</strong> mặt hàng</span>
              </label>
            </div>
            <div class="dbm-bulk-top-actions">
              <button type="button" class="danger" onclick="dbmBulkDelete()" title="Xóa các món đã chọn">${FluentIcons.deleteRegular} Xóa</button>
              <button type="button" class="dbm-bulk-clear-btn" onclick="dbmSelectedIds.clear(); updateCatalogItemsListDOM();" title="Bỏ chọn tất cả">✕ Bỏ chọn</button>
            </div>
          </div>
          <div class="dbm-bulk-actions">
            <button type="button" class="ai-audit-btn" onclick="dbmOpenAiAuditModal('items')" title="Dùng AI đánh giá các món đã chọn cần điều chỉnh gì">🤖 AI đánh giá (${n})</button>
            <button type="button" onclick="dbmOpenBulkGoogleImageModal()" title="Tự tìm & chèn ảnh Google #1 hoặc #2 cho các mặt hàng đã chọn">🔍 Ảnh Google</button>
            <button type="button" onclick="openAssignImageModal({ preselectIds: [...dbmSelectedIds] })">${FluentIcons.imageFilled} Gán ảnh</button>
            <button type="button" onclick="dbmOpenBulkModal('healthy')" title="Tự đánh giá lại hoặc gán điểm Healthy cho các mặt hàng đã chọn">🥗 Healthy</button>
            <button type="button" onclick="dbmOpenBulkModal('category')">🏷️ Danh mục</button>
            <button type="button" onclick="dbmOpenBulkModal('store')">🏪 Cửa hàng</button>
            <button type="button" onclick="dbmOpenBulkModal('tags')"># Tag</button>
            <button type="button" onclick="dbmOpenBulkModal('vouchers')">🎟️ Mã giảm</button>
            <button type="button" onclick="dbmBulkStock(true)">✅ Mở bán</button>
            <button type="button" onclick="dbmBulkStock(false)">⛔ Tạm hết</button>
          </div>
        </div>
      </div>
      <div class="dbm-bulk-inline-status">
        <label class="dbm-bulk-selectall">
          <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisible(this.checked)">
          <span>Đang chọn <strong>${n}</strong> mặt hàng — thao tác nhanh trên thanh công cụ trên cùng</span>
        </label>
        <div style="display:flex; align-items:center; gap:10px;">
          <button type="button" class="db-inline-link-btn" onclick="dbmOpenAiAuditModal('items')">🤖 AI đánh giá (${n})</button>
          <button type="button" class="db-inline-link-btn" onclick="dbmSelectedIds.clear(); updateCatalogItemsListDOM();">Bỏ chọn</button>
        </div>
      </div>`;
  }
  return `
    <div class="dbm-bulk-bar">
      <label class="dbm-bulk-selectall">
        <input type="checkbox" ${allVisibleSelected ? 'checked' : ''} onchange="dbmSelectAllVisible(this.checked)">
        <span>Chọn tất cả đang hiện</span>
      </label>
      <span class="dbm-bulk-hint">Tip: tick chọn nhiều món để dùng <strong>🤖 AI đánh giá cần điều chỉnh gì</strong> hoặc thả ảnh lên thẻ để đổi nhanh</span>
      ${visibleList.length > 0 ? `<button type="button" class="db-inline-link-btn" onclick="dbmOpenAiAuditModal('items')">🤖 AI rà soát nhanh</button>` : ''}
    </div>`;
}

function renderCatalogItemsGridHtml(itemsList) {
  const bulk = renderDbmBulkBar(itemsList);
  if (itemsList.length === 0) {
    return `${bulk}
      <div class="search-empty-state" style="padding: 48px 20px;">
        <div class="search-empty-icon">${FluentIcons.boxFilled}</div>
        <div class="search-empty-title">Chưa có mặt hàng nào khớp bộ lọc</div>
        <div class="search-empty-sub">Thêm mặt hàng mới, nhờ AI tạo giúp hoặc đặt lại bộ lọc.</div>
        <div style="display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap;">
          <button type="button" class="db-primary-btn" onclick="openItemEditorModal(null, catalogCategoryFilter !== 'all' ? catalogCategoryFilter : null)">➕ Thêm mặt hàng mới</button>
          <button type="button" class="db-secondary-btn" onclick="switchCatalogTab('ai')">✨ Nhờ AI tạo</button>
          <button type="button" class="db-secondary-btn" onclick="dbmResetItemFilters()">Xem tất cả</button>
        </div>
      </div>`;
  }

  return `${bulk}
    <div class="db-results-count">Hiển thị <strong>${itemsList.length}</strong> mặt hàng</div>
    <div class="db-items-grid">
      ${itemsList.map(item => {
    const catObj = DB.getCategoryById(item.categoryId);
    const isOut = item.inStock === false;
    const noImg = dbmIsPlaceholderImage(item);
    const selected = dbmSelectedIds.has(item.id);
    const id = escapeHtml(item.id);
    const tags = (item.tags || []).slice(0, 4);
    const sold = Number(item.soldCount);
    const hInfo = dbmGetItemHealthy(item);
    const kcal = Number(item.nutrition?.calories);
    return `
          <div class="db-item-card dbm-item-card ${isOut ? 'out-of-stock' : ''} ${selected ? 'selected' : ''}"
               ondragover="dbmCardDragOver(event)" ondragleave="dbmCardDragLeave(event)" ondrop="dbmCardDrop(event, '${id}')">
            <div class="db-item-img-wrap">
              ${dbmThumb(item.image, item.name)}
              <label class="dbm-card-check" onclick="event.stopPropagation()">
                <input type="checkbox" ${selected ? 'checked' : ''} onchange="dbmToggleSelect('${id}', this.checked)">
              </label>
              <span class="db-item-sku">${escapeHtml(item.sku || 'SP')}</span>
              ${item.isAIGenerated ? `<span class="db-item-custom-badge">🤖 AI</span>` : (item.isCustom ? `<span class="db-item-custom-badge">Tùy chỉnh ✨</span>` : '')}
              ${noImg ? `<span class="dbm-noimg-badge" title="Thả ảnh vào thẻ này để thay">Chưa có ảnh</span>` : ''}
              ${isOut ? `<span class="db-item-out-overlay">TẠM HẾT</span>` : ''}
              <div class="dbm-drop-hint">Thả ảnh để đổi</div>
            </div>
            <div class="db-item-body">
              <div class="db-item-cat-row">
                <span class="db-cat-pill" onclick="catalogCategoryFilter='${escapeHtml(item.categoryId)}'; renderCatalogManagerView();">
                  ${catObj ? catObj.icon : '🍽️'} ${escapeHtml(item.category)}
                </span>
                <button type="button" class="db-stock-toggle ${isOut ? 'off' : 'on'}" onclick="handleToggleItemStock('${id}')" title="Đổi trạng thái Còn hàng / Hết hàng">
                  ${isOut ? '⛔ Tạm hết' : '✅ Còn hàng'}
                </button>
              </div>
              <div class="db-item-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
              <div class="db-item-shop">🏪 ${escapeHtml(item.restaurantName || 'Gian Hàng PTIT')}</div>
              ${item.location ? `<div class="dbm-item-loc" title="${escapeHtml(item.location)}">📍 ${escapeHtml(item.location)}</div>` : ''}
              <div class="db-item-price-row">
                <span class="db-item-price">${formatVND(item.price)}</span>
                <span class="db-item-meta-small">
                  ${Number(item.rating) > 0 ? `⭐ ${Number(item.rating).toFixed(1)} • ` : ''}${Number.isFinite(sold) ? `Đã bán ${sold.toLocaleString('vi-VN')}` : `${item.sizes?.length || 1} cỡ • ${item.toppings?.length || 0} topping`}
                </span>
              </div>
              <div class="dbm-item-healthy-row" title="${escapeHtml(hInfo.level)} — bấm để sửa đánh giá Healthy" onclick="openItemEditorModal('${id}')">
                <span class="dbm-healthy-pill ${hInfo.tier}">🥗 ${hInfo.score}/10</span>
                <span class="dbm-item-healthy-note">${escapeHtml(hInfo.level)}</span>
                ${Number.isFinite(kcal) && kcal > 0 ? `<span class="dbm-item-kcal">🔥 ${Math.round(kcal)} kcal</span>` : ''}
              </div>
              ${tags.length ? `<div class="dbm-tag-row">${tags.map(t => `<span class="dbm-tag-chip" onclick="dbmTagFilter='${escapeHtml(t)}'; renderCatalogManagerView();">#${escapeHtml(t)}</span>`).join('')}${(item.tags || []).length > 4 ? `<span class="dbm-tag-more">+${item.tags.length - 4}</span>` : ''}</div>` : ''}
              ${(item.vouchers || []).length ? `<div class="dbm-voucher-row">🎟️ ${(item.vouchers).map(c => escapeHtml(c)).join(' • ')}</div>` : ''}
              <div class="db-item-actions">
                <button type="button" class="db-act-btn order" onclick="orderItemDirectlyById('${id}')" ${isOut ? 'disabled' : ''}>🛒 Đặt</button>
                <button type="button" class="db-act-btn edit" onclick="openItemEditorModal('${id}')">✏️ Sửa</button>
                <button type="button" class="db-act-btn edit" onclick="dbmOpenAiAuditModal('items', ['${id}'])" title="AI đánh giá & gợi ý chỉnh sửa món này">🤖</button>
                <button type="button" class="db-act-btn edit" onclick="dbmQuickGoogleImageForCard('${id}')" title="Tự lấy ảnh Google (#1 → #2 → #3)">🔍</button>
                <button type="button" class="db-act-btn edit" onclick="dbmDuplicateItem('${id}')" title="Nhân bản">⧉</button>
                <button type="button" class="db-act-btn delete" onclick="handleDeleteItem('${id}')">🗑️</button>
              </div>
            </div>
          </div>`;
  }).join('')}
    </div>`;
}

function updateCatalogItemsListDOM() {
  const container = document.getElementById('catalog-items-list-container');
  if (container) container.innerHTML = renderCatalogItemsGridHtml(getFilteredCatalogItems());
  if (typeof updateFloatingTopBar === 'function') updateFloatingTopBar();
}

function dbmToggleSelect(id, checked) {
  if (checked) dbmSelectedIds.add(id); else dbmSelectedIds.delete(id);
  updateCatalogItemsListDOM();
}

function dbmSelectAllVisible(checked) {
  getFilteredCatalogItems().forEach(it => { if (checked) dbmSelectedIds.add(it.id); else dbmSelectedIds.delete(it.id); });
  updateCatalogItemsListDOM();
}

function dbmDuplicateItem(itemId) {
  const it = DB.getItemById(itemId);
  if (!it) return;
  const copy = JSON.parse(JSON.stringify(it));
  const res = DB.saveItem({
    ...copy,
    name: `${it.name} (bản sao)`,
    image: it.image,
    imageIsPlaceholder: it.imageIsPlaceholder,
    noteSuggestions: it.noteSuggestions,
    soldCount: null
  });
  if (res.ok) {
    showToast('checkmarkFilled', `Đã nhân bản "${it.name}"`);
    dbmRefreshManager();
  } else showToast('alertRegular', res.message);
}

// Chặn lỗi thao tác sau khi xóa: giữ lựa chọn chỉ còn các id còn tồn tại
function dbmPruneSelection() {
  const alive = new Set(DB.getItems().map(i => i.id));
  dbmSelectedIds.forEach(id => { if (!alive.has(id)) dbmSelectedIds.delete(id); });
}

function handleDeleteItem(itemId) {
  const item = DB.getItemById(itemId);
  if (!item) return;
  if (!confirm(`Xóa  mặt hàng "${item.name}" khỏi Database?`)) return;
  const res = DB.deleteItem(itemId);
  if (res.ok) {
    dbmPruneSelection();
    showToast('deleteRegular', `Đã xóa "${item.name}"`);
    dbmRefreshManager();
  }
}

// ── Kéo thả ảnh lên thẻ mặt hàng ──
function dbmCardDragOver(e) {
  if (!Array.from(e.dataTransfer?.types || []).some(t => t === 'Files' || t === 'text/uri-list')) return;
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function dbmCardDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function dbmCardDrop(e, itemId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const dropped = dbmExtractDroppedImages(e.dataTransfer);
  if (dropped.files.length === 0 && dropped.urls.length === 0) return;

  const targets = (dbmSelectedIds.has(itemId) && dbmSelectedIds.size > 1) ? [...dbmSelectedIds] : [itemId];
  showToast('sparkleRegular', 'Đang xử lý ảnh...');
  const imported = await dbmImportDropped(dropped);
  if (imported.length === 0) {
    showToast('alertRegular', 'Không đọc được ảnh vừa thả');
    return;
  }
  imported.forEach(img => DB.addLibraryImage(img));
  const res = DB.bulkUpdateItems(targets, { image: imported[0].src });
  if (res.ok) {
    showToast('checkmarkFilled', `Đã gán ảnh cho ${res.count} mặt hàng${imported.length > 1 ? ` (${imported.length - 1} ảnh còn lại đã vào Thư viện)` : ''}`);
    dbmRefreshManager();
  }
}

const dbmCardGoogleRankCursor = new Map();
let dbmCardGoogleBusy = false;

async function dbmQuickGoogleImageForCard(itemId) {
  if (dbmCardGoogleBusy) return;
  const item = DB.getItemById(itemId);
  if (!item) return;
  const nextRank = ((dbmCardGoogleRankCursor.get(itemId) || 0) % 6) + 1;
  dbmCardGoogleBusy = true;
  showToast('sparkleRegular', `⚡ Đang tìm ảnh đồ ăn #${nextRank} cho "${item.name}"...`);
  try {
    const suffix = (dbmLoadPrefs().ai || {}).googleSuffix ?? 'món ăn';
    const query = dbmBuildFoodImageQuery(item.name, suffix, item.category || '');
    const res = await dbmSearchGoogleImages(query, {
      limit: 6,
      autoDownload: true,
      preferredRank: nextRank,
      name: item.name,
      category: item.category || ''
    });
    const src = res.localPath || res.originalUrl;
    if (!src) throw new Error('Không tìm được ảnh phù hợp');
    dbmCardGoogleRankCursor.set(itemId, nextRank);
    DB.addLibraryImage({ name: item.name, src });
    DB.bulkUpdateItems([itemId], { image: src });
    const srcLabel = typeof dbmImageSourceLabel === 'function' ? dbmImageSourceLabel(res.source) : 'Đa nguồn';
    showToast('checkmarkFilled', `Đã chèn ảnh #${res.pickedRank || nextRank} (${srcLabel}) cho "${item.name}" (bấm 🔍 lần nữa để đổi ảnh kế tiếp)`);
    dbmRefreshManager();
  } catch (err) {
    showToast('alertRegular', err.message || 'Không lấy được ảnh');
  } finally {
    dbmCardGoogleBusy = false;
  }
}

function dbmOpenBulkGoogleImageModal() {
  const n = dbmSelectedIds.size;
  if (!n) return;
  const savedAi = dbmLoadPrefs().ai || {};
  const rank = savedAi.googleRank || '1';
  const suffix = savedAi.googleSuffix ?? 'món ăn';

  window.dbmRunBulkGoogleImages = async () => {
    const chosenRankMode = document.getElementById('dbm-bulk-google-rank')?.value || '1';
    const chosenSuffix = document.getElementById('dbm-bulk-google-suffix')?.value.trim() || '';
    dbmSavePrefs({ ai: { ...savedAi, googleRank: chosenRankMode, googleSuffix: chosenSuffix } });
    const ids = [...dbmSelectedIds];
    closeModal();

    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const it = DB.getItemById(ids[i]);
      if (!it) continue;
      showToast('sparkleRegular', `⚡ (${i + 1}/${ids.length}) Đang lấy ảnh cho "${it.name}"...`);
      try {
        const prefRank = chosenRankMode === '2' ? 2 : (chosenRankMode === '1or2' ? (Math.random() < 0.5 ? 1 : 2) : 1);
        const q = dbmBuildFoodImageQuery(it.name, chosenSuffix, it.category || '');
        const res = await dbmSearchGoogleImages(q, {
          limit: 6,
          autoDownload: true,
          preferredRank: prefRank,
          name: it.name,
          category: it.category || ''
        });
        const src = res.localPath || res.originalUrl;
        if (src) {
          DB.addLibraryImage({ name: it.name, src });
          DB.bulkUpdateItems([it.id], { image: src });
          okCount++;
        } else {
          failCount++;
        }
      } catch (_) {
        failCount++;
      }
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    showToast(okCount > 0 ? 'checkmarkFilled' : 'alertRegular',
      `Đã tự động lấy ảnh đồ ăn cho ${okCount}/${ids.length} mặt hàng${failCount ? ` (${failCount} món chưa lấy được)` : ''}`);
    dbmRefreshManager();
  };

  dbmOpenSheet(`
    ${dbmSheetHeader('⚡', `Tự lấy ảnh đồ ăn miễn phí cho ${n} mặt hàng`)}
    <div class="delivery-modal-body dbm-editor-body">
      <div class="dbm-hint">Hệ thống tự động lọc tên món cốt lõi (Việt + Anh) và tìm ảnh qua <strong>Bing Food Images • Openverse CC • TheMealDB • Pixabay/CSE</strong> (tự tải vào <code>assets/images/uploads/</code> khi chạy <code>server.js</code>, hoặc lấy ảnh online trực tiếp).</div>
      <div class="delivery-input-group">
        <label class="delivery-input-label">Chọn vị trí ảnh muốn lấy</label>
        <select id="dbm-bulk-google-rank" class="delivery-input-field">
          <option value="1" ${rank === '1' ? 'selected' : ''}>Ảnh đầu tiên (#1 — nếu lỗi tải tự lùi sang #2)</option>
          <option value="2" ${rank === '2' ? 'selected' : ''}>Ảnh thứ 2 (#2 — nếu lỗi tải tự lùi sang #1, #3)</option>
          <option value="1or2" ${rank === '1or2' ? 'selected' : ''}>Ngẫu nhiên ảnh #1 hoặc #2</option>
        </select>
      </div>
      <div class="delivery-input-group">
        <label class="delivery-input-label">Hậu tố tìm kiếm kèm theo tên món</label>
        <input type="text" id="dbm-bulk-google-suffix" class="delivery-input-field" value="${escapeHtml(suffix)}" placeholder="VD: món ăn">
      </div>
    </div>
    <div class="dbm-editor-footer">
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="dbmRunBulkGoogleImages()">⚡ Bắt đầu lấy ảnh cho ${n} mặt hàng</button>
    </div>`);
}

// ── Thao tác hàng loạt ──
function dbmBulkStock(inStock) {
  const res = DB.bulkUpdateItems([...dbmSelectedIds], { inStock });
  if (res.ok) {
    showToast(inStock ? 'checkmarkFilled' : 'alertRegular', `${inStock ? 'Đã mở bán' : 'Đã đánh dấu tạm hết'} ${res.count} mặt hàng`);
    dbmRefreshManager();
  }
}

function dbmBulkDelete() {
  const n = dbmSelectedIds.size;
  if (!n || !confirm(`Xóa  ${n} mặt hàng đã chọn? Không thể hoàn tác.`)) return;
  const res = DB.deleteItems([...dbmSelectedIds]);
  dbmSelectedIds.clear();
  showToast('deleteRegular', `Đã xóa ${res.count} mặt hàng`);
  dbmRefreshManager();
}

function dbmOpenBulkModal(kind) {
  const n = dbmSelectedIds.size;
  if (!n) return;
  let body = '';
  let title = '';

  if (kind === 'category') {
    title = `Đổi danh mục cho ${n} mặt hàng`;
    body = `<select id="dbm-bulk-category" class="delivery-input-field">
      ${DB.getManualCategories().map(c => `<option value="${escapeHtml(c.id)}">${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
    </select>`;
  } else if (kind === 'store') {
    title = `Chuyển ${n} mặt hàng sang cửa hàng`;
    body = `<select id="dbm-bulk-store" class="delivery-input-field">
      ${DB.getStores().map(s => `<option value="${s.id}">🏪 ${escapeHtml(s.name)}</option>`).join('')}
    </select>`;
  } else if (kind === 'tags') {
    title = `Gắn / gỡ tag cho ${n} mặt hàng`;
    dbmTagState.bulkAdd = [];
    dbmTagState.bulkRemove = [];
    body = `
      <label class="delivery-input-label">Thêm tag:</label>
      ${dbmTagWidgetHtml('bulkAdd', 'Nhập tag rồi Enter (VD: cay, ăn vặt)')}
      <label class="delivery-input-label" style="margin-top:12px;">Gỡ tag:</label>
      ${dbmTagWidgetHtml('bulkRemove', 'Tag cần gỡ khỏi các mặt hàng đã chọn')}`;
  } else if (kind === 'vouchers') {
    title = `Mã giảm giá cho ${n} mặt hàng`;
    body = `
      <div class="dbm-hint">Chọn mã muốn <strong>thêm</strong> vào danh sách mã áp dụng được của các mặt hàng đã chọn (bỏ trống để không đổi). Chọn thêm ô "gỡ" để loại mã.</div>
      ${DB.getVouchers().map(v => `
        <div class="dbm-voucher-pick" style="align-items:center;">
          <div class="dbm-voucher-pick-info">
            <strong>${escapeHtml(v.code)}</strong>
            <span>${escapeHtml(v.title)}${v.scope === 'all' ? ' • áp dụng mọi món' : ' • chỉ món được gán'}</span>
          </div>
          <label style="display:inline-flex;align-items:center;gap:4px;font-weight:700;"><input type="checkbox" class="dbm-bulk-v-add" value="${escapeHtml(v.code)}"> thêm</label>
          <label style="display:inline-flex;align-items:center;gap:4px;font-weight:700;color:#dc2626;"><input type="checkbox" class="dbm-bulk-v-rem" value="${escapeHtml(v.code)}"> gỡ</label>
        </div>`).join('')}`;
  } else if (kind === 'healthy') {
    title = `Đánh giá độ Healthy cho ${n} mặt hàng`;
    body = `
      <div class="delivery-input-group">
        <label class="delivery-input-label">Chế độ cập nhật</label>
        <select id="dbm-bulk-healthy-mode" class="delivery-input-field" onchange="document.getElementById('dbm-bulk-healthy-manual').style.display = this.value === 'manual' ? '' : 'none'">
          <option value="auto">⚡ Tự động chấm điểm & nhận xét theo dinh dưỡng từng món</option>
          <option value="manual">🎯 Gán cùng điểm & nhận xét cho tất cả món đang chọn</option>
        </select>
      </div>
      <div id="dbm-bulk-healthy-manual" style="display:none;">
        <div class="db-form-two-col">
          <div class="delivery-input-group">
            <label class="delivery-input-label">Điểm Healthy (0 – 10)</label>
            <input type="number" id="dbm-bulk-healthy-score" class="delivery-input-field" min="0.1" max="10" step="0.1" value="8.5" placeholder="VD: 8.5">
          </div>
          <div class="delivery-input-group">
            <label class="delivery-input-label">Nhận xét mức độ Healthy</label>
            <input type="text" id="dbm-bulk-healthy-level" class="delivery-input-field" placeholder="Để trống = tự sinh nhận xét theo điểm">
          </div>
        </div>
      </div>`;
  }

  dbmOpenSheet(`
    ${dbmSheetHeader('⚙️', title)}
    <div class="delivery-modal-body dbm-editor-body">
      ${body}
    </div>
    <div class="dbm-editor-footer">
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="dbmSubmitBulk('${kind}')">Áp dụng cho ${n} mặt hàng</button>
    </div>`);
}

function dbmSubmitBulk(kind) {
  const patch = {};
  if (kind === 'category') patch.categoryId = document.getElementById('dbm-bulk-category')?.value;
  if (kind === 'store') patch.restaurantId = document.getElementById('dbm-bulk-store')?.value;
  if (kind === 'tags') {
    patch.addTags = dbmTagState.bulkAdd;
    patch.removeTags = dbmTagState.bulkRemove;
    if (patch.addTags.length === 0 && patch.removeTags.length === 0) {
      showToast('alertRegular', 'Hãy nhập ít nhất 1 tag');
      return;
    }
  }
  if (kind === 'vouchers') {
    patch.addVouchers = Array.from(document.querySelectorAll('.dbm-bulk-v-add:checked')).map(el => el.value);
    patch.removeVouchers = Array.from(document.querySelectorAll('.dbm-bulk-v-rem:checked')).map(el => el.value);
  }
  if (kind === 'healthy') {
    const mode = document.getElementById('dbm-bulk-healthy-mode')?.value || 'auto';
    if (mode === 'auto') {
      patch.healthyMode = 'auto';
    } else {
      patch.healthyScore = document.getElementById('dbm-bulk-healthy-score')?.value;
      patch.healthyLevel = document.getElementById('dbm-bulk-healthy-level')?.value;
      if (dbmCleanHealthyScore(patch.healthyScore) === null) {
        showToast('alertRegular', 'Điểm Healthy phải từ 0.1 đến 10.0');
        return;
      }
    }
  }
  const res = DB.bulkUpdateItems([...dbmSelectedIds], patch);
  if (!res.ok) { showToast('alertRegular', res.message); return; }
  closeModal();
  showToast('checkmarkFilled', `Đã cập nhật ${res.count} mặt hàng`);
  dbmRefreshManager();
}

// ─────────────────────────────────────────────────────────────────────────
// Widget nhập TAG dùng chung (mặt hàng, danh mục, thao tác hàng loạt)
// ─────────────────────────────────────────────────────────────────────────

const dbmTagState = { item: [], cat: [], bulkAdd: [], bulkRemove: [] };

function dbmTagWidgetHtml(key, placeholder = 'Nhập tag rồi nhấn Enter hoặc dấu phẩy', suggestions = []) {
  return `<div class="dbm-tag-widget" id="dbm-tagw-${key}">${dbmTagWidgetInner(key, placeholder, suggestions)}</div>`;
}

function dbmTagWidgetInner(key, placeholder, suggestions) {
  const tags = dbmTagState[key] || [];
  const sugg = (suggestions && suggestions.length ? suggestions : DB.getAllTags().slice(0, 14).map(t => t.tag))
    .filter(t => !tags.includes(t)).slice(0, 14);
  return `
    <div class="dbm-tag-chips">
      ${tags.map(t => `<span class="dbm-tag-chip removable">#${escapeHtml(t)}<button type="button" onclick="dbmTagRemove('${key}', '${escapeHtml(t)}')">✕</button></span>`).join('')}
      <input type="text" class="dbm-tag-input" placeholder="${escapeHtml(placeholder)}"
             onkeydown="dbmTagKey(event, '${key}')" onblur="dbmTagCommit('${key}', this)">
    </div>
    ${sugg.length ? `<div class="dbm-tag-suggest">Gợi ý: ${sugg.map(t => `<span class="dbm-tag-chip suggest" onclick="dbmTagAdd('${key}', '${escapeHtml(t)}')">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}`;
}

function dbmTagRerender(key) {
  const wrap = document.getElementById(`dbm-tagw-${key}`);
  if (!wrap) return;
  const input = wrap.querySelector('.dbm-tag-input');
  const placeholder = input ? input.placeholder : 'Nhập tag';
  wrap.innerHTML = dbmTagWidgetInner(key, placeholder, []);
  wrap.querySelector('.dbm-tag-input')?.focus();
  if (typeof dbmOnTagsChanged === 'function') dbmOnTagsChanged(key);
}

function dbmTagAdd(key, raw) {
  dbmTagState[key] = dbmParseTags([...(dbmTagState[key] || []), ...dbmParseTags(raw)]);
  dbmTagRerender(key);
}

function dbmTagRemove(key, tag) {
  dbmTagState[key] = (dbmTagState[key] || []).filter(t => t !== tag);
  dbmTagRerender(key);
}

function dbmTagKey(e, key) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    if (e.target.value.trim()) { dbmTagAdd(key, e.target.value); }
  } else if (e.key === 'Backspace' && !e.target.value) {
    const tags = dbmTagState[key] || [];
    if (tags.length) dbmTagRemove(key, tags[tags.length - 1]);
  }
}

function dbmTagCommit(key, input) {
  if (input.value.trim()) {
    dbmTagState[key] = dbmParseTags([...(dbmTagState[key] || []), ...dbmParseTags(input.value)]);
    input.value = '';
    // Không re-render ở blur để không mất focus của ô kế tiếp
    const wrap = document.getElementById(`dbm-tagw-${key}`);
    if (wrap) {
      const placeholder = input.placeholder;
      setTimeout(() => { wrap.innerHTML = dbmTagWidgetInner(key, placeholder, []); if (typeof dbmOnTagsChanged === 'function') dbmOnTagsChanged(key); }, 0);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Danh sách chọn mặt hàng (dùng cho Gán ảnh & Mã giảm giá áp dụng)
// ─────────────────────────────────────────────────────────────────────────

let dbmChk = { selected: new Set(), query: '', onlyMissing: false, onConfirm: null };

function dbmChecklistFiltered() {
  let list = DB.getItems();
  if (dbmChk.onlyMissing) list = list.filter(dbmIsPlaceholderImage);
  const q = dbmNormText(dbmChk.query);
  if (q) {
    list = list.filter(it => dbmNormText(it.name).includes(q) || dbmNormText(it.restaurantName).includes(q)
      || dbmNormText(it.category).includes(q) || (it.tags || []).some(t => dbmNormText(t).includes(q)));
  }
  return list;
}

function dbmChecklistHtml(showMissingFilter) {
  return `
    <div class="dbm-chk-toolbar">
      <input type="text" class="delivery-input-field" placeholder="Tìm mặt hàng, cửa hàng, tag..."
             value="${escapeHtml(dbmChk.query)}" oninput="dbmChk.query = this.value; dbmChecklistRefresh();">
      ${showMissingFilter ? `<label class="db-checkbox-row compact"><input type="checkbox" ${dbmChk.onlyMissing ? 'checked' : ''} onchange="dbmChk.onlyMissing = this.checked; dbmChecklistRefresh();"><span>Chỉ thiếu ảnh</span></label>` : ''}
      <button type="button" class="db-inline-link-btn" onclick="dbmChecklistSelectVisible(true)">Chọn đang hiện</button>
      <button type="button" class="db-inline-link-btn" onclick="dbmChecklistSelectVisible(false)">Bỏ chọn</button>
    </div>
    <div class="dbm-chk-list" id="dbm-chk-list">${dbmChecklistRowsHtml()}</div>`;
}

function dbmChecklistRowsHtml() {
  const list = dbmChecklistFiltered();
  if (list.length === 0) return `<div class="dbm-empty-note">Không có mặt hàng phù hợp</div>`;
  return list.map(it => `
    <label class="dbm-chk-row ${dbmChk.selected.has(it.id) ? 'checked' : ''}">
      <input type="checkbox" ${dbmChk.selected.has(it.id) ? 'checked' : ''} onchange="dbmChecklistToggle('${escapeHtml(it.id)}', this.checked)">
      <div class="dbm-chk-thumb">${dbmThumb(it.image, it.name)}</div>
      <div class="dbm-chk-info">
        <div class="dbm-chk-name">${escapeHtml(it.name)}${dbmIsPlaceholderImage(it) ? ' <em>• chưa có ảnh</em>' : ''}</div>
        <div class="dbm-chk-sub">🏪 ${escapeHtml(it.restaurantName || '')} • ${formatVND(it.price)}</div>
      </div>
    </label>`).join('');
}

function dbmChecklistRefresh() {
  const el = document.getElementById('dbm-chk-list');
  if (el) el.innerHTML = dbmChecklistRowsHtml();
  dbmChecklistUpdateCount();
}

function dbmChecklistToggle(id, checked) {
  if (checked) dbmChk.selected.add(id); else dbmChk.selected.delete(id);
  dbmChecklistRefresh();
}

function dbmChecklistSelectVisible(checked) {
  dbmChecklistFiltered().forEach(it => { if (checked) dbmChk.selected.add(it.id); else dbmChk.selected.delete(it.id); });
  dbmChecklistRefresh();
}

function dbmChecklistUpdateCount() {
  document.querySelectorAll('.dbm-chk-count').forEach(el => { el.textContent = dbmChk.selected.size; });
}

// ─────────────────────────────────────────────────────────────────────────
// Modal: GÁN 1 ẢNH CHO NHIỀU MẶT HÀNG
// ─────────────────────────────────────────────────────────────────────────

let dbmAssignSrc = '';

function openAssignImageModal({ preselectIds = [], imageSrc = '' } = {}) {
  dbmAssignSrc = imageSrc;
  dbmChk = { selected: new Set(preselectIds), query: '', onlyMissing: false, onConfirm: null };

  dbmDropHandlers['assign'] = async dropped => {
    const imported = await dbmImportDropped(dropped);
    if (imported.length === 0) { showToast('alertRegular', 'Không đọc được ảnh'); return; }
    imported.forEach(img => DB.addLibraryImage(img));
    dbmSetAssignImage(imported[0].src);
    if (imported.length > 1) showToast('checkmarkFilled', `Đã thêm ${imported.length - 1} ảnh còn lại vào Thư viện`);
    dbmRefreshAssignLibrary();
  };

  dbmOpenSheet(`
    ${dbmSheetHeader(FluentIcons.imageFilled, 'Gán ảnh cho nhiều mặt hàng')}
    <div class="delivery-modal-body dbm-editor-body">
      <div class="dbm-assign-top">
        <div class="dbm-assign-preview" id="dbm-assign-preview">${dbmAssignPreviewHtml()}</div>
        <div class="dbm-assign-source">
          ${dbmDropzoneHtml('assign', 'Thả ảnh vào đây hoặc bấm để chọn', { compact: true })}
          <input type="text" class="delivery-input-field" id="dbm-assign-url" placeholder="...hoặc dán đường dẫn ảnh (URL)"
                 onchange="dbmSetAssignImage(this.value.trim())">
        </div>
      </div>
      <div class="dbm-library-strip" id="dbm-assign-library">${dbmLibraryStripHtml('dbmSetAssignImage')}</div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Chọn mặt hàng sẽ dùng ảnh này (<span class="dbm-chk-count">${dbmChk.selected.size}</span> đã chọn):</label>
        ${dbmChecklistHtml(true)}
      </div>
    </div>
    <div class="dbm-editor-footer">
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="dbmApplyAssignImage()">
        ✅ Áp dụng ảnh cho <span class="dbm-chk-count">${dbmChk.selected.size}</span> mặt hàng
      </button>
    </div>`);
}

function dbmAssignPreviewHtml() {
  return dbmAssignSrc
    ? `<img src="${escapeHtml(dbmAssignSrc)}" alt="Ảnh sẽ gán" onerror="this.style.opacity=.3">`
    : `<div class="dbm-assign-empty">Chưa chọn ảnh</div>`;
}

function dbmSetAssignImage(src) {
  dbmAssignSrc = src || '';
  const prev = document.getElementById('dbm-assign-preview');
  if (prev) prev.innerHTML = dbmAssignPreviewHtml();
}

function dbmRefreshAssignLibrary() {
  const el = document.getElementById('dbm-assign-library');
  if (el) el.innerHTML = dbmLibraryStripHtml('dbmSetAssignImage');
}

function dbmLibraryStripHtml(handlerName) {
  const lib = DB.getLibraryImages().slice(0, 16);
  const presets = (typeof PRESET_FOOD_IMAGES !== 'undefined') ? PRESET_FOOD_IMAGES.slice(0, 8) : [];
  if (lib.length === 0 && presets.length === 0) return '';
  return `
    ${lib.length ? `<div class="dbm-strip-label">Thư viện của bạn</div><div class="dbm-strip-row">${lib.map(i => `<img src="${escapeHtml(i.src)}" title="${escapeHtml(i.name)}" onclick="${handlerName}(this.getAttribute('data-src'))" data-src="${escapeHtml(i.src)}" loading="lazy" onerror="this.style.opacity=.25">`).join('')}</div>` : ''}
    ${presets.length ? `<div class="dbm-strip-label">Ảnh mẫu</div><div class="dbm-strip-row">${presets.map(p => `<img src="${escapeHtml(p.path)}" title="${escapeHtml(p.label)}" onclick="${handlerName}(this.getAttribute('data-src'))" data-src="${escapeHtml(p.path)}" loading="lazy">`).join('')}</div>` : ''}`;
}

function dbmApplyAssignImage() {
  if (!dbmAssignSrc) { showToast('alertRegular', 'Hãy chọn hoặc thả một ảnh trước'); return; }
  if (dbmChk.selected.size === 0) { showToast('alertRegular', 'Hãy chọn ít nhất 1 mặt hàng'); return; }
  DB.addLibraryImage({ name: 'Ảnh đã gán', src: dbmAssignSrc });
  const res = DB.bulkUpdateItems([...dbmChk.selected], { image: dbmAssignSrc });
  if (!res.ok) { showToast('alertRegular', res.message); return; }
  closeModal();
  showToast('checkmarkFilled', `Đã gán ảnh cho ${res.count} mặt hàng`);
  dbmRefreshManager();
}

// ─────────────────────────────────────────────────────────────────────────
// TAB: THƯ VIỆN ẢNH
// ─────────────────────────────────────────────────────────────────────────

function renderDbmImagesTab() {
  const lib = DB.getLibraryImages();
  const items = DB.getItems();
  return `
    <div class="dbm-panel">
      <div class="dbm-panel-title">Thư viện ảnh</div>
      <div class="dbm-hint">Thả nhiều ảnh cùng lúc vào đây. Sau đó bấm <strong>“Gán cho mặt hàng”</strong> trên một ảnh để gắn ảnh đó cho nhiều sản phẩm một lần. Đây cũng là phương án dự phòng khi API tạo ảnh bị giới hạn.</div>
      <div id="dbm-library-dropzone">${dbmDropzoneHtml('library', 'Thả ảnh vào đây (nhiều file được) hoặc bấm để chọn')}</div>
      <div class="dbm-inline-form">
        <input type="text" id="dbm-library-url" class="delivery-input-field" placeholder="Hoặc dán đường dẫn ảnh (URL)...">
        <button type="button" class="db-secondary-btn" onclick="dbmAddLibraryUrl()">+ Thêm URL</button>
      </div>
    </div>
    ${lib.length === 0 ? `
      <div class="search-empty-state" style="padding:36px 20px;">
        <div class="search-empty-icon">${FluentIcons.imageFilled}</div>
        <div class="search-empty-title">Thư viện đang trống</div>
        <div class="search-empty-sub">Thả ảnh món ăn vào ô phía trên để bắt đầu.</div>
      </div>` : `
      <div class="dbm-library-grid">
        ${lib.map(img => {
    const used = items.filter(it => it.image === img.src).length;
    return `
          <div class="dbm-library-card">
            <div class="dbm-library-thumb">${dbmThumb(img.src, img.name)}</div>
            <div class="dbm-library-name" title="${escapeHtml(img.name)}">${escapeHtml(img.name)}</div>
            <div class="dbm-library-used">${used > 0 ? `Đang dùng bởi ${used} mặt hàng` : 'Chưa gán'}</div>
            <div class="dbm-library-actions">
              <button type="button" class="db-act-btn order" data-src="${escapeHtml(img.src)}" onclick="openAssignImageModal({ imageSrc: this.getAttribute('data-src') })">Gán cho mặt hàng</button>
              <button type="button" class="db-act-btn delete" onclick="dbmRemoveLibraryImage('${escapeHtml(img.id)}')">🗑️</button>
            </div>
          </div>`;
  }).join('')}
      </div>`}`;
}

function dbmBindLibraryDropzone() {
  dbmDropHandlers['library'] = async dropped => {
    showToast('sparkleRegular', 'Đang xử lý ảnh...');
    const imported = await dbmImportDropped(dropped);
    imported.forEach(img => DB.addLibraryImage(img));
    showToast('checkmarkFilled', `Đã thêm ${imported.length} ảnh vào Thư viện`);
    renderCatalogManagerView();
  };
}

function dbmAddLibraryUrl() {
  const input = document.getElementById('dbm-library-url');
  const url = (input?.value || '').trim();
  if (!/^https?:\/\/\S+$/i.test(url) && !/^assets\/\S+$/i.test(url)) {
    showToast('alertRegular', 'Hãy nhập URL ảnh hợp lệ (https://...)');
    return;
  }
  DB.addLibraryImage({ name: 'Ảnh từ URL', src: url });
  renderCatalogManagerView();
}

function dbmRemoveLibraryImage(id) {
  if (!confirm('Xóa ảnh khỏi Thư viện? (Các mặt hàng đang dùng ảnh này vẫn giữ nguyên ảnh)')) return;
  DB.removeLibraryImage(id);
  renderCatalogManagerView();
}

