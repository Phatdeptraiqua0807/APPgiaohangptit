/* ==========================================================================
   ptitngon - Cuộn mượt với Locomotive Scroll v5 (dựa trên Lenis, giữ nguyên cuộn native)
   - Giữ nguyên window scroll => position: sticky, floating top bar, scroll event vẫn hoạt động
   - Tự bỏ qua các vùng cuộn riêng: modal, bottom sheet, popup, thanh cuộn ngang
   - Trên cảm ứng (điện thoại) dùng cuộn native của thiết bị
   - Không có CDN (offline) hoặc bật "giảm chuyển động" => dùng cuộn mặc định
   ========================================================================== */

/* --------------------------------------------------------------------------
   window.setPageScroll(y): đặt vị trí cuộn TỨC THÌ, an toàn với Locomotive/Lenis.
   Dùng khi chuyển trang/tab (render() thay toàn bộ DOM). Lý do cần hàm riêng:
   - Lenis giữ "limit" (chiều cao tối đa) cũ cho tới khi ResizeObserver chạy => scrollTo bị kẹp sai.
   - Lenis đang nội suy (lerp) sẽ ghi đè window.scrollTo native => trang mới bị nhảy về vị trí cũ.
   => Luôn resize + đặt vị trí ở Lenis lẫn native, rồi lặp lại sau 2 frame.
   -------------------------------------------------------------------------- */
(function initPageScrollHelper() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Không để trình duyệt tự khôi phục vị trí cuộn (xung đột với SPA)
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  } catch (_) { }

  function getLenis() {
    const loco = window.locomotiveScroll;
    return (loco && loco.lenisInstance) || null;
  }

  function applyOnce(y) {
    const lenis = getLenis();
    if (lenis) {
      try { if (typeof lenis.resize === 'function') lenis.resize(); } catch (_) { }
      try {
        if (typeof lenis.scrollTo === 'function') {
          lenis.scrollTo(y, { immediate: true, force: true, lock: false });
        }
      } catch (_) { }
    }
    window.scrollTo({ top: y, behavior: 'instant' });
  }

  window.setPageScroll = function (y) {
    const target = Math.max(0, Number(y) || 0);
    applyOnce(target);
    requestAnimationFrame(() => {
      applyOnce(target);
      requestAnimationFrame(() => {
        applyOnce(target);
        if (typeof window.updateHeaderScrolledState === 'function') window.updateHeaderScrolledState();
        if (typeof window.updateFloatingTopBar === 'function') window.updateFloatingTopBar();
      });
    });
  };
})();

(function initSmoothScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (typeof window.LocomotiveScroll !== 'function') return;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const PREVENT_SELECTOR = [
    '[data-lenis-prevent]',
    '.modal-overlay',
    '.bottom-sheet',
    '.search-filter-overlay',
    '.vqr-modal',
    '#vqr-gateway-modal-root',
    '.dbm-modal',
    '.dbm-drawer',
    '.sn-ai-thread',
    'textarea',
    '.leaflet-container'
  ].join(',');

  try {
    const instance = new window.LocomotiveScroll({
      lenisOptions: {
        lerp: 0.1,
        smoothWheel: true,
        wheelMultiplier: 1,
        gestureOrientation: 'vertical',
        prevent: (node) => {
          if (!node || !node.closest) return false;
          if (node.closest(PREVENT_SELECTOR)) return true;
          // Tự nhận diện mọi vùng có thanh cuộn dọc riêng (vd: .sn-ai-thread) để cuộn bên trong
          for (let el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
            if (el.scrollHeight <= el.clientHeight + 1) continue;
            const oy = window.getComputedStyle(el).overflowY;
            if (oy === 'auto' || oy === 'scroll') return true;
          }
          return false;
        }
      }
    });
    window.locomotiveScroll = instance;
    document.documentElement.classList.add('has-smooth-scroll');
  } catch (err) {
    console.warn('Không thể khởi tạo Locomotive Scroll, dùng cuộn mặc định:', err);
  }

  // Cung cấp hàm refresh toàn cục khi nội dung DOM (như chat AI, menu) thay đổi kích thước
  window.refreshSmoothScroll = function () {
    try {
      if (window.locomotiveScroll) {
        if (typeof window.locomotiveScroll.resize === 'function') {
          window.locomotiveScroll.resize();
        }
        if (window.locomotiveScroll.lenisInstance && typeof window.locomotiveScroll.lenisInstance.resize === 'function') {
          window.locomotiveScroll.lenisInstance.resize();
        }
      }
    } catch (_) { }
  };
})();
