/* ========================================
   ptitngon - App Giao Hàng Ẩm Thực Sinh Viên
   JavaScript - App Logic, Dish Details,
   Options Customizer, Cart & Checkout Flow
   ======================================== */

// ── Data ──

const quickOptions = [
  { iconKey: 'navigationRegular', label: 'Gần bạn', color: 'green', promo: null, action: () => openSearchView('', 'near') },
  { iconKey: 'truckRegular', label: 'Freeship', color: 'blue', promo: null, action: () => openSearchView('', 'freeship') },
  { iconKey: 'tagRegular', label: 'Khuyến mãi', color: 'orange', promo: 'HOT', action: () => openSearchView('', 'voucher') },
  { iconKey: 'starRegular', label: 'Yêu thích', color: 'yellow', promo: null, action: () => openSearchView('', 'rating45') },
  { iconKey: 'sparkleRegular', label: 'Mới nhất', color: 'purple', promo: null, action: () => showToast('sparkleRegular', 'Danh sách quán ngon quanh PTIT mới cập nhật hôm nay!') },
  { iconKey: 'flameRegular', label: 'Bán chạy', color: 'red', promo: null, action: () => openSearchView('Phở') },
  { iconKey: 'walletRegular', label: 'Giá sinh viên', color: 'teal', promo: null, action: () => openSearchView('', 'budget') },
  { iconKey: 'giftRegular', label: 'Ưu đãi', color: 'pink', promo: '50%', action: () => showToast('giftRegular', 'Đã lưu mã PTITNGON50 vào ví ưu đãi!') },
];

// foodCategories, visualSuggestions, and restaurants are imported from js/food-data.js (22 Quán & 110 Món Ăn)

const filterChips = [
  { iconKey: 'flameRegular', label: 'Phổ biến', active: true, filter: null },
  { iconKey: 'navigationRegular', label: 'Gần đây', active: false, filter: 'near' },
  { iconKey: 'starRegular', label: 'Đánh giá', active: false, filter: 'rating45' },
  { iconKey: 'truckRegular', label: 'Freeship', active: false, filter: 'freeship' },
  { iconKey: 'walletRegular', label: 'Giá tốt', active: false, filter: 'budget' },
];


// Chi tiết từng quán: tên, đánh giá đầy đủ, độ đắt, phí ship thường, thời gian ship, voucher, review ngắn, món ăn liên quan có giá tiền
// (restaurants, visualSuggestions & foodCategories loaded from js/food-data.js)

const topBanners = [
  {
    tag: 'Siêu Phẩm Hỏa Ngục 🔥',
    title: 'Hùng Chiên Giòn • Bộc Phá Uy Lực',
    desc: 'Giòn rụm bốc khói • Tặng mã HUNGCHENGION',
    cta: 'Thưởng thức ngay',
    icon: '🔥',
    promoMsg: '🔥 Đã mở khóa siêu phẩm Hùng Chiên Giòn Hỏa Ngục!',
    keyword: 'Hùng chiên giòn'
  },
  {
    tag: 'Đặc quyền PTITer 🎉',
    title: 'Món Ngon Nóng Hổi • Giảm 50%',
    desc: 'Freeship 0Đ • Áp dụng mã PTITNGON50',
    cta: 'Lấy mã ngay',
    icon: '🍜',
    promoMsg: '🎉 Đã lưu mã PTITNGON50 - Giảm 50% cho sinh viên PTIT!'
  },
  {
    tag: 'Freeship KTX 24/7',
    title: 'Đặt Đồ Ăn Giao Tận Sảnh KTX',
    desc: 'Giao siêu tốc 15 phút • Quán quanh trường',
    cta: 'Khám phá ngay',
    icon: '🚚',
    promoMsg: '🚚 Đã kích hoạt gói Freeship 0Đ toàn khu vực PTIT!'
  },
  {
    tag: 'Đặc sản 3 miền',
    title: 'Hương Vị Chuẩn Vị Mẹ Nấu',
    desc: 'Phở, Bánh mì, Bún chả nóng giòn',
    cta: 'Xem quán hot',
    icon: '🥖',
    promoMsg: '⭐ Đã mở bộ sưu tập Món ngon chuẩn vị Việt!'
  }
];

// ── App State ──
let currentView = 'home'; // 'home' | 'search' | 'activity' | 'cart' | 'checkout' | 'profile' | 'catalog'
let currentBannerIndex = 0;
let searchQuery = '';
let distanceFilter = null; // null | 1 | 2 | 5
let activeFilters = {
  near: false,
  rating45: false,
  freeship: false,
  budget: false,
  voucher: false,
};
let selectedVisualSuggestion = null;

// ── Global View Scroll Persistence (Mỗi tab độc lập hoàn toàn, không liên kết scroll) ──
const globalViewScrollPositions = {};

function saveCurrentViewScroll() {
  if (typeof currentView === 'string' && currentView) {
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    globalViewScrollPositions[currentView] = scrollY;
  }
}

function restoreViewScroll(targetView, fallbackY = 0) {
  const target = targetView || currentView;
  const savedY = (target && typeof globalViewScrollPositions[target] === 'number')
    ? globalViewScrollPositions[target]
    : fallbackY;
  window.scrollTo({ top: savedY, behavior: 'instant' });
  requestAnimationFrame(() => {
    window.scrollTo({ top: savedY, behavior: 'instant' });
  });
}

// ── User Delivery & Recipient Info (Đồng bộ trực tiếp với DB Hồ sơ người dùng) ──
let userDeliveryInfo = {
  name: 'Nguyễn Văn A',
  phone: '0901 234 567',
  email: 'nguyenvana@ptit.edu.vn',
  address: 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội',
  shortAddress: 'PTIT Km10 Trần Phú, Hà Đông',
  label: 'PTIT Hà Đông',
  note: 'Giao sảnh nhà A2 hoặc Cổng trường'
};

let savedAddressPresets = [];

// ── Activity & Orders State (Đồng bộ vĩnh viễn theo từng User trong database.json) ──
let activityFilter = 'all'; // 'all' | 'delivering' | 'completed' | 'cancelled'
let viewingOrderDetailId = null; // null: show 4-tab list; string: show full tracking detail of specific order!
let userRatingScore = 5;
let userRatingTags = ['Giao siêu nhanh ⚡', 'Món nóng hổi 🍲'];
let userReviewInputText = '';

const ratingTagOptions = [
  'Giao siêu nhanh ⚡',
  'Món nóng hổi 🍲',
  'Tài xế thân thiện 😊',
  'Đóng gói cẩn thận 📦',
  'Hương vị tuyệt vời 😋',
  'Đúng ghi chú ✍️'
];

let ordersList = [];

// ── Cart & Checkout State ──
let cart = []; // Array of { id, dishName, restaurantName, restaurantId, image, size, toppings, note, quantity, unitPrice, totalPrice }
let homeCatEditMode = false; // Chế độ sửa / gỡ ô danh mục ngay trên trang chủ
let appliedVoucher = null; // { code: 'PTITNGON50', discount: 50000, desc: 'Giảm 50K' }
let selectedPaymentMethod = 'qr'; // 'qr' | 'cod' | 'momo' | 'zalopay' | 'card'
let lastPlacedOrder = null;

// ── Modal State (Dish details & Customizer) ──
let modalDish = null;
let modalRestaurant = null;
let modalSelectedSizeIndex = 0;
let modalSelectedToppingIds = [];
let modalKitchenNote = '';
let modalQty = 1;

// ── DOM References ──
const app = document.getElementById('app');

// ── Formatters ──
function formatVND(num) {
  return (num || 0).toLocaleString('vi-VN') + 'đ';
}

// ── Main Render Router ──
function render() {
  // Sync active view state for AI chat (full-bleed layout)
  if (currentView === 'ai') {
    document.body.classList.add('view-ai-active');
  } else {
    document.body.classList.remove('view-ai-active');
  }

  // Sync Bottom Nav visibility: visible on main navigation views
  const navEl = document.querySelector('.bottom-nav');
  if (navEl) {
    if (
      currentView === 'home' ||
      currentView === 'search' ||
      currentView === 'activity' ||
      currentView === 'cart' ||
      currentView === 'profile' ||
      currentView === 'catalog' ||
      currentView === 'ai'
    ) {
      navEl.classList.remove('nav-hidden');
      navEl.style.display = 'flex';
    } else {
      navEl.classList.add('nav-hidden');
      navEl.style.display = 'none';
    }
  }

  // Update Bottom Nav & Sidebar active indicators
  updateBottomNavIconsAndState();

  updateFloatingCartBar();

  if (currentView === 'home') {
    renderHomeView();
  } else if (currentView === 'search') {
    renderSearchView();
  } else if (currentView === 'dish-detail' && typeof renderDishDetailView === 'function') {
    renderDishDetailView();
  } else if (currentView === 'dish-safety-nutrition' && typeof renderDishSafetyNutritionView === 'function') {
    renderDishSafetyNutritionView();
  } else if (currentView === 'activity') {
    renderActivityView();
  } else if (currentView === 'cart') {
    renderCartView();
  } else if (currentView === 'checkout') {
    renderCheckoutView();
  } else if (currentView === 'ai' && typeof renderAIChatView === 'function') {
    renderAIChatView();
  } else if (currentView === 'profile' && typeof renderProfileView === 'function') {
    renderProfileView();
  } else if (currentView === 'catalog' && typeof renderCatalogManagerView === 'function') {
    renderCatalogManagerView();
  } else if (currentView === 'order-success') {
    renderOrderSuccessView();
  }
}

// ========================================
// 1. HOME VIEW
// ========================================

function renderBannerHtml(b, idx) {
  return `
    <div class="top-banner-card" onclick="onBannerClick(${idx})">
      <button class="banner-arrow-btn prev" onclick="prevBanner(event)" title="Banner trước" aria-label="Banner trước">
        ${FluentIcons.chevronLeft || FluentIcons.prev}
      </button>
      <button class="banner-arrow-btn next" onclick="nextBanner(event)" title="Banner tiếp theo" aria-label="Banner tiếp theo">
        ${FluentIcons.chevronRight || FluentIcons.next}
      </button>
      <div class="top-banner-content">
        <div class="top-banner-tag">${b.tag}</div>
        <div class="top-banner-title">${b.title}</div>
        <div class="top-banner-desc">${b.desc}</div>
        <div class="top-banner-cta">
          <span>${b.cta}</span>
          <span class="top-banner-cta-icon">${FluentIcons.arrowRight}</span>
        </div>
      </div>
      <div class="top-banner-visual">
        <div class="top-banner-badge-icon">${b.icon}</div>
      </div>
    </div>
    <div class="top-banner-dots">
      ${topBanners.map((_, i) => `
        <span class="dot ${i === idx ? 'active' : ''}" onclick="setBanner(${i})"></span>
      `).join('')}
    </div>
  `;
}

