/* ==========================================================================
   ptitngon - Catalog & User Profile Management Views (js/catalog-profile.js)
   - Hệ thống Quản lý Mặt hàng & Loại mặt hàng tùy chỉnh (lưu )
   - Hệ thống Hồ sơ Người dùng: Ghi nhớ các người dùng đã tạo, SĐT, địa chỉ, đơn đã đặt
   - Đồng bộ trực tiếp với file database.json
   ========================================================================== */

let catalogActiveTab = 'items'; // 'items' | 'categories' | 'database'
let catalogSearchQuery = '';
let catalogCategoryFilter = 'all';
let catalogStatusFilter = 'all'; // 'all' | 'custom' | 'instock' | 'outofstock'
let showRawJsonPreview = false;

let profileActiveTab = 'nutrition'; // 'nutrition' | 'users' | 'orders' | 'addresses'
let profileUserSearchQuery = '';
let showHiddenDbDrawer = true; // Mặc định mở sẵn bảng điều khiển Quản lý Database trong Tài khoản

// Preset icons & images cho trình tạo Loại mặt hàng / Mặt hàng tùy chỉnh
const CATEGORY_EMOJI_PRESETS = [
  '🔥', '🍜', '🥖', '🍚', '🍝', '🥩', '🥘', '🍗', '🍕', '🍣',
  '🧋', '☕', '🍰', '🍩', '🍦', '🍧', '🍉', '🍓', '🥑', '🥗',
  '🌮', '🌯', '🥪', '🍔', '🍟', '🍿', '🍢', '🥟', '🍱', '🍛',
  '🍲', '🦐', '🧃', '🍵', '🍫', '🥐', '🛒', '📚', '🎁', '⭐'
];

const USER_AVATAR_PRESETS = [
  '👨‍🎓', '👩‍🎓', '🧑‍💻', '👩‍💻', '🧑‍🍳', '🦸', '🕵️', '🐱', '🐶', '🐼', '🦊', '🐯'
];

const PRESET_FOOD_IMAGES = [
  { label: 'Hùng chiên giòn', path: 'assets/images/hung_chien_gion.jpg' },
  { label: 'Phở bò', path: 'assets/images/pho_bo_1792459676492.jpg' },
  { label: 'Bánh mì', path: 'assets/images/banh_mi_1792459688980.jpg' },
  { label: 'Cơm tấm', path: 'assets/images/com_tam_1792459701659.jpg' },
  { label: 'Bún bò Huế', path: 'assets/images/bun_bo_hue_1792459733043.jpg' },
  { label: 'Bún chả', path: 'assets/images/bun_cha_1792459712673.jpg' },
  { label: 'Gỏi cuốn', path: 'assets/images/goi_cuon_1792459722505.jpg' },
  { label: 'Bánh xèo', path: 'assets/images/banh_xeo_1792459745179.jpg' },
  { label: 'Gà rán / Burger', path: 'assets/images/ga_ran.jpg' },
  { label: 'Pizza / Mỳ Ý', path: 'assets/images/pizza.jpg' },
  { label: 'Sushi Nhật', path: 'assets/images/sushi.jpg' },
  { label: 'Trà sữa / Chè', path: 'assets/images/tra_sua.jpg' },
  { label: 'Cà phê / Đồ uống', path: 'assets/images/ca_phe.jpg' }
];

// ── Đồng bộ State từ User đang đăng nhập sang toàn bộ App UI ──
window.syncAppStateFromUser = function (user) {
  if (!user) return;

  userDeliveryInfo = {
    name: user.name,
    phone: user.phone,
    address: user.address,
    shortAddress: user.shortAddress || (user.address && user.address.length > 30 ? user.address.substring(0, 28) + '...' : user.address),
    label: user.addressLabel || 'PTIT Hà Đông',
    note: user.addressNote || ''
  };

  savedAddressPresets = Array.isArray(user.savedAddresses) ? user.savedAddresses : [];
  ordersList = Array.isArray(user.orders) ? user.orders : [];
  cart = Array.isArray(user.cart) ? user.cart : [];

  syncGlobalChromeUI();
};

function syncGlobalChromeUI() {
  const user = DB.getCurrentUser();
  if (!user) return;

  // Cập nhật địa chỉ ở Sidebar Desktop
  const sAddr = document.getElementById('sidebar-loc-address');
  if (sAddr) {
    sAddr.textContent = user.addressLabel || user.shortAddress || 'PTIT Hà Đông';
  }

  // Cập nhật thẻ Sinh viên / Tài khoản ở chân Sidebar Desktop
  const studentAvatar = document.querySelector('.sidebar-student-avatar');
  const studentName = document.querySelector('.sidebar-student-name');
  const studentSub = document.querySelector('.sidebar-student-sub');
  if (studentAvatar) studentAvatar.textContent = user.avatar || '👨‍🎓';
  if (studentName) studentName.textContent = user.name;
  if (studentSub) studentSub.textContent = `${user.memberTier || 'Thành viên'} • ${user.phone}`;

  // Cập nhật badge đơn đang giao ở Sidebar
  const actBadge = document.getElementById('sidebar-activity-badge');
  if (actBadge) {
    const deliveringCount = (user.orders || []).filter(o => o.categoryStatus === 'delivering').length;
    if (deliveringCount > 0) {
      actBadge.textContent = `${deliveringCount} đang giao`;
      actBadge.style.display = 'inline-flex';
    } else {
      actBadge.style.display = 'none';
    }
  }

  // Cập nhật thanh Quick Tags trên Desktop Header (ưu tiên hiển thị cả danh mục tùy chỉnh mới thêm!)
  const headerTags = document.getElementById('desktop-header-tags');
  if (headerTags && Array.isArray(foodCategories)) {
    const visibleCats = typeof getHomeCategories === 'function' ? getHomeCategories() : foodCategories;
    const customCats = visibleCats.filter(c => c.isCustom);
    const defaultTopCats = visibleCats.filter(c => !c.isCustom).slice(0, 4);
    const combinedTags = [...customCats, ...defaultTopCats].slice(0, 8);

    headerTags.innerHTML = `
      ${combinedTags.map((cat, idx) => `
        <span class="desktop-header-tag ${idx === 0 && !cat.isCustom ? 'active' : ''} ${cat.isCustom ? 'custom-tag' : ''}" onclick="openSearchView('${escapeHtml(cat.keyword)}')">
          ${cat.icon} ${escapeHtml(cat.name)}
        </span>
      `).join('')}
      <span class="desktop-header-tag freeship" onclick="openSearchView('', 'freeship')">🚚 Freeship 0đ</span>
    `;
  }

  if (typeof updateFloatingCartBar === 'function') {
    updateFloatingCartBar();
  }
}

