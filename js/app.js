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
  { iconKey: 'heartFilled', label: 'Yêu thích', color: 'red', promo: null, action: () => openFavoritesView('all', 'home') },
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

// ── Global View Scroll Persistence (Mỗi tab độc lập hoàn toàn, cả cuộn dọc & cuộn ngang) ──
const globalViewScrollPositions = {};
const globalHorizontalScrollPositions = {};

function getHorizontalScrollViewKey(viewName) {
  const v = viewName || currentView || 'home';
  if (v === 'store-detail' && typeof activeStoreDetailId !== 'undefined' && activeStoreDetailId != null) {
    return `store-detail:${activeStoreDetailId}`;
  }
  return v;
}

function saveHorizontalScrolls(viewName) {
  if (typeof document === 'undefined') return;
  const logicalView = (typeof getSpaPanelLogicalView === 'function')
    ? getSpaPanelLogicalView(viewName)
    : (viewName || currentView || 'home');
  const panelId = (typeof getSpaPanelIdForView === 'function')
    ? getSpaPanelIdForView(logicalView)
    : null;
  const scopeEl = (panelId && document.getElementById(panelId)) || document.getElementById('app');
  if (!scopeEl) return;
  const key = getHorizontalScrollViewKey(viewName);
  const map = {};
  scopeEl.querySelectorAll('[id]').forEach(el => {
    if (el.scrollLeft > 0 || el.scrollWidth > el.clientWidth + 2) {
      if (el.scrollLeft > 0) {
        map[el.id] = el.scrollLeft;
      }
    }
  });
  globalHorizontalScrollPositions[key] = map;
}

function restoreHorizontalScrolls(viewName) {
  if (typeof document === 'undefined') return;
  const key = getHorizontalScrollViewKey(viewName);
  const savedMap = globalHorizontalScrollPositions[key];
  if (!savedMap || typeof savedMap !== 'object') return;
  const logicalView = (typeof getSpaPanelLogicalView === 'function')
    ? getSpaPanelLogicalView(viewName)
    : (viewName || currentView || 'home');
  const panelId = (typeof getSpaPanelIdForView === 'function')
    ? getSpaPanelIdForView(logicalView)
    : null;
  const scopeEl = (panelId && document.getElementById(panelId)) || document;
  Object.entries(savedMap).forEach(([id, left]) => {
    const el = (scopeEl && typeof scopeEl.querySelector === 'function' && typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
      ? (scopeEl.querySelector(`#${CSS.escape(id)}`) || document.getElementById(id))
      : document.getElementById(id);
    if (el && left > 0) {
      el.style.scrollBehavior = 'auto';
      el.scrollLeft = left;
      el.style.scrollBehavior = '';
    }
  });
}

function saveCurrentViewScroll() {
  if (typeof currentView === 'string' && currentView) {
    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    globalViewScrollPositions[currentView] = scrollY;
    saveHorizontalScrolls(currentView);
  }
}

// ── Image Bitmap Prewarmer & Zero-Flash Helper ──
if (typeof window !== 'undefined' && !window.__ptitImagePrewarmInit) {
  window.__ptitImagePrewarmInit = true;
  window.__ptitLoadedImageUrls = window.__ptitLoadedImageUrls || new Set();
  window.__ptitImgCache = window.__ptitImgCache || new Map();
  window.__ptitHeroBannerSrc = window.__ptitHeroBannerSrc || 'https://static.vinwonders.com/production/vietnamese-food-top-banner.jpg';

  document.addEventListener('load', (e) => {
    const t = e && e.target;
    if (t && t.tagName === 'IMG') {
      const srcAttr = t.getAttribute('src');
      if (srcAttr) window.__ptitLoadedImageUrls.add(srcAttr);
      if (t.currentSrc) window.__ptitLoadedImageUrls.add(t.currentSrc);
    }
  }, true);
}

function prewarmSingleImageUrl(url) {
  if (typeof window === 'undefined' || !url || typeof url !== 'string') return Promise.resolve();
  if (window.__ptitImgCache && window.__ptitImgCache.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    if (window.__ptitImgCache) window.__ptitImgCache.set(url, img);
    const done = () => {
      if (img.naturalWidth > 0 && window.__ptitLoadedImageUrls) {
        window.__ptitLoadedImageUrls.add(url);
        if (img.currentSrc) window.__ptitLoadedImageUrls.add(img.currentSrc);
      }
      resolve();
    };
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().catch(() => { }).finally(done);
      } else {
        done();
      }
    };
    img.onerror = done;
    img.src = url;
  });
}

function prewarmCatalogImages() {
  if (typeof window === 'undefined' || window.__ptitPrewarmStarted) return;
  window.__ptitPrewarmStarted = true;

  const urlSet = new Set([
    'assets/images/hung_chien_gion.jpg',
    'assets/images/vietnamese-food-top-banner.jpg'
  ]);
  if (typeof restaurants !== 'undefined' && Array.isArray(restaurants)) {
    restaurants.forEach(r => {
      if (r && r.image) urlSet.add(r.image);
      if (Array.isArray(r?.relatedDishes)) {
        r.relatedDishes.forEach(d => {
          if (d && d.image) urlSet.add(d.image);
        });
      }
    });
  }
  if (typeof DB !== 'undefined' && DB.isReady && typeof DB.getItems === 'function') {
    DB.getItems().forEach(it => {
      if (it && it.image) urlSet.add(it.image);
    });
  }
  if (typeof visualSuggestions !== 'undefined' && Array.isArray(visualSuggestions)) {
    visualSuggestions.forEach(v => {
      if (v && v.image) urlSet.add(v.image);
    });
  }

  const urls = Array.from(urlSet).filter(Boolean);
  let idx = 0;
  const pumpBatch = () => {
    const batch = urls.slice(idx, idx + 8);
    idx += 8;
    if (!batch.length) return;
    Promise.all(batch.map(prewarmSingleImageUrl)).then(() => {
      if (idx < urls.length) {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(pumpBatch, { timeout: 600 });
        } else {
          setTimeout(pumpBatch, 40);
        }
      }
    });
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(pumpBatch, { timeout: 500 });
  } else {
    setTimeout(pumpBatch, 180);
  }
}

function prepareViewImagesBeforeTransition(container) {
  const root = container || (typeof document !== 'undefined' ? document.getElementById('app') : null);
  if (!root || typeof window === 'undefined') return [];
  const loadedSet = window.__ptitLoadedImageUrls;
  const cacheMap = window.__ptitImgCache;
  const imgs = Array.from(root.querySelectorAll('img'));
  const priorityDecodeImgs = [];
  const vh = window.innerHeight || 900;
  const vw = window.innerWidth || 1200;

  imgs.forEach(img => {
    const src = img.getAttribute('src') || '';
    const isCached = Boolean(
      (loadedSet && (loadedSet.has(src) || (img.currentSrc && loadedSet.has(img.currentSrc)))) ||
      (cacheMap && cacheMap.has(src))
    );
    const rect = img.getBoundingClientRect();
    const nearViewport =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > -200 &&
      rect.top < vh + 380 &&
      rect.right > -240 &&
      rect.left < vw + 320;

    if (isCached || nearViewport) {
      img.loading = 'eager';
      img.decoding = 'sync';
      if (nearViewport) {
        priorityDecodeImgs.push(img);
      }
    }
  });

  return priorityDecodeImgs;
}

let pendingTransitionScroll = null;

function restoreViewScroll(targetView, fallbackY = 0) {
  const target = targetView || currentView;
  const savedY = (target && typeof globalViewScrollPositions[target] === 'number')
    ? globalViewScrollPositions[target]
    : fallbackY;
  applyPageScroll(savedY);
  if (typeof updateHeaderScrolledState === 'function') updateHeaderScrolledState();
}

// Đặt vị trí cuộn tức thì (an toàn với Locomotive Scroll; dự phòng khi smooth-scroll.js chưa tải)
function applyPageScroll(y, immediateOnly = false) {
  const val = Math.max(0, Number(y) || 0);
  if (pendingTransitionScroll && !immediateOnly) {
    pendingTransitionScroll.y = val;
    return;
  }
  if (immediateOnly && typeof window.setPageScrollImmediate === 'function') {
    window.setPageScrollImmediate(val);
  } else if (typeof window.setPageScroll === 'function' && !immediateOnly) {
    window.setPageScroll(val);
  } else {
    window.scrollTo({ top: val, behavior: 'instant' });
  }
}