function renderHomeView() {
  const currentBanner = topBanners[currentBannerIndex];
  const homeCats = typeof getHomeCategories === 'function' ? getHomeCategories() : foodCategories;
  const customCats = homeCats.filter(c => c.isCustom);
  const quickSearchCats = [...customCats, ...homeCats.filter(c => !c.isCustom)].slice(0, 6);

  // Lưu trữ vị trí cuộn ngang hiện tại của các khu vực trượt ngang
  const prevCatScrollLeft = document.getElementById('home-categories-scroll')?.scrollLeft || 0;
  const prevFoodCatScrollLeft = document.getElementById('food-categories-scroll')?.scrollLeft || 0;
  const prevResScrollLeft = document.getElementById('restaurants-scroll')?.scrollLeft || 0;
  const prevFeatScrollLeft = document.getElementById('home-featured-dishes-scroll')?.scrollLeft || 0;
  const prevCatSectionScrolls = {};
  document.querySelectorAll('.category-restaurants-scroll[id]').forEach(el => {
    if (el.scrollLeft > 0) prevCatSectionScrolls[el.id] = el.scrollLeft;
  });

  app.innerHTML = `
    <!-- Header -->
    <div class="header">
      <!-- Location -->
      <div class="location-row fade-in">
        <div class="location-left" onclick="openDeliveryInfoModal()">
          <div class="location-icon">${FluentIcons.locationFilled}</div>
          <div>
            <div class="location-label">Giao đến (${escapeHtml(userDeliveryInfo.label || 'Văn phòng')})</div>
            <div class="location-address">
              ${escapeHtml(userDeliveryInfo.shortAddress || userDeliveryInfo.address)}
              <span class="location-arrow">${FluentIcons.chevronDown}</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="header-btn" onclick="openAIChatView()" title="Chat AI tư vấn & gợi ý món ăn" aria-label="Chat AI">
            ✨
          </button>
          <button class="header-btn" onclick="openProfileView()" title="Hồ sơ & Danh bạ người dùng" aria-label="Tài khoản">
            ${FluentIcons.personRegular}
          </button>
        </div>
      </div>

      <!-- Top Cushion Banner (~30% screen buffer) -->
      <div class="top-banner-cushion fade-in">
        ${renderBannerHtml(currentBanner, currentBannerIndex)}
      </div>

      <!-- Greeting (Bigger font, grand & warm) -->
      <div class="greeting fade-in fade-in-delay-1">
        <div class="greeting-hello">Xin chào, ${escapeHtml(userDeliveryInfo.name || 'Bạn')}! 👋</div>
        <div class="greeting-question">Hôm nay bạn muốn ăn gì? <span class="wave">🍽️</span></div>
      </div>

      <!-- Search Bar on Home -->
      <div class="search-bar fade-in fade-in-delay-2" onclick="openSearchView()">
        <span class="search-bar-icon">${FluentIcons.searchRegular}</span>
        <input type="text" placeholder="Tìm món ăn, quán ăn, loại mặt hàng..." readonly style="cursor: pointer;">
        <button class="search-filter-btn" onclick="event.stopPropagation(); openSearchView('', 'near');" aria-label="Bộ lọc">
          ${FluentIcons.filterRegular}
        </button>
      </div>

      <!-- Quick Search Suggestions -->
      <div class="search-tags fade-in fade-in-delay-2">
        ${quickSearchCats.map(cat => `
          <span
            class="search-tag"
            style="${cat.keyword === 'Hùng chiên giòn'
      ? 'background: #fff1f0; border-color: #ffa39e; color: #cf1322; font-weight: 700;'
      : ''}"
            onclick="openSearchView('${escapeHtml(cat.keyword)}')"
          >${cat.icon} ${escapeHtml(cat.name)}</span>
        `).join('')}
      </div>
    </div>

    <!-- Quick Options -->
    <div class="quick-options fade-in fade-in-delay-3">
      <div class="quick-options-grid">
        ${quickOptions.map((opt, i) => `
          <div class="quick-option" onclick="handleQuickOptionClick(${i})">
            <div class="quick-option-icon ${opt.color}">
              ${FluentIcons[opt.iconKey]}
              ${opt.promo ? `<span class="promo-dot">${opt.promo}</span>` : ''}
            </div>
            <span class="quick-option-label">${opt.label}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Promo Banner -->
    <div class="promo-section fade-in fade-in-delay-4">
      <div class="promo-card" onclick="applyPromoCode('PTITNGON50')">
        <div class="promo-card-content">
          <div class="promo-card-tag">Ưu đãi sinh viên</div>
          <div class="promo-card-title">Giảm 50% cho PTITer</div>
          <div class="promo-card-sub">Tối đa 50K • Chạm để lưu mã PTITNGON50</div>
        </div>
        <div class="promo-card-emoji">🎉</div>
      </div>
    </div>

    <!-- Categories Filter Chips -->
    <div class="categories-section fade-in fade-in-delay-5">
      <div class="section-head">
        <div class="section-title">Khám phá nhanh</div>
        <div class="scroll-arrow-controls">
          <button class="scroll-arrow-btn small" onclick="scrollHorizontally('home-categories-scroll', -220)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
            ${FluentIcons.chevronLeft}
          </button>
          <button class="scroll-arrow-btn small" onclick="scrollHorizontally('home-categories-scroll', 220)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
            ${FluentIcons.chevronRight}
          </button>
        </div>
      </div>
      <div class="categories-scroll" id="home-categories-scroll">
        ${filterChips.map((chip, idx) => `
          <div class="category-chip ${chip.active ? 'active' : ''}" onclick="selectHomeFilterChip(${idx})">
            <span class="category-chip-icon">${FluentIcons[chip.iconKey]}</span>
            ${chip.label}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Food Category Grid (2 dòng gọn đẹp trên cả máy tính và điện thoại) -->
    <div class="food-categories-section fade-in">
      <div class="section-head">
        <div class="section-title">Danh mục món ăn</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="scroll-arrow-controls">
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('food-categories-scroll', -320)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('food-categories-scroll', 320)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
          <span class="section-see-all" onclick="openSearchView()">Xem tất cả</span>
        </div>
      </div>
      <div class="food-categories-grid" id="food-categories-scroll">
        ${homeCats.map(cat => `
          <div class="food-cat-item" onclick="openSearchView('${escapeHtml(cat.keyword)}')">
            <div class="food-cat-icon">${cat.icon}</div>
            <div class="food-cat-name">${escapeHtml(cat.name)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Featured Dishes Showcase (Chạm vào mặt hàng để xem mô tả, đánh giá, dinh dưỡng & an toàn thực phẩm) -->
    ${typeof renderHomeFeaturedDishesSection === 'function' ? renderHomeFeaturedDishesSection() : ''}

    <!-- Một số danh mục nổi bật hiển thị dưới dạng restaurants-section -->
    ${typeof renderHomeCategoryRestaurantSections === 'function' ? renderHomeCategoryRestaurantSections() : ''}

    <!-- Popular Restaurants & Highlight Dishes with Convenient '+' Button -->
    <div class="restaurants-section fade-in">
      <div class="section-head">
        <div class="section-title">Quán ăn nổi bật gần bạn</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="scroll-arrow-controls">
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('restaurants-scroll', -280)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('restaurants-scroll', 280)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
          <span class="section-see-all" onclick="openSearchView()">Xem tất cả</span>
        </div>
      </div>
      <div class="restaurants-scroll" id="restaurants-scroll">
        ${(() => {
          const activeStores = restaurants.filter(r => Number(r.id) !== 1000 || (Array.isArray(r.relatedDishes) && r.relatedDishes.length > 0));
          const displayStores = typeof dbmFairShuffle === 'function'
            ? dbmFairShuffle(activeStores, 'home-popular-stores')
            : activeStores;
          return displayStores.map(r => {
            const availDishes = (r.relatedDishes || []).filter(d => d.inStock !== false);
            const highlightDish = availDishes.length > 0
              ? (typeof dbmFairShuffle === 'function' ? dbmFairShuffle(availDishes, `store-highlight-${r.id}`)[0] : availDishes[0])
              : null;
            return `
          <div class="restaurant-card" onclick="openSearchView('${escapeHtml(r.name)}')">
            <div class="restaurant-card-img-wrapper">
              <img class="restaurant-card-img" src="${r.image}" alt="${escapeHtml(r.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
              ${r.badge ? `<span class="restaurant-card-badge">${escapeHtml(r.badge)}</span>` : ''}
              <button class="restaurant-card-fav" onclick="event.stopPropagation(); toggleFav(${r.id})">
                ${r.fav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
              </button>
            </div>
            <div class="restaurant-card-body">
              <div class="restaurant-card-name">${escapeHtml(r.name)}</div>
              ${highlightDish ? `<div class="restaurant-card-subdish">🍽️ ${escapeHtml(highlightDish.name)} • <strong>${formatVND(highlightDish.price)}</strong></div>` : ''}
              <div class="restaurant-card-meta">
                <span class="restaurant-card-rating">${FluentIcons.starFilled} ${r.rating}</span>
                <span class="restaurant-card-dot"></span>
                <span style="display:inline-flex;align-items:center;gap:3px;">${FluentIcons.clockRegular} ${r.deliveryTime}</span>
                <span class="restaurant-card-dot"></span>
                <span style="display:inline-flex;align-items:center;gap:3px;">${FluentIcons.locationRegular} ${r.distanceText}</span>
              </div>
            </div>
          </div>
        `;
          }).join('');
        })()}
      </div>
    </div>

    <!-- Bottom spacer for nav -->
    <div class="bottom-spacer"></div>
  `;

  // Phục hồi vị trí cuộn ngang mượt mà cho các dãy cuộn trên trang chủ
  if (prevCatScrollLeft > 0) {
    const el = document.getElementById('home-categories-scroll');
    if (el) el.scrollLeft = prevCatScrollLeft;
  }
  if (prevFoodCatScrollLeft > 0) {
    const el = document.getElementById('food-categories-scroll');
    if (el) el.scrollLeft = prevFoodCatScrollLeft;
  }
  if (prevResScrollLeft > 0) {
    const el = document.getElementById('restaurants-scroll');
    if (el) el.scrollLeft = prevResScrollLeft;
  }
  if (prevFeatScrollLeft > 0) {
    const el = document.getElementById('home-featured-dishes-scroll');
    if (el) el.scrollLeft = prevFeatScrollLeft;
  }
  Object.entries(prevCatSectionScrolls).forEach(([id, left]) => {
    const el = document.getElementById(id);
    if (el) el.scrollLeft = left;
  });
}

// ========================================
// 2. SEARCH VIEW & RESULTS
// ========================================

function getFilteredRestaurants() {
  let list = [...restaurants];

  // Text search query (matches restaurant name, category, review, OR individual dish name/category!)
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(r => {
      const matchName = r.name.toLowerCase().includes(q);
      const matchCat = (r.category || '').toLowerCase().includes(q);
      const matchReview = (r.shortReview || '').toLowerCase().includes(q);
      const matchDish = r.relatedDishes.some(d =>
        d.name.toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q) ||
        (typeof dbmItemMatchesQuery === 'function' && dbmItemMatchesQuery(d, q))
      );
      return matchName || matchCat || matchReview || matchDish;
    });
  }

  // Distance filter
  if (distanceFilter !== null) {
    list = list.filter(r => r.distance <= distanceFilter);
  }

  // Multi-filters
  if (activeFilters.rating45) {
    list = list.filter(r => r.rating >= 4.8);
  }
  if (activeFilters.freeship) {
    list = list.filter(r => r.isFreeship);
  }
  if (activeFilters.budget) {
    list = list.filter(r => r.priceLevel === '$');
  }
  if (activeFilters.voucher) {
    list = list.filter(r => r.vouchers && r.vouchers.length > 0);
  }

  // Sort by nearest distance if 'near' is active
  if (activeFilters.near) {
    list.sort((a, b) => a.distance - b.distance);
  }

  return list;
}

function renderSearchEmptyStateHtml() {
  const qTrim = (searchQuery || '').trim();
  const matchedCat = qTrim
    ? foodCategories.find(c =>
      c.name.toLowerCase() === qTrim.toLowerCase() ||
      c.keyword.toLowerCase() === qTrim.toLowerCase()
    )
    : null;

  return `
    <div class="search-empty-state">
      <div class="search-empty-icon">${matchedCat ? matchedCat.icon : '🔍'}</div>
      <div class="search-empty-title">
        ${matchedCat
      ? `Chưa có quán nào phục vụ "${escapeHtml(matchedCat.name)}" trong bộ lọc hiện tại`
      : 'Không tìm thấy quán hoặc món ăn phù hợp'}
      </div>
      <div class="search-empty-sub">
        Hãy thử tìm với từ khóa khác hoặc đặt lại khoảng cách &amp; bộ lọc để khám phá các quán ngon quanh bạn nhé!
      </div>
      <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top: 14px;">
        <button 
          onclick="resetAllFilters()" 
          style="padding: 10px 22px; background: var(--green-500); color: white; border: none; border-radius: var(--r-full); font-weight: 700; font-size: 13px; cursor: pointer;"
        >
          Xem tất cả quán ăn
        </button>
      </div>
    </div>
  `;
}

function renderSearchView() {
  const filteredList = getFilteredRestaurants();

  app.innerHTML = `
    <div class="search-view fade-in">
      <!-- Sticky Search Header -->
      <div class="search-view-header">
        <button class="search-back-btn" onclick="openHomeView()" aria-label="Quay lại">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="search-view-input-box">
          <span class="search-icon">${FluentIcons.searchRegular}</span>
          <input 
            type="text" 
            placeholder="Tìm món ngon, quán ăn, loại mặt hàng..." 
            id="search-view-input" 
            value="${escapeHtml(searchQuery)}"
            autocomplete="off"
            oninput="onSearchInputChange(this.value)"
          >
          ${searchQuery ? `
            <span class="search-clear-btn" onclick="clearSearch()" title="Xóa tìm kiếm">
              ${FluentIcons.dismiss}
            </span>
          ` : ''}
        </div>
        <button class="search-filter-toggle-btn" onclick="toggleSortNear()" title="Sắp xếp gần bạn">
          ${FluentIcons.filterRegular}
        </button>
      </div>

      <!-- Gợi ý hình ảnh (Visual Suggestions) -->
      <div class="visual-suggestions-section">
        <div class="visual-section-title">
          <span>Gợi ý món ngon & danh mục</span>
          <div style="display:inline-flex;align-items:center;gap:8px;">
            <div class="scroll-arrow-controls">
              <button class="scroll-arrow-btn small" onclick="scrollHorizontally('visual-suggestions-scroll', -200)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
                ${FluentIcons.chevronLeft}
              </button>
              <button class="scroll-arrow-btn small" onclick="scrollHorizontally('visual-suggestions-scroll', 200)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
                ${FluentIcons.chevronRight}
              </button>
            </div>
          </div>
        </div>
        <div class="visual-suggestions-scroll" id="visual-suggestions-scroll">
          ${visualSuggestions.map(item => {
    const isSelected = selectedVisualSuggestion === item.keyword;
    return `
              <div class="visual-card ${isSelected ? 'active' : ''}" onclick="selectVisualSuggestion('${escapeHtml(item.keyword)}')">
                <div class="visual-card-img-wrap">
                  <img class="visual-card-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                </div>
                <span class="visual-card-label">${escapeHtml(item.name)}</span>
              </div>
            `;
  }).join('')}
        </div>
      </div>

      <!-- Search Controls Bar: Distance & Filters -->
      <div class="search-controls-bar">
        <!-- Tìm kiếm quán ăn có gần hay không (Distance Chips) -->
        <div class="distance-chips-row">
          <span style="font-size: 11px; font-weight: 700; color: var(--gray-500); text-transform: uppercase;">Khoảng cách:</span>
          <div class="dist-chip ${distanceFilter === null ? 'active' : ''}" onclick="setDistanceFilter(null)">
            Tất cả
          </div>
          <div class="dist-chip ${distanceFilter === 1 ? 'active' : ''}" onclick="setDistanceFilter(1)">
            📍 &lt; 1 km (Đi bộ)
          </div>
          <div class="dist-chip ${distanceFilter === 2 ? 'active' : ''}" onclick="setDistanceFilter(2)">
            🛵 &lt; 2 km (Gần bạn)
          </div>
          <div class="dist-chip ${distanceFilter === 5 ? 'active' : ''}" onclick="setDistanceFilter(5)">
            🚀 &lt; 5 km (Toàn vùng)
          </div>
        </div>

        <!-- Filter Pills Row -->
        <div class="filter-pills-row">
          <div class="filter-pill-item ${activeFilters.near ? 'active' : ''}" onclick="toggleFilter('near')">
            <span>📍 Gần nhất</span>
          </div>
          <div class="filter-pill-item ${activeFilters.rating45 ? 'active' : ''}" onclick="toggleFilter('rating45')">
            <span>⭐ Đánh giá cao (4.8+)</span>
          </div>
          <div class="filter-pill-item ${activeFilters.freeship ? 'active' : ''}" onclick="toggleFilter('freeship')">
            <span>🚚 Freeship 0đ</span>
          </div>
          <div class="filter-pill-item ${activeFilters.budget ? 'active' : ''}" onclick="toggleFilter('budget')">
            <span>💵 Giá bình dân ($)</span>
          </div>
          <div class="filter-pill-item ${activeFilters.voucher ? 'active' : ''}" onclick="toggleFilter('voucher')">
            <span>🎟️ Có Voucher</span>
          </div>
        </div>
      </div>

      <!-- Results Summary Bar -->
      <div class="results-summary-bar">
        <span>Tìm thấy <strong>${filteredList.length}</strong> quán ăn phù hợp</span>
        <div style="display:flex; gap:12px; align-items:center;">
          ${(searchQuery || distanceFilter !== null || Object.values(activeFilters).some(Boolean)) ? `
            <span style="color: var(--green-600); cursor: pointer; font-weight: 600;" onclick="resetAllFilters()">
              Đặt lại bộ lọc
            </span>
          ` : ''}
        </div>
      </div>

      <!-- Detailed Restaurant Results List -->
      <div class="search-results-list">
        ${filteredList.length === 0 ? renderSearchEmptyStateHtml() : filteredList.map(renderRestaurantDetailCard).join('')}
      </div>

      <!-- Bottom spacer for nav -->
      <div class="bottom-spacer"></div>
    </div>
  `;

  const inputEl = document.getElementById('search-view-input');
  if (inputEl && !searchQuery) {
    setTimeout(() => inputEl.focus(), 80);
  }
}

// Helper: render a single restaurant card for search results
function renderRestaurantDetailCard(r) {
  const qLower = (searchQuery || '').toLowerCase().trim();
  const indexedDishes = r.relatedDishes.map((dish, originalIdx) => ({ dish, originalIdx }));
  if (qLower) {
    indexedDishes.sort((a, b) => {
      const aMatch = (a.dish.name.toLowerCase().includes(qLower) || (a.dish.category || '').toLowerCase().includes(qLower)) ? 1 : 0;
      const bMatch = (b.dish.name.toLowerCase().includes(qLower) || (b.dish.category || '').toLowerCase().includes(qLower)) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  return `
    <div class="res-detail-card">
      <!-- Restaurant Main Header Info -->
      <div class="res-main-info">
        <div class="res-main-img-wrap">
          <img class="res-main-img" src="${r.image}" alt="${escapeHtml(r.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
          ${r.badge ? `<span class="res-badge-partner">${escapeHtml(r.badge)}</span>` : ''}
        </div>

        <div class="res-details-col">
          <div class="res-name-row">
            <div class="res-name-title">${escapeHtml(r.name)}</div>
            <span class="res-fav-btn" onclick="toggleFav(${r.id})" title="Lưu quán yêu thích">
              ${r.fav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
            </span>
          </div>

          <!-- Đánh giá đầy đủ (Rating & reviewCount) -->
          <div class="res-rating-line">
            <span class="star-icon">${FluentIcons.starFilled}</span>
            <strong>${r.rating}</strong>
            <span class="res-rating-count">(${r.reviewCount})</span>
          </div>

          <!-- Meta Specs: Độ đắt, khoảng cách, thời gian ship, phí ship thường -->
          <div class="res-meta-specs">
            <span class="res-price-tier" title="Mức giá trung bình">${r.priceTier}</span>
            <span class="restaurant-card-dot"></span>
            <span>${FluentIcons.locationRegular} ${r.distanceText}</span>
            <span class="restaurant-card-dot"></span>
            <span>${FluentIcons.clockRegular} ${r.deliveryTime}</span>
            <span class="restaurant-card-dot"></span>
            <span class="res-shipping-info ${r.isFreeship ? 'freeship' : ''}">
              ${FluentIcons.truckRegular} Phí ship: ${r.shippingFee}
            </span>
          </div>
        </div>
      </div>

      <!-- Có Voucher (Voucher tags) -->
      ${r.vouchers && r.vouchers.length > 0 ? `
        <div class="res-vouchers-row">
          ${r.vouchers.map(v => `
            <span class="voucher-tag-pill">
              ${FluentIcons.tagRegular} ${v}
            </span>
          `).join('')}
        </div>
      ` : ''}

      <!-- Review ngắn của khách -->
      <div class="res-review-box">
        <span class="res-review-quote-icon">💬</span>
        <div>"${escapeHtml(r.shortReview)}"</div>
      </div>

      <!-- Ở dưới là các món ăn liên quan có giá tiền & NÚT CỘNG TIỆN LỢI -->
      <div class="res-dishes-section">
        <div class="res-dishes-header-row">
          <div class="res-dishes-label">Món ngon nổi bật (${r.relatedDishes.length} món • Chạm để chọn):</div>
          <div class="scroll-arrow-controls">
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('res-dishes-scroll-${r.id}', -220)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('res-dishes-scroll-${r.id}', 220)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
        </div>
        <div class="res-dishes-scroll" id="res-dishes-scroll-${r.id}">
          ${indexedDishes.map(({ dish, originalIdx }) => {
    const isOut = dish.inStock === false;
    return `
              <div class="dish-card-item ${isOut ? 'dish-out-of-stock' : ''}" onclick="${isOut ? `showToast('alertRegular', 'Món này hiện đang tạm hết hàng!')` : `openDishOptionModalByIndices(${r.id}, ${originalIdx})`}">
                <img class="dish-card-img" src="${dish.image}" alt="${escapeHtml(dish.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                <div class="dish-card-info">
                  <div class="dish-card-name" title="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</div>
                  <div class="dish-card-bottom">
                    <span class="dish-card-price">${dish.priceFormatted}</span>
                    ${isOut ? `
                      <span style="font-size:10px; font-weight:700; color:#dc2626;">Hết hàng</span>
                    ` : `
                      <button 
                        class="dish-add-btn" 
                        onclick="event.stopPropagation(); openDishOptionModalByIndices(${r.id}, ${originalIdx})"
                        title="Xem chi tiết & chọn option thêm vào giỏ"
                      >
                        +
                      </button>
                    `}
                  </div>
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
    </div>
  `;
}

function updateSearchResultsOnly() {
  const container = document.querySelector('.search-results-list');
  const summary = document.querySelector('.results-summary-bar');
  if (!container) return;

  const filteredList = getFilteredRestaurants();

  if (summary) {
    summary.innerHTML = `
      <span>Tìm thấy <strong>${filteredList.length}</strong> quán ăn phù hợp</span>
      <div style="display:flex; gap:12px; align-items:center;">
        ${(searchQuery || distanceFilter !== null || Object.values(activeFilters).some(Boolean)) ? `
          <span style="color: var(--green-600); cursor: pointer; font-weight: 600;" onclick="resetAllFilters()">
            Đặt lại bộ lọc
          </span>
        ` : ''}
      </div>
    `;
  }

  if (filteredList.length === 0) {
    container.innerHTML = renderSearchEmptyStateHtml();
  } else {
    container.innerHTML = filteredList.map(renderRestaurantDetailCard).join('');
  }
}

// ========================================
// 3. DISH DETAIL & OPTIONS MODAL (Xem món, Topping, Lưu ý, Số lượng)
// ========================================

function openDishOptionModalByIndices(resId, dishIdx) {
  const r = restaurants.find(x => x.id === resId);
  if (!r || !r.relatedDishes[dishIdx]) return;
  openDishOptionModal(r.relatedDishes[dishIdx], r);
}

function openDishOptionModal(dish, restaurant) {
  if (typeof openDishDetailView === 'function') {
    openDishDetailView(dish, restaurant);
    return;
  }
  modalDish = dish;
  modalRestaurant = restaurant;
  modalSelectedSizeIndex = 0;
  modalSelectedToppingIds = [];
  modalKitchenNote = '';
  modalQty = 1;

  renderDishOptionModal();

  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.add('active');
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function closeModalOnBackdrop(event) {
  if (event.target.id === 'modal-overlay') {
    closeModal();
  }
}

function calculateModalTotalPrice() {
  if (!modalDish) return 0;
  let price = modalDish.price;

  // Add size extra
  if (modalDish.sizes && modalDish.sizes[modalSelectedSizeIndex]) {
    price += (modalDish.sizes[modalSelectedSizeIndex].extraPrice || 0);
  }

  // Add toppings
  if (modalDish.toppings) {
    modalDish.toppings.forEach(top => {
      if (modalSelectedToppingIds.includes(top.id)) {
        price += top.price;
      }
    });
  }

  return price * modalQty;
}

function renderDishOptionModal() {
  const sheet = document.getElementById('modal-bottom-sheet');
  if (!sheet || !modalDish) return;

  const currentTotal = calculateModalTotalPrice();
  const sizes = modalDish.sizes || [{ name: 'Phần Tiêu Chuẩn', extraPrice: 0 }];
  const toppings = modalDish.toppings || [];
  const noteSuggestions = modalDish.noteSuggestions || ['Không hành', 'Nhiều ớt', 'Giao nóng', 'Để riêng nước'];

  sheet.innerHTML = `
    <!-- Modal Dish Header Image -->
    <div class="dish-modal-header">
      <img class="dish-modal-hero-img" src="${modalDish.image}" alt="${modalDish.name}">
      <button class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
      <button class="dish-modal-fav-btn" onclick="toggleFav(${modalRestaurant ? modalRestaurant.id : 1})" title="Yêu thích">
        ${(modalRestaurant && modalRestaurant.fav) ? FluentIcons.heartFilled : FluentIcons.heartRegular}
      </button>
    </div>

    <!-- Modal Body (Options Customizer) -->
    <div class="dish-modal-body">
      <!-- Title & Restaurant -->
      <div class="dish-modal-title-row">
        <div class="dish-modal-res-tag">
          ${FluentIcons.locationRegular} ${modalRestaurant ? modalRestaurant.name : 'Quán Ăn ptitngon'}
        </div>
        <div class="dish-modal-name">${modalDish.name}</div>
        <div class="dish-modal-desc">${modalDish.description || 'Món ăn chế biến nóng hổi, nguyên liệu tươi ngon chọn lọc hàng ngày.'}</div>
        <div class="dish-modal-price-row">
          <span class="dish-modal-base-price">${modalDish.priceFormatted}</span>
          <span class="dish-modal-rating">
            ${FluentIcons.starFilled} 4.9 (1.2k+ đã bán)
          </span>
        </div>
      </div>

      <!-- Option Group 1: Kích cỡ (Bắt buộc chọn 1) -->
      ${sizes.length > 1 ? `
        <div class="option-group-section" id="modal-size-group">
          <div class="option-group-header">
            <span class="option-group-title">Chọn kích cỡ tô/phần</span>
            <span class="option-group-badge required">Bắt buộc</span>
          </div>
          <div class="option-items-list">
            ${sizes.map((s, idx) => `
              <div 
                class="option-item-row size-option-row ${modalSelectedSizeIndex === idx ? 'selected' : ''}" 
                id="size-option-${idx}"
                data-size-idx="${idx}"
                onclick="setModalSize(${idx})"
              >
                <div class="option-item-left">
                  <div class="option-item-custom-radio"></div>
                  <span>${s.name}</span>
                </div>
                <span class="option-item-price">
                  ${s.extraPrice > 0 ? `+${formatVND(s.extraPrice)}` : 'Gốc'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Option Group 2: Topping chọn thêm (Nhiều lựa chọn) -->
      ${toppings.length > 0 ? `
        <div class="option-group-section" id="modal-topping-group">
          <div class="option-group-header">
            <span class="option-group-title">Topping ăn kèm thêm</span>
            <span class="option-group-badge optional">Tùy chọn</span>
          </div>
          <div class="option-items-list">
            ${toppings.map(top => {
    const isChecked = modalSelectedToppingIds.includes(top.id);
    return `
                <div 
                  class="option-item-row topping-option-row ${isChecked ? 'selected' : ''}" 
                  data-top-id="${top.id}"
                  onclick="toggleModalTopping('${top.id}', this)"
                >
                  <div class="option-item-left">
                    <div class="option-item-custom-checkbox">
                      <svg viewBox="0 0 12 12" fill="currentColor">
                        <path d="M10.28 2.28 4.5 8.06 1.72 5.28a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l6.5-6.5a.75.75 0 1 0-1.06-1.06Z"/>
                      </svg>
                    </div>
                    <span>${top.name}</span>
                  </div>
                  <span class="option-item-price">+${formatVND(top.price)}</span>
                </div>
              `;
  }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Option Group 3: Lưu ý cho quán (Ghi chú đặc biệt) -->
      <div class="dish-note-section">
        <div class="option-group-header">
          <span class="option-group-title">Lưu ý cho quán</span>
          <span class="option-group-badge optional">Không bắt buộc</span>
        </div>
        <textarea 
          class="dish-note-input" 
          placeholder="Ví dụ: Không hành, nhiều ớt tươi, để riêng nước chấm, quẩy nóng giòn..." 
          id="modal-kitchen-note"
          oninput="modalKitchenNote = this.value"
        >${escapeHtml(modalKitchenNote)}</textarea>
        <div class="note-suggestions-row">
          ${noteSuggestions.map(n => `
            <span class="note-chip" onclick="appendNoteSuggestion('${n}')">+ ${n}</span>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Modal Footer Action Bar (Quantity Stepper & Add to Cart) -->
    <div class="dish-modal-footer">
      <div class="dish-modal-qty-stepper">
        <button class="stepper-btn" onclick="changeModalQty(-1)" aria-label="Giảm">
          ${FluentIcons.subtractRegular}
        </button>
        <span class="stepper-count" id="modal-qty-display">${modalQty}</span>
        <button class="stepper-btn" onclick="changeModalQty(1)" aria-label="Tăng">
          ${FluentIcons.addRegular}
        </button>
      </div>

      <button class="dish-modal-submit-btn" onclick="confirmAddOptionToCart()">
        <span>Thêm vào giỏ</span>
        <span id="modal-submit-price">${formatVND(currentTotal)}</span>
      </button>
    </div>
  `;
}

function setModalSize(idx) {
  modalSelectedSizeIndex = Number(idx);

  // Directly update selected class on size rows
  const rows = document.querySelectorAll('.size-option-row, #modal-size-group .option-item-row');
  rows.forEach((r, i) => {
    if (i === Number(idx)) {
      r.classList.add('selected');
    } else {
      r.classList.remove('selected');
    }
  });

  updateModalPriceDisplays();
}

function toggleModalTopping(topId, rowEl) {
  const index = modalSelectedToppingIds.indexOf(topId);
  if (index > -1) {
    modalSelectedToppingIds.splice(index, 1);
  } else {
    modalSelectedToppingIds.push(topId);
  }

  const el = rowEl || document.querySelector(`.topping-option-row[data-top-id="${topId}"]`);
  if (el) {
    el.classList.toggle('selected', modalSelectedToppingIds.includes(topId));
  }

  updateModalPriceDisplays();
}

function changeModalQty(delta) {
  const newQty = modalQty + delta;
  if (newQty >= 1 && newQty <= 99) {
    modalQty = newQty;
    const qtyDisplay = document.getElementById('modal-qty-display');
    if (qtyDisplay) qtyDisplay.textContent = modalQty;
    updateModalPriceDisplays();
  }
}

function updateModalPriceDisplays() {
  const total = calculateModalTotalPrice();
  const submitPrice = document.getElementById('modal-submit-price');
  if (submitPrice) submitPrice.textContent = formatVND(total);
}

function appendNoteSuggestion(text) {
  const input = document.getElementById('modal-kitchen-note');
  if (input) {
    if (input.value.trim()) {
      input.value += `, ${text}`;
    } else {
      input.value = text;
    }
    modalKitchenNote = input.value;
  }
}

function confirmAddOptionToCart() {
  if (!modalDish) return;

  const size = (modalDish.sizes && modalDish.sizes[modalSelectedSizeIndex])
    ? modalDish.sizes[modalSelectedSizeIndex]
    : { name: 'Phần Tiêu Chuẩn', extraPrice: 0 };

  const selectedToppingsList = (modalDish.toppings || []).filter(t =>
    modalSelectedToppingIds.includes(t.id)
  );

  let unitPrice = modalDish.price + (size.extraPrice || 0);
  selectedToppingsList.forEach(t => unitPrice += t.price);

  const cartItem = {
    id: Date.now() + Math.random().toString(36).substring(2, 6),
    dishId: modalDish.id,
    dishName: modalDish.name,
    restaurantName: modalRestaurant ? modalRestaurant.name : 'ptitngon Kitchen',
    restaurantId: modalRestaurant ? modalRestaurant.id : 1,
    image: modalDish.image,
    size: size,
    toppings: selectedToppingsList,
    note: modalKitchenNote.trim(),
    quantity: modalQty,
    unitPrice: unitPrice,
    totalPrice: unitPrice * modalQty
  };

  cart.push(cartItem);
  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserCart(cart);
  }
  closeModal();
  updateFloatingCartBar();

  showToast('cartRegular', `Đã thêm ${modalQty}x "${modalDish.name}" (${formatVND(cartItem.totalPrice)}) vào giỏ!`);
}

// ========================================
// 3B. DELIVERY LOCATION & RECIPIENT MODAL (ĐỒNG BỘ DATABASE HỒ SƠ NGƯỜI DÙNG)
// ========================================

let tempDeliveryLabel = userDeliveryInfo.label || 'Văn phòng';

function openDeliveryInfoModal() {
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  tempDeliveryLabel = userDeliveryInfo.label || 'PTIT Hà Đông';
  const rememberedUsers = (typeof DB !== 'undefined' && DB.isReady) ? DB.getUsers() : [];
  const activeUser = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        ${FluentIcons.locationRegular}
        <span>Người nhận & Địa chỉ giao hàng</span>
      </div>
      <button class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      <!-- Quick Switch Remembered User Profiles -->
      ${rememberedUsers.length > 0 ? `
        <div class="delivery-input-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label class="delivery-input-label" style="margin-bottom:0;">Người dùng đã ghi nhớ (${rememberedUsers.length}):</label>
            <button type="button" class="db-inline-link-btn" onclick="openAccountSwitcherModal();">
              Quản lý hồ sơ →
            </button>
          </div>
          <div class="delivery-presets-row">
            ${rememberedUsers.map(u => `
              <div
                class="delivery-preset-chip ${activeUser && activeUser.id === u.id ? 'active' : ''}"
                onclick="switchUserInDeliveryModal('${escapeHtml(u.id)}')"
                title="SĐT: ${escapeHtml(u.phone)} • ${(u.orders || []).length} đơn đã đặt"
              >
                <span>${u.avatar || '🧑‍🎓'}</span>
                <span>${escapeHtml(u.name)} (${escapeHtml(u.phone)})</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Address presets of active user -->
      ${savedAddressPresets.length > 0 ? `
        <div class="delivery-input-group">
          <label class="delivery-input-label">Sổ địa chỉ của ${escapeHtml(userDeliveryInfo.name)} (Chọn 1 chạm):</label>
          <div class="delivery-presets-row">
            ${savedAddressPresets.map((p, idx) => `
              <div 
                class="delivery-preset-chip ${userDeliveryInfo.address === p.address ? 'active' : ''}" 
                onclick="selectAddressPreset(${idx})"
              >
                <span>${p.icon || '📍'}</span>
                <span>${escapeHtml(p.label)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Recipient Name -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Họ và tên người nhận món:</label>
        <input 
          type="text" 
          id="delivery-input-name" 
          class="delivery-input-field" 
          placeholder="Nhập họ tên người nhận" 
          value="${escapeHtml(userDeliveryInfo.name)}"
        >
      </div>

      <!-- Recipient Phone -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Số điện thoại liên hệ giao hàng (*):</label>
        <input 
          type="tel" 
          id="delivery-input-phone" 
          class="delivery-input-field" 
          placeholder="Nhập số điện thoại (VD: 0901 234 567)" 
          value="${escapeHtml(userDeliveryInfo.phone)}"
        >
      </div>

      <!-- Recipient Email -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Email liên hệ / Mã sinh viên (Tùy chọn):</label>
        <input 
          type="email" 
          id="delivery-input-email" 
          class="delivery-input-field" 
          placeholder="VD: sinhvien@stu.ptit.edu.vn" 
          value="${escapeHtml(userDeliveryInfo.email || (activeUser ? activeUser.email || '' : ''))}"
        >
      </div>

      <!-- Detail Address -->
      <div class="delivery-input-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="delivery-input-label" style="margin-bottom:0;">Địa chỉ nhận hàng chi tiết (*):</label>
          <button type="button" class="db-location-detect-btn" onclick="autoDetectDeliveryAddress()" title="Tự động lấy vị trí hiện tại từ GPS">
            📍 Lấy vị trí hiện tại
          </button>
        </div>
        <textarea 
          id="delivery-input-address" 
          class="delivery-input-field" 
          rows="2" 
          placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
        >${escapeHtml(userDeliveryInfo.address)}</textarea>
      </div>

      <!-- Address Label Tags -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Loại địa chỉ:</label>
        <div class="delivery-tag-selector">
          <div class="delivery-tag-btn ${tempDeliveryLabel === 'PTIT Hà Đông' ? 'active' : ''}" onclick="setDeliveryLabel(this, 'PTIT Hà Đông')">
            🎓 PTIT Hà Đông
          </div>
          <div class="delivery-tag-btn ${tempDeliveryLabel === 'KTX PTIT' ? 'active' : ''}" onclick="setDeliveryLabel(this, 'KTX PTIT')">
            🏢 KTX PTIT
          </div>
          <div class="delivery-tag-btn ${tempDeliveryLabel === 'Nhà riêng' ? 'active' : ''}" onclick="setDeliveryLabel(this, 'Nhà riêng')">
            🏠 Nhà riêng
          </div>
          <div class="delivery-tag-btn ${tempDeliveryLabel === 'Văn phòng' ? 'active' : ''}" onclick="setDeliveryLabel(this, 'Văn phòng')">
            💼 Văn phòng
          </div>
        </div>
      </div>

      <!-- Delivery Building Note -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">Ghi chú địa chỉ (Tòa nhà, số tầng...):</label>
        <input 
          type="text" 
          id="delivery-input-note" 
          class="delivery-input-field" 
          placeholder="VD: Giao sảnh nhà A2, gọi trước 5 phút..." 
          value="${escapeHtml(userDeliveryInfo.note || '')}"
        >
      </div>

      <label class="db-checkbox-row">
        <input type="checkbox" id="delivery-create-new-profile">
        <span>Tạo & ghi nhớ thành hồ sơ người dùng mới (nếu dùng SĐT mới)</span>
      </label>

      <!-- Save Button -->
      <button class="btn-primary-large" onclick="saveDeliveryInfo()" style="margin-top: 6px;">
        💾 Lưu Vĩnh Viễn & Áp Dụng Thông Tin
      </button>
    </div>
  `;

  overlay.classList.add('active');
}

function switchUserInDeliveryModal(userId) {
  if (typeof DB === 'undefined' || !DB.isReady) return;
  const res = DB.switchUser(userId);
  if (res.ok) {
    if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
    showToast('personFilled', `Đã chuyển sang người dùng: ${res.user.name} (${res.user.phone})`);
    openDeliveryInfoModal();
    if (currentView === 'home') renderHomeView();
    else if (currentView === 'checkout') renderCheckoutView();
  }
}

function setDeliveryLabel(btn, label) {
  tempDeliveryLabel = label;
  document.querySelectorAll('.delivery-tag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function selectAddressPreset(idx) {
  const p = savedAddressPresets[idx];
  if (!p) return;
  const nameInput = document.getElementById('delivery-input-name');
  const phoneInput = document.getElementById('delivery-input-phone');
  const addrInput = document.getElementById('delivery-input-address');
  const noteInput = document.getElementById('delivery-input-note');
  if (nameInput) nameInput.value = p.name;
  if (phoneInput) phoneInput.value = p.phone;
  if (addrInput) addrInput.value = p.address;
  if (noteInput) noteInput.value = p.note || '';
  tempDeliveryLabel = p.label;
  document.querySelectorAll('.delivery-tag-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(p.label));
  });
}

// ── Định vị GPS & Tự động lấy vị trí hiện tại ──
function detectCurrentLocation(callback) {
  if (!navigator.geolocation) {
    if (typeof showToast === 'function') {
      showToast('dismissCircleRegular', 'Trình duyệt không hỗ trợ định vị GPS!');
    }
    return;
  }

  if (typeof showToast === 'function') {
    showToast('locationRegular', 'Đang xác định tọa độ GPS vị trí hiện tại...');
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      let detectedAddress = '';

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
          signal: controller.signal,
          headers: { 'Accept-Language': 'vi' }
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            detectedAddress = data.display_name;
          }
        }
      } catch (_) { }

      if (!detectedAddress) {
        detectedAddress = `Tọa độ (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) - Khuôn viên Học viện CNBCVT (PTIT), Km10 Trần Phú, Hà Đông, Hà Nội`;
      }

      if (typeof showToast === 'function') {
        showToast('checkmarkFilled', 'Đã lấy vị trí hiện tại thành công!');
      }

      if (typeof callback === 'function') {
        callback({ latitude, longitude, address: detectedAddress });
      }
    },
    (err) => {
      console.warn('Geolocation error / permission denied:', err);
      const fallbackLoc = {
        latitude: 20.9806,
        longitude: 105.7876,
        address: 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội'
      };
      if (typeof showToast === 'function') {
        showToast('locationRegular', 'Đã lấy vị trí hiện tại tại Học viện PTIT Hà Đông');
      }
      if (typeof callback === 'function') {
        callback(fallbackLoc);
      }
    },
    { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
  );
}

function autoDetectDeliveryAddress() {
  detectCurrentLocation((loc) => {
    const input = document.getElementById('delivery-input-address');
    if (input) {
      input.value = loc.address;
      input.focus();
    }
  });
}

function saveDeliveryInfo() {
  const name = document.getElementById('delivery-input-name')?.value.trim() || 'Khách hàng';
  const phone = document.getElementById('delivery-input-phone')?.value.trim() || '0901 234 567';
  const email = document.getElementById('delivery-input-email')?.value.trim() || '';
  const address = document.getElementById('delivery-input-address')?.value.trim() || 'Học viện CNBCVT, Hà Đông, Hà Nội';
  const note = document.getElementById('delivery-input-note')?.value.trim() || '';
  const createNewProfile = document.getElementById('delivery-create-new-profile')?.checked;

  if (typeof isValidPhoneNumber === 'function' && !isValidPhoneNumber(phone)) {
    if (typeof showToast === 'function') {
      showToast('dismissCircleRegular', 'Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 03, 05, 07, 08, 09)!');
    }
    return;
  }
  if (email && typeof isValidEmail === 'function' && !isValidEmail(email)) {
    if (typeof showToast === 'function') {
      showToast('dismissCircleRegular', 'Định dạng Email không hợp lệ (VD: user@ptit.edu.vn hoặc user@gmail.com)!');
    }
    return;
  }

  if (typeof DB !== 'undefined' && DB.isReady) {
    const curUser = DB.getCurrentUser();
    const matchedByPhone = DB.findUserByPhone(phone);

    if (matchedByPhone && (!curUser || matchedByPhone.id !== curUser.id)) {
      // SĐT này thuộc về 1 người dùng đã từng tạo trước đó -> tự động khôi phục & cập nhật cho họ!
      DB.switchUser(matchedByPhone.id);
      DB.updateUser(matchedByPhone.id, {
        name,
        phone,
        email,
        address,
        addressLabel: tempDeliveryLabel || 'PTIT Hà Đông',
        addressNote: note
      });
    } else if (createNewProfile && !matchedByPhone) {
      DB.createUser({
        name,
        phone,
        email,
        address,
        addressLabel: tempDeliveryLabel || 'Nhà riêng',
        addressNote: note,
        switchImmediately: true
      });
    } else if (curUser) {
      DB.updateUser(curUser.id, {
        name,
        phone,
        email,
        address,
        addressLabel: tempDeliveryLabel || 'PTIT Hà Đông',
        addressNote: note
      });
    }
    if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
  } else {
    userDeliveryInfo = {
      name: name,
      phone: phone,
      email: email,
      address: address,
      shortAddress: address.length > 30 ? address.substring(0, 28) + '...' : address,
      label: tempDeliveryLabel || 'Văn phòng',
      note: note
    };
  }

  closeModal();
  showToast('locationRegular', `Đã lưu vĩnh viễn: ${name} (${phone}) • ${userDeliveryInfo.shortAddress}`);

  if (currentView === 'home') {
    renderHomeView();
  } else if (currentView === 'checkout') {
    renderCheckoutView();
  } else if (currentView === 'profile') {
    renderProfileView();
  }
}

// ========================================
// 4. FLOATING CART BAR
// ========================================

function updateFloatingCartBar() {
  const bar = document.getElementById('floating-cart-bar');
  const countEl = document.getElementById('floating-cart-count');
  const totalEl = document.getElementById('floating-cart-total');
  const badgeEl = document.getElementById('floating-cart-badge');
  const navBadgeEl = document.getElementById('cart-count');

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  if (navBadgeEl) {
    if (totalItems > 0) {
      navBadgeEl.textContent = totalItems;
      navBadgeEl.style.display = 'flex';
    } else {
      navBadgeEl.style.display = 'none';
    }
  }

  const desktopBadgeEl = document.getElementById('desktop-cart-count');
  if (desktopBadgeEl) {
    if (totalItems > 0) {
      desktopBadgeEl.textContent = totalItems;
      desktopBadgeEl.style.display = 'inline-flex';
    } else {
      desktopBadgeEl.style.display = 'none';
    }
  }

  const sidebarBadgeEl = document.getElementById('sidebar-cart-badge');
  if (sidebarBadgeEl) {
    if (totalItems > 0) {
      sidebarBadgeEl.textContent = totalItems;
      sidebarBadgeEl.style.display = 'inline-flex';
    } else {
      sidebarBadgeEl.style.display = 'none';
    }
  }

  if (bar) {
    const isCartVisible = totalItems > 0 && (currentView === 'home' || currentView === 'search');
    if (isCartVisible) {
      bar.classList.add('visible');
      bar.style.display = 'flex';
      if (countEl) countEl.textContent = `${totalItems} món ăn`;
      if (totalEl) totalEl.textContent = formatVND(subtotal);
      if (badgeEl) badgeEl.textContent = totalItems;
    } else {
      bar.classList.remove('visible');
      bar.style.display = 'none';
    }
  }
}

// ========================================
// 5. CART VIEW (Giao diện giỏ hàng đẹp mắt)
// ========================================

function openCartView() {
  saveCurrentViewScroll();
  currentView = 'cart';
  render();
  restoreViewScroll('cart');
}

function renderCartView() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingFee = subtotal > 150000 ? 0 : 15000;

  let discountAmount = (typeof computeVoucherDiscount === 'function') ? computeVoucherDiscount(appliedVoucher, subtotal, cart) : 0;
  const finalTotal = Math.max(0, subtotal + shippingFee - discountAmount);

  // Group by restaurant name
  const resName = cart.length > 0 ? cart[0].restaurantName : 'Quán ăn đối tác';

  app.innerHTML = `
    <div class="cart-view-container fade-in">
      <!-- Top Navigation Header -->
      <div class="page-nav-header">
        <button class="page-back-icon-btn" onclick="openHomeView()" aria-label="Quay lại">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Giỏ Hàng (${totalItems} món)</div>
        <div style="width: 36px;"></div>
      </div>

      ${cart.length === 0 ? `
        <!-- Empty Cart State -->
        <div class="search-empty-state" style="padding-top: 80px;">
          <div class="search-empty-icon" style="color: var(--gray-400); display: flex; justify-content: center;">
            ${FluentIcons.cartRegular}
          </div>
          <div class="search-empty-title">Giỏ hàng của bạn đang trống</div>
          <div class="search-empty-sub">Hãy khám phá các món ăn ngon lành và thêm vào giỏ nhé!</div>
          <button 
            onclick="openSearchView()" 
            style="margin-top: 20px; padding: 12px 24px; background: var(--green-500); color: white; border: none; border-radius: var(--r-full); font-weight: 700; font-size: 14px; cursor: pointer;"
          >
            Khám phá món ngon ngay
          </button>
        </div>
      ` : `
        <div class="cart-layout-grid">
          <div class="cart-left-col">
            <!-- Restaurant Header -->
            <div class="cart-res-summary-card">
              <div class="cart-res-info-col">
                <div class="cart-res-name">${resName}</div>
                <div class="cart-res-meta">
                  <span>${FluentIcons.locationRegular} 123 Nguyễn Huệ, Q.1</span>
                  <span>•</span>
                  <span>${FluentIcons.clockRegular} Giao 15-20 phút</span>
                </div>
              </div>
              <button 
                onclick="openSearchView()" 
                style="font-size: 12px; font-weight: 700; color: var(--green-600); cursor: pointer;"
              >
                + Thêm món
              </button>
            </div>

        <!-- Cart Items List -->
        <div class="cart-items-section">
          ${cart.map((item, idx) => `
            <div class="cart-item-card">
              <img class="cart-item-img" src="${item.image}" alt="${item.dishName}">
              <div class="cart-item-details">
                <div>
                  <div class="cart-item-name">${item.dishName}</div>
                  <div class="cart-item-options-text">
                    ${item.size && item.size.name ? item.size.name : ''}
                    ${item.toppings && item.toppings.length > 0 ? ` • ${item.toppings.map(t => t.name).join(', ')}` : ''}
                  </div>
                  ${item.note ? `
                    <div class="cart-item-note-text">💬 Lưu ý: "${item.note}"</div>
                  ` : ''}
                </div>

                <div class="cart-item-bottom-row">
                  <span class="cart-item-price">${formatVND(item.totalPrice)}</span>
                  
                  <div class="cart-item-actions">
                    <div class="dish-modal-qty-stepper" style="padding: 2px;">
                      <button class="stepper-btn" style="width: 26px; height: 26px;" onclick="updateCartItemQty(${idx}, -1)">
                        ${FluentIcons.subtractRegular}
                      </button>
                      <span class="stepper-count" style="font-size: 12px; min-width: 18px;">${item.quantity}</span>
                      <button class="stepper-btn" style="width: 26px; height: 26px;" onclick="updateCartItemQty(${idx}, 1)">
                        ${FluentIcons.addRegular}
                      </button>
                    </div>

                    <button class="cart-item-delete-btn" onclick="removeCartItem(${idx})" title="Xóa món">
                      ${FluentIcons.deleteRegular}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
            </div>
          </div>

          <div class="cart-right-col">
            <!-- Voucher Promotion Input Section -->
            <div class="cart-voucher-section">
          <div class="cart-voucher-card">
            ${FluentIcons.tagRegular}
            <input 
              type="text" 
              class="cart-voucher-input" 
              id="cart-voucher-input" 
              placeholder="Nhập mã: PTITNGON50 hoặc FREESHIP"
              value="${appliedVoucher ? appliedVoucher.code : ''}"
            >
            <button class="cart-voucher-apply-btn" onclick="handleApplyVoucherInput()">
              ${appliedVoucher ? 'Hủy' : 'Áp dụng'}
            </button>
          </div>
          ${appliedVoucher ? `
            <div style="font-size: 12px; color: var(--green-600); font-weight: 600; margin-top: 6px; padding-left: 4px;">
              🎉 Đã áp dụng mã ${appliedVoucher.code}: Giảm ${formatVND(discountAmount)}
            </div>
          ` : (typeof dbmRenderCartVoucherChipsHtml === 'function' ? dbmRenderCartVoucherChipsHtml(cart) : `
            <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
              <span class="note-chip" style="background:#fff1f0;border-color:#ffa39e;color:#cf1322;" onclick="applyPromoCode('HUNGCHIENGION')">🔥 HUNGCHIENGION (-50K)</span>
              <span class="note-chip" onclick="applyPromoCode('PTITNGON50')">⚡ PTITNGON50 (-50%)</span>
              <span class="note-chip" onclick="applyPromoCode('FREESHIP')">🚚 FREESHIP (0đ)</span>
            </div>
          `)}
        </div>

        <!-- Bill Breakdown Card -->
        <div class="cart-bill-section">
          <div class="cart-bill-card">
            <div class="bill-title">Chi tiết thanh toán</div>
            <div class="bill-row">
              <span>Tạm tính (${totalItems} món)</span>
              <span>${formatVND(subtotal)}</span>
            </div>
            <div class="bill-row">
              <span>Phí giao hàng</span>
              <span>${shippingFee === 0 ? '<strong style="color: var(--green-600);">Miễn phí</strong>' : formatVND(shippingFee)}</span>
            </div>
            ${discountAmount > 0 ? `
              <div class="bill-row discount">
                <span>Khuyến mãi Voucher</span>
                <span>-${formatVND(discountAmount)}</span>
              </div>
            ` : ''}
            <div class="bill-row total-row">
              <span>Tổng thanh toán</span>
              <span class="bill-total-price">${formatVND(finalTotal)}</span>
            </div>
          </div>
        </div>

            <!-- Sticky Bottom Checkout Button -->
            <div class="cart-bottom-bar">
              <button class="cart-checkout-btn" onclick="openCheckoutView()">
                <div style="text-align: left;">
                  <div style="font-size: 11px; font-weight: 500; opacity: 0.9;">Tổng cộng (${totalItems} món)</div>
                  <div style="font-size: 17px; font-weight: 800;">${formatVND(finalTotal)}</div>
                </div>
                <span style="display: flex; align-items: center; gap: 6px;">
                  Tiến hành thanh toán ${FluentIcons.arrowRight}
                </span>
              </button>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

function updateCartItemQty(idx, delta) {
  if (!cart[idx]) return;
  const newQty = cart[idx].quantity + delta;
  if (newQty <= 0) {
    removeCartItem(idx);
  } else {
    cart[idx].quantity = newQty;
    cart[idx].totalPrice = cart[idx].unitPrice * newQty;
    if (typeof DB !== 'undefined' && DB.isReady) {
      DB.saveCurrentUserCart(cart);
    }
    renderCartView();
    updateFloatingCartBar();
  }
}

function removeCartItem(idx) {
  if (!cart[idx]) return;
  const name = cart[idx].dishName;
  cart.splice(idx, 1);
  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserCart(cart);
  }
  renderCartView();
  updateFloatingCartBar();
  showToast('deleteRegular', `Đã xóa "${name}" khỏi giỏ hàng`);
}

function handleApplyVoucherInput() {
  if (appliedVoucher) {
    appliedVoucher = null;
    showToast('tagRegular', 'Đã hủy áp dụng mã giảm giá');
    renderCartView();
    return;
  }
  const input = document.getElementById('cart-voucher-input');
  if (input) {
    applyPromoCode(input.value.trim().toUpperCase());
  }
}

function applyPromoCode(code) {
  if (!code) return;
  const promo = (typeof dbmResolvePromo === 'function')
    ? dbmResolvePromo(code, cart)
    : { ok: false, message: `Mã "${code}" không hợp lệ` };
  if (!promo.ok) {
    showToast('alertRegular', promo.message);
    return;
  }
  appliedVoucher = promo.applied;
  showToast(promo.icon || 'giftRegular', promo.toast);
  if (currentView === 'cart') {
    renderCartView();
  }
}

// ========================================
// 6. CHECKOUT VIEW (Giao diện thanh toán)
// ========================================

function openCheckoutView() {
  if (cart.length === 0) {
    showToast('cartRegular', 'Giỏ hàng đang trống');
    return;
  }
  if (typeof getOrCreatePendingCheckoutOrderId === 'function') {
    getOrCreatePendingCheckoutOrderId();
  }
  saveCurrentViewScroll();
  currentView = 'checkout';
  render();
  restoreViewScroll('checkout', 0);
}

function renderCheckoutView() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingFee = subtotal > 150000 ? 0 : 15000;

  let discountAmount = (typeof computeVoucherDiscount === 'function') ? computeVoucherDiscount(appliedVoucher, subtotal, cart) : 0;
  const finalTotal = Math.max(0, subtotal + shippingFee - discountAmount);

  app.innerHTML = `
    <div class="checkout-view-container fade-in">
      <!-- Header -->
      <div class="page-nav-header">
        <button class="page-back-icon-btn" onclick="openCartView()" aria-label="Quay lại">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Xác Nhận Đơn Hàng</div>
        <div style="width: 36px;"></div>
      </div>

      <div class="checkout-layout-grid">
        <div class="checkout-left-col">
          <!-- Section 1: Delivery Address & Recipient -->
          <div class="checkout-section">
            <div class="checkout-card">
              <div class="checkout-card-header">
                <div class="checkout-card-title">
                  ${FluentIcons.locationRegular}
                  <span>Địa chỉ nhận hàng (${userDeliveryInfo.label || 'Văn phòng'})</span>
                </div>
                <span class="checkout-card-edit-btn" onclick="openDeliveryInfoModal()">
                  Thay đổi
                </span>
              </div>
              <div style="font-size: 14px; font-weight: 700; color: var(--gray-900); margin-bottom: 4px;">
                ${userDeliveryInfo.name} • ${userDeliveryInfo.phone}
              </div>
              <div style="font-size: 13px; color: var(--gray-600); line-height: 1.4;">
                ${userDeliveryInfo.address}
              </div>
              ${userDeliveryInfo.note ? `
                <div style="font-size: 12px; color: var(--gray-500); margin-top: 4px; font-style: italic;">
                  Ghi chú: ${userDeliveryInfo.note}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Section 2: Delivery Time & Notes -->
          <div class="checkout-section">
            <div class="checkout-card">
              <div class="checkout-card-header">
                <div class="checkout-card-title">
                  ${FluentIcons.clockRegular}
                  <span>Thời gian giao hàng</span>
                </div>
                <span style="font-size: 12px; font-weight: 700; color: var(--green-600);">Giao siêu tốc</span>
              </div>
              <div style="font-size: 13px; color: var(--gray-700); margin-bottom: 12px;">
                Dự kiến nhận món sau: <strong>15 - 20 phút</strong> (Tài xế đang sẵn sàng)
              </div>
              <input 
                type="text" 
                class="dish-note-input" 
                style="min-height: auto; padding: 10px 12px;"
                placeholder="Lời nhắn cho tài xế (VD: Giao sảnh A, gọi trước 5 phút...)"
                id="checkout-driver-note"
              >
            </div>
          </div>

          <!-- Section 3: Payment Methods -->
          <div class="checkout-section">
            <div class="checkout-card">
              <div class="checkout-card-header">
                <div class="checkout-card-title">
                  ${FluentIcons.walletRegular}
                  <span>Phương thức thanh toán</span>
                </div>
              </div>
              <div class="payment-methods-list">
                <!-- VietQR VPBank 0921030342 (Khuyên dùng) -->
                <div 
                  class="payment-method-row ${selectedPaymentMethod === 'qr' ? 'selected' : ''}" 
                  onclick="setPaymentMethod('qr')"
                >
                  <div class="payment-method-left">
                    <div class="payment-method-icon-wrap qr">📲</div>
                    <div>
                      <div class="payment-method-name">Chuyển khoản QR Ngân hàng (VietQR • VPBank)</div>
                      <div class="payment-method-sub">Quét mã tới VPBank • 0921030342 (Tự điền số tiền & nội dung)</div>
                    </div>
                  </div>
                  <div class="option-item-custom-radio ${selectedPaymentMethod === 'qr' ? 'selected' : ''}">
                    <svg class="radio-check-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="2.5 6.5 5 9 9.5 3.5"></polyline>
                    </svg>
                  </div>
                </div>

                <!-- MoMo QR 0866072227 -->
                <div 
                  class="payment-method-row ${selectedPaymentMethod === 'momo' ? 'selected' : ''}" 
                  onclick="setPaymentMethod('momo')"
                >
                  <div class="payment-method-left">
                    <div class="payment-method-icon-wrap momo">👛</div>
                    <div>
                      <div class="payment-method-name">Ví điện tử MoMo (Quét mã QR)</div>
                      <div class="payment-method-sub">Quét QR chuyển tới Ví MoMo • 0866072227 (Tự điền số tiền & nội dung)</div>
                    </div>
                  </div>
                  <div class="option-item-custom-radio ${selectedPaymentMethod === 'momo' ? 'selected' : ''}">
                    <svg class="radio-check-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="2.5 6.5 5 9 9.5 3.5"></polyline>
                    </svg>
                  </div>
                </div>

                <!-- ZaloPay -->
                <div 
                  class="payment-method-row ${selectedPaymentMethod === 'zalopay' ? 'selected' : ''}" 
                  onclick="setPaymentMethod('zalopay')"
                >
                  <div class="payment-method-left">
                    <div class="payment-method-icon-wrap zalopay">💙</div>
                    <div>
                      <div class="payment-method-name">Ví ZaloPay</div>
                      <div class="payment-method-sub">Tích điểm ZaloPay thưởng 10K</div>
                    </div>
                  </div>
                  <div class="option-item-custom-radio ${selectedPaymentMethod === 'zalopay' ? 'selected' : ''}">
                    <svg class="radio-check-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="2.5 6.5 5 9 9.5 3.5"></polyline>
                    </svg>
                  </div>
                </div>

                <!-- Cash COD -->
                <div 
                  class="payment-method-row ${selectedPaymentMethod === 'cod' ? 'selected' : ''}" 
                  onclick="setPaymentMethod('cod')"
                >
                  <div class="payment-method-left">
                    <div class="payment-method-icon-wrap cod">💵</div>
                    <div>
                      <div class="payment-method-name">Tiền mặt khi nhận món (COD)</div>
                      <div class="payment-method-sub">Thanh toán trực tiếp cho tài xế</div>
                    </div>
                  </div>
                  <div class="option-item-custom-radio ${selectedPaymentMethod === 'cod' ? 'selected' : ''}">
                    <svg class="radio-check-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="2.5 6.5 5 9 9.5 3.5"></polyline>
                    </svg>
                  </div>
                </div>

                <!-- Credit Card -->
                <div 
                  class="payment-method-row ${selectedPaymentMethod === 'card' ? 'selected' : ''}" 
                  onclick="setPaymentMethod('card')"
                >
                  <div class="payment-method-left">
                    <div class="payment-method-icon-wrap card">💳</div>
                    <div>
                      <div class="payment-method-name">Thẻ Tín dụng / Ghi nợ</div>
                      <div class="payment-method-sub">Visa, MasterCard, JCB</div>
                    </div>
                  </div>
                  <div class="option-item-custom-radio ${selectedPaymentMethod === 'card' ? 'selected' : ''}">
                    <svg class="radio-check-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="2.5 6.5 5 9 9.5 3.5"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="checkout-right-col">
          <!-- Section: Apply Voucher on Checkout (Có thể áp dụng voucher ở trang thanh toán) -->
          <div class="checkout-section">
            <div class="checkout-card">
              <div class="checkout-card-header">
                <div class="checkout-card-title">
                  ${FluentIcons.tagRegular}
                  <span>Mã ưu đãi / Voucher</span>
                </div>
                ${appliedVoucher ? `
                  <span style="font-size: 12px; font-weight: 700; color: var(--red); cursor: pointer;" onclick="cancelCheckoutVoucher()">
                    Hủy mã
                  </span>
                ` : ''}
              </div>

              <!-- Voucher Input Row -->
              <div class="cart-voucher-input-row" style="margin-bottom: 10px;">
                <input 
                  type="text" 
                  id="checkout-voucher-input" 
                  class="cart-voucher-input" 
                  placeholder="Nhập mã voucher (VD: PTITNGON50)" 
                  value="${appliedVoucher ? appliedVoucher.code : ''}"
                  ${appliedVoucher ? 'disabled' : ''}
                  style="text-transform: uppercase;"
                >
                <button 
                  class="cart-voucher-btn ${appliedVoucher ? 'applied' : ''}" 
                  onclick="handleApplyCheckoutVoucher()"
                >
                  ${appliedVoucher ? 'Đã dùng' : 'Áp dụng'}
                </button>
              </div>

              <!-- Quick Voucher Chips -->
              <div class="cart-voucher-chips">
                ${typeof dbmRenderCheckoutVoucherChipsHtml === 'function' ? dbmRenderCheckoutVoucherChipsHtml(cart, appliedVoucher?.code) : `
                <div 
                  class="cart-voucher-chip ${appliedVoucher?.code === 'HUNGCHIENGION' ? 'active' : ''}" 
                  style="border-color: #ffa39e; color: #cf1322;"
                  onclick="applyPromoCodeFromCheckout('HUNGCHIENGION')"
                >
                  ${FluentIcons.flameRegular} HUNGCHIENGION (-50K)
                </div>
                <div 
                  class="cart-voucher-chip ${(appliedVoucher?.code === 'PTITNGON50' || appliedVoucher?.code === 'VIETFOOD50') ? 'active' : ''}" 
                  onclick="applyPromoCodeFromCheckout('PTITNGON50')"
                >
                  ${FluentIcons.giftRegular} PTITNGON50 (-50%)
                </div>
                <div 
                  class="cart-voucher-chip ${appliedVoucher?.code === 'FREESHIP' ? 'active' : ''}" 
                  onclick="applyPromoCodeFromCheckout('FREESHIP')"
                >
                  ${FluentIcons.truckRegular} FREESHIP (-15K)
                </div>
                <div 
                  class="cart-voucher-chip ${(appliedVoucher?.code === 'PTITNGON10' || appliedVoucher?.code === 'VIETFOOD10') ? 'active' : ''}" 
                  onclick="applyPromoCodeFromCheckout('PTITNGON10')"
                >
                  ${FluentIcons.tagRegular} PTITNGON10 (-10%)
                </div>
                `}
              </div>

              ${appliedVoucher ? `
                <div style="margin-top: 8px; font-size: 12px; color: var(--green-600); font-weight: 600; display: flex; align-items: center; gap: 4px;">
                  ${FluentIcons.checkmarkFilled} Đang áp dụng: ${appliedVoucher.desc} (-${formatVND(discountAmount)})
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Section 4: Order Bill Summary -->
          <div class="checkout-section">
            <div class="checkout-card">
              <div class="bill-title">Tóm tắt đơn hàng (${totalItems} món)</div>
              <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                ${cart.map(item => `
                  <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--gray-700);">
                    <span>${item.quantity}x ${item.dishName}</span>
                    <span style="font-weight: 600;">${formatVND(item.totalPrice)}</span>
                  </div>
                `).join('')}
              </div>
              <div class="bill-row">
                <span>Tạm tính</span>
                <span>${formatVND(subtotal)}</span>
              </div>
              <div class="bill-row">
                <span>Phí giao hàng</span>
                <span>${shippingFee === 0 ? '<strong style="color: var(--green-600);">Miễn phí</strong>' : formatVND(shippingFee)}</span>
              </div>
              ${discountAmount > 0 ? `
                <div class="bill-row discount">
                  <span>Voucher (${appliedVoucher.code})</span>
                  <span>-${formatVND(discountAmount)}</span>
                </div>
              ` : ''}
              <div class="bill-row total-row">
                <span>Tổng thanh toán</span>
                <span class="bill-total-price">${formatVND(finalTotal)}</span>
              </div>
            </div>
          </div>

          <!-- Sticky Place Order Button -->
          <div class="cart-bottom-bar">
            <button class="cart-checkout-btn" onclick="handleCheckoutPrimaryAction(${finalTotal})">
              <div style="text-align: left;">
                <div style="font-size: 11px; font-weight: 500; opacity: 0.9;">
                  ${selectedPaymentMethod === 'qr'
      ? 'Chuyển khoản QR • VPBank 0921030342'
      : selectedPaymentMethod === 'momo'
        ? 'Quét QR Ví MoMo • 0866072227'
        : 'Nhấn để xác nhận'}
                </div>
                <div style="font-size: 17px; font-weight: 800;">${formatVND(finalTotal)}</div>
              </div>
              <span style="display: flex; align-items: center; gap: 6px;">
                ${selectedPaymentMethod === 'qr'
      ? '📲 Thanh toán QR & Đặt đơn'
      : selectedPaymentMethod === 'momo'
        ? '👛 Thanh toán QR MoMo & Đặt đơn'
        : `Đặt đơn ngay ${FluentIcons.checkmarkFilled}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function handleApplyCheckoutVoucher() {
  const input = document.getElementById('checkout-voucher-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  if (!code) {
    showToast('alertRegular', 'Vui lòng nhập mã voucher');
    return;
  }
  applyPromoCodeFromCheckout(code);
}

function cancelCheckoutVoucher() {
  appliedVoucher = null;
  showToast('tagRegular', 'Đã hủy áp dụng mã giảm giá');
  renderCheckoutView();
}

function applyPromoCodeFromCheckout(code) {
  if (!code) return;
  const promo = (typeof dbmResolvePromo === 'function')
    ? dbmResolvePromo(code, cart)
    : { ok: false, message: `Mã "${code}" không hợp lệ` };
  if (!promo.ok) {
    showToast('alertRegular', promo.message);
    return;
  }
  appliedVoucher = promo.applied;
  showToast(promo.icon || 'giftRegular', promo.toast);
  renderCheckoutView();
}

function setPaymentMethod(method) {
  selectedPaymentMethod = method;
  renderCheckoutView();
}

function submitOrder(totalAmount, qrPaymentMeta = null) {
  const driverNote = document.getElementById('checkout-driver-note')
    ? document.getElementById('checkout-driver-note').value
    : '';

  const orderId = (typeof getOrCreatePendingCheckoutOrderId === 'function')
    ? getOrCreatePendingCheckoutOrderId()
    : ('#PTIT-' + Math.floor(100000 + Math.random() * 900000));
  if (typeof resetPendingCheckoutOrderId === 'function') {
    resetPendingCheckoutOrderId();
  }

  const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date().toLocaleDateString('vi-VN');

  const paymentLabels = {
    momo: (qrPaymentMeta && qrPaymentMeta.isPaid)
      ? `Ví MoMo 0866072227 (Đã thanh toán • Mã GD ${qrPaymentMeta.transactionId})`
      : 'Ví MoMo 0866072227 (Chờ quét QR)',
    zalopay: 'Ví ZaloPay (Đã thanh toán)',
    qr: (qrPaymentMeta && qrPaymentMeta.isPaid)
      ? `VietQR VPBank 0921030342 (Đã thanh toán • Mã GD ${qrPaymentMeta.transactionId})`
      : 'VietQR VPBank 0921030342 (Chờ chuyển khoản)',
    cod: 'Tiền mặt khi nhận hàng (COD)',
    card: 'Thẻ Tín dụng / Ghi nợ'
  };

  const firstItem = cart[0];
  const resObj = firstItem ? restaurants.find(r => Number(r.id) === Number(firstItem.restaurantId)) : null;
  const resName = firstItem ? firstItem.restaurantName : 'Phở Hòa Pasteur - Gia Truyền 1968';
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingFee = subtotal > 150000 ? 0 : 15000;

  let discountAmount = (typeof computeVoucherDiscount === 'function') ? computeVoucherDiscount(appliedVoucher, subtotal, cart) : 0;

  // Create real active tracked order linked to current user profile
  const newOrder = {
    orderId: orderId,
    categoryStatus: 'delivering',
    statusText: 'Đang chuẩn bị món (Dự kiến 15 phút)',
    currentStep: 2,
    orderTime: `${dateStr}, ${nowStr}`,
    estimatedTime: 'Khoảng 15 - 20 phút nữa',
    resName: resName,
    resAddress: resObj?.address || 'Khu vực ẩm thực quanh Học viện PTIT',
    resPhone: resObj?.phone || '0901 234 567',
    deliveryAddress: userDeliveryInfo.address,
    recipientName: userDeliveryInfo.name,
    recipientPhone: userDeliveryInfo.phone,
    driverNote: driverNote || userDeliveryInfo.note || '',
    items: [...cart],
    paymentMethod: selectedPaymentMethod,
    paymentMethodName: paymentLabels[selectedPaymentMethod] || 'Tiền mặt',
    qrPayment: (selectedPaymentMethod === 'qr' || selectedPaymentMethod === 'momo') ? (qrPaymentMeta || {
      isPaid: false,
      channelKey: selectedPaymentMethod,
      bankShortName: selectedPaymentMethod === 'momo' ? 'Ví MoMo' : 'VPBank',
      accountNo: selectedPaymentMethod === 'momo' ? '0866072227' : '0921030342',
      transferContent: typeof buildTransferMemoFromOrderId === 'function' ? buildTransferMemoFromOrderId(orderId) : orderId
    }) : null,
    subtotal: subtotal,
    shippingFee: shippingFee,
    discountAmount: discountAmount,
    totalAmount: totalAmount,
    driver: {
      name: 'Nguyễn Văn Tài',
      phone: '0909 123 456',
      vehicle: '29-P1 889.24 • Honda Wave Alpha',
      rating: 4.9,
      avatar: '🛵'
    },
    userReview: null
  };

  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.recordOrderForCurrentUser(newOrder);
    if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
  } else {
    ordersList.unshift(newOrder);
    cart = [];
  }

  appliedVoucher = null;
  updateFloatingCartBar();

  // Directly view this newly placed order in live tracking!
  viewingOrderDetailId = newOrder.orderId;
  activityFilter = 'delivering';

  showToast('checkmarkFilled', `Đã đặt & lưu đơn ${newOrder.orderId} vào hồ sơ ${userDeliveryInfo.name}!`);
  openActivityView();
}

// ========================================
// 7. ACTIVITY & ORDERS TRACKING VIEW (4 TABS)
// ========================================

function openActivityView() {
  saveCurrentViewScroll();
  currentView = 'activity';
  render();
  restoreViewScroll('activity');
}

function switchActivityFilter(filter) {
  activityFilter = filter;
  viewingOrderDetailId = null;
  renderActivityView();
}

function viewOrderDetail(orderId) {
  globalViewScrollPositions['activity_list'] = window.scrollY || 0;
  viewingOrderDetailId = orderId;
  renderActivityView();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeOrderDetail() {
  viewingOrderDetailId = null;
  renderActivityView();
  const savedY = globalViewScrollPositions['activity_list'] || 0;
  window.scrollTo({ top: savedY, behavior: 'instant' });
  requestAnimationFrame(() => {
    window.scrollTo({ top: savedY, behavior: 'instant' });
  });
}

function cancelActiveOrder(orderId) {
  const o = ordersList.find(x => x.orderId === orderId);
  if (o) {
    o.categoryStatus = 'cancelled';
    o.statusText = 'Đã hủy đơn hàng (Theo yêu cầu)';
    o.cancelReason = 'Khách hàng hủy đơn';
    if (typeof DB !== 'undefined' && DB.isReady) {
      DB.saveCurrentUserOrders(ordersList);
      if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
    }
    showToast('alertRegular', `Đã hủy đơn hàng ${orderId}`);
    renderActivityView();
  }
}

function completeActiveOrder(orderId) {
  const o = ordersList.find(x => x.orderId === orderId);
  if (o) {
    o.categoryStatus = 'completed';
    o.statusText = 'Giao hàng thành công';
    o.currentStep = 5;
    o.estimatedTime = 'Đã hoàn tất lúc ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (typeof DB !== 'undefined' && DB.isReady) {
      DB.saveCurrentUserOrders(ordersList);
      if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
    }
    showToast('checkmarkFilled', `Đơn hàng ${orderId} đã giao thành công! Chúc ngon miệng 🎉`);
    renderActivityView();
  }
}

function reorderOrder(orderId) {
  const o = (typeof ordersList !== 'undefined' ? ordersList : []).find(x => x.orderId === orderId)
    || (typeof DB !== 'undefined' && DB.isReady && DB.getCurrentUser()?.orders?.find(x => x.orderId === orderId));
  if (!o || !Array.isArray(o.items) || o.items.length === 0) {
    showToast('alertRegular', 'Không tìm thấy dữ liệu món của đơn hàng này để đặt lại');
    return;
  }
  o.items.forEach(it => {
    cart.push({
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      dishId: it.dishId || it.id,
      dishName: it.dishName || it.name,
      restaurantName: it.restaurantName || o.resName || 'ptitngon Kitchen',
      restaurantId: it.restaurantId || 1,
      image: it.image || 'assets/images/pho_bo_1792459676492.jpg',
      size: it.size || { name: 'Phần Chuẩn', extraPrice: 0 },
      toppings: it.toppings || [],
      note: it.note || '',
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || (it.totalPrice ? Math.round(it.totalPrice / (it.quantity || 1)) : 50000),
      totalPrice: it.totalPrice || ((it.unitPrice || 50000) * (it.quantity || 1))
    });
  });
  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserCart(cart);
  }
  updateFloatingCartBar();
  const isCancelled = o.categoryStatus === 'cancelled';
  showToast(
    'giftRegular',
    isCancelled
      ? `Đã nạp lại ${o.items.length} món/combo của đơn đã hủy #${o.orderId} vào giỏ hàng!`
      : `Đã nạp lại các món của "${o.resName}" vào giỏ hàng!`
  );
  openCartView();
}

function openDishDetailFromOrderCode(orderId, itemIndex) {
  const o = (typeof ordersList !== 'undefined' ? ordersList : []).find(x => x.orderId === orderId)
    || (typeof DB !== 'undefined' && DB.isReady && DB.getCurrentUser()?.orders?.find(x => x.orderId === orderId));
  if (!o || !o.items || !o.items[itemIndex]) return;
  const it = o.items[itemIndex];

  let dish = null;
  if (typeof DB !== 'undefined' && DB.isReady) {
    if (it.dishId) dish = DB.getItemById(it.dishId);
    if (!dish && it.id) dish = DB.getItemById(it.id);
    if (!dish && (it.dishName || it.name)) {
      const targetName = (it.dishName || it.name).trim().toLowerCase();
      dish = DB.getAllItems().find(d => d.name.trim().toLowerCase() === targetName);
    }
  }

  if (dish) {
    const store = (typeof restaurants !== 'undefined' && restaurants.find(r => Number(r.id) === Number(dish.restaurantId)))
      || (typeof DB !== 'undefined' && DB.isReady && DB.data.restaurants?.find(r => Number(r.id) === Number(dish.restaurantId)))
      || { id: dish.restaurantId || 1, name: o.resName || 'ptitngon Kitchen', deliveryTime: '15-20 phút', distanceText: '800m' };
    if (typeof openDishDetailView === 'function') {
      openDishDetailView(dish, store);
    } else if (typeof openDishDetailById === 'function') {
      openDishDetailById(dish.id);
    }
  } else {
    const fallbackDish = {
      id: it.dishId || it.id || ('order-item-' + itemIndex),
      name: it.dishName || it.name || 'Món ăn',
      price: it.unitPrice || (it.totalPrice && it.quantity ? Math.round(it.totalPrice / it.quantity) : 0),
      image: it.image || 'assets/images/pho_bo_1792459676492.jpg',
      category: 'Món đã đặt',
      description: `Món ăn được đặt trong đơn hàng #${orderId}`,
      restaurantId: it.restaurantId || 1,
      restaurantName: it.restaurantName || o.resName || 'Quán ăn',
      calories: it.calories || 450,
      protein: it.protein || 18,
      carbs: it.carbs || 55,
      fat: it.fat || 12
    };
    const store = { id: fallbackDish.restaurantId, name: fallbackDish.restaurantName, deliveryTime: '15-20 phút', distanceText: '800m' };
    if (typeof openDishDetailView === 'function') {
      openDishDetailView(fallbackDish, store);
    }
  }
}

function copyOrderCode(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).catch(() => { });
  }
  showToast('copyRegular', `Đã sao chép mã đơn hàng: ${code}`);
}

function callDriver(phone) {
  showToast('callRegular', `Đang kết nối cuộc gọi tới tài xế: ${phone}`);
}

function chatDriver(driverName) {
  showToast('chatRegular', `Đang mở khung chat trực tiếp với tài xế ${driverName || 'Nguyễn Văn Tài'}...`);
}

function callRestaurant(phone, resName) {
  showToast('callRegular', `Đang gọi tới quán ${resName}: ${phone}`);
}

function setRatingScore(score) {
  userRatingScore = score;
  renderActivityView();
}

function toggleRatingTag(tag) {
  const idx = userRatingTags.indexOf(tag);
  if (idx > -1) {
    userRatingTags.splice(idx, 1);
  } else {
    userRatingTags.push(tag);
  }
  renderActivityView();
}

function submitUserReview(orderId) {
  const textInput = document.getElementById('user-review-text');
  if (textInput) {
    userReviewInputText = textInput.value.trim();
  }

  const o = ordersList.find(x => x.orderId === orderId);
  if (!o) return;

  o.userReview = {
    score: userRatingScore,
    tags: [...userRatingTags],
    text: userReviewInputText || 'Món ăn giao tới nơi vẫn nóng hổi, hương vị rất ngon và tài xế rất lịch sự!',
    submittedTime: 'Vừa xong'
  };

  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserOrders(ordersList);
  }

  showToast('starFilled', `Cảm ơn bạn đã gửi đánh giá ${userRatingScore} sao!`);
  renderActivityView();
}

function editUserReview(orderId) {
  const o = ordersList.find(x => x.orderId === orderId);
  if (o && o.userReview) {
    userRatingScore = o.userReview.score;
    userRatingTags = [...(o.userReview.tags || [])];
    userReviewInputText = o.userReview.text;
    o.userReview = null;
    if (typeof DB !== 'undefined' && DB.isReady) {
      DB.saveCurrentUserOrders(ordersList);
    }
    renderActivityView();
  }
}

function renderActivityView() {
  if (viewingOrderDetailId) {
    const order = ordersList.find(x => x.orderId === viewingOrderDetailId);
    if (order) {
      renderSingleOrderDetailView(order);
      return;
    }
  }

  // Calculate counts for 4 sub-tabs
  const counts = {
    all: ordersList.length,
    delivering: ordersList.filter(o => o.categoryStatus === 'delivering').length,
    completed: ordersList.filter(o => o.categoryStatus === 'completed').length,
    cancelled: ordersList.filter(o => o.categoryStatus === 'cancelled').length
  };

  // Filter orders according to active tab
  const filteredOrders = ordersList.filter(o => {
    if (activityFilter === 'all') return true;
    return o.categoryStatus === activityFilter;
  });

  app.innerHTML = `
    <div class="activity-view-container fade-in">
      <!-- Header -->
      <div class="page-nav-header">
        <button class="page-back-icon-btn" onclick="openHomeView()" aria-label="Về trang chủ">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Hoạt Động & Đơn Hàng</div>
        <div style="width: 36px;"></div>
      </div>

      <!-- 4 Filter Tabs Bar: Tất cả, Đơn đang giao, Đơn đã giao, Đã hủy -->
      <div class="activity-tabs-wrapper">
        <button class="scroll-arrow-btn small" onclick="scrollHorizontally('activity-tabs-bar', -160)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
          ${FluentIcons.chevronLeft}
        </button>
        <div class="activity-tabs-bar" id="activity-tabs-bar">
          <button 
            class="activity-tab-btn ${activityFilter === 'all' ? 'active' : ''}" 
            onclick="switchActivityFilter('all')"
          >
            <span>Tất cả</span>
            <span class="activity-tab-badge">${counts.all}</span>
          </button>
          <button 
            class="activity-tab-btn ${activityFilter === 'delivering' ? 'active' : ''}" 
            onclick="switchActivityFilter('delivering')"
          >
            <span>Đang giao</span>
            <span class="activity-tab-badge">${counts.delivering}</span>
          </button>
          <button 
            class="activity-tab-btn ${activityFilter === 'completed' ? 'active' : ''}" 
            onclick="switchActivityFilter('completed')"
          >
            <span>Đã giao</span>
            <span class="activity-tab-badge">${counts.completed}</span>
          </button>
          <button 
            class="activity-tab-btn ${activityFilter === 'cancelled' ? 'active' : ''}" 
            onclick="switchActivityFilter('cancelled')"
          >
            <span>Đã hủy</span>
            <span class="activity-tab-badge">${counts.cancelled}</span>
          </button>
        </div>
        <button class="scroll-arrow-btn small" onclick="scrollHorizontally('activity-tabs-bar', 160)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
          ${FluentIcons.chevronRight}
        </button>
      </div>

      <!-- Orders List Content -->
      <div class="past-orders-list fade-in">
        ${filteredOrders.length === 0 ? `
          <div style="text-align: center; padding: 60px 20px;">
            <div style="color: var(--gray-400); display: flex; justify-content: center; margin-bottom: 12px;">
              ${FluentIcons.receiptRegular}
            </div>
            <div style="font-size: 16px; font-weight: 700; color: var(--gray-800); margin-bottom: 6px;">
              Chưa có đơn hàng nào
            </div>
            <div style="font-size: 13px; color: var(--gray-500); margin-bottom: 20px;">
              Không có đơn hàng nào trong mục "${activityFilter === 'delivering' ? 'Đang giao' : activityFilter === 'completed' ? 'Đã giao' : activityFilter === 'cancelled' ? 'Đã hủy' : 'Tất cả'}".
            </div>
            <button class="btn-primary-large" onclick="openHomeView()" style="max-width: 240px; margin: 0 auto;">
              Khám phá món ngon ngay
            </button>
          </div>
        ` : filteredOrders.map(order => {
    const isDelivering = order.categoryStatus === 'delivering';
    const isCompleted = order.categoryStatus === 'completed';
    const isCancelled = order.categoryStatus === 'cancelled';

    const badgeClass = isDelivering ? 'delivering' : (isCompleted ? 'completed' : 'cancelled');
    const badgeText = isDelivering
      ? `<span class="pulse-dot"></span> Đang giao`
      : (isCompleted ? `Giao thành công` : `Đã hủy đơn`);

    const itemsSummary = order.items.map(it => `${it.quantity}x ${it.dishName || it.name}`).join(' • ');

    return `
            <div class="past-order-card" onclick="viewOrderDetail('${order.orderId}')" style="cursor: pointer;">
              <div class="past-order-head">
                <div>
                  <div class="past-order-res">${order.resName}</div>
                  <div style="font-size: 11px; color: var(--gray-400); margin-top: 2px;">
                    Mã đơn: <strong style="color: var(--gray-700);">${order.orderId}</strong> • ${order.orderTime}
                  </div>
                </div>
                <span class="past-order-status-badge ${badgeClass}">${badgeText}</span>
              </div>

              <!-- Dishes Summary -->
              <div style="font-size: 13px; font-weight: 600; color: var(--gray-800); margin-bottom: 6px; line-height: 1.4;">
                ${itemsSummary}
              </div>

              <!-- Recipient & Address -->
              <div style="font-size: 12px; color: var(--gray-500); margin-bottom: 12px; display: flex; align-items: center; gap: 4px;">
                ${FluentIcons.locationRegular}
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${order.recipientName} • ${order.deliveryAddress}
                </span>
              </div>

              <!-- Price & Action Buttons -->
              <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 1px dashed var(--gray-200);">
                <div style="font-size: 15px; font-weight: 800; color: var(--green-600);">
                  ${formatVND(order.totalAmount)}
                </div>
                <div class="past-order-actions" onclick="event.stopPropagation()">
                  ${isDelivering ? `
                    <button class="past-order-btn primary" onclick="viewOrderDetail('${order.orderId}')">
                      Theo dõi trực tiếp 🛵
                    </button>
                  ` : isCompleted ? `
                    <button class="past-order-btn secondary" onclick="viewOrderDetail('${order.orderId}')">
                      Xem chi tiết
                    </button>
                    <button class="past-order-btn primary" onclick="reorderOrder('${order.orderId}')">
                      Đặt lại
                    </button>
                  ` : `
                    <button class="past-order-btn secondary" onclick="viewOrderDetail('${order.orderId}')">
                      Xem chi tiết
                    </button>
                    <button class="past-order-btn primary" onclick="reorderOrder('${order.orderId}')" title="Đặt lại đơn/combo đã hủy này">
                      Đặt lại
                    </button>
                  `}
                </div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
}

function renderSingleOrderDetailView(o) {
  const step = o.currentStep || 4;
  const isDelivering = o.categoryStatus === 'delivering';
  const isCompleted = o.categoryStatus === 'completed';
  const isCancelled = o.categoryStatus === 'cancelled';

  const ratingDescMap = {
    1: 'Rất không hài lòng (1/5 sao)',
    2: 'Cần cải thiện (2/5 sao)',
    3: 'Tạm ổn (3/5 sao)',
    4: 'Hài lòng (4/5 sao)',
    5: 'Tuyệt vời (5/5 sao)'
  };

  app.innerHTML = `
    <div class="activity-view-container fade-in">
      <!-- Header with Back to List -->
      <div class="page-nav-header">
        <button class="page-back-icon-btn" onclick="closeOrderDetail()" aria-label="Quay lại danh sách">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Chi Tiết Đơn Hàng</div>
        <div style="width: 36px;"></div>
      </div>

      <div class="order-detail-layout-grid">
        <div class="order-detail-left-col">
          <!-- 1. Mã đơn hàng Banner (Có nút sao chép) -->
          <div class="order-code-banner">
            <div class="order-code-info">
              <span class="order-code-title">MÃ ĐƠN HÀNG</span>
              <span class="order-code-val">${o.orderId}</span>
            </div>
            <button class="order-code-copy-btn" onclick="copyOrderCode('${o.orderId}')" aria-label="Sao chép mã đơn hàng">
              ${FluentIcons.copyRegular}
              <span>Sao chép</span>
            </button>
          </div>

          <!-- Simulation Action Bar for Delivering Order -->
          ${isDelivering ? `
            <div class="order-detail-action-bar">
              <button class="order-detail-btn-complete" onclick="completeActiveOrder('${o.orderId}')">
                🎉 Mô phỏng: Đã nhận món thành công
              </button>
              <button class="order-detail-btn-danger" onclick="cancelActiveOrder('${o.orderId}')">
                Hủy đơn hàng này
              </button>
            </div>
          ` : ''}

          <!-- 2. Theo dõi tình trạng giao hàng (Live Delivery Stepper) -->
          ${!isCancelled ? `
            <div class="delivery-stepper-card">
              <div class="stepper-header">
                <div class="stepper-title-row">
                  <span style="display: flex; align-items: center; gap: 6px;">
                    ${FluentIcons.truckRegular}
                    <span>Tiến độ giao hàng</span>
                  </span>
                </div>
                <span class="stepper-time-badge">${isCompleted ? 'Đã hoàn thành' : 'Ước tính 8 phút'}</span>
              </div>

              <div class="stepper-timeline">
                <!-- Step 1 -->
                <div class="stepper-item ${step >= 1 ? 'completed' : ''}">
                  <div class="stepper-item-icon">${step > 1 ? FluentIcons.checkmarkFilled : '1'}</div>
                  <div class="stepper-item-content">
                    <div class="stepper-item-title">Đơn hàng đã được đặt thành công</div>
                    <div class="stepper-item-desc">Hệ thống ptitngon đã chuyển đơn tới quán</div>
                    <div class="stepper-item-time">${o.orderTime}</div>
                  </div>
                </div>

                <!-- Step 2 -->
                <div class="stepper-item ${step > 2 ? 'completed' : (step === 2 ? 'active' : '')}">
                  <div class="stepper-item-icon">${step > 2 ? FluentIcons.checkmarkFilled : '2'}</div>
                  <div class="stepper-item-content">
                    <div class="stepper-item-title">Quán đã nhận & đang chế biến món</div>
                    <div class="stepper-item-desc">${o.resName} đang chuẩn bị món nóng hổi</div>
                    <div class="stepper-item-time">Đang thực hiện</div>
                  </div>
                </div>

                <!-- Step 3 -->
                <div class="stepper-item ${step > 3 ? 'completed' : (step === 3 ? 'active' : '')}">
                  <div class="stepper-item-icon">${step > 3 ? FluentIcons.checkmarkFilled : '3'}</div>
                  <div class="stepper-item-content">
                    <div class="stepper-item-title">Tài xế đã lấy món & kiểm tra đóng gói</div>
                    <div class="stepper-item-desc">Đã nhận đủ món ăn, hộp giữ nhiệt an toàn</div>
                    <div class="stepper-item-time">${step >= 3 ? '10:24' : 'Chờ tài xế'}</div>
                  </div>
                </div>

                <!-- Step 4 -->
                <div class="stepper-item ${step > 4 ? 'completed' : (step === 4 ? 'active' : '')}">
                  <div class="stepper-item-icon">${step > 4 ? FluentIcons.checkmarkFilled : '4'}</div>
                  <div class="stepper-item-content">
                    <div class="stepper-item-title" style="${step === 4 ? 'color: var(--green-600); font-weight: 800;' : ''}">
                      Tài xế đang trên đường giao tới bạn 🛵
                    </div>
                    <div class="stepper-item-desc">Tài xế đang cách bạn khoảng 800m trên đường Nguyễn Huệ</div>
                    <div class="stepper-item-time">${step >= 4 ? 'Đang di chuyển' : 'Sắp tới'}</div>
                  </div>
                </div>

                <!-- Step 5 -->
                <div class="stepper-item ${step >= 5 ? 'completed' : ''}">
                  <div class="stepper-item-icon">${step >= 5 ? FluentIcons.checkmarkFilled : '5'}</div>
                  <div class="stepper-item-content">
                    <div class="stepper-item-title" style="${step >= 5 ? 'color: var(--green-600); font-weight: 800;' : 'color: var(--gray-400);'}">
                      Giao hàng thành công & Chúc ngon miệng!
                    </div>
                    <div class="stepper-item-desc">Đã nhận món thơm ngon đầy đủ</div>
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div class="delivery-stepper-card" style="border-left: 4px solid var(--red); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: var(--red); margin-bottom: 4px;">Đơn hàng đã được hủy</div>
                <div style="font-size: 13px; color: var(--gray-600);">${o.cancelReason || 'Lý do: Đã hủy theo yêu cầu'}</div>
              </div>
              <button 
                type="button" 
                class="past-order-btn primary" 
                style="padding: 8px 16px; border-radius: 9999px; font-size: 13px; font-weight: 700;"
                onclick="reorderOrder('${o.orderId}')"
              >
                🔄 Đặt lại đơn này
              </button>
            </div>
          `}

          <!-- 3. Bảng tóm tắt trạng thái (Status summary board - đặt bên dưới delivery-stepper-card) -->
          <div class="status-summary-board">
            <div class="status-live-header">
              <div class="status-live-title">
                ${isDelivering ? '<span class="status-live-dot"></span>' : ''}
                <span>${o.statusText}</span>
              </div>
              <span class="status-badge-chip" style="${isCancelled ? 'background: #fee2e2; color: #b91c1c;' : ''}">
                ${isDelivering ? 'Trực tiếp' : (isCompleted ? 'Hoàn tất' : 'Đã hủy')}
              </span>
            </div>

            <div class="summary-board-grid">
              <div class="summary-board-row">
                <span class="summary-row-label">Thời gian đặt:</span>
                <span class="summary-row-val">${o.orderTime}</span>
              </div>
              <div class="summary-board-row">
                <span class="summary-row-label">${isDelivering ? 'Dự kiến nhận:' : 'Thời gian nhận:'}</span>
                <span class="summary-row-val" style="color: var(--green-600); font-weight: 800;">${o.estimatedTime}</span>
              </div>
              <div class="summary-board-row">
                <span class="summary-row-label">Quán chuẩn bị:</span>
                <span class="summary-row-val" style="font-weight: 700; color: var(--gray-900);">${o.resName}</span>
              </div>
              <div class="summary-board-row">
                <span class="summary-row-label">Người nhận món:</span>
                <span class="summary-row-val">${o.recipientName} • ${o.recipientPhone}</span>
              </div>
              <div class="summary-board-row">
                <span class="summary-row-label">Địa chỉ nhận:</span>
                <span class="summary-row-val">${o.deliveryAddress}</span>
              </div>
              ${o.driverNote ? `
                <div class="summary-board-row">
                  <span class="summary-row-label">Ghi chú tài xế:</span>
                  <span class="summary-row-val" style="font-style: italic;">${o.driverNote}</span>
                </div>
              ` : ''}
              <div class="summary-board-row">
                <span class="summary-row-label">Thanh toán:</span>
                <span class="summary-row-val">${o.paymentMethodName || 'Ví MoMo'}</span>
              </div>
              ${(o.paymentMethod === 'qr' || o.paymentMethod === 'momo') && !isCancelled ? `
                <div class="vqr-order-detail-bar ${o.qrPayment?.isPaid ? 'paid' : 'pending'} ${o.paymentMethod === 'momo' ? 'momo-bar' : ''}">
                  <div>
                    <strong>${o.qrPayment?.isPaid
      ? `✅ Đã xác nhận thanh toán QR ${o.paymentMethod === 'momo' ? 'Ví MoMo' : 'VietQR'}`
      : `⏳ Đơn đang chờ quét mã QR ${o.paymentMethod === 'momo' ? 'Ví MoMo' : 'VietQR'}`}</strong>
                    <div style="font-size: 11.5px; opacity: 0.9;">
                      ${o.paymentMethod === 'momo' ? 'Ví MoMo • 0866072227' : 'VPBank • 0921030342'} ${o.qrPayment?.transferContent ? `• ND: ${escapeHtml(o.qrPayment.transferContent)}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    class="vqr-order-reopen-btn ${o.paymentMethod === 'momo' ? 'momo' : ''}"
                    onclick="openExistingOrderVietQRModal('${o.orderId}')"
                  >
                    ${o.qrPayment?.isPaid
      ? (o.paymentMethod === 'momo' ? '👛 Xem QR MoMo' : '📲 Xem mã QR')
      : (o.paymentMethod === 'momo' ? '👛 Mở QR MoMo' : '📲 Mở QR thanh toán')}
                  </button>
                </div>
              ` : ''}
              <div class="summary-board-row" style="margin-top: 6px; padding-top: 8px; border-top: 1px dashed var(--gray-200);">
                <span class="summary-row-label" style="font-weight: 700; color: var(--gray-900);">Tổng số tiền:</span>
                <span class="summary-row-val" style="font-size: 15px; font-weight: 800; color: var(--green-600);">${formatVND(o.totalAmount)}</span>
              </div>
            </div>

            <!-- Danh sách món đã đặt trực quan: ảnh, tên, chi tiết, bấm mở xem sản phẩm -->
            <div class="order-detail-items-section">
              <div class="order-detail-items-head">
                <span class="order-detail-items-title">🛍️ Món đã đặt (${(o.items || []).length})</span>
                <span class="order-detail-items-hint">Chạm món để xem thông tin sản phẩm</span>
              </div>
              <div class="order-detail-items-list">
                ${(o.items || []).map((it, itemIdx) => {
                  const img = it.image || (typeof DB !== 'undefined' && DB.getItemById(it.dishId || it.id)?.image) || 'assets/images/pho_bo_1792459676492.jpg';
                  const name = it.dishName || it.name || 'Món ăn';
                  const sizeText = it.size && it.size.name && it.size.name !== 'Phần Tiêu Chuẩn' ? it.size.name : '';
                  const toppingsText = Array.isArray(it.toppings) && it.toppings.length > 0 ? it.toppings.map(t => t.name).join(', ') : '';
                  const subInfo = [sizeText, toppingsText].filter(Boolean).join(' • ');
                  return `
                    <div class="order-detail-item-row" onclick="openDishDetailFromOrderCode('${o.orderId}', ${itemIdx})" title="Chạm để xem thông tin chi tiết món ${escapeHtml(name)}">
                      <img class="order-detail-item-img" src="${escapeHtml(img)}" alt="${escapeHtml(name)}" onerror="this.src='assets/images/pho_bo_1792459676492.jpg'">
                      <div class="order-detail-item-body">
                        <div class="order-detail-item-top">
                          <span class="order-detail-item-name">${escapeHtml(name)}</span>
                          <span class="order-detail-item-qty">x${it.quantity}</span>
                        </div>
                        ${subInfo ? `<div class="order-detail-item-meta">${escapeHtml(subInfo)}</div>` : ''}
                        ${it.note ? `<div class="order-detail-item-note">Ghi chú: ${escapeHtml(it.note)}</div>` : ''}
                        <div class="order-detail-item-bottom">
                          <span class="order-detail-item-price">${formatVND(it.totalPrice || (it.unitPrice || it.price || 0) * it.quantity)}</span>
                          <span class="order-detail-item-view-tag">Xem thông tin món →</span>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="order-detail-right-col">
          <!-- 4. Nút liên hệ nhanh & Tài xế giao hàng (Quick contact actions) -->
          ${o.driver ? `
            <div class="driver-contact-card">
              <div class="driver-info-row">
                <div class="driver-avatar">${o.driver.avatar || '🛵'}</div>
                <div class="driver-meta">
                  <div class="driver-name">${o.driver.name}</div>
                  <div class="driver-vehicle">${o.driver.vehicle}</div>
                  <div class="driver-rating">⭐ ${o.driver.rating} • Tài xế 5 sao</div>
                </div>
              </div>

              <!-- 3 Nút liên hệ nhanh -->
              <div class="quick-contact-actions">
                <button class="contact-action-btn call" onclick="callDriver('${o.driver.phone}')">
                  ${FluentIcons.callRegular}
                  <span>Gọi tài xế</span>
                </button>
                <button class="contact-action-btn chat" onclick="chatDriver('${o.driver.name}')">
                  ${FluentIcons.chatRegular}
                  <span>Nhắn tin</span>
                </button>
                <button class="contact-action-btn store" onclick="callRestaurant('${o.resPhone}', '${escapeHtml(o.resName)}')">
                  ${FluentIcons.callRegular}
                  <span>Gọi quán</span>
                </button>
              </div>
            </div>
          ` : ''}

          <!-- 5. Hiện đánh giá của bạn (Show your review & Rating) -->
          ${!isCancelled ? `
            <div class="user-rating-card">
              ${o.userReview ? `
                <!-- Đã gửi đánh giá: Hiện đánh giá của bạn -->
                <div class="rating-card-title" style="display: flex; align-items: center; justify-content: space-between;">
                  <span>Đánh giá của bạn</span>
                  <span style="font-size: 11px; font-weight: 600; color: var(--green-600); background: #dcfce7; padding: 2px 8px; border-radius: 4px;">
                    Đã ghi nhận
                  </span>
                </div>
                <div class="rating-card-sub">Cảm ơn bạn đã phản hồi giúp tài xế và quán phục vụ tốt hơn</div>

                <div class="submitted-review-box">
                  <div class="submitted-review-head">
                    <div class="submitted-review-stars">
                      ${'⭐'.repeat(o.userReview.score)}
                    </div>
                    <span style="font-size: 11px; color: var(--gray-500);">${o.userReview.submittedTime || 'Hôm nay'}</span>
                  </div>

                  ${o.userReview.tags && o.userReview.tags.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">
                      ${o.userReview.tags.map(t => `
                        <span style="font-size: 11px; font-weight: 600; background: #fefce8; color: #854d0e; padding: 2px 8px; border-radius: 4px; border: 1px solid #fef08a;">
                          ${t}
                        </span>
                      `).join('')}
                    </div>
                  ` : ''}

                  <div class="submitted-review-text">
                    "${o.userReview.text}"
                  </div>

                  <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                    <button 
                      onclick="editUserReview('${o.orderId}')" 
                      style="background: none; border: none; font-size: 12px; font-weight: 700; color: var(--green-600); cursor: pointer; padding: 4px 0;"
                    >
                      Chỉnh sửa đánh giá ✍️
                    </button>
                  </div>
                </div>
              ` : `
                <!-- Chưa đánh giá: Form nhập đánh giá trực quan -->
                <div class="rating-card-title">Đánh giá dịch vụ & món ăn</div>
                <div class="rating-card-sub">Trải nghiệm của bạn với đơn hàng này thế nào?</div>

                <!-- 5 Sao chọn nhanh -->
                <div class="stars-selector-row">
                  ${[1, 2, 3, 4, 5].map(s => `
                    <span 
                      class="star-tap-btn ${s <= userRatingScore ? 'active' : ''}" 
                      onclick="setRatingScore(${s})"
                      title="${s} sao"
                    >
                      ★
                    </span>
                  `).join('')}
                </div>
                <div class="rating-score-label">${ratingDescMap[userRatingScore]}</div>

                <!-- Tag Chips gợi ý -->
                <div class="rating-tag-chips">
                  ${ratingTagOptions.map(tag => `
                    <div 
                      class="rating-tag-chip ${userRatingTags.includes(tag) ? 'active' : ''}" 
                      onclick="toggleRatingTag('${tag}')"
                    >
                      ${tag}
                    </div>
                  `).join('')}
                </div>

                <!-- Review Textarea -->
                <textarea 
                  class="rating-review-textarea" 
                  id="user-review-text" 
                  placeholder="Nhập cảm nhận của bạn (VD: Món nóng hổi thơm ngon, tài xế giao cực nhanh)..."
                  rows="2"
                >${userReviewInputText}</textarea>

                <!-- Submit Button -->
                <button class="submit-rating-btn" onclick="submitUserReview('${o.orderId}')">
                  Gửi đánh giá đơn hàng ⭐
                </button>
              `}
            </div>
          ` : ''}

          <!-- Reorder CTA for Completed or Cancelled Order -->
          ${(isCompleted || isCancelled) ? `
            <div style="margin-top: 8px;">
              <button class="btn-primary-large" onclick="reorderOrder('${o.orderId}')">
                ${isCancelled ? 'Đặt lại đơn/combo đã hủy này 🔄' : 'Đặt lại đơn hàng này 🍜'}
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      <div style="height: 30px;"></div>
    </div>
  `;
}

// ========================================
// 8. GENERAL ACTIONS & NAVIGATION
// ========================================

function openSearchView(keyword = '', filterKey = null) {
  saveCurrentViewScroll();
  currentView = 'search';
  if (keyword) {
    searchQuery = keyword;
    selectedVisualSuggestion = keyword;
  }
  if (filterKey) {
    if (filterKey === 'near') {
      activeFilters.near = true;
      distanceFilter = 2;
    } else if (filterKey === 'freeship') {
      activeFilters.freeship = true;
    } else if (filterKey === 'budget') {
      activeFilters.budget = true;
    } else if (filterKey === 'voucher') {
      activeFilters.voucher = true;
    } else if (filterKey === 'rating45') {
      activeFilters.rating45 = true;
    }
  }
  const desktopInput = document.getElementById('desktop-search-input');
  if (desktopInput && searchQuery) {
    desktopInput.value = searchQuery;
  }
  render();
  if (keyword || filterKey) {
    globalViewScrollPositions['search'] = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else {
    restoreViewScroll('search');
  }
  setTimeout(() => {
    const inputEl = document.getElementById('search-view-input');
    if (inputEl) {
      inputEl.focus();
      if (searchQuery) {
        inputEl.setSelectionRange(searchQuery.length, searchQuery.length);
      }
    }
  }, 100);
}

function onDesktopSearchFocus() {
  if (currentView !== 'search') {
    openSearchView(searchQuery);
  }
}

function onDesktopSearchInput(val) {
  searchQuery = val;
  if (currentView !== 'search') {
    openSearchView(val);
  } else {
    updateSearchResultsOnly();
  }
  const mainInput = document.getElementById('search-view-input');
  if (mainInput && mainInput.value !== val) {
    mainInput.value = val;
  }
}

function onDesktopSearchEnter(val) {
  openSearchView(val);
}

function onDesktopSearchClick() {
  const input = document.getElementById('desktop-search-input');
  openSearchView(input ? input.value : '');
}

function openHomeView() {
  saveCurrentViewScroll();
  if (typeof dbmRollHomeShuffleSeed === 'function') {
    dbmRollHomeShuffleSeed();
  }
  currentView = 'home';
  render();
  restoreViewScroll('home');
}

function onSearchInputChange(val) {
  searchQuery = val;
  const desktopInput = document.getElementById('desktop-search-input');
  if (desktopInput && desktopInput.value !== val) {
    desktopInput.value = val;
  }
  updateSearchResultsOnly();
}

function clearSearch() {
  searchQuery = '';
  selectedVisualSuggestion = null;
  const inputEl = document.getElementById('search-view-input');
  if (inputEl) {
    inputEl.value = '';
    inputEl.focus();
  }
  const desktopInput = document.getElementById('desktop-search-input');
  if (desktopInput) {
    desktopInput.value = '';
  }
  renderSearchView();
}

function selectVisualSuggestion(keyword) {
  if (selectedVisualSuggestion === keyword) {
    selectedVisualSuggestion = null;
    searchQuery = '';
  } else {
    selectedVisualSuggestion = keyword;
    searchQuery = keyword;
  }
  renderSearchView();
}

function setDistanceFilter(dist) {
  distanceFilter = dist;
  renderSearchView();
  if (dist === null) {
    showToast('locationRegular', 'Hiển thị tất cả khoảng cách');
  } else {
    showToast('locationRegular', `Lọc các quán trong bán kính < ${dist} km`);
  }
}

function toggleFilter(filterKey) {
  activeFilters[filterKey] = !activeFilters[filterKey];
  renderSearchView();
  const labelMap = {
    near: 'Gần nhất',
    rating45: 'Đánh giá cao 4.8+',
    freeship: 'Freeship 0đ',
    budget: 'Giá bình dân $',
    voucher: 'Có voucher'
  };
  if (activeFilters[filterKey]) {
    showToast('optionsRegular', `Đã bật bộ lọc: ${labelMap[filterKey]}`);
  }
}

function toggleSortNear() {
  activeFilters.near = !activeFilters.near;
  renderSearchView();
  showToast('navigationRegular', activeFilters.near ? 'Đã sắp xếp quán gần nhất lên đầu' : 'Đã bỏ sắp xếp khoảng cách');
}

function resetAllFilters() {
  searchQuery = '';
  distanceFilter = null;
  selectedVisualSuggestion = null;
  activeFilters = {
    near: false,
    rating45: false,
    freeship: false,
    budget: false,
    voucher: false,
  };
  renderSearchView();
  showToast('optionsRegular', 'Đã đặt lại tất cả bộ lọc');
}

function selectHomeFilterChip(idx) {
  filterChips.forEach(c => c.active = false);
  filterChips[idx].active = true;
  const chip = filterChips[idx];
  if (chip.filter) {
    openSearchView('', chip.filter);
  } else {
    renderHomeView();
    showToast(chip.iconKey, `Đã chọn: ${chip.label}`);
  }
}

function handleQuickOptionClick(idx) {
  const opt = quickOptions[idx];
  if (opt.action) {
    opt.action();
  }
}

function toggleFav(id) {
  let isFav = false;
  const rBefore = restaurants.find(x => x.id === id);
  const resName = rBefore ? rBefore.name : 'Quán ăn';

  if (typeof DB !== 'undefined' && DB.isReady) {
    isFav = DB.toggleFavoriteRestaurant(id);
  } else if (rBefore) {
    rBefore.fav = !rBefore.fav;
    isFav = rBefore.fav;
  }

  if (modalRestaurant && Number(modalRestaurant.id) === Number(id)) {
    modalRestaurant.fav = isFav;
  }

  if (currentView === 'home') {
    renderHomeView();
  } else if (currentView === 'search') {
    updateSearchResultsOnly();
  } else if (currentView === 'dish-detail' && typeof renderDishDetailView === 'function') {
    renderDishDetailView();
  }
  showToast(isFav ? 'heartFilled' : 'heartRegular', isFav ? `Đã lưu ${resName} vào Yêu thích ❤️` : `Đã bỏ lưu ${resName}`);
}

const AI_SPARKLE_ICON_REGULAR = `<svg class="fluent-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 2.75a.75.75 0 0 1 .68.434l1.79 3.848a1.75 1.75 0 0 0 .848.848l3.848 1.79a.75.75 0 0 1 0 1.36l-3.848 1.79a1.75 1.75 0 0 0-.848.848l-1.79 3.848a.75.75 0 0 1-1.36 0l-1.79-3.848a1.75 1.75 0 0 0-.848-.848l-3.848-1.79a.75.75 0 0 1 0-1.36l3.848-1.79a1.75 1.75 0 0 0 .848-.848l1.79-3.848a.75.75 0 0 1 .68-.434Zm0 2.752-1.106 2.378a3.25 3.25 0 0 1-1.574 1.574L6.442 10.56l2.378 1.106a3.25 3.25 0 0 1 1.574 1.574l1.106 2.378 1.106-2.378a3.25 3.25 0 0 1 1.574-1.574l2.378-1.106-2.378-1.106a3.25 3.25 0 0 1-1.574-1.574L11.5 5.502Zm7.25 9.748a.5.5 0 0 1 .453.289l.698 1.49a.75.75 0 0 0 .362.362l1.49.698a.5.5 0 0 1 0 .906l-1.49.698a.75.75 0 0 0-.362.362l-.698 1.49a.5.5 0 0 1-.906 0l-.698-1.49a.75.75 0 0 0-.362-.362l-1.49-.698a.5.5 0 0 1 0-.906l1.49-.698a.75.75 0 0 0 .362-.362l.698-1.49a.5.5 0 0 1 .453-.289Z"/></svg>`;
const AI_SPARKLE_ICON_FILLED = `<svg class="fluent-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10.822 2.502a.75.75 0 0 1 1.356 0l1.96 4.185a2.25 2.25 0 0 0 1.085 1.085l4.185 1.96a.75.75 0 0 1 0 1.356l-4.185 1.96a2.25 2.25 0 0 0-1.085 1.085l-1.96 4.185a.75.75 0 0 1-1.356 0l-1.96-4.185a2.25 2.25 0 0 0-1.085-1.085l-4.185-1.96a.75.75 0 0 1 0-1.356l4.185-1.96a2.25 2.25 0 0 0 1.085-1.085l1.96-4.185ZM18.372 15.32a.5.5 0 0 1 .906 0l.698 1.49a.75.75 0 0 0 .362.362l1.49.698a.5.5 0 0 1 0 .906l-1.49.698a.75.75 0 0 0-.362.362l-.698 1.49a.5.5 0 0 1-.906 0l-.698-1.49a.75.75 0 0 0-.362-.362l-1.49-.698a.5.5 0 0 1 0-.906l1.49-.698a.75.75 0 0 0 .362-.362l.698-1.49Z"/></svg>`;

function syncNavCollectionState(elements, iconSelector, activeTab) {
  if (!elements || elements.length === 0) return;
  const hasCatalogItem = Array.from(elements).some(el => el.getAttribute('data-tab') === 'catalog');
  elements.forEach(item => {
    item.classList.remove('active');
    const tabKey = item.getAttribute('data-tab');
    const iconSpan = item.querySelector(iconSelector);
    if (!tabKey || !iconSpan) return;

    if (tabKey === 'home') {
      const isActive = (activeTab === 'home' || activeTab === 'search');
      if (isActive) item.classList.add('active');
      iconSpan.innerHTML = isActive ? FluentIcons.homeFilled : FluentIcons.homeRegular;
    } else if (tabKey === 'activity') {
      const isActive = (activeTab === 'activity' || activeTab === 'orders');
      if (isActive) item.classList.add('active');
      iconSpan.innerHTML = isActive ? FluentIcons.receiptFilled : FluentIcons.receiptRegular;
    } else if (tabKey === 'ai') {
      const isActive = (activeTab === 'ai');
      if (isActive) item.classList.add('active');
      iconSpan.innerHTML = isActive ? AI_SPARKLE_ICON_FILLED : AI_SPARKLE_ICON_REGULAR;
    } else if (tabKey === 'cart') {
      const isActive = (activeTab === 'cart');
      if (isActive) item.classList.add('active');
      iconSpan.innerHTML = isActive ? FluentIcons.cartFilled : FluentIcons.cartRegular;
    } else if (tabKey === 'catalog') {
      const isActive = (activeTab === 'catalog');
      if (isActive) item.classList.add('active');
    } else if (tabKey === 'profile') {
      const isActive = (activeTab === 'profile' || (!hasCatalogItem && activeTab === 'catalog'));
      if (isActive) item.classList.add('active');
      iconSpan.innerHTML = isActive ? FluentIcons.personFilled : FluentIcons.personRegular;
    }
  });
}

// ── Bottom Nav & Desktop Sidebar Switcher & State Synchronizer ──
function updateBottomNavIconsAndState(activeTabOverride) {
  const activeTab = activeTabOverride || currentView;
  syncNavCollectionState(document.querySelectorAll('.bottom-nav-item'), '.bottom-nav-icon', activeTab);
  syncNavCollectionState(document.querySelectorAll('.sidebar-tab-btn'), '.sidebar-tab-icon', activeTab);
}

function switchNavTab(el, tab) {
  updateBottomNavIconsAndState(tab);

  if (tab === 'home') {
    openHomeView();
  } else if (tab === 'activity' || tab === 'orders') {
    openActivityView();
  } else if (tab === 'ai') {
    if (typeof openAIChatView === 'function') {
      openAIChatView();
    }
  } else if (tab === 'catalog') {
    if (typeof openCatalogManagerView === 'function') {
      openCatalogManagerView('items');
    }
  } else if (tab === 'cart') {
    openCartView();
  } else if (tab === 'profile') {
    if (typeof openProfileView === 'function') {
      openProfileView();
    } else {
      openDeliveryInfoModal();
    }
  }
}


// ── Toast Notifications ──
function showToast(icon, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const iconContent = (typeof FluentIcons !== 'undefined' && FluentIcons[icon])
    ? `<span class="toast-icon-svg">${FluentIcons[icon]}</span>`
    : `<span class="toast-icon">${icon}</span>`;
  toast.innerHTML = `${iconContent}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2400);
}

// ── Banner Handlers ──
function setBanner(idx) {
  currentBannerIndex = idx;
  const container = document.querySelector('.top-banner-cushion');
  if (container) {
    container.innerHTML = renderBannerHtml(topBanners[currentBannerIndex], currentBannerIndex);
  }
}

function prevBanner(e) {
  if (e) e.stopPropagation();
  currentBannerIndex = (currentBannerIndex - 1 + topBanners.length) % topBanners.length;
  setBanner(currentBannerIndex);
}

function nextBanner(e) {
  if (e) e.stopPropagation();
  currentBannerIndex = (currentBannerIndex + 1) % topBanners.length;
  setBanner(currentBannerIndex);
}

function scrollHorizontally(target, delta) {
  let el = null;
  if (typeof target === 'string') {
    el = document.getElementById(target) || document.querySelector(target);
  } else if (target instanceof HTMLElement) {
    el = target;
  }
  if (el) {
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }
}

function onBannerClick(idx) {
  const b = topBanners[idx];
  showToast('giftRegular', b.promoMsg);
  if (b.keyword) {
    openSearchView(b.keyword);
  }
}

// ── Utility ──
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Init (Khởi tạo Database JSON thống nhất trước khi render UI) ──
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof DB !== 'undefined') {
    await DB.init();
  }
  if (typeof syncGlobalChromeUI === 'function') {
    syncGlobalChromeUI();
  }
  render();

  // Gentle auto-rotation for the top banner cushion on Home
  setInterval(() => {
    if (currentView === 'home') {
      currentBannerIndex = (currentBannerIndex + 1) % topBanners.length;
      const container = document.querySelector('.top-banner-cushion');
      if (container) {
        container.innerHTML = renderBannerHtml(topBanners[currentBannerIndex], currentBannerIndex);
      }
    }
  }, 6000);
});
