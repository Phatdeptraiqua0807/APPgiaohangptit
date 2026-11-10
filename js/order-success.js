/* ==========================================================================
   ptitngon - Trang "Đặt hàng thành công" (gần giống Shopee)
   - Hiển thị animation Payment Success (assets/animation/payment-success.json,
     trích từ "Payment Success.lottie") bằng lottie-web cục bộ (js/lottie.min.js)
   - Nút: Xem đơn hàng / Về trang chủ
   - Gợi ý món dựa trên đơn vừa đặt (cùng loại, cùng quán, ăn kèm, tầm giá)
   ========================================================================== */

const ORDER_SUCCESS_LOTTIE_PATH = 'assets/animation/payment-success.json';
let orderSuccessLottieInstance = null;

function openOrderSuccessView(order) {
  if (order) lastPlacedOrder = order;
  if (typeof triggerHaptic === 'function') {
    triggerHaptic('success');
  }
  if (typeof saveCurrentViewScroll === 'function') saveCurrentViewScroll();
  currentView = 'order-success';
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function viewPlacedOrderFromSuccess() {
  const order = lastPlacedOrder;
  if (order && order.orderId) {
    viewingOrderDetailId = order.orderId;
    activityFilter = 'delivering';
  }
  openActivityView();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function backHomeFromOrderSuccess() {
  destroyOrderSuccessLottie();
  openHomeView();
}

function destroyOrderSuccessLottie() {
  if (orderSuccessLottieInstance) {
    try { orderSuccessLottieInstance.destroy(); } catch (_) { }
    orderSuccessLottieInstance = null;
  }
}

function orderSuccessFallbackCheckHtml() {
  return `
    <svg class="osv-fallback-check" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="52" fill="none" stroke="#00B14F" stroke-width="8"></circle>
      <path d="M36 62 L54 80 L86 44" fill="none" stroke="#00B14F" stroke-width="9"
            stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;
}

function mountOrderSuccessLottie() {
  destroyOrderSuccessLottie();
  const box = document.getElementById('osv-lottie');
  if (!box) return;

  const showFallback = () => {
    destroyOrderSuccessLottie();
    box.innerHTML = orderSuccessFallbackCheckHtml();
  };

  if (typeof window.lottie === 'undefined' || typeof window.lottie.loadAnimation !== 'function') {
    showFallback();
    return;
  }

  try {
    orderSuccessLottieInstance = window.lottie.loadAnimation({
      container: box,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      path: ORDER_SUCCESS_LOTTIE_PATH
    });
    orderSuccessLottieInstance.addEventListener('data_failed', showFallback);
  } catch (_) {
    showFallback();
  }
}

// ── Gợi ý dựa trên đơn đã mua ──
function osvNormalize(str) {
  return String(str || '').toLowerCase();
}

function getOrderRecommendations(order, limit = 8) {
  if (typeof DB === 'undefined' || !DB.isReady || !order) return [];

  const allItems = DB.getItems().filter(it => it && it.inStock !== false);
  const orderedItems = Array.isArray(order.items) ? order.items : [];

  const orderedIds = new Set();
  const orderedNames = new Set();
  const orderedCats = new Set();
  const orderedStores = new Set();
  let unitPriceSum = 0;
  let unitPriceCount = 0;
  let hasDrink = false;

  orderedItems.forEach(ci => {
    const id = ci.dishId || ci.id;
    const base = (id && DB.getItemById(id)) || allItems.find(x => x.name === ci.dishName);
    if (id) orderedIds.add(String(id));
    if (base && base.id) orderedIds.add(String(base.id));
    orderedNames.add(osvNormalize(ci.dishName));
    const cat = osvNormalize((base && base.category) || '');
    if (cat) orderedCats.add(cat);
    if (/nước|uống|trà|cà phê|cafe|sinh tố|sữa|giải khát/.test(cat + ' ' + osvNormalize(ci.dishName))) hasDrink = true;
    const storeId = ci.restaurantId || (base && base.restaurantId);
    if (storeId !== undefined && storeId !== null) orderedStores.add(String(storeId));
    const up = Number(ci.unitPrice) || Number(base && base.price) || 0;
    if (up > 0) { unitPriceSum += up; unitPriceCount += 1; }
  });

  const avgPrice = unitPriceCount ? unitPriceSum / unitPriceCount : 0;

  const scored = [];
  allItems.forEach(it => {
    if (orderedIds.has(String(it.id)) || orderedNames.has(osvNormalize(it.name))) return;

    let score = 0;
    let reason = 'Có thể bạn sẽ thích';
    const cat = osvNormalize(it.category);
    const sameCat = cat && orderedCats.has(cat);
    const sameStore = orderedStores.has(String(it.restaurantId));
    const isDrink = /nước|uống|trà|cà phê|cafe|sinh tố|sữa|giải khát/.test(cat + ' ' + osvNormalize(it.name));

    if (sameCat) { score += 3; reason = 'Cùng loại bạn vừa đặt'; }
    if (sameStore) { score += 2; if (!sameCat) reason = `Cùng quán ${it.restaurantName || ''}`.trim(); }
    if (!hasDrink && isDrink) { score += 2.2; reason = 'Ăn kèm cho đủ vị'; }
    if (avgPrice > 0) {
      const ratio = (Number(it.price) || 0) / avgPrice;
      if (ratio >= 0.6 && ratio <= 1.4) { score += 1; if (score <= 1) reason = 'Hợp túi tiền'; }
    }
    score += (Number(it.rating) || 0) / 5;

    scored.push({ item: it, score, reason });
  });

  scored.sort((a, b) => b.score - a.score || (Number(b.item.rating) || 0) - (Number(a.item.rating) || 0));

  // Đa dạng hóa: tối đa 3 món mỗi quán
  const perStore = new Map();
  const picked = [];
  for (const entry of scored) {
    const key = String(entry.item.restaurantId);
    const count = perStore.get(key) || 0;
    if (count >= 3) continue;
    perStore.set(key, count + 1);
    picked.push(entry);
    if (picked.length >= limit) break;
  }
  return picked;
}

function osvRenderRecommendationCard({ item, reason }) {
  const id = escapeHtml(String(item.id));
  return `
    <div class="osv-rec-card" onclick="openDishDetailById('${id}')">
      <div class="osv-rec-img-wrap">
        <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name)}" loading="lazy"
             onerror="this.src='assets/images/hung_chien_gion.jpg'">
        <span class="osv-rec-reason">${escapeHtml(reason)}</span>
      </div>
      <div class="osv-rec-body">
        <div class="osv-rec-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div class="osv-rec-store">${escapeHtml(item.restaurantName || 'Quán PTIT')}</div>
        <div class="osv-rec-bottom">
          <span class="osv-rec-price">${formatVND(item.price)}</span>
          <button class="osv-rec-add" title="Thêm vào giỏ"
                  onclick="event.stopPropagation(); quickAddRecommendedDishToCart('${id}')">+</button>
        </div>
      </div>
    </div>`;
}

// ── Render trang chính ──
function renderOrderSuccessView() {
  const order = lastPlacedOrder;
  if (!order) {
    openHomeView();
    return;
  }

  const isPendingQR = (order.paymentMethod === 'qr' || order.paymentMethod === 'momo')
    && !(order.qrPayment && order.qrPayment.isPaid);

  const subtitle = isPendingQR
    ? 'Đơn hàng đã được ghi nhận. Bạn vui lòng hoàn tất chuyển khoản để quán bắt đầu chuẩn bị món.'
    : 'Quán đã nhận đơn và đang chuẩn bị món cho bạn.';

  const recs = getOrderRecommendations(order, 8);

  app.innerHTML = `
    <div class="osv-container fade-in">
      <div class="page-nav-header">
        <button class="page-back-icon-btn" onclick="backHomeFromOrderSuccess()" aria-label="Về trang chủ">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Đặt hàng thành công</div>
        <div style="width:40px;"></div>
      </div>

      <div class="osv-layout">
        <div class="osv-main-col">
          <div class="osv-hero-card">
            <div class="osv-hero-glow" aria-hidden="true"></div>
            <div class="osv-lottie" id="osv-lottie"></div>
            <h2 class="osv-hero-title">Đặt hàng thành công!</h2>
            <p class="osv-hero-sub">${escapeHtml(subtitle)}</p>
            
            <div class="osv-hero-actions">
              <button class="osv-btn-secondary" onclick="backHomeFromOrderSuccess()">Về trang chủ</button>
              <button class="osv-btn-primary" onclick="viewPlacedOrderFromSuccess()">Xem đơn hàng</button>
            </div>
          </div>

        </div>
      </div>

      ${recs.length > 0 ? `
        <div class="osv-rec-section">
          <div class="section-head">
            <div class="section-title">Gợi ý cho bạn từ đơn vừa đặt</div>
          </div>
          <div class="osv-rec-grid">
            ${recs.map(osvRenderRecommendationCard).join('')}
          </div>
        </div>
      ` : ''}

      <div class="bottom-spacer"></div>
    </div>
  `;

  mountOrderSuccessLottie();
}

