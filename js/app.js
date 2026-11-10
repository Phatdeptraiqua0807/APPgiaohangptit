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
  area: 'all', // 'all' | 'near_ptit' | 'ao_sen' | 'nguyen_van_loc' | 'van_quan' | 'tran_phu'
  promo: 'all', // 'all' | 'freeship' | 'voucher' | 'flash_sale' | 'partner'
  shipping: 'all', // 'all' | 'ptit_express' | 'grab_express' | 'shopeefood' | 'be_delivery'
  priceRange: 'all', // 'all' | 'under30' | '30to60' | '60to100' | 'above100' | 'custom'
  minPrice: null,
  maxPrice: null,
  ratingMin: 0
};
let tempFilters = { ...activeFilters };

// ── Geolocation & Distance Calculation (Hà Đông / PTIT Center: 20.9806, 105.7878) ──
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0.5;
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function getRestaurantDistance(r) {
  if (userDeliveryInfo && userDeliveryInfo.lat && userDeliveryInfo.lng && r && r.lat && r.lng) {
    return calculateHaversineKm(userDeliveryInfo.lat, userDeliveryInfo.lng, r.lat, r.lng);
  }
  return typeof r.distance === 'number' ? r.distance : 0.5;
}
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
  if (window.locomotiveScroll && typeof window.locomotiveScroll.scrollTo === 'function') {
    window.locomotiveScroll.scrollTo(savedY, { immediate: true });
  } else {
    window.scrollTo({ top: savedY, behavior: 'instant' });
  }
  requestAnimationFrame(() => {
    if (window.locomotiveScroll && typeof window.locomotiveScroll.scrollTo === 'function') {
      window.locomotiveScroll.scrollTo(savedY, { immediate: true });
    } else {
      window.scrollTo({ top: savedY, behavior: 'instant' });
    }
    if (typeof updateHeaderScrolledState === 'function') updateHeaderScrolledState();
  });
}

