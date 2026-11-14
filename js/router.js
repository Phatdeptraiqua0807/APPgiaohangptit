/* ==========================================================================
   ptitngon - SPA Client-side Hash Router
   - Quản lý điều hướng URL không tải lại trang (#/home, #/activity, #/cart, #/ai, ...)
   - Đồng bộ hoàn hảo với Lịch sử trình duyệt (Browser History API + history.state.step)
   - Bộ điều phối Back thông minh 2 nhánh: history.back() khi có stack & Logical Fallback khi vào thẳng
   - Hỗ trợ F5 giữ nguyên view, nút Back / Forward và cử chỉ vuốt lùi trang trên điện thoại
   ========================================================================== */

(function () {
  'use strict';

  const Router = {
    isNavigatingFromRouter: false,
    currentPath: '',
    currentQuery: {},
    stepPaths: {},

    recordStepPath(step, rawHash) {
      if (typeof step !== 'number' || !rawHash) return;
      this.stepPaths[step] = this.parseHash(rawHash);
    },

    getPreviousStepRoute() {
      const curStep = (window.history.state && typeof window.history.state.step === 'number')
        ? window.history.state.step
        : 0;
      if (curStep <= 0) return null;
      return this.stepPaths[curStep - 1] || null;
    },

    /**
     * Chuẩn hóa hash từ URL (ví dụ "#/activity?filter=delivering" -> { path: "/activity", query: { filter: "delivering" } })
     */
    parseHash(rawHash = window.location.hash) {
      let hash = rawHash || '';
      if (hash.startsWith('#')) hash = hash.slice(1);
      if (!hash.startsWith('/')) hash = '/' + hash;

      const [pathPart, queryPart] = hash.split('?');
      const query = {};
      if (queryPart) {
        const pairs = queryPart.split('&');
        for (const pair of pairs) {
          if (!pair) continue;
          const [key, val] = pair.split('=');
          query[decodeURIComponent(key)] = decodeURIComponent(val || '');
        }
      }

      // Chuẩn hóa path: loại bỏ trailing slash trừ trường hợp "/"
      let path = (pathPart || '').trim();
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      if (!path) path = '/home';

      return { path, query, raw: hash };
    },

    /**
     * Khởi tạo Router, đánh dấu entry đầu tiên trong history.state và lắng nghe sự kiện trình duyệt
     */
    init() {
      // 1. Đảm bảo entry đầu tiên luôn có step = 0 trong history.state
      try {
        const curState = window.history.state;
        const initialHash = window.location.hash || '#/home';
        const step = (curState && typeof curState.step === 'number') ? curState.step : 0;
        if (!curState || typeof curState.step !== 'number') {
          window.history.replaceState({ step: 0, path: initialHash }, '', initialHash);
        }
        this.recordStepPath(step, initialHash);
      } catch (_) {}

      // 2. Lắng nghe sự kiện popstate / hashchange của trình duyệt
      window.addEventListener('popstate', () => {
        this.handleRouteChange(window.location.hash);
      });
      window.addEventListener('hashchange', () => {
        this.handleRouteChange(window.location.hash);
      });
    },

    /**
     * Kiểm tra và ưu tiên đóng các Modal / Drawer đang mở trước khi lùi trang
     * (Chuẩn trải nghiệm Native Mobile App)
     */
    closeActiveModalsOrDrawers() {
      // 1. PDP Mobile Order Drawer
      const pdpDrawer = document.querySelector('.pdp-mobile-order-drawer.open, .pdp-mobile-drawer.open, .pdp-mobile-order-drawer.active');
      if (pdpDrawer) {
        if (typeof closePDPMobileOrderDrawer === 'function') {
          closePDPMobileOrderDrawer();
          return true;
        }
      }

      // 2. VietQR Modal
      const vqrModal = document.querySelector('#vietqr-modal.active, .vietqr-modal-overlay.active');
      if (vqrModal) {
        if (typeof closeVietQRModal === 'function') {
          closeVietQRModal();
          return true;
        }
      }

      // 3. AI Profile modal
      const aiProfileModal = document.querySelector('.ai-profile-modal-overlay.active, #ai-profile-manage-modal.active');
      if (aiProfileModal) {
        if (typeof closeAIProfileManageModal === 'function') {
          closeAIProfileManageModal();
          return true;
        }
      }

      // 4. User nutrition survey modal
      const surveyModal = document.querySelector('.un-survey-modal-overlay.active');
      if (surveyModal) {
        if (typeof closeNutritionSurveyModal === 'function') {
          closeNutritionSurveyModal();
          return true;
        }
      }

      // 5. Generic modal overlay
      const genericModal = document.querySelector('.modal-overlay.active, .app-modal.active');
      if (genericModal) {
        if (typeof closeModal === 'function') {
          closeModal();
          return true;
        }
      }

      return false;
    },

    /**
     * Bản đồ Hồi quy Logic (Logical Fallback Map)
     * Kích hoạt khi người dùng vào thẳng URL / F5 (history.state.step === 0) để không bao giờ bị văng ra khỏi app
     */
    executeFallbackNavigation() {
      const current = (typeof currentView === 'string') ? currentView : 'home';

      // 1. Nếu đang ở trang An Toàn & Dinh Dưỡng: về Chi tiết món
      if (current === 'dish-safety-nutrition') {
        if (typeof backToProductDetailView === 'function') {
          backToProductDetailView();
          return;
        }
      }

      // 2. Nếu đang ở Chi tiết món: về view nguồn trước đó (AI, Search, Cart,...) hoặc Home
      if (current === 'dish-detail') {
        if (typeof closePDPMobileOrderDrawer === 'function') {
          closePDPMobileOrderDrawer();
        }
        const target = (typeof previousViewBeforeDish === 'string' && previousViewBeforeDish) ? previousViewBeforeDish : 'home';
        const savedY = (typeof globalViewScrollPositions !== 'undefined' && typeof globalViewScrollPositions[target] === 'number')
          ? globalViewScrollPositions[target]
          : ((typeof viewScrollPositionsBeforeDish !== 'undefined' && viewScrollPositionsBeforeDish[target]) || 0);

        if (typeof previousViewBeforeDish !== 'undefined') {
          previousViewBeforeDish = 'home';
        }

        if (target === 'ai' && typeof openAIChatView === 'function') {
          openAIChatView();
        } else if (target === 'search' && typeof openSearchView === 'function') {
          openSearchView(typeof searchQuery === 'string' ? searchQuery : '', null, { fromBack: true, autoFocus: false });
        } else if (target === 'cart' && typeof openCartView === 'function') {
          openCartView();
        } else if (target === 'activity' && typeof openActivityView === 'function') {
          openActivityView();
        } else if (target === 'profile' && typeof openProfileView === 'function') {
          openProfileView();
        } else if (target === 'catalog' && typeof openCatalogManagerView === 'function') {
          openCatalogManagerView();
        } else if (typeof openHomeView === 'function') {
          openHomeView();
        } else {
          currentView = target;
          if (typeof render === 'function') render();
        }

        if (typeof restoreViewScroll === 'function') {
          restoreViewScroll(target, savedY);
        } else if (typeof applyPageScroll === 'function') {
          applyPageScroll(savedY);
        }
        return;
      }

      // 3. Nếu đang ở Checkout: về Giỏ hàng
      if (current === 'checkout') {
        if (typeof openCartView === 'function') {
          openCartView();
          return;
        }
      }

      // 4. Nếu đang ở Chi tiết đơn hàng trong Activity: về danh sách đơn
      if (current === 'activity' && typeof viewingOrderDetailId !== 'undefined' && viewingOrderDetailId) {
        if (typeof closeOrderDetail === 'function') {
          closeOrderDetail();
          return;
        }
      }

      // 5. Nếu đang ở Catalog Manager (Admin): về Tài khoản
      if (current === 'catalog') {
        if (typeof openProfileView === 'function') {
          openProfileView();
          return;
        }
      }

      // 6. Nếu đang ở AI Profile Detail mode trong AI Chat: về list mode
      if (current === 'ai' && typeof isAIProfileDetailMode !== 'undefined' && isAIProfileDetailMode) {
        if (typeof openAIProfileListMode === 'function') {
          openAIProfileListMode();
          return;
        }
      }

      // 6b. Nếu đang ở Order Success: về lại trang nguồn trước khi đặt hàng (VD: Thông tin mặt hàng)
      if (current === 'order-success') {
        if (typeof backFromOrderSuccess === 'function') {
          backFromOrderSuccess();
          return;
        }
      }

      // 6c. Nếu đang ở Favorites: quay lại trang nguồn (Profile hoặc Home)
      if (current === 'favorites') {
        if (typeof backFromFavoritesView === 'function') {
          backFromFavoritesView();
          return;
        }
      }

      // 6d. Nếu đang ở Store Detail: quay lại trang nguồn
      if (current === 'store-detail') {
        if (typeof backFromStoreDetailView === 'function') {
          backFromStoreDetailView();
          return;
        }
      }

      // 7. Mặc định cho Cart, Activity, AI, Profile, Search: về Home
      if (typeof openHomeView === 'function') {
        openHomeView();
      } else {
        currentView = 'home';
        if (typeof render === 'function') render();
      }
    },

    /**
     * Đồng bộ URL trên thanh địa chỉ dựa theo view hiện tại của app
     */
    syncUrl(options = { replace: false }) {
      if (this.isNavigatingFromRouter) return;

      let targetPath = '/home';
      let targetQuery = {};

      if (typeof currentView === 'string') {
        switch (currentView) {
          case 'home':
            targetPath = '/home';
            break;
          case 'activity':
            if (typeof viewingOrderDetailId !== 'undefined' && viewingOrderDetailId) {
              const cleanId = String(viewingOrderDetailId).trim().replace(/^#+/, '');
              targetPath = `/activity/order/${cleanId}`;
            } else if (typeof activityFilter !== 'undefined' && activityFilter && activityFilter !== 'all') {
              targetPath = '/activity';
              targetQuery = { filter: activityFilter };
            } else {
              targetPath = '/activity';
            }
            break;
          case 'cart':
            targetPath = '/cart';
            break;
          case 'checkout':
            targetPath = '/checkout';
            break;
          case 'ai':
            targetPath = '/ai';
            break;
          case 'profile':
            targetPath = '/profile';
            if (typeof profileActiveSubTab !== 'undefined' && profileActiveSubTab) {
              targetQuery = { tab: profileActiveSubTab };
            }
            break;
          case 'favorites':
            targetPath = '/favorites';
            if (typeof favoritesActiveTab !== 'undefined' && favoritesActiveTab && favoritesActiveTab !== 'all') {
              targetQuery = { tab: favoritesActiveTab };
            }
            break;
          case 'store-detail':
            targetPath = (typeof viewingStoreDetailId !== 'undefined' && viewingStoreDetailId)
              ? `/store/${viewingStoreDetailId}`
              : '/home';
            if (typeof storeDetailActiveTab !== 'undefined' && storeDetailActiveTab && storeDetailActiveTab !== 'for-you') {
              targetQuery = { tab: storeDetailActiveTab };
            }
            break;
          case 'catalog':
            targetPath = '/catalog';
            if (typeof catalogActiveTab !== 'undefined' && catalogActiveTab) {
              targetQuery = { tab: catalogActiveTab };
            }
            break;
          case 'search':
            targetPath = '/search';
            if (typeof searchQuery === 'string' && searchQuery.trim()) {
              targetQuery.q = searchQuery.trim();
            }
            if (typeof activeFilterChip === 'string' && activeFilterChip) {
              targetQuery.filter = activeFilterChip;
            }
            break;
          case 'dish-detail':
            if (typeof modalDish !== 'undefined' && modalDish) {
              const dishId = modalDish.id || modalDish.dishId || '';
              targetPath = dishId ? `/dish/${dishId}` : '/dish';
            } else {
              targetPath = '/home';
            }
            break;
          case 'dish-safety-nutrition':
            if (typeof modalDish !== 'undefined' && modalDish) {
              const dishId = modalDish.id || modalDish.dishId || '';
              const tab = (typeof dishSafetyActiveTab !== 'undefined' && dishSafetyActiveTab) ? dishSafetyActiveTab : 'nutrition';
              targetPath = dishId ? `/dish/${dishId}/${tab}` : '/dish';
            } else {
              targetPath = '/home';
            }
            break;
          case 'order-success':
            targetPath = '/order-success';
            if (typeof lastPlacedOrder !== 'undefined' && lastPlacedOrder && lastPlacedOrder.orderId) {
              targetQuery = { orderId: lastPlacedOrder.orderId };
            }
            break;
          default:
            targetPath = '/home';
        }
      }

      // Xây dựng chuỗi query string
      let queryString = '';
      const queryKeys = Object.keys(targetQuery);
      if (queryKeys.length > 0) {
        queryString = '?' + queryKeys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(targetQuery[k])}`).join('&');
      }

      const targetHash = '#' + targetPath + queryString;
      const curStep = (window.history.state && typeof window.history.state.step === 'number')
        ? window.history.state.step
        : 0;

      if (window.location.hash !== targetHash) {
        try {
          if (options && options.replace) {
            window.history.replaceState({ step: curStep, path: targetHash }, '', targetHash);
            this.recordStepPath(curStep, targetHash);
          } else {
            const nextStep = curStep + 1;
            window.history.pushState({ step: nextStep, path: targetHash }, '', targetHash);
            this.recordStepPath(nextStep, targetHash);
          }
        } catch (_) {
          window.location.hash = targetHash;
        }
      } else {
        this.recordStepPath(curStep, targetHash);
      }

      this.currentPath = targetPath;
      this.currentQuery = targetQuery;
    },

    /**
     * Xử lý điều hướng khi người dùng gõ URL, nhấn F5 hoặc bấm nút Back / Forward
     */
    handleRouteChange(rawHash) {
      const effectiveHash = rawHash || window.location.hash;
      const curStep = (window.history.state && typeof window.history.state.step === 'number')
        ? window.history.state.step
        : 0;
      this.recordStepPath(curStep, effectiveHash);

      const { path, query } = this.parseHash(effectiveHash);

      // Nếu path và query giống với trạng thái hiện tại, bỏ qua
      if (this.currentPath === path && JSON.stringify(this.currentQuery) === JSON.stringify(query)) {
        return;
      }

      this.isNavigatingFromRouter = true;
      this.currentPath = path;
      this.currentQuery = query;

      try {
        this.dispatch(path, query);
      } finally {
        setTimeout(() => {
          this.isNavigatingFromRouter = false;
        }, 60);
      }
    },

    /**
     * Dispatch route tới các hàm mở view tương ứng của ptitngon
     */
    dispatch(path, query) {
      // 1. Home
      if (path === '/' || path === '/home') {
        if (typeof openHomeView === 'function') {
          openHomeView();
        }
        return;
      }

      // 2. Activity / Orders List
      if (path === '/activity' || path === '/orders') {
        if (query && query.orderId) {
          if (typeof viewOrderDetail === 'function') {
            viewOrderDetail(query.orderId);
            return;
          }
        }
        if (query && query.filter && typeof activityFilter !== 'undefined') {
          activityFilter = query.filter;
        }
        if (typeof viewingOrderDetailId !== 'undefined') {
          viewingOrderDetailId = null;
        }
        if (typeof openActivityView === 'function') {
          openActivityView();
        }
        return;
      }

      // 2b. Activity Order Detail: /activity/order/:orderId (hỗ trợ cả có hoặc không có tiền tố # / %23)
      const activityOrderMatch = path.match(/^\/activity\/order\/(?:#|%23)?([a-zA-Z0-9_\-]+)$/i);
      if (activityOrderMatch) {
        const orderId = activityOrderMatch[1];
        if (typeof viewOrderDetail === 'function') {
          viewOrderDetail(orderId);
          return;
        }
      }

      // 3. Cart
      if (path === '/cart') {
        if (typeof openCartView === 'function') {
          openCartView();
        }
        return;
      }

      // 4. Checkout
      if (path === '/checkout') {
        if (typeof openCheckoutView === 'function') {
          openCheckoutView();
        }
        return;
      }

      // 5. AI Chat
      if (path === '/ai' || path === '/ai-chat') {
        if (typeof openAIChatView === 'function') {
          openAIChatView(query ? query.prompt : null);
        }
        return;
      }

      // 6. Profile
      if (path === '/profile') {
        if (typeof openProfileView === 'function') {
          openProfileView(query ? query.tab : null);
        }
        return;
      }

      // 6b. Favorites
      if (path === '/favorites') {
        if (typeof openFavoritesView === 'function') {
          openFavoritesView(query && query.tab ? query.tab : 'all');
        }
        return;
      }

      // 6c. Store Detail: /store/:id
      const storeMatch = path.match(/^\/store\/(\d+)$/i);
      if (storeMatch) {
        if (typeof openStoreDetailView === 'function') {
          openStoreDetailView(Number(storeMatch[1]), query && query.tab ? query.tab : 'for-you');
        }
        return;
      }

      // 7. Catalog Manager (Admin)
      if (path === '/catalog') {
        if (typeof openCatalogManagerView === 'function') {
          openCatalogManagerView(query && query.tab ? query.tab : 'items', query && query.cat ? query.cat : 'all');
        }
        return;
      }

      // 8. Search
      if (path === '/search') {
        if (typeof openSearchView === 'function') {
          openSearchView(
            query && query.q ? query.q : '',
            query && query.filter ? query.filter : null,
            { fromBack: true, syncKeyword: true, autoFocus: false }
          );
        }
        return;
      }

      // 9. Dish Detail: /dish/:id hoặc /dish/:id/:tab (safety/nutrition)
      const dishMatch = path.match(/^\/dish\/([a-zA-Z0-9_\-]+)(?:\/(safety|nutrition))?$/);
      if (dishMatch) {
        const dishId = dishMatch[1];
        const subTab = dishMatch[2];
        const dish = this.findDishById(dishId);
        if (dish) {
          modalDish = dish;
          if (subTab && typeof openDishSafetyNutritionView === 'function') {
            openDishSafetyNutritionView(subTab);
          } else if (typeof openDishDetailView === 'function') {
            openDishDetailView(dish);
          }
          return;
        }
      }

      // 10. Order Success
      if (path === '/order-success') {
        let order = null;
        if (query && query.orderId && typeof ordersList !== 'undefined') {
          order = ordersList.find(o => o.orderId === query.orderId);
        }
        if (!order && typeof lastPlacedOrder !== 'undefined') {
          order = lastPlacedOrder;
        }
        if (order && typeof openOrderSuccessView === 'function') {
          openOrderSuccessView(order);
          return;
        }
      }

      // Mặc định: Về Home
      if (typeof openHomeView === 'function') {
        openHomeView();
      }
    },

    /**
     * Tìm món ăn theo ID từ cơ sở dữ liệu
     */
    findDishById(dishId) {
      if (!dishId) return null;
      if (typeof DB !== 'undefined' && DB.isReady && typeof DB.getItem === 'function') {
        const it = DB.getItem(dishId);
        if (it) return it;
      }
      if (typeof DB !== 'undefined' && DB.data && Array.isArray(DB.data.items)) {
        const it = DB.data.items.find(x => String(x.id) === String(dishId) || String(x.dishId) === String(dishId));
        if (it) return it;
      }
      if (typeof foodItems !== 'undefined' && Array.isArray(foodItems)) {
        const it = foodItems.find(x => String(x.id) === String(dishId) || String(x.dishId) === String(dishId));
        if (it) return it;
      }
      return null;
    },

    /**
     * Điều hướng chủ động từ mã JavaScript với step tracking
     */
    navigate(targetPathWithQuery, options = { replace: false }) {
      let target = targetPathWithQuery || '/home';
      if (!target.startsWith('#')) target = '#' + target;

      const curStep = (window.history.state && typeof window.history.state.step === 'number')
        ? window.history.state.step
        : 0;

      if (options && options.replace) {
        try {
          window.history.replaceState({ step: curStep, path: target }, '', target);
          this.recordStepPath(curStep, target);
        } catch (_) {
          window.location.hash = target;
        }
      } else {
        try {
          const nextStep = curStep + 1;
          window.history.pushState({ step: nextStep, path: target }, '', target);
          this.recordStepPath(nextStep, target);
        } catch (_) {
          window.location.hash = target;
        }
      }
      this.handleRouteChange(target);
    },

    /**
     * Quay lại trang trước một cách thông minh (Smart Hybrid Back)
     * - Ưu tiên 1: Đóng modal/drawer nếu đang mở (không rời trang)
     * - Ưu tiên 2: Thực thi customFallback nếu người gọi chỉ định
     * - Ưu tiên 3: Nếu đang ở view con được khôi phục từ chuyển tab (vd: Chi tiết đơn hàng từ AI -> Hoạt động, hoặc Catalog từ AI -> Tài khoản), lùi về trang gốc của tab đó thay vì nhảy về tab trước
     * - Ưu tiên 4: Nếu trong app session đã có bước điều hướng (step > 0): gọi window.history.back()
     * - Ưu tiên 5: Nếu là trang đầu tiên vào web (step === 0): chạy executeFallbackNavigation() để không bị văng ra khỏi web
     */
    back(customFallback = null) {
      // 1. Đóng modal hoặc drawer đang mở
      if (this.closeActiveModalsOrDrawers()) {
        return;
      }

      // 2. Custom fallback
      if (typeof customFallback === 'function') {
        customFallback();
        return;
      }

      // 3. Kiểm tra điều kiện view con thuộc tab (Activity Detail / Profile Catalog)
      const cur = (typeof currentView === 'string') ? currentView : 'home';
      const prevRoute = this.getPreviousStepRoute();
      if (cur === 'activity' && typeof viewingOrderDetailId !== 'undefined' && viewingOrderDetailId) {
        if (!prevRoute || (prevRoute.path !== '/activity' && prevRoute.path !== '/orders')) {
          if (typeof closeOrderDetail === 'function') {
            closeOrderDetail();
            return;
          }
        }
      }
      if (cur === 'catalog') {
        if (!prevRoute || prevRoute.path !== '/profile') {
          if (typeof closeCatalogManagerView === 'function') {
            closeCatalogManagerView();
            return;
          }
        }
      }

      // 4. Kiểm tra step trong app session
      const state = window.history.state;
      const step = (state && typeof state.step === 'number') ? state.step : 0;

      if (step > 0 && window.history.length > 1) {
        window.history.back();
        return;
      }

      // 5. Fallback logic nội bộ app
      this.executeFallbackNavigation();
    }
  };

  /**
   * Phím tắt Back toàn cục tiện lợi cho mọi nút bấm trên giao diện
   */
  window.goBack = function (customFallback = null) {
    if (typeof window.Router !== 'undefined' && typeof window.Router.back === 'function') {
      window.Router.back(customFallback);
    } else if (typeof customFallback === 'function') {
      customFallback();
    } else if (typeof openHomeView === 'function') {
      openHomeView();
    }
  };

  window.Router = Router;
})();
