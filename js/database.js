/* ==========================================================================
   ptitngon - Unified JSON Database Engine (js/database.js)
   Quản lý toàn diện Mặt hàng (Items), Loại mặt hàng tùy chỉnh (Categories),
   Cửa hàng (Restaurants), Hồ sơ người dùng (Users: SĐT, Địa chỉ, Đơn đã đặt).
   Lưu trữ vĩnh viễn tự động (LocalStorage + Đồng bộ trực tiếp file database.json)
   ========================================================================== */

const DB_STORAGE_KEY = 'ptitngon_complete_db_v2';
const DB_IDB_NAME = 'ptitngon_fs_sync_db';
const DB_IDB_STORE = 'handles';

// Biến toàn cục tương thích trực tiếp với tầng giao diện (js/app.js)
let foodCategories = [];
let visualSuggestions = [];
let restaurants = [];

function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[\s.\-()]/g, '').trim();
}

// Kiểm tra định dạng số điện thoại Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)
function isValidPhoneNumber(phone) {
  if (!phone) return false;
  const cleaned = String(phone).replace(/[\s.\-()]/g, '').trim();
  return /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(cleaned);
}
if (typeof window !== 'undefined') window.isValidPhoneNumber = isValidPhoneNumber;

// Kiểm tra định dạng Email hợp lệ (Hỗ trợ email sinh viên PTIT và email quốc tế)
function isValidEmail(email) {
  if (!email) return false;
  const trimmed = String(email).trim();
  if (!trimmed) return true; // Cho phép rỗng nếu không bắt buộc
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
if (typeof window !== 'undefined') window.isValidEmail = isValidEmail;

function slugifyId(str, prefix = 'id') {
  const base = String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${base || Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

function formatPriceVND(num) {
  return (Number(num) || 0).toLocaleString('vi-VN') + 'đ';
}

function computeMemberTier(ordersCount, currentTier) {
  if (currentTier === 'PTITer VIP' && ordersCount >= 3) return 'PTITer VIP';
  if (ordersCount >= 10) return 'Kim Cương 💎';
  if (ordersCount >= 5) return 'PTITer VIP 🌟';
  if (ordersCount >= 2) return 'Thành viên Thân thiết';
  return currentTier || 'Thành viên Mới';
}

const DB = {
  data: null,
  isReady: false,
  hasBackendApi: false,
  apiBaseUrl: null,
  fileHandle: null,
  fileSyncStatus: 'local', // 'local' | 'file-linked' | 'server-api' | 'permission-needed'
  linkedFileName: null,

  // ── 1. Khởi tạo & Nạp Database đồng bộ nhất quán giữa 3 cách mở (start-server, Live Server, file://) ──
  async init() {
    let loadedFromApi = null;
    let loadedFromFetch = null;
    let loadedFromSeed = null;
    let loadedFromLocal = null;

    const getTimestamp = obj => {
      if (!obj || !obj.meta || !obj.meta.updatedAt) return 0;
      const t = new Date(obj.meta.updatedAt).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const getItemCount = obj => (obj && Array.isArray(obj.items) ? obj.items.length : 0);

    // Đọc bản lưu trong localStorage của origin hiện tại (nếu có)
    try {
      const rawLocal = localStorage.getItem(DB_STORAGE_KEY);
      if (rawLocal) {
        loadedFromLocal = JSON.parse(rawLocal);
      }
    } catch (err) {
      console.warn('Không thể đọc localStorage DB:', err);
    }

    // Nạp bản seed dự phòng từ js/food-data.js (đồng bộ cho file:/// và khi offline)
    if (typeof window !== 'undefined' && window.__DATABASE_SEED__) {
      try {
        loadedFromSeed = JSON.parse(JSON.stringify(window.__DATABASE_SEED__));
      } catch (_) {}
    }

    // 1. Dò tìm Server Backend (/api/database): dùng được chung cho cả start-server.bat (:3000), Live Server (:5500) và file:///
    const candidateOrigins = [];
    if (typeof window !== 'undefined' && window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      candidateOrigins.push(window.location.origin);
    }
    ['http://localhost:3000', 'http://127.0.0.1:3000'].forEach(orig => {
      if (!candidateOrigins.includes(orig)) candidateOrigins.push(orig);
    });

    for (const origin of candidateOrigins) {
      try {
        const hasAbort = typeof AbortController === 'function';
        const ctrl = hasAbort ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch (_) {} }, 1600) : null;
        const apiRes = await fetch(`${origin}/api/database`, {
          method: 'GET',
          cache: 'no-store',
          signal: ctrl ? ctrl.signal : undefined
        });
        if (timer) clearTimeout(timer);
        if (apiRes && apiRes.ok && apiRes.headers && apiRes.headers.get('X-PTITNGON-DB') === '1') {
          loadedFromApi = await apiRes.json();
          this.hasBackendApi = true;
          this.apiBaseUrl = origin;
          this.fileSyncStatus = 'server-api';
          this.linkedFileName = (typeof window !== 'undefined' && origin === window.location?.origin)
            ? 'database.json (Local Server)'
            : `database.json (${origin})`;
          break;
        }
      } catch (_) {
        // Thử origin tiếp theo
      }
    }

    // 2. Nếu server chưa bật nhưng đang mở bằng Live Server (http/https), đọc trực tiếp ./database.json
    if (!loadedFromApi && typeof window !== 'undefined' && window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      try {
        const jsonRes = await fetch('./database.json', { cache: 'no-store' });
        if (jsonRes && jsonRes.ok) {
          loadedFromFetch = await jsonRes.json();
        }
      } catch (_) {}
    }

    // 3. Giải quyết xung đột dữ liệu thông minh giữa các nguồn (API vs File đĩa vs LocalStorage vs Seed)
    const diskCand = loadedFromFetch || loadedFromSeed;
    const apiTime = getTimestamp(loadedFromApi);
    const apiItems = getItemCount(loadedFromApi);
    const diskTime = getTimestamp(diskCand);
    const diskItems = getItemCount(diskCand);
    const localTime = getTimestamp(loadedFromLocal);
    const localItems = getItemCount(loadedFromLocal);

    if (loadedFromApi) {
      // Server đang chạy: ưu tiên dữ liệu từ database.json trên server
      // Trừ trường hợp người dùng vừa sửa ở localStorage lúc server tắt và có timestamp mới hơn
      if (localTime > apiTime + 1200 && localItems >= apiItems) {
        this.data = loadedFromLocal;
        this._ensureSchemaIntegrity();
        this.save('sync_local_to_server', true);
      } else {
        this.data = loadedFromApi;
        // Cập nhật lại localStorage để tab này không còn bị cũ
        try { localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(this.data, null, 2)); } catch (_) {}
      }
    } else if (diskCand) {
      // Server không chạy: đối chiếu giữa file đĩa (database.json / food-data.js) và localStorage
      // Nếu file đĩa mới hơn hoặc có nhiều món hơn -> lấy file đĩa và làm mới localStorage
      if (diskItems > localItems || diskTime > localTime + 1200 || localTime === 0 || !loadedFromLocal) {
        this.data = diskCand;
        try { localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(this.data, null, 2)); } catch (_) {}
      } else {
        this.data = loadedFromLocal;
      }
    } else if (loadedFromLocal) {
      this.data = loadedFromLocal;
    } else {
      this.data = this._createEmptySchema();
    }

    this._ensureSchemaIntegrity();

    // Kiểm tra xem người dùng đã từng liên kết trực tiếp file database.json qua File System Access API chưa
    await this._restoreFileHandleFromIDB();

    this.isReady = true;
    this.syncToGlobals();
    this.save('init_sync', true);
    return this.data;
  },

  _createEmptySchema() {
    return {
      meta: {
        dbName: 'ptitngon_database',
        version: '2.0.0',
        updatedAt: new Date().toISOString(),
        description: 'Cơ sở dữ liệu hoàn chỉnh hệ thống quản lý mặt hàng và hồ sơ người dùng'
      },
      categories: [],
      restaurants: [],
      items: [],
      currentUserId: 'user_ptit_01',
      users: []
    };
  },

  _ensureSchemaIntegrity() {
    if (!this.data || typeof this.data !== 'object') {
      this.data = this._createEmptySchema();
    }
    if (!this.data.meta) this.data.meta = { dbName: 'ptitngon_database', version: '2.0.0' };
    if (!Array.isArray(this.data.categories)) this.data.categories = [];
    if (!Array.isArray(this.data.restaurants)) this.data.restaurants = [];
    if (!Array.isArray(this.data.items)) this.data.items = [];
    if (!Array.isArray(this.data.users)) this.data.users = [];

    // Đảm bảo có Gian hàng tùy chỉnh mặc định (id: 1000) để chứa các mặt hàng tùy chỉnh
    if (!this.data.restaurants.some(r => r.id === 1000)) {
      this.data.restaurants.push({
        id: 1000,
        name: 'Gian Hàng Tự Chọn PTIT (Mặt Hàng Tùy Chỉnh)',
        image: 'assets/images/hero_banner_1792459663182.jpg',
        categoryId: 'cat_custom',
        category: 'Tùy chỉnh',
        rating: 5.0,
        reviewCount: 'Gian hàng cộng đồng',
        priceLevel: '$',
        priceTier: 'Tùy chỉnh linh hoạt',
        distance: 0.2,
        distanceText: '0.2 km',
        deliveryTime: '10 - 15 phút',
        shippingFee: '0đ (Freeship)',
        shippingFeeNum: 0,
        isFreeship: true,
        vouchers: ['Freeship 0đ', 'Giảm 50K'],
        shortReview: 'Gian hàng tổng hợp các loại mặt hàng & món ngon tùy chỉnh do người dùng tự thêm vào hệ thống!',
        badge: 'Tùy chỉnh ✨',
        address: 'Khuôn viên Học viện CNBCVT (PTIT)',
        phone: '0901 234 567',
        isCustom: true
      });
    }

    // Đảm bảo có ít nhất 1 user mặc định
    if (this.data.users.length === 0) {
      this.data.users.push({
        id: 'user_ptit_01',
        name: 'Nguyễn Văn A',
        phone: '0901 234 567',
        email: 'nguyenvana@stu.ptit.edu.vn',
        avatar: '👨‍🎓',
        memberTier: 'PTITer VIP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        address: 'Học viện CNBCVT, Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội',
        shortAddress: 'PTIT Km10 Trần Phú, Hà Đông',
        addressLabel: 'PTIT Hà Đông',
        addressNote: 'Giao sảnh nhà A2',
        savedAddresses: [],
        favoriteRestaurantIds: [],
        cart: [],
        orders: []
      });
    }

    if (!this.data.currentUserId || !this.data.users.some(u => u.id === this.data.currentUserId)) {
      this.data.currentUserId = this.data.users[0].id;
    }

    // Chuẩn hóa từng user
    this.data.users.forEach(u => {
      if (!Array.isArray(u.savedAddresses)) u.savedAddresses = [];
      if (!Array.isArray(u.favoriteRestaurantIds)) u.favoriteRestaurantIds = [];
      if (!Array.isArray(u.cart)) u.cart = [];
      if (!Array.isArray(u.orders)) u.orders = [];
      if (!u.avatar) u.avatar = '🧑‍🎓';
      if (!u.shortAddress && u.address) {
        u.shortAddress = u.address.length > 32 ? u.address.substring(0, 30) + '...' : u.address;
      }
      if (u.savedAddresses.length === 0 && u.address) {
        u.savedAddresses.push({
          id: slugifyId(u.addressLabel || 'mac_dinh', 'addr'),
          label: u.addressLabel || 'Mặc định',
          name: u.name,
          phone: u.phone,
          address: u.address,
          shortAddress: u.shortAddress,
          note: u.addressNote || '',
          icon: '📍',
          isDefault: true
        });
      }

      // Chuẩn hóa Hồ sơ Thể trạng & Quản lý Dinh dưỡng / Kcal hàng ngày của từng User
      if (!u.healthProfile || typeof u.healthProfile !== 'object') {
        u.healthProfile = {
          personaType: 'normal', // 'normal' | 'gym' | 'keep_fit' | 'weight_loss'
          wantKeepFit: false,
          gender: 'male',
          age: 20,
          heightCm: 170,
          weightKg: 62,
          targetWeightKg: 60,
          activityLevel: 'moderate', // 'sedentary' | 'moderate' | 'active'
          dailyCalorieGoal: 2000,
          customCalorieGoal: false,
          macroGoals: { protein: 95, carbs: 245, fat: 62 },
          dietaryNotes: [],
          isConfigured: false
        };
      } else {
        if (!u.healthProfile.personaType) u.healthProfile.personaType = 'normal';
        if (typeof u.healthProfile.wantKeepFit !== 'boolean') {
          u.healthProfile.wantKeepFit = u.healthProfile.personaType === 'keep_fit' || u.healthProfile.personaType === 'weight_loss';
        }
        if (!u.healthProfile.gender) u.healthProfile.gender = 'male';
        if (!u.healthProfile.age) u.healthProfile.age = 20;
        if (!u.healthProfile.heightCm) u.healthProfile.heightCm = 170;
        if (!u.healthProfile.weightKg) u.healthProfile.weightKg = 62;
        if (!u.healthProfile.targetWeightKg) u.healthProfile.targetWeightKg = u.healthProfile.weightKg;
        if (!u.healthProfile.activityLevel) u.healthProfile.activityLevel = 'moderate';
        if (!u.healthProfile.dailyCalorieGoal) u.healthProfile.dailyCalorieGoal = 2000;
        if (!u.healthProfile.macroGoals) {
          u.healthProfile.macroGoals = { protein: 95, carbs: 245, fat: 62 };
        }
        if (!Array.isArray(u.healthProfile.dietaryNotes)) u.healthProfile.dietaryNotes = [];
      }

      if (!u.dailyNutritionLogs || typeof u.dailyNutritionLogs !== 'object') {
        u.dailyNutritionLogs = {};
      }
    });
  },

  // ── 2. Đồng bộ từ Database sang các biến hiển thị toàn cục của App ──
  syncToGlobals() {
    if (!this.data) return;

    // 1. Categories
    foodCategories = this.data.categories.map(c => ({
      ...c,
      icon: c.icon || '🍽️',
      name: c.name,
      keyword: c.keyword || c.name
    }));

    // 2. Visual Suggestions (bao gồm cả danh mục tùy chỉnh được bật gợi ý)
    visualSuggestions = this.data.categories
      .filter(c => c.showInVisualSuggestions || c.isCustom)
      .map(c => ({
        id: c.id,
        name: c.visualName || c.name,
        image: c.image || 'assets/images/hung_chien_gion.jpg',
        keyword: c.keyword || c.name,
        icon: c.icon || '🍽️',
        isCustom: !!c.isCustom
      }));

    // 3. Active User
    const activeUser = this.getCurrentUser();
    const favSet = new Set(activeUser ? activeUser.favoriteRestaurantIds : []);

    // 4. Restaurants hydrated with items from db.items
    restaurants = this.data.restaurants
      .map(r => {
        const resItems = this.data.items.filter(it => Number(it.restaurantId) === Number(r.id));
        return {
          ...r,
          fav: favSet.has(r.id),
          relatedDishes: resItems.map(it => ({
            ...it,
            priceFormatted: it.priceFormatted || formatPriceVND(it.price)
          }))
        };
      })
      // Ẩn gian hàng tùy chỉnh rỗng nếu chưa có mặt hàng nào bên trong để trang chủ gọn đẹp,
      // ngay khi có ít nhất 1 mặt hàng tùy chỉnh thì tự động hiện lên!
      .filter(r => !(r.id === 1000 && r.relatedDishes.length === 0));

    // 5. Đồng bộ thông tin người dùng hiện tại sang biến state của app.js (nếu đã khai báo)
    if (activeUser && typeof window.syncAppStateFromUser === 'function') {
      window.syncAppStateFromUser(activeUser);
    }
  },

  // ── 3. Lưu vĩnh viễn Database (LocalStorage + File .json trực tiếp) ──
  save(reason = 'update', skipTimestamp = false) {
    if (!this.data) return;
    if (!skipTimestamp) {
      this.data.meta.updatedAt = new Date().toISOString();
      this.data.meta.lastAction = reason;
    }

    const serialized = JSON.stringify(this.data, null, 2);

    // A. Lưu vĩnh viễn ngay lập tức vào LocalStorage
    try {
      localStorage.setItem(DB_STORAGE_KEY, serialized);
    } catch (e) {
      console.error('Lỗi lưu localStorage (có thể đầy bộ nhớ ảnh):', e);
      if (typeof showToast === 'function') {
        showToast('alertRegular', 'Bộ nhớ trình duyệt gần đầy, hãy dùng ảnh dung lượng nhỏ hơn!');
      }
    }

    // B. Nếu đang chạy qua Local Backend API (cùng nguồn hoặc khác cổng như Live Server), ghi đè trực tiếp vào file database.json trên ổ cứng
    if (this.hasBackendApi) {
      const endpoint = this.apiBaseUrl ? `${this.apiBaseUrl}/api/database` : './api/database';
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serialized
      }).catch(err => console.warn('Không thể ghi qua API:', err));
    }

    // C. Nếu người dùng đã liên kết trực tiếp file database.json (File System Access API), ghi thẳng xuống ổ cứng
    if (this.fileHandle && this.fileSyncStatus === 'file-linked') {
      this._writeToFileHandle(serialized).catch(err => {
        console.warn('Ghi file trực tiếp cần cấp lại quyền:', err);
        this.fileSyncStatus = 'permission-needed';
      });
    }
  },

  // ── 4. Liên kết / Xuất / Nhập File database.json trực tiếp ──
  async _openIDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open(DB_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_IDB_STORE)) {
          db.createObjectStore(DB_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  },

  async _saveFileHandleToIDB(handle) {
    const idb = await this._openIDB();
    if (!idb) return;
    return new Promise(resolve => {
      const tx = idb.transaction(DB_IDB_STORE, 'readwrite');
      tx.objectStore(DB_IDB_STORE).put(handle, 'db_json_handle');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  },

  async _restoreFileHandleFromIDB() {
    try {
      const idb = await this._openIDB();
      if (!idb) return;
      const handle = await new Promise(resolve => {
        const tx = idb.transaction(DB_IDB_STORE, 'readonly');
        const req = tx.objectStore(DB_IDB_STORE).get('db_json_handle');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (handle && handle.queryPermission) {
        this.fileHandle = handle;
        this.linkedFileName = handle.name || 'database.json';
        const perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          this.fileSyncStatus = 'file-linked';
        } else {
          this.fileSyncStatus = 'permission-needed';
        }
      }
    } catch (_) { }
  },

  async _writeToFileHandle(jsonString) {
    if (!this.fileHandle) return false;
    const writable = await this.fileHandle.createWritable();
    await writable.write(jsonString);
    await writable.close();
    return true;
  },

  async linkDirectJsonFile() {
    if (!window.showSaveFilePicker && !window.showOpenFilePicker) {
      if (typeof showToast === 'function') {
        showToast('alertRegular', 'Trình duyệt này không hỗ trợ ghi file trực tiếp. Hãy dùng nút Xuất / Tải file database.json!');
      }
      return false;
    }

    try {
      let handle = this.fileHandle;
      if (handle && this.fileSyncStatus === 'permission-needed' && handle.requestPermission) {
        const perm = await handle.requestPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          this.fileSyncStatus = 'file-linked';
          await this._writeToFileHandle(JSON.stringify(this.data, null, 2));
          return true;
        }
      }

      if (window.showSaveFilePicker) {
        handle = await window.showSaveFilePicker({
          suggestedName: 'database.json',
          types: [{
            description: 'JSON Database File',
            accept: { 'application/json': ['.json'] }
          }]
        });
      } else {
        const [picked] = await window.showOpenFilePicker({
          types: [{
            description: 'JSON Database File',
            accept: { 'application/json': ['.json'] }
          }],
          multiple: false
        });
        handle = picked;
      }

      if (handle) {
        this.fileHandle = handle;
        this.linkedFileName = handle.name;
        this.fileSyncStatus = 'file-linked';
        await this._saveFileHandleToIDB(handle);
        await this._writeToFileHandle(JSON.stringify(this.data, null, 2));
        return true;
      }
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        console.error('Lỗi liên kết file:', err);
      }
    }
    return false;
  },

  exportJsonFile() {
    const jsonStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'database.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  },

  async importJsonFile(file) {
    if (!file) return { ok: false, message: 'Chưa chọn file' };
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || (!Array.isArray(parsed.categories) && !Array.isArray(parsed.items) && !Array.isArray(parsed.users))) {
        return { ok: false, message: 'Cấu trúc file .json không đúng định dạng Database ptitngon!' };
      }
      this.data = parsed;
      this._ensureSchemaIntegrity();
      this.syncToGlobals();
      this.save('import_json_file');
      return { ok: true, message: 'Đã nhập và lưu vĩnh viễn dữ liệu từ file .json!' };
    } catch (err) {
      return { ok: false, message: 'File JSON không hợp lệ: ' + err.message };
    }
  },

  resetToSeed() {
    if (window.__DATABASE_SEED__) {
      this.data = JSON.parse(JSON.stringify(window.__DATABASE_SEED__));
      this._ensureSchemaIntegrity();
      this.syncToGlobals();
      this.save('reset_to_seed');
      return true;
    }
    return false;
  },

  // =========================================================================
  // 5. QUẢN LÝ LOẠI MẶT HÀNG (CATEGORIES - BAO GỒM TÙY CHỈNH TỪ NGƯỜI DÙNG)
  // =========================================================================

  getCategories() {
    return this.data.categories;
  },

  getCategoryById(catId) {
    return this.data.categories.find(c => c.id === catId) || null;
  },

  addCategory({ name, icon, keyword, image, description, showInVisualSuggestions = true }) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return { ok: false, message: 'Vui lòng nhập tên loại mặt hàng!' };

    const cleanKeyword = String(keyword || cleanName).trim();
    const exists = this.data.categories.find(
      c => c.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      return { ok: false, message: `Loại mặt hàng "${cleanName}" đã tồn tại trong hệ thống!` };
    }

    const newCat = {
      id: slugifyId(cleanName, 'cat_custom'),
      name: cleanName,
      visualName: cleanName,
      keyword: cleanKeyword,
      icon: String(icon || '🛍️').trim() || '🛍️',
      image: String(image || '').trim() || 'assets/images/hung_chien_gion.jpg',
      description: String(description || `Danh mục ${cleanName} tùy chỉnh`).trim(),
      showInVisualSuggestions: Boolean(showInVisualSuggestions),
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    // Đưa loại mặt hàng tùy chỉnh mới lên vị trí nổi bật (ngay đầu hoặc cuối tùy chọn - đặt lên đầu nhóm tùy chỉnh hoặc cuối danh sách)
    this.data.categories.push(newCat);
    this.syncToGlobals();
    this.save('add_custom_category');
    return { ok: true, category: newCat };
  },

  updateCategory(catId, updates) {
    const cat = this.data.categories.find(c => c.id === catId);
    if (!cat) return { ok: false, message: 'Không tìm thấy loại mặt hàng!' };

    const oldName = cat.name;
    if (updates.name !== undefined && updates.name.trim()) {
      cat.name = updates.name.trim();
      cat.visualName = updates.name.trim();
      cat.keyword = (updates.keyword && updates.keyword.trim()) ? updates.keyword.trim() : cat.name;
    }
    if (updates.icon !== undefined && updates.icon.trim()) cat.icon = updates.icon.trim();
    if (updates.image !== undefined && updates.image.trim()) cat.image = updates.image.trim();
    if (updates.description !== undefined) cat.description = updates.description.trim();
    if (updates.showInVisualSuggestions !== undefined) {
      cat.showInVisualSuggestions = Boolean(updates.showInVisualSuggestions);
    }

    // Đồng bộ tên category trên các mặt hàng thuộc loại này
    if (oldName !== cat.name) {
      this.data.items.forEach(it => {
        if (it.categoryId === cat.id || it.category === oldName) {
          it.categoryId = cat.id;
          it.category = cat.name;
        }
      });
      this.data.restaurants.forEach(r => {
        if (r.categoryId === cat.id || r.category === oldName) {
          r.categoryId = cat.id;
          r.category = cat.name;
        }
      });
    }

    this.syncToGlobals();
    this.save('update_category');
    return { ok: true, category: cat };
  },

  deleteCategory(catId) {
    const idx = this.data.categories.findIndex(c => c.id === catId);
    if (idx === -1) return { ok: false, message: 'Không tìm thấy loại mặt hàng!' };

    const cat = this.data.categories[idx];
    const linkedItems = this.data.items.filter(it => it.categoryId === cat.id || it.category === cat.name);

    this.data.categories.splice(idx, 1);

    // Nếu có mặt hàng thuộc loại vừa xóa, chuyển sang danh mục đầu tiên hoặc giữ an toàn
    if (linkedItems.length > 0 && this.data.categories.length > 0) {
      const fallback = this.data.categories[0];
      linkedItems.forEach(it => {
        it.categoryId = fallback.id;
        it.category = fallback.name;
      });
    }

    this.syncToGlobals();
    this.save('delete_category');
    return { ok: true, deleted: cat, movedCount: linkedItems.length };
  },

  // =========================================================================
  // 6. QUẢN LÝ MẶT HÀNG (ITEMS / PRODUCTS) & GIAN HÀNG
  // =========================================================================

  getItems() {
    return this.data.items;
  },

  getItemById(itemId) {
    return this.data.items.find(it => it.id === itemId) || null;
  },

  addRestaurant({ name, categoryId, image, deliveryTime, shippingFeeNum, shortReview, address, phone }) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return { ok: false, message: 'Vui lòng nhập tên quán / gian hàng!' };

    const cat = this.data.categories.find(c => c.id === categoryId) || this.data.categories[0];
    const maxId = this.data.restaurants.reduce((max, r) => Math.max(max, Number(r.id) || 0), 1000);
    const shipNum = Math.max(0, Number(shippingFeeNum) || 0);

    const newRes = {
      id: maxId + 1,
      name: cleanName,
      image: image || cat?.image || 'assets/images/hung_chien_gion.jpg',
      categoryId: cat ? cat.id : 'cat_custom',
      category: cat ? cat.name : 'Tùy chỉnh',
      rating: 5.0,
      reviewCount: 'Quán mới mở',
      priceLevel: '$',
      priceTier: 'Giá hợp lý',
      distance: 0.5,
      distanceText: '0.5 km',
      deliveryTime: deliveryTime || '15 - 20 phút',
      shippingFee: shipNum === 0 ? '0đ (Freeship)' : formatPriceVND(shipNum),
      shippingFeeNum: shipNum,
      isFreeship: shipNum === 0,
      vouchers: ['Freeship 0đ', 'Quán Mới'],
      shortReview: shortReview || 'Gian hàng chất lượng phục vụ tận nơi nhanh chóng!',
      badge: 'Mới ✨',
      address: address || 'Khu vực Học viện PTIT',
      phone: phone || '0901 234 567',
      isCustom: true
    };

    this.data.restaurants.unshift(newRes);
    this.syncToGlobals();
    this.save('add_custom_restaurant');
    return { ok: true, restaurant: newRes };
  },

  addItem(payload) {
    const cleanName = String(payload.name || '').trim();
    if (!cleanName) return { ok: false, message: 'Vui lòng nhập tên mặt hàng!' };

    const priceNum = Math.max(0, Number(payload.price) || 0);
    if (priceNum <= 0) return { ok: false, message: 'Giá mặt hàng phải lớn hơn 0đ!' };

    const cat = this.data.categories.find(c => c.id === payload.categoryId || c.name === payload.category) || this.data.categories[0];
    const resId = Number(payload.restaurantId) || 1000;
    const res = this.data.restaurants.find(r => Number(r.id) === resId) || this.data.restaurants.find(r => r.id === 1000);

    const sizes = Array.isArray(payload.sizes) && payload.sizes.length > 0
      ? payload.sizes.map(s => ({ name: String(s.name || 'Tiêu chuẩn').trim(), extraPrice: Math.max(0, Number(s.extraPrice) || 0) }))
      : [{ name: 'Phần Tiêu Chuẩn', extraPrice: 0 }];

    const toppings = Array.isArray(payload.toppings)
      ? payload.toppings
        .filter(t => t && String(t.name || '').trim())
        .map((t, i) => ({
          id: t.id || `top_${Date.now()}_${i}`,
          name: String(t.name).trim(),
          price: Math.max(0, Number(t.price) || 0)
        }))
      : [];

    const noteSuggestions = Array.isArray(payload.noteSuggestions) && payload.noteSuggestions.length > 0
      ? payload.noteSuggestions.map(n => String(n).trim()).filter(Boolean)
      : ['Giao nhanh', 'Đóng gói kỹ'];

    const nextSkuNum = this.data.items.length + 1;
    const activeUser = this.getCurrentUser();

    const newItem = {
      id: slugifyId(cleanName, 'item_custom'),
      sku: `SP-${String(nextSkuNum).padStart(4, '0')}`,
      restaurantId: res ? res.id : 1000,
      restaurantName: res ? res.name : 'Gian Hàng Tự Chọn PTIT',
      categoryId: cat ? cat.id : 'cat_custom',
      category: cat ? cat.name : 'Tùy chỉnh',
      name: cleanName,
      price: priceNum,
      priceFormatted: formatPriceVND(priceNum),
      image: String(payload.image || '').trim() || (cat ? cat.image : 'assets/images/hung_chien_gion.jpg'),
      description: String(payload.description || '').trim() || `${cleanName} thuộc danh mục ${cat ? cat.name : 'mặt hàng mới'}, đảm bảo chất lượng tươi ngon.`,
      sizes: sizes,
      toppings: toppings,
      noteSuggestions: noteSuggestions,
      inStock: payload.inStock !== false,
      isCustom: true,
      createdByUserId: activeUser ? activeUser.id : null,
      createdAt: new Date().toISOString()
    };

    // Thêm vào đầu danh sách để dễ thấy ngay lập tức
    this.data.items.unshift(newItem);
    this.syncToGlobals();
    this.save('add_custom_item');
    return { ok: true, item: newItem };
  },

  updateItem(itemId, updates) {
    const item = this.data.items.find(it => it.id === itemId);
    if (!item) return { ok: false, message: 'Không tìm thấy mặt hàng!' };

    if (updates.name !== undefined && String(updates.name).trim()) {
      item.name = String(updates.name).trim();
    }
    if (updates.price !== undefined && Number(updates.price) > 0) {
      item.price = Math.max(0, Number(updates.price));
      item.priceFormatted = formatPriceVND(item.price);
    }
    if (updates.categoryId) {
      const cat = this.data.categories.find(c => c.id === updates.categoryId);
      if (cat) {
        item.categoryId = cat.id;
        item.category = cat.name;
      }
    }
    if (updates.restaurantId !== undefined) {
      const res = this.data.restaurants.find(r => Number(r.id) === Number(updates.restaurantId));
      if (res) {
        item.restaurantId = res.id;
        item.restaurantName = res.name;
      }
    }
    if (updates.image !== undefined && String(updates.image).trim()) {
      item.image = String(updates.image).trim();
    }
    if (updates.description !== undefined) {
      item.description = String(updates.description).trim();
    }
    if (Array.isArray(updates.sizes) && updates.sizes.length > 0) {
      item.sizes = updates.sizes.map(s => ({
        name: String(s.name || 'Tiêu chuẩn').trim(),
        extraPrice: Math.max(0, Number(s.extraPrice) || 0)
      }));
    }
    if (Array.isArray(updates.toppings)) {
      item.toppings = updates.toppings
        .filter(t => t && String(t.name || '').trim())
        .map((t, i) => ({
          id: t.id || `top_${Date.now()}_${i}`,
          name: String(t.name).trim(),
          price: Math.max(0, Number(t.price) || 0)
        }));
    }
    if (Array.isArray(updates.noteSuggestions)) {
      item.noteSuggestions = updates.noteSuggestions.map(n => String(n).trim()).filter(Boolean);
    }
    if (updates.inStock !== undefined) {
      item.inStock = Boolean(updates.inStock);
    }

    this.syncToGlobals();
    this.save('update_item');
    return { ok: true, item };
  },

  toggleItemStock(itemId) {
    const item = this.data.items.find(it => it.id === itemId);
    if (!item) return null;
    item.inStock = !item.inStock;
    this.syncToGlobals();
    this.save('toggle_item_stock');
    return item;
  },

  deleteItem(itemId) {
    const idx = this.data.items.findIndex(it => it.id === itemId);
    if (idx === -1) return { ok: false, message: 'Không tìm thấy mặt hàng!' };
    const removed = this.data.items.splice(idx, 1)[0];
    this.syncToGlobals();
    this.save('delete_item');
    return { ok: true, item: removed };
  },

  // =========================================================================
  // 7. QUẢN LÝ HỒ SƠ NGƯỜI DÙNG (USER PROFILES, SĐT, ĐỊA CHỈ, ĐƠN ĐÃ ĐẶT)
  // =========================================================================

  getUsers() {
    return this.data.users;
  },

  getCurrentUser() {
    if (!this.data || !Array.isArray(this.data.users)) return null;
    return this.data.users.find(u => u.id === this.data.currentUserId) || this.data.users[0] || null;
  },

  findUserByPhone(phone) {
    const norm = normalizePhone(phone);
    if (!norm) return null;
    return this.data.users.find(u => normalizePhone(u.phone) === norm) || null;
  },

  createUser({ name, phone, email, avatar, address, addressLabel, addressNote, switchImmediately = true }) {
    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanEmail = String(email || '').trim();
    const cleanAddr = String(address || '').trim();

    if (!cleanName) return { ok: false, message: 'Vui lòng nhập họ và tên người dùng!' };
    if (!cleanPhone) return { ok: false, message: 'Vui lòng nhập số điện thoại!' };
    if (!isValidPhoneNumber(cleanPhone)) {
      return { ok: false, message: 'Số điện thoại không đúng định dạng (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)!' };
    }
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      return { ok: false, message: 'Định dạng Email không hợp lệ (VD: user@ptit.edu.vn hoặc user@gmail.com)!' };
    }
    if (!cleanAddr) return { ok: false, message: 'Vui lòng nhập địa chỉ nhận hàng!' };

    const existing = this.findUserByPhone(cleanPhone);
    if (existing) {
      return {
        ok: false,
        existingUser: existing,
        message: `Số điện thoại "${cleanPhone}" đã được đăng ký cho hồ sơ "${existing.name}"!`
      };
    }

    const shortAddr = cleanAddr.length > 32 ? cleanAddr.substring(0, 30) + '...' : cleanAddr;
    const label = String(addressLabel || 'Nhà riêng').trim();
    const iconMap = {
      'Văn phòng': '🏢',
      'Nhà riêng': '🏠',
      'KTX PTIT': '🏢',
      'PTIT Hà Đông': '🎓',
      'Phòng trọ': '🏠'
    };

    const newUser = {
      id: slugifyId(cleanName, 'user'),
      name: cleanName,
      phone: cleanPhone,
      email: String(email || '').trim(),
      avatar: avatar || '🧑‍🎓',
      memberTier: 'Thành viên Mới',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      address: cleanAddr,
      shortAddress: shortAddr,
      addressLabel: label,
      addressNote: String(addressNote || '').trim(),
      savedAddresses: [
        {
          id: slugifyId(label, 'addr'),
          label: label,
          name: cleanName,
          phone: cleanPhone,
          address: cleanAddr,
          shortAddress: shortAddr,
          note: String(addressNote || '').trim(),
          icon: iconMap[label] || '📍',
          isDefault: true
        }
      ],
      favoriteRestaurantIds: [],
      cart: [],
      orders: [],
      healthProfile: {
        personaType: 'normal',
        wantKeepFit: false,
        gender: 'male',
        age: 20,
        heightCm: 170,
        weightKg: 62,
        targetWeightKg: 60,
        activityLevel: 'moderate',
        dailyCalorieGoal: 2000,
        customCalorieGoal: false,
        macroGoals: { protein: 95, carbs: 245, fat: 62 },
        dietaryNotes: [],
        isConfigured: false
      },
      dailyNutritionLogs: {}
    };

    this.data.users.unshift(newUser);
    if (switchImmediately) {
      this.data.currentUserId = newUser.id;
    }

    this.syncToGlobals();
    this.save('create_user_profile');
    return { ok: true, user: newUser };
  },

  updateUser(userId, updates) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return { ok: false, message: 'Không tìm thấy hồ sơ người dùng!' };

    if (updates.phone !== undefined && String(updates.phone).trim()) {
      const p = String(updates.phone).trim();
      if (!isValidPhoneNumber(p)) {
        return { ok: false, message: 'Số điện thoại không đúng định dạng (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)!' };
      }
      const conflict = this.findUserByPhone(p);
      if (conflict && conflict.id !== user.id) {
        return {
          ok: false,
          existingUser: conflict,
          message: `Số điện thoại này đã thuộc về người dùng "${conflict.name}"!`
        };
      }
      user.phone = p;
    }

    if (updates.email !== undefined && String(updates.email).trim()) {
      const em = String(updates.email).trim();
      if (!isValidEmail(em)) {
        return { ok: false, message: 'Định dạng Email không hợp lệ (VD: user@ptit.edu.vn hoặc user@gmail.com)!' };
      }
      user.email = em;
    } else if (updates.email !== undefined) {
      user.email = '';
    }
    if (updates.avatar !== undefined && updates.avatar) user.avatar = updates.avatar;
    if (updates.address !== undefined && String(updates.address).trim()) {
      user.address = String(updates.address).trim();
      user.shortAddress = user.address.length > 32 ? user.address.substring(0, 30) + '...' : user.address;
    }
    if (updates.addressLabel !== undefined && updates.addressLabel) {
      user.addressLabel = updates.addressLabel;
    }
    if (updates.addressNote !== undefined) {
      user.addressNote = String(updates.addressNote).trim();
    }

    // Đồng bộ địa chỉ hiện tại vào sổ địa chỉ của user nếu chưa có
    if (user.address) {
      const matchAddr = user.savedAddresses.find(a => a.address === user.address);
      if (matchAddr) {
        matchAddr.name = user.name;
        matchAddr.phone = user.phone;
        matchAddr.label = user.addressLabel || matchAddr.label;
        matchAddr.note = user.addressNote || matchAddr.note;
      } else {
        user.savedAddresses.unshift({
          id: slugifyId(user.addressLabel || 'dia_chi', 'addr'),
          label: user.addressLabel || 'Địa chỉ mới',
          name: user.name,
          phone: user.phone,
          address: user.address,
          shortAddress: user.shortAddress,
          note: user.addressNote || '',
          icon: '📍',
          isDefault: user.savedAddresses.length === 0
        });
      }
    }

    user.updatedAt = new Date().toISOString();
    this.syncToGlobals();
    this.save('update_user_profile');
    return { ok: true, user };
  },

  switchUser(userId) {
    const target = this.data.users.find(u => u.id === userId);
    if (!target) return { ok: false, message: 'Không tìm thấy người dùng!' };

    this.data.currentUserId = target.id;
    target.updatedAt = new Date().toISOString();
    this.syncToGlobals();
    this.save('switch_user');
    return { ok: true, user: target };
  },

  deleteUser(userId) {
    if (this.data.users.length <= 1) {
      return { ok: false, message: 'Hệ thống cần giữ lại ít nhất 1 hồ sơ người dùng!' };
    }
    const idx = this.data.users.findIndex(u => u.id === userId);
    if (idx === -1) return { ok: false, message: 'Không tìm thấy người dùng!' };

    const deleted = this.data.users.splice(idx, 1)[0];
    if (this.data.currentUserId === deleted.id) {
      this.data.currentUserId = this.data.users[0].id;
    }

    this.syncToGlobals();
    this.save('delete_user');
    return { ok: true, deleted };
  },

  // Quản lý Sổ địa chỉ của từng người dùng
  addOrUpdateSavedAddress(userId, addrPayload) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return { ok: false, message: 'Không tìm thấy người dùng!' };

    const cleanAddr = String(addrPayload.address || '').trim();
    if (!cleanAddr) return { ok: false, message: 'Vui lòng nhập địa chỉ chi tiết!' };

    const shortAddr = cleanAddr.length > 32 ? cleanAddr.substring(0, 30) + '...' : cleanAddr;
    const label = String(addrPayload.label || 'Nhà riêng').trim();
    const recName = String(addrPayload.name || user.name).trim();
    const recPhone = String(addrPayload.phone || user.phone).trim();
    const note = String(addrPayload.note || '').trim();
    const icon = addrPayload.icon || (label === 'Văn phòng' ? '🏢' : label === 'Nhà riêng' ? '🏠' : '📍');

    if (addrPayload.id) {
      const existing = user.savedAddresses.find(a => a.id === addrPayload.id);
      if (existing) {
        existing.label = label;
        existing.name = recName;
        existing.phone = recPhone;
        existing.address = cleanAddr;
        existing.shortAddress = shortAddr;
        existing.note = note;
        existing.icon = icon;
        if (addrPayload.setAsCurrent) {
          this.selectSavedAddress(user.id, existing.id);
          return { ok: true, address: existing };
        }
        this.syncToGlobals();
        this.save('update_saved_address');
        return { ok: true, address: existing };
      }
    }

    const newAddr = {
      id: slugifyId(label, 'addr'),
      label,
      name: recName,
      phone: recPhone,
      address: cleanAddr,
      shortAddress: shortAddr,
      note,
      icon,
      isDefault: Boolean(addrPayload.isDefault || user.savedAddresses.length === 0)
    };

    if (newAddr.isDefault) {
      user.savedAddresses.forEach(a => (a.isDefault = false));
    }

    user.savedAddresses.unshift(newAddr);
    if (addrPayload.setAsCurrent !== false) {
      user.address = newAddr.address;
      user.shortAddress = newAddr.shortAddress;
      user.addressLabel = newAddr.label;
      user.addressNote = newAddr.note;
    }

    this.syncToGlobals();
    this.save('add_saved_address');
    return { ok: true, address: newAddr };
  },

  selectSavedAddress(userId, addrId) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return false;
    const addr = user.savedAddresses.find(a => a.id === addrId);
    if (!addr) return false;

    user.savedAddresses.forEach(a => (a.isDefault = a.id === addrId));
    user.address = addr.address;
    user.shortAddress = addr.shortAddress || addr.address;
    user.addressLabel = addr.label;
    user.addressNote = addr.note || '';
    user.updatedAt = new Date().toISOString();

    this.syncToGlobals();
    this.save('select_saved_address');
    return true;
  },

  deleteSavedAddress(userId, addrId) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return false;
    const idx = user.savedAddresses.findIndex(a => a.id === addrId);
    if (idx === -1) return false;
    user.savedAddresses.splice(idx, 1);
    if (user.savedAddresses.length > 0 && !user.savedAddresses.some(a => a.isDefault)) {
      user.savedAddresses[0].isDefault = true;
    }
    this.syncToGlobals();
    this.save('delete_saved_address');
    return true;
  },

  // Ghi nhận đơn hàng vào đúng hồ sơ người dùng & lưu vĩnh viễn
  recordOrderForCurrentUser(newOrder) {
    const user = this.getCurrentUser();
    if (!user) return;
    newOrder.userId = user.id;
    newOrder.createdAt = new Date().toISOString();
    user.orders.unshift(newOrder);
    user.cart = [];
    user.memberTier = computeMemberTier(user.orders.length, user.memberTier);
    user.updatedAt = new Date().toISOString();

    // Tự động ghi nhận lượng Kcal & Dinh dưỡng của đơn vừa đặt vào nhật ký hôm nay của người dùng
    if (typeof window.autoLogOrderNutritionForUser === 'function') {
      try {
        window.autoLogOrderNutritionForUser(user, newOrder);
      } catch (e) {
        console.warn('Auto nutrition log warning:', e);
      }
    }

    this.syncToGlobals();
    this.save('place_order');
  },

  // Cập nhật Hồ sơ Thể trạng & Mục tiêu Dinh dưỡng cá nhân hóa của User
  updateUserHealthProfile(userId, healthPatch) {
    const user = this.data.users.find(u => u.id === userId) || this.getCurrentUser();
    if (!user) return { ok: false, message: 'Không tìm thấy người dùng!' };
    if (!user.healthProfile || typeof user.healthProfile !== 'object') {
      user.healthProfile = {};
    }
    user.healthProfile = {
      ...user.healthProfile,
      ...healthPatch,
      isConfigured: true,
      updatedAt: new Date().toISOString()
    };
    user.updatedAt = new Date().toISOString();
    this.syncToGlobals();
    this.save('update_user_health_profile');
    return { ok: true, healthProfile: user.healthProfile, user };
  },

  // Ghi nhận bữa ăn / món ăn vào nhật ký Kcal hàng ngày của User
  logNutritionEntryForUser(userId, entry, dateKey) {
    const user = this.data.users.find(u => u.id === userId) || this.getCurrentUser();
    if (!user) return false;
    if (!user.dailyNutritionLogs) user.dailyNutritionLogs = {};
    if (!user.dailyNutritionLogs[dateKey]) {
      user.dailyNutritionLogs[dateKey] = { waterCups: 0, entries: [] };
    }
    user.dailyNutritionLogs[dateKey].entries.unshift(entry);
    user.updatedAt = new Date().toISOString();
    this.save('log_daily_nutrition');
    return true;
  },

  removeNutritionEntryForUser(userId, entryId, dateKey) {
    const user = this.data.users.find(u => u.id === userId) || this.getCurrentUser();
    if (!user || !user.dailyNutritionLogs || !user.dailyNutritionLogs[dateKey]) return false;
    const arr = user.dailyNutritionLogs[dateKey].entries || [];
    const idx = arr.findIndex(e => e.id === entryId);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    user.updatedAt = new Date().toISOString();
    this.save('remove_daily_nutrition_entry');
    return true;
  },

  updateWaterIntakeForUser(userId, delta, dateKey) {
    const user = this.data.users.find(u => u.id === userId) || this.getCurrentUser();
    if (!user) return 0;
    if (!user.dailyNutritionLogs) user.dailyNutritionLogs = {};
    if (!user.dailyNutritionLogs[dateKey]) {
      user.dailyNutritionLogs[dateKey] = { waterCups: 0, entries: [] };
    }
    const next = Math.max(0, Math.min(20, (Number(user.dailyNutritionLogs[dateKey].waterCups) || 0) + delta));
    user.dailyNutritionLogs[dateKey].waterCups = next;
    this.save('update_water_intake');
    return next;
  },

  saveCurrentUserOrders(ordersArr) {
    const user = this.getCurrentUser();
    if (!user) return;
    user.orders = ordersArr;
    user.memberTier = computeMemberTier(user.orders.length, user.memberTier);
    user.updatedAt = new Date().toISOString();
    this.save('update_order_status');
  },

  saveCurrentUserCart(cartArr) {
    const user = this.getCurrentUser();
    if (!user) return;
    user.cart = cartArr;
    this.save('update_cart');
  },

  toggleFavoriteRestaurant(resId) {
    const user = this.getCurrentUser();
    if (!user) return false;
    const idx = user.favoriteRestaurantIds.indexOf(resId);
    let isFav = false;
    if (idx > -1) {
      user.favoriteRestaurantIds.splice(idx, 1);
      isFav = false;
    } else {
      user.favoriteRestaurantIds.push(resId);
      isFav = true;
    }
    this.syncToGlobals();
    this.save('toggle_favorite_restaurant');
    return isFav;
  },

  async checkServerUpdates() {
    if (!this.hasBackendApi && !this.apiBaseUrl) return false;
    try {
      const endpoint = this.apiBaseUrl ? `${this.apiBaseUrl}/api/database` : './api/database';
      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) return false;
      const remote = await res.json();
      if (!remote || !remote.meta || !remote.items) return false;
      const currentUpdated = this.data && this.data.meta && this.data.meta.updatedAt ? new Date(this.data.meta.updatedAt).getTime() : 0;
      const remoteUpdated = remote.meta.updatedAt ? new Date(remote.meta.updatedAt).getTime() : 0;
      const currentItemsCount = this.data && Array.isArray(this.data.items) ? this.data.items.length : 0;
      const remoteItemsCount = Array.isArray(remote.items) ? remote.items.length : 0;

      // Nếu server có dữ liệu mới hơn hoặc số lượng món khác biệt (được sửa từ tab/cách mở khác)
      if (remoteUpdated > currentUpdated || (remoteUpdated === currentUpdated && remoteItemsCount !== currentItemsCount) || (remoteItemsCount > currentItemsCount)) {
        this.data = remote;
        try { localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(remote, null, 2)); } catch (_) {}
        this.syncToGlobals();
        if (typeof window.renderFoodItems === 'function') {
          window.renderFoodItems();
        }
        if (typeof window.renderCategoriesNav === 'function') {
          window.renderCategoriesNav();
        }
        if (typeof window.renderRestaurantsSection === 'function') {
          window.renderRestaurantsSection();
        }
        if (typeof window.refreshDbmView === 'function') {
          window.refreshDbmView();
        }
        console.log('🔄 Đã tự động cập nhật database mới nhất từ máy chủ (Focus sync)!');
        return true;
      }
    } catch (_) {}
    return false;
  }
};

// Tự động kiểm tra và đồng bộ database mới nhất khi người dùng chuyển lại tab (Focus) hoặc tab khác sửa LocalStorage
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  let focusSyncTimer = null;
  window.addEventListener('focus', () => {
    if (focusSyncTimer) clearTimeout(focusSyncTimer);
    focusSyncTimer = setTimeout(() => {
      if (window.DB && typeof window.DB.checkServerUpdates === 'function') {
        window.DB.checkServerUpdates();
      }
    }, 300);
  });

  window.addEventListener('storage', (e) => {
    if (e.key === DB_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.items && window.DB) {
          window.DB.data = parsed;
          window.DB.syncToGlobals();
          if (typeof window.renderFoodItems === 'function') window.renderFoodItems();
          if (typeof window.renderCategoriesNav === 'function') window.renderCategoriesNav();
          if (typeof window.renderRestaurantsSection === 'function') window.renderRestaurantsSection();
          if (typeof window.refreshDbmView === 'function') window.refreshDbmView();
        }
      } catch (_) {}
    }
  });
}