// ── Đồng bộ hiệu ứng Floating Top Bar cho các trang có .page-nav-header khi lướt qua ──
let lastSyncedTopBarHtml = '';
function updateFloatingTopBar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const floatingBar = document.getElementById('floating-page-topbar');
  const inner = document.getElementById('floating-topbar-inner');
  const inPageHeader = document.querySelector('.page-nav-header');

  const scrollY = window.scrollY || window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;

  // ── Đồng bộ Floating Search Bar dạng viên thuốc nổi chỉ khi lướt qua search-view-header ──
  const floatingSearchBar = document.getElementById('floating-search-bar');
  const isSearchView = currentView === 'search';
  const inPageSearchHeader = document.querySelector('.search-view-header');

  if (floatingSearchBar) {
    if (isSearchView && inPageSearchHeader && scrollY > 45) {
      if (typeof initFloatingSearchBar === 'function') initFloatingSearchBar();
      floatingSearchBar.classList.add('visible');
      floatingSearchBar.setAttribute('aria-hidden', 'false');

      const floatingInput = document.getElementById('floating-search-input');
      const clearBtn = document.getElementById('floating-search-clear-btn');
      const filterBtn = document.getElementById('floating-search-filter-btn');
      if (floatingInput && floatingInput.value !== searchQuery) {
        floatingInput.value = searchQuery;
      }
      if (clearBtn) {
        clearBtn.style.display = searchQuery ? 'flex' : 'none';
      }
      if (filterBtn) {
        const hasActiveFilter = (activeFilters.area !== 'all' || activeFilters.promo !== 'all' || activeFilters.shipping !== 'all' || activeFilters.priceRange !== 'all' || activeFilters.ratingMin > 0);
        filterBtn.classList.toggle('active', hasActiveFilter);
      }
    } else {
      floatingSearchBar.classList.remove('visible');
      floatingSearchBar.setAttribute('aria-hidden', 'true');
    }
  }

  // ── Nhận diện cuộn qua header với vùng đệm (hysteresis) chống giật và bảo toàn chiều cao trang ──
  const isCurrentlyScrolled = inPageHeader && inPageHeader.classList.contains('is-scrolled');
  const shouldBeScrolled = isCurrentlyScrolled ? (scrollY > 32) : (scrollY > 45);

  if (inPageHeader && inPageHeader.classList) {
    if (shouldBeScrolled) inPageHeader.classList.add('is-scrolled');
    else inPageHeader.classList.remove('is-scrolled');
  }

  const isActivityTab = (currentView === 'activity' && !viewingOrderDetailId);

  // Ở điện thoại (< 768px), floating-page-topbar không xuất hiện (activity-tabs-bar tự nổi dưới page-nav-header khi lướt qua)
  if (window.innerWidth < 768) {
    if (floatingBar) {
      floatingBar.classList.remove('visible');
      floatingBar.classList.remove('has-activity-tabs');
      floatingBar.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  // Đổi chỗ mượt mà với dbm-bulk-bar khi được active trong cơ sở dữ liệu
  const activeBulkBar = document.querySelector('.dbm-bulk-bar.active');
  if (activeBulkBar) {
    if (floatingBar) {
      floatingBar.classList.remove('visible');
      floatingBar.classList.remove('has-activity-tabs');
      floatingBar.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  // Nếu không có header trên trang (ví dụ trang chủ) hoặc chưa cuộn qua header
  if (!inPageHeader || !shouldBeScrolled) {
    if (floatingBar) {
      floatingBar.classList.remove('visible');
      floatingBar.classList.remove('has-activity-tabs');
      floatingBar.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  // Khi cuộn qua header (> 45px): Hiển thị floating top bar cố định ở đỉnh màn hình trong vùng thấy được
  if (floatingBar && inner) {
    let currentHtml = '';
    if (isActivityTab && typeof renderActivityTabsBarHtml === 'function') {
      floatingBar.classList.add('has-activity-tabs');
      currentHtml = `
        <div class="floating-activity-header-group">
          <button class="page-back-icon-btn" onclick="openHomeView()" aria-label="Về trang chủ">
            ${FluentIcons.arrowLeft}
          </button>
          <div class="page-nav-title">Hoạt Động &amp; Đơn Hàng</div>
        </div>
        ${renderActivityTabsBarHtml(true)}
      `;
    } else {
      floatingBar.classList.remove('has-activity-tabs');
      currentHtml = inPageHeader.innerHTML;
    }

    if (currentHtml !== lastSyncedTopBarHtml) {
      lastSyncedTopBarHtml = currentHtml;
      inner.innerHTML = currentHtml;
    }
    floatingBar.classList.add('visible');
    floatingBar.setAttribute('aria-hidden', 'false');
  }
}

function updateHeaderScrolledState() {
  updateFloatingTopBar();
}

// ── Khởi tạo thanh Search dạng nổi (Floating Search Bar) ──
function initFloatingSearchBar() {
  const inner = document.getElementById('floating-search-inner');
  if (!inner || inner.dataset.initialized) return;
  inner.dataset.initialized = 'true';
  const hasActiveFilter = (activeFilters.area !== 'all' || activeFilters.promo !== 'all' || activeFilters.shipping !== 'all' || activeFilters.priceRange !== 'all' || activeFilters.ratingMin > 0);
  inner.innerHTML = `
    <button class="search-back-btn" onclick="openHomeView()" aria-label="Quay lại">
      ${FluentIcons.arrowLeft}
    </button>
    <div class="search-view-input-box">
      <span class="search-icon">${FluentIcons.searchRegular}</span>
      <input 
        type="text" 
        placeholder="Tìm món ngon, quán ăn, loại mặt hàng..." 
        id="floating-search-input" 
        value="${escapeHtml(searchQuery)}"
        autocomplete="off"
        oninput="onFloatingSearchInputChange(this.value)"
      >
      <span class="search-clear-btn" id="floating-search-clear-btn" onclick="clearSearch()" style="${searchQuery ? 'display:flex;' : 'display:none;'}" title="Xóa tìm kiếm">
        ${FluentIcons.dismiss}
      </span>
    </div>
    <button class="search-filter-toggle-btn ${hasActiveFilter ? 'active' : ''}" id="floating-search-filter-btn" onclick="openSearchFilterModal()" title="Bộ lọc tìm kiếm nâng cao">
      ${FluentIcons.filterRegular}
    </button>
  `;
}

function onFloatingSearchInputChange(val) {
  searchQuery = val;
  const inPageInput = document.getElementById('search-view-input');
  if (inPageInput && inPageInput.value !== val) {
    inPageInput.value = val;
  }
  const clearBtn = document.getElementById('floating-search-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = val ? 'flex' : 'none';
  }
  const inPageClearBtn = document.querySelector('.search-view-header .search-clear-btn');
  if (inPageClearBtn) {
    inPageClearBtn.style.display = val ? 'flex' : 'none';
  }
  const desktopInput = document.getElementById('desktop-search-input');
  if (desktopInput && desktopInput.value !== val) {
    desktopInput.value = val;
  }
  updateSearchResultsOnly();
}

// =========================================================================
// QUẢN LÝ THANH CUỘN (SCROLLBAR / SLIDE BAR): TỰ ĐỘNG ẨN CỤC NẮM SAU 5 GIÂY
// =========================================================================
let scrollbarIdleTimer = null;
const SCROLLBAR_IDLE_DELAY = 5000; // 5 giây tự động ẩn cục nắm di chuyển

function notifyScrollbarActivity() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  if (root && root.classList) root.classList.remove('scrollbar-idle');
  if (body && body.classList) body.classList.remove('scrollbar-idle');

  if (scrollbarIdleTimer) {
    clearTimeout(scrollbarIdleTimer);
  }
  scrollbarIdleTimer = setTimeout(() => {
    if (root && root.classList) root.classList.add('scrollbar-idle');
    if (body && body.classList) body.classList.add('scrollbar-idle');
  }, SCROLLBAR_IDLE_DELAY);
}

function handleAppScroll() {
  updateFloatingTopBar();
  notifyScrollbarActivity();
}

function handleAppMouseMove(e) {
  if (e && e.clientX >= window.innerWidth - 32) {
    notifyScrollbarActivity();
  }
}

function handleAppKeyDown(e) {
  if (e && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
    notifyScrollbarActivity();
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('scroll', handleAppScroll, { passive: true });
  window.addEventListener('wheel', notifyScrollbarActivity, { capture: true, passive: true });
  window.addEventListener('touchmove', notifyScrollbarActivity, { capture: true, passive: true });
  window.addEventListener('mousemove', handleAppMouseMove, { passive: true });
  window.addEventListener('keydown', handleAppKeyDown, { passive: true });

  // Khởi động ban đầu: hiện thanh cuộn và tự động ẩn sau 5 giây nếu không tương tác
  notifyScrollbarActivity();
}

// ── User Delivery & Recipient Info (Đồng bộ trực tiếp với DB Hồ sơ người dùng) ──
let userDeliveryInfo = {
  name: 'Nguyễn Văn A',
  phone: '0901 234 567',
  email: 'nguyenvana@ptit.edu.vn',
  address: 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội',
  shortAddress: 'PTIT Km10 Trần Phú, Hà Đông',
  label: 'PTIT Hà Đông',
  note: 'Giao sảnh nhà A2 hoặc Cổng trường',
  lat: 20.9806,
  lng: 105.7878
};

window.syncAppStateFromUser = function (user) {
  if (!user) return;
  if (user.name) userDeliveryInfo.name = user.name;
  if (user.phone) userDeliveryInfo.phone = user.phone;
  if (user.email) userDeliveryInfo.email = user.email;
  if (user.address) {
    userDeliveryInfo.address = user.address;
    userDeliveryInfo.shortAddress = user.shortAddress || (user.address.length > 30 ? user.address.substring(0, 28) + '...' : user.address);
  }
  if (user.addressLabel) userDeliveryInfo.label = user.addressLabel;
  if (user.addressNote) userDeliveryInfo.note = user.addressNote;
  if (typeof user.lat === 'number') userDeliveryInfo.lat = user.lat;
  if (typeof user.lng === 'number') userDeliveryInfo.lng = user.lng;
};

let savedAddressPresets = [];

// ── Activity & Orders State (Đồng bộ  theo từng User trong database.json) ──
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

  // Cập nhật trạng thái scrolled cho header sau khi view mới được kết xuất
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(updateHeaderScrolledState);
  } else if (typeof updateHeaderScrolledState === 'function') {
    updateHeaderScrolledState();
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
    <div class="header home-header">
      <!-- Full-bleed Premium Vietnamese Food Hero Backdrop -->
      <div class="home-hero-backdrop" aria-hidden="true">
        <img
          class="home-hero-backdrop-img"
          src="https://static.vinwonders.com/production/vietnamese-food-top-banner.jpg"
          onerror="this.onerror=null; this.src='assets/images/vietnamese-food-top-banner.jpg';"
          alt=""
          loading="eager"
        />
        <div class="home-hero-top-vignette"></div>
        <div class="home-hero-backdrop-fade"></div>
      </div>

      <!-- Location -->
      <div class="location-row fade-in">
        <div class="location-left" onclick="openDeliveryInfoModal()" title="Thay đổi địa chỉ giao hàng">
          <div class="location-icon">${FluentIcons.locationFilled}</div>
          <div class="location-text-wrap">
            <span class="location-label">${escapeHtml(userDeliveryInfo.label || 'Giao đến')}:</span>
            <span class="location-address">
              ${escapeHtml(userDeliveryInfo.shortAddress || userDeliveryInfo.address)}
            </span>
            <span class="location-arrow">${FluentIcons.chevronDown}</span>
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

      <!-- Khoảng trống thoáng đãng thay thế top-banner-card -->
      <div class="home-hero-spacer"></div>

      <!-- Greeting (To hơn, nổi bật hơn làm tâm điểm) -->
      <div class="greeting fade-in fade-in-delay-1">
        <div class="greeting-hello">Xin chào, ${escapeHtml(userDeliveryInfo.name || 'Bạn')}! 👋</div>
        <div class="greeting-question">Hôm nay bạn muốn ăn gì? <span class="wave">🍽️</span></div>
      </div>

      <!-- Search Bar on Home -->
      <div class="search-bar fade-in fade-in-delay-2" onclick="openSearchView()">
        <span class="search-bar-icon">${FluentIcons.searchRegular}</span>
        <input type="text" placeholder="Tìm món ăn, quán ăn, loại mặt hàng..." readonly style="cursor: pointer;">
        <button class="search-filter-btn" onclick="event.stopPropagation(); openSearchFilterModal();" aria-label="Bộ lọc">
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

    <!-- Categories Filter Chips -->
    <div class="categories-section fade-in fade-in-delay-4">
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
    <div class="restaurants-section featured-stores-section fade-in">
      <div class="section-head">
        <div class="section-title">Quán ăn nổi bật gần bạn</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="scroll-arrow-controls">
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('restaurants-scroll', -420)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('restaurants-scroll', 420)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
          <span class="section-see-all" onclick="openSearchView()">Xem tất cả</span>
        </div>
      </div>
      <div class="restaurants-scroll featured-stores-scroll" id="restaurants-scroll">
        ${(() => {
      const activeStores = restaurants.filter(r => Number(r.id) !== 1000 || (Array.isArray(r.relatedDishes) && r.relatedDishes.length > 0));
      const displayStores = typeof dbmFairShuffle === 'function'
        ? dbmFairShuffle(activeStores, 'home-popular-stores')
        : activeStores;
      return displayStores.map(r => {
        const ratingNum = Number(r.rating) || 0;
        const scoreBadgeClass = ratingNum >= 4.7 ? 'score-high' : (ratingNum >= 4.4 ? 'score-mid' : 'score-low');
        const indexedDishes = (r.relatedDishes || []).map((dish, originalIdx) => ({ dish, originalIdx }));
        const dishesScrollId = `home-store-dishes-${r.id}`;

        return `
          <div class="featured-store-card res-detail-card">
            <!-- Restaurant Main Header Info (Không hiển thị giá món ở header) -->
            <div class="res-main-info" onclick="openSearchView('${escapeHtml(r.name)}')">
              <div class="res-main-img-wrap">
                <img class="res-main-img" src="${r.image}" alt="${escapeHtml(r.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                ${r.badge ? `<span class="res-badge-partner ${scoreBadgeClass}">${escapeHtml(r.badge)}</span>` : ''}
              </div>

              <div class="res-details-col">
                <div class="res-name-row">
                  <div class="res-name-title">${escapeHtml(r.name)}</div>
                  <span class="res-fav-btn" onclick="event.stopPropagation(); toggleFav(${r.id})" title="Lưu quán yêu thích">
                    ${r.fav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
                  </span>
                </div>

                <!-- Đánh giá đầy đủ (Rating & reviewCount) -->
                <div class="res-rating-line">
                  <span class="star-icon">${FluentIcons.starFilled}</span>
                  <strong>${r.rating}</strong>
                  <span class="res-rating-count">(${r.reviewCount || '100+'})</span>
                </div>

                <!-- Meta Specs: Mức giá, khoảng cách, thời gian ship, phí ship thường -->
                <div class="res-meta-specs">
                  <span class="res-price-tier" title="Mức giá">${r.priceTier || '$$'}</span>
                  <span class="restaurant-card-dot"></span>
                  <span>${FluentIcons.locationRegular} ${r.distanceText}</span>
                  <span class="restaurant-card-dot"></span>
                  <span>${FluentIcons.clockRegular} ${r.deliveryTime}</span>
                  <span class="restaurant-card-dot"></span>
                  <span class="res-shipping-info ${r.isFreeship ? 'freeship' : ''}">
                    ${FluentIcons.truckRegular} ${r.shippingFee}
                  </span>
                </div>
              </div>
            </div>

            <!-- Các món ăn nổi bật của quán để xem và chọn trực tiếp -->
            ${indexedDishes.length > 0 ? `
              <div class="res-dishes-section" onclick="event.stopPropagation()">
                <div class="res-dishes-header-row">
                  <div class="res-dishes-label">Món ngon nổi bật (${indexedDishes.length} món):</div>
                  <div class="scroll-arrow-controls">
                    <button class="scroll-arrow-btn small" onclick="scrollHorizontally('${dishesScrollId}', -200)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
                      ${FluentIcons.chevronLeft}
                    </button>
                    <button class="scroll-arrow-btn small" onclick="scrollHorizontally('${dishesScrollId}', 200)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
                      ${FluentIcons.chevronRight}
                    </button>
                  </div>
                </div>
                <div class="res-dishes-scroll" id="${dishesScrollId}">
                  ${indexedDishes.map(({ dish, originalIdx }) => {
          const isOut = dish.inStock === false;
          return `
                      <div class="dish-card-item ${isOut ? 'dish-out-of-stock' : ''}" onclick="${isOut ? `showToast('alertRegular', 'Món này hiện đang tạm hết hàng!')` : `openDishOptionModalByIndices(${r.id}, ${originalIdx})`}">
                        <img class="dish-card-img" src="${dish.image}" alt="${escapeHtml(dish.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                        <div class="dish-card-info">
                          <div class="dish-card-name" title="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</div>
                          <div class="dish-card-bottom">
                            <span class="dish-card-price">${dish.priceFormatted || formatVND(dish.price)}</span>
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
            ` : ''}
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

// ── Comprehensive Filter Calculation & Matching ──
function calculateFilterMatches(f) {
  let list = [...restaurants];
  if (!f) return list.length;

  // Area
  if (f.area && f.area !== 'all') {
    if (f.area === 'near_ptit') {
      list = list.filter(r => r.area === 'near_ptit' || getRestaurantDistance(r) <= 0.5);
    } else {
      list = list.filter(r => r.area === f.area);
    }
  }

  // Promo
  if (f.promo && f.promo !== 'all') {
    if (f.promo === 'freeship') {
      list = list.filter(r => r.isFreeship);
    } else if (f.promo === 'voucher') {
      list = list.filter(r => r.vouchers && r.vouchers.length > 0);
    } else if (f.promo === 'flash_sale') {
      list = list.filter(r => r.hasFlashSale);
    } else if (f.promo === 'partner') {
      list = list.filter(r => r.isPartner);
    }
  }

  // Shipping
  if (f.shipping && f.shipping !== 'all') {
    list = list.filter(r => Array.isArray(r.shippingProviders) && r.shippingProviders.includes(f.shipping));
  }

  // Price range
  if (f.priceRange && f.priceRange !== 'all') {
    if (f.priceRange === 'under30') {
      list = list.filter(r => (r.relatedDishes || []).some(d => d.price <= 30000) || r.priceLevel === '$');
    } else if (f.priceRange === '30to60') {
      list = list.filter(r => (r.relatedDishes || []).some(d => d.price >= 30000 && d.price <= 60000) || r.priceLevel === '$' || r.priceLevel === '$$');
    } else if (f.priceRange === '60to100') {
      list = list.filter(r => (r.relatedDishes || []).some(d => d.price >= 60000 && d.price <= 100000) || r.priceLevel === '$$');
    } else if (f.priceRange === 'above100') {
      list = list.filter(r => (r.relatedDishes || []).some(d => d.price >= 100000) || r.priceLevel === '$$$');
    }
  }

  // Custom Min & Max Price
  if (f.minPrice !== null && !isNaN(f.minPrice)) {
    list = list.filter(r => (r.relatedDishes || []).some(d => d.price >= f.minPrice));
  }
  if (f.maxPrice !== null && !isNaN(f.maxPrice)) {
    list = list.filter(r => (r.relatedDishes || []).some(d => d.price <= f.maxPrice));
  }

  // Rating
  if (f.ratingMin && f.ratingMin > 0) {
    list = list.filter(r => r.rating >= f.ratingMin);
  }

  return list.length;
}

function getFilteredRestaurants() {
  let list = [...restaurants];

  // 1. Text search query
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(r => {
      const matchName = r.name.toLowerCase().includes(q);
      const matchCat = (r.category || '').toLowerCase().includes(q);
      const matchReview = (r.shortReview || '').toLowerCase().includes(q);
      const matchDish = (r.relatedDishes || []).some(d =>
        d.name.toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q) ||
        (typeof dbmItemMatchesQuery === 'function' && dbmItemMatchesQuery(d, q))
      );
      return matchName || matchCat || matchReview || matchDish;
    });
  }

  // 2. Distance filter
  if (distanceFilter !== null) {
    list = list.filter(r => getRestaurantDistance(r) <= distanceFilter);
  }

  // 3. Area / Location
  if (activeFilters.area && activeFilters.area !== 'all') {
    if (activeFilters.area === 'near_ptit') {
      list = list.filter(r => r.area === 'near_ptit' || getRestaurantDistance(r) <= 0.5);
    } else {
      list = list.filter(r => r.area === activeFilters.area);
    }
  }

  // 4. Promo
  if (activeFilters.promo && activeFilters.promo !== 'all') {
    if (activeFilters.promo === 'freeship') {
      list = list.filter(r => r.isFreeship);
    } else if (activeFilters.promo === 'voucher') {
      list = list.filter(r => r.vouchers && r.vouchers.length > 0);
    } else if (activeFilters.promo === 'flash_sale') {
      list = list.filter(r => r.hasFlashSale);
    } else if (activeFilters.promo === 'partner') {
      list = list.filter(r => r.isPartner);
    }
  }

  // Legacy promo quick pills
  if (activeFilters.freeship) {
    list = list.filter(r => r.isFreeship);
  }
  if (activeFilters.voucher) {
    list = list.filter(r => r.vouchers && r.vouchers.length > 0);
  }
  if (activeFilters.budget) {
    list = list.filter(r => r.priceLevel === '$');
  }

  // 5. Shipping Providers
  if (activeFilters.shipping && activeFilters.shipping !== 'all') {
    list = list.filter(r => Array.isArray(r.shippingProviders) && r.shippingProviders.includes(activeFilters.shipping));
  }

  // 6. Price Range
  if (activeFilters.priceRange && activeFilters.priceRange !== 'all') {
    if (activeFilters.priceRange === 'under30') {
      list = list.filter(r => (r.relatedDishes || []).some(d => d.price <= 30000) || r.priceLevel === '$');
    } else if (activeFilters.priceRange === '30to60') {
      list = list.filter(r => (r.relatedDishes || []).some(d => d.price >= 30000 && d.price <= 60000) || r.priceLevel === '$' || r.priceLevel === '$$');
    } else if (activeFilters.priceRange === '60to100') {
      list = list.filter(r => (r.relatedDishes || []).some(d => d.price >= 60000 && d.price <= 100000) || r.priceLevel === '$$');
    } else if (activeFilters.priceRange === 'above100') {
      list = list.filter(r => (r.relatedDishes || []).some(d => d.price >= 100000) || r.priceLevel === '$$$');
    }
  }

  // Custom Min & Max Price
  if (activeFilters.minPrice !== null && !isNaN(activeFilters.minPrice)) {
    list = list.filter(r => (r.relatedDishes || []).some(d => d.price >= activeFilters.minPrice));
  }
  if (activeFilters.maxPrice !== null && !isNaN(activeFilters.maxPrice)) {
    list = list.filter(r => (r.relatedDishes || []).some(d => d.price <= activeFilters.maxPrice));
  }

  // 7. Ratings
  if (activeFilters.rating45) {
    list = list.filter(r => r.rating >= 4.8);
  } else if (activeFilters.ratingMin && activeFilters.ratingMin > 0) {
    list = list.filter(r => r.rating >= activeFilters.ratingMin);
  }

  // 8. Sort by nearest distance if 'near' is active
  if (activeFilters.near) {
    list.sort((a, b) => getRestaurantDistance(a) - getRestaurantDistance(b));
  }

  return list;
}

// ==========================================================================
// SEARCH & FILTER MODAL CONTROLLER
// ==========================================================================

const filterLabelsMap = {
  area: {
    near_ptit: '🏫 Quanh PTIT (<500m)',
    ao_sen: '🍜 Ao Sen & Mộ Lao',
    nguyen_van_loc: '☕ Nguyễn Văn Lộc',
    van_quan: '🏘️ Văn Quán - Chiến Thắng',
    tran_phu: '🚇 Trục Trần Phú'
  },
  promo: {
    freeship: '🚚 Freeship 0đ',
    voucher: '🎟️ Có mã Voucher',
    flash_sale: '⚡ Flash Sale SV',
    partner: '⭐ Quán đối tác PTIT'
  },
  shipping: {
    ptit_express: '⚡ PTIT Express (15p)',
    grab_express: '🟢 GrabExpress',
    shopeefood: '🟠 ShopeeFood',
    be_delivery: '🟡 BeDelivery'
  },
  priceRange: {
    'under30': '💰 Dưới 30k',
    '30to60': '💰 30k - 60k',
    '60to100': '💰 60k - 100k',
    'above100': '💰 Trên 100k'
  }
};

function openSearchFilterModal() {
  const overlay = document.getElementById('search-filter-overlay');
  const sheet = document.getElementById('search-filter-bottom-sheet');
  if (!overlay || !sheet) return;

  tempFilters = { ...activeFilters };
  renderSearchFilterModalContent();
  overlay.classList.add('active');
}

function closeSearchFilterModal() {
  const overlay = document.getElementById('search-filter-overlay');
  if (overlay) overlay.classList.remove('active');
}

function closeSearchFilterModalOnBackdrop(e) {
  // Khi search-filter-overlay active, chạm/click ra vùng ngoài modal không bị thoát ra ngoài
  if (e && (e.target === e.currentTarget || (e.target && e.target.id === 'search-filter-overlay'))) {
    const sheet = document.getElementById('search-filter-bottom-sheet');
    if (sheet) {
      sheet.classList.remove('modal-shake-prompt');
      void sheet.offsetWidth;
      sheet.classList.add('modal-shake-prompt');
      setTimeout(() => sheet.classList.remove('modal-shake-prompt'), 400);
    }
    const closeBtn = sheet ? sheet.querySelector('.filter-sheet-close-btn') : null;
    if (closeBtn) {
      closeBtn.classList.remove('close-btn-nudge');
      void closeBtn.offsetWidth;
      closeBtn.classList.add('close-btn-nudge');
      setTimeout(() => closeBtn.classList.remove('close-btn-nudge'), 600);
    }
  }
}

function renderSearchFilterModalContent() {
  const sheet = document.getElementById('search-filter-bottom-sheet');
  if (!sheet) return;

  const matchCount = calculateFilterMatches(tempFilters);

  sheet.innerHTML = `
    <div class="filter-sheet-header">
      <div class="filter-sheet-title-row">
        <div class="filter-sheet-icon">
          ${FluentIcons.filterRegular}
        </div>
        <div>
          <div class="filter-sheet-title">Bộ lọc &amp; Tìm kiếm nâng cao</div>
          <div class="filter-sheet-subtitle">Lọc quán ngon quanh Học viện PTIT &amp; Hà Đông</div>
        </div>
      </div>
      <button type="button" class="filter-sheet-close-btn" onclick="closeSearchFilterModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="filter-sheet-body">
      <!-- 1. Nơi bán / Khu vực -->
      <div class="filter-group">
        <div class="filter-group-title">
          <span>📍 Nơi bán / Khu vực quanh PTIT</span>
          <span class="filter-group-badge">${tempFilters.area === 'all' ? 'Tất cả' : 'Đã chọn'}</span>
        </div>
        <div class="filter-options-grid">
          <button type="button" class="filter-chip-btn ${tempFilters.area === 'all' ? 'active' : ''}" onclick="setFilterTemp('area', 'all')">
            Tất cả khu vực
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.area === 'near_ptit' ? 'active' : ''}" onclick="setFilterTemp('area', 'near_ptit')">
            🏫 Quanh PTIT (&lt;500m)
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.area === 'ao_sen' ? 'active' : ''}" onclick="setFilterTemp('area', 'ao_sen')">
            🍜 Ao Sen &amp; Mộ Lao
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.area === 'nguyen_van_loc' ? 'active' : ''}" onclick="setFilterTemp('area', 'nguyen_van_loc')">
            ☕ Nguyễn Văn Lộc
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.area === 'van_quan' ? 'active' : ''}" onclick="setFilterTemp('area', 'van_quan')">
            🏘️ Văn Quán - Chiến Thắng
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.area === 'tran_phu' ? 'active' : ''}" onclick="setFilterTemp('area', 'tran_phu')">
            🚇 Trục đường Trần Phú
          </button>
        </div>
      </div>

      <!-- 2. Khuyến mãi & Ưu đãi -->
      <div class="filter-group">
        <div class="filter-group-title">
          <span>🎁 Khuyến mãi &amp; Ưu đãi đặc biệt</span>
          <span class="filter-group-badge">${tempFilters.promo === 'all' ? 'Tất cả' : 'Đã chọn'}</span>
        </div>
        <div class="filter-options-grid">
          <button type="button" class="filter-chip-btn ${tempFilters.promo === 'all' ? 'active' : ''}" onclick="setFilterTemp('promo', 'all')">
            Tất cả ưu đãi
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.promo === 'freeship' ? 'active' : ''}" onclick="setFilterTemp('promo', 'freeship')">
            🚚 Freeship 0đ
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.promo === 'voucher' ? 'active' : ''}" onclick="setFilterTemp('promo', 'voucher')">
            ${FluentIcons.ticketHorizontalFilled} Có mã Voucher
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.promo === 'flash_sale' ? 'active' : ''}" onclick="setFilterTemp('promo', 'flash_sale')">
            ${FluentIcons.flashFilled} Flash Sale sinh viên
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.promo === 'partner' ? 'active' : ''}" onclick="setFilterTemp('promo', 'partner')">
            ⭐ Quán đối tác PTIT
          </button>
        </div>
      </div>

      <!-- 3. Đơn vị vận chuyển -->
      <div class="filter-group">
        <div class="filter-group-title">
          <span>🛵 Đơn vị vận chuyển</span>
          <span class="filter-group-badge">${tempFilters.shipping === 'all' ? 'Tất cả' : 'Đã chọn'}</span>
        </div>
        <div class="filter-options-grid">
          <button type="button" class="filter-chip-btn ${tempFilters.shipping === 'all' ? 'active' : ''}" onclick="setFilterTemp('shipping', 'all')">
            Tất cả đơn vị
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.shipping === 'ptit_express' ? 'active' : ''}" onclick="setFilterTemp('shipping', 'ptit_express')">
            ${FluentIcons.flashFilled} PTIT Express (15p)
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.shipping === 'grab_express' ? 'active' : ''}" onclick="setFilterTemp('shipping', 'grab_express')">
            🟢 GrabExpress
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.shipping === 'shopeefood' ? 'active' : ''}" onclick="setFilterTemp('shipping', 'shopeefood')">
            🟠 ShopeeFood
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.shipping === 'be_delivery' ? 'active' : ''}" onclick="setFilterTemp('shipping', 'be_delivery')">
            🟡 BeDelivery
          </button>
        </div>
      </div>

      <!-- 4. Khoảng giá -->
      <div class="filter-group">
        <div class="filter-group-title">
          <span>💰 Khoảng giá món ăn</span>
          <span class="filter-group-badge">${tempFilters.priceRange === 'all' && !tempFilters.minPrice && !tempFilters.maxPrice ? 'Tất cả' : 'Đã chọn'}</span>
        </div>
        <div class="filter-options-grid">
          <button type="button" class="filter-chip-btn ${tempFilters.priceRange === 'all' && !tempFilters.minPrice && !tempFilters.maxPrice ? 'active' : ''}" onclick="setFilterTempPrice('all')">
            Tất cả mức giá
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.priceRange === 'under30' ? 'active' : ''}" onclick="setFilterTempPrice('under30')">
            Dưới 30.000đ
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.priceRange === '30to60' ? 'active' : ''}" onclick="setFilterTempPrice('30to60')">
            30.000đ - 60.000đ
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.priceRange === '60to100' ? 'active' : ''}" onclick="setFilterTempPrice('60to100')">
            60.000đ - 100.000đ
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.priceRange === 'above100' ? 'active' : ''}" onclick="setFilterTempPrice('above100')">
            Trên 100.000đ
          </button>
        </div>

        <div class="filter-price-inputs-row">
          <div class="filter-price-input-wrap">
            <input 
              type="number" 
              class="filter-price-input" 
              id="filter-min-price" 
              placeholder="Giá từ" 
              value="${tempFilters.minPrice || ''}"
              oninput="onCustomPriceChange()"
            >
            <span class="filter-price-unit">đ</span>
          </div>
          <span class="filter-price-dash">—</span>
          <div class="filter-price-input-wrap">
            <input 
              type="number" 
              class="filter-price-input" 
              id="filter-max-price" 
              placeholder="Đến giá" 
              value="${tempFilters.maxPrice || ''}"
              oninput="onCustomPriceChange()"
            >
            <span class="filter-price-unit">đ</span>
          </div>
        </div>
      </div>

      <!-- 5. Đánh giá sao -->
      <div class="filter-group">
        <div class="filter-group-title">
          <span>⭐ Đánh giá quán ăn</span>
          <span class="filter-group-badge">${tempFilters.ratingMin > 0 ? `${tempFilters.ratingMin}+ sao` : 'Tất cả'}</span>
        </div>
        <div class="filter-options-grid">
          <button type="button" class="filter-chip-btn ${!tempFilters.ratingMin ? 'active' : ''}" onclick="setFilterTemp('ratingMin', 0)">
            Tất cả đánh giá
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.ratingMin === 4.8 ? 'active' : ''}" onclick="setFilterTemp('ratingMin', 4.8)">
            ⭐ 4.8+ (Tuyệt hảo)
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.ratingMin === 4.5 ? 'active' : ''}" onclick="setFilterTemp('ratingMin', 4.5)">
            ⭐ 4.5+ (Rất tốt)
          </button>
          <button type="button" class="filter-chip-btn ${tempFilters.ratingMin === 4.0 ? 'active' : ''}" onclick="setFilterTemp('ratingMin', 4.0)">
            ⭐ 4.0+ (Tốt trở lên)
          </button>
        </div>
      </div>
    </div>

    <div class="filter-sheet-footer">
      <button type="button" class="filter-btn-reset" onclick="resetSearchFilterModal()">
        Đặt lại
      </button>
      <button type="button" class="filter-btn-apply" id="filter-btn-apply" onclick="applySearchFilters()">
        <span>Áp dụng</span>
        <span style="opacity: 0.9;">(${matchCount} quán)</span>
      </button>
    </div>
  `;
}

function setFilterTemp(key, val) {
  tempFilters[key] = val;
  renderSearchFilterModalContent();
}

function setFilterTempPrice(range) {
  tempFilters.priceRange = range;
  tempFilters.minPrice = null;
  tempFilters.maxPrice = null;
  renderSearchFilterModalContent();
}

function onCustomPriceChange() {
  const minVal = parseInt(document.getElementById('filter-min-price')?.value, 10);
  const maxVal = parseInt(document.getElementById('filter-max-price')?.value, 10);
  tempFilters.minPrice = (!isNaN(minVal) && minVal > 0) ? minVal : null;
  tempFilters.maxPrice = (!isNaN(maxVal) && maxVal > 0) ? maxVal : null;
  tempFilters.priceRange = (tempFilters.minPrice || tempFilters.maxPrice) ? 'custom' : 'all';

  const count = calculateFilterMatches(tempFilters);
  const btn = document.getElementById('filter-btn-apply');
  if (btn) {
    btn.innerHTML = `<span>Áp dụng</span><span style="opacity:0.9;">(${count} quán)</span>`;
  }
}

function resetSearchFilterModal() {
  tempFilters = {
    near: false,
    rating45: false,
    freeship: false,
    budget: false,
    voucher: false,
    area: 'all',
    promo: 'all',
    shipping: 'all',
    priceRange: 'all',
    minPrice: null,
    maxPrice: null,
    ratingMin: 0
  };
  renderSearchFilterModalContent();
}

function applySearchFilters() {
  activeFilters = { ...tempFilters };
  closeSearchFilterModal();

  if (currentView !== 'search') {
    openSearchView();
  } else {
    renderSearchView();
  }

  const matchCount = getFilteredRestaurants().length;
  showToast('filterRegular', `Đã áp dụng bộ lọc: Tìm thấy ${matchCount} quán phù hợp`);
}

function removeSearchFilterChip(filterKey) {
  if (filterKey === 'area') activeFilters.area = 'all';
  else if (filterKey === 'promo') activeFilters.promo = 'all';
  else if (filterKey === 'shipping') activeFilters.shipping = 'all';
  else if (filterKey === 'priceRange') activeFilters.priceRange = 'all';
  else if (filterKey === 'customPrice') {
    activeFilters.minPrice = null;
    activeFilters.maxPrice = null;
    activeFilters.priceRange = 'all';
  } else if (filterKey === 'ratingMin') {
    activeFilters.ratingMin = 0;
    activeFilters.rating45 = false;
  }
  renderSearchView();
}

function renderActiveFilterPillsHtml() {
  const pills = [];

  if (activeFilters.area && activeFilters.area !== 'all') {
    const lbl = filterLabelsMap.area[activeFilters.area] || activeFilters.area;
    pills.push(`<span class="active-filter-pill"><span>${escapeHtml(lbl)}</span><span class="active-filter-pill-remove" onclick="removeSearchFilterChip('area')" title="Xóa lọc">✕</span></span>`);
  }
  if (activeFilters.promo && activeFilters.promo !== 'all') {
    const lbl = filterLabelsMap.promo[activeFilters.promo] || activeFilters.promo;
    pills.push(`<span class="active-filter-pill"><span>${escapeHtml(lbl)}</span><span class="active-filter-pill-remove" onclick="removeSearchFilterChip('promo')" title="Xóa lọc">✕</span></span>`);
  }
  if (activeFilters.shipping && activeFilters.shipping !== 'all') {
    const lbl = filterLabelsMap.shipping[activeFilters.shipping] || activeFilters.shipping;
    pills.push(`<span class="active-filter-pill"><span>${escapeHtml(lbl)}</span><span class="active-filter-pill-remove" onclick="removeSearchFilterChip('shipping')" title="Xóa lọc">✕</span></span>`);
  }
  if (activeFilters.priceRange && activeFilters.priceRange !== 'all') {
    const lbl = filterLabelsMap.priceRange[activeFilters.priceRange] || activeFilters.priceRange;
    pills.push(`<span class="active-filter-pill"><span>${escapeHtml(lbl)}</span><span class="active-filter-pill-remove" onclick="removeSearchFilterChip('priceRange')" title="Xóa lọc">✕</span></span>`);
  } else if (activeFilters.minPrice || activeFilters.maxPrice) {
    const minTxt = activeFilters.minPrice ? formatVND(activeFilters.minPrice) : '0';
    const maxTxt = activeFilters.maxPrice ? formatVND(activeFilters.maxPrice) : 'Max';
    pills.push(`<span class="active-filter-pill"><span>💰 ${minTxt} - ${maxTxt}</span><span class="active-filter-pill-remove" onclick="removeSearchFilterChip('customPrice')" title="Xóa lọc">✕</span></span>`);
  }
  if (activeFilters.ratingMin && activeFilters.ratingMin > 0) {
    pills.push(`<span class="active-filter-pill"><span>⭐ ${activeFilters.ratingMin}+ sao</span><span class="active-filter-pill-remove" onclick="removeSearchFilterChip('ratingMin')" title="Xóa lọc">✕</span></span>`);
  }

  if (pills.length === 0) return '';
  return `
    <div class="active-filters-scroll">
      ${pills.join('')}
      <button type="button" onclick="openSearchFilterModal()" style="background:none;border:none;color:var(--green-600);font-size:11.5px;font-weight:700;cursor:pointer;padding:0 4px;white-space:nowrap;">
        + Tùy chỉnh thêm
      </button>
    </div>
  `;
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

  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
}

function renderSearchView() {
  const filteredList = getFilteredRestaurants();

  app.innerHTML = `
    <div class="search-view fade-in">
      <!-- In-Page Search Header: Hiển thị tự nhiên, phẳng, không đổ bóng hay nổi tách biệt -->
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
        <button class="search-filter-toggle-btn ${(activeFilters.area !== 'all' || activeFilters.promo !== 'all' || activeFilters.shipping !== 'all' || activeFilters.priceRange !== 'all' || activeFilters.ratingMin > 0) ? 'active' : ''}" onclick="openSearchFilterModal()" title="Bộ lọc tìm kiếm nâng cao">
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
            <span>${FluentIcons.ticketHorizontalFilled} Có Voucher</span>
          </div>
        </div>
        ${renderActiveFilterPillsHtml()}
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
  setTimeout(() => enableDragToScroll('visual-suggestions-scroll'), 50);
}

function enableDragToScroll(elId) {
  if (typeof document === 'undefined') return;
  const el = typeof elId === 'string' ? document.getElementById(elId) : elId;
  if (!el || typeof el.addEventListener !== 'function' || el._dragAttached) return;
  el._dragAttached = true;
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  el.addEventListener('mousedown', (e) => {
    isDown = true;
    el.classList.add('dragging');
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
  });
  el.addEventListener('mouseleave', () => {
    isDown = false;
    el.classList.remove('dragging');
  });
  el.addEventListener('mouseup', () => {
    isDown = false;
    el.classList.remove('dragging');
  });
  el.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeft - walk;
  });
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
          <div class="res-dishes-label">Món ngon nổi bật (${r.relatedDishes.length} món):</div>
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

  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
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
  const r = (Array.isArray(restaurants) ? restaurants : []).find(x => String(x.id) === String(resId))
    || (typeof DB !== 'undefined' && DB.getStoreById(resId));
  if (!r || !Array.isArray(r.relatedDishes) || !r.relatedDishes[dishIdx]) return;
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
  const sheet = document.getElementById('modal-bottom-sheet');
  if (overlay) {
    overlay.classList.remove('active');
  }
  if (sheet) {
    setTimeout(() => {
      if (!overlay || !overlay.classList.contains('active')) {
        sheet.classList.remove('vqr-wide-sheet');
        sheet.classList.remove('dbm-wide-sheet');
      }
    }, 320);
  }
  if (typeof isNutritionSurveyModalOpen !== 'undefined') {
    isNutritionSurveyModalOpen = false;
  }
}

function closeModalOnBackdrop(event) {
  // Khi modal-overlay active, chạm/click ra vùng ngoài bảng/modal không bị thoát ra ngoài (static backdrop)
  if (event && (event.target === event.currentTarget || (event.target && event.target.id === 'modal-overlay'))) {
    const sheet = document.getElementById('modal-bottom-sheet');
    if (sheet) {
      sheet.classList.remove('modal-shake-prompt');
      void sheet.offsetWidth; // Force reflow để trigger animation
      sheet.classList.add('modal-shake-prompt');
      setTimeout(() => sheet.classList.remove('modal-shake-prompt'), 400);
    }
    // Gợi ý người dùng đóng modal bằng nút đóng (✕) hoặc nút thao tác
    const closeBtn = sheet ? sheet.querySelector('.dish-modal-close-btn, .close-btn, .dbm-close-btn') : null;
    if (closeBtn) {
      closeBtn.classList.remove('close-btn-nudge');
      void closeBtn.offsetWidth;
      closeBtn.classList.add('close-btn-nudge');
      setTimeout(() => closeBtn.classList.remove('close-btn-nudge'), 600);
    }
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

// ── Cart Helper: Thêm món hoặc tăng số lượng nếu trùng món & tùy chọn (size, topping, ghi chú) ──
function addOrMergeCartItem(newItem) {
  if (!newItem || !Array.isArray(cart)) return;

  const normalizeToppingIds = (toppings) => {
    if (!Array.isArray(toppings)) return '';
    return toppings
      .map(t => (t && (t.id !== undefined && t.id !== null ? t.id : t.name)) || '')
      .filter(Boolean)
      .sort()
      .join('|');
  };

  const newSizeName = (newItem.size && newItem.size.name) ? String(newItem.size.name).trim().toLowerCase() : '';
  const newNote = (newItem.note || '').trim().toLowerCase();
  const newToppingsKey = normalizeToppingIds(newItem.toppings);
  const newDishName = (newItem.dishName || '').trim().toLowerCase();
  const newDishId = newItem.dishId !== undefined && newItem.dishId !== null ? String(newItem.dishId) : null;

  const existingIndex = cart.findIndex(c => {
    // So sánh dishId (nếu có) hoặc tên món
    if (newDishId && (c.dishId !== undefined && c.dishId !== null)) {
      if (String(c.dishId) !== newDishId) return false;
    } else {
      if ((c.dishName || '').trim().toLowerCase() !== newDishName) return false;
    }

    // So sánh nhà hàng
    if (newItem.restaurantId && c.restaurantId && String(newItem.restaurantId) !== String(c.restaurantId)) {
      return false;
    }

    // So sánh size
    const cSizeName = (c.size && c.size.name) ? String(c.size.name).trim().toLowerCase() : '';
    if (cSizeName !== newSizeName) return false;

    // So sánh topping
    const cToppingsKey = normalizeToppingIds(c.toppings);
    if (cToppingsKey !== newToppingsKey) return false;

    // So sánh ghi chú bếp
    const cNote = (c.note || '').trim().toLowerCase();
    if (cNote !== newNote) return false;

    return true;
  });

  const addQty = Math.max(1, Number(newItem.quantity) || 1);

  if (existingIndex !== -1) {
    // Đã có món cùng kiểu -> tăng số lượng và cập nhật tổng tiền
    const existing = cart[existingIndex];
    existing.quantity = (Number(existing.quantity) || 1) + addQty;
    const uPrice = Number(existing.unitPrice) || Number(newItem.unitPrice) || 0;
    existing.unitPrice = uPrice;
    existing.totalPrice = uPrice * existing.quantity;
    return { merged: true, item: existing };
  } else {
    // Chưa có -> thêm mới
    const itemToPush = {
      id: newItem.id || (Date.now() + Math.random().toString(36).substring(2, 6)),
      dishId: newItem.dishId,
      dishName: newItem.dishName,
      restaurantName: newItem.restaurantName || 'ptitngon Kitchen',
      restaurantId: newItem.restaurantId || 1,
      image: newItem.image,
      size: newItem.size || { name: 'Phần Tiêu Chuẩn', extraPrice: 0 },
      toppings: Array.isArray(newItem.toppings) ? newItem.toppings : [],
      note: (newItem.note || '').trim(),
      quantity: addQty,
      unitPrice: Number(newItem.unitPrice) || 0,
      totalPrice: (Number(newItem.unitPrice) || 0) * addQty
    };
    cart.push(itemToPush);
    return { merged: false, item: itemToPush };
  }
}

// Phơi ra window để các module khác (dish-detail.js, ai-chat.js, user-nutrition.js) dùng chung nhất quán
if (typeof window !== 'undefined') {
  window.addOrMergeCartItem = addOrMergeCartItem;
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

  const result = addOrMergeCartItem({
    dishId: modalDish.id,
    dishName: modalDish.name,
    restaurantName: modalRestaurant ? modalRestaurant.name : 'ptitngon Kitchen',
    restaurantId: modalRestaurant ? modalRestaurant.id : 1,
    image: modalDish.image,
    size: size,
    toppings: selectedToppingsList,
    note: modalKitchenNote.trim(),
    quantity: modalQty,
    unitPrice: unitPrice
  });

  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserCart(cart);
  }
  closeModal();
  updateFloatingCartBar();

  const currentTotal = result.item ? result.item.totalPrice : (unitPrice * modalQty);
  const toastMsg = result.merged
    ? `Đã tăng số lượng "${modalDish.name}" lên ${result.item.quantity} (${formatVND(currentTotal)}) trong giỏ!`
    : `Đã thêm ${modalQty}x "${modalDish.name}" (${formatVND(currentTotal)}) vào giỏ!`;
  showToast('cartRegular', toastMsg);
}

// ========================================
// 3A. MAP SERVICE (GOOGLE MAPS & OPENSTREETMAP PROVIDER ENGINE)
// ========================================

const MapService = {
  CONFIG_KEY: 'ptitngon_map_config',
  DEFAULT_CONFIG: {
    provider: 'osm', // 'osm' | 'google'
    googleApiKey: '',
    mapType: 'roadmap', // 'roadmap' | 'satellite' | 'hybrid' | 'terrain'
    autoReverseGeocode: true,
    enableTraffic: false
  },

  getConfig() {
    try {
      const raw = localStorage.getItem(this.CONFIG_KEY);
      if (raw) {
        return { ...this.DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (_) { }
    if (typeof DB !== 'undefined' && DB.isReady && DB.data && DB.data.mapConfig) {
      return { ...this.DEFAULT_CONFIG, ...DB.data.mapConfig };
    }
    return { ...this.DEFAULT_CONFIG };
  },

  saveConfig(newConfig) {
    const merged = { ...this.getConfig(), ...newConfig };
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(merged));
    } catch (_) { }
    if (typeof DB !== 'undefined' && DB.isReady && DB.data) {
      DB.data.mapConfig = merged;
      if (typeof DB.save === 'function') DB.save();
    }
    return merged;
  },

  isGoogleMapsActive() {
    const cfg = this.getConfig();
    return cfg.provider === 'google' && Boolean(cfg.googleApiKey && cfg.googleApiKey.trim());
  },

  loadGoogleMaps(apiKey, callback) {
    const key = (apiKey || this.getConfig().googleApiKey || '').trim();
    if (!key) {
      if (typeof callback === 'function') callback(false, 'Chưa nhập Google Maps API Key');
      return;
    }
    if (typeof window.google !== 'undefined' && window.google.maps) {
      if (typeof callback === 'function') callback(true);
      return;
    }
    const oldScript = document.getElementById('google-maps-script');
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry&language=vi`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (typeof callback === 'function') callback(true);
    };
    script.onerror = (e) => {
      console.warn('Google Maps script load error:', e);
      if (typeof callback === 'function') callback(false, 'Không thể tải Google Maps (kiểm tra lại API Key hoặc quyền truy cập mạng)');
    };
    document.head.appendChild(script);
  },

  async testGoogleApiKey(apiKey) {
    const key = (apiKey || '').trim();
    if (!key) {
      return { ok: false, message: 'Vui lòng nhập chuỗi API Key của Google Maps (bắt đầu bằng AIzaSy...) trước khi kiểm tra!' };
    }

    try {
      // 1. Kiểm tra tải SDK Google Maps
      const sdkResult = await new Promise((resolve) => {
        this.loadGoogleMaps(key, (success, err) => {
          if (success) resolve({ ok: true });
          else resolve({ ok: false, message: err });
        });
      });

      if (!sdkResult.ok) {
        return sdkResult;
      }

      // 2. Thử nghiệm Geocoding API với tọa độ PTIT Hà Đông
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        const geoResult = await new Promise((resolve) => {
          geocoder.geocode({ location: { lat: 20.9806, lng: 105.7878 } }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve({
                ok: true,
                message: `Kết nối Google Maps API thành công!\nĐịa chỉ xác thực: "${results[0].formatted_address}"`,
                sampleAddress: results[0].formatted_address
              });
            } else {
              resolve({
                ok: true,
                message: 'Kết nối Google Maps JavaScript API thành công! (Lưu ý: Geocoding API có thể cần bật thêm trên Google Cloud Console nếu muốn tự động dịch tên đường).'
              });
            }
          });
        });
        return geoResult;
      }

      return { ok: true, message: 'Kết nối Google Maps API thành công! Sẵn sàng sử dụng.' };
    } catch (err) {
      return { ok: false, message: `Lỗi kết nối: ${err.message || 'Không thể liên lạc với máy chủ Google Maps'}` };
    }
  }
};
window.MapService = MapService;

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
  const mapCfg = MapService.getConfig();
  const currentProviderLabel = (mapCfg.provider === 'google' && mapCfg.googleApiKey) ? 'Google Maps' : 'OpenStreetMap';

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

      <!-- Detail Address with Actions (Lấy vị trí GPS & Mở bản đồ) -->
      <div class="delivery-input-group">
        <div class="delivery-address-head">
          <label class="delivery-input-label" style="margin-bottom:0;">Địa chỉ nhận hàng chi tiết (*):</label>
          <div class="delivery-loc-actions-group">
            <button type="button" class="db-location-detect-btn" id="delivery-detect-gps-btn" onclick="autoDetectDeliveryAddress()" title="Tự động lấy vị trí hiện tại từ GPS">
              📍 Lấy vị trí hiện tại
            </button>
            <button type="button" class="db-location-map-toggle-btn" id="delivery-toggle-map-btn" onclick="toggleDeliveryMapPicker()" title="Mở bản đồ chọn điểm nhận">
              🗺️ Chọn trên bản đồ
            </button>
          </div>
        </div>
        <textarea 
          id="delivery-input-address" 
          class="delivery-input-field" 
          rows="2" 
          placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
        >${escapeHtml(userDeliveryInfo.address)}</textarea>
      </div>

      <!-- Interactive Map Picker (Mặc định ẩn - Chỉ hiện ra khi người dùng muốn chọn vị trí) -->
      <div class="delivery-map-picker-card" id="delivery-map-picker-card" style="display: none;">
        <div class="delivery-map-header">
          <div class="delivery-map-title">
            <span class="live-pulse-radar"></span>
            <span id="delivery-map-provider-label">Bản đồ điểm nhận (${currentProviderLabel})</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="delivery-coords-badge" id="delivery-coords-badge">
              ${userDeliveryInfo.lat ? `${userDeliveryInfo.lat.toFixed(4)}, ${userDeliveryInfo.lng.toFixed(4)}` : '20.9806, 105.7878'}
            </span>
            <button type="button" class="delivery-map-close-btn" onclick="toggleDeliveryMapPicker(false)" title="Thu gọn bản đồ">✕</button>
          </div>
        </div>
        <div id="user-delivery-map" class="user-delivery-map-container"></div>
        <div class="delivery-map-hint">
          💡 Chạm hoặc kéo ghim trên bản đồ để chọn chính xác điểm giao hàng quanh Học viện PTIT
        </div>
        <div class="delivery-hotspots-section">
          <div class="delivery-hotspots-label">Chọn nhanh điểm nhận tại PTIT:</div>
          <div class="delivery-hotspots-scroll">
            <button type="button" class="loc-hotspot-btn" onclick="selectDeliveryHotspot('ptit_a2')">🏫 Cổng A2 (Trần Phú)</button>
            <button type="button" class="loc-hotspot-btn" onclick="selectDeliveryHotspot('ptit_ktx')">🏢 KTX PTIT</button>
            <button type="button" class="loc-hotspot-btn" onclick="selectDeliveryHotspot('ptit_lib')">📚 Thư viện PTIT</button>
            <button type="button" class="loc-hotspot-btn" onclick="selectDeliveryHotspot('an_ninh')">👮 Học viện An Ninh</button>
            <button type="button" class="loc-hotspot-btn" onclick="selectDeliveryHotspot('hanu')">🎓 ĐH Hà Nội (HANU)</button>
          </div>
        </div>
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
    </div>

    <!-- Modal Sticky Bottom Footer -->
    <div class="delivery-modal-footer">
      <button type="button" class="btn-primary-large" onclick="saveDeliveryInfo()" style="flex: 1; width: 100%;">
        ${FluentIcons.saveFilled} Lưu & Áp Dụng Thông Tin
      </button>
    </div>
  `;

  overlay.classList.add('active');
}

function toggleDeliveryMapPicker(force) {
  const card = document.getElementById('delivery-map-picker-card');
  const btn = document.getElementById('delivery-toggle-map-btn');
  if (!card) return;

  const isHidden = card.style.display === 'none';
  const shouldOpen = (force !== undefined) ? force : isHidden;

  if (shouldOpen) {
    card.style.display = 'flex';
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = '▲ Thu gọn bản đồ';
    }
    setTimeout(() => {
      initUserDeliveryMap();
      if (typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  } else {
    card.style.display = 'none';
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = '🗺️ Chọn trên bản đồ';
    }
  }
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
  if (p.lat && p.lng) {
    tempDeliveryCoords = { lat: p.lat, lng: p.lng };
    const badge = document.getElementById('delivery-coords-badge');
    if (badge) badge.textContent = `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;

    if (userDeliveryMapInstance && userDeliveryMarker) {
      userDeliveryMapInstance.setView([p.lat, p.lng], 16);
      userDeliveryMarker.setLatLng([p.lat, p.lng]);
    }
    if (userDeliveryGoogleMap && userDeliveryGoogleMarker) {
      userDeliveryGoogleMap.setCenter({ lat: p.lat, lng: p.lng });
      userDeliveryGoogleMarker.setPosition({ lat: p.lat, lng: p.lng });
    }
  }
}

let userDeliveryMapInstance = null;
let userDeliveryMarker = null;
let userDeliveryGoogleMap = null;
let userDeliveryGoogleMarker = null;
let tempDeliveryCoords = { lat: 20.9806, lng: 105.7878 };

function selectDeliveryHotspot(id) {
  const spots = {
    ptit_a2: { lat: 20.9806, lng: 105.7878, name: 'Học viện CNBCVT (PTIT), Km10 Trần Phú, Hà Đông', label: 'PTIT Hà Đông' },
    ptit_ktx: { lat: 20.9812, lng: 105.7872, name: 'Ký túc xá PTIT, Phường Mộ Lao, Hà Đông', label: 'KTX PTIT' },
    ptit_lib: { lat: 20.9802, lng: 105.7882, name: 'Thư viện Trung tâm PTIT, Km10 Trần Phú', label: 'PTIT Hà Đông' },
    an_ninh: { lat: 20.9840, lng: 105.7915, name: 'Học viện An Ninh Nhân Dân (C500), Đường Chiến Thắng, Hà Đông', label: 'Học viện An Ninh' },
    hanu: { lat: 20.9870, lng: 105.7930, name: 'Trường Đại học Hà Nội (HANU), Km9 Đường Nguyễn Trãi', label: 'ĐH Hà Nội' }
  };
  const sp = spots[id];
  if (!sp) return;
  tempDeliveryCoords = { lat: sp.lat, lng: sp.lng };
  const addrInput = document.getElementById('delivery-input-address');
  if (addrInput) addrInput.value = sp.name;
  const badge = document.getElementById('delivery-coords-badge');
  if (badge) badge.textContent = `${sp.lat.toFixed(4)}, ${sp.lng.toFixed(4)}`;

  tempDeliveryLabel = sp.label;
  document.querySelectorAll('.delivery-tag-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(sp.label));
  });

  // Cập nhật ghim trên Leaflet
  if (userDeliveryMapInstance && userDeliveryMarker) {
    userDeliveryMapInstance.setView([sp.lat, sp.lng], 16);
    userDeliveryMarker.setLatLng([sp.lat, sp.lng]);
  }
  // Cập nhật ghim trên Google Maps
  if (userDeliveryGoogleMap && userDeliveryGoogleMarker) {
    userDeliveryGoogleMap.setCenter({ lat: sp.lat, lng: sp.lng });
    userDeliveryGoogleMarker.setPosition({ lat: sp.lat, lng: sp.lng });
  }
  showToast('locationRegular', `Đã chọn: ${sp.name}`);
}

function initUserDeliveryMap() {
  const container = document.getElementById('user-delivery-map');
  if (!container) return;

  const lat = tempDeliveryCoords.lat || userDeliveryInfo.lat || 20.9806;
  const lng = tempDeliveryCoords.lng || userDeliveryInfo.lng || 105.7878;
  tempDeliveryCoords = { lat, lng };

  const badge = document.getElementById('delivery-coords-badge');
  if (badge) badge.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  const cfg = MapService.getConfig();
  const labelEl = document.getElementById('delivery-map-provider-label');

  if (cfg.provider === 'google' && cfg.googleApiKey) {
    if (labelEl) labelEl.textContent = 'Bản đồ điểm nhận (Google Maps API)';
    if (userDeliveryMapInstance) {
      try { userDeliveryMapInstance.remove(); } catch (_) { }
      userDeliveryMapInstance = null;
      userDeliveryMarker = null;
    }
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#475569;font-size:12px;font-weight:600;"><span class="live-pulse-radar" style="margin-right:8px;"></span>Đang nạp Google Maps...</div>';

    MapService.loadGoogleMaps(cfg.googleApiKey, (success, err) => {
      if (success && window.google && window.google.maps) {
        renderGoogleDeliveryMap(container, lat, lng, cfg);
      } else {
        if (typeof showToast === 'function') {
          showToast('alertRegular', 'Không thể nạp Google Maps (vui lòng kiểm tra lại API Key). Đang chuyển sang OpenStreetMap.');
        }
        if (labelEl) labelEl.textContent = 'Bản đồ điểm nhận (OpenStreetMap)';
        renderLeafletDeliveryMap(container, lat, lng);
      }
    });
  } else {
    if (labelEl) labelEl.textContent = 'Bản đồ điểm nhận (OpenStreetMap)';
    renderLeafletDeliveryMap(container, lat, lng);
  }
}

function renderGoogleDeliveryMap(container, lat, lng, cfg) {
  container.innerHTML = '';
  try {
    userDeliveryGoogleMap = new google.maps.Map(container, {
      center: { lat, lng },
      zoom: 16,
      mapTypeId: cfg.mapType || 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true,
      gestureHandling: 'greedy'
    });

    if (cfg.enableTraffic) {
      const trafficLayer = new google.maps.TrafficLayer();
      trafficLayer.setMap(userDeliveryGoogleMap);
    }

    userDeliveryGoogleMarker = new google.maps.Marker({
      position: { lat, lng },
      map: userDeliveryGoogleMap,
      draggable: true,
      title: 'Kéo để chọn vị trí giao nhận PTIT',
      animation: google.maps.Animation.DROP
    });

    userDeliveryGoogleMarker.addListener('dragend', (e) => {
      const p = e.latLng;
      onUserMapLocationChanged(p.lat(), p.lng());
    });

    userDeliveryGoogleMap.addListener('click', (e) => {
      if (userDeliveryGoogleMarker) userDeliveryGoogleMarker.setPosition(e.latLng);
      onUserMapLocationChanged(e.latLng.lat(), e.latLng.lng());
    });

    setTimeout(() => {
      if (window.google && google.maps && google.maps.event) {
        google.maps.event.trigger(userDeliveryGoogleMap, 'resize');
        userDeliveryGoogleMap.setCenter({ lat, lng });
      }
    }, 200);
  } catch (e) {
    console.warn('Lỗi khởi tạo Google Maps, fallback Leaflet:', e);
    renderLeafletDeliveryMap(container, lat, lng);
  }
}

function renderLeafletDeliveryMap(container, lat, lng) {
  userDeliveryGoogleMap = null;
  userDeliveryGoogleMarker = null;

  if (typeof L !== 'undefined' && L.map) {
    try {
      if (userDeliveryMapInstance) {
        userDeliveryMapInstance.remove();
        userDeliveryMapInstance = null;
        userDeliveryMarker = null;
      }
      container.innerHTML = '';
      userDeliveryMapInstance = L.map(container, {
        zoomControl: true,
        attributionControl: false
      }).setView([lat, lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(userDeliveryMapInstance);

      const markerHtml = `
        <div class="custom-map-pin">
          <span class="custom-map-pin-badge">Điểm nhận</span>
          <span class="custom-map-pin-icon">📍</span>
        </div>
      `;
      const pinIcon = L.divIcon({
        className: 'custom-user-marker-wrap',
        html: markerHtml,
        iconSize: [80, 50],
        iconAnchor: [40, 48]
      });

      userDeliveryMarker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(userDeliveryMapInstance);

      userDeliveryMarker.on('dragend', function (e) {
        const pos = e.target.getLatLng();
        onUserMapLocationChanged(pos.lat, pos.lng);
      });

      userDeliveryMapInstance.on('click', function (e) {
        if (userDeliveryMarker) userDeliveryMarker.setLatLng(e.latlng);
        onUserMapLocationChanged(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => {
        if (userDeliveryMapInstance) userDeliveryMapInstance.invalidateSize();
      }, 200);
      return;
    } catch (e) {
      console.warn('Leaflet error, fallback vector:', e);
    }
  }

  renderVectorDeliveryMapFallback(container, lat, lng);
}

function onUserMapLocationChanged(lat, lng) {
  tempDeliveryCoords = { lat, lng };
  const badge = document.getElementById('delivery-coords-badge');
  if (badge) badge.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  const addrInput = document.getElementById('delivery-input-address');
  if (!addrInput) return;

  const distToPTIT = calculateHaversineKm(lat, lng, 20.9806, 105.7878);
  if (distToPTIT < 0.25) {
    addrInput.value = 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội';
    return;
  }

  const cfg = MapService.getConfig();

  // 1. Thử dùng Google Geocoder nếu đang bật Google Maps
  if (cfg.provider === 'google' && window.google && window.google.maps && window.google.maps.Geocoder) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results[0] && addrInput) {
        addrInput.value = results[0].formatted_address;
      }
    });
    return;
  }

  // 2. Thử OpenStreetMap Nominatim reverse geocoding
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
    headers: { 'Accept-Language': 'vi' }
  })
    .then(r => r.json())
    .then(data => {
      if (data && data.display_name && addrInput) {
        addrInput.value = data.display_name;
      }
    })
    .catch(() => {
      addrInput.value = `Tọa độ (${lat.toFixed(4)}, ${lng.toFixed(4)}) - Khu vực Hà Đông, Hà Nội (Gần Học viện PTIT)`;
    });
}