// ── Đồng bộ hiệu ứng Floating Top Bar cho các trang có .page-nav-header khi lướt qua ──
let lastSyncedTopBarHtml = '';
function updateFloatingTopBar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const activeRoot = (typeof getActiveSpaPanel === 'function' ? getActiveSpaPanel() : null) || document;
  const floatingBar = document.getElementById('floating-page-topbar');
  const inner = document.getElementById('floating-topbar-inner');
  const inPageHeader = activeRoot.querySelector('.page-nav-header');

  const scrollY = window.scrollY || window.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;

  // ── Đồng bộ Floating Search Bar dạng viên thuốc nổi chỉ khi lướt qua search-view-header ──
  const floatingSearchBar = document.getElementById('floating-search-bar');
  const isSearchView = currentView === 'search';
  const inPageSearchHeader = activeRoot.querySelector('.search-view-header');

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
  const activeBulkBar = activeRoot.querySelector('.dbm-bulk-bar.active');
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
          <button type="button" class="page-back-icon-btn" onclick="openHomeView()" aria-label="Về trang chủ">
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
    <button type="button" class="search-back-btn" onclick="openHomeView()" aria-label="Quay lại">
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
    <button type="button" class="search-filter-toggle-btn ${hasActiveFilter ? 'active' : ''}" id="floating-search-filter-btn" onclick="openSearchFilterModal()" title="Bộ lọc tìm kiếm nâng cao">
      ${FluentIcons.filterRegular}
    </button>
  `;
}

function onFloatingSearchInputChange(val) {
  searchQuery = val;
  const searchPanel = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
  const inPageInput = (searchPanel && searchPanel.querySelector('#search-view-input')) || document.getElementById('search-view-input');
  if (inPageInput && inPageInput.value !== val) {
    inPageInput.value = val;
  }
  const clearBtn = document.getElementById('floating-search-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = val ? 'flex' : 'none';
  }
  const inPageClearBtn = searchPanel
    ? searchPanel.querySelector('.search-view-header .search-clear-btn')
    : document.querySelector('.search-view-header .search-clear-btn');
  if (inPageClearBtn) {
    inPageClearBtn.style.display = val ? 'flex' : 'none';
  }
  const desktopInput = document.getElementById('desktop-search-input');
  if (desktopInput && desktopInput.value !== val) {
    desktopInput.value = val;
  }
  if (typeof scheduleSearchFilterUpdate === 'function') {
    scheduleSearchFilterUpdate();
  } else {
    updateSearchResultsOnly();
  }
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

let appScrollTicking = false;
function handleAppScroll() {
  notifyScrollbarActivity();
  if (!appScrollTicking) {
    appScrollTicking = true;
    requestAnimationFrame(() => {
      updateFloatingTopBar();
      appScrollTicking = false;
    });
  }
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

// ── DOM References & Keep-Alive SPA Panel Shell ──
const rootAppShell = document.getElementById('app');
let app = rootAppShell;

const KEEP_ALIVE_SPA_VIEWS = ['home', 'search', 'activity', 'ai', 'cart', 'profile'];
const TRANSIENT_SPA_PANEL_ID = 'spa-view-transient';
const PTIT_RECENT_SEARCH_KEY = 'ptitngon_recent_searches';
let searchFilterDebounceTimer = null;

function getSpaPanelLogicalView(viewName) {
  const v = viewName || (typeof currentView !== 'undefined' ? currentView : 'home') || 'home';
  if (v === 'activity' && typeof viewingOrderDetailId !== 'undefined' && viewingOrderDetailId) {
    return 'activity:detail';
  }
  return v;
}

function getSpaPanelIdForView(logicalView) {
  const v = logicalView || 'home';
  return KEEP_ALIVE_SPA_VIEWS.includes(v) ? `spa-view-${v}` : TRANSIENT_SPA_PANEL_ID;
}

function ensureSpaPanelsMounted() {
  const shell = rootAppShell || (typeof document !== 'undefined' ? document.getElementById('app') : null);
  if (!shell || typeof document === 'undefined') return null;

  const hasPanels = Boolean(shell.querySelector(':scope > .spa-view'));
  if (!hasPanels) {
    shell.innerHTML = '';
    [...KEEP_ALIVE_SPA_VIEWS, 'transient'].forEach((name) => {
      const panel = document.createElement('section');
      panel.className = 'spa-view inactive';
      panel.id = `spa-view-${name}`;
      panel.dataset.spaView = name;
      panel.tabIndex = -1;
      panel.setAttribute('inert', '');
      panel.setAttribute('aria-hidden', 'true');
      shell.appendChild(panel);
    });
  }
  return shell;
}

function getActiveSpaPanel() {
  const shell = rootAppShell || (typeof document !== 'undefined' ? document.getElementById('app') : null);
  if (!shell) return (typeof document !== 'undefined' ? document : null);
  return shell.querySelector(':scope > .spa-view.active') || shell;
}

function getSpaSearchPanel() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('spa-view-search') || rootAppShell || document;
}

function syncAppTargetForView(viewName) {
  const shell = ensureSpaPanelsMounted();
  if (!shell) return app;
  const logicalView = viewName || getSpaPanelLogicalView(typeof currentView !== 'undefined' ? currentView : 'home');
  const targetId = getSpaPanelIdForView(logicalView);
  const panels = shell.querySelectorAll(':scope > .spa-view');
  let targetPanel = null;

  panels.forEach((panel) => {
    const isTarget = panel.id === targetId;
    if (isTarget) {
      targetPanel = panel;
      panel.classList.remove('inactive');
      panel.classList.add('active');
      panel.removeAttribute('inert');
      panel.setAttribute('aria-hidden', 'false');
    } else {
      panel.classList.remove('active');
      panel.classList.add('inactive');
      panel.setAttribute('inert', '');
      panel.setAttribute('aria-hidden', 'true');
    }
  });

  if (targetPanel) {
    app = targetPanel;
    return targetPanel;
  }
  return shell;
}

function computeKeepAliveSig(logicalView) {
  const rev = (typeof window !== 'undefined' && window.__ptitDataRevision) ? window.__ptitDataRevision : 0;
  const userEmail = (typeof currentUser !== 'undefined' && currentUser && currentUser.email) ? currentUser.email : '';
  const addrShort = (typeof userDeliveryInfo !== 'undefined' && userDeliveryInfo)
    ? `${userDeliveryInfo.shortAddress || ''}|${userDeliveryInfo.address || ''}`
    : '';
  const storeList = Array.isArray(restaurants) ? restaurants : [];
  const favSig = storeList.map(r => (r.fav ? '1' : '0') + (r.relatedDishes || []).filter(d => d.fav).length).join(',');

  if (logicalView === 'home') {
    const chipsSig = Array.isArray(filterChips) ? filterChips.map(c => c.active ? '1' : '0').join('') : '';
    const activeCat = (typeof window !== 'undefined' && window.dbmActiveHomeCat) ? window.dbmActiveHomeCat : '';
    const ordersArr = (typeof ordersList !== 'undefined' && Array.isArray(ordersList)) ? ordersList : [];
    const topOrder = ordersArr[0];
    const reorderSig = `${ordersArr.length}:${topOrder ? `${topOrder.orderId}:${topOrder.categoryStatus}` : ''}`;
    const bannerSig = typeof currentBannerIndex !== 'undefined' ? currentBannerIndex : 0;
    return `home|${bannerSig}|${chipsSig}|${activeCat}|${reorderSig}|${addrShort}|${favSig}|${rev}|${userEmail}`;
  }

  if (logicalView === 'search') {
    const dist = typeof distanceFilter !== 'undefined' ? String(distanceFilter) : 'null';
    const vis = typeof selectedVisualSuggestion !== 'undefined' ? String(selectedVisualSuggestion || '') : '';
    const filtersSig = typeof activeFilters !== 'undefined' ? JSON.stringify(activeFilters) : '';
    const histSig = getSearchHistory().join('|');
    return `search|${searchQuery || ''}|${dist}|${vis}|${filtersSig}|${histSig}|${favSig}|${rev}|${userEmail}`;
  }

  if (logicalView === 'activity') {
    const ordersArr = (typeof ordersList !== 'undefined' && Array.isArray(ordersList)) ? ordersList : [];
    const ordersSig = ordersArr.map(o => `${o.orderId}:${o.categoryStatus}:${o.currentStep || 0}:${o.rating || 0}`).join(';');
    const tab = typeof activityFilter !== 'undefined' ? activityFilter : 'all';
    return `activity|${tab}|${ordersSig}|${rev}|${userEmail}`;
  }

  if (logicalView === 'ai') {
    return `ai|${userEmail}|${addrShort}`;
  }

  if (logicalView === 'cart') {
    const cartArr = Array.isArray(cart) ? cart : [];
    const itemsSig = cartArr.map(i => `${i.dishId}:${i.quantity}:${i.totalPrice}:${i.size?.name || ''}:${(i.toppings || []).map(t => t.name).join('+')}:${i.note || ''}`).join(';');
    const vCode = (typeof appliedVoucher !== 'undefined' && appliedVoucher && appliedVoucher.code) ? appliedVoucher.code : '';
    return `cart|${cartArr.length}|${itemsSig}|${vCode}|${addrShort}|${rev}|${userEmail}`;
  }

  if (logicalView === 'profile') {
    const ordersArr = (typeof ordersList !== 'undefined' && Array.isArray(ordersList)) ? ordersList : [];
    const userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '';
    return `profile|${userEmail}|${userName}|${addrShort}|${ordersArr.length}|${favSig}|${rev}`;
  }

  return `${logicalView}|${rev}`;
}

function markKeepAliveRendered(logicalView) {
  if (!KEEP_ALIVE_SPA_VIEWS.includes(logicalView)) return;
  const panel = typeof document !== 'undefined' ? document.getElementById(getSpaPanelIdForView(logicalView)) : null;
  if (!panel) return;
  panel.dataset.rendered = '1';
  panel._keepAliveSig = computeKeepAliveSig(logicalView);
}

function invalidateKeepAliveView(logicalView) {
  if (!KEEP_ALIVE_SPA_VIEWS.includes(logicalView)) return;
  const panel = typeof document !== 'undefined' ? document.getElementById(getSpaPanelIdForView(logicalView)) : null;
  if (!panel) return;
  panel.dataset.rendered = '0';
  panel._keepAliveSig = null;
}

// ── Lazy Asset Loader (CSS/JS chỉ tải khi mở Quản lý danh mục hoặc Lottie Thành công) ──
window.AppAssetLoader = {
  _cssCache: new Map(),
  _scriptCache: new Map(),
  _catalogPromise: null,
  _lottiePromise: null,

  loadCss(href) {
    if (typeof document === 'undefined') return Promise.resolve();
    if (this._cssCache.has(href)) return this._cssCache.get(href);
    const baseHref = href.split('?')[0];
    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find(l => (l.getAttribute('href') || '').split('?')[0] === baseHref);
    if (existing && existing.sheet) {
      const done = Promise.resolve();
      this._cssCache.set(href, done);
      return done;
    }
    const p = new Promise((resolve) => {
      const link = existing || document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      const finish = () => resolve();
      link.addEventListener('load', finish, { once: true });
      link.addEventListener('error', finish, { once: true });
      if (!existing) document.head.appendChild(link);
    });
    this._cssCache.set(href, p);
    return p;
  },

  loadScript(src) {
    if (typeof document === 'undefined') return Promise.resolve();
    if (this._scriptCache.has(src)) return this._scriptCache.get(src);
    const baseSrc = src.split('?')[0];
    if (baseSrc.endsWith('lottie.min.js') && typeof window.lottie !== 'undefined') {
      return Promise.resolve();
    }
    if (baseSrc.endsWith('payment-success-data.js') && typeof window.PTITNGON_PAYMENT_SUCCESS_ANIM !== 'undefined') {
      return Promise.resolve();
    }
    const existing = Array.from(document.querySelectorAll('script[src]'))
      .find(s => (s.getAttribute('src') || '').split('?')[0] === baseSrc);
    if (existing && (existing.dataset.loaded === '1' || existing.readyState === 'complete')) {
      const done = Promise.resolve();
      this._scriptCache.set(src, done);
      return done;
    }
    const p = new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      if (!existing) {
        script.src = src;
        script.async = false;
        script.defer = true;
      }
      script.addEventListener('load', () => {
        script.dataset.loaded = '1';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => {
        this._scriptCache.delete(src);
        reject(new Error(`Failed to load script: ${src}`));
      }, { once: true });
      if (!existing) document.body.appendChild(script);
    });
    this._scriptCache.set(src, p);
    return p;
  },

  loadLottie() {
    if (typeof window !== 'undefined' && typeof window.lottie !== 'undefined') {
      return Promise.resolve();
    }
    if (!this._lottiePromise) {
      this._lottiePromise = this.loadScript('js/lottie.min.js').catch(() => {
        this._lottiePromise = null;
      });
    }
    return this._lottiePromise;
  },

  loadCatalogManager() {
    if (typeof window !== 'undefined' && window.__dbmAssetsReady) {
      return Promise.resolve();
    }
    if (!this._catalogPromise) {
      const cssTask = this.loadCss('css/db-manager.css?v=4.8');
      const scriptsChain = this.loadScript('js/db-manager-editors.js?v=4.8')
        .then(() => this.loadScript('js/db-manager-ai.js?v=4.8'))
        .then(() => this.loadScript('js/db-manager-audit.js?v=4.8'))
        .then(() => this.loadScript('js/db-manager-ui.js?v=4.8'));
      this._catalogPromise = Promise.all([cssTask, scriptsChain])
        .then(() => {
          window.__dbmAssetsReady = true;
        })
        .catch((err) => {
          this._catalogPromise = null;
          console.error('[AppAssetLoader] Không thể tải module Quản lý danh mục:', err);
        });
    }
    return this._catalogPromise;
  }
};

// ── Smart Search (Chuẩn hóa tiếng Việt không dấu, Debounce 150ms & Lịch sử tìm kiếm) ──
function normalizeSearchVi(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function scheduleSearchFilterUpdate() {
  if (searchFilterDebounceTimer) clearTimeout(searchFilterDebounceTimer);
  searchFilterDebounceTimer = setTimeout(() => {
    searchFilterDebounceTimer = null;
    updateSearchResultsOnly();
  }, 150);
}

function flushSearchFilterUpdate() {
  if (searchFilterDebounceTimer) {
    clearTimeout(searchFilterDebounceTimer);
    searchFilterDebounceTimer = null;
  }
  updateSearchResultsOnly();
}

function getSearchHistory() {
  try {
    const raw = localStorage.getItem(PTIT_RECENT_SEARCH_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string' && s.trim().length > 0).slice(0, 8) : [];
  } catch (_) {
    return [];
  }
}

function recordSearchHistory(keyword) {
  const clean = String(keyword || '').trim().slice(0, 48);
  if (clean.length < 2) return;
  const cleanNorm = normalizeSearchVi(clean);
  const next = [clean, ...getSearchHistory().filter(item => normalizeSearchVi(item) !== cleanNorm)].slice(0, 8);
  try {
    localStorage.setItem(PTIT_RECENT_SEARCH_KEY, JSON.stringify(next));
  } catch (_) { }
  updateRecentSearchChipsDom();
}

function clearSearchHistory() {
  try {
    localStorage.removeItem(PTIT_RECENT_SEARCH_KEY);
  } catch (_) { }
  updateRecentSearchChipsDom();
}

function applyRecentSearch(keyword) {
  searchQuery = keyword;
  selectedVisualSuggestion = null;
  recordSearchHistory(keyword);
  const searchPanel = getSpaSearchPanel();
  const inPageInput = searchPanel ? searchPanel.querySelector('#search-view-input') : document.getElementById('search-view-input');
  if (inPageInput) inPageInput.value = keyword;
  const floatingInput = document.getElementById('floating-search-input');
  if (floatingInput) floatingInput.value = keyword;
  const desktopInput = document.getElementById('desktop-search-input');
  if (desktopInput) desktopInput.value = keyword;
  const inPageClearBtn = searchPanel ? searchPanel.querySelector('.search-view-header .search-clear-btn') : null;
  if (inPageClearBtn) inPageClearBtn.style.display = keyword ? 'flex' : 'none';
  const floatingClear = document.getElementById('floating-search-clear-btn');
  if (floatingClear) floatingClear.style.display = keyword ? 'flex' : 'none';
  flushSearchFilterUpdate();
}

function renderSearchHistorySectionHtml() {
  const hist = getSearchHistory();
  if (!hist.length) return '';
  return `
    <div class="search-recent-section">
      <div class="search-recent-header">
        <span>Tìm kiếm gần đây</span>
        <button type="button" class="search-recent-clear-btn" onclick="clearSearchHistory()">Xóa tất cả</button>
      </div>
      <div class="search-recent-chips">
        ${hist.map((kw) => `
          <button type="button" class="search-recent-chip" onclick="applyRecentSearch('${escapeHtml(kw).replace(/'/g, '&#39;')}')">
            <span>🕒</span>
            <span>${escapeHtml(kw)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function updateRecentSearchChipsDom() {
  const searchPanel = getSpaSearchPanel();
  const slot = searchPanel ? searchPanel.querySelector('#search-recent-slot') : document.getElementById('search-recent-slot');
  if (slot) {
    slot.innerHTML = renderSearchHistorySectionHtml();
  }
}

// ── Mobile Pull-to-Refresh ──
function initMobilePullToRefresh() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__ptitPtrBound) return;
  window.__ptitPtrBound = true;

  let indicator = document.getElementById('ptr-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'ptr-indicator';
    indicator.className = 'ptr-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.innerHTML = `<span class="ptr-arrow">↓</span><span class="ptr-label">Kéo để làm mới</span>`;
    document.body.appendChild(indicator);
  }

  let tracking = false;
  let startY = 0;
  let startX = 0;
  let ready = false;
  let refreshing = false;

  const hideIndicator = () => {
    indicator.classList.remove('visible', 'ready');
    indicator.style.transform = 'translate3d(-50%, -70px, 0)';
  };

  document.addEventListener('touchstart', (e) => {
    if (refreshing || !e.touches || e.touches.length !== 1) return;
    if (document.body && document.body.classList.contains('mobile-keyboard-open')) return;
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) return;
    if (typeof currentView !== 'undefined' && currentView === 'ai') return;
    if (document.querySelector('dialog[open]')) return;
    const target = e.target;
    if (target && target.closest && target.closest('input, textarea, select, dialog, .leaflet-container')) return;
    tracking = true;
    ready = false;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!tracking || refreshing || !e.touches || e.touches.length !== 1) return;
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) {
      tracking = false;
      hideIndicator();
      return;
    }
    const dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (dy <= 14 || dx > dy) {
      if (dy < 0) hideIndicator();
      return;
    }
    const pullPx = Math.min(82, (dy - 14) * 0.45);
    const labelEl = indicator.querySelector('.ptr-label');
    const arrowEl = indicator.querySelector('.ptr-arrow');
    ready = dy >= 105;
    indicator.classList.add('visible');
    indicator.classList.toggle('ready', ready);
    indicator.style.transform = `translate3d(-50%, ${Math.round(pullPx - 36)}px, 0)`;
    if (arrowEl) arrowEl.textContent = ready ? '↻' : '↓';
    if (labelEl) labelEl.textContent = ready ? 'Thả ra để làm mới' : 'Kéo để làm mới';
  }, { passive: true });

  const handleRelease = async () => {
    if (!tracking) return;
    const shouldRefresh = ready && !refreshing;
    tracking = false;
    ready = false;
    if (!shouldRefresh) {
      hideIndicator();
      return;
    }

    refreshing = true;
    const labelEl = indicator.querySelector('.ptr-label');
    const arrowEl = indicator.querySelector('.ptr-arrow');
    if (arrowEl) arrowEl.textContent = '⟳';
    if (labelEl) labelEl.textContent = 'Đang cập nhật dữ liệu...';
    indicator.style.transform = 'translate3d(-50%, 10px, 0)';

    try {
      if (typeof DB !== 'undefined' && typeof DB.checkServerUpdates === 'function') {
        await DB.checkServerUpdates();
      }
      if (typeof render === 'function') {
        render({ forceRender: true, skipTransition: true });
      }
      if (typeof showToast === 'function') {
        showToast('checkmarkFilled', 'Đã làm mới dữ liệu quán ăn & đơn hàng');
      }
    } catch (_) {
    } finally {
      refreshing = false;
      setTimeout(hideIndicator, 160);
    }
  };

  document.addEventListener('touchend', handleRelease, { passive: true });
  document.addEventListener('touchcancel', () => {
    tracking = false;
    ready = false;
    if (!refreshing) hideIndicator();
  }, { passive: true });
}

// ── Formatters ──
function formatVND(num) {
  return (num || 0).toLocaleString('vi-VN') + 'đ';
}

if (typeof window !== 'undefined' && !window.__roleButtonKeyDelegateBound) {
  window.__roleButtonKeyDelegateBound = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target;
    if (!target || target.matches('input, textarea, select, button, a, [contenteditable="true"]')) return;
    const roleBtn = target.closest('[role="button"][tabindex="0"]');
    if (!roleBtn || roleBtn !== target) return;
    if (e.key === ' ') e.preventDefault();
    roleBtn.click();
  });
}

let lastRenderedView = null;
let lastRenderedViewKey = null;
let activeViewTransitionToken = 0;

function getRenderViewStateKey() {
  const v = currentView || 'home';
  if (v === 'activity' && typeof viewingOrderDetailId !== 'undefined' && viewingOrderDetailId) {
    return 'activity:detail';
  }
  if (v === 'store-detail' && typeof activeStoreDetailId !== 'undefined' && activeStoreDetailId != null) {
    return `store-detail:${activeStoreDetailId}`;
  }
  if (v === 'dish-detail' && typeof modalDish !== 'undefined' && modalDish && modalDish.id != null) {
    return `dish-detail:${modalDish.id}`;
  }
  return v;
}

const VIEW_HIERARCHY_DEPTH = {
  home: 0,
  search: 0,
  activity: 0,
  ai: 0,
  cart: 0,
  profile: 0,
  favorites: 1,
  catalog: 1,
  'store-detail': 1,
  'dish-detail': 1,
  checkout: 1,
  'activity:detail': 1,
  'dish-safety-nutrition': 2,
  'order-success': 2
};

// ── Main Render Router ──
function render(options = { replace: false }) {
  const prevView = lastRenderedView;
  const prevViewKey = lastRenderedViewKey;
  const nextViewKey = getRenderViewStateKey();
  const isViewChange =
    (prevViewKey !== null && prevViewKey !== nextViewKey) ||
    Boolean(options?.forceTransition);
  const fromRouterNav = Boolean(typeof window !== 'undefined' && window.Router && window.Router.isNavigatingFromRouter);

  const prevDepth = VIEW_HIERARCHY_DEPTH[prevView] ?? 0;
  const nextDepth = VIEW_HIERARCHY_DEPTH[currentView === 'activity' && typeof viewingOrderDetailId !== 'undefined' && viewingOrderDetailId ? 'activity:detail' : currentView] ?? 0;
  let vtDirection = 'tab';
  if (options?.vtMode === 'forward' || options?.vtMode === 'back' || options?.vtMode === 'tab') {
    vtDirection = options.vtMode;
  } else if (nextDepth > prevDepth) {
    vtDirection = 'forward';
  } else if (nextDepth < prevDepth) {
    vtDirection = 'back';
  } else if (prevView === currentView && nextViewKey !== prevViewKey) {
    vtDirection = 'forward';
  }

  const applyViewDOMUpdate = () => {
    ensureSpaPanelsMounted();

    // Sync active view state for AI chat (full-bleed layout)
    if (currentView === 'ai') {
      document.body.classList.add('view-ai-active');
    } else {
      document.body.classList.remove('view-ai-active');
      document.body.classList.remove('ai-keyboard-open');
      document.documentElement.style.removeProperty('--ai-keyboard-offset');
    }
    if (typeof syncMobileKeyboardViewport === 'function') {
      syncMobileKeyboardViewport();
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
        currentView === 'favorites' ||
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

    const logicalView = getSpaPanelLogicalView(currentView);
    const targetPanel = syncAppTargetForView(logicalView);
    const isKeepAliveView = KEEP_ALIVE_SPA_VIEWS.includes(logicalView);
    const nextSig = isKeepAliveView ? computeKeepAliveSig(logicalView) : null;
    const isKeepAliveHit = Boolean(
      isKeepAliveView &&
      targetPanel &&
      targetPanel.dataset.rendered === '1' &&
      !options?.forceRender &&
      targetPanel._keepAliveSig === nextSig
    );

    if (!isKeepAliveHit) {
      if (currentView === 'home') {
        renderHomeView();
      } else if (currentView === 'search') {
        renderSearchView();
      } else if (currentView === 'dish-detail' && typeof renderDishDetailView === 'function') {
        renderDishDetailView();
      } else if (currentView === 'store-detail' && typeof renderStoreDetailView === 'function') {
        renderStoreDetailView();
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
      } else if (currentView === 'favorites' && typeof renderFavoritesView === 'function') {
        renderFavoritesView();
      } else if (currentView === 'catalog' && typeof renderCatalogManagerView === 'function') {
        renderCatalogManagerView();
      } else if (currentView === 'order-success') {
        renderOrderSuccessView();
      }

      if (logicalView === 'catalog' && !window.__dbmAssetsReady && typeof window.AppAssetLoader?.loadCatalogManager === 'function') {
        window.AppAssetLoader.loadCatalogManager().then(() => {
          if (currentView === 'catalog' && typeof renderCatalogManagerView === 'function') {
            renderCatalogManagerView();
          }
        });
      }

      if (isKeepAliveView) {
        markKeepAliveRendered(logicalView);
      }
    }

    // Phục hồi cuộn ngang ngay lập tức cho view vừa dựng (Home / Search / Store Detail...)
    restoreHorizontalScrolls(currentView);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => restoreHorizontalScrolls(currentView));
    }

    // Cập nhật trạng thái scrolled cho header sau khi view mới được kết xuất
    if (typeof options?.scrollTop === 'number') {
      applyPageScroll(options.scrollTop, true);
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(updateHeaderScrolledState);
    } else if (typeof updateHeaderScrolledState === 'function') {
      updateHeaderScrolledState();
    }

    // Đồng bộ hóa URL thanh địa chỉ (Hash Router SPA)
    if (!fromRouterNav && typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
      window.Router.syncUrl(options);
    }

    lastRenderedView = currentView;
    lastRenderedViewKey = nextViewKey;
  };

  const focusMainContainer = () => {
    if (!isViewChange) return;
    const focusEl = getActiveSpaPanel() || document.getElementById('app');
    if (focusEl && (!document.activeElement || !focusEl.contains(document.activeElement))) {
      focusEl.focus({ preventScroll: true });
    }
  };

  const clearHeroViewTransitionTags = () => {
    document.querySelectorAll('[data-vt-active]').forEach(el => {
      el.style.viewTransitionName = '';
      el.removeAttribute('data-vt-active');
    });
  };

  const clearViewTransitionRootClasses = () => {
    document.documentElement.classList.remove('vt-transitioning', 'vt-dir-forward', 'vt-dir-back', 'vt-dir-tab');
  };

  const isElVisiblyOnScreen = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 10 && r.height > 10 && r.bottom > 56 && r.top < (window.innerHeight - 24) && r.right > 0 && r.left < window.innerWidth;
  };

  const findSingleVisibleAttrEl = (attrName, val, scopeEl) => {
    if (val == null || val === '' || typeof CSS === 'undefined' || typeof CSS.escape !== 'function') return null;
    const root = scopeEl || getActiveSpaPanel() || document;
    const matches = Array.from(root.querySelectorAll(`[${attrName}="${CSS.escape(String(val))}"]`));
    return matches.find(isElVisiblyOnScreen) || null;
  };

  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasOpenDialog = Boolean(document.querySelector('dialog[open]'));
  const canUseTransition =
    isViewChange &&
    !options?.skipTransition &&
    !reducedMotion &&
    !hasOpenDialog &&
    typeof document.startViewTransition === 'function';

  if (canUseTransition) {
    clearHeroViewTransitionTags();
    const oldActivePanel = getActiveSpaPanel() || rootAppShell || document;
    let vtDishId = null;
    let vtStoreId = null;

    if (currentView === 'dish-detail' && typeof modalDish !== 'undefined' && modalDish && modalDish.id != null) {
      const sourceThumb = findSingleVisibleAttrEl('data-vt-dish', modalDish.id, oldActivePanel);
      if (sourceThumb && !sourceThumb.classList.contains('pdp-hero-img')) {
        vtDishId = String(modalDish.id);
        sourceThumb.style.viewTransitionName = 'ptit-hero-media';
        sourceThumb.setAttribute('data-vt-active', '1');
      }
    } else if (prevView === 'dish-detail') {
      const heroEl = oldActivePanel.querySelector('.pdp-hero-img[data-vt-dish]');
      if (isElVisiblyOnScreen(heroEl)) {
        vtDishId = heroEl.getAttribute('data-vt-dish');
        heroEl.style.viewTransitionName = 'ptit-hero-media';
        heroEl.setAttribute('data-vt-active', '1');
      }
    }

    if (currentView === 'store-detail' && typeof activeStoreDetailId !== 'undefined' && activeStoreDetailId != null) {
      const sourceStoreThumb = findSingleVisibleAttrEl('data-vt-store', activeStoreDetailId, oldActivePanel);
      if (sourceStoreThumb && !sourceStoreThumb.classList.contains('store-hero-img')) {
        vtStoreId = String(activeStoreDetailId);
        sourceStoreThumb.style.viewTransitionName = 'ptit-store-media';
        sourceStoreThumb.setAttribute('data-vt-active', '1');
      }
    } else if (prevView === 'store-detail') {
      const storeHeroEl = oldActivePanel.querySelector('.store-hero-img[data-vt-store]');
      if (isElVisiblyOnScreen(storeHeroEl)) {
        vtStoreId = storeHeroEl.getAttribute('data-vt-store');
        storeHeroEl.style.viewTransitionName = 'ptit-store-media';
        storeHeroEl.setAttribute('data-vt-active', '1');
      }
    }

    const myToken = ++activeViewTransitionToken;

    pendingTransitionScroll = { y: (typeof options?.scrollTop === 'number') ? options.scrollTop : null };
    clearViewTransitionRootClasses();
    document.documentElement.classList.add('vt-transitioning', `vt-dir-${vtDirection}`);

    const transition = document.startViewTransition(async () => {
      const scrollSlot = pendingTransitionScroll;
      pendingTransitionScroll = null;

      applyViewDOMUpdate();

      const newActivePanel = getActiveSpaPanel() || document.getElementById('app') || document;

      // Tắt fade-in nội bộ của các khối khi chuyển trang để View Transition không chụp trạng thái opacity: 0 rồi chạy lại 2 lần
      newActivePanel.querySelectorAll('.fade-in').forEach(el => {
        el.classList.remove('fade-in', 'fade-in-delay-1', 'fade-in-delay-2', 'fade-in-delay-3', 'fade-in-delay-4', 'fade-in-delay-5');
      });

      if (scrollSlot && typeof scrollSlot.y === 'number') {
        applyPageScroll(scrollSlot.y, true);
      }
      restoreHorizontalScrolls(currentView);

      clearHeroViewTransitionTags();

      const waitImagesToDecode = [];

      if (vtDishId) {
        const targetEl = currentView === 'dish-detail'
          ? newActivePanel.querySelector('.pdp-hero-img[data-vt-dish]')
          : findSingleVisibleAttrEl('data-vt-dish', vtDishId, newActivePanel);
        if (targetEl && isElVisiblyOnScreen(targetEl)) {
          targetEl.loading = 'eager';
          targetEl.decoding = 'sync';
          targetEl.style.viewTransitionName = 'ptit-hero-media';
          targetEl.setAttribute('data-vt-active', '1');
          waitImagesToDecode.push(targetEl);
        }
      }

      if (vtStoreId) {
        const targetStoreEl = currentView === 'store-detail'
          ? newActivePanel.querySelector('.store-hero-img[data-vt-store]')
          : findSingleVisibleAttrEl('data-vt-store', vtStoreId, newActivePanel);
        if (targetStoreEl && isElVisiblyOnScreen(targetStoreEl)) {
          targetStoreEl.loading = 'eager';
          targetStoreEl.decoding = 'sync';
          targetStoreEl.style.viewTransitionName = 'ptit-store-media';
          targetStoreEl.setAttribute('data-vt-active', '1');
          waitImagesToDecode.push(targetStoreEl);
        }
      }

      // Đưa toàn bộ ảnh đã cached & trong khung nhìn về sync decode trước khi Chrome chụp khung hình mới (hết nháy ảnh)
      const nearViewportImgs = prepareViewImagesBeforeTransition(newActivePanel);
      nearViewportImgs.forEach(img => {
        if (!waitImagesToDecode.includes(img)) {
          waitImagesToDecode.push(img);
        }
      });

      if (waitImagesToDecode.length > 0) {
        const decodeTasks = waitImagesToDecode.slice(0, 28).map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          if (typeof img.decode === 'function') return img.decode().catch(() => { });
          return Promise.resolve();
        });
        await Promise.race([
          Promise.allSettled(decodeTasks),
          new Promise(resolve => setTimeout(resolve, 95))
        ]);
      }

      if (typeof updateHeaderScrolledState === 'function') {
        updateHeaderScrolledState();
      }
    });

    let afterTransitionCallbacks = window.__ptitAfterViewTransitionCallbacks;
    if (!Array.isArray(afterTransitionCallbacks)) {
      afterTransitionCallbacks = [];
      window.__ptitAfterViewTransitionCallbacks = afterTransitionCallbacks;
    }
    window.registerAfterViewTransitionCallback = (fn) => {
      if (typeof fn === 'function') afterTransitionCallbacks.push(fn);
    };

    const finalizeTransition = () => {
      if (myToken !== activeViewTransitionToken) return;
      pendingTransitionScroll = null;
      clearHeroViewTransitionTags();
      clearViewTransitionRootClasses();
      restoreHorizontalScrolls(currentView);
      focusMainContainer();
      const pendingFns = afterTransitionCallbacks.splice(0);
      pendingFns.forEach((fn) => {
        try { fn(); } catch (_) { }
      });
    };
    if (transition && transition.finished && typeof transition.finished.then === 'function') {
      transition.finished.then(finalizeTransition, finalizeTransition);
    } else {
      finalizeTransition();
    }
  } else {
    activeViewTransitionToken++;
    pendingTransitionScroll = null;
    clearViewTransitionRootClasses();
    clearHeroViewTransitionTags();
    applyViewDOMUpdate();
    prepareViewImagesBeforeTransition(getActiveSpaPanel() || document.getElementById('app'));
    focusMainContainer();
  }
}

// ========================================
// 1. HOME VIEW
// ========================================

function renderBannerHtml(b, idx) {
  return `
    <div class="top-banner-card" onclick="onBannerClick(${idx})">
      <button type="button" class="banner-arrow-btn prev" onclick="prevBanner(event)" title="Banner trước" aria-label="Banner trước">
        ${FluentIcons.chevronLeft || FluentIcons.prev}
      </button>
      <button type="button" class="banner-arrow-btn next" onclick="nextBanner(event)" title="Banner tiếp theo" aria-label="Banner tiếp theo">
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
  if (typeof syncAppTargetForView === 'function') syncAppTargetForView('home');
  const homePanelRoot = (typeof document !== 'undefined' && document.getElementById('spa-view-home')) || document;
  const currentBanner = topBanners[currentBannerIndex];
  const homeCats = typeof getHomeCategories === 'function' ? getHomeCategories() : foodCategories;
  const customCats = homeCats.filter(c => c.isCustom);
  const quickSearchCats = [...customCats, ...homeCats.filter(c => !c.isCustom)].slice(0, 6);

  // Lưu trữ vị trí cuộn ngang hiện tại (gộp cả DOM hiện tại nếu đang ở Home và bộ nhớ toàn cục khi back về)
  const savedHomeH = (typeof globalHorizontalScrollPositions === 'object' && globalHorizontalScrollPositions['home'])
    ? { ...globalHorizontalScrollPositions['home'] }
    : {};
  [
    'home-categories-scroll',
    'food-categories-scroll',
    'restaurants-scroll',
    'home-featured-dishes-scroll'
  ].forEach(id => {
    const domEl = (homePanelRoot.querySelector && typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
      ? homePanelRoot.querySelector(`#${CSS.escape(id)}`)
      : document.getElementById(id);
    if (domEl) {
      if (domEl.scrollLeft > 0) savedHomeH[id] = domEl.scrollLeft;
      else if (homePanelRoot.querySelector('#home-categories-scroll')) delete savedHomeH[id];
    }
  });
  homePanelRoot.querySelectorAll('.category-restaurants-scroll[id], .res-dishes-scroll[id]').forEach(el => {
    if (el.scrollLeft > 0) savedHomeH[el.id] = el.scrollLeft;
    else delete savedHomeH[el.id];
  });
  if (typeof globalHorizontalScrollPositions === 'object') {
    globalHorizontalScrollPositions['home'] = savedHomeH;
  }

  const heroBannerSrc = (typeof window !== 'undefined' && window.__ptitHeroBannerSrc)
    ? window.__ptitHeroBannerSrc
    : 'https://static.vinwonders.com/production/vietnamese-food-top-banner.jpg';

  app.innerHTML = `
    <!-- Header -->
    <div class="header home-header">
      <!-- Full-bleed Premium Vietnamese Food Hero Backdrop -->
      <div class="home-hero-backdrop" aria-hidden="true">
        <img
          class="home-hero-backdrop-img"
          src="${escapeHtml(heroBannerSrc)}"
          onerror="window.__ptitHeroBannerSrc='assets/images/vietnamese-food-top-banner.jpg'; this.onerror=null; this.src=window.__ptitHeroBannerSrc;"
          alt=""
          fetchpriority="high"
          decoding="sync"
        />
        <div class="home-hero-top-vignette"></div>
        <div class="home-hero-backdrop-fade"></div>
      </div>

      <!-- Location -->
      <div class="location-row fade-in">
        <div class="location-left" role="button" tabindex="0" onclick="openDeliveryInfoModal()" title="Thay đổi địa chỉ giao hàng">
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
          <button type="button" class="header-btn header-fav-btn" onclick="openFavoritesView('all', 'home')" title="Món ăn & Quán yêu thích" aria-label="Yêu thích">
            ${FluentIcons.heartRegular}
          </button>
          <button type="button" class="header-btn" onclick="openAIChatView()" title="Chat AI tư vấn & gợi ý món ăn" aria-label="Chat AI">
            ✨
          </button>
          <button type="button" class="header-btn" onclick="openProfileView()" title="Hồ sơ & Danh bạ người dùng" aria-label="Tài khoản">
            ${FluentIcons.personRegular}
          </button>
        </div>
      </div>

      <!-- Khoảng trống thoáng đãng thay thế top-banner-card -->
      <div class="home-hero-spacer"></div>

      <!-- Greeting (To hơn, nổi bật hơn làm tâm điểm) -->
      <div class="greeting fade-in fade-in-delay-1">
        <h1 class="greeting-hello">Xin chào, ${escapeHtml(userDeliveryInfo.name || 'Bạn')}! 👋</h1>
        <div class="greeting-question">Hôm nay bạn muốn ăn gì? <span class="wave">🍽️</span></div>
      </div>

      <!-- Search Bar on Home -->
      <div class="search-bar fade-in fade-in-delay-2" role="button" tabindex="0" onclick="openSearchView()">
        <span class="search-bar-icon">${FluentIcons.searchRegular}</span>
        <input type="text" placeholder="Tìm món ăn, quán ăn, loại mặt hàng..." readonly aria-label="Tìm món ăn, quán ăn, loại mặt hàng" style="cursor: pointer;">
        <button type="button" class="search-filter-btn" onclick="event.stopPropagation(); openSearchFilterModal();" aria-label="Bộ lọc">
          ${FluentIcons.filterRegular}
        </button>
      </div>

      <!-- Quick Search Suggestions -->
      <div class="search-tags fade-in fade-in-delay-2">
        ${quickSearchCats.map(cat => `
          <button
            type="button"
            class="search-tag"
            style="${cat.keyword === 'Hùng chiên giòn'
      ? 'background: #fff1f0; border-color: #ffa39e; color: #cf1322; font-weight: 700;'
      : ''}"
            onclick="openSearchView('${escapeHtml(cat.keyword)}')"
          >${cat.icon} ${escapeHtml(cat.name)}</button>
        `).join('')}
      </div>
    </div>

    <!-- Quick Options -->
    <div class="quick-options fade-in fade-in-delay-3">
      <div class="quick-options-grid">
        ${quickOptions.map((opt, i) => `
          <div class="quick-option" role="button" tabindex="0" onclick="handleQuickOptionClick(${i})">
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
        <h2 class="section-title">Khám phá nhanh</h2>
        <div class="scroll-arrow-controls">
          <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('home-categories-scroll', -220)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
            ${FluentIcons.chevronLeft}
          </button>
          <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('home-categories-scroll', 220)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
            ${FluentIcons.chevronRight}
          </button>
        </div>
      </div>
      <div class="categories-scroll" id="home-categories-scroll">
        ${filterChips.map((chip, idx) => `
          <button type="button" class="category-chip ${chip.active ? 'active' : ''}" aria-pressed="${chip.active ? 'true' : 'false'}" onclick="selectHomeFilterChip(${idx})">
            <span class="category-chip-icon">${FluentIcons[chip.iconKey]}</span>
            ${chip.label}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Food Category Grid (2 dòng gọn đẹp trên cả máy tính và điện thoại) -->
    <div class="food-categories-section fade-in">
      <div class="section-head">
        <h2 class="section-title">Danh mục món ăn</h2>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="scroll-arrow-controls">
            <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('food-categories-scroll', -320)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('food-categories-scroll', 320)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
          <button type="button" class="section-see-all" onclick="openSearchView()">Xem tất cả</button>
        </div>
      </div>
      <div class="food-categories-grid" id="food-categories-scroll">
        ${homeCats.map(cat => `
          <div class="food-cat-item" role="button" tabindex="0" onclick="openSearchView('${escapeHtml(cat.keyword)}')">
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
        <h2 class="section-title">Quán ăn nổi bật gần bạn</h2>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="scroll-arrow-controls">
            <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('restaurants-scroll', -420)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('restaurants-scroll', 420)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
          <button type="button" class="section-see-all" onclick="openSearchView()">Xem tất cả</button>
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
            <div class="res-main-info" role="button" tabindex="0" onclick="openStoreDetailView(${r.id}, 'for-you', 'home')">
              <div class="res-main-img-wrap">
                <img class="res-main-img" data-vt-store="${r.id}" src="${r.image}" alt="${escapeHtml(r.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                ${r.badge ? `<span class="res-badge-partner ${scoreBadgeClass}">${escapeHtml(r.badge)}</span>` : ''}
              </div>

              <div class="res-details-col">
                <div class="res-name-row">
                  <div class="res-name-title">${escapeHtml(r.name)}</div>
                  <span class="res-fav-btn ${r.fav ? 'active' : ''}" role="button" tabindex="0" aria-label="Lưu quán yêu thích" onclick="event.stopPropagation(); toggleFav(${r.id})" title="Lưu quán yêu thích">
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
                    <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('${dishesScrollId}', -200)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
                      ${FluentIcons.chevronLeft}
                    </button>
                    <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('${dishesScrollId}', 200)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
                      ${FluentIcons.chevronRight}
                    </button>
                  </div>
                </div>
                <div class="res-dishes-scroll" id="${dishesScrollId}">
                  ${indexedDishes.map(({ dish, originalIdx }) => {
          const isOut = dish.inStock === false;
          const isDishFav = (typeof dish.fav === 'boolean') ? dish.fav : (typeof DB !== 'undefined' && DB.isItemFavorite ? DB.isItemFavorite(dish.id) : false);
          return `
                      <div class="dish-card-item ${isOut ? 'dish-out-of-stock' : ''}" role="button" tabindex="0" onclick="${isOut ? `showToast('alertRegular', 'Món này hiện đang tạm hết hàng!')` : `openDishOptionModalByIndices(${r.id}, ${originalIdx})`}">
                        <div class="dish-card-img-wrap">
                          <img class="dish-card-img" data-vt-dish="${escapeHtml(String(dish.id))}" src="${dish.image}" alt="${escapeHtml(dish.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                          <button type="button"
                            class="dish-fav-btn ${isDishFav ? 'active' : ''}"
                            data-fav-dish-id="${escapeHtml(String(dish.id))}"
                            onclick="event.stopPropagation(); toggleDishFav('${escapeHtml(String(dish.id))}', ${r.id})"
                            title="Lưu món yêu thích"
                            aria-label="Lưu món yêu thích"
                          >
                            ${isDishFav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
                          </button>
                        </div>
                        <div class="dish-card-info">
                          <div class="dish-card-name" title="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</div>
                          <div class="dish-card-bottom">
                            <span class="dish-card-price">${dish.priceFormatted || formatVND(dish.price)}</span>
                            ${isOut ? `
                              <span style="font-size:10px; font-weight:700; color:#dc2626;">Hết hàng</span>
                            ` : `
                              <button type="button" 
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

  // Phục hồi vị trí cuộn ngang tức thì (không bị kẹt bởi scroll-behavior: smooth) cho mọi dãy trượt trên trang chủ
  if (typeof restoreHorizontalScrolls === 'function') {
    restoreHorizontalScrolls('home');
  }
  if (typeof markKeepAliveRendered === 'function') {
    markKeepAliveRendered('home');
  }
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

  // 1. Text search query (hỗ trợ cả có dấu & không dấu tiếng Việt)
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    const qNorm = normalizeSearchVi(searchQuery);
    list = list.filter(r => {
      const matchStr = (val) => {
        const s = String(val || '');
        if (!s) return false;
        return s.toLowerCase().includes(q) || (qNorm && normalizeSearchVi(s).includes(qNorm));
      };
      const matchName = matchStr(r.name);
      const matchCat = matchStr(r.category);
      const matchReview = matchStr(r.shortReview);
      const matchDish = (r.relatedDishes || []).some(d =>
        matchStr(d.name) ||
        matchStr(d.category) ||
        matchStr(d.description) ||
        (typeof dbmItemMatchesQuery === 'function' && (dbmItemMatchesQuery(d, q) || (qNorm && dbmItemMatchesQuery(d, qNorm))))
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
    if (typeof triggerHaptic === 'function') {
      triggerHaptic('backdrop');
    }
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
  const searchPanelRoot = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
  const searchContainer = searchPanelRoot.querySelector('.search-view, .search-view-container');
  if (searchContainer) {
    searchPanelRoot.querySelectorAll('.filter-pill-item').forEach(pill => {
      const onclickAttr = pill.getAttribute('onclick') || '';
      if (filterKey === 'ratingMin' && onclickAttr.includes('rating45')) {
        pill.classList.remove('active');
        pill.setAttribute('aria-pressed', 'false');
      }
    });
    const slot = searchPanelRoot.querySelector('#active-filter-pills-slot') || document.getElementById('active-filter-pills-slot');
    if (slot) slot.innerHTML = renderActiveFilterPillsHtml();
    updateSearchResultsOnly();
  } else {
    renderSearchView();
  }
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
        <button type="button" 
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
  if (typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
    window.Router.syncUrl({ replace: true });
  }
}

function renderSearchView() {
  if (typeof syncAppTargetForView === 'function') syncAppTargetForView('search');
  const filteredList = getFilteredRestaurants();

  app.innerHTML = `
    <div class="search-view fade-in">
      <!-- In-Page Search Header: Hiển thị tự nhiên, phẳng, không đổ bóng hay nổi tách biệt -->
      <div class="search-view-header">
        <button type="button" class="search-back-btn" onclick="openHomeView()" aria-label="Quay lại">
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
            onkeydown="if(event.key==='Enter' && !event.isComposing && event.keyCode!==229){ recordSearchHistory(this.value); flushSearchFilterUpdate(); }"
          >
          <span class="search-clear-btn" style="display:${searchQuery ? 'flex' : 'none'};" onclick="clearSearch()" title="Xóa tìm kiếm">
            ${FluentIcons.dismiss}
          </span>
        </div>
        <button type="button" class="search-filter-toggle-btn ${(activeFilters.area !== 'all' || activeFilters.promo !== 'all' || activeFilters.shipping !== 'all' || activeFilters.priceRange !== 'all' || activeFilters.ratingMin > 0) ? 'active' : ''}" onclick="openSearchFilterModal()" title="Bộ lọc tìm kiếm nâng cao">
          ${FluentIcons.filterRegular}
        </button>
      </div>

      <div id="search-recent-slot">
        ${typeof renderSearchHistorySectionHtml === 'function' ? renderSearchHistorySectionHtml() : ''}
      </div>

      <!-- Gợi ý hình ảnh (Visual Suggestions) -->
      <div class="visual-suggestions-section">
        <div class="visual-section-title">
          <span>Gợi ý món ngon & danh mục</span>
          <div style="display:inline-flex;align-items:center;gap:8px;">
            <div class="scroll-arrow-controls">
              <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('visual-suggestions-scroll', -200)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
                ${FluentIcons.chevronLeft}
              </button>
              <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('visual-suggestions-scroll', 200)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
                ${FluentIcons.chevronRight}
              </button>
            </div>
          </div>
        </div>
        <div class="visual-suggestions-scroll" id="visual-suggestions-scroll">
          ${visualSuggestions.map(item => {
    const isSelected = selectedVisualSuggestion === item.keyword;
    return `
              <div class="visual-card ${isSelected ? 'active' : ''}" role="button" tabindex="0" onclick="selectVisualSuggestion('${escapeHtml(item.keyword)}')">
                <div class="visual-card-img-wrap">
                  <img class="visual-card-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
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
          <div class="dist-chip ${distanceFilter === null ? 'active' : ''}" onclick="setDistanceFilter(null)" role="button" tabindex="0" aria-pressed="${distanceFilter === null}" onkeydown="if(event.key==='Enter'||event.key===' ')setDistanceFilter(null)">
            Tất cả
          </div>
          <div class="dist-chip ${distanceFilter === 1 ? 'active' : ''}" onclick="setDistanceFilter(1)" role="button" tabindex="0" aria-pressed="${distanceFilter === 1}" onkeydown="if(event.key==='Enter'||event.key===' ')setDistanceFilter(1)">
            📍 &lt; 1 km (Đi bộ)
          </div>
          <div class="dist-chip ${distanceFilter === 2 ? 'active' : ''}" onclick="setDistanceFilter(2)" role="button" tabindex="0" aria-pressed="${distanceFilter === 2}" onkeydown="if(event.key==='Enter'||event.key===' ')setDistanceFilter(2)">
            🛵 &lt; 2 km (Gần bạn)
          </div>
          <div class="dist-chip ${distanceFilter === 5 ? 'active' : ''}" onclick="setDistanceFilter(5)" role="button" tabindex="0" aria-pressed="${distanceFilter === 5}" onkeydown="if(event.key==='Enter'||event.key===' ')setDistanceFilter(5)">
            🚀 &lt; 5 km (Toàn vùng)
          </div>
        </div>

        <!-- Filter Pills Row -->
        <div class="filter-pills-row">
          <div class="filter-pill-item ${activeFilters.near ? 'active' : ''}" onclick="toggleFilter('near')" role="button" tabindex="0" aria-pressed="${Boolean(activeFilters.near)}" onkeydown="if(event.key==='Enter'||event.key===' ')toggleFilter('near')">
            <span>📍 Gần nhất</span>
          </div>
          <div class="filter-pill-item ${activeFilters.rating45 ? 'active' : ''}" onclick="toggleFilter('rating45')" role="button" tabindex="0" aria-pressed="${Boolean(activeFilters.rating45)}" onkeydown="if(event.key==='Enter'||event.key===' ')toggleFilter('rating45')">
            <span>⭐ Đánh giá cao (4.8+)</span>
          </div>
          <div class="filter-pill-item ${activeFilters.freeship ? 'active' : ''}" onclick="toggleFilter('freeship')" role="button" tabindex="0" aria-pressed="${Boolean(activeFilters.freeship)}" onkeydown="if(event.key==='Enter'||event.key===' ')toggleFilter('freeship')">
            <span>🚚 Freeship 0đ</span>
          </div>
          <div class="filter-pill-item ${activeFilters.budget ? 'active' : ''}" onclick="toggleFilter('budget')" role="button" tabindex="0" aria-pressed="${Boolean(activeFilters.budget)}" onkeydown="if(event.key==='Enter'||event.key===' ')toggleFilter('budget')">
            <span>💵 Giá bình dân ($)</span>
          </div>
          <div class="filter-pill-item ${activeFilters.voucher ? 'active' : ''}" onclick="toggleFilter('voucher')" role="button" tabindex="0" aria-pressed="${Boolean(activeFilters.voucher)}" onkeydown="if(event.key==='Enter'||event.key===' ')toggleFilter('voucher')">
            <span>${FluentIcons.ticketHorizontalFilled} Có Voucher</span>
          </div>
        </div>
        <div id="active-filter-pills-slot">
          ${renderActiveFilterPillsHtml()}
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

  const searchPanel = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
  const inputEl = (searchPanel && searchPanel.querySelector('#search-view-input')) || document.getElementById('search-view-input');
  if (inputEl && !searchQuery) {
    setTimeout(() => inputEl.focus(), 80);
  }
  const visualScrollEl = (searchPanel && searchPanel.querySelector('#visual-suggestions-scroll')) || 'visual-suggestions-scroll';
  setTimeout(() => enableDragToScroll(visualScrollEl), 50);
  if (typeof markKeepAliveRendered === 'function') {
    markKeepAliveRendered('search');
  }
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
      <div class="res-main-info" role="button" tabindex="0" onclick="openStoreDetailView(${r.id}, 'for-you', 'search')" style="cursor:pointer;">
        <div class="res-main-img-wrap">
          <img class="res-main-img" data-vt-store="${r.id}" src="${r.image}" alt="${escapeHtml(r.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
          ${r.badge ? `<span class="res-badge-partner">${escapeHtml(r.badge)}</span>` : ''}
        </div>

        <div class="res-details-col">
          <div class="res-name-row">
            <div class="res-name-title">${escapeHtml(r.name)}</div>
            <span class="res-fav-btn ${r.fav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFav(${r.id})" title="Lưu quán yêu thích">
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
            <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('res-dishes-scroll-${r.id}', -220)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('res-dishes-scroll-${r.id}', 220)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
        </div>
        <div class="res-dishes-scroll" id="res-dishes-scroll-${r.id}">
          ${indexedDishes.map(({ dish, originalIdx }) => {
    const isOut = dish.inStock === false;
    const isDishFav = (typeof dish.fav === 'boolean') ? dish.fav : (typeof DB !== 'undefined' && DB.isItemFavorite ? DB.isItemFavorite(dish.id) : false);
    return `
              <div class="dish-card-item ${isOut ? 'dish-out-of-stock' : ''}" role="button" tabindex="0" onclick="${isOut ? `showToast('alertRegular', 'Món này hiện đang tạm hết hàng!')` : `openDishOptionModalByIndices(${r.id}, ${originalIdx})`}">
                <div class="dish-card-img-wrap">
                  <img class="dish-card-img" data-vt-dish="${escapeHtml(String(dish.id))}" src="${dish.image}" alt="${escapeHtml(dish.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                  <button type="button"
                    class="dish-fav-btn ${isDishFav ? 'active' : ''}"
                    data-fav-dish-id="${escapeHtml(String(dish.id))}"
                    onclick="event.stopPropagation(); toggleDishFav('${escapeHtml(String(dish.id))}', ${r.id})"
                    title="Lưu món yêu thích"
                    aria-label="Lưu món yêu thích"
                  >
                    ${isDishFav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
                  </button>
                </div>
                <div class="dish-card-info">
                  <div class="dish-card-name" title="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</div>
                  <div class="dish-card-bottom">
                    <span class="dish-card-price">${dish.priceFormatted}</span>
                    ${isOut ? `
                      <span style="font-size:10px; font-weight:700; color:#dc2626;">Hết hàng</span>
                    ` : `
                      <button type="button" 
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
  if (typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
    window.Router.syncUrl({ replace: true });
  }
}

function updateSearchResultsOnly() {
  const searchPanel = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
  const container = searchPanel.querySelector('.search-results-list');
  const summary = searchPanel.querySelector('.results-summary-bar');
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
  if (typeof markKeepAliveRendered === 'function') {
    markKeepAliveRendered('search');
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
    if (typeof triggerHaptic === 'function') {
      triggerHaptic('backdrop');
    }
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

const nativeDialogCloseTimers = new WeakMap();

/**
 * Đồng bộ trạng thái Top Layer (<dialog>.showModal / .close) theo class .active
 * để tương thích với mọi module đang mở/đóng #modal-overlay và #search-filter-overlay.
 */
function syncNativeDialogWithActiveClass(dialogEl) {
  if (!dialogEl || typeof dialogEl.showModal !== 'function') return;

  const isActive = dialogEl.classList.contains('active');
  const prevTimer = nativeDialogCloseTimers.get(dialogEl);
  if (prevTimer) {
    clearTimeout(prevTimer);
    nativeDialogCloseTimers.delete(dialogEl);
  }

  if (isActive) {
    if (!dialogEl.open) {
      try {
        dialogEl.showModal();
      } catch (_) { }
    }
    return;
  }

  if (dialogEl.open) {
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduceMotion ? 0 : 340;
    const timer = setTimeout(() => {
      nativeDialogCloseTimers.delete(dialogEl);
      if (!dialogEl.classList.contains('active') && dialogEl.open) {
        try {
          dialogEl.close();
        } catch (_) { }
      }
    }, delay);
    nativeDialogCloseTimers.set(dialogEl, timer);
  }
}

function setupNativeDialogModalSync() {
  const modalMappings = [
    { id: 'modal-overlay', closeFn: () => typeof closeModal === 'function' && closeModal() },
    { id: 'search-filter-overlay', closeFn: () => typeof closeSearchFilterModal === 'function' && closeSearchFilterModal() }
  ];

  modalMappings.forEach(({ id, closeFn }) => {
    const dialogEl = document.getElementById(id);
    if (!dialogEl || dialogEl.tagName !== 'DIALOG') return;

    dialogEl.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeFn();
    });

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'class') {
          syncNativeDialogWithActiveClass(dialogEl);
          break;
        }
      }
    });
    observer.observe(dialogEl, { attributes: true, attributeFilter: ['class'] });

    // Nếu modal được mở trước DOMContentLoaded thì đồng bộ ngay
    if (dialogEl.classList.contains('active')) {
      syncNativeDialogWithActiveClass(dialogEl);
    }
  });
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
  const isDishFav = (typeof modalDish.fav === 'boolean')
    ? modalDish.fav
    : (typeof DB !== 'undefined' && DB.isItemFavorite ? DB.isItemFavorite(modalDish.id) : false);

  sheet.innerHTML = `
    <!-- Modal Dish Header Image -->
    <div class="dish-modal-header">
      <img class="dish-modal-hero-img" src="${modalDish.image}" alt="${modalDish.name}">
      <button type="button" class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
      <button type="button"
        class="dish-modal-fav-btn ${isDishFav ? 'active' : ''}"
        data-fav-dish-id="${escapeHtml(String(modalDish.id))}"
        onclick="toggleDishFav('${escapeHtml(String(modalDish.id))}', ${modalRestaurant ? modalRestaurant.id : 1})"
        title="Lưu món yêu thích"
        aria-label="Lưu món yêu thích"
      >
        ${isDishFav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
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
        <button type="button" class="stepper-btn" onclick="changeModalQty(-1)" aria-label="Giảm">
          ${FluentIcons.subtractRegular}
        </button>
        <span class="stepper-count" id="modal-qty-display">${modalQty}</span>
        <button type="button" class="stepper-btn" onclick="changeModalQty(1)" aria-label="Tăng">
          ${FluentIcons.addRegular}
        </button>
      </div>

      <button type="button" class="dish-modal-submit-btn" onclick="confirmAddOptionToCart()">
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
      <button type="button" class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <form id="delivery-info-form" class="delivery-modal-body" onsubmit="event.preventDefault(); saveDeliveryInfo();" novalidate>
      <!-- Quick Switch Remembered User Profiles -->
      ${rememberedUsers.length > 0 ? `
        <div class="delivery-input-group">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span class="delivery-input-label" style="margin-bottom:0;">Người dùng đã ghi nhớ (${rememberedUsers.length}):</span>
            <button type="button" class="db-inline-link-btn" onclick="openAccountSwitcherModal();">
              Quản lý hồ sơ →
            </button>
          </div>
          <div class="delivery-presets-row">
            ${rememberedUsers.map(u => `
              <button
                type="button"
                class="delivery-preset-chip ${activeUser && activeUser.id === u.id ? 'active' : ''}"
                aria-pressed="${activeUser && activeUser.id === u.id ? 'true' : 'false'}"
                onclick="switchUserInDeliveryModal('${escapeHtml(u.id)}')"
                title="SĐT: ${escapeHtml(u.phone)} • ${(u.orders || []).length} đơn đã đặt"
              >
                <span>${u.avatar || '🧑‍🎓'}</span>
                <span>${escapeHtml(u.name)} (${escapeHtml(u.phone)})</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Address presets of active user -->
      ${savedAddressPresets.length > 0 ? `
        <div class="delivery-input-group">
          <span class="delivery-input-label">Sổ địa chỉ của ${escapeHtml(userDeliveryInfo.name)} (Chọn 1 chạm):</span>
          <div class="delivery-presets-row">
            ${savedAddressPresets.map((p, idx) => `
              <button
                type="button"
                class="delivery-preset-chip ${userDeliveryInfo.address === p.address ? 'active' : ''}"
                aria-pressed="${userDeliveryInfo.address === p.address ? 'true' : 'false'}"
                onclick="selectAddressPreset(${idx})"
              >
                <span>${p.icon || '📍'}</span>
                <span>${escapeHtml(p.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Recipient Name -->
      <div class="delivery-input-group">
        <label class="delivery-input-label" for="delivery-input-name">Họ và tên người nhận món (*):</label>
        <input 
          type="text" 
          id="delivery-input-name" 
          name="name"
          autocomplete="name"
          required
          class="delivery-input-field" 
          placeholder="Nhập họ tên người nhận" 
          value="${escapeHtml(userDeliveryInfo.name)}"
        >
        <span class="delivery-field-error" id="delivery-name-error"></span>
      </div>

      <!-- Recipient Phone -->
      <div class="delivery-input-group">
        <label class="delivery-input-label" for="delivery-input-phone">Số điện thoại liên hệ giao hàng (*):</label>
        <span class="delivery-input-hint" id="delivery-phone-hint">Gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.</span>
        <input 
          type="tel" 
          id="delivery-input-phone" 
          name="tel"
          autocomplete="tel"
          inputmode="tel"
          required
          aria-describedby="delivery-phone-hint"
          class="delivery-input-field" 
          placeholder="Nhập số điện thoại (VD: 0901 234 567)" 
          value="${escapeHtml(userDeliveryInfo.phone)}"
        >
        <span class="delivery-field-error" id="delivery-phone-error"></span>
      </div>

      <!-- Recipient Email -->
      <div class="delivery-input-group">
        <label class="delivery-input-label" for="delivery-input-email">Email liên hệ / Mã sinh viên (Tùy chọn):</label>
        <span class="delivery-input-hint" id="delivery-email-hint">Dùng để nhận hóa đơn hoặc khôi phục hồ sơ khi cần.</span>
        <input 
          type="email" 
          id="delivery-input-email" 
          name="email"
          autocomplete="email"
          aria-describedby="delivery-email-hint"
          class="delivery-input-field" 
          placeholder="VD: sinhvien@stu.ptit.edu.vn" 
          value="${escapeHtml(userDeliveryInfo.email || (activeUser ? activeUser.email || '' : ''))}"
        >
        <span class="delivery-field-error" id="delivery-email-error"></span>
      </div>

      <!-- Detail Address with Actions (Lấy vị trí GPS & Mở bản đồ) -->
      <div class="delivery-input-group">
        <div class="delivery-address-head">
          <label class="delivery-input-label" for="delivery-input-address" style="margin-bottom:0;">Địa chỉ nhận hàng chi tiết (*):</label>
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
          name="street-address"
          autocomplete="street-address"
          required
          class="delivery-input-field" 
          rows="2" 
          placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
        >${escapeHtml(userDeliveryInfo.address)}</textarea>
        <span class="delivery-field-error" id="delivery-address-error"></span>
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
        <span class="delivery-input-label">Loại địa chỉ:</span>
        <div class="delivery-tag-selector">
          <button type="button" class="delivery-tag-btn ${tempDeliveryLabel === 'PTIT Hà Đông' ? 'active' : ''}" onclick="setDeliveryLabel(this, 'PTIT Hà Đông')">
            🎓 PTIT Hà Đông
          </button>
          <button type="button" class="delivery-tag-btn ${tempDeliveryLabel === 'KTX PTIT' ? 'active' : ''}" onclick="setDeliveryLabel(this, 'KTX PTIT')">
            🏢 KTX PTIT
          </button>
          <button type="button" class="delivery-tag-btn ${tempDeliveryLabel === 'Nhà riêng' ? 'active' : ''}" onclick="setDeliveryLabel(this, 'Nhà riêng')">
            🏠 Nhà riêng
          </button>
          <button type="button" class="delivery-tag-btn ${tempDeliveryLabel === 'Văn phòng' ? 'active' : ''}" onclick="setDeliveryLabel(this, 'Văn phòng')">
            💼 Văn phòng
          </button>
        </div>
      </div>

      <!-- Delivery Building Note -->
      <div class="delivery-input-group">
        <label class="delivery-input-label" for="delivery-input-note">Ghi chú địa chỉ (Tòa nhà, số tầng...):</label>
        <input 
          type="text" 
          id="delivery-input-note" 
          name="address-note"
          class="delivery-input-field" 
          placeholder="VD: Giao sảnh nhà A2, gọi trước 5 phút..." 
          value="${escapeHtml(userDeliveryInfo.note || '')}"
        >
      </div>

      <label class="db-checkbox-row" for="delivery-create-new-profile">
        <input type="checkbox" id="delivery-create-new-profile">
        <span>Tạo & ghi nhớ thành hồ sơ người dùng mới (nếu dùng SĐT mới)</span>
      </label>
    </form>

    <!-- Modal Sticky Bottom Footer -->
    <div class="delivery-modal-footer">
      <button type="submit" form="delivery-info-form" class="btn-primary-large" style="flex: 1; width: 100%;">
        ${FluentIcons.saveFilled} Lưu & Áp Dụng Thông Tin
      </button>
    </div>
  `;

  overlay.classList.add('active');
  setupDeliveryFormValidation();
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
          <span class="custom-map-pin-icon">${FluentIcons.locationFilled}</span>
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
  if (typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
    window.Router.syncUrl({ replace: true });
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

function getDeliveryFieldErrorMessage(field) {
  if (!field) return '';
  const val = field.value.trim();
  if (field.id === 'delivery-input-name') {
    return val ? '' : 'Vui lòng nhập họ tên người nhận.';
  }
  if (field.id === 'delivery-input-phone') {
    if (!val) return 'Vui lòng nhập số điện thoại liên hệ.';
    if (typeof isValidPhoneNumber === 'function' && !isValidPhoneNumber(val)) {
      return 'Số điện thoại chưa đúng định dạng (10 số, bắt đầu bằng 03, 05, 07, 08, 09).';
    }
    return '';
  }
  if (field.id === 'delivery-input-email') {
    if (val && typeof isValidEmail === 'function' && !isValidEmail(val)) {
      return 'Định dạng Email chưa hợp lệ (VD: user@stu.ptit.edu.vn).';
    }
    return '';
  }
  if (field.id === 'delivery-input-address') {
    return val ? '' : 'Vui lòng nhập địa chỉ nhận hàng chi tiết.';
  }
  return '';
}

function syncDeliveryFieldValidation(field, forceDisplay = false) {
  if (!field) return true;
  const errMsg = getDeliveryFieldErrorMessage(field);
  field.setCustomValidity(errMsg);

  const group = field.closest('.delivery-input-group');
  const mapIds = {
    'delivery-input-name': { hintId: '', errId: 'delivery-name-error' },
    'delivery-input-phone': { hintId: 'delivery-phone-hint', errId: 'delivery-phone-error' },
    'delivery-input-email': { hintId: 'delivery-email-hint', errId: 'delivery-email-error' },
    'delivery-input-address': { hintId: '', errId: 'delivery-address-error' }
  };
  const cfg = mapIds[field.id] || {};
  const errEl = cfg.errId ? document.getElementById(cfg.errId) : null;

  const isInteracted = field.dataset.interacted === 'true' || forceDisplay;
  const showInvalid = Boolean(errMsg && isInteracted);

  if (errEl) {
    errEl.textContent = showInvalid ? errMsg : '';
  }
  if (group) {
    group.classList.toggle('has-error', showInvalid);
  }
  field.classList.toggle('is-invalid', showInvalid);

  if (showInvalid) {
    field.setAttribute('aria-invalid', 'true');
  } else {
    field.removeAttribute('aria-invalid');
  }

  const describedBy = [cfg.hintId, showInvalid ? cfg.errId : ''].filter(Boolean).join(' ');
  if (describedBy) {
    field.setAttribute('aria-describedby', describedBy);
  } else {
    field.removeAttribute('aria-describedby');
  }

  return !errMsg;
}

function setupDeliveryFormValidation() {
  const form = document.getElementById('delivery-info-form');
  if (!form) return;
  const fields = form.querySelectorAll('#delivery-input-name, #delivery-input-phone, #delivery-input-email, #delivery-input-address');
  fields.forEach(field => {
    field.addEventListener('blur', () => {
      if (field.value.trim() !== '' || field.hasAttribute('required')) {
        field.dataset.interacted = 'true';
      }
      syncDeliveryFieldValidation(field, false);
    });
    field.addEventListener('input', () => {
      if (field.dataset.interacted === 'true') {
        syncDeliveryFieldValidation(field, false);
      } else {
        field.setCustomValidity(getDeliveryFieldErrorMessage(field));
      }
    });
  });
}

function saveDeliveryInfo() {
  const nameEl = document.getElementById('delivery-input-name');
  const phoneEl = document.getElementById('delivery-input-phone');
  const emailEl = document.getElementById('delivery-input-email');
  const addressEl = document.getElementById('delivery-input-address');

  const validatedFields = [nameEl, phoneEl, emailEl, addressEl].filter(Boolean);
  let firstInvalid = null;
  let firstErrMsg = '';
  validatedFields.forEach(f => {
    f.dataset.interacted = 'true';
    const ok = syncDeliveryFieldValidation(f, true);
    if (!ok && !firstInvalid) {
      firstInvalid = f;
      firstErrMsg = getDeliveryFieldErrorMessage(f);
    }
  });

  if (firstInvalid) {
    firstInvalid.focus();
    if (typeof showToast === 'function') {
      showToast('dismissCircleRegular', firstErrMsg || 'Vui lòng kiểm tra lại thông tin giao hàng!');
    }
    return;
  }

  const name = nameEl?.value.trim() || 'Khách hàng';
  const phone = phoneEl?.value.trim() || '0901 234 567';
  const email = emailEl?.value.trim() || '';
  const address = addressEl?.value.trim() || 'Học viện CNBCVT, Hà Đông, Hà Nội';
  const note = document.getElementById('delivery-input-note')?.value.trim() || '';
  const createNewProfile = document.getElementById('delivery-create-new-profile')?.checked;

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

function captureOrderFlowOriginIfNeeded() {
  if (typeof window.Router !== 'undefined' && window.Router.isNavigatingFromRouter) return;
  if (typeof currentView === 'string' && currentView !== 'cart' && currentView !== 'checkout' && currentView !== 'order-success') {
    const step = (window.history.state && typeof window.history.state.step === 'number') ? window.history.state.step : 0;
    window._orderFlowOrigin = {
      view: currentView,
      step: step,
      dish: (typeof modalDish !== 'undefined' && modalDish) ? modalDish : null
    };
  }
}

function initEmptyCartMotionState(img) {
  if (!img) return;
  const wrap = img.closest('.empty-cart-graphic');
  if (!wrap) return;
  const prefersReduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) {
    wrap.classList.remove('is-paused');
    return;
  }
  const canvas = wrap.querySelector('.empty-cart-freeze-canvas');
  if (canvas && img.complete && img.naturalWidth > 0) {
    canvas.width = img.naturalWidth || 450;
    canvas.height = img.naturalHeight || 450;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch (_) { }
    }
  }
  wrap.classList.add('is-paused');
}

function handleEmptyCartImgFallback(img) {
  const wrap = img ? img.closest('.empty-cart-graphic') : null;
  if (!wrap) return;
  wrap.className = 'empty-cart-svg-wrap';
  wrap.innerHTML = `
    <svg width="78" height="78" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 26H25.5L31.5 52.5C32.1 55.1 34.4 57 37.1 57H57.5C60.1 57 62.3 55.2 63 52.7L66.8 38.2C67.4 35.9 65.7 33.6 63.3 33.6H28.5" stroke="#00B14F" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="38" cy="64" r="3.8" fill="#00B14F" />
      <circle cx="55" cy="64" r="3.8" fill="#00B14F" />
    </svg>`;
}

window.initEmptyCartMotionState = initEmptyCartMotionState;
window.handleEmptyCartImgFallback = handleEmptyCartImgFallback;

function openCartView() {
  captureOrderFlowOriginIfNeeded();
  saveCurrentViewScroll();
  currentView = 'cart';
  render();
  restoreViewScroll('cart');
}

function renderCartView() {
  if (typeof syncAppTargetForView === 'function') syncAppTargetForView('cart');
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
        <button type="button" class="page-back-icon-btn" onclick="openHomeView()" aria-label="Về trang chủ">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Giỏ Hàng (${totalItems} món)</div>
        <div style="width: 36px;"></div>
      </div>

      ${cart.length === 0 ? `
        <!-- Empty Cart State (Hoạt ảnh GIF giỏ hàng trống, tự dừng frame tĩnh khi prefers-reduced-motion) -->
        <div class="search-empty-state" style="padding-top: 64px;">
          <div class="empty-cart-graphic">
            <img src="assets/animation/shopping-cart-empty-animation-gif-download-11303261.gif"
                 alt="Giỏ hàng của bạn đang trống"
                 class="empty-cart-img"
                 decoding="async"
                 onload="if(typeof initEmptyCartMotionState==='function')initEmptyCartMotionState(this)"
                 onerror="if(typeof handleEmptyCartImgFallback==='function')handleEmptyCartImgFallback(this)">
            <canvas class="empty-cart-freeze-canvas" width="450" height="450" aria-hidden="true"></canvas>
          </div>
          <div class="search-empty-title">Giỏ hàng của bạn đang trống</div>
          <div class="search-empty-sub">Hãy khám phá các món ăn ngon lành và thêm vào giỏ nhé!</div>
          <button type="button" 
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
              <button type="button" 
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
                      <button type="button" class="stepper-btn" style="width: 26px; height: 26px;" onclick="updateCartItemQty(${idx}, -1)">
                        ${FluentIcons.subtractRegular}
                      </button>
                      <span class="stepper-count" style="font-size: 12px; min-width: 18px;">${item.quantity}</span>
                      <button type="button" class="stepper-btn" style="width: 26px; height: 26px;" onclick="updateCartItemQty(${idx}, 1)">
                        ${FluentIcons.addRegular}
                      </button>
                    </div>

                    <button type="button" class="cart-item-delete-btn" onclick="removeCartItem(${idx})" title="Xóa món">
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
              onkeydown="if(event.key==='Enter'){event.preventDefault();handleApplyVoucherInput();}"
            >
            <button type="button" class="cart-voucher-apply-btn" onclick="handleApplyVoucherInput()">
              ${appliedVoucher ? 'Hủy' : 'Áp dụng'}
            </button>
          </div>
          ${appliedVoucher ? `
            <div class="cart-voucher-feedback" style="font-size: 12px; color: var(--green-600); font-weight: 600; margin-top: 6px; padding-left: 4px;">
              🎉 Đã áp dụng mã ${appliedVoucher.code}: Giảm ${formatVND(discountAmount)}
            </div>
          ` : (typeof dbmRenderCartVoucherChipsHtml === 'function' ? dbmRenderCartVoucherChipsHtml(cart) : `
            <div class="cart-voucher-feedback" style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
              <button type="button" class="note-chip" style="background:#fff1f0;border-color:#ffa39e;color:#cf1322;" onclick="applyPromoCode('HUNGCHIENGION')">${FluentIcons.fireFilled} HUNGCHIENGION (-50K)</button>
              <button type="button" class="note-chip" onclick="applyPromoCode('PTITNGON50')">${FluentIcons.flashFilled} PTITNGON50 (-50%)</button>
              <button type="button" class="note-chip" onclick="applyPromoCode('FREESHIP')">🚚 FREESHIP (0đ)</button>
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
              <button type="button" class="cart-checkout-btn" onclick="openCheckoutView()">
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
  if (typeof markKeepAliveRendered === 'function') {
    markKeepAliveRendered('cart');
  }
}

function updateCartViewInPlace() {
  const cartPanel = (typeof document !== 'undefined' && document.getElementById('spa-view-cart')) || document;
  const cartContainer = cartPanel.querySelector('.cart-view-container');
  if (!cartContainer) {
    if (currentView === 'cart') renderCartView();
    else if (typeof invalidateKeepAliveView === 'function') invalidateKeepAliveView('cart');
    return;
  }

  // Nếu giỏ hàng trống hoặc đang ở trạng thái Empty Cart mà mới thêm món, dựng lại khi ở tab Giỏ hàng hoặc đánh dấu cần cập nhật lại
  if (cart.length === 0 || !cartContainer.querySelector('.cart-layout-grid')) {
    if (currentView === 'cart') renderCartView();
    else if (typeof invalidateKeepAliveView === 'function') invalidateKeepAliveView('cart');
    return;
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingFee = subtotal > 150000 ? 0 : 15000;
  const discountAmount = (typeof computeVoucherDiscount === 'function')
    ? computeVoucherDiscount(appliedVoucher, subtotal, cart)
    : 0;
  const finalTotal = Math.max(0, subtotal + shippingFee - discountAmount);

  // 1. Cập nhật tiêu đề giỏ hàng
  const titleEl = cartContainer.querySelector('.page-nav-title');
  if (titleEl) titleEl.textContent = `Giỏ Hàng (${totalItems} món)`;

  // 2. Cập nhật khối Voucher (.cart-voucher-section)
  const voucherSection = cartContainer.querySelector('.cart-voucher-section');
  if (voucherSection) {
    const input = voucherSection.querySelector('.cart-voucher-input');
    const applyBtn = voucherSection.querySelector('.cart-voucher-apply-btn');
    if (input && document.activeElement !== input) {
      input.value = appliedVoucher ? appliedVoucher.code : '';
    }
    if (applyBtn) {
      applyBtn.textContent = appliedVoucher ? 'Hủy' : 'Áp dụng';
    }

    const card = voucherSection.querySelector('.cart-voucher-card');
    if (card) {
      const voucherSubHtml = appliedVoucher ? `
        <div class="cart-voucher-feedback" style="font-size: 12px; color: var(--green-600); font-weight: 600; margin-top: 6px; padding-left: 4px;">
          🎉 Đã áp dụng mã ${appliedVoucher.code}: Giảm ${formatVND(discountAmount)}
        </div>
      ` : (typeof dbmRenderCartVoucherChipsHtml === 'function' ? dbmRenderCartVoucherChipsHtml(cart) : `
        <div class="cart-voucher-feedback" style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
          <button type="button" class="note-chip" style="background:#fff1f0;border-color:#ffa39e;color:#cf1322;" onclick="applyPromoCode('HUNGCHIENGION')">${FluentIcons.fireFilled} HUNGCHIENGION (-50K)</button>
          <button type="button" class="note-chip" onclick="applyPromoCode('PTITNGON50')">${FluentIcons.flashFilled} PTITNGON50 (-50%)</button>
          <button type="button" class="note-chip" onclick="applyPromoCode('FREESHIP')">🚚 FREESHIP (0đ)</button>
        </div>
      `);

      const oldFeedback = voucherSection.querySelector('.cart-voucher-feedback, div[style*="font-size: 12px"], div[style*="display: flex; gap: 6px; margin-top: 8px"]');
      if (oldFeedback) {
        oldFeedback.outerHTML = voucherSubHtml;
      } else {
        card.insertAdjacentHTML('afterend', voucherSubHtml);
      }
    }
  }

  // 3. Cập nhật thẻ Chi tiết thanh toán (.cart-bill-card)
  const billCard = cartContainer.querySelector('.cart-bill-card');
  if (billCard) {
    billCard.innerHTML = `
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
    `;
  }

  // 4. Cập nhật nút Thanh toán cố định (.cart-bottom-bar)
  const checkoutBtn = cartContainer.querySelector('.cart-checkout-btn');
  if (checkoutBtn) {
    const subInfo = checkoutBtn.querySelector('div:first-child');
    if (subInfo) {
      subInfo.innerHTML = `
        <div style="font-size: 11px; font-weight: 500; opacity: 0.9;">Tổng cộng (${totalItems} món)</div>
        <div style="font-size: 17px; font-weight: 800;">${formatVND(finalTotal)}</div>
      `;
    }
  }

  updateFloatingCartBar();
  if (typeof markKeepAliveRendered === 'function') {
    markKeepAliveRendered('cart');
  }
}

function updateCartItemQty(idx, delta) {
  if (!cart[idx]) return;
  const newQty = cart[idx].quantity + delta;
  if (newQty <= 0) {
    removeCartItem(idx);
    return;
  }
  cart[idx].quantity = newQty;
  cart[idx].totalPrice = cart[idx].unitPrice * newQty;
  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserCart(cart);
  }

  // Cập nhật DOM giỏ hàng tại chỗ không reload toàn trang
  const cartContainer = document.querySelector('.cart-view-container');
  const cartRows = document.querySelectorAll('.cart-item-card');
  if (cartContainer && cartRows[idx]) {
    const row = cartRows[idx];
    const qtyEl = row.querySelector('.stepper-count');
    const priceEl = row.querySelector('.cart-item-price');
    if (qtyEl) qtyEl.textContent = newQty;
    if (priceEl) priceEl.textContent = formatVND(cart[idx].totalPrice);

    updateCartViewInPlace();
  } else {
    renderCartView();
  }
}

function removeCartItem(idx) {
  if (!cart[idx]) return;
  const name = cart[idx].dishName;
  cart.splice(idx, 1);
  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserCart(cart);
  }
  showToast('deleteRegular', `Đã xóa "${name}" khỏi giỏ hàng`);

  const cartContainer = document.querySelector('.cart-view-container');
  if (cartContainer && cart.length > 0) {
    const itemsSection = cartContainer.querySelector('.cart-items-section');
    const rows = itemsSection ? itemsSection.querySelectorAll('.cart-item-card') : [];
    if (rows[idx]) {
      rows[idx].remove();
    }
    // Cập nhật lại index trong các hàng còn lại
    if (itemsSection) {
      itemsSection.querySelectorAll('.cart-item-card').forEach((card, newIdx) => {
        const stepperBtns = card.querySelectorAll('.stepper-btn');
        if (stepperBtns.length >= 2) {
          stepperBtns[0].setAttribute('onclick', `updateCartItemQty(${newIdx}, -1)`);
          stepperBtns[1].setAttribute('onclick', `updateCartItemQty(${newIdx}, 1)`);
        }
        const deleteBtn = card.querySelector('.cart-item-delete-btn');
        if (deleteBtn) {
          deleteBtn.setAttribute('onclick', `removeCartItem(${newIdx})`);
        }
      });
    }
    updateCartViewInPlace();
  } else {
    renderCartView();
  }
}

function handleApplyVoucherInput() {
  if (appliedVoucher) {
    appliedVoucher = null;
    showToast('tagRegular', 'Đã hủy áp dụng mã giảm giá');
    if (currentView === 'cart') {
      updateCartViewInPlace();
    } else {
      renderCartView();
    }
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
    updateCartViewInPlace();
  } else if (currentView === 'checkout') {
    renderCheckoutView();
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
  captureOrderFlowOriginIfNeeded();
  if (typeof getOrCreatePendingCheckoutOrderId === 'function') {
    getOrCreatePendingCheckoutOrderId();
  }
  saveCurrentViewScroll();
  currentView = 'checkout';
  render();
  restoreViewScroll('checkout', 0);
}

function backFromCheckout() {
  const curStep = (window.history.state && typeof window.history.state.step === 'number') ? window.history.state.step : 0;
  const origin = window._orderFlowOrigin;

  if (origin && origin.view === 'dish-detail') {
    if (typeof origin.step === 'number' && curStep > origin.step) {
      const delta = origin.step - curStep;
      if (delta < 0 && window.history.length > Math.abs(delta)) {
        window._orderFlowOrigin = null;
        window.history.go(delta);
        return;
      }
    }
    if (origin.dish && typeof openDishDetailView === 'function') {
      window._orderFlowOrigin = null;
      openDishDetailView(origin.dish, null, { replace: true, previousView: 'home' });
      return;
    }
  }

  window._orderFlowOrigin = null;

  if (curStep > 0 && window.history.length > 1) {
    window.history.back();
    return;
  }

  if (typeof openCartView === 'function') {
    openCartView();
  }
}

function renderCheckoutView() {
  if (typeof syncAppTargetForView === 'function') syncAppTargetForView('checkout');
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingFee = subtotal > 150000 ? 0 : 15000;

  let discountAmount = (typeof computeVoucherDiscount === 'function') ? computeVoucherDiscount(appliedVoucher, subtotal, cart) : 0;
  const finalTotal = Math.max(0, subtotal + shippingFee - discountAmount);

  app.innerHTML = `
    <div class="checkout-view-container fade-in">
      <!-- Header -->
      <div class="page-nav-header">
        <button type="button" class="page-back-icon-btn" onclick="window.goBack(backFromCheckout)" aria-label="Quay lại">
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
                <button type="button" 
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
            <button type="button" class="cart-checkout-btn" onclick="handleCheckoutPrimaryAction(${finalTotal})">
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
  if (typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
    window.Router.syncUrl({ replace: true });
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

  if (typeof triggerHaptic === 'function') {
    triggerHaptic('success');
  }

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
  const savedY = (typeof globalViewScrollPositions !== 'undefined' && typeof globalViewScrollPositions['activity_list'] === 'number')
    ? globalViewScrollPositions['activity_list']
    : null;
  if (savedY !== null) {
    applyPageScroll(savedY);
  } else {
    restoreViewScroll('activity');
  }
}

function switchActivityFilter(filter) {
  if (activityFilter === filter && !viewingOrderDetailId) return;
  activityFilter = filter;

  // Nếu đang xem chi tiết đơn hàng hoặc chưa có container activity trên DOM, render đầy đủ lại view
  const activityContainer = document.querySelector('.activity-view-container');
  const pastOrdersListEl = document.querySelector('.past-orders-list');
  if (viewingOrderDetailId || !activityContainer || !pastOrdersListEl) {
    viewingOrderDetailId = null;
    renderActivityView();
    if (typeof updateFloatingTopBar === 'function') {
      updateFloatingTopBar();
    }
    return;
  }

  // Cập nhật trạng thái active trên các nút tab (kể cả floating bar nếu có) ngay lập tức mà không reload trang
  document.querySelectorAll('.activity-tab-btn').forEach(btn => {
    const fn = btn.getAttribute('onclick') || '';
    if (fn.includes(`'${filter}'`) || fn.includes(`"${filter}"`)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Lọc danh sách đơn hàng theo tab vừa chọn
  const filteredOrders = ordersList.filter(o => {
    if (activityFilter === 'all') return true;
    return o.categoryStatus === activityFilter;
  });

  // Cập nhật mượt mà danh sách đơn hàng với hiệu ứng: Cái biến mất thì fade/exit, cái ở lại thì giữ nguyên & lướt êm ái
  animateSwitchActivityOrders(pastOrdersListEl, filteredOrders, activityFilter);

  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
  if (typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
    window.Router.syncUrl({ replace: true });
  }
}

function viewOrderDetail(orderId) {
  saveCurrentViewScroll();
  globalViewScrollPositions['activity_list'] = window.scrollY || 0;
  viewingOrderDetailId = orderId;
  currentView = 'activity';
  render({ vtMode: 'forward', scrollTop: 0 });
}

function closeOrderDetail() {
  if (typeof window.Router !== 'undefined' && typeof window.Router.back === 'function') {
    const state = window.history.state;
    const step = (state && typeof state.step === 'number') ? state.step : 0;
    if (step > 0 && window.history.length > 1) {
      window.history.back();
      return;
    }
  }
  saveCurrentViewScroll();
  viewingOrderDetailId = null;
  const savedY = globalViewScrollPositions['activity_list'] || 0;
  render({ vtMode: 'back', scrollTop: savedY });
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
  const starBtns = document.querySelectorAll('.star-tap-btn');
  const labelEl = document.querySelector('.rating-score-label');
  const ratingDescMap = {
    1: 'Rất không hài lòng 😞',
    2: 'Cần cải thiện thêm 😐',
    3: 'Tạm ổn, đúng kỳ vọng 🙂',
    4: 'Hài lòng, món ngon 😊',
    5: 'Rất tuyệt vời, đồ ăn chuẩn vị! 🌟'
  };
  if (starBtns.length > 0) {
    starBtns.forEach((btn, idx) => {
      const s = idx + 1;
      const isFilled = s <= score;
      btn.classList.toggle('active', isFilled);
      btn.innerHTML = isFilled ? FluentIcons.starFilled : FluentIcons.starRegular;
    });
    if (labelEl) labelEl.textContent = ratingDescMap[score] || `${score} sao`;
  } else {
    renderActivityView();
  }
}

function toggleRatingTag(tag) {
  const idx = userRatingTags.indexOf(tag);
  if (idx > -1) {
    userRatingTags.splice(idx, 1);
  } else {
    userRatingTags.push(tag);
  }
  const tagChips = document.querySelectorAll('.rating-tag-chip');
  if (tagChips.length > 0) {
    tagChips.forEach(chip => {
      if (chip.innerText.trim() === tag) {
        chip.classList.toggle('active', userRatingTags.includes(tag));
      }
    });
  } else {
    renderActivityView();
  }
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

function renderSinglePastOrderCardHtml(order) {
  const isDelivering = order.categoryStatus === 'delivering';
  const isCompleted = order.categoryStatus === 'completed';
  const isCancelled = order.categoryStatus === 'cancelled';

  const badgeClass = isDelivering ? 'delivering' : (isCompleted ? 'completed' : 'cancelled');
  const badgeText = isDelivering
    ? `<span class="pulse-dot"></span> Đang giao`
    : (isCompleted ? `Giao thành công` : `Đã hủy đơn`);

  const itemsSummary = order.items.map(it => `${it.quantity}x ${it.dishName || it.name}`).join(' • ');

  return `
    <div class="past-order-card" data-order-id="${order.orderId}" onclick="viewOrderDetail('${order.orderId}')" style="cursor: pointer;">
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
            <button type="button" class="past-order-btn primary" onclick="viewOrderDetail('${order.orderId}')">
              Theo dõi trực tiếp ${FluentIcons.truckRegular}
            </button>
          ` : isCompleted ? `
            <button type="button" class="past-order-btn secondary" onclick="viewOrderDetail('${order.orderId}')">
              Xem chi tiết
            </button>
            <button type="button" class="past-order-btn primary" onclick="reorderOrder('${order.orderId}')">
              Đặt lại
            </button>
          ` : `
            <button type="button" class="past-order-btn secondary" onclick="viewOrderDetail('${order.orderId}')">
              Xem chi tiết
            </button>
            <button type="button" class="past-order-btn primary" onclick="reorderOrder('${order.orderId}')" title="Đặt lại đơn/combo đã hủy này">
              Đặt lại
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderEmptyOrdersHtml(filter = activityFilter) {
  const filterLabel = filter === 'delivering' ? 'Đang giao' : filter === 'completed' ? 'Đã giao' : filter === 'cancelled' ? 'Đã hủy' : 'Tất cả';
  return `
    <div class="activity-empty-state empty-enter" style="text-align: center; padding: 60px 20px;">
      <div style="color: var(--gray-400); display: flex; justify-content: center; margin-bottom: 12px;">
        ${FluentIcons.receiptRegular}
      </div>
      <div style="font-size: 16px; font-weight: 700; color: var(--gray-800); margin-bottom: 6px;">
        Chưa có đơn hàng nào
      </div>
      <div class="empty-filter-desc" style="font-size: 13px; color: var(--gray-500); margin-bottom: 20px;">
        Không có đơn hàng nào trong mục "${filterLabel}".
      </div>
      <button type="button" class="btn-primary-large" onclick="openHomeView()" style="max-width: 240px; margin: 0 auto;">
        Khám phá món ngon ngay
      </button>
    </div>
  `;
}

function renderPastOrdersListHtml(filteredOrders, filter = activityFilter) {
  if (!filteredOrders || filteredOrders.length === 0) {
    return renderEmptyOrdersHtml(filter);
  }
  return filteredOrders.map(order => renderSinglePastOrderCardHtml(order)).join('');
}

function animateSwitchActivityOrders(pastOrdersListEl, targetOrders, filter) {
  if (window._activityTabAnimTimeout) {
    clearTimeout(window._activityTabAnimTimeout);
    window._activityTabAnimTimeout = null;
  }

  // Dọn dẹp ngay các thẻ đang dở dang hiệu ứng exit nếu người dùng nhấn tab liên tục
  const pendingExitCards = pastOrdersListEl.querySelectorAll('.past-order-card-exit');
  pendingExitCards.forEach(c => c.remove());

  const currentEmptyEl = pastOrdersListEl.querySelector('.activity-empty-state');
  const currentCards = Array.from(pastOrdersListEl.querySelectorAll('.past-order-card'));

  // 1. Trường hợp danh sách đích không có đơn hàng nào
  if (!targetOrders || targetOrders.length === 0) {
    if (currentEmptyEl) {
      const descEl = currentEmptyEl.querySelector('.empty-filter-desc');
      const filterLabel = filter === 'delivering' ? 'Đang giao' : filter === 'completed' ? 'Đã giao' : filter === 'cancelled' ? 'Đã hủy' : 'Tất cả';
      if (descEl) descEl.textContent = `Không có đơn hàng nào trong mục "${filterLabel}".`;
      return;
    }

    if (currentCards.length > 0) {
      // Hiệu ứng các card biến mất
      currentCards.forEach(card => card.classList.add('past-order-card-exit'));
      window._activityTabAnimTimeout = setTimeout(() => {
        pastOrdersListEl.innerHTML = renderEmptyOrdersHtml(filter);
        if (typeof window.refreshSmoothScroll === 'function') {
          window.refreshSmoothScroll();
        }
      }, 200);
      return;
    }

    pastOrdersListEl.innerHTML = renderEmptyOrdersHtml(filter);
    return;
  }

  // 2. Trường hợp trước đó rỗng, giờ có đơn hàng
  if (currentEmptyEl) {
    currentEmptyEl.style.opacity = '0';
    currentEmptyEl.style.transform = 'translateY(-6px) scale(0.96)';
    window._activityTabAnimTimeout = setTimeout(() => {
      pastOrdersListEl.innerHTML = renderPastOrdersListHtml(targetOrders, filter);
      const newCards = pastOrdersListEl.querySelectorAll('.past-order-card');
      newCards.forEach((c, idx) => {
        c.classList.add('past-order-card-enter-init');
        setTimeout(() => {
          c.classList.remove('past-order-card-enter-init');
          c.classList.add('past-order-card-enter-active');
        }, idx * 30 + 15);
      });
      if (typeof window.refreshSmoothScroll === 'function') {
        window.refreshSmoothScroll();
      }
    }, 180);
    return;
  }

  // 3. Trường hợp chuyển đổi giữa các danh sách có đơn hàng
  const targetMap = new Map();
  targetOrders.forEach(o => targetMap.set(o.orderId, o));

  const currentMap = new Map();
  currentCards.forEach(c => currentMap.set(c.getAttribute('data-order-id'), c));

  const toRemove = [];
  const toStay = [];
  currentCards.forEach(card => {
    const id = card.getAttribute('data-order-id');
    if (targetMap.has(id)) {
      toStay.push(card);
    } else {
      toRemove.push(card);
    }
  });

  const toAdd = targetOrders.filter(o => !currentMap.has(o.orderId));

  // Nếu danh sách không có thay đổi
  if (toRemove.length === 0 && toAdd.length === 0) {
    return;
  }

  // [CÁI BIẾN MẤT]: Bật hiệu ứng fade out + thu nhỏ nhẹ
  toRemove.forEach(card => {
    card.classList.add('past-order-card-exit');
  });

  // [CÁI Ở LẠI]: Bật hiệu ứng viền phát sáng nhẹ nhàng xác nhận đơn này được giữ lại
  toStay.forEach(card => {
    card.classList.remove('past-order-card-stay');
    void card.offsetWidth; // force reflow
    card.classList.add('past-order-card-stay');
  });

  // Hàm FLIP: Giữ nguyên card ở lại, trượt êm ái sang vị trí mới
  const executeFlipTransition = () => {
    // 1. First: Ghi nhận vị trí ban đầu của các card ở lại
    const firstRects = new Map();
    toStay.forEach(card => {
      firstRects.set(card, card.getBoundingClientRect());
    });

    // 2. Tháo gỡ các thẻ biến mất khỏi DOM
    toRemove.forEach(card => card.remove());

    // 3. Sắp xếp lại thứ tự DOM theo danh sách targetOrders
    const fragment = document.createDocumentFragment();
    const newlyAddedEls = [];

    targetOrders.forEach(order => {
      const existingEl = currentMap.get(order.orderId);
      if (existingEl) {
        fragment.appendChild(existingEl);
      } else {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderSinglePastOrderCardHtml(order).trim();
        const newEl = tempDiv.firstElementChild;
        newEl.classList.add('past-order-card-enter-init');
        newlyAddedEls.push(newEl);
        fragment.appendChild(newEl);
      }
    });

    pastOrdersListEl.appendChild(fragment);

    // 4. Invert: Tính độ lệch deltaY và đặt transform ban đầu để card không bị giật
    toStay.forEach(card => {
      const first = firstRects.get(card);
      if (first) {
        const last = card.getBoundingClientRect();
        const deltaY = first.top - last.top;
        if (Math.abs(deltaY) > 0.5) {
          card.style.transform = `translateY(${deltaY}px)`;
          card.style.transition = 'none';
        }
      }
    });

    // 5. Play: Cho các card trượt mượt mà về vị trí tự nhiên
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toStay.forEach(card => {
          card.style.transition = 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
          card.style.transform = '';
        });
        newlyAddedEls.forEach(card => {
          card.classList.remove('past-order-card-enter-init');
          card.classList.add('past-order-card-enter-active');
        });
      });
    });

    // 6. Dọn dẹp inline style sau khi animation kết thúc
    window._activityTabAnimTimeout = setTimeout(() => {
      toStay.forEach(card => {
        card.style.transition = '';
        card.style.transform = '';
        card.classList.remove('past-order-card-stay');
      });
      newlyAddedEls.forEach(card => {
        card.classList.remove('past-order-card-enter-active');
      });
      if (typeof window.refreshSmoothScroll === 'function') {
        window.refreshSmoothScroll();
      }
    }, 350);
  };

  // Nếu có thẻ biến mất, giữ 200ms để người dùng quan sát thấy rõ thẻ biến mất trước khi dồn chỗ các thẻ ở lại
  if (toRemove.length > 0) {
    window._activityTabAnimTimeout = setTimeout(executeFlipTransition, 200);
  } else {
    executeFlipTransition();
  }
}

function renderActivityView() {
  if (viewingOrderDetailId) {
    const rawId = String(viewingOrderDetailId).trim();
    const cleanId = rawId.replace(/^#+/, '');
    let order = (typeof ordersList !== 'undefined' && Array.isArray(ordersList))
      ? ordersList.find(x => {
        const xId = String(x.orderId || '').trim();
        return xId === rawId || xId === cleanId || xId.replace(/^#+/, '') === cleanId;
      })
      : null;

    if (!order && typeof DB !== 'undefined' && DB.isReady && DB.data && Array.isArray(DB.data.users)) {
      for (const u of DB.data.users) {
        if (Array.isArray(u.orders)) {
          order = u.orders.find(x => {
            const xId = String(x.orderId || '').trim();
            return xId === rawId || xId === cleanId || xId.replace(/^#+/, '') === cleanId;
          });
          if (order) break;
        }
      }
    }

    if (!order && typeof lastPlacedOrder !== 'undefined' && lastPlacedOrder) {
      const xId = String(lastPlacedOrder.orderId || '').trim();
      if (xId === rawId || xId === cleanId || xId.replace(/^#+/, '') === cleanId) {
        order = lastPlacedOrder;
      }
    }

    if (order) {
      renderSingleOrderDetailView(order);
      return;
    }
  }

  if (typeof syncAppTargetForView === 'function') syncAppTargetForView('activity');

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
        <button type="button" class="page-back-icon-btn" onclick="openHomeView()" aria-label="Về trang chủ">
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
        ${renderPastOrdersListHtml(filteredOrders)}
      </div>
    </div>
  `;

  if (typeof markKeepAliveRendered === 'function') {
    markKeepAliveRendered('activity');
  }
  if (typeof updateFloatingTopBar === 'function') {
    updateFloatingTopBar();
  }
  if (typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
    window.Router.syncUrl({ replace: true });
  }
}

function renderSingleOrderDetailView(o) {
  if (typeof syncAppTargetForView === 'function') syncAppTargetForView('activity:detail');
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
        <button type="button" class="page-back-icon-btn" onclick="window.goBack()" aria-label="Quay lại danh sách">
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
            <button type="button" class="order-code-copy-btn" onclick="copyOrderCode('${o.orderId}')" aria-label="Sao chép mã đơn hàng">
              ${FluentIcons.copyRegular}
              <span>Sao chép</span>
            </button>
          </div>

          <!-- Simulation Action Bar for Delivering Order -->
          ${isDelivering ? `
            <div class="order-detail-action-bar">
              <button type="button" class="order-detail-btn-complete" onclick="completeActiveOrder('${o.orderId}')">
                ${FluentIcons.checkmarkFilled} Mô phỏng: Đã nhận món thành công
              </button>
              <button type="button" class="order-detail-btn-danger" onclick="cancelActiveOrder('${o.orderId}')">
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
                      Tài xế đang trên đường giao tới bạn ${FluentIcons.truckRegular}
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
        ? `${FluentIcons.checkmarkFilled} Đã xác nhận thanh toán QR ${o.paymentMethod === 'momo' ? 'Ví MoMo' : 'VietQR'}`
        : `${FluentIcons.clockRegular} Đơn đang chờ quét mã QR ${o.paymentMethod === 'momo' ? 'Ví MoMo' : 'VietQR'}`}</strong>
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
        ? (o.paymentMethod === 'momo' ? `${FluentIcons.walletRegular} Xem QR MoMo` : `${FluentIcons.receiptRegular} Xem mã QR`)
        : (o.paymentMethod === 'momo' ? `${FluentIcons.walletRegular} Mở QR MoMo` : `${FluentIcons.receiptRegular} Mở QR thanh toán`)}
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
                <div class="driver-avatar">${(o.driver.avatar && o.driver.avatar !== '🛵') ? o.driver.avatar : FluentIcons.personFilled}</div>
                <div class="driver-meta">
                  <div class="driver-name">${o.driver.name}</div>
                  <div class="driver-vehicle">${o.driver.vehicle}</div>
                  <div class="driver-rating">${FluentIcons.starFilled} ${o.driver.rating} • Tài xế 5 sao</div>
                </div>
              </div>

              <!-- 3 Nút liên hệ nhanh -->
              <div class="quick-contact-actions">
                <button type="button" class="contact-action-btn call" onclick="callDriver('${o.driver.phone}')">
                  ${FluentIcons.callRegular}
                  <span>Gọi tài xế</span>
                </button>
                <button type="button" class="contact-action-btn chat" onclick="chatDriver('${o.driver.name}')">
                  ${FluentIcons.chatRegular}
                  <span>Nhắn tin</span>
                </button>
                <button type="button" class="contact-action-btn store" onclick="callRestaurant('${o.resPhone}', '${escapeHtml(o.resName)}')">
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
                      ${Array.from({ length: o.userReview.score }).map(() => FluentIcons.starFilled).join('')}
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
                    <button type="button" 
                      onclick="editUserReview('${o.orderId}')" 
                      style="background: none; border: none; font-size: 12px; font-weight: 700; color: var(--green-600); cursor: pointer; padding: 4px 0;"
                    >
                      ${FluentIcons.tagEditFilled} Chỉnh sửa đánh giá
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
                      title="${s} sao">
                      ${s <= userRatingScore ? FluentIcons.starFilled : FluentIcons.starRegular}
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
                <button type="button" class="submit-rating-btn" onclick="submitUserReview('${o.orderId}')">
                  ${FluentIcons.starFilled} Gửi đánh giá đơn hàng
                </button>
              `}
            </div>
          ` : ''}

          <!-- Reorder CTA for Completed or Cancelled Order -->
          ${(isCompleted || isCancelled) ? `
            <div style="margin-top: 8px;">
              <button type="button" class="btn-primary-large" onclick="reorderOrder('${o.orderId}')">
                ${isCancelled ? `Đặt lại đơn/combo đã hủy này ${FluentIcons.sync}` : `Đặt lại đơn hàng này ${FluentIcons.sync}`}
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      <div style="height: 30px;"></div>
    </div>
  `;

  if (typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
    window.Router.syncUrl();
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
    if (typeof recordSearchHistory === 'function') recordSearchHistory(keyword);
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
    applyPageScroll(0);
  } else {
    restoreViewScroll('search');
  }
  setTimeout(() => {
    const searchPanel = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
    const inputEl = (searchPanel && searchPanel.querySelector('#search-view-input')) || document.getElementById('search-view-input');
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

function openHomeView(opts = {}) {
  saveCurrentViewScroll();
  const previousView = currentView;
  const returningToHome =
    previousView !== 'home' ||
    Boolean(window.Router && window.Router.isNavigatingFromRouter);
  if (!opts.preserveOrder && !returningToHome && typeof dbmRollHomeShuffleSeed === 'function') {
    dbmRollHomeShuffleSeed();
  }
  currentView = 'home';
  render();
  if (previousView === 'home' && !opts.preserveScroll && !(window.Router && window.Router.isNavigatingFromRouter)) {
    globalViewScrollPositions['home'] = 0;
    applyPageScroll(0);
  } else {
    restoreViewScroll('home');
  }
}

function onSearchInputChange(val) {
  searchQuery = val;
  const searchPanel = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
  const clearBtn = searchPanel ? searchPanel.querySelector('.search-view-header .search-clear-btn') : null;
  if (clearBtn) {
    clearBtn.style.display = val ? 'flex' : 'none';
  }
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
  if (typeof scheduleSearchFilterUpdate === 'function') {
    scheduleSearchFilterUpdate();
  } else {
    updateSearchResultsOnly();
  }
}

function clearSearch() {
  searchQuery = '';
  selectedVisualSuggestion = null;
  const searchPanel = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
  const inputEl = (searchPanel && searchPanel.querySelector('#search-view-input')) || document.getElementById('search-view-input');
  if (inputEl) {
    inputEl.value = '';
    inputEl.focus();
  }
  const clearBtn = searchPanel ? searchPanel.querySelector('.search-view-header .search-clear-btn') : null;
  if (clearBtn) {
    clearBtn.style.display = 'none';
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
  if (searchPanel) {
    searchPanel.querySelectorAll('.visual-card.active').forEach(el => el.classList.remove('active'));
  }
  if (typeof flushSearchFilterUpdate === 'function' && searchPanel && searchPanel.querySelector('.search-results-list')) {
    flushSearchFilterUpdate();
  } else {
    renderSearchView();
  }
}

function selectVisualSuggestion(keyword) {
  if (selectedVisualSuggestion === keyword) {
    selectedVisualSuggestion = null;
    searchQuery = '';
  } else {
    selectedVisualSuggestion = keyword;
    searchQuery = keyword;
    if (typeof recordSearchHistory === 'function') recordSearchHistory(keyword);
  }
  renderSearchView();
}

function setDistanceFilter(dist) {
  distanceFilter = dist;
  if (dist === null) {
    showToast('locationRegular', 'Hiển thị tất cả khoảng cách');
  } else {
    showToast('locationRegular', `Lọc các quán trong bán kính < ${dist} km`);
  }
  const searchPanel = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
  const searchContainer = searchPanel.querySelector('.search-view, .search-view-container');
  if (searchContainer) {
    searchPanel.querySelectorAll('.dist-chip, .quick-chip-item').forEach(chip => {
      const onclickAttr = chip.getAttribute('onclick') || '';
      const isActive = (dist === null) ? onclickAttr.includes('null') : onclickAttr.includes(`(${dist})`);
      chip.classList.toggle('active', isActive);
      chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    updateSearchResultsOnly();
  } else {
    renderSearchView();
  }
}

function toggleFilter(filterKey) {
  activeFilters[filterKey] = !activeFilters[filterKey];
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
  const searchPanel = (typeof getSpaSearchPanel === 'function') ? getSpaSearchPanel() : document;
  const searchContainer = searchPanel.querySelector('.search-view, .search-view-container');
  if (searchContainer) {
    searchPanel.querySelectorAll('.filter-pill-item').forEach(pill => {
      const onclickAttr = pill.getAttribute('onclick') || '';
      if (onclickAttr.includes(`'${filterKey}'`) || onclickAttr.includes(`"${filterKey}"`)) {
        const isActive = Boolean(activeFilters[filterKey]);
        pill.classList.toggle('active', isActive);
        pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    });
    const slot = searchPanel.querySelector('#active-filter-pills-slot') || document.getElementById('active-filter-pills-slot');
    if (slot) slot.innerHTML = renderActiveFilterPillsHtml();
    updateSearchResultsOnly();
  } else {
    renderSearchView();
  }
}

function toggleSortNear() {
  activeFilters.near = !activeFilters.near;
  showToast('navigationRegular', activeFilters.near ? 'Đã sắp xếp quán gần nhất lên đầu' : 'Đã bỏ sắp xếp khoảng cách');
  const searchContainer = document.querySelector('.search-view-container');
  if (searchContainer) {
    document.querySelectorAll('.filter-pill-item').forEach(pill => {
      const onclickAttr = pill.getAttribute('onclick') || '';
      if (onclickAttr.includes("'near'") || onclickAttr.includes('"near"')) {
        const isActive = Boolean(activeFilters.near);
        pill.classList.toggle('active', isActive);
        pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    });
    updateSearchResultsOnly();
  } else {
    renderSearchView();
  }
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
  showToast('optionsRegular', 'Đã đặt lại tất cả bộ lọc');
  const searchContainer = document.querySelector('.search-view-container');
  if (searchContainer) {
    document.querySelectorAll('.filter-pill-item, .quick-chip-item').forEach(el => {
      el.classList.remove('active');
      el.setAttribute('aria-pressed', 'false');
    });
    document.querySelectorAll('.dist-chip').forEach(el => {
      const onclickAttr = el.getAttribute('onclick') || '';
      const isNullChip = onclickAttr.includes('null');
      el.classList.toggle('active', isNullChip);
      el.setAttribute('aria-pressed', isNullChip ? 'true' : 'false');
    });
    const slot = document.getElementById('active-filter-pills-slot');
    if (slot) slot.innerHTML = '';
    const input = document.getElementById('search-view-input');
    if (input) input.value = '';
    updateSearchResultsOnly();
  } else {
    renderSearchView();
  }
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
  const numId = Number(id);
  let isFav = false;
  const rBefore = (Array.isArray(restaurants) ? restaurants : []).find(x => Number(x.id) === numId);
  const resName = rBefore ? rBefore.name : ((typeof modalRestaurant !== 'undefined' && modalRestaurant && Number(modalRestaurant.id) === numId) ? modalRestaurant.name : 'Quán ăn');

  if (typeof DB !== 'undefined' && DB.isReady && typeof DB.toggleFavoriteRestaurant === 'function') {
    isFav = DB.toggleFavoriteRestaurant(numId);
  } else if (rBefore) {
    rBefore.fav = !rBefore.fav;
    isFav = rBefore.fav;
  } else {
    isFav = true;
  }

  // Đồng bộ trạng thái in-memory
  if (rBefore) {
    rBefore.fav = isFav;
  }
  if (typeof modalRestaurant !== 'undefined' && modalRestaurant && Number(modalRestaurant.id) === numId) {
    modalRestaurant.fav = isFav;
  }

  // Cập nhật DOM trực tiếp tại chỗ (in-place), TUYỆT ĐỐI KHÔNG reload/re-render toàn bộ giao diện
  const favIconHtml = isFav ? FluentIcons.heartFilled : FluentIcons.heartRegular;

  // 1. Quét tất cả nút yêu thích trên các thẻ quán (Home, Search, DBM) tương ứng với id này
  const selector = `[onclick*="toggleFav(${numId})"], [onclick*="toggleFav('${numId}')"], [onclick*='toggleFav("${numId}")']`;
  const matchingButtons = document.querySelectorAll(selector);
  matchingButtons.forEach(btn => {
    btn.innerHTML = favIconHtml;
    btn.classList.toggle('active', isFav);
    btn.classList.remove('anim-heart-pop');
    void btn.offsetWidth; // Force reflow để trigger lại keyframe animation
    btn.classList.add('anim-heart-pop');
  });

  // 2. Nút yêu thích trong modal tùy biến món nếu đang mở quán này
  const modalFavBtn = document.querySelector('.dish-modal-fav-btn');
  if (modalFavBtn && typeof modalRestaurant !== 'undefined' && modalRestaurant && Number(modalRestaurant.id) === numId) {
    modalFavBtn.innerHTML = favIconHtml;
    modalFavBtn.classList.toggle('active', isFav);
    modalFavBtn.classList.remove('anim-heart-pop');
    void modalFavBtn.offsetWidth;
    modalFavBtn.classList.add('anim-heart-pop');
  }

  // 3. Nút yêu thích trên topbar trang Chi Tiết Món Ăn (dish-detail) hoặc Xem Cửa Hàng (store-detail)
  if (currentView === 'dish-detail' || currentView === 'store-detail') {
    const detailFavBtns = document.querySelectorAll('.product-detail-topbar button[onclick*="toggleFav"], .res-detail-top-fav-btn, .pdp-store-fav-pill');
    detailFavBtns.forEach(detailFavBtn => {
      detailFavBtn.innerHTML = favIconHtml;
      detailFavBtn.classList.toggle('active', isFav);
      detailFavBtn.classList.remove('anim-heart-pop');
      void detailFavBtn.offsetWidth;
      detailFavBtn.classList.add('anim-heart-pop');
    });
  }

  // 3. Nếu đang ở trang Yêu thích và bỏ lưu quán -> cập nhật danh sách tại chỗ không reload
  if (currentView === 'favorites' && !isFav && typeof handleFavoriteRemovedInPlace === 'function') {
    handleFavoriteRemovedInPlace('store', String(numId));
  }

  if (typeof triggerHaptic === 'function') {
    triggerHaptic('light');
  }

  if (typeof showToast === 'function') {
    showToast(isFav ? 'heartFilled' : 'heartRegular', isFav ? `Đã lưu ${resName} vào Yêu thích ❤️` : `Đã bỏ lưu ${resName}`);
  }
}

function toggleDishFav(itemId, fallbackResId) {
  const key = String(itemId);
  let foundDish = null;
  let foundRes = null;
  const list = Array.isArray(restaurants) ? restaurants : [];

  for (const r of list) {
    if (!Array.isArray(r.relatedDishes)) continue;
    const d = r.relatedDishes.find(x => String(x.id) === key);
    if (d) {
      foundDish = d;
      foundRes = r;
      break;
    }
  }

  if (!foundDish && typeof DB !== 'undefined' && DB.data && Array.isArray(DB.data.items)) {
    foundDish = DB.data.items.find(x => String(x.id) === key) || null;
  }
  if (!foundDish && typeof modalDish !== 'undefined' && modalDish && String(modalDish.id) === key) {
    foundDish = modalDish;
  }

  const dishName = foundDish ? foundDish.name : 'Món ăn';
  let isFav = false;

  if (typeof DB !== 'undefined' && DB.isReady && typeof DB.toggleFavoriteItem === 'function') {
    isFav = DB.toggleFavoriteItem(key);
  } else if (foundDish) {
    foundDish.fav = !foundDish.fav;
    isFav = foundDish.fav;
  } else {
    isFav = true;
  }

  // Đồng bộ trạng thái in-memory
  if (foundDish) {
    foundDish.fav = isFav;
  }
  if (typeof modalDish !== 'undefined' && modalDish && String(modalDish.id) === key) {
    modalDish.fav = isFav;
  }

  // Cập nhật DOM tại chỗ cho tất cả nút yêu thích của món này (Home, Search, Modal, Dish Detail, Favorites)
  const favIconHtml = isFav ? FluentIcons.heartFilled : FluentIcons.heartRegular;
  document.querySelectorAll('[data-fav-dish-id]').forEach(btn => {
    if (btn.getAttribute('data-fav-dish-id') === key) {
      btn.innerHTML = favIconHtml;
      btn.classList.toggle('active', isFav);
      btn.classList.remove('anim-heart-pop');
      void btn.offsetWidth;
      btn.classList.add('anim-heart-pop');
    }
  });

  if (currentView === 'favorites' && !isFav && typeof handleFavoriteRemovedInPlace === 'function') {
    handleFavoriteRemovedInPlace('dish', key);
  }

  if (typeof triggerHaptic === 'function') {
    triggerHaptic('light');
  }

  if (typeof showToast === 'function') {
    showToast(isFav ? 'heartFilled' : 'heartRegular', isFav ? `Đã lưu "${dishName}" vào Yêu thích ❤️` : `Đã bỏ lưu "${dishName}"`);
  }
}
window.toggleDishFav = toggleDishFav;

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


// ── Toast Notifications (iPhone iOS Banner Style) ──
function getToastSemanticMeta(icon) {
  const key = String(icon || '').toLowerCase();
  if (key.includes('heart')) {
    return { tone: 'rose', label: 'Yêu thích' };
  }
  if (key.includes('alert') || key.includes('warning') || key.includes('dismiss') || key.includes('error')) {
    return { tone: 'amber', label: 'Lưu ý' };
  }
  if (key.includes('cart') || key.includes('bag')) {
    return { tone: 'emerald', label: 'Giỏ hàng' };
  }
  if (key.includes('sparkle') || key.includes('ai')) {
    return { tone: 'indigo', label: 'Trợ lý AI' };
  }
  if (key.includes('gift') || key.includes('tag')) {
    return { tone: 'orange', label: 'Ưu đãi' };
  }
  if (key.includes('check') || key.includes('success')) {
    return { tone: 'emerald', label: 'Thành công' };
  }
  return { tone: 'emerald', label: 'Thông báo' };
}

let iosToastStackTimer = null;

function syncToastPopoverLayer(container) {
  if (!container || typeof container.showPopover !== 'function') return;
  const hasToasts = container.querySelectorAll('.toast.ios-toast').length > 0;
  try {
    const isOpen = container.matches(':popover-open');
    if (hasToasts && !isOpen) {
      container.showPopover();
    } else if (!hasToasts && isOpen && typeof container.hidePopover === 'function') {
      container.hidePopover();
    }
  } catch (_) { }
}

function dismissIosToast(toast) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  if (iosToastStackTimer) {
    clearTimeout(iosToastStackTimer);
    iosToastStackTimer = null;
  }
  const all = Array.from(container.querySelectorAll('.toast.ios-toast:not(.is-leaving)'));
  all.forEach((el, idx) => {
    el.dataset.closing = '1';
    el.classList.add('is-leaving');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      syncToastPopoverLayer(container);
    }, 260 + idx * 25);
  });
}

function syncIosToastStack(container) {
  const items = Array.from(container.querySelectorAll('.toast.ios-toast:not(.is-leaving)'));
  const total = items.length;
  items.forEach((el, idx) => {
    const depth = total - 1 - idx; // 0 = mới nhất (trên cùng), 1, 2 = xếp chồng phía sau
    el.setAttribute('data-stack-depth', String(Math.min(depth, 2)));
  });
}

function showToast(icon, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Giữ tối đa 2 lớp cũ để tạo stack 3 lớp (1 chính + 2 mép xếp chồng phía dưới)
  const existing = Array.from(container.querySelectorAll('.toast.ios-toast:not(.is-leaving)'));
  while (existing.length >= 3) {
    const oldest = existing.shift();
    if (oldest && oldest.parentNode) oldest.parentNode.removeChild(oldest);
  }

  const meta = getToastSemanticMeta(icon);
  const toast = document.createElement('div');
  toast.className = `toast ios-toast tone-${meta.tone} is-pre-enter`;
  toast.setAttribute('data-stack-depth', '0');

  if (typeof document.ariaNotify !== 'function') {
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
  }

  const iconContent = (typeof FluentIcons !== 'undefined' && FluentIcons[icon])
    ? FluentIcons[icon]
    : (icon || (typeof FluentIcons !== 'undefined' ? FluentIcons.sparkleFilled : '🔔'));

  toast.innerHTML = `
    <div class="ios-toast-main">
      <div class="ios-toast-app-icon" aria-hidden="true">${iconContent}</div>
      <div class="ios-toast-content">
        <div class="ios-toast-head">
          <span class="ios-toast-app-name">PTITNgon • ${meta.label}</span>
          <span class="ios-toast-time">bây giờ</span>
        </div>
        <div class="ios-toast-msg">${message}</div>
      </div>
    </div>
    <div class="ios-toast-grabber" aria-hidden="true"></div>
  `;

  // Chạm hoặc vuốt lên để đóng nhanh giống iPhone
  let touchStartY = 0;
  toast.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) touchStartY = e.touches[0].clientY;
  }, { passive: true });
  toast.addEventListener('touchmove', (e) => {
    if (!e.touches || !e.touches[0]) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (dy < -18) {
      dismissIosToast(toast);
    }
  }, { passive: true });
  toast.addEventListener('click', () => dismissIosToast(toast));

  container.appendChild(toast);
  syncToastPopoverLayer(container);
  void toast.offsetWidth;

  if (typeof document.ariaNotify === 'function') {
    const plainMsg = String(toast.querySelector('.ios-toast-msg')?.textContent || '').trim();
    if (plainMsg) {
      try { document.ariaNotify(plainMsg); } catch (_) { }
    }
  }

  requestAnimationFrame(() => {
    toast.classList.remove('is-pre-enter');
    syncIosToastStack(container);
  });

  if (iosToastStackTimer) clearTimeout(iosToastStackTimer);
  iosToastStackTimer = setTimeout(() => {
    dismissIosToast(toast);
  }, 2700);
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


// ── Phone Vibration & Haptic Feedback Manager ──
let lastHapticType = null;
let lastHapticTime = 0;

function isHapticEnabled() {
  try {
    return localStorage.getItem('ptitngon_haptic_enabled') !== 'false';
  } catch (_) {
    return true;
  }
}

function setHapticEnabled(enabled) {
  try {
    localStorage.setItem('ptitngon_haptic_enabled', enabled ? 'true' : 'false');
  } catch (_) { }
}

function triggerHaptic(type = 'light') {
  if (!isHapticEnabled()) return false;

  // Throttle duplicate events within 100ms (e.g. pointerdown followed immediately by click)
  const now = Date.now();
  if (type === lastHapticType && (now - lastHapticTime) < 100) {
    return false;
  }
  lastHapticType = type;
  lastHapticTime = now;

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      let pattern;
      if (type === 'success' || type === 'order-success') {
        pattern = [60, 50, 100]; // 2 nhịp rung chúc mừng đặt hàng thành công
      } else if (type === 'backdrop' || type === 'modal-outside') {
        pattern = [25, 40, 25]; // Nhịp rung phản hồi xúc giác kép cùng hiệu ứng rung lắc của modal
      } else if (type === 'bubble' || type === 'chat') {
        pattern = 25; // Nhịp rung nhẹ khi bong bóng chat xuất hiện
      } else if (typeof type === 'number' || Array.isArray(type)) {
        pattern = type;
      } else {
        pattern = 20;
      }
      return navigator.vibrate(pattern);
    } catch (_) {
      return false;
    }
  }
  return false;
}

window.triggerHaptic = triggerHaptic;
window.isHapticEnabled = isHapticEnabled;
window.setHapticEnabled = setHapticEnabled;

// Phản hồi rung tức thì khi người dùng chạm (pointerdown) ra vùng ngoài modal-overlay trên điện thoại
document.addEventListener('pointerdown', (e) => {
  const target = e.target;
  if (!target) return;
  if (target.id === 'modal-overlay' || target.id === 'search-filter-overlay' || (target.classList && target.classList.contains('modal-overlay'))) {
    triggerHaptic('backdrop');
  }
}, { passive: true });

const NON_KEYBOARD_INPUT_TYPES = new Set([
  'checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit', 'reset', 'hidden', 'image'
]);

function isEditableKeyboardControl(el) {
  if (!el || el.disabled || el.readOnly) return false;
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = String(el.type || 'text').toLowerCase();
    return !NON_KEYBOARD_INPUT_TYPES.has(type);
  }
  return Boolean(el.isContentEditable || (typeof el.getAttribute === 'function' && el.getAttribute('contenteditable') === 'true'));
}

function getMobileKeyboardMetrics() {
  const docEl = document.documentElement;
  const layoutH = (docEl && docEl.clientHeight) || window.innerHeight || 0;
  const vv = window.visualViewport;
  const vvh = vv ? Math.max(120, Math.round(vv.height)) : layoutH;
  const vvOffsetTop = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
  const kbOffset = vv ? Math.max(0, Math.round(layoutH - (vv.height + vv.offsetTop))) : 0;
  return { layoutH, vvh, vvOffsetTop, kbOffset };
}

function isMobileKeyboardDevice() {
  if (window.innerWidth <= 768) return true;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024;
  }
  return false;
}

function ensureFocusedControlVisible(el) {
  if (!isEditableKeyboardControl(el) || el.id === 'ai-chat-input') return;
  if (typeof el.getBoundingClientRect !== 'function' || typeof el.scrollIntoView !== 'function') return;
  const rect = el.getBoundingClientRect();
  const vv = window.visualViewport;
  const visibleTop = vv ? vv.offsetTop + 12 : 12;
  const visibleBottom = vv ? vv.offsetTop + vv.height - 20 : (window.innerHeight || 0) - 20;
  if (rect.bottom > visibleBottom || rect.top < visibleTop) {
    try {
      el.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
    } catch (_) {
      el.scrollIntoView(true);
    }
  }
}

function syncMobileKeyboardViewport() {
  const rootStyle = document.documentElement && document.documentElement.style;
  if (!document.body || !rootStyle) return null;

  if (!isMobileKeyboardDevice()) {
    document.body.classList.remove('mobile-keyboard-open', 'ai-keyboard-open');
    rootStyle.removeProperty('--vvh');
    rootStyle.removeProperty('--vv-offset-top');
    rootStyle.removeProperty('--mobile-keyboard-offset');
    rootStyle.removeProperty('--ai-keyboard-offset');
    return { isKeyboardActive: false, layoutH: window.innerHeight || 0, vvh: window.innerHeight || 0, vvOffsetTop: 0, kbOffset: 0 };
  }

  const metrics = getMobileKeyboardMetrics();
  const activeEl = document.activeElement;
  const isFocused = isEditableKeyboardControl(activeEl);
  const isTouchLike = (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
  // Chỉ gắn trạng thái mở bàn phím khi thiết bị hỗ trợ cảm ứng hoặc khi visualViewport thực sự thu hẹp > 60px
  const isKeyboardActive = metrics.kbOffset > 60 || (isFocused && isTouchLike);
  const effectiveKbOffset = isKeyboardActive ? metrics.kbOffset : 0;

  rootStyle.setProperty('--vvh', `${metrics.vvh}px`);
  rootStyle.setProperty('--vv-offset-top', `${metrics.vvOffsetTop}px`);
  rootStyle.setProperty('--mobile-keyboard-offset', `${effectiveKbOffset}px`);
  document.body.classList.toggle('mobile-keyboard-open', isKeyboardActive);

  if (typeof currentView !== 'undefined' && currentView === 'ai') {
    const aiFocused = Boolean(activeEl && activeEl.id === 'ai-chat-input');
    const aiKeyboardActive = metrics.kbOffset > 60 || aiFocused;
    document.body.classList.toggle('ai-keyboard-open', aiKeyboardActive);
    rootStyle.setProperty('--ai-keyboard-offset', `${aiKeyboardActive ? metrics.kbOffset : 0}px`);
    if (typeof syncAIDockClearance === 'function') {
      syncAIDockClearance();
    }
  } else {
    document.body.classList.remove('ai-keyboard-open');
    rootStyle.removeProperty('--ai-keyboard-offset');
  }

  return { isKeyboardActive, ...metrics };
}

let __mobileKbListenersBound = false;
function initMobileKeyboardViewportSync() {
  if (__mobileKbListenersBound) return;
  __mobileKbListenersBound = true;

  let blurTimer = null;
  let scrollEnsureTimer = null;

  document.addEventListener('focusin', (e) => {
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    const target = e.target;
    if (!isEditableKeyboardControl(target)) return;
    syncMobileKeyboardViewport();
    if (!isMobileKeyboardDevice()) return;
    if (scrollEnsureTimer) clearTimeout(scrollEnsureTimer);
    scrollEnsureTimer = setTimeout(() => {
      syncMobileKeyboardViewport();
      if (document.activeElement === target) {
        ensureFocusedControlVisible(target);
      }
    }, 260);
  }, true);

  document.addEventListener('focusout', () => {
    if (blurTimer) clearTimeout(blurTimer);
    // Đợi 140ms để giữ ổn định giao diện khi người dùng bấm nút Gửi/Xóa hoặc chuyển giữa các ô
    blurTimer = setTimeout(() => {
      syncMobileKeyboardViewport();
    }, 140);
  }, true);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncMobileKeyboardViewport);
    window.visualViewport.addEventListener('scroll', syncMobileKeyboardViewport);
  }
  window.addEventListener('resize', syncMobileKeyboardViewport);
  window.addEventListener('orientationchange', () => {
    setTimeout(syncMobileKeyboardViewport, 120);
  });

  syncMobileKeyboardViewport();
}

window.isEditableKeyboardControl = isEditableKeyboardControl;
window.getMobileKeyboardMetrics = getMobileKeyboardMetrics;
window.syncMobileKeyboardViewport = syncMobileKeyboardViewport;
window.initMobileKeyboardViewportSync = initMobileKeyboardViewportSync;

// ── Init (Khởi tạo Database JSON thống nhất trước khi render UI) ──
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof setupNativeDialogModalSync === 'function') {
    setupNativeDialogModalSync();
  }
  if (typeof ensureSpaPanelsMounted === 'function') {
    ensureSpaPanelsMounted();
  }
  if (typeof DB !== 'undefined') {
    await DB.init();
  }
  if (typeof syncGlobalChromeUI === 'function') {
    syncGlobalChromeUI();
  }

  // Khởi động Router SPA Client-side
  if (typeof Router !== 'undefined') {
    Router.init();
    if (window.location.hash && window.location.hash.length > 1) {
      Router.handleRouteChange(window.location.hash);
    } else {
      render();
      Router.syncUrl({ replace: true });
    }
  } else {
    render();
  }

  if (typeof initMobilePullToRefresh === 'function') {
    initMobilePullToRefresh();
  }
  if (typeof initMobileKeyboardViewportSync === 'function') {
    initMobileKeyboardViewportSync();
  }

  if (typeof prewarmCatalogImages === 'function') {
    prewarmCatalogImages();
  }

  // Đăng ký PWA Service Worker (cache app shell & assets để mở lại tức thì / dùng offline)
  if (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    const registerSw = () => navigator.serviceWorker.register('./sw.js').catch(() => { });
    if (document.readyState === 'complete') registerSw();
    else window.addEventListener('load', registerSw, { once: true });
  }

  // Gentle auto-rotation for the top banner cushion on Home
  setInterval(() => {
    if (currentView === 'home') {
      currentBannerIndex = (currentBannerIndex + 1) % topBanners.length;
      const homePanel = (typeof document !== 'undefined' && document.getElementById('spa-view-home')) || document;
      const container = homePanel.querySelector('.top-banner-cushion');
      if (container) {
        container.innerHTML = renderBannerHtml(topBanners[currentBannerIndex], currentBannerIndex);
        if (typeof markKeepAliveRendered === 'function') markKeepAliveRendered('home');
      }
    }
  }, 6000);
});

// =========================================================================
// KIỂM TRA HÀNG LOẠT VÀ TỰ ĐỘNG CHUẨN HÓA type="button" TRÊN TOÀN BỘ DOM
// =========================================================================

/**
 * Hàm kiểm tra hàng loạt thuộc tính type="button" trên toàn bộ cây DOM
 * Mở F12 Console và gõ: checkAllButtonsType()
 */
window.checkAllButtonsType = function () {
  const allBtns = Array.from(document.querySelectorAll('button'));
  const missing = allBtns.filter(b => !b.getAttribute('type') || b.getAttribute('type') === '');
  console.group('🔍 [Audit Scanner] Báo cáo kiểm tra thẻ <button type="button">');
  console.log(`- Tổng số <button type="button"> đang hiển thị trên DOM: %c${allBtns.length}`, 'font-weight:bold;color:#0284c7;');
  console.log(`- Số button thiếu type="button":          %c${missing.length}`, `font-weight:bold;color:${missing.length ? '#ef4444' : '#16a34a'};`);
  if (missing.length > 0) {
    console.warn('Danh sách các button thiếu type:', missing);
  } else {
    console.log('✅ 100% tất cả các thẻ <button type="button"> đã được trang bị type="button" an toàn!');
  }
  console.groupEnd();
  return { total: allBtns.length, missing: missing.length, elements: missing };
};

/**
 * Hàm kiểm tra toàn diện thẻ <button type="button"> và thẻ <a> đóng vai trò nút bấm
 * Mở F12 Console và gõ: checkAllInteractiveElements()
 */
window.checkAllInteractiveElements = function () {
  const allBtns = Array.from(document.querySelectorAll('button'));
  const missingBtnType = allBtns.filter(b => !b.getAttribute('type') || b.getAttribute('type') === '');
  const allLinks = Array.from(document.querySelectorAll('a'));
  const hashLinks = allLinks.filter(a => {
    const href = a.getAttribute('href');
    return !href || href === '#' || href === '' || href.startsWith('javascript:');
  });

  console.group('🔍 [Audit Scanner] Báo cáo kiểm tra phần tử tương tác (Button & Link)');
  console.log(`- Thẻ <button type="button">: ${allBtns.length} phần tử | Thiếu type="button": %c${missingBtnType.length}`, `font-weight:bold;color:${missingBtnType.length ? '#ef4444' : '#16a34a'};`);
  console.log(`- Thẻ <a> làm nút (href="#"): %c${hashLinks.length}`, `font-weight:bold;color:${hashLinks.length ? '#ef4444' : '#16a34a'};`);

  if (hashLinks.length > 0) {
    console.warn('Cần chuyển các thẻ <a> này sang <button type="button">:', hashLinks);
  } else {
    console.log('✅ Tuyệt đối không có thẻ <a href="#"> nào đóng vai trò nút bấm!');
  }
  console.groupEnd();
  return { buttons: { total: allBtns.length, missing: missingBtnType.length }, hashLinks: hashLinks.length };
};

// Runtime Guardian: Tự động gắn type="button" cho bất kỳ thẻ <button type="button"> nào thiếu trên toàn app
function ensureButtonTypesOnDOM(root = document) {
  const buttons = (root || document).querySelectorAll('button:not([type])');
  buttons.forEach(btn => {
    btn.setAttribute('type', 'button');
  });
}

// Chạy bảo vệ ngay khi load DOM và theo dõi bằng MutationObserver duy nhất
document.addEventListener('DOMContentLoaded', () => {
  ensureButtonTypesOnDOM();
  try {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          m.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              if (node.tagName === 'BUTTON' && !node.getAttribute('type')) {
                node.setAttribute('type', 'button');
              } else if (node.querySelectorAll) {
                ensureButtonTypesOnDOM(node);
              }
            }
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (_) { }
});

// Ngăn chặn 100% việc reload trang ngoài ý muốn do form submit mặc định
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!form || !form.getAttribute('action') || form.getAttribute('action') === '#' || form.getAttribute('action') === '') {
    e.preventDefault();
  }
});

// Ngăn chặn 100% việc reload hoặc nhảy scroll do các thẻ <a href="#"> đóng vai trò nút bấm
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link) {
    const href = link.getAttribute('href');
    if (!href || href === '#' || href === '' || href.startsWith('javascript:')) {
      e.preventDefault();
      console.warn('[Accessibility Guardian] Đã chặn click thẻ <a href="#">:', link);
    }
  }
}, true);

