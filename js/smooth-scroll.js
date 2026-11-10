/* ==========================================================================
   ptitngon - Cuộn mượt với Locomotive Scroll v5 (dựa trên Lenis, giữ nguyên cuộn native)
   - Giữ nguyên window scroll => position: sticky, floating top bar, scroll event vẫn hoạt động
   - Tự bỏ qua các vùng cuộn riêng: modal, bottom sheet, popup, thanh cuộn ngang
   - Trên cảm ứng (điện thoại) dùng cuộn native của thiết bị
   - Không có CDN (offline) hoặc bật "giảm chuyển động" => dùng cuộn mặc định
   ========================================================================== */
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
        prevent: (node) => !!(node && node.closest && node.closest(PREVENT_SELECTOR))
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