function renderVectorDeliveryMapFallback(container, lat, lng) {
  container.innerHTML = `
    <div style="width:100%; height:100%; position:relative; background:#f1f5f9; display:flex; align-items:center; justify-content:center; overflow:hidden;">
      <svg width="100%" height="100%" viewBox="0 0 400 200" style="position:absolute; inset:0;">
        <rect width="400" height="200" fill="#f8fafc"/>
        <line x1="0" y1="100" x2="400" y2="100" stroke="#cbd5e1" stroke-width="12"/>
        <text x="20" y="94" font-size="11" font-weight="bold" fill="#64748b">ĐƯỜNG TRẦN PHÚ (HÀ ĐÔNG)</text>
        <line x1="200" y1="0" x2="200" y2="200" stroke="#cbd5e1" stroke-width="8"/>
        <text x="210" y="30" font-size="10" font-weight="bold" fill="#64748b">PHỐ AO SEN</text>
        <circle cx="200" cy="100" r="8" fill="#16a34a" opacity="0.3"/>
        <rect x="70" y="115" width="120" height="60" rx="8" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
        <text x="80" y="145" font-size="11" font-weight="bold" fill="#334155">Học viện PTIT</text>
        <text x="80" y="160" font-size="9" fill="#64748b">Km10 Trần Phú</text>
      </svg>
      <div style="position:absolute; z-index:2; display:flex; flex-direction:column; align-items:center; transform:translateY(-18px);">
        <span style="background:#ffffff; border:1.5px solid #16a34a; padding:2px 8px; border-radius:9999px; font-size:10.5px; font-weight:800; color:#14532d; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          Điểm nhận PTIT
        </span>
        <span style="font-size:26px; line-height:1; filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));">📍</span>
      </div>
    </div>
  `;

  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
}