// Tiện ích nén ảnh tải lên từ máy tính thành Base64 gọn nhẹ để lưu 
function readAndCompressImageFile(file, maxWidth = 480, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Không có file'));
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// =========================================================================
// PHẦN A: GIAO DIỆN QUẢN LÝ MẶT HÀNG & LOẠI MẶT HÀNG TÙY CHỈNH (DATABASE .JSON)
// =========================================================================

function openCatalogManagerView(tab = 'items', catFilter = 'all') {
  if (typeof saveCurrentViewScroll === 'function') {
    saveCurrentViewScroll();
  }
  currentView = 'catalog';
  catalogActiveTab = tab;
  if (catFilter) catalogCategoryFilter = catFilter;
  render();
  if (typeof restoreViewScroll === 'function') {
    restoreViewScroll('catalog');
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

function switchCatalogTab(tab) {
  catalogActiveTab = tab;
  renderCatalogManagerView();
}

function getFilteredCatalogItems() {
  let list = [...DB.getItems()];
  if (catalogCategoryFilter && catalogCategoryFilter !== 'all') {
    list = list.filter(it => it.categoryId === catalogCategoryFilter || it.category === catalogCategoryFilter);
  }
  if (catalogStatusFilter === 'custom') {
    list = list.filter(it => it.isCustom);
  } else if (catalogStatusFilter === 'instock') {
    list = list.filter(it => it.inStock !== false);
  } else if (catalogStatusFilter === 'outofstock') {
    list = list.filter(it => it.inStock === false);
  }
  if (catalogSearchQuery.trim()) {
    const q = catalogSearchQuery.toLowerCase().trim();
    list = list.filter(it =>
      it.name.toLowerCase().includes(q) ||
      (it.sku || '').toLowerCase().includes(q) ||
      (it.category || '').toLowerCase().includes(q) ||
      (it.restaurantName || '').toLowerCase().includes(q)
    );
  }
  return list;
}

function renderCatalogManagerView() {
  const allCats = DB.getCategories();
  const allItems = DB.getItems();
  const customCatsCount = allCats.filter(c => c.isCustom).length;
  const customItemsCount = allItems.filter(i => i.isCustom).length;

  const syncLabel = DB.fileSyncStatus === 'file-linked'
    ? `🔗 Đang ghi trực tiếp: ${DB.linkedFileName}`
    : DB.fileSyncStatus === 'server-api'
      ? `🟢 Đang đồng bộ trực tiếp database.json`
      : `💾 Đã lưu  tự động`;

  app.innerHTML = `
    <div class="catalog-view-container fade-in">
      <!-- Header -->
      <div class="page-nav-header">
        <button class="page-back-icon-btn" onclick="openProfileView()" title="Quay lại Tài khoản" aria-label="Quay lại Tài khoản">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Quản Lý Mặt Hàng & Database</div>
        <button class="db-quick-export-btn" onclick="DB.exportJsonFile(); showToast('checkmarkFilled', 'Đã xuất file database.json!')" title="Tải xuống file database.json">
          ⬇️ .JSON
        </button>
      </div>

      <!-- Summary Stats Banner -->
      <div class="db-hero-banner">
        <div class="db-hero-top">
          <div>
            <div class="db-hero-badge">${syncLabel}</div>
            <div class="db-hero-title">Hệ thống Cơ sở dữ liệu Mặt hàng (.json)</div>
            <div class="db-hero-sub">Thêm loại mặt hàng tùy chỉnh, thêm sản phẩm mới và đồng bộ </div>
          </div>
          <div class="db-hero-actions">
            <button class="db-btn-white" onclick="openCategoryEditorModal()">
              ➕ Thêm loại mặt hàng
            </button>
            <button class="db-btn-accent" onclick="openItemEditorModal(null, catalogCategoryFilter !== 'all' ? catalogCategoryFilter : null)">
              ➕ Thêm mặt hàng mới
            </button>
          </div>
        </div>

        <div class="db-stats-grid">
          <div class="db-stat-box" onclick="switchCatalogTab('categories')">
            <div class="db-stat-num">${allCats.length}</div>
            <div class="db-stat-label">Loại mặt hàng (${customCatsCount} tùy chỉnh)</div>
          </div>
          <div class="db-stat-box" onclick="switchCatalogTab('items')">
            <div class="db-stat-num">${allItems.length}</div>
            <div class="db-stat-label">Tổng mặt hàng (${customItemsCount} mới thêm)</div>
          </div>
          <div class="db-stat-box" onclick="openProfileView()">
            <div class="db-stat-num">${DB.getUsers().length}</div>
            <div class="db-stat-label">Hồ sơ người dùng đã lưu</div>
          </div>
          <div class="db-stat-box" onclick="switchCatalogTab('database')">
            <div class="db-stat-num">JSON</div>
            <div class="db-stat-label">File database.json hoàn chỉnh</div>
          </div>
        </div>
      </div>

      <!-- 3 Sub-Tabs -->
      <div class="db-subtabs-bar">
        <button class="db-subtab-btn ${catalogActiveTab === 'items' ? 'active' : ''}" onclick="switchCatalogTab('items')">
          📦 Kho Mặt Hàng (${allItems.length})
        </button>
        <button class="db-subtab-btn ${catalogActiveTab === 'categories' ? 'active' : ''}" onclick="switchCatalogTab('categories')">
          🏷️ Loại Mặt Hàng (${allCats.length})
        </button>
        <button class="db-subtab-btn ${catalogActiveTab === 'database' ? 'active' : ''}" onclick="switchCatalogTab('database')">
          🗄️ Đồng Bộ File .JSON
        </button>
      </div>

      <!-- Sub-Tab Content -->
      <div class="db-tab-body">
        ${catalogActiveTab === 'items' ? renderCatalogItemsTab(allCats) : ''}
        ${catalogActiveTab === 'categories' ? renderCatalogCategoriesTab(allCats, allItems) : ''}
        ${catalogActiveTab === 'database' ? renderCatalogDatabaseTab() : ''}
      </div>

      <div class="bottom-spacer"></div>
    </div>
  `;
}

function renderCatalogItemsTab(allCats) {
  const filtered = getFilteredCatalogItems();

  return `
    <div class="db-controls-card">
      <div class="db-search-row">
        <div class="db-search-input-wrap">
          <span>${FluentIcons.searchRegular}</span>
          <input
            type="text"
            placeholder="Tìm theo tên mặt hàng, mã SP, loại mặt hàng, quán..."
            value="${escapeHtml(catalogSearchQuery)}"
            oninput="catalogSearchQuery = this.value; updateCatalogItemsListDOM();"
          >
          ${catalogSearchQuery ? `<button onclick="catalogSearchQuery=''; renderCatalogManagerView();">✕</button>` : ''}
        </div>

        <select class="db-select-box" onchange="catalogCategoryFilter = this.value; renderCatalogManagerView();">
          <option value="all" ${catalogCategoryFilter === 'all' ? 'selected' : ''}>Tất cả loại mặt hàng (${allCats.length})</option>
          ${allCats.map(c => `
            <option value="${escapeHtml(c.id)}" ${(catalogCategoryFilter === c.id || catalogCategoryFilter === c.name) ? 'selected' : ''}>
              ${c.icon} ${escapeHtml(c.name)} ${c.isCustom ? '(Tùy chỉnh)' : ''}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="db-filter-chips-row">
        <button class="db-chip ${catalogStatusFilter === 'all' ? 'active' : ''}" onclick="catalogStatusFilter='all'; renderCatalogManagerView();">
          Tất cả
        </button>
        <button class="db-chip ${catalogStatusFilter === 'custom' ? 'active' : ''}" onclick="catalogStatusFilter='custom'; renderCatalogManagerView();">
          ✨ Do bạn thêm
        </button>
        <button class="db-chip ${catalogStatusFilter === 'instock' ? 'active' : ''}" onclick="catalogStatusFilter='instock'; renderCatalogManagerView();">
          ✅ Đang bán
        </button>
        <button class="db-chip ${catalogStatusFilter === 'outofstock' ? 'active' : ''}" onclick="catalogStatusFilter='outofstock'; renderCatalogManagerView();">
          ⛔ Tạm hết hàng
        </button>
      </div>
    </div>

    <div id="catalog-items-list-container">
      ${renderCatalogItemsGridHtml(filtered)}
    </div>
  `;
}

function renderCatalogItemsGridHtml(itemsList) {
  if (itemsList.length === 0) {
    return `
      <div class="search-empty-state" style="padding: 48px 20px;">
        <div class="search-empty-icon">📦</div>
        <div class="search-empty-title">Chưa có mặt hàng nào khớp bộ lọc</div>
        <div class="search-empty-sub">Bạn có thể thêm mặt hàng mới hoặc đặt lại bộ lọc để xem toàn bộ kho hàng.</div>
        <div style="display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap;">
          <button class="db-primary-btn" onclick="openItemEditorModal(null, catalogCategoryFilter !== 'all' ? catalogCategoryFilter : null)">
            ➕ Thêm mặt hàng mới ngay
          </button>
          <button class="db-secondary-btn" onclick="catalogSearchQuery=''; catalogCategoryFilter='all'; catalogStatusFilter='all'; renderCatalogManagerView();">
            Xem tất cả mặt hàng
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="db-results-count">
      Hiển thị <strong>${itemsList.length}</strong> mặt hàng trong cơ sở dữ liệu
    </div>
    <div class="db-items-grid">
      ${itemsList.map(item => {
    const catObj = DB.getCategoryById(item.categoryId);
    const catIcon = catObj ? catObj.icon : '🍽️';
    const isOut = item.inStock === false;
    return `
          <div class="db-item-card ${isOut ? 'out-of-stock' : ''}">
            <div class="db-item-img-wrap">
              <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
              <span class="db-item-sku">${escapeHtml(item.sku || 'SP')}</span>
              ${item.isCustom ? `<span class="db-item-custom-badge">Tùy chỉnh ✨</span>` : ''}
              ${isOut ? `<span class="db-item-out-overlay">TẠM HẾT</span>` : ''}
            </div>

            <div class="db-item-body">
              <div class="db-item-cat-row">
                <span class="db-cat-pill" onclick="catalogCategoryFilter='${escapeHtml(item.categoryId)}'; renderCatalogManagerView();">
                  ${catIcon} ${escapeHtml(item.category)}
                </span>
                <button
                  class="db-stock-toggle ${isOut ? 'off' : 'on'}"
                  onclick="handleToggleItemStock('${escapeHtml(item.id)}')"
                  title="Bấm để đổi trạng thái Còn hàng / Hết hàng"
                >
                  ${isOut ? '⛔ Tạm hết' : '✅ Còn hàng'}
                </button>
              </div>

              <div class="db-item-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
              <div class="db-item-shop">🏪 ${escapeHtml(item.restaurantName || 'Gian Hàng PTIT')}</div>
              <div class="db-item-price-row">
                <span class="db-item-price">${formatVND(item.price)}</span>
                <span class="db-item-meta-small">
                  ${(item.sizes?.length || 1)} cỡ • ${(item.toppings?.length || 0)} topping
                </span>
              </div>

              <div class="db-item-actions">
                <button class="db-act-btn order" onclick="orderItemDirectlyById('${escapeHtml(item.id)}')" ${isOut ? 'disabled' : ''}>
                  🛒 Đặt món
                </button>
                <button class="db-act-btn edit" onclick="openItemEditorModal('${escapeHtml(item.id)}')">
                  ✏️ Sửa
                </button>
                <button class="db-act-btn delete" onclick="handleDeleteItem('${escapeHtml(item.id)}')">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function updateCatalogItemsListDOM() {
  const container = document.getElementById('catalog-items-list-container');
  if (container) {
    container.innerHTML = renderCatalogItemsGridHtml(getFilteredCatalogItems());
  }
}

function orderItemDirectlyById(itemId) {
  const item = DB.getItemById(itemId);
  if (!item) return;
  if (item.inStock === false) {
    showToast('alertRegular', 'Mặt hàng này hiện đang tạm hết!');
    return;
  }
  const r = restaurants.find(x => Number(x.id) === Number(item.restaurantId)) || {
    id: item.restaurantId || 1000,
    name: item.restaurantName || 'Gian Hàng Tự Chọn PTIT',
    fav: false
  };
  openDishOptionModal(item, r);
}

function handleToggleItemStock(itemId) {
  const updated = DB.toggleItemStock(itemId);
  if (updated) {
    showToast(updated.inStock ? 'checkmarkFilled' : 'alertRegular',
      updated.inStock ? `Đã mở bán lại "${updated.name}"` : `Đã đánh dấu tạm hết "${updated.name}"`);
    renderCatalogManagerView();
  }
}

function handleDeleteItem(itemId) {
  const item = DB.getItemById(itemId);
  if (!item) return;
  if (!confirm(`Bạn có chắc muốn xóa  mặt hàng "${item.name}" khỏi Database không?`)) return;
  const res = DB.deleteItem(itemId);
  if (res.ok) {
    showToast('deleteRegular', `Đã xóa  mặt hàng "${item.name}"`);
    renderCatalogManagerView();
  }
}

function renderCatalogCategoriesTab(allCats, allItems) {
  return `
    <div class="db-section-toolbar">
      <div>
        <div style="font-size:15px; font-weight:800; color:var(--gray-900);">Danh sách Loại Mặt Hàng (${allCats.length})</div>
        <div style="font-size:12px; color:var(--gray-500);">Loại mặt hàng tùy chỉnh bạn thêm sẽ xuất hiện trên toàn ứng dụng và lưu .</div>
      </div>
      <button class="db-primary-btn" onclick="openCategoryEditorModal()">
        ➕ Tạo loại mặt hàng tùy chỉnh
      </button>
    </div>

    <div class="db-categories-grid">
      ${allCats.map(cat => {
    const count = allItems.filter(it => it.categoryId === cat.id || it.category === cat.name).length;
    return `
          <div class="db-category-card ${cat.isCustom ? 'is-custom' : ''}">
            <div class="db-cat-card-top">
              <div class="db-cat-card-icon">${cat.icon}</div>
              <div class="db-cat-card-info">
                <div class="db-cat-card-name">
                  ${escapeHtml(cat.name)}
                  ${cat.isCustom ? `<span class="custom-pill">Tùy chỉnh</span>` : `<span class="system-pill">Mặc định</span>`}
                </div>
                <div class="db-cat-card-count">${count} mặt hàng • Từ khóa: "${escapeHtml(cat.keyword)}"</div>
              </div>
            </div>
            ${cat.description ? `<div class="db-cat-card-desc">${escapeHtml(cat.description)}</div>` : ''}
            <div class="db-cat-card-actions">
              <button class="db-act-btn order" onclick="openSearchView('${escapeHtml(cat.keyword)}')">
                🔍 Xem trên Shop
              </button>
              <button class="db-act-btn edit" onclick="openItemEditorModal(null, '${escapeHtml(cat.id)}')">
                + Thêm món
              </button>
              <button class="db-act-btn edit" onclick="openCategoryEditorModal('${escapeHtml(cat.id)}')">
                ✏️ Sửa
              </button>
              <button class="db-act-btn delete" onclick="handleDeleteCategory('${escapeHtml(cat.id)}')" title="Xóa loại mặt hàng">
                🗑️
              </button>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function handleDeleteCategory(catId) {
  const cat = DB.getCategoryById(catId);
  if (!cat) return;
  const count = DB.getItems().filter(it => it.categoryId === cat.id || it.category === cat.name).length;
  const msg = count > 0
    ? `Loại mặt hàng "${cat.name}" đang có ${count} mặt hàng. Nếu xóa, các mặt hàng này sẽ chuyển sang danh mục đầu tiên. Bạn chắc chắn muốn xóa?`
    : `Xóa  loại mặt hàng "${cat.name}" khỏi Database?`;
  if (!confirm(msg)) return;

  const res = DB.deleteCategory(catId);
  if (res.ok) {
    syncGlobalChromeUI();
    showToast('deleteRegular', `Đã xóa loại mặt hàng "${cat.name}"`);
    if (currentView === 'catalog') renderCatalogManagerView();
    else render();
  }
}

function renderCatalogDatabaseTab() {
  const meta = DB.data.meta || {};
  const totalOrders = DB.getUsers().reduce((s, u) => s + (u.orders?.length || 0), 0);
  const updatedStr = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString('vi-VN') : 'Vừa xong';

  return `
    <div class="db-sync-panel">
      <div class="db-sync-header">
        <div class="db-sync-icon">🗄️</div>
        <div>
          <div class="db-sync-title">Cơ sở dữ liệu hợp nhất: <code>database.json</code></div>
          <div class="db-sync-sub">Cập nhật lần cuối: <strong>${updatedStr}</strong> • Phiên bản Schema: ${escapeHtml(meta.version || '2.0.0')}</div>
        </div>
      </div>

      <div class="db-status-alert ${DB.fileSyncStatus === 'file-linked' || DB.fileSyncStatus === 'server-api' ? 'linked' : ''}">
        <div>
          <strong>Trạng thái Lưu :</strong>
          ${DB.fileSyncStatus === 'file-linked'
      ? `Đang kết nối trực tiếp tới file <code>${escapeHtml(DB.linkedFileName)}</code> trên ổ cứng. Mọi thay đổi đều tự động ghi thẳng vào file .json và LocalStorage!`
      : DB.fileSyncStatus === 'permission-needed'
        ? `Đã nhớ file <code>${escapeHtml(DB.linkedFileName)}</code> từ phiên trước. Bấm <strong>"Cấp quyền ghi lại vào database.json"</strong> bên dưới để tiếp tục tự động ghi đè lên ổ cứng!`
        : DB.fileSyncStatus === 'server-api'
          ? `Đang chạy qua Server nội bộ: Mọi thao tác tự động ghi trực tiếp vào file <code>database.json</code> trong thư mục dự án!`
          : `Mọi thay đổi (loại mặt hàng mới, mặt hàng mới, người dùng, SĐT, địa chỉ, đơn hàng) đang được <strong>lưu  tự động</strong> trên trình duyệt. Bạn cũng có thể bấm <strong>"Liên kết trực tiếp file database.json"</strong> để trình duyệt tự động ghi thẳng vào file <code>database.json</code> trên máy tính!`
    }
        </div>
      </div>

      <div class="db-sync-actions-grid">
        <button class="db-sync-action-card primary" onclick="handleLinkDatabaseJson()">
          <span class="db-sync-card-emoji">🔗</span>
          <span class="db-sync-card-title">
            ${DB.fileSyncStatus === 'permission-needed' ? 'Cấp lại quyền ghi database.json' : 'Liên kết trực tiếp file database.json'}
          </span>
          <span class="db-sync-card-desc">Chọn file database.json trong thư mục project để tự động lưu đè trực tiếp mỗi khi thay đổi</span>
        </button>

        <button class="db-sync-action-card" onclick="DB.exportJsonFile(); showToast('checkmarkFilled', 'Đã xuất file database.json hoàn chỉnh!');">
          <span class="db-sync-card-emoji">⬇️</span>
          <span class="db-sync-card-title">Xuất / Tải về database.json</span>
          <span class="db-sync-card-desc">Tải toàn bộ dữ liệu mặt hàng, danh mục & hồ sơ người dùng ra file .json</span>
        </button>

        <label class="db-sync-action-card" style="cursor:pointer;">
          <input type="file" accept=".json,application/json" style="display:none;" onchange="handleImportDatabaseJson(this)">
          <span class="db-sync-card-emoji">⬆️</span>
          <span class="db-sync-card-title">Nhập dữ liệu từ file .json</span>
          <span class="db-sync-card-desc">Nạp file database.json có sẵn từ máy tính và lưu  vào hệ thống</span>
        </label>

        <button class="db-sync-action-card danger" onclick="handleResetDatabase()">
          <span class="db-sync-card-emoji">🔄</span>
          <span class="db-sync-card-title">Khôi phục Database gốc</span>
          <span class="db-sync-card-desc">Đặt lại dữ liệu mặc định ban đầu (23 danh mục, 110 món, 2 người dùng mẫu)</span>
        </button>
      </div>

      <!-- Schema Summary Table -->
      <div class="db-schema-summary">
        <div style="font-weight:800; font-size:14px; margin-bottom:10px; color:var(--gray-900);">Cấu trúc Bảng dữ liệu trong <code>database.json</code>:</div>
        <div class="db-schema-rows">
          <div class="db-schema-row">
            <code>categories[]</code>
            <span><strong>${DB.getCategories().length}</strong> bản ghi (Loại mặt hàng mặc định & tùy chỉnh)</span>
          </div>
          <div class="db-schema-row">
            <code>items[]</code>
            <span><strong>${DB.getItems().length}</strong> bản ghi (Đầy đủ mã SP, giá, size, topping, tồn kho)</span>
          </div>
          <div class="db-schema-row">
            <code>restaurants[]</code>
            <span><strong>${DB.data.restaurants.length}</strong> bản ghi (Quán ăn đối tác & gian hàng tùy chỉnh)</span>
          </div>
          <div class="db-schema-row">
            <code>users[]</code>
            <span><strong>${DB.getUsers().length}</strong> hồ sơ người dùng (SĐT, sổ địa chỉ, giỏ hàng, <strong>${totalOrders}</strong> đơn đã đặt)</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <button class="db-secondary-btn" onclick="showRawJsonPreview = !showRawJsonPreview; renderCatalogManagerView();">
          ${showRawJsonPreview ? '🙈 Ẩn nội dung JSON trực tiếp' : '👁️ Xem cấu trúc JSON trực tiếp (Live Preview)'}
        </button>
      </div>

      ${showRawJsonPreview ? `
        <div class="db-json-preview-box">
          <div class="db-json-preview-head">
            <span>database.json (Live State)</span>
            <button onclick="copyDatabaseJsonToClipboard()">📋 Sao chép JSON</button>
          </div>
          <pre>${escapeHtml(JSON.stringify({
      meta: DB.data.meta,
      currentUserId: DB.data.currentUserId,
      users: DB.data.users,
      categories: DB.data.categories,
      itemsCount: DB.data.items.length,
      sampleNewestItems: DB.data.items.slice(0, 5)
    }, null, 2))}</pre>
        </div>
      ` : ''}
    </div>
  `;
}

async function handleLinkDatabaseJson() {
  const ok = await DB.linkDirectJsonFile();
  if (ok) {
    showToast('checkmarkFilled', `Đã liên kết & ghi trực tiếp vào file ${DB.linkedFileName}!`);
    if (currentView === 'catalog') renderCatalogManagerView();
    if (currentView === 'profile') renderProfileView();
  }
}

async function handleImportDatabaseJson(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  const res = await DB.importJsonFile(file);
  if (res.ok) {
    syncGlobalChromeUI();
    showToast('checkmarkFilled', res.message);
    render();
  } else {
    showToast('alertRegular', res.message);
  }
  inputEl.value = '';
}

function handleResetDatabase() {
  if (!confirm('Khôi phục về dữ liệu gốc ban đầu? Các loại mặt hàng tùy chỉnh và người dùng mới thêm sẽ bị đặt lại.')) return;
  if (DB.resetToSeed()) {
    syncGlobalChromeUI();
    showToast('checkmarkFilled', 'Đã khôi phục dữ liệu gốc thành công!');
    render();
  }
}

function copyDatabaseJsonToClipboard() {
  const str = JSON.stringify(DB.data, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(str).then(() => {
      showToast('copyRegular', 'Đã sao chép toàn bộ nội dung database.json vào Clipboard!');
    });
  }
}

// =========================================================================
// MODAL 1: THÊM / SỬA LOẠI MẶT HÀNG TÙY CHỈNH (CUSTOM CATEGORY MODAL)
// =========================================================================

let tempCatIcon = '🧋';
let tempCatImage = 'assets/images/hung_chien_gion.jpg';
let pendingReturnToItemModal = null;

function openCategoryEditorModal(editCatId = null, fromItemModalDraft = null) {
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  pendingReturnToItemModal = fromItemModalDraft;
  const editingCat = editCatId ? DB.getCategoryById(editCatId) : null;

  tempCatIcon = editingCat ? editingCat.icon : '🛍️';
  tempCatImage = editingCat ? editingCat.image : 'assets/images/hung_chien_gion.jpg';

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        <span>🏷️</span>
        <span>${editingCat ? 'Chỉnh sửa Loại mặt hàng' : 'Thêm Loại Mặt Hàng Tùy Chỉnh'}</span>
      </div>
      <button class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      <div class="delivery-input-group">
        <label class="delivery-input-label">Tên loại mặt hàng mới (*):</label>
        <input
          type="text"
          id="cat-editor-name"
          class="delivery-input-field"
          placeholder="VD: Đồ ăn vặt, Bánh ngọt, Trái cây tươi, Tạp hóa KTX..."
          value="${escapeHtml(editingCat ? editingCat.name : '')}"
        >
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Chọn biểu tượng (Icon Emoji):</label>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <input
            type="text"
            id="cat-editor-icon"
            class="delivery-input-field"
            style="width:76px; text-align:center; font-size:24px; padding:6px;"
            value="${escapeHtml(tempCatIcon)}"
            oninput="tempCatIcon = this.value"
          >
          <span style="font-size:12px; color:var(--gray-500);">Chọn nhanh bên dưới hoặc tự nhập emoji bất kỳ</span>
        </div>
        <div class="emoji-picker-grid">
          ${CATEGORY_EMOJI_PRESETS.map(em => `
            <button type="button" class="emoji-pick-btn ${tempCatIcon === em ? 'active' : ''}" onclick="selectCategoryEmoji('${em}', this)">
              ${em}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Ảnh đại diện danh mục (Chọn mẫu, dán URL hoặc tải ảnh từ máy):</label>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <img id="cat-editor-img-preview" src="${escapeHtml(tempCatImage)}" alt="Preview" style="width:52px; height:52px; border-radius:12px; object-fit:cover; border:1.5px solid var(--gray-200);">
          <input
            type="text"
            id="cat-editor-image"
            class="delivery-input-field"
            style="flex:1;"
            placeholder="Đường dẫn ảnh hoặc tải từ máy..."
            value="${escapeHtml(tempCatImage)}"
            oninput="tempCatImage = this.value; document.getElementById('cat-editor-img-preview').src = this.value;"
          >
          <label class="db-upload-btn">
            📁 Tải ảnh
            <input type="file" accept="image/*" style="display:none;" onchange="handleUploadCategoryImage(this)">
          </label>
        </div>
        <div class="preset-thumbs-row">
          ${PRESET_FOOD_IMAGES.slice(0, 7).map(p => `
            <img
              src="${p.path}"
              title="${p.label}"
              class="preset-thumb-img ${tempCatImage === p.path ? 'active' : ''}"
              onclick="selectCategoryPresetImage('${p.path}', this)"
            >
          `).join('')}
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Mô tả ngắn (Tùy chọn):</label>
        <input
          type="text"
          id="cat-editor-desc"
          class="delivery-input-field"
          placeholder="VD: Các món ăn vặt khuya phục vụ sinh viên KTX..."
          value="${escapeHtml(editingCat ? (editingCat.description || '') : '')}"
        >
      </div>

      <label class="db-checkbox-row">
        <input type="checkbox" id="cat-editor-visual" ${(!editingCat || editingCat.showInVisualSuggestions !== false) ? 'checked' : ''}>
        <span>Hiển thị loại mặt hàng này trên thanh Gợi ý hình ảnh khi tìm kiếm</span>
      </label>

      <div style="display:flex; gap:10px; margin-top:10px;">
        ${editingCat ? `
          <button type="button" class="db-danger-outline-btn" onclick="closeModal(); handleDeleteCategory('${escapeHtml(editingCat.id)}')">
            🗑️ Xóa loại
          </button>
        ` : ''}
        <button type="button" class="btn-primary-large" style="flex:1;" onclick="submitCategoryEditor('${editingCat ? escapeHtml(editingCat.id) : ''}')">
          💾 ${editingCat ? 'Lưu Cập Nhật ' : 'Tạo & Lưu  Loại Mặt Hàng'}
        </button>
      </div>
    </div>
  `;

  overlay.classList.add('active');
  setTimeout(() => document.getElementById('cat-editor-name')?.focus(), 80);
}

function selectCategoryEmoji(emoji, btnEl) {
  tempCatIcon = emoji;
  const input = document.getElementById('cat-editor-icon');
  if (input) input.value = emoji;
  document.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

function selectCategoryPresetImage(path, imgEl) {
  tempCatImage = path;
  const input = document.getElementById('cat-editor-image');
  const prev = document.getElementById('cat-editor-img-preview');
  if (input) input.value = path;
  if (prev) prev.src = path;
  document.querySelectorAll('.preset-thumb-img').forEach(i => i.classList.remove('active'));
  if (imgEl) imgEl.classList.add('active');
}

async function handleUploadCategoryImage(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await readAndCompressImageFile(file);
    tempCatImage = dataUrl;
    const input = document.getElementById('cat-editor-image');
    const prev = document.getElementById('cat-editor-img-preview');
    if (input) input.value = dataUrl;
    if (prev) prev.src = dataUrl;
    showToast('checkmarkFilled', 'Đã tải ảnh đại diện danh mục!');
  } catch (_) {
    showToast('alertRegular', 'Không thể đọc file ảnh này');
  }
}

function submitCategoryEditor(editCatId) {
  const name = document.getElementById('cat-editor-name')?.value.trim();
  const icon = document.getElementById('cat-editor-icon')?.value.trim() || tempCatIcon || '🛍️';
  const image = document.getElementById('cat-editor-image')?.value.trim() || tempCatImage;
  const description = document.getElementById('cat-editor-desc')?.value.trim() || '';
  const showVisual = document.getElementById('cat-editor-visual')?.checked !== false;

  if (!name) {
    showToast('alertRegular', 'Vui lòng nhập tên loại mặt hàng!');
    document.getElementById('cat-editor-name')?.focus();
    return;
  }

  let res;
  if (editCatId) {
    res = DB.updateCategory(editCatId, { name, icon, keyword: name, image, description, showInVisualSuggestions: showVisual });
  } else {
    res = DB.addCategory({ name, icon, keyword: name, image, description, showInVisualSuggestions: showVisual });
  }

  if (!res.ok) {
    showToast('alertRegular', res.message);
    return;
  }

  syncGlobalChromeUI();
  showToast('checkmarkFilled', `Đã lưu  loại mặt hàng "${res.category.icon} ${res.category.name}"!`);

  // Nếu người dùng mở tạo loại mới từ trong form Thêm Mặt Hàng, quay lại form Thêm Mặt Hàng với loại vừa tạo được chọn sẵn!
  if (pendingReturnToItemModal) {
    const draft = pendingReturnToItemModal;
    pendingReturnToItemModal = null;
    openItemEditorModal(draft.editItemId || null, res.category.id, draft);
    return;
  }

  closeModal();
  render();
}

// =========================================================================
// MODAL 2: THÊM / SỬA MẶT HÀNG TRONG DATABASE (ITEM EDITOR MODAL)
// =========================================================================

let tempItemSizes = [];
let tempItemToppings = [];
let tempItemImage = 'assets/images/hung_chien_gion.jpg';

function openItemEditorModal(editItemId = null, preselectedCatId = null, restoredDraft = null) {
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  const editingItem = editItemId ? DB.getItemById(editItemId) : null;
  const allCats = DB.getCategories();
  const allStores = DB.data.restaurants;

  const selectedCatId = preselectedCatId
    || (editingItem ? editingItem.categoryId : (allCats.find(c => c.isCustom)?.id || allCats[0]?.id));

  const selectedStoreId = restoredDraft?.restaurantId
    || (editingItem ? editingItem.restaurantId : 1000);

  tempItemImage = restoredDraft?.image || (editingItem ? editingItem.image : 'assets/images/hung_chien_gion.jpg');

  tempItemSizes = restoredDraft?.sizes
    || (editingItem && Array.isArray(editingItem.sizes) && editingItem.sizes.length > 0
      ? JSON.parse(JSON.stringify(editingItem.sizes))
      : [{ name: 'Phần Tiêu Chuẩn', extraPrice: 0 }, { name: 'Phần Lớn Đặc Biệt', extraPrice: 15000 }]);

  tempItemToppings = restoredDraft?.toppings
    || (editingItem && Array.isArray(editingItem.toppings)
      ? JSON.parse(JSON.stringify(editingItem.toppings))
      : []);

  const defaultNotes = restoredDraft?.notes
    ?? (editingItem && Array.isArray(editingItem.noteSuggestions)
      ? editingItem.noteSuggestions.join(', ')
      : 'Giao nóng, Đóng gói kỹ, Ít cay');

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        <span>📦</span>
        <span>${editingItem ? 'Chỉnh sửa Mặt hàng' : 'Thêm Mặt Hàng Mới vào Database'}</span>
      </div>
      <button class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      <!-- Tên mặt hàng & Giá bán -->
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Tên mặt hàng (*):</label>
          <input
            type="text"
            id="item-editor-name"
            class="delivery-input-field"
            placeholder="VD: Xoài Lắc Muối Tôm Tây Ninh"
            value="${escapeHtml(restoredDraft?.name ?? (editingItem ? editingItem.name : ''))}"
          >
        </div>

        <div class="delivery-input-group">
          <label class="delivery-input-label">Giá bán (VNĐ) (*):</label>
          <input
            type="number"
            id="item-editor-price"
            class="delivery-input-field"
            min="1000"
            step="1000"
            placeholder="VD: 35000"
            value="${restoredDraft?.price ?? (editingItem ? editingItem.price : 35000)}"
          >
        </div>
      </div>

      <!-- Loại mặt hàng + Nút Tạo loại tùy chỉnh ngay tại chỗ -->
      <div class="delivery-input-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="delivery-input-label" style="margin-bottom:0;">Thuộc Loại mặt hàng (*):</label>
          <button type="button" class="db-inline-link-btn" onclick="jumpToNewCategoryFromItemModal('${editingItem ? escapeHtml(editingItem.id) : ''}')">
            ➕ Thêm loại mặt hàng tùy chỉnh mới
          </button>
        </div>
        <select id="item-editor-category" class="delivery-input-field">
          ${allCats.map(c => `
            <option value="${escapeHtml(c.id)}" ${c.id === selectedCatId ? 'selected' : ''}>
              ${c.icon} ${escapeHtml(c.name)} ${c.isCustom ? '✨ (Tùy chỉnh)' : ''}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Gian hàng / Cửa hàng cung cấp -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Gian hàng / Quán cung cấp:</label>
        <select id="item-editor-store" class="delivery-input-field">
          ${allStores.slice().sort((a, b) => (b.id === 1000 ? 1 : 0) - (a.id === 1000 ? 1 : 0)).map(s => `
            <option value="${s.id}" ${Number(s.id) === Number(selectedStoreId) ? 'selected' : ''}>
              ${s.id === 1000 ? '🌟 ' : '🏪 '}${escapeHtml(s.name)}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Hình ảnh mặt hàng -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Hình ảnh mặt hàng:</label>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <img id="item-editor-img-preview" src="${escapeHtml(tempItemImage)}" alt="Preview" style="width:54px; height:54px; border-radius:12px; object-fit:cover; border:1.5px solid var(--gray-200);">
          <input
            type="text"
            id="item-editor-image"
            class="delivery-input-field"
            style="flex:1;"
            placeholder="URL ảnh hoặc chọn ảnh bên dưới..."
            value="${escapeHtml(tempItemImage)}"
            oninput="tempItemImage = this.value; document.getElementById('item-editor-img-preview').src = this.value;"
          >
          <label class="db-upload-btn">
            📁 Tải ảnh
            <input type="file" accept="image/*" style="display:none;" onchange="handleUploadItemImage(this)">
          </label>
        </div>
        <div class="preset-thumbs-row">
          ${PRESET_FOOD_IMAGES.map(p => `
            <img
              src="${p.path}"
              title="${p.label}"
              class="preset-thumb-img ${tempItemImage === p.path ? 'active' : ''}"
              onclick="selectItemPresetImage('${p.path}', this)"
            >
          `).join('')}
        </div>
      </div>

      <!-- Mô tả -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Mô tả chi tiết mặt hàng:</label>
        <textarea
          id="item-editor-desc"
          class="delivery-input-field"
          rows="2"
          placeholder="Mô tả hương vị, thành phần, đặc điểm nổi bật..."
        >${escapeHtml(restoredDraft?.description ?? (editingItem ? (editingItem.description || '') : ''))}</textarea>
      </div>

      <!-- Kích cỡ (Sizes) -->
      <div class="delivery-input-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="delivery-input-label" style="margin-bottom:0;">Phân loại Kích cỡ / Khẩu phần:</label>
          <button type="button" class="db-inline-link-btn" onclick="addItemSizeRow()">+ Thêm cỡ</button>
        </div>
        <div id="item-editor-sizes-list" class="db-dynamic-rows"></div>
      </div>

      <!-- Topping ăn kèm -->
      <div class="delivery-input-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="delivery-input-label" style="margin-bottom:0;">Topping / Tùy chọn thêm:</label>
          <button type="button" class="db-inline-link-btn" onclick="addItemToppingRow()">+ Thêm topping</button>
        </div>
        <div id="item-editor-toppings-list" class="db-dynamic-rows"></div>
      </div>

      <!-- Ghi chú gợi ý & Còn hàng -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Gợi ý ghi chú nhanh (ngăn cách bằng dấu phẩy):</label>
        <input
          type="text"
          id="item-editor-notes"
          class="delivery-input-field"
          placeholder="VD: Không hành, Ít đá, Nhiều sốt..."
          value="${escapeHtml(defaultNotes)}"
        >
      </div>

      <label class="db-checkbox-row">
        <input type="checkbox" id="item-editor-instock" ${(!editingItem || editingItem.inStock !== false) ? 'checked' : ''}>
        <span>Mặt hàng đang còn hàng & sẵn sàng nhận đơn</span>
      </label>

      <button type="button" class="btn-primary-large" style="margin-top:8px;" onclick="submitItemEditor('${editingItem ? escapeHtml(editingItem.id) : ''}')">
        💾 ${editingItem ? 'Cập Nhật & Lưu  Mặt Hàng' : 'Thêm & Lưu  Mặt Hàng'}
      </button>
    </div>
  `;

  renderItemSizesRows();
  renderItemToppingsRows();
  overlay.classList.add('active');
}

function renderItemSizesRows() {
  const wrap = document.getElementById('item-editor-sizes-list');
  if (!wrap) return;
  wrap.innerHTML = tempItemSizes.map((s, idx) => `
    <div class="db-dyn-row">
      <input type="text" class="delivery-input-field" placeholder="Tên cỡ (VD: Phần Lớn)" value="${escapeHtml(s.name)}" oninput="tempItemSizes[${idx}].name = this.value">
      <input type="number" class="delivery-input-field price-in" placeholder="+Giá" step="1000" min="0" value="${s.extraPrice || 0}" oninput="tempItemSizes[${idx}].extraPrice = Number(this.value)||0">
      ${tempItemSizes.length > 1 ? `<button type="button" class="db-row-del-btn" onclick="tempItemSizes.splice(${idx},1); renderItemSizesRows();">✕</button>` : ''}
    </div>
  `).join('');
}

function addItemSizeRow() {
  tempItemSizes.push({ name: 'Size Mới', extraPrice: 10000 });
  renderItemSizesRows();
}

function renderItemToppingsRows() {
  const wrap = document.getElementById('item-editor-toppings-list');
  if (!wrap) return;
  if (tempItemToppings.length === 0) {
    wrap.innerHTML = `<div style="font-size:12px; color:var(--gray-400); font-style:italic;">Chưa có topping thêm (bấm "+ Thêm topping" nếu cần)</div>`;
    return;
  }
  wrap.innerHTML = tempItemToppings.map((t, idx) => `
    <div class="db-dyn-row">
      <input type="text" class="delivery-input-field" placeholder="Tên topping (VD: Phô mai)" value="${escapeHtml(t.name)}" oninput="tempItemToppings[${idx}].name = this.value">
      <input type="number" class="delivery-input-field price-in" placeholder="Giá" step="1000" min="0" value="${t.price || 0}" oninput="tempItemToppings[${idx}].price = Number(this.value)||0">
      <button type="button" class="db-row-del-btn" onclick="tempItemToppings.splice(${idx},1); renderItemToppingsRows();">✕</button>
    </div>
  `).join('');
}

function addItemToppingRow() {
  tempItemToppings.push({ name: '', price: 10000 });
  renderItemToppingsRows();
}

function selectItemPresetImage(path, imgEl) {
  tempItemImage = path;
  const input = document.getElementById('item-editor-image');
  const prev = document.getElementById('item-editor-img-preview');
  if (input) input.value = path;
  if (prev) prev.src = path;
  document.querySelectorAll('.preset-thumb-img').forEach(i => i.classList.remove('active'));
  if (imgEl) imgEl.classList.add('active');
}

async function handleUploadItemImage(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await readAndCompressImageFile(file);
    tempItemImage = dataUrl;
    const input = document.getElementById('item-editor-image');
    const prev = document.getElementById('item-editor-img-preview');
    if (input) input.value = dataUrl;
    if (prev) prev.src = dataUrl;
    showToast('checkmarkFilled', 'Đã tải ảnh mặt hàng lên!');
  } catch (_) {
    showToast('alertRegular', 'Không thể đọc ảnh này');
  }
}

function jumpToNewCategoryFromItemModal(editItemId) {
  const draft = {
    editItemId: editItemId || null,
    name: document.getElementById('item-editor-name')?.value || '',
    price: document.getElementById('item-editor-price')?.value || 35000,
    restaurantId: document.getElementById('item-editor-store')?.value || 1000,
    image: document.getElementById('item-editor-image')?.value || tempItemImage,
    description: document.getElementById('item-editor-desc')?.value || '',
    notes: document.getElementById('item-editor-notes')?.value || '',
    sizes: tempItemSizes,
    toppings: tempItemToppings
  };
  openCategoryEditorModal(null, draft);
}

function submitItemEditor(editItemId) {
  const name = document.getElementById('item-editor-name')?.value.trim();
  const price = Number(document.getElementById('item-editor-price')?.value || 0);
  const categoryId = document.getElementById('item-editor-category')?.value;
  const restaurantId = Number(document.getElementById('item-editor-store')?.value || 1000);
  const image = document.getElementById('item-editor-image')?.value.trim() || tempItemImage;
  const description = document.getElementById('item-editor-desc')?.value.trim() || '';
  const notesRaw = document.getElementById('item-editor-notes')?.value || '';
  const inStock = document.getElementById('item-editor-instock')?.checked !== false;

  const noteSuggestions = notesRaw.split(',').map(s => s.trim()).filter(Boolean);

  let res;
  if (editItemId) {
    res = DB.updateItem(editItemId, {
      name,
      price,
      categoryId,
      restaurantId,
      image,
      description,
      sizes: tempItemSizes,
      toppings: tempItemToppings,
      noteSuggestions,
      inStock
    });
  } else {
    res = DB.addItem({
      name,
      price,
      categoryId,
      restaurantId,
      image,
      description,
      sizes: tempItemSizes,
      toppings: tempItemToppings,
      noteSuggestions,
      inStock
    });
  }

  if (!res.ok) {
    showToast('alertRegular', res.message);
    return;
  }

  closeModal();
  showToast('checkmarkFilled', `Đã lưu  mặt hàng "${res.item.name}" (${res.item.priceFormatted})!`);
  render();
}

// =========================================================================
// PHẦN B: GIAO DIỆN HỒ SƠ NGƯỜI DÙNG HOÀN CHỈNH (USER PROFILE DATABASE)
// Ghi nhớ toàn bộ người dùng đã tạo, SĐT, địa chỉ và lịch sử đơn đã đặt!
// =========================================================================

function openProfileView(subTab = null) {
  if (typeof saveCurrentViewScroll === 'function') {
    saveCurrentViewScroll();
  }
  currentView = 'profile';
  if (subTab) profileActiveTab = subTab;
  render();
  if (typeof restoreViewScroll === 'function') {
    restoreViewScroll('profile');
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

function switchProfileSubTab(tab) {
  profileActiveTab = tab;
  renderProfileView();
}

function toggleHiddenDbDrawer() {
  showHiddenDbDrawer = !showHiddenDbDrawer;
  renderProfileView();
}

let isProfileHeroExpanded = false;
function toggleProfileHeroExpand() {
  isProfileHeroExpanded = !isProfileHeroExpanded;
  const card = document.getElementById('profile-hero-card');
  const details = document.getElementById('profile-hero-details');
  const btn = document.getElementById('profile-hero-toggle-btn');
  const main = document.querySelector('.profile-hero-main');
  if (card && btn) {
    if (isProfileHeroExpanded) {
      card.classList.remove('collapsed');
      card.classList.add('expanded');
      if (details) {
        details.classList.remove('collapsed');
        details.classList.add('expanded');
      }
      btn.classList.add('expanded');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('title', 'Thu gọn thông tin & chức năng');
      if (main) main.classList.add('is-expanded');
    } else {
      card.classList.remove('expanded');
      card.classList.add('collapsed');
      if (details) {
        details.classList.remove('expanded');
        details.classList.add('collapsed');
      }
      btn.classList.remove('expanded');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('title', 'Mở rộng thông tin & chức năng');
      if (main) main.classList.remove('is-expanded');
    }
  } else {
    renderProfileView();
  }
}

function renderProfileView() {
  const activeUser = DB.getCurrentUser();
  const allUsers = DB.getUsers();
  if (!activeUser) return;

  const userOrders = activeUser.orders || [];
  const deliveringCount = userOrders.filter(o => o.categoryStatus === 'delivering').length;
  const completedOrders = userOrders.filter(o => o.categoryStatus !== 'cancelled');
  const totalSpent = completedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  app.innerHTML = `
    <div class="profile-view-container fade-in">
      <!-- Top Header -->
      <div class="page-nav-header">
        <button class="page-back-icon-btn" onclick="openHomeView()" aria-label="Về trang chủ">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Hồ Sơ & Tài Khoản</div>
        <div style="width: 36px;"></div>
      </div>

      <!-- Active User Profile Hero Card (Mặc định thu gọn, bấm nút để mở rộng) -->
      <div class="profile-hero-card ${isProfileHeroExpanded ? 'expanded' : 'collapsed'}" id="profile-hero-card">
        <div class="profile-hero-main ${isProfileHeroExpanded ? 'is-expanded' : ''}">
          <div class="profile-avatar-circle" onclick="openUserProfileModal('${escapeHtml(activeUser.id)}')" title="Bấm để đổi avatar & thông tin">
            ${activeUser.avatar || '👨‍🎓'}
          </div>
          <div class="profile-hero-info">
            <div class="profile-name-row">
              <span class="profile-hero-name">${escapeHtml(activeUser.name)}</span>
              <span class="profile-tier-badge">${escapeHtml(activeUser.memberTier || 'Thành viên')}</span>
            </div>
            <!-- Mỗi thông tin sđt, email, địa chỉ hiển thị trên đúng 1 dòng - mặc định thu gọn -->
            <div class="profile-hero-details ${isProfileHeroExpanded ? 'expanded' : 'collapsed'}" id="profile-hero-details">
              <div class="profile-detail-line" title="Số điện thoại: ${escapeHtml(activeUser.phone)}">
                <span class="profile-detail-icon">📞</span>
                <span class="profile-detail-text"><strong>${escapeHtml(activeUser.phone)}</strong></span>
              </div>
              ${activeUser.email ? `
                <div class="profile-detail-line" title="Email: ${escapeHtml(activeUser.email)}">
                  <span class="profile-detail-icon">✉️</span>
                  <span class="profile-detail-text">${escapeHtml(activeUser.email)}</span>
                </div>
              ` : ''}
              <div class="profile-detail-line" title="Địa chỉ: ${escapeHtml(activeUser.address)}">
                <span class="profile-detail-icon">📍</span>
                <span class="profile-detail-text"><strong>${escapeHtml(activeUser.addressLabel || 'Địa chỉ')}:</strong> ${escapeHtml(activeUser.address)}</span>
              </div>
            </div>
          </div>
          <button type="button" class="profile-hero-toggle-btn ${isProfileHeroExpanded ? 'expanded' : ''}" id="profile-hero-toggle-btn" onclick="toggleProfileHeroExpand()" aria-expanded="${isProfileHeroExpanded}" title="${isProfileHeroExpanded ? 'Thu gọn thông tin chi tiết' : 'Mở rộng thông tin chi tiết'}">
            ${FluentIcons.chevronDown}
          </button>
        </div>

        <!-- Tóm tắt Chế độ Người dùng, Cân nặng & Kcal Hàng ngày -->
        ${typeof renderProfileHealthSummaryStrip === 'function' ? renderProfileHealthSummaryStrip(activeUser) : ''}

        <!-- 4 Thống kê của người dùng đang đăng nhập -->
        <div class="profile-stats-row">
          <div class="profile-stat-item" onclick="openActivityView()">
            <div class="profile-stat-val">${userOrders.length}</div>
            <div class="profile-stat-lbl">Đơn đã đặt</div>
          </div>
          <div class="profile-stat-item" onclick="openActivityView()">
            <div class="profile-stat-val">${deliveringCount}</div>
            <div class="profile-stat-lbl">Đang giao</div>
          </div>
          <div class="profile-stat-item" onclick="openActivityView()">
            <div class="profile-stat-val">${formatVND(totalSpent)}</div>
            <div class="profile-stat-lbl">Đã chi tiêu</div>
          </div>
          <div class="profile-stat-item" onclick="openAccountSwitcherModal()">
            <div class="profile-stat-val">${(activeUser.savedAddresses || []).length}</div>
            <div class="profile-stat-lbl">Sổ địa chỉ</div>
          </div>
        </div>

        <!-- Các nút thao tác hồ sơ -->
        <div class="profile-hero-actions">
          <button class="profile-action-btn primary" onclick="openUserProfileModal('${escapeHtml(activeUser.id)}')">
            ✏️ Chỉnh sửa hồ sơ
          </button>
          <button class="profile-action-btn accent" onclick="openAccountSwitcherModal()">
            🔄 Chuyển tài khoản (${allUsers.length})
          </button>
          <button class="profile-action-btn outline" onclick="openAIChatView()">
            ✨ Trợ lý AI gợi món
          </button>
        </div>
      </div>

      <!-- Nội dung quản lý dinh dưỡng -->
      <div class="profile-subtab-content">
        ${typeof renderProfileNutritionManagerTab === 'function' ? renderProfileNutritionManagerTab(activeUser) : ''}
      </div>

      <!-- Ngăn Quản trị Cơ sở dữ liệu & Kho mặt hàng -->
      <div class="profile-hidden-admin-drawer">
        <button class="profile-hidden-admin-toggle" onclick="toggleHiddenDbDrawer()">
          <span>🗄️ Quản lý Cơ sở dữ liệu & Tạo mặt hàng bằng AI</span>
          <span class="drawer-chevron ${showHiddenDbDrawer ? 'open' : ''}">${FluentIcons.chevronDown}</span>
        </button>
        ${showHiddenDbDrawer ? `
          <div class="profile-hidden-admin-body">
            <div class="profile-hidden-admin-desc">
              Quản lý toàn diện <strong>${DB.getItems().length}</strong> mặt hàng, <strong>${DB.getStores ? DB.getStores().length : DB.data.restaurants.length}</strong> cửa hàng, <strong>${DB.getCategories().length}</strong> danh mục (thủ công & theo Tag), mã giảm giá, thư viện ảnh và hàng đợi AI tạo sản phẩm.
            </div>
            <div class="profile-hidden-admin-grid">
              <button class="profile-admin-tool-btn" onclick="openCatalogManagerView('items')">
                <span class="tool-emoji">📦</span>
                <div>
                  <div class="tool-title">Kho Mặt Hàng</div>
                  <div class="tool-sub">${DB.getItems().length} món • Giá, Tag, Dinh dưỡng</div>
                </div>
              </button>
              <button class="profile-admin-tool-btn" onclick="openCatalogManagerView('ai')">
                <span class="tool-emoji">✨</span>
                <div>
                  <div class="tool-title">AI Tạo Hàng (Queue)</div>
                  <div class="tool-sub">Tạo liền 5 món theo chủ đề</div>
                </div>
              </button>
              <button class="profile-admin-tool-btn" onclick="openCatalogManagerView('stores')">
                <span class="tool-emoji">🏪</span>
                <div>
                  <div class="tool-title">Cửa Hàng & Địa Điểm</div>
                  <div class="tool-sub">${DB.getStores ? DB.getStores().length : DB.data.restaurants.length} cửa hàng đang hoạt động</div>
                </div>
              </button>
              <button class="profile-admin-tool-btn" onclick="openCatalogManagerView('categories')">
                <span class="tool-emoji">🏷️</span>
                <div>
                  <div class="tool-title">Danh Mục & Tag</div>
                  <div class="tool-sub">Ẩn/hiện trang chủ & theo Tag</div>
                </div>
              </button>
              <button class="profile-admin-tool-btn" onclick="openCatalogManagerView('vouchers')">
                <span class="tool-emoji">🎟️</span>
                <div>
                  <div class="tool-title">Mã Giảm Giá</div>
                  <div class="tool-sub">${DB.getVouchers ? DB.getVouchers().length : 0} mã toàn sàn & theo món</div>
                </div>
              </button>
              <button class="profile-admin-tool-btn" onclick="openCatalogManagerView('images')">
                <span class="tool-emoji">🖼️</span>
                <div>
                  <div class="tool-title">Thư Viện Ảnh</div>
                  <div class="tool-sub">Thả ảnh & gắn nhiều món</div>
                </div>
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="bottom-spacer"></div>
    </div>
  `;
}

function renderRememberedUsersTab(allUsers, activeUser) {
  const q = profileUserSearchQuery.toLowerCase().trim();
  const qNormPhone = normalizePhone(profileUserSearchQuery);

  const filteredUsers = allUsers.filter(u => {
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      (qNormPhone && normalizePhone(u.phone).includes(qNormPhone)) ||
      (u.address || '').toLowerCase().includes(q)
    );
  });

  return `
    <div class="db-controls-card">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
        <div>
          <div style="font-size:15px; font-weight:800; color:var(--gray-900);">Danh bạ Người Dùng Đã Tạo & Ghi Nhớ</div>
          <div style="font-size:12px; color:var(--gray-500);">Hệ thống lưu  SĐT, địa chỉ nhận hàng và toàn bộ lịch sử đơn đặt của từng người dùng.</div>
        </div>
        <button class="db-primary-btn" onclick="openUserProfileModal(null)">
          ➕ Tạo hồ sơ mới
        </button>
      </div>

      <div class="db-search-input-wrap">
        <span>${FluentIcons.searchRegular}</span>
        <input
          type="text"
          placeholder="Tìm hoặc tra cứu nhanh người dùng theo Số điện thoại, Họ tên, Địa chỉ..."
          value="${escapeHtml(profileUserSearchQuery)}"
          oninput="profileUserSearchQuery = this.value; updateRememberedUsersDOM();"
        >
        ${profileUserSearchQuery ? `<button onclick="profileUserSearchQuery=''; renderProfileView();">✕</button>` : ''}
      </div>
    </div>

    <div id="remembered-users-list-container">
      ${renderRememberedUsersGridHtml(filteredUsers, activeUser)}
    </div>
  `;
}

function renderRememberedUsersGridHtml(usersList, activeUser) {
  if (usersList.length === 0) {
    return `
      <div class="search-empty-state" style="padding:40px 20px;">
        <div class="search-empty-icon">👤</div>
        <div class="search-empty-title">Chưa tìm thấy người dùng khớp "${escapeHtml(profileUserSearchQuery)}"</div>
        <div class="search-empty-sub">Bạn có muốn tạo ngay hồ sơ mới với thông tin này để hệ thống ghi nhớ không?</div>
        <button class="db-primary-btn" style="margin-top:14px;" onclick="openUserProfileModal(null, '${escapeHtml(profileUserSearchQuery)}')">
          ➕ Tạo hồ sơ người dùng mới
        </button>
      </div>
    `;
  }

  return `
    <div class="remembered-users-grid">
      ${usersList.map(u => {
    const isCurrent = u.id === activeUser.id;
    const ordersCount = (u.orders || []).length;
    const addrCount = (u.savedAddresses || []).length;
    const spent = (u.orders || [])
      .filter(o => o.categoryStatus !== 'cancelled')
      .reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
    const latestOrder = (u.orders && u.orders.length > 0) ? u.orders[0] : null;
    const uHp = typeof getNormalizedUserHealthProfile === 'function' ? getNormalizedUserHealthProfile(u) : null;
    const uPersona = (uHp && typeof getPersonaMeta === 'function') ? getPersonaMeta(uHp.personaType) : null;

    return `
          <div class="user-record-card ${isCurrent ? 'active-user' : ''}">
            <div class="user-record-head">
              <div class="user-record-left">
                <div class="user-record-avatar">${u.avatar || '🧑‍🎓'}</div>
                <div>
                  <div class="user-record-name">
                    ${escapeHtml(u.name)}
                    ${isCurrent ? `<span class="active-user-pill">Đang sử dụng</span>` : ''}
                  </div>
                  <div class="user-record-tier">${escapeHtml(u.memberTier || 'Thành viên Mới')}</div>
                </div>
              </div>
              <div class="user-record-head-btns">
                <button class="db-icon-mini-btn" onclick="openHealthProfileSetupModal('${escapeHtml(u.id)}')" title="Thiết lập thể trạng & Kcal">🥗</button>
                <button class="db-icon-mini-btn" onclick="openUserProfileModal('${escapeHtml(u.id)}')" title="Chỉnh sửa thông tin">✏️</button>
                ${DB.getUsers().length > 1 ? `
                  <button class="db-icon-mini-btn danger" onclick="handleDeleteUserProfile('${escapeHtml(u.id)}')" title="Xóa hồ sơ">🗑️</button>
                ` : ''}
              </div>
            </div>

            <div class="user-record-details">
              ${uHp && uPersona ? `
                <div class="user-detail-line">
                  <span class="ud-icon">${uPersona.icon}</span>
                  <span><strong>Thể trạng:</strong> ${escapeHtml(uPersona.shortLabel)}${uHp.wantKeepFit ? ' • Giữ dáng' : ''} (${uHp.weightKg}kg • ${uHp.dailyCalorieGoal} kcal/ngày)</span>
                </div>
              ` : ''}
              <div class="user-detail-line">
                <span class="ud-icon">📞</span>
                <span><strong>SĐT:</strong> ${escapeHtml(u.phone)}</span>
              </div>
              <div class="user-detail-line">
                <span class="ud-icon">📍</span>
                <span><strong>Địa chỉ (${addrCount}):</strong> ${escapeHtml(u.address)}</span>
              </div>
              <div class="user-detail-line">
                <span class="ud-icon">🧾</span>
                <span><strong>Đơn đã đặt:</strong> ${ordersCount} đơn • Tổng ${formatVND(spent)}</span>
              </div>
              ${latestOrder ? `
                <div class="user-latest-order-box" onclick="switchAndInspectOrder('${escapeHtml(u.id)}', '${escapeHtml(latestOrder.orderId)}')">
                  <span>Đơn gần nhất: <strong>${escapeHtml(latestOrder.orderId)}</strong> (${escapeHtml(latestOrder.resName)})</span>
                  <span class="latest-order-price">${formatVND(latestOrder.totalAmount)} →</span>
                </div>
              ` : `
                <div class="user-latest-order-box empty">
                  <span>Chưa có đơn đặt hàng nào</span>
                </div>
              `}
            </div>

            <div class="user-record-footer">
              ${isCurrent ? `
                <button class="db-secondary-btn full" onclick="switchProfileSubTab('orders')">
                  🧾 Xem ${ordersCount} đơn hàng của tôi
                </button>
              ` : `
                <button class="db-primary-btn full" onclick="handleSwitchUserProfile('${escapeHtml(u.id)}')">
                  🔄 Chuyển sang hồ sơ "${escapeHtml(u.name)}"
                </button>
              `}
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function updateRememberedUsersDOM() {
  const container = document.getElementById('remembered-users-list-container');
  const activeUser = DB.getCurrentUser();
  if (!container || !activeUser) return;
  const q = profileUserSearchQuery.toLowerCase().trim();
  const qNormPhone = normalizePhone(profileUserSearchQuery);
  const filtered = DB.getUsers().filter(u => {
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      (qNormPhone && normalizePhone(u.phone).includes(qNormPhone)) ||
      (u.address || '').toLowerCase().includes(q)
    );
  });
  container.innerHTML = renderRememberedUsersGridHtml(filtered, activeUser);
}

function handleSwitchUserProfile(userId) {
  const res = DB.switchUser(userId);
  if (res.ok) {
    syncGlobalChromeUI();
    showToast('personFilled', `Đã chuyển sang tài khoản: ${res.user.name} (${res.user.phone})`);
    renderProfileView();
  }
}

function switchAndInspectOrder(userId, orderId) {
  const cur = DB.getCurrentUser();
  if (!cur || cur.id !== userId) {
    DB.switchUser(userId);
    syncGlobalChromeUI();
  }
  viewingOrderDetailId = orderId;
  openActivityView();
}

function handleDeleteUserProfile(userId) {
  const target = DB.getUsers().find(u => u.id === userId);
  if (!target) return;
  if (!confirm(`Xóa hồ sơ người dùng "${target.name}" (${target.phone}) và ${target.orders?.length || 0} đơn lịch sử của người dùng này?`)) return;
  const res = DB.deleteUser(userId);
  if (res.ok) {
    syncGlobalChromeUI();
    showToast('deleteRegular', `Đã xóa hồ sơ "${target.name}"`);
    renderProfileView();
  } else {
    showToast('alertRegular', res.message);
  }
}

function renderProfileOrdersTab(activeUser, userOrders) {
  if (userOrders.length === 0) {
    return `
      <div class="search-empty-state" style="padding: 48px 20px;">
        <div class="search-empty-icon">🧾</div>
        <div class="search-empty-title">${escapeHtml(activeUser.name)} chưa có đơn hàng nào</div>
        <div class="search-empty-sub">Mọi đơn hàng bạn đặt sẽ được ghi nhớ  trong hồ sơ của ${escapeHtml(activeUser.name)} (${escapeHtml(activeUser.phone)}).</div>
        <button class="db-primary-btn" style="margin-top:14px;" onclick="openSearchView()">
          🍜 Đặt món đầu tiên ngay
        </button>
      </div>
    `;
  }

  return `
    <div class="db-section-toolbar">
      <div>
        <div style="font-size:15px; font-weight:800; color:var(--gray-900);">Lịch sử Đơn Đã Đặt của ${escapeHtml(activeUser.name)}</div>
        <div style="font-size:12px; color:var(--gray-500);">Số điện thoại gắn liền: <strong>${escapeHtml(activeUser.phone)}</strong> • Tổng cộng ${userOrders.length} đơn hàng</div>
      </div>
      <button class="db-secondary-btn" onclick="openActivityView()">
        Mở trang Theo dõi đơn 🛵
      </button>
    </div>

    <div class="past-orders-list">
      ${userOrders.map(order => {
    const isDelivering = order.categoryStatus === 'delivering';
    const isCompleted = order.categoryStatus === 'completed';
    const badgeClass = isDelivering ? 'delivering' : (isCompleted ? 'completed' : 'cancelled');
    const badgeText = isDelivering
      ? `<span class="pulse-dot"></span> Đang giao`
      : (isCompleted ? `Giao thành công` : `Đã hủy đơn`);
    const itemsSummary = (order.items || []).map(it => `${it.quantity}x ${it.dishName || it.name}`).join(' • ');

    return `
          <div class="past-order-card" onclick="viewOrderDetail('${escapeHtml(order.orderId)}'); openActivityView();" style="cursor:pointer;">
            <div class="past-order-head">
              <div>
                <div class="past-order-res">${escapeHtml(order.resName)}</div>
                <div style="font-size:11px; color:var(--gray-400); margin-top:2px;">
                  Mã đơn: <strong style="color:var(--gray-700);">${escapeHtml(order.orderId)}</strong> • ${escapeHtml(order.orderTime)}
                </div>
              </div>
              <span class="past-order-status-badge ${badgeClass}">${badgeText}</span>
            </div>

            <div style="font-size:13px; font-weight:600; color:var(--gray-800); margin-bottom:6px;">
              ${escapeHtml(itemsSummary)}
            </div>

            <div style="font-size:12px; color:var(--gray-500); margin-bottom:10px;">
              📞 ${escapeHtml(order.recipientPhone)} • 📍 ${escapeHtml(order.deliveryAddress)}
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px dashed var(--gray-200);">
              <div style="font-size:15px; font-weight:800; color:var(--green-600);">
                ${formatVND(order.totalAmount)}
              </div>
              <div class="past-order-actions" onclick="event.stopPropagation()">
                <button class="past-order-btn secondary" onclick="viewingOrderDetailId='${escapeHtml(order.orderId)}'; openActivityView();">
                  Chi tiết
                </button>
                <button class="past-order-btn primary" onclick="reorderOrder('${escapeHtml(order.orderId)}')">
                  Đặt lại
                </button>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function renderProfileAddressesTab(activeUser) {
  const addrs = activeUser.savedAddresses || [];

  return `
    <div class="db-section-toolbar">
      <div>
        <div style="font-size:15px; font-weight:800; color:var(--gray-900);">Sổ Địa Chỉ Nhận Hàng của ${escapeHtml(activeUser.name)}</div>
        <div style="font-size:12px; color:var(--gray-500);">Lưu nhiều địa chỉ (KTX, Trường học, Nhà riêng, Văn phòng) để chọn 1 chạm khi đặt đơn.</div>
      </div>
      <button class="db-primary-btn" onclick="openSavedAddressModal()">
        ➕ Thêm địa chỉ mới
      </button>
    </div>

    <div class="saved-addresses-grid">
      ${addrs.map(addr => {
    const isCurrent = activeUser.address === addr.address;
    return `
          <div class="saved-addr-card ${isCurrent ? 'active' : ''}">
            <div class="saved-addr-top">
              <div class="saved-addr-label">
                <span>${addr.icon || '📍'}</span>
                <strong>${escapeHtml(addr.label)}</strong>
                ${isCurrent ? `<span class="active-user-pill">Đang giao đến đây</span>` : ''}
              </div>
              <div style="display:flex; gap:6px;">
                <button class="db-icon-mini-btn" onclick="openSavedAddressModal('${escapeHtml(addr.id)}')" title="Sửa">✏️</button>
                ${addrs.length > 1 ? `
                  <button class="db-icon-mini-btn danger" onclick="handleDeleteSavedAddress('${escapeHtml(addr.id)}')" title="Xóa">🗑️</button>
                ` : ''}
              </div>
            </div>

            <div class="saved-addr-recipient">${escapeHtml(addr.name)} • <strong>${escapeHtml(addr.phone)}</strong></div>
            <div class="saved-addr-text">${escapeHtml(addr.address)}</div>
            ${addr.note ? `<div class="saved-addr-note">💬 Ghi chú: ${escapeHtml(addr.note)}</div>` : ''}

            ${!isCurrent ? `
              <button class="db-secondary-btn" style="margin-top:10px; width:100%;" onclick="handleSelectSavedAddress('${escapeHtml(addr.id)}')">
                Chọn làm địa chỉ giao hàng hiện tại
              </button>
            ` : ''}
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function handleSelectSavedAddress(addrId) {
  const user = DB.getCurrentUser();
  if (!user) return;
  if (DB.selectSavedAddress(user.id, addrId)) {
    syncGlobalChromeUI();
    showToast('locationFilled', 'Đã đổi địa chỉ nhận hàng mặc định!');
    renderProfileView();
  }
}

function handleDeleteSavedAddress(addrId) {
  const user = DB.getCurrentUser();
  if (!user) return;
  if (!confirm('Xóa địa chỉ này khỏi sổ địa chỉ?')) return;
  if (DB.deleteSavedAddress(user.id, addrId)) {
    syncGlobalChromeUI();
    showToast('deleteRegular', 'Đã xóa địa chỉ đã lưu');
    renderProfileView();
  }
}

// =========================================================================
// MODAL: CHUYỂN TÀI KHOẢN & CHUYỂN NHANH ĐỊA CHỈ GIAO HÀNG
// =========================================================================

function openAccountSwitcherModal() {
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  const activeUser = DB.getCurrentUser();
  if (!sheet || !overlay || !activeUser) return;

  const users = DB.getUsers();
  const addrs = activeUser.savedAddresses || [];

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        <span>🔄</span>
        <span>Tài khoản & Địa chỉ giao hàng</span>
      </div>
      <button class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      <div class="acc-switch-section">
        <div class="acc-switch-head">
          <span class="acc-switch-title">Tài khoản (${users.length})</span>
          <button type="button" class="db-primary-btn" onclick="openUserProfileModal(null)">➕ Tạo mới</button>
        </div>
        <div class="acc-switch-list">
          ${users.map(u => {
    const isCurrent = u.id === activeUser.id;
    return `
              <div class="acc-switch-row ${isCurrent ? 'active' : ''}" onclick="${isCurrent ? '' : `switchAccountFromSwitcher('${escapeHtml(u.id)}')`}">
                <div class="acc-switch-avatar">${u.avatar || '🧑‍🎓'}</div>
                <div class="acc-switch-info">
                  <div class="acc-switch-name">${escapeHtml(u.name)}${isCurrent ? '<span class="active-user-pill">Đang dùng</span>' : ''}</div>
                  <div class="acc-switch-sub">${escapeHtml(u.phone)} • ${(u.orders || []).length} đơn</div>
                </div>
                ${users.length > 1 ? `
                  <button type="button" class="db-icon-mini-btn danger" title="Xóa tài khoản"
                    onclick="event.stopPropagation(); deleteAccountFromSwitcher('${escapeHtml(u.id)}')">🗑️</button>
                ` : ''}
              </div>
            `;
  }).join('')}
        </div>
      </div>

      <div class="acc-switch-section">
        <div class="acc-switch-head">
          <span class="acc-switch-title">Địa chỉ giao hàng của ${escapeHtml(activeUser.name)} (${addrs.length})</span>
          <button type="button" class="db-primary-btn" onclick="openSavedAddressModal()">➕ Thêm</button>
        </div>
        <div class="acc-switch-list">
          ${addrs.length === 0 ? `<div class="acc-switch-sub" style="padding:8px 2px;">Chưa có địa chỉ nào được lưu.</div>` : ''}
          ${addrs.map(a => {
    const isCurrent = activeUser.address === a.address;
    return `
              <div class="acc-switch-row ${isCurrent ? 'active' : ''}" onclick="${isCurrent ? '' : `selectAddressFromSwitcher('${escapeHtml(a.id)}')`}">
                <div class="acc-switch-avatar">${a.icon || '📍'}</div>
                <div class="acc-switch-info">
                  <div class="acc-switch-name">${escapeHtml(a.label)}${isCurrent ? '<span class="active-user-pill">Đang giao đến</span>' : ''}</div>
                  <div class="acc-switch-sub">${escapeHtml(a.address)}</div>
                </div>
                <button type="button" class="db-icon-mini-btn" title="Sửa"
                  onclick="event.stopPropagation(); openSavedAddressModal('${escapeHtml(a.id)}')">✏️</button>
                ${addrs.length > 1 ? `
                  <button type="button" class="db-icon-mini-btn danger" title="Xóa địa chỉ"
                    onclick="event.stopPropagation(); deleteAddressFromSwitcher('${escapeHtml(a.id)}')">🗑️</button>
                ` : ''}
              </div>
            `;
  }).join('')}
        </div>
      </div>
    </div>
  `;

  overlay.classList.add('active');
}

function switchAccountFromSwitcher(userId) {
  const res = DB.switchUser(userId);
  if (!res.ok) return;
  syncGlobalChromeUI();
  showToast('personFilled', `Đã chuyển sang tài khoản: ${res.user.name}`);
  render();
  openAccountSwitcherModal();
}

function deleteAccountFromSwitcher(userId) {
  const target = DB.getUsers().find(u => u.id === userId);
  if (!target) return;
  if (!confirm(`Xóa tài khoản "${target.name}" (${target.phone}) và ${target.orders?.length || 0} đơn lịch sử?`)) return;
  const res = DB.deleteUser(userId);
  if (!res.ok) {
    showToast('alertRegular', res.message);
    return;
  }
  syncGlobalChromeUI();
  showToast('deleteRegular', `Đã xóa tài khoản "${target.name}"`);
  render();
  openAccountSwitcherModal();
}

function selectAddressFromSwitcher(addrId) {
  const user = DB.getCurrentUser();
  if (!user) return;
  if (DB.selectSavedAddress(user.id, addrId)) {
    syncGlobalChromeUI();
    showToast('locationFilled', 'Đã đổi địa chỉ nhận hàng!');
    render();
    openAccountSwitcherModal();
  }
}

function deleteAddressFromSwitcher(addrId) {
  const user = DB.getCurrentUser();
  if (!user) return;
  if (!confirm('Xóa địa chỉ này khỏi sổ địa chỉ?')) return;
  if (DB.deleteSavedAddress(user.id, addrId)) {
    syncGlobalChromeUI();
    showToast('deleteRegular', 'Đã xóa địa chỉ đã lưu');
    render();
    openAccountSwitcherModal();
  }
}

// =========================================================================
// MODAL 3: TẠO MỚI / CHỈNH SỬA HỒ SƠ NGƯỜI DÙNG (USER PROFILE MODAL)
// =========================================================================

let tempProfileAvatar = '👨‍🎓';
let tempProfileAddrLabel = 'PTIT Hà Đông';

function openUserProfileModal(editUserId = null, prefillQuery = '') {
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  const editingUser = editUserId ? DB.getUsers().find(u => u.id === editUserId) : null;
  tempProfileAvatar = editingUser ? (editingUser.avatar || '👨‍🎓') : '🧑‍🎓';
  tempProfileAddrLabel = editingUser ? (editingUser.addressLabel || 'PTIT Hà Đông') : 'Nhà riêng';

  const isPhonePrefill = prefillQuery && /^[0-9+\s.\-]{6,}$/.test(prefillQuery.trim());
  const defaultName = editingUser ? editingUser.name : (!isPhonePrefill ? prefillQuery : '');
  const defaultPhone = editingUser ? editingUser.phone : (isPhonePrefill ? prefillQuery : '');

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        <span>👤</span>
        <span>${editingUser ? 'Chỉnh Sửa Hồ Sơ Người Dùng' : 'Tạo Hồ Sơ Người Dùng Mới'}</span>
      </div>
      <button class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      <!-- Chọn Avatar -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Chọn Ảnh đại diện (Avatar):</label>
        <div class="emoji-picker-grid">
          ${USER_AVATAR_PRESETS.map(av => `
            <button type="button" class="emoji-pick-btn ${tempProfileAvatar === av ? 'active' : ''}" onclick="selectUserProfileAvatar('${av}', this)">
              ${av}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Họ và tên người dùng (*):</label>
          <input
            type="text"
            id="profile-modal-name"
            class="delivery-input-field"
            placeholder="VD: Lê Hoàng Nam"
            value="${escapeHtml(defaultName)}"
          >
        </div>

        <div class="delivery-input-group">
          <label class="delivery-input-label">Số điện thoại liên hệ (*):</label>
          <input
            type="tel"
            id="profile-modal-phone"
            class="delivery-input-field"
            placeholder="VD: 0912 888 999"
            value="${escapeHtml(defaultPhone)}"
          >
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Email / Mã sinh viên (Tùy chọn):</label>
        <input
          type="text"
          id="profile-modal-email"
          class="delivery-input-field"
          placeholder="VD: namlh.b23dccn@stu.ptit.edu.vn"
          value="${escapeHtml(editingUser ? (editingUser.email || '') : '')}"
        >
      </div>

      <div class="delivery-input-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="delivery-input-label" style="margin-bottom:0;">Địa chỉ giao hàng mặc định (*):</label>
          <button type="button" class="db-location-detect-btn" onclick="autoDetectProfileAddress()" title="Tự động lấy vị trí hiện tại từ GPS">
            📍 Lấy vị trí hiện tại
          </button>
        </div>
        <textarea
          id="profile-modal-address"
          class="delivery-input-field"
          rows="2"
          placeholder="Số nhà, tòa KTX, đường, phường/xã, quận/huyện..."
        >${escapeHtml(editingUser ? editingUser.address : '')}</textarea>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Nhãn địa chỉ:</label>
        <div class="delivery-tag-selector">
          ${['PTIT Hà Đông', 'KTX PTIT', 'Nhà riêng', 'Văn phòng'].map(lbl => `
            <div class="delivery-tag-btn ${tempProfileAddrLabel === lbl ? 'active' : ''}" onclick="selectProfileAddrLabel(this, '${lbl}')">
              ${lbl}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Ghi chú nhận hàng (Tòa nhà, sảnh, lời nhắn):</label>
        <input
          type="text"
          id="profile-modal-note"
          class="delivery-input-field"
          placeholder="VD: Gọi trước 5 phút, giao tại sảnh B2..."
          value="${escapeHtml(editingUser ? (editingUser.addressNote || '') : '')}"
        >
      </div>

      <button type="button" class="btn-primary-large" style="margin-top:8px;" onclick="submitUserProfileModal('${editingUser ? escapeHtml(editingUser.id) : ''}')">
        💾 ${editingUser ? 'Lưu Cập Nhật Hồ Sơ' : 'Tạo & Ghi Nhớ Người Dùng Này'}
      </button>
    </div>
  `;

  overlay.classList.add('active');
  setTimeout(() => document.getElementById('profile-modal-name')?.focus(), 80);
}

function selectUserProfileAvatar(av, btnEl) {
  tempProfileAvatar = av;
  document.querySelectorAll('.emoji-pick-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

function selectProfileAddrLabel(btnEl, lbl) {
  tempProfileAddrLabel = lbl;
  btnEl.parentElement.querySelectorAll('.delivery-tag-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
}

function autoDetectProfileAddress() {
  if (typeof detectCurrentLocation === 'function') {
    detectCurrentLocation((loc) => {
      const input = document.getElementById('profile-modal-address');
      if (input) {
        input.value = loc.address;
        input.focus();
      }
    });
  }
}

function submitUserProfileModal(editUserId) {
  const name = document.getElementById('profile-modal-name')?.value.trim();
  const phone = document.getElementById('profile-modal-phone')?.value.trim();
  const email = document.getElementById('profile-modal-email')?.value.trim();
  const address = document.getElementById('profile-modal-address')?.value.trim();
  const addressNote = document.getElementById('profile-modal-note')?.value.trim();

  if (phone && typeof isValidPhoneNumber === 'function' && !isValidPhoneNumber(phone)) {
    showToast('dismissCircleRegular', 'Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 03, 05, 07, 08, 09)!');
    return;
  }
  if (email && typeof isValidEmail === 'function' && !isValidEmail(email)) {
    showToast('dismissCircleRegular', 'Định dạng Email không hợp lệ (VD: user@ptit.edu.vn hoặc user@gmail.com)!');
    return;
  }

  let res;
  if (editUserId) {
    res = DB.updateUser(editUserId, {
      name,
      phone,
      email,
      avatar: tempProfileAvatar,
      address,
      addressLabel: tempProfileAddrLabel,
      addressNote
    });
  } else {
    res = DB.createUser({
      name,
      phone,
      email,
      avatar: tempProfileAvatar,
      address,
      addressLabel: tempProfileAddrLabel,
      addressNote,
      switchImmediately: true
    });
  }

  if (!res.ok) {
    if (res.existingUser && !editUserId) {
      if (confirm(`${res.message}\n\nBạn có muốn chuyển sang sử dụng hồ sơ "${res.existingUser.name}" đã được ghi nhớ không?`)) {
        DB.switchUser(res.existingUser.id);
        syncGlobalChromeUI();
        closeModal();
        showToast('personFilled', `Đã khôi phục hồ sơ: ${res.existingUser.name}`);
        render();
      }
      return;
    }
    showToast('alertRegular', res.message);
    return;
  }

  syncGlobalChromeUI();
  closeModal();
  showToast('checkmarkFilled', editUserId
    ? `Đã cập nhật hồ sơ "${res.user.name}"!`
    : `Đã tạo & ghi nhớ người dùng "${res.user.name}" (${res.user.phone})!`);
  render();
}

// =========================================================================
// MODAL 4: THÊM / SỬA ĐỊA CHỈ TRONG SỔ ĐỊA CHỈ CỦA USER
// =========================================================================

let tempSavedAddrLabel = 'Nhà riêng';

function openSavedAddressModal(editAddrId = null) {
  const user = DB.getCurrentUser();
  if (!user) return;
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  const editing = editAddrId ? (user.savedAddresses || []).find(a => a.id === editAddrId) : null;
  tempSavedAddrLabel = editing ? editing.label : 'Nhà riêng';

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        <span>📍</span>
        <span>${editing ? 'Sửa Địa Chỉ Đã Lưu' : 'Thêm Địa Chỉ Vào Sổ Địa Chỉ'}</span>
      </div>
      <button class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Người nhận tại địa chỉ này:</label>
          <input type="text" id="saved-addr-name" class="delivery-input-field" value="${escapeHtml(editing ? editing.name : user.name)}">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Số điện thoại nhận hàng:</label>
          <input type="tel" id="saved-addr-phone" class="delivery-input-field" value="${escapeHtml(editing ? editing.phone : user.phone)}">
        </div>
      </div>

      <div class="delivery-input-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="delivery-input-label" style="margin-bottom:0;">Địa chỉ chi tiết (*):</label>
          <button type="button" class="db-location-detect-btn" onclick="autoDetectSavedAddress()" title="Tự động lấy vị trí hiện tại từ GPS">
            📍 Lấy vị trí hiện tại
          </button>
        </div>
        <textarea id="saved-addr-detail" class="delivery-input-field" rows="2" placeholder="Số nhà, đường, phường, quận...">${escapeHtml(editing ? editing.address : '')}</textarea>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Tên gợi nhớ (Nhãn):</label>
        <div class="delivery-tag-selector">
          ${['PTIT Hà Đông', 'KTX PTIT', 'Nhà riêng', 'Văn phòng', 'Phòng trọ'].map(lbl => `
            <div class="delivery-tag-btn ${tempSavedAddrLabel === lbl ? 'active' : ''}" onclick="tempSavedAddrLabel='${lbl}'; this.parentElement.querySelectorAll('.delivery-tag-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active');">
              ${lbl}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Ghi chú cho tài xế:</label>
        <input type="text" id="saved-addr-note" class="delivery-input-field" placeholder="VD: Bấm chuông phòng 302..." value="${escapeHtml(editing ? (editing.note || '') : '')}">
      </div>

      <label class="db-checkbox-row">
        <input type="checkbox" id="saved-addr-current" checked>
        <span>Đặt làm địa chỉ nhận hàng hiện tại ngay</span>
      </label>

      <button type="button" class="btn-primary-large" style="margin-top:8px;" onclick="submitSavedAddressModal('${editing ? escapeHtml(editing.id) : ''}')">
        💾 Lưu Địa Chỉ 
      </button>
    </div>
  `;

  overlay.classList.add('active');
}

function autoDetectSavedAddress() {
  if (typeof detectCurrentLocation === 'function') {
    detectCurrentLocation((loc) => {
      const input = document.getElementById('saved-addr-detail');
      if (input) {
        input.value = loc.address;
        input.focus();
      }
    });
  }
}

function submitSavedAddressModal(editAddrId) {
  const user = DB.getCurrentUser();
  if (!user) return;
  const name = document.getElementById('saved-addr-name')?.value.trim();
  const phone = document.getElementById('saved-addr-phone')?.value.trim();
  const address = document.getElementById('saved-addr-detail')?.value.trim();
  const note = document.getElementById('saved-addr-note')?.value.trim();
  const setAsCurrent = document.getElementById('saved-addr-current')?.checked !== false;

  if (phone && typeof isValidPhoneNumber === 'function' && !isValidPhoneNumber(phone)) {
    showToast('dismissCircleRegular', 'Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 03, 05, 07, 08, 09)!');
    return;
  }

  const res = DB.addOrUpdateSavedAddress(user.id, {
    id: editAddrId || null,
    label: tempSavedAddrLabel,
    name,
    phone,
    address,
    note,
    setAsCurrent
  });

  if (!res.ok) {
    showToast('alertRegular', res.message);
    return;
  }

  syncGlobalChromeUI();
  closeModal();
  showToast('checkmarkFilled', 'Đã lưu địa chỉ vào hồ sơ người dùng!');
  render();
}

