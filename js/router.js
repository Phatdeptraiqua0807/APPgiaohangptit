/* ==========================================================================
   ptitngon - SPA Client-side Hash Router
   - Quản lý điều hướng URL không tải lại trang (#/home, #/activity, #/cart, #/ai, ...)
   - Hỗ trợ F5 giữ nguyên view, nút Back / Forward của trình duyệt
   - Tương thích hoàn hảo với Live Server (127.0.0.1:5500) và static host
   ========================================================================== */

(function () {
  'use strict';

  const Router = {
    isNavigatingFromRouter: false,
    currentPath: '',
    currentQuery: {},

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
     * Khởi tạo Router và lắng nghe sự kiện popstate / hashchange của trình duyệt
     */
    init() {
      window.addEventListener('popstate', () => {
        this.handleRouteChange(window.location.hash);
      });
      window.addEventListener('hashchange', () => {
        this.handleRouteChange(window.location.hash);
      });
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
              targetPath = `/activity/order/${viewingOrderDetailId}`;
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

      if (window.location.hash !== targetHash) {
        try {
          if (options && options.replace) {
            window.history.replaceState({ path: targetHash }, '', targetHash);
          } else {
            window.history.pushState({ path: targetHash }, '', targetHash);
          }
        } catch (_) {
          window.location.hash = targetHash;
        }
      }

      this.currentPath = targetPath;
      this.currentQuery = targetQuery;
    },

    /**
     * Xử lý điều hướng khi người dùng gõ URL, nhấn F5 hoặc bấm nút Back / Forward
     */
    handleRouteChange(rawHash) {
      const { path, query } = this.parseHash(rawHash);

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

      // 2b. Activity Order Detail: /activity/order/:orderId
      const activityOrderMatch = path.match(/^\/activity\/order\/([a-zA-Z0-9_\-]+)$/);
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
          openSearchView(query && query.q ? query.q : '', query && query.filter ? query.filter : null);
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
     * Điều hướng chủ động từ mã JavaScript
     */
    navigate(targetPathWithQuery, options = { replace: false }) {
      let target = targetPathWithQuery || '/home';
      if (!target.startsWith('#')) target = '#' + target;
      if (options && options.replace) {
        try {
          window.history.replaceState({ path: target }, '', target);
        } catch (_) {
          window.location.hash = target;
        }
      } else {
        try {
          window.history.pushState({ path: target }, '', target);
        } catch (_) {
          window.location.hash = target;
        }
      }
      this.handleRouteChange(target);
    },

    /**
     * Quay lại trang trước trong lịch sử trình duyệt
     */
    back(fallback = null) {
      if (window.history.length > 1) {
        window.history.back();
      } else if (typeof fallback === 'function') {
        fallback();
      } else if (typeof openHomeView === 'function') {
        openHomeView();
      }
    }
  };

  window.Router = Router;
})();