// ── Định vị GPS & Hoàn chỉnh chức năng Lấy Vị Trí Hiện Tại ──
function detectCurrentLocation(callback) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    if (typeof showToast === 'function') {
      showToast('dismissCircleRegular', 'Trình duyệt không hỗ trợ định vị GPS trực tiếp.');
    }
    if (typeof callback === 'function') {
      callback({
        latitude: 20.9806,
        longitude: 105.7878,
        address: 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội',
        isFallback: true
      });
    }
    return;
  }

  if (typeof showToast === 'function') {
    showToast('locationRegular', 'Đang kết nối GPS định vị tọa độ hiện tại...');
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      let detectedAddress = '';

      const distToPTIT = calculateHaversineKm(latitude, longitude, 20.9806, 105.7878);
      if (distToPTIT < 0.35) {
        detectedAddress = 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội';
      }

      // Reverse geocoding
      if (!detectedAddress) {
        const cfg = MapService.getConfig();
        // 1. Dùng Google Geocoding REST API nếu Google Maps đang cấu hình
        if (cfg.provider === 'google' && cfg.googleApiKey) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const gRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${encodeURIComponent(cfg.googleApiKey)}&language=vi`, {
              signal: controller.signal
            });
            clearTimeout(timeout);
            if (gRes.ok) {
              const gData = await gRes.json();
              if (gData.results && gData.results[0]) {
                detectedAddress = gData.results[0].formatted_address;
              }
            }
          } catch (_) { }
        }

        // 2. Dùng OpenStreetMap Nominatim
        if (!detectedAddress) {
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
        }
      }

      if (!detectedAddress) {
        detectedAddress = `Tọa độ GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) - Khu vực Hà Đông, Hà Nội (Gần Học viện PTIT)`;
      }

      if (typeof showToast === 'function') {
        const accText = accuracy ? ` (độ chính xác ±${Math.round(accuracy)}m)` : '';
        showToast('checkmarkFilled', `Đã lấy vị trí hiện tại thành công!${accText}`);
      }

      if (typeof callback === 'function') {
        callback({
          latitude,
          longitude,
          address: detectedAddress,
          accuracy,
          isFallback: false
        });
      }
    },
    (err) => {
      console.warn('Geolocation error / permission denied:', err);
      let errMsg = 'Không thể lấy GPS (chưa cấp quyền hoặc mạng yếu). Đã đặt tại PTIT Hà Đông.';
      if (err.code === 1) {
        errMsg = 'Quyền truy cập vị trí đã bị từ chối. Đã đặt vị trí Học viện PTIT.';
      } else if (err.code === 3) {
        errMsg = 'Quá thời gian chờ phản hồi GPS. Đã đặt vị trí Học viện PTIT.';
      }

      if (typeof showToast === 'function') {
        showToast('locationRegular', errMsg);
      }

      const fallbackLoc = {
        latitude: 20.9806,
        longitude: 105.7878,
        address: 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội',
        isFallback: true
      };

      if (typeof callback === 'function') {
        callback(fallbackLoc);
      }
    },
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 10000 }
  );
}

function autoDetectDeliveryAddress() {
  const btn = document.getElementById('delivery-detect-gps-btn');
  let originalHtml = '';
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = '⏳ Đang định vị GPS...';
  }

  detectCurrentLocation((loc) => {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.innerHTML = originalHtml;
    }

    const input = document.getElementById('delivery-input-address');
    if (input) {
      input.value = loc.address;
      input.focus();
    }

    tempDeliveryCoords = { lat: loc.latitude, lng: loc.longitude };
    const badge = document.getElementById('delivery-coords-badge');
    if (badge) badge.textContent = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;

    // Cập nhật ghim trên bản đồ nếu bản đồ đang mở
    const mapCard = document.getElementById('delivery-map-picker-card');
    const isMapOpen = mapCard && mapCard.style.display !== 'none';

    if (isMapOpen) {
      if (userDeliveryMapInstance && userDeliveryMarker) {
        userDeliveryMapInstance.setView([loc.latitude, loc.longitude], 17);
        userDeliveryMarker.setLatLng([loc.latitude, loc.longitude]);
      }
      if (userDeliveryGoogleMap && userDeliveryGoogleMarker) {
        userDeliveryGoogleMap.setCenter({ lat: loc.latitude, lng: loc.longitude });
        userDeliveryGoogleMarker.setPosition({ lat: loc.latitude, lng: loc.longitude });
      }
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
        addressNote: note,
        lat: tempDeliveryCoords.lat || 20.9806,
        lng: tempDeliveryCoords.lng || 105.7878
      });
      userDeliveryInfo.lat = tempDeliveryCoords.lat || 20.9806;
      userDeliveryInfo.lng = tempDeliveryCoords.lng || 105.7878;
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
      note: note,
      lat: tempDeliveryCoords.lat || 20.9806,
      lng: tempDeliveryCoords.lng || 105.7878
    };
  }

  closeModal();
  showToast('locationRegular', `Đã lưu : ${name} (${phone}) • ${userDeliveryInfo.shortAddress}`);

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
              <span class="note-chip" style="background:#fff1f0;border-color:#ffa39e;color:#cf1322;" onclick="applyPromoCode('HUNGCHIENGION')">${FluentIcons.fireFilled} HUNGCHIENGION (-50K)</span>
              <span class="note-chip" onclick="applyPromoCode('PTITNGON50')">${FluentIcons.flashFilled} PTITNGON50 (-50%)</span>
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

  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
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

  // Chuyển sang trang "Đặt hàng thành công" (có nút Xem đơn hàng + gợi ý món theo đơn vừa đặt)
  lastPlacedOrder = newOrder;
  viewingOrderDetailId = null;
  activityFilter = 'delivering';

  if (typeof openOrderSuccessView === 'function') {
    openOrderSuccessView(newOrder);
  } else {
    viewingOrderDetailId = newOrder.orderId;
    showToast('checkmarkFilled', `Đã đặt & lưu đơn ${newOrder.orderId} vào hồ sơ ${userDeliveryInfo.name}!`);
    openActivityView();
  }
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
  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
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
    addOrMergeCartItem({
      dishId: it.dishId || it.id,
      dishName: it.dishName || it.name,
      restaurantName: it.restaurantName || o.resName || 'ptitngon Kitchen',
      restaurantId: it.restaurantId || 1,
      image: it.image || 'assets/images/pho_bo_1792459676492.jpg',
      size: it.size || { name: 'Phần Chuẩn', extraPrice: 0 },
      toppings: it.toppings || [],
      note: it.note || '',
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || (it.totalPrice ? Math.round(it.totalPrice / (it.quantity || 1)) : 50000)
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

function renderActivityTabsBarHtml(isFloating = false) {
  const counts = {
    all: ordersList.length,
    delivering: ordersList.filter(o => o.categoryStatus === 'delivering').length,
    completed: ordersList.filter(o => o.categoryStatus === 'completed').length,
    cancelled: ordersList.filter(o => o.categoryStatus === 'cancelled').length
  };

  const idAttr = isFloating ? 'id="floating-activity-tabs-bar"' : 'id="activity-tabs-bar"';
  const extraClass = isFloating ? 'floating-activity-tabs-bar' : '';

  return `
    <div class="activity-tabs-bar ${extraClass}" ${idAttr}>
      <button 
        type="button"
        class="activity-tab-btn ${activityFilter === 'all' ? 'active' : ''}" 
        onclick="switchActivityFilter('all')"
      >
        <span>Tất cả</span>
        <span class="activity-tab-badge">${counts.all}</span>
      </button>
      <button 
        type="button"
        class="activity-tab-btn ${activityFilter === 'delivering' ? 'active' : ''}" 
        onclick="switchActivityFilter('delivering')"
      >
        <span>Đang giao</span>
        <span class="activity-tab-badge">${counts.delivering}</span>
      </button>
      <button 
        type="button"
        class="activity-tab-btn ${activityFilter === 'completed' ? 'active' : ''}" 
        onclick="switchActivityFilter('completed')"
      >
        <span>Đã giao</span>
        <span class="activity-tab-badge">${counts.completed}</span>
      </button>
      <button 
        type="button"
        class="activity-tab-btn ${activityFilter === 'cancelled' ? 'active' : ''}" 
        onclick="switchActivityFilter('cancelled')"
      >
        <span>Đã hủy</span>
        <span class="activity-tab-badge">${counts.cancelled}</span>
      </button>
    </div>
  `;
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
        <div class="page-nav-title">Hoạt Động &amp; Đơn Hàng</div>
        <div style="width: 36px;"></div>
      </div>

      <!-- 4 Filter Tabs Bar: Tất cả, Đơn đang giao, Đơn đã giao, Đã hủy -->
      <div class="activity-tabs-wrapper">
        ${renderActivityTabsBarHtml(false)}
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

  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
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

          <!-- Live Simulated Order Tracking Map -->
          ${isDelivering ? `
            <div class="order-live-tracking-card" id="order-live-tracking-card">
              <div class="live-tracking-header">
                <div class="live-tracking-title">
                  <span class="live-pulse-radar"></span>
                  <div>
                    <div class="tracking-title-main">BẢN ĐỒ THEO DÕI HỎA TỐC THỜI GIAN THỰC</div>
                    <div class="tracking-title-sub">Giả lập vị trí tài xế từ quán đến cổng trường PTIT</div>
                  </div>
                </div>
                <span class="tracking-service-badge">🛵 PTIT Express Siêu Tốc</span>
              </div>

              <!-- Map Container -->
              <div class="live-tracking-map-wrap">
                <div id="order-live-map" class="order-live-map-canvas"></div>
              </div>

              <!-- Live Simulation HUD & Status Board -->
              <div class="tracking-hud-card">
                <div class="tracking-hud-grid">
                  <div class="tracking-hud-metric">
                    <span class="tracking-hud-label">Quãng đường còn lại</span>
                    <span class="tracking-hud-val highlighted" id="tracking-hud-dist">1.8 km</span>
                  </div>
                  <div class="tracking-hud-metric">
                    <span class="tracking-hud-label">Dự kiến nhận món</span>
                    <span class="tracking-hud-val" id="tracking-hud-eta">8 phút nữa</span>
                  </div>
                  <div class="tracking-hud-metric">
                    <span class="tracking-hud-label">Vận tốc shipper</span>
                    <span class="tracking-hud-val" id="tracking-hud-speed">28 km/h</span>
                  </div>
                  <div class="tracking-hud-metric">
                    <span class="tracking-hud-label">Phương tiện giao</span>
                    <span class="tracking-hud-val">${escapeHtml(o.driver ? o.driver.vehicle : 'Wave Alpha')}</span>
                  </div>
                </div>

                <!-- Live Status Banner -->
                <div class="tracking-hud-status-banner" id="tracking-hud-status">
                  🛵 Tài xế ${escapeHtml(o.driver ? o.driver.name : 'Nguyễn Văn Tài')} đã nhận món và đang di chuyển về phía bạn...
                </div>

                <!-- Simulation Controls -->
                <div class="tracking-sim-controls">
                  <button type="button" class="tracking-ctrl-btn primary" id="tracking-btn-speed" onclick="toggleTrackingSpeed()">
                    ${FluentIcons.flashFilled} Tăng tốc mô phỏng (x3)
                  </button>
                  <button type="button" class="tracking-ctrl-btn" id="tracking-btn-pause" onclick="toggleTrackingPause()">
                    ⏸️ Tạm dừng
                  </button>
                  <button type="button" class="tracking-ctrl-btn" onclick="restartTrackingSimulation()">
                    ${FluentIcons.sync} Chạy lại từ đầu
                  </button>
                </div>
              </div>
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
                ${FluentIcons.sync} Đặt lại đơn này
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
                <span class="order-detail-items-title">${FluentIcons.shoppingBagRegular} Món đã đặt (${(o.items || []).length})</span>
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
                ${isCancelled ? `Đặt lại đơn/combo đã hủy này ${FluentIcons.sync}` : 'Đặt lại đơn hàng này 🍜'}
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      <div style="height: 30px;"></div>
    </div>
  `;

  if (isDelivering) {
    setTimeout(() => initOrderLiveTracking(o), 80);
  } else {
    stopLiveTrackingSimulation();
  }
}


// ==========================================================================
// LIVE SIMULATED ORDER TRACKING ENGINE (MAP & DISTANCE DECREMENT)
// ==========================================================================

let liveTrackingMapInstance = null;
let liveTrackingShipperMarker = null;
let liveTrackingRouteLine = null;
let liveTrackingTraversedLine = null;
let trackingSimTimer = null;
let trackingSimSpeed = 1;
let trackingSimPaused = false;
let trackingWaypoints = [];
let trackingCurrentIdx = 0;
let trackingActiveOrder = null;

function stopLiveTrackingSimulation() {
  if (trackingSimTimer) {
    clearInterval(trackingSimTimer);
    trackingSimTimer = null;
  }
  if (liveTrackingMapInstance) {
    try {
      liveTrackingMapInstance.remove();
    } catch (_) { }
    liveTrackingMapInstance = null;
    liveTrackingShipperMarker = null;
    liveTrackingRouteLine = null;
    liveTrackingTraversedLine = null;
  }
}

function initOrderLiveTracking(order) {
  stopLiveTrackingSimulation();
  trackingActiveOrder = order;
  const container = document.getElementById('order-live-map');
  if (!container) return;

  // 1. Resolve shop coords
  const matchedRes = restaurants.find(r => r.name === order.resName || (order.items && order.items[0] && Number(r.id) === Number(order.items[0].restaurantId)));
  const shopLat = (matchedRes && matchedRes.lat) ? matchedRes.lat : 20.9822;
  const shopLng = (matchedRes && matchedRes.lng) ? matchedRes.lng : 105.7888;

  // 2. Resolve user destination coords
  const userLat = userDeliveryInfo.lat || 20.9806;
  const userLng = userDeliveryInfo.lng || 105.7878;

  // 3. Generate realistic street waypoints between shop and user
  trackingWaypoints = generateDeliveryRouteWaypoints(shopLat, shopLng, userLat, userLng);
  trackingCurrentIdx = 0;
  trackingSimPaused = false;

  // 4. Try Leaflet rendering
  if (typeof L !== 'undefined' && L.map) {
    try {
      liveTrackingMapInstance = L.map('order-live-map', {
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(liveTrackingMapInstance);

      // Shop Pin
      const resShort = (order.resName || 'Quán ăn').split('-')[0].trim();
      const shopIcon = L.divIcon({
        className: 'custom-shop-pin-wrap',
        html: `<div class="custom-map-pin"><span class="custom-map-pin-badge" style="border-color:#e11d48; color:#be123c;">Quán: ${escapeHtml(resShort)}</span><span class="custom-map-pin-icon">🍜</span></div>`,
        iconSize: [110, 50],
        iconAnchor: [55, 48]
      });
      L.marker([shopLat, shopLng], { icon: shopIcon }).addTo(liveTrackingMapInstance);

      // User Destination Pin
      const userIcon = L.divIcon({
        className: 'custom-user-dest-wrap',
        html: `<div class="custom-map-pin"><span class="custom-map-pin-badge">Điểm nhận (PTIT)</span><span class="custom-map-pin-icon">📍</span></div>`,
        iconSize: [95, 50],
        iconAnchor: [47, 48]
      });
      L.marker([userLat, userLng], { icon: userIcon }).addTo(liveTrackingMapInstance);

      // Moving Shipper Marker
      const driverIcon = L.divIcon({
        className: 'custom-driver-marker-wrap',
        html: `<div class="custom-driver-pin" title="Tài xế ${escapeHtml(order.driver?.name || 'PTIT Express')}">🛵</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
      liveTrackingShipperMarker = L.marker([shopLat, shopLng], { icon: driverIcon }).addTo(liveTrackingMapInstance);

      // Route lines
      liveTrackingRouteLine = L.polyline(trackingWaypoints, {
        color: '#16a34a',
        weight: 4,
        opacity: 0.45,
        dashArray: '6, 8'
      }).addTo(liveTrackingMapInstance);

      liveTrackingTraversedLine = L.polyline([[shopLat, shopLng]], {
        color: '#15803d',
        weight: 5,
        opacity: 0.95
      }).addTo(liveTrackingMapInstance);

      const bounds = L.latLngBounds([[shopLat, shopLng], [userLat, userLng]]);
      liveTrackingMapInstance.fitBounds(bounds, { padding: [45, 45] });

      setTimeout(() => {
        if (liveTrackingMapInstance) liveTrackingMapInstance.invalidateSize();
      }, 200);

    } catch (e) {
      console.warn('Leaflet tracking error, falling back to SVG:', e);
      renderVectorTrackingFallback(container, shopLat, shopLng, userLat, userLng, order);
    }
  } else {
    renderVectorTrackingFallback(container, shopLat, shopLng, userLat, userLng, order);
  }

  startTrackingSimulationLoop();
}

function generateDeliveryRouteWaypoints(sLat, sLng, uLat, uLng) {
  const steps = 18;
  const pts = [];
  const midLat = (sLat + uLat) / 2 + 0.0003;
  const midLng = (sLng + uLng) / 2 - 0.0004;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = Math.pow(1 - t, 2) * sLat + 2 * (1 - t) * t * midLat + Math.pow(t, 2) * uLat;
    const lng = Math.pow(1 - t, 2) * sLng + 2 * (1 - t) * t * midLng + Math.pow(t, 2) * uLng;
    pts.push([lat, lng]);
  }
  return pts;
}

function startTrackingSimulationLoop() {
  if (trackingSimTimer) clearInterval(trackingSimTimer);

  const intervalMs = Math.round(1400 / trackingSimSpeed);
  trackingSimTimer = setInterval(() => {
    if (trackingSimPaused) return;
    if (trackingCurrentIdx < trackingWaypoints.length - 1) {
      trackingCurrentIdx++;
      updateLiveTrackingFrame();
    } else {
      onDriverArrivedAtDestination();
    }
  }, intervalMs);

  updateLiveTrackingFrame();
}

function updateLiveTrackingFrame() {
  if (!trackingWaypoints || trackingWaypoints.length === 0) return;
  const currentPos = trackingWaypoints[trackingCurrentIdx];
  const userPos = trackingWaypoints[trackingWaypoints.length - 1];

  // Move Leaflet marker
  if (liveTrackingShipperMarker && liveTrackingMapInstance) {
    liveTrackingShipperMarker.setLatLng(currentPos);
    const traversed = trackingWaypoints.slice(0, trackingCurrentIdx + 1);
    if (liveTrackingTraversedLine) liveTrackingTraversedLine.setLatLngs(traversed);
  }

  // Move SVG marker if fallback active
  updateVectorShipperPos(trackingCurrentIdx / (trackingWaypoints.length - 1));

  // Compute remaining distance
  const remainingDist = calculateHaversineKm(currentPos[0], currentPos[1], userPos[0], userPos[1]);
  const progressRatio = trackingCurrentIdx / (trackingWaypoints.length - 1);

  // Update HUD
  const distEl = document.getElementById('tracking-hud-dist');
  const etaEl = document.getElementById('tracking-hud-eta');
  const speedEl = document.getElementById('tracking-hud-speed');
  const statusEl = document.getElementById('tracking-hud-status');

  if (distEl) {
    if (remainingDist <= 0.08) {
      distEl.textContent = '50 m (Đã tới nơi!)';
      distEl.style.color = '#16a34a';
    } else {
      distEl.textContent = `${remainingDist.toFixed(1)} km`;
    }
  }

  if (etaEl) {
    if (remainingDist <= 0.08) {
      etaEl.textContent = 'Đang gọi nhận món';
    } else {
      const etaMin = Math.max(1, Math.round(remainingDist * 4.2));
      etaEl.textContent = `${etaMin} phút nữa`;
    }
  }

  if (speedEl) {
    const curSpeed = remainingDist <= 0.08 ? 0 : (28 + Math.floor((Math.random() - 0.5) * 6));
    speedEl.textContent = `${curSpeed} km/h`;
  }

  if (statusEl) {
    const driverName = trackingActiveOrder?.driver?.name || 'Nguyễn Văn Tài';
    if (progressRatio <= 0.2) {
      statusEl.innerHTML = `🛵 Tài xế <strong>${escapeHtml(driverName)}</strong> đã lấy món từ <strong>${escapeHtml(trackingActiveOrder?.resName || 'Quán')}</strong>, đang rẽ ra phố Ao Sen.`;
    } else if (progressRatio <= 0.5) {
      statusEl.innerHTML = `🛵 Tài xế <strong>${escapeHtml(driverName)}</strong> đang lưu thông trên trục đường Trần Phú, hướng về trường PTIT.`;
    } else if (progressRatio <= 0.8) {
      statusEl.innerHTML = `🛵 Tài xế đang qua nút giao trước cổng Học viện PTIT, giảm tốc độ chuẩn bị rẽ vào điểm hẹn.`;
    } else if (progressRatio < 1) {
      statusEl.innerHTML = `🛵 Tài xế đã tới cổng chính PTIT, đang tiến vào sảnh nhà A2...`;
    } else {
      statusEl.innerHTML = `🎉 <strong>Tài xế đã tới sảnh nhà A2 PTIT!</strong> Vui lòng chuẩn bị nhận món thơm ngon.`;
    }
  }
}

function onDriverArrivedAtDestination() {
  if (trackingSimTimer) {
    clearInterval(trackingSimTimer);
    trackingSimTimer = null;
  }
  showToast('checkmarkFilled', '🎉 Shipper đã giao tới sảnh A2 PTIT! Chúc bạn ngon miệng.');
}

function toggleTrackingSpeed() {
  trackingSimSpeed = trackingSimSpeed === 1 ? 3 : 1;
  const btn = document.getElementById('tracking-btn-speed');
  if (btn) {
    btn.innerHTML = trackingSimSpeed === 3 ? `${FluentIcons.flashFilled} Tốc độ x3 (Đang bật)` : `${FluentIcons.flashFilled} Tăng tốc mô phỏng (x3)`;
  }
  startTrackingSimulationLoop();
}

function toggleTrackingPause() {
  trackingSimPaused = !trackingSimPaused;
  const btn = document.getElementById('tracking-btn-pause');
  if (btn) {
    btn.textContent = trackingSimPaused ? '▶️ Tiếp tục' : '⏸️ Tạm dừng';
  }
}

function restartTrackingSimulation() {
  trackingCurrentIdx = 0;
  trackingSimPaused = false;
  const pauseBtn = document.getElementById('tracking-btn-pause');
  if (pauseBtn) pauseBtn.textContent = '⏸️ Tạm dừng';
  startTrackingSimulationLoop();
  showToast('locationRegular', 'Đã bắt đầu lại mô phỏng hành trình giao hàng.');
}

function renderVectorTrackingFallback(container, sLat, sLng, uLat, uLng, order) {
  container.innerHTML = `
    <div style="width:100%; height:100%; position:relative; background:#f8fafc; overflow:hidden;">
      <svg width="100%" height="100%" viewBox="0 0 500 280" style="position:absolute; inset:0;">
        <rect width="500" height="280" fill="#f1f5f9"/>
        <!-- Streets -->
        <path d="M 0 140 Q 250 80 500 140" stroke="#cbd5e1" stroke-width="14" fill="none"/>
        <text x="30" y="130" font-size="11" font-weight="bold" fill="#64748b">TRẦN PHÚ - HÀ ĐÔNG</text>
        <line x1="250" y1="0" x2="250" y2="280" stroke="#cbd5e1" stroke-width="10"/>
        <text x="260" y="40" font-size="10" font-weight="bold" fill="#64748b">PHỐ AO SEN</text>

        <!-- Route Polyline -->
        <path id="svg-route-bg" d="M 90 90 Q 250 110 410 180" stroke="#16a34a" stroke-width="4" stroke-dasharray="6,8" opacity="0.5" fill="none"/>
        <path id="svg-route-active" d="M 90 90 Q 250 110 410 180" stroke="#15803d" stroke-width="5" fill="none" stroke-dasharray="400" stroke-dashoffset="400"/>

        <!-- Shop Node -->
        <circle cx="90" cy="90" r="14" fill="#fee2e2" stroke="#e11d48" stroke-width="2"/>
        <text x="90" y="95" text-anchor="middle" font-size="14">🍜</text>
        <text x="90" y="70" text-anchor="middle" font-size="10" font-weight="bold" fill="#9f1239">${escapeHtml(order.resName.split('-')[0].trim())}</text>

        <!-- User Node -->
        <circle cx="410" cy="180" r="14" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
        <text x="410" y="185" text-anchor="middle" font-size="14">📍</text>
        <text x="410" y="210" text-anchor="middle" font-size="10" font-weight="bold" fill="#14532d">Điểm nhận PTIT (A2)</text>
      </svg>

      <!-- Animated SVG Shipper Marker -->
      <div id="svg-shipper-marker" style="position:absolute; left:90px; top:90px; transform:translate(-50%, -50%); z-index:3; transition:all 0.4s ease;">
        <div class="custom-driver-pin">🛵</div>
      </div>
    </div>
  `;

  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
}

function updateVectorShipperPos(ratio) {
  const marker = document.getElementById('svg-shipper-marker');
  const routeActive = document.getElementById('svg-route-active');
  if (!marker) return;

  const startX = 90, startY = 90;
  const midX = 250, midY = 110;
  const endX = 410, endY = 180;

  const t = Math.max(0, Math.min(1, ratio));
  const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * midX + Math.pow(t, 2) * endX;
  const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * midY + Math.pow(t, 2) * endY;

  marker.style.left = x + 'px';
  marker.style.top = y + 'px';

  if (routeActive) {
    const totalLen = 400;
    routeActive.style.strokeDashoffset = (totalLen * (1 - t)).toString();
  }
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
  const floatingInput = document.getElementById('floating-search-input');
  if (floatingInput && floatingInput.value !== val) {
    floatingInput.value = val;
  }
  const floatingClear = document.getElementById('floating-search-clear-btn');
  if (floatingClear) {
    floatingClear.style.display = val ? 'flex' : 'none';
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
  const floatingInput = document.getElementById('floating-search-input');
  if (floatingInput) {
    floatingInput.value = '';
  }
  const floatingClear = document.getElementById('floating-search-clear-btn');
  if (floatingClear) {
    floatingClear.style.display = 'none';
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
    area: 'all',
    promo: 'all',
    shipping: 'all',
    priceRange: 'all',
    minPrice: null,
    maxPrice: null,
    ratingMin: 0
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

