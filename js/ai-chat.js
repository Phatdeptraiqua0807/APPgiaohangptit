/* ==========================================================================
   ptitngon - AI Culinary & Catalog Assistant (js/ai-chat.js)
   - Kết nối trực tiếp API thực tế (Google Gemini, OpenAI, Groq, OpenRouter, Custom Endpoint)
   - Tích hợp AI Nội bộ thông minh (hoạt động tức thì ngay cả khi chưa nhập API Key)
   - Đọc toàn bộ Bảng mặt hàng (Items), Danh mục (Categories), Cửa hàng (Restaurants),
     Giỏ hàng hiện tại & Lịch sử các mặt hàng người dùng ĐÃ ĐẶT (Orders)
   - Gợi ý trực quan bằng Thẻ Món Ăn tương tác ngay trong khung chat + Gợi ý Prompt
   ========================================================================== */

const AI_CONFIG_STORAGE_KEY = 'ptitngon_ai_config_v1';
const AI_PROFILES_STORAGE_KEY = 'ptitngon_ai_profiles_v1';
const AI_CHATS_STORAGE_KEY = 'ptitngon_ai_chats_v1';
const LOCAL_PROXY_DEFAULT_ORIGIN = 'http://localhost:3000';

// Gợi ý nhanh tính cách / vai trò riêng cho từng Profile AI
const AI_PERSONA_PRESET_CHIPS = [
  {
    label: '🎓 Bạn thân SV PTIT',
    prompt: 'Xưng hô gần gũi kiểu bạn bè sinh viên PTIT ("mình - cậu" hoặc "mình - bạn"), vui vẻ, ưu tiên tư vấn món ngon bổ rẻ no lâu quanh cổng trường và KTX.'
  },
  {
    label: '🥗 Chuyên gia Kcal & Gym',
    prompt: 'Đóng vai chuyên gia dinh dưỡng thể hình: luôn phân tích kỹ lượng Calo (kcal), Protein, chất xơ của từng món, nhắc nhở cân đối mục tiêu năng lượng trong ngày.'
  },
  {
    label: '💸 Thợ săn Deal tiết kiệm',
    prompt: 'Luôn ưu tiên tìm món giảm giá, quán Freeship 0đ, tính toán ghép đơn để áp được mã giảm giá hời nhất cho khách hàng.'
  },
  {
    label: '⚡ Ngắn gọn súc tích',
    prompt: 'Trả lời cực kỳ ngắn gọn, đi thẳng vào trọng tâm bằng gạch đầu dòng (tên món, giá tiền, điểm nổi bật), không dài dòng.'
  }
];

const AI_PROVIDER_PRESETS = {
  gemini: {
    name: 'Google Gemini API',
    badge: 'Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.1-flash-live-preview', 'gemini-1.5-flash', 'gemini-2.5-pro'],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    keyPlaceholder: 'AIzaSy... (Nhập Gemini API Key từ Google AI Studio)',
    helpText: '⚡ Trực tiếp 100% trên trình duyệt (Hỗ trợ cả REST generateContent & Gemini Live WebSocket bidiGenerateContent!)'
  },
  openrouter: {
    name: 'OpenRouter (Đa Model: DeepSeek, Llama, GPT...)',
    badge: 'OpenRouter',
    defaultModel: 'deepseek/deepseek-chat',
    models: [
      'deepseek/deepseek-chat',
      'deepseek/deepseek-r1',
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'openai/gpt-4o-mini'
    ],
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    keyPlaceholder: 'sk-or-v1-... (Nhập OpenRouter API Key)',
    helpText: '⚡ Trực tiếp trên trình duyệt! Dùng được cả DeepSeek V3/R1 mà không lo bị chặn CORS'
  },
  deepseek: {
    name: 'DeepSeek API (Trực tiếp)',
    badge: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    endpoint: 'https://api.deepseek.com/chat/completions',
    keyPlaceholder: 'sk-... (Nhập DeepSeek API Key từ platform.deepseek.com)',
    helpText: 'Tự động vượt CORS qua Cloud Proxy (không cần chạy server thủ công)'
  },
  openai: {
    name: 'OpenAI (ChatGPT)',
    badge: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    endpoint: 'https://api.openai.com/v1/chat/completions',
    keyPlaceholder: 'sk-proj-... (Nhập OpenAI API Key)',
    helpText: 'Chuẩn OpenAI Chat Completions API'
  },
  groq: {
    name: 'Groq Cloud (Siêu tốc)',
    badge: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    keyPlaceholder: 'gsk_... (Nhập Groq API Key)',
    helpText: 'Tốc độ phản hồi cực nhanh, có gói miễn phí tại console.groq.com'
  },
  nvidia: {
    name: 'NVIDIA NIM (integrate.api.nvidia.com)',
    badge: 'NVIDIA',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    models: [
      'meta/llama-3.3-70b-instruct',
      'deepseek-ai/deepseek-r1',
      'deepseek-ai/deepseek-v3',
      'meta/llama-3.1-405b-instruct',
      'mistralai/mistral-large-2-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct'
    ],
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    keyPlaceholder: 'nvapi-... (Nhập NVIDIA API Key từ build.nvidia.com)',
    helpText: '⚡ Chạy kèm start-server.bat để vượt tường lửa CORS của NVIDIA (bảo mật tối đa)'
  },
  custom: {
    name: 'Custom API / Local LLM (Ollama, LM Studio, vLLM...)',
    badge: 'Custom API',
    defaultModel: 'qwen2.5:7b',
    models: ['qwen2.5:7b', 'llama3.2', 'deepseek-chat'],
    endpoint: 'http://localhost:11434/v1/chat/completions',
    keyPlaceholder: 'Tùy chọn (Để trống nếu chạy Ollama / LM Studio nội bộ)',
    helpText: 'Tương thích mọi chuẩn OpenAI-compatible (/v1/chat/completions)'
  }
};

// Danh sách thẻ Prompt gợi ý món ăn trực quan trên màn hình chào mừng Chat AI
const AI_WELCOME_PROMPT_CARDS = [
  {
    icon: '🔥',
    tag: 'Tiết kiệm',
    title: 'Món ngon quanh PTIT dưới 40K',
    desc: 'Tìm các món no bụng, đánh giá cao, giá sinh viên',
    prompt: 'Gợi ý cho mình các món ăn no bụng, ngon rẻ quanh PTIT giá dưới 40.000đ đang còn hàng!'
  },
  {
    icon: '🧾',
    tag: 'Cá nhân hóa',
    title: 'Dựa trên món mình đã đặt',
    desc: 'Đọc lịch sử đơn đã đặt & gợi ý món hợp gu',
    prompt: 'Hãy xem những mặt hàng mình đã đặt trước đây và gợi ý các món tương tự hoặc hợp khẩu vị của mình nhé!'
  },
  {
    icon: '🚚',
    tag: 'Giao nhanh 0đ',
    title: 'Quán Freeship 0đ gần nhất',
    desc: 'Ưu tiên quán sát trường giao nhanh 15 phút',
    prompt: 'Gợi ý những món ăn nổi bật thuộc các quán Freeship 0đ và ở gần trường nhất!'
  },
  {
    icon: '🍱',
    tag: 'Combo 2 món',
    title: 'Combo Ăn trưa + Trà sữa/Cà phê',
    desc: 'Ghép 1 món chính + 1 đồ uống siêu hời',
    prompt: 'Thiết kế giúp mình một combo ăn trưa gồm 1 món chính + 1 đồ uống (trà sữa hoặc cà phê) tổng khoảng 65.000đ - 85.000đ!'
  },
  {
    icon: '🌶️',
    tag: 'Cơn thèm',
    title: 'Món cay nóng / Chiên giòn KTX',
    desc: 'Đồ chiên giòn rụm, cay tê ăn xế hoặc ăn đêm',
    prompt: 'Mình đang thèm món gì chiên giòn rụm hoặc cay cay nóng hổi để ăn ở KTX, gợi ý giúp mình nhé!'
  },
  {
    icon: '🥗',
    tag: 'Healthy',
    title: 'Món thanh đạm, ít dầu mỡ',
    desc: 'Gỏi cuốn, bún, phở, salad tươi mát nhẹ bụng',
    prompt: 'Tư vấn cho mình những món thanh đạm, nhiều rau tươi, ít dầu mỡ trong bảng hàng!'
  },
  {
    icon: '🧋',
    tag: 'Giải khát',
    title: 'Top Trà sữa, Cà phê & Tráng miệng',
    desc: 'Đồ uống học bài xuyên đêm & ăn vặt chiều',
    prompt: 'Cho mình xem các món trà sữa, cà phê và chè tráng miệng ngon nhất trong bảng hàng hiện tại!'
  },
  {
    icon: '📊',
    tag: 'Bảng hàng',
    title: 'Tra cứu toàn bộ bảng mặt hàng',
    desc: 'Tổng hợp danh mục, tồn kho & tầm giá hệ thống',
    prompt: 'Hãy đọc toàn bộ bảng hàng hiện tại và tóm tắt số lượng mặt hàng, các danh mục, mức giá và các món tiêu biểu nhất!'
  }
];

// Thanh chip gợi ý nhanh luôn hiển thị phía trên ô nhập tin nhắn
const AI_QUICK_BAR_PROMPTS = [
  { label: '🔥 Dưới 40K', prompt: 'Gợi ý các món ăn ngon giá dưới 40.000đ đang còn hàng' },
  { label: '🧾 Món mình đã đặt', prompt: 'Kiểm tra các đơn hàng và mặt hàng mình đã đặt rồi gợi ý món hợp gu' },
  { label: '🚚 Freeship 0đ', prompt: 'Những món nào thuộc quán Freeship 0đ giao nhanh nhất?' },
  { label: '🍱 Ghép Combo', prompt: 'Gợi ý combo 1 món ăn chính + 1 đồ uống tiết kiệm nhất' },
  { label: '🍗 Món chiên giòn', prompt: 'Tìm các món chiên giòn, gà rán, Hùng chiên giòn ngon nhất' },
  { label: '🍜 Phở & Bún nóng', prompt: 'Gợi ý các món nước nóng hổi như Phở, Bún bò Huế, Bún chả' },
  { label: '🧋 Đồ uống & Chè', prompt: 'Gợi ý trà sữa, cà phê và đồ tráng miệng giải nhiệt' },
  { label: '🛒 Tư vấn giỏ hàng', prompt: 'Xem giỏ hàng hiện tại của mình và tư vấn mã giảm giá tốt nhất' }
];

// ── Trạng thái phiên làm việc Chat AI ──
let aiConfig = loadAIConfig();
let aiProfilesState = loadAIProfilesState();
let aiChatHistories = loadAIChatHistories();
let aiIsGenerating = false;
let aiCurrentAbortController = null;
let activeLiveWS = null;
let aiDraftInput = '';
let tempModalProvider = aiConfig.provider || 'gemini';
let tempShowApiKey = false;
let tempModalDraft = null;
let localProxyStatus = { checked: false, online: false, baseUrl: LOCAL_PROXY_DEFAULT_ORIGIN };

// Trạng thái trình duyệt danh sách tất cả Model thực tế từ API (/models)
const aiModelsListCache = new Map();
let aiModelsExplorerState = {
  open: false,
  loading: false,
  error: '',
  sourceUrl: '',
  viaProxy: false,
  models: [],
  searchQuery: '',
  filterMode: 'all'
};

// Đồng bộ danh sách Profile AI từ ổ đĩa (ai-profiles.json qua server.js) khi khởi động
setTimeout(() => {
  syncAIProfilesFromServer();
}, 120);

// Trạng thái hiển thị tiến trình AI Đa Giai Đoạn & Bộ nhớ đệm mặt hàng tải từ Server
let aiLiveProgressText = '';
let aiLiveStageLogs = [];
const aiHydratedItemsCache = new Map();

function getCatalogItemSmart(itemId) {
  if (!itemId) return null;
  const cached = aiHydratedItemsCache.get(String(itemId));
  if (cached) return cached;
  if (typeof DB !== 'undefined' && DB.isReady) {
    return DB.getItemById(itemId);
  }
  return null;
}

function cacheServerCatalogItems(itemsList) {
  if (!Array.isArray(itemsList)) return;
  itemsList.forEach(it => {
    if (it && it.id) {
      aiHydratedItemsCache.set(String(it.id), it);
    }
  });
}

// ── Hành trình suy luận của AI (Reasoning): mỗi bước hiện ra mượt, cách nhau tối thiểu 700ms ──
const AI_REASONING_MIN_GAP_MS = 700;
let aiReasoningLastShownAt = 0;

const AI_TOOL_FRIENDLY_LABELS = {
  search_items: 'Đang tìm kiếm các mặt hàng phù hợp',
  get_catalog_overview: 'Đang xem qua thực đơn',
  get_item_details: 'Đang xem chi tiết món ăn',
  search_stores: 'Đang tìm quán phù hợp',
  get_user_context: 'Đang xem giỏ hàng và đơn cũ của bạn',
  cart_action: 'Đang cập nhật giỏ hàng của bạn',
  checkout_action: 'Đang tiến hành đặt đơn và thanh toán',
  track_order: 'Đang tra cứu hành trình di chuyển đơn hàng',
  order_action: 'Đang xử lý tương tác đơn hàng',
  user_profile_action: 'Đang kiểm tra hồ sơ và cài đặt'
};

const AI_ACTION_TOOLS = new Set(['cart_action', 'checkout_action', 'order_action']);
function isActionTool(toolName, params = {}) {
  if (toolName === 'user_profile_action' && params && params.action === 'update') return true;
  return AI_ACTION_TOOLS.has(String(toolName || '').trim());
}

function getAIToolFriendlyLabel(toolName) {
  return AI_TOOL_FRIENDLY_LABELS[toolName] || (isActionTool(toolName) ? 'Đang thực hiện công việc cho bạn' : 'Đang xử lý yêu cầu');
}

// ── Aura Halo nền khi AI suy luận ──
// - 2 giai đoạn màu sắc tách biệt để không bị rối:
//   + Giai đoạn 1 (phase="1"): Xanh lá ngọc & Xanh dương
//   + Giai đoạn 2 (phase="2"): Tím, Hồng & Màu be (Beige ấm)
// - Giữ DOM cố định để fade-in / fade-out luôn mượt mà (bấm Dừng chỉ fade-out nhanh hơn 1 xíu)
let aiAuraStoppedByUser = false;
let aiAuraPhaseTimer = null;

function ensureAIAuraElement() {
  if (typeof document === 'undefined' || !document.body) return null;
  let el = document.getElementById('ai-aura');
  if (!el) {
    el = document.createElement('div');
    el.className = 'ai-aura';
    el.id = 'ai-aura';
    el.dataset.state = 'idle';
    el.dataset.phase = '1';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="ai-aura-palette p1">
        <span class="ai-aura-wave w1"></span>
        <span class="ai-aura-wave w2"></span>
        <span class="ai-aura-wave w3"></span>
        <span class="ai-aura-wave w4"></span>
        <span class="ai-aura-wave w5"></span>
        <span class="ai-aura-wave w6"></span>
        <span class="ai-aura-wave w7"></span>
        <span class="ai-aura-wave w8"></span>
        <span class="ai-aura-wave w9"></span>
      </div>
      <div class="ai-aura-palette p2">
        <span class="ai-aura-wave w1"></span>
        <span class="ai-aura-wave w2"></span>
        <span class="ai-aura-wave w3"></span>
        <span class="ai-aura-wave w4"></span>
        <span class="ai-aura-wave w5"></span>
        <span class="ai-aura-wave w6"></span>
        <span class="ai-aura-wave w7"></span>
        <span class="ai-aura-wave w8"></span>
        <span class="ai-aura-wave w9"></span>
      </div>
    `;
    document.body.appendChild(el);
  }
  return el;
}

function setAIAuraPhase(phase) {
  const el = ensureAIAuraElement();
  if (el) el.dataset.phase = String(phase);
}

function startAIAura() {
  aiAuraStoppedByUser = false;
  clearInterval(aiAuraPhaseTimer);
  const el = ensureAIAuraElement();
  if (!el) return;
  el.dataset.phase = '1';

  // Tỉ lệ 30% có 1 bong bóng di chuyển theo đồ thị hình sin LỚN DẦN (growing sine wave)
  const isGrowing = Math.random() < 0.3;
  el.dataset.growth = isGrowing ? 'growing' : 'normal';

  // Đảm bảo browser đã paint trạng thái ẩn trước khi kích hoạt transition fade-in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (aiIsGenerating) {
        el.dataset.state = 'active';
      }
    });
  });
  // Luân chuyển êm dịu giữa 2 giai đoạn bảng màu (chu kỳ 4.8s kết hợp cross-fade 2.2s)
  aiAuraPhaseTimer = setInterval(() => {
    if (!aiIsGenerating) {
      clearInterval(aiAuraPhaseTimer);
      return;
    }
    const curr = el.dataset.phase === '2' ? '1' : '2';
    el.dataset.phase = curr;
  }, 4800);
}

function stopAIAura(isQuickStop = false) {
  clearInterval(aiAuraPhaseTimer);
  aiAuraPhaseTimer = null;
  const el = ensureAIAuraElement();
  if (!el) return;
  if (isQuickStop) {
    aiAuraStoppedByUser = true;
    el.dataset.state = 'stopping';
  } else if (!aiAuraStoppedByUser) {
    el.dataset.state = 'idle';
  }
}

function renderAIAuraLayer() {
  ensureAIAuraElement();
  return '';
}

async function setAILiveStageProgress(statusText) {
  const text = String(statusText || '').trim();
  if (!text || text === aiLiveProgressText) return;

  const wait = AI_REASONING_MIN_GAP_MS - (Date.now() - aiReasoningLastShownAt);
  if (aiReasoningLastShownAt && wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }

  if (aiLiveProgressText) aiLiveStageLogs.push(aiLiveProgressText);
  aiLiveProgressText = text;
  aiReasoningLastShownAt = Date.now();
  // Chuyển ngay sang giai đoạn màu 2 (Tím, Hồng, Màu be) khi sang bước suy luận tiếp theo
  setAIAuraPhase('2');

  const listEl = document.getElementById('ai-reasoning-list');
  if (listEl) {
    listEl.querySelectorAll('.ai-reason-step.active').forEach(el => {
      el.classList.remove('active');
      el.classList.add('done');
    });
    const row = document.createElement('div');
    row.className = 'ai-reason-step active';
    row.textContent = text;
    listEl.appendChild(row);
    if (typeof updateAITurnSpacerHeight === 'function') {
      updateAITurnSpacerHeight();
    }
  }
}

function normalizeOpenAICompatibleEndpoint(rawUrl, provider = '') {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (provider === 'gemini' || trimmed.includes('generativelanguage.googleapis.com') || trimmed.includes(':generateContent')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/+$/, '');
    if (pathname === '' || pathname === '/') {
      parsed.pathname = parsed.hostname.includes('deepseek.com')
        ? '/chat/completions'
        : '/v1/chat/completions';
      return parsed.toString();
    }
    if (pathname === '/v1' || pathname === '/api/v1' || pathname === '/openai/v1') {
      parsed.pathname = `${pathname}/chat/completions`;
      return parsed.toString();
    }
  } catch (_) { }
  return trimmed;
}

function getCandidateProxyOrigins() {
  const origins = [];
  if (typeof DB !== 'undefined' && DB.apiBaseUrl) {
    origins.push(DB.apiBaseUrl);
  }
  if (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    origins.push(window.location.origin);
  }
  if (!origins.includes(LOCAL_PROXY_DEFAULT_ORIGIN)) {
    origins.push(LOCAL_PROXY_DEFAULT_ORIGIN);
  }
  if (!origins.includes('http://127.0.0.1:3000')) {
    origins.push('http://127.0.0.1:3000');
  }
  return origins;
}

async function checkLocalProxyHealth() {
  for (const origin of getCandidateProxyOrigins()) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(`${origin}/api/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.service === 'ptitngon-local-proxy') {
          localProxyStatus = { checked: true, online: true, baseUrl: origin };
          return localProxyStatus;
        }
      }
    } catch (_) { }
  }
  localProxyStatus = { checked: true, online: false, baseUrl: LOCAL_PROXY_DEFAULT_ORIGIN };
  return localProxyStatus;
}

async function fetchServerCatalogEndpoint(subpath, method = 'POST', payload = null) {
  const originsToTry = localProxyStatus.online
    ? [localProxyStatus.baseUrl, ...getCandidateProxyOrigins().filter(o => o !== localProxyStatus.baseUrl)]
    : getCandidateProxyOrigins();

  for (const origin of originsToTry) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${origin}${subpath}`, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' && payload ? JSON.stringify(payload) : undefined,
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        localProxyStatus = { checked: true, online: true, baseUrl: origin };
        return { ok: true, data, origin };
      }
    } catch (_) { }
  }
  return { ok: false, data: null, origin: null };
}

async function fetchViaLocalProxyOrDirect(targetUrl, provider, headers, bodyObj, stageLabel = '', httpMethod = 'POST', customUseProxy = null) {
  const method = String(httpMethod || 'POST').toUpperCase();
  const shouldUseProxy = typeof customUseProxy === 'boolean'
    ? customUseProxy
    : (aiConfig.useLocalProxy !== false);

  const abortSignal = aiCurrentAbortController ? aiCurrentAbortController.signal : undefined;
  const isCorsRestricted = /nvidia\.com|deepseek\.com|openai\.com|anthropic\.com/i.test(targetUrl);

  // 1. Kiểm tra và ưu tiên dùng Local Proxy Server (/api/ai-proxy) để tránh bị chặn CORS
  if (shouldUseProxy) {
    // Nếu chưa kiểm tra hoặc endpoint bị chặn CORS thì chủ động thăm dò server
    if (!localProxyStatus.checked || (isCorsRestricted && !localProxyStatus.online)) {
      await checkLocalProxyHealth();
    }

    if (localProxyStatus.online) {
      const originsToTry = [localProxyStatus.baseUrl, ...getCandidateProxyOrigins().filter(o => o !== localProxyStatus.baseUrl)];
      for (const origin of originsToTry) {
        try {
          const proxyRes = await fetch(`${origin}/api/ai-proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortSignal,
            body: JSON.stringify({
              targetUrl,
              provider,
              stage: stageLabel,
              method,
              headers,
              body: method === 'GET' ? undefined : bodyObj
            })
          });
          const normalizedHeader = proxyRes.headers.get('X-Proxy-Normalized-Url');
          if (!normalizedHeader && (proxyRes.status === 404 || proxyRes.status === 405)) {
            continue;
          }
          localProxyStatus = { checked: true, online: true, baseUrl: origin };
          return { res: proxyRes, viaProxy: true, proxyType: 'local' };
        } catch (_) {
          continue;
        }
      }
    }
  }

  // 2. Thử gọi trực tiếp từ trình duyệt (Google Gemini, OpenRouter, Custom API nội bộ hoạt động 100% không bị CORS)
  try {
    const directRes = await fetch(targetUrl, {
      method,
      headers,
      signal: abortSignal,
      body: method === 'GET' ? undefined : JSON.stringify(bodyObj)
    });
    return { res: directRes, viaProxy: false };
  } catch (directErr) {
    if (directErr.name === 'AbortError' || abortSignal?.aborted) {
      throw directErr;
    }

    // 3. Nếu trình duyệt chặn CORS (như khi gọi thẳng api.deepseek.com hoặc nvidia.com mà chưa chạy local server):
    // Thử chuyển tiếp qua Cloud CORS Gateway công khai
    try {
      const cloudProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
      const cloudRes = await fetch(cloudProxyUrl, {
        method,
        headers,
        signal: abortSignal,
        body: method === 'GET' ? undefined : JSON.stringify(bodyObj)
      });
      if (cloudRes.ok) {
        return { res: cloudRes, viaProxy: true, proxyType: 'cloud' };
      }
    } catch (_) { }

    let hostLabel = targetUrl;
    try {
      hostLabel = new URL(targetUrl).hostname;
    } catch (_) { }

    if (/nvidia\.com/i.test(targetUrl)) {
      throw new Error(
        `NVIDIA NIM (${hostLabel}) chặn gọi trực tiếp từ trình duyệt web (CORS Policy). Để kết nối NVIDIA thành công, bạn chỉ cần mở file "start-server.bat" (cổng 3000) để máy chủ tự động chuyển tiếp an toàn!`
      );
    }

    if (/deepseek\.com/i.test(targetUrl)) {
      throw new Error(
        `DeepSeek API (${hostLabel}) chặn gọi trực tiếp từ trình duyệt (CORS). Bạn hãy chạy "start-server.bat" hoặc dùng OpenRouter để gọi DeepSeek V3/R1 trực tiếp 100% không cần server!`
      );
    }

    throw new Error(
      `Không thể kết nối tới "${hostLabel}" (${directErr.message}). Mẹo tiện nhất: Hãy dùng Google Gemini hoặc OpenRouter (chạy trực tiếp 100% trên trình duyệt mà không cần cài đặt hay chạy server)!`
    );
  }
}

function loadAIConfig() {
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const prov = parsed.provider || 'gemini';
      return {
        profileId: parsed.profileId || '',
        profileName: parsed.profileName || '',
        provider: prov,
        apiKey: parsed.apiKey || '',
        model: parsed.model || AI_PROVIDER_PRESETS[prov]?.defaultModel || 'gemini-2.5-flash',
        endpoint: normalizeOpenAICompatibleEndpoint(
          parsed.endpoint || AI_PROVIDER_PRESETS[prov]?.endpoint || AI_PROVIDER_PRESETS.gemini.endpoint,
          prov
        ),
        customPrompt: parsed.customPrompt || '',
        useLocalProxy: parsed.useLocalProxy !== false,
        autoFallbackLocal: parsed.autoFallbackLocal !== false
      };
    }
  } catch (_) { }
  return {
    profileId: '',
    profileName: '',
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
    endpoint: AI_PROVIDER_PRESETS.gemini.endpoint,
    customPrompt: '',
    useLocalProxy: true,
    autoFallbackLocal: true
  };
}

function saveAIConfigToStorage() {
  try {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(aiConfig));
  } catch (_) { }
}

function maskApiKey(rawKey) {
  const k = String(rawKey || '').trim();
  if (!k) return 'Không cần Key';
  if (k.length <= 8) return `${k.slice(0, 2)}••••${k.slice(-2)}`;
  return `${k.slice(0, 5)}••••${k.slice(-4)}`;
}

function defaultProfileNameForConfig(cfg) {
  const preset = AI_PROVIDER_PRESETS[cfg.provider] || AI_PROVIDER_PRESETS.gemini;
  return `${preset.badge} • ${cfg.model || preset.defaultModel}`;
}

function normalizeSavedProfileItem(item) {
  if (!item || typeof item !== 'object') return null;
  const prov = AI_PROVIDER_PRESETS[item.provider] ? item.provider : 'gemini';
  const preset = AI_PROVIDER_PRESETS[prov];
  const model = String(item.model || preset.defaultModel).trim() || preset.defaultModel;
  const id = String(item.id || item.profileId || `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const profileName = String(item.profileName || item.name || '').trim() || `${preset.badge} • ${model}`;
  return {
    id,
    profileId: id,
    profileName,
    provider: prov,
    apiKey: String(item.apiKey || '').trim(),
    model,
    endpoint: normalizeOpenAICompatibleEndpoint(item.endpoint || preset.endpoint, prov),
    customPrompt: String(item.customPrompt || '').trim(),
    useLocalProxy: item.useLocalProxy !== false,
    autoFallbackLocal: item.autoFallbackLocal !== false,
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function loadAIProfilesState() {
  let state = { activeProfileId: null, profiles: [], updatedAt: null };
  try {
    const raw = localStorage.getItem(AI_PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.profiles)) {
        state = {
          activeProfileId: parsed.activeProfileId || null,
          profiles: parsed.profiles.map(normalizeSavedProfileItem).filter(Boolean),
          updatedAt: parsed.updatedAt || null
        };
      }
    }
  } catch (_) { }

  // Tự động tạo Profile đầu tiên từ cấu hình API hiện có nếu danh sách đang rỗng
  const hasExistingApi = (aiConfig.provider === 'custom' && aiConfig.endpoint && aiConfig.endpoint.trim())
    || Boolean(aiConfig.apiKey && aiConfig.apiKey.trim().length > 5);

  if (state.profiles.length === 0 && hasExistingApi) {
    const migratedId = aiConfig.profileId || `prof_${Date.now()}`;
    const migratedName = aiConfig.profileName || defaultProfileNameForConfig(aiConfig);
    const migratedProf = normalizeSavedProfileItem({
      ...aiConfig,
      id: migratedId,
      profileName: migratedName,
      updatedAt: new Date().toISOString()
    });
    if (migratedProf) {
      state.profiles.push(migratedProf);
      state.activeProfileId = migratedProf.id;
      state.updatedAt = migratedProf.updatedAt;
      aiConfig.profileId = migratedProf.id;
      aiConfig.profileName = migratedProf.profileName;
      saveAIConfigToStorage();
      try {
        localStorage.setItem(AI_PROFILES_STORAGE_KEY, JSON.stringify(state));
      } catch (_) { }
    }
  }
  return state;
}

function saveAIProfilesState(syncToServer = true) {
  aiProfilesState.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(AI_PROFILES_STORAGE_KEY, JSON.stringify(aiProfilesState));
  } catch (_) { }

  if (syncToServer) {
    fetchServerCatalogEndpoint('/api/ai-profiles', 'POST', aiProfilesState).catch(() => { });
  }
}

async function syncAIProfilesFromServer() {
  const res = await fetchServerCatalogEndpoint('/api/ai-profiles', 'GET');
  if (!res.ok || !res.data || !Array.isArray(res.data.profiles)) return;

  const serverProfiles = res.data.profiles.map(normalizeSavedProfileItem).filter(Boolean);
  if (serverProfiles.length === 0) {
    // Nếu trên server chưa có nhưng trình duyệt đã có Profile -> đẩy lên lưu vào ai-profiles.json
    if (aiProfilesState.profiles.length > 0) {
      fetchServerCatalogEndpoint('/api/ai-profiles', 'POST', aiProfilesState).catch(() => { });
    }
    return;
  }

  // Hợp nhất Profile từ Server & Trình duyệt theo ID (ưu tiên bản mới hơn theo updatedAt)
  const mergedMap = new Map();
  aiProfilesState.profiles.forEach(p => mergedMap.set(p.id, p));
  serverProfiles.forEach(sp => {
    const localP = mergedMap.get(sp.id);
    if (!localP) {
      mergedMap.set(sp.id, sp);
    } else {
      const tServer = Date.parse(sp.updatedAt || '') || 0;
      const tLocal = Date.parse(localP.updatedAt || '') || 0;
      if (tServer >= tLocal) mergedMap.set(sp.id, sp);
    }
  });

  aiProfilesState.profiles = Array.from(mergedMap.values());
  if (!aiProfilesState.activeProfileId && res.data.activeProfileId) {
    aiProfilesState.activeProfileId = res.data.activeProfileId;
  }

  // Nếu trình duyệt chưa có cấu hình API nhưng có activeProfile từ Server -> tự động nạp luôn
  if (!isExternalAPIConfigured() && aiProfilesState.activeProfileId) {
    const activeProf = aiProfilesState.profiles.find(p => p.id === aiProfilesState.activeProfileId);
    if (activeProf) {
      applyProfileToActiveAIConfig(activeProf);
    }
  } else if (aiConfig.profileId) {
    const matched = aiProfilesState.profiles.find(p => p.id === aiConfig.profileId);
    if (matched) {
      applyProfileToActiveAIConfig(matched);
    }
  }

  saveAIProfilesState(false);
  updateGlobalAIChromeStatus();
}

function applyProfileToActiveAIConfig(prof) {
  if (!prof) return;
  aiConfig = {
    profileId: prof.id,
    profileName: prof.profileName,
    provider: prof.provider,
    apiKey: prof.apiKey || '',
    model: prof.model,
    endpoint: prof.endpoint,
    customPrompt: prof.customPrompt || '',
    useLocalProxy: prof.useLocalProxy !== false,
    autoFallbackLocal: prof.autoFallbackLocal !== false
  };
  saveAIConfigToStorage();
}

function upsertProfileFromConfig(cfg, forceNew = false) {
  const preset = AI_PROVIDER_PRESETS[cfg.provider] || AI_PROVIDER_PRESETS.gemini;
  const cleanName = String(cfg.profileName || '').trim() || defaultProfileNameForConfig(cfg);
  const targetProfId = String(cfg.profileId || cfg.id || '').trim();
  const existingIdx = !forceNew && targetProfId
    ? aiProfilesState.profiles.findIndex(p => String(p.id) === targetProfId)
    : -1;

  const targetId = existingIdx >= 0
    ? aiProfilesState.profiles[existingIdx].id
    : `prof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const savedObj = normalizeSavedProfileItem({
    id: targetId,
    profileId: targetId,
    profileName: cleanName,
    provider: cfg.provider,
    apiKey: cfg.apiKey || '',
    model: cfg.model || preset.defaultModel,
    endpoint: cfg.endpoint || preset.endpoint,
    customPrompt: cfg.customPrompt || '',
    useLocalProxy: cfg.useLocalProxy !== false,
    autoFallbackLocal: cfg.autoFallbackLocal !== false,
    createdAt: (existingIdx >= 0 && aiProfilesState.profiles[existingIdx]?.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (existingIdx >= 0) {
    aiProfilesState.profiles[existingIdx] = savedObj;
  } else {
    aiProfilesState.profiles.unshift(savedObj);
  }

  aiProfilesState.activeProfileId = savedObj.id;
  applyProfileToActiveAIConfig(savedObj);
  saveAIProfilesState(true);
  return savedObj;
}

function updateGlobalAIChromeStatus() {
  const apiConnected = isExternalAPIConfigured();
  const providerInfo = AI_PROVIDER_PRESETS[aiConfig.provider] || AI_PROVIDER_PRESETS.gemini;
  const displayProfLabel = (aiConfig.profileName || '').trim()
    ? `${aiConfig.profileName}`
    : `${providerInfo.badge} (${aiConfig.model})`;
  const apiStatusText = apiConnected
    ? ` ${displayProfLabel}`
    : `⚡ AI Thông minh • Quản lý Profile`;

  // Cập nhật tất cả nút trạng thái AI trong header (Chat AI, Dish Detail, v.v.)
  document.querySelectorAll('.ai-api-status-btn').forEach(btn => {
    btn.classList.toggle('connected', apiConnected);
    const label = btn.querySelector('.ai-api-btn-label');
    if (label) {
      if (btn.classList.contains('compact')) {
        label.textContent = apiConnected ? 'API Đã nối' : 'Cấu hình API';
      } else {
        label.textContent = apiStatusText;
      }
    }
  });

  // Cập nhật chấm online
  document.querySelectorAll('.ai-online-dot').forEach(dot => {
    dot.className = `ai-online-dot ${apiConnected ? 'api-live' : 'local-smart'}`;
  });
}

function updateAISettingsSheetInPlace(targetProf, bannerHtml = '') {
  const sheet = document.getElementById('modal-bottom-sheet');
  if (!sheet) return;

  const apiActive = isExternalAPIConfigured();

  // 1. Cập nhật banner thông báo
  let bannerEl = sheet.querySelector('.ai-test-banner');
  if (bannerHtml) {
    if (bannerEl) {
      bannerEl.outerHTML = bannerHtml;
    } else {
      const body = sheet.querySelector('.delivery-modal-body');
      if (body) {
        const temp = document.createElement('div');
        temp.innerHTML = bannerHtml;
        const newBanner = temp.firstElementChild;
        if (newBanner) {
          const proxyBadge = body.querySelector('.ai-proxy-status-card, .ai-proxy-status-badge');
          if (proxyBadge) {
            proxyBadge.insertAdjacentElement('afterend', newBanner);
          } else {
            body.insertAdjacentElement('afterbegin', newBanner);
          }
        }
      }
    }
  }

  // 2. Cập nhật thẻ trạng thái Profile đang dùng (.ai-active-profile-card)
  const activeCardMain = sheet.querySelector('.ai-active-profile-card .ai-active-card-main');
  if (activeCardMain) {
    if (apiActive && targetProf) {
      const pPreset = AI_PROVIDER_PRESETS[aiConfig.provider] || AI_PROVIDER_PRESETS.gemini;
      activeCardMain.innerHTML = `
        <div class="ai-active-card-icon">🤖</div>
        <div class="ai-active-card-details">
          <div class="ai-active-card-name">
            <span>${escapeHtml(aiConfig.profileName || defaultProfileNameForConfig(aiConfig))}</span>
            <span class="ai-prof-active-pill"> Đang sử dụng</span>
          </div>
          <div class="ai-active-card-sub">
            ${escapeHtml(pPreset.badge || aiConfig.provider)} • <strong>${escapeHtml(aiConfig.model)}</strong> • Key: ${escapeHtml(maskApiKey(aiConfig.apiKey))}
          </div>
        </div>
      `;
    } else {
      activeCardMain.innerHTML = `
        <div class="ai-active-card-icon local">${FluentIcons.flashFilled}</div>
        <div class="ai-active-card-details">
          <div class="ai-active-card-name">
            <span>AI Thông minh Nội bộ</span>
            <span class="ai-prof-active-pill"> Đang sử dụng</span>
          </div>
          <div class="ai-active-card-sub">
            Tự động phân tích món ăn quanh PTIT, giỏ hàng & đơn cũ • Hoàn toàn miễn phí
          </div>
        </div>
      `;
    }
  }

  // 3. Cập nhật dòng chuyển đổi nhanh AI Nội bộ (.ai-profile-quick-switch-row)
  let quickSwitchRow = sheet.querySelector('.ai-profile-quick-switch-row');
  if (apiActive) {
    if (!quickSwitchRow) {
      const activeCard = sheet.querySelector('.ai-active-profile-card');
      if (activeCard) {
        const div = document.createElement('div');
        div.className = 'ai-profile-quick-switch-row';
        div.setAttribute('role', 'button');
        div.setAttribute('tabindex', '0');
        div.onclick = () => switchActiveAIProfile('__local__', true);
        div.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') switchActiveAIProfile('__local__', true); };
        div.title = 'Chuyển ngay sang AI Nội bộ (không mất cấu hình API đã lưu)';
        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">${FluentIcons.flashFilled}</span>
            <div>
              <div style="font-size:13px; font-weight:800; color:#0f172a;">Chuyển về AI Thông minh Nội bộ</div>
              <div style="font-size:11.5px; color:#64748b;">Dùng ngay không cần API Key, các Profile đã lưu vẫn được giữ nguyên</div>
            </div>
          </div>
          <button type="button" class="ai-prof-mini-btn" onclick="event.stopPropagation(); switchActiveAIProfile('__local__', true)">Chọn dùng</button>
        `;
        activeCard.insertAdjacentElement('afterend', div);
      }
    } else {
      quickSwitchRow.style.display = 'flex';
    }
  } else if (quickSwitchRow) {
    quickSwitchRow.style.display = 'none';
  }

  // 4. Cập nhật trạng thái từng Profile trong danh sách (.ai-profiles-list)
  sheet.querySelectorAll('.ai-profile-item-card').forEach(card => {
    const cardInfo = card.querySelector('.ai-profile-card-info');
    const onclickAttr = cardInfo ? (cardInfo.getAttribute('onclick') || '') : '';
    const profIdMatch = onclickAttr.match(/switchActiveAIProfile\('([^']+)'/);
    const profId = profIdMatch ? profIdMatch[1] : null;
    const isThisActive = Boolean(apiActive && profId && profId === aiConfig.profileId);

    card.classList.toggle('active', isThisActive);
    if (cardInfo) {
      cardInfo.setAttribute('aria-pressed', isThisActive ? 'true' : 'false');
    }

    const nameEl = card.querySelector('.ai-profile-card-name');
    if (nameEl) {
      let pill = nameEl.querySelector('.ai-prof-active-pill');
      if (isThisActive && !pill) {
        const newPill = document.createElement('span');
        newPill.className = 'ai-prof-active-pill';
        newPill.textContent = ' Đang dùng';
        nameEl.appendChild(newPill);
      } else if (!isThisActive && pill) {
        pill.remove();
      }
    }

    const actionsEl = card.querySelector('.ai-profile-card-actions');
    if (actionsEl) {
      let useBtn = actionsEl.querySelector('.ai-prof-mini-btn.primary');
      if (!isThisActive && !useBtn && profId) {
        useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'ai-prof-mini-btn primary';
        useBtn.onclick = () => switchActiveAIProfile(profId, true);
        useBtn.textContent = 'Dùng';
        actionsEl.insertAdjacentElement('afterbegin', useBtn);
      } else if (isThisActive && useBtn) {
        useBtn.remove();
      }
    }
  });

  updateGlobalAIChromeStatus();
}

function switchActiveAIProfile(profileId, fromModal = false) {
  if (!profileId || profileId === '__local__') {
    aiProfilesState.activeProfileId = null;
    aiConfig = {
      ...aiConfig,
      profileId: '',
      profileName: '',
      apiKey: '',
      customPrompt: ''
    };
    if (aiConfig.provider === 'custom') {
      aiConfig.provider = 'gemini';
      aiConfig.model = AI_PROVIDER_PRESETS.gemini.defaultModel;
      aiConfig.endpoint = AI_PROVIDER_PRESETS.gemini.endpoint;
    }
    saveAIConfigToStorage();
    saveAIProfilesState(true);
    if (typeof showToast === 'function') {
      showToast('sparkleRegular', 'Đã chuyển sang chế độ AI Nội bộ (Miễn phí)!');
    }
    if (fromModal) {
      tempModalProvider = aiConfig.provider;
      tempModalDraft = { ...aiConfig };
      const bannerHtml = `
        <div class="ai-test-banner info">
          ⚡ Đang sử dụng <strong>AI Thông minh Nội bộ</strong> (các Profile đã lưu vẫn được giữ nguyên để bạn chuyển lại bất cứ lúc nào).
        </div>
      `;
      const sheet = document.getElementById('modal-bottom-sheet');
      if (sheet && sheet.querySelector('.ai-profiles-list')) {
        updateAISettingsSheetInPlace(null, bannerHtml);
      } else {
        renderAISettingsSheetContent(bannerHtml, true);
      }
    }
    updateGlobalAIChromeStatus();
    return;
  }

  const target = aiProfilesState.profiles.find(p => p.id === profileId);
  if (!target) return;

  aiProfilesState.activeProfileId = target.id;
  applyProfileToActiveAIConfig(target);
  saveAIProfilesState(true);

  if (typeof showToast === 'function') {
    showToast('checkmarkFilled', `Đã chuyển sang Profile: ${target.profileName}`);
  }

  if (fromModal) {
    tempModalProvider = target.provider;
    tempModalDraft = { ...aiConfig };
    const bannerHtml = `
      <div class="ai-test-banner ok">
         Đã kích hoạt Profile <strong>${escapeHtml(target.profileName)}</strong> (${escapeHtml(target.model)})!
      </div>
    `;
    const sheet = document.getElementById('modal-bottom-sheet');
    if (sheet && sheet.querySelector('.ai-profiles-list')) {
      updateAISettingsSheetInPlace(target, bannerHtml);
    } else {
      renderAISettingsSheetContent(bannerHtml, true);
    }
  }

  updateGlobalAIChromeStatus();
}

function loadAIChatHistories() {
  try {
    const raw = localStorage.getItem(AI_CHATS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch (_) { }
  return {};
}

function saveAIChatHistories() {
  try {
    localStorage.setItem(AI_CHATS_STORAGE_KEY, JSON.stringify(aiChatHistories));
  } catch (_) { }
}

function getActiveUserChatMessages() {
  const user = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;
  const uid = user ? user.id : 'guest';
  if (!Array.isArray(aiChatHistories[uid])) {
    aiChatHistories[uid] = [];
  }
  return aiChatHistories[uid];
}

function isExternalAPIConfigured() {
  if (aiConfig.provider === 'custom' && aiConfig.endpoint && aiConfig.endpoint.trim()) {
    return true;
  }
  return Boolean(aiConfig.apiKey && aiConfig.apiKey.trim().length > 5);
}

// =========================================================================
// 1. ĐIỀU HƯỚNG & HIỂN THỊ GIAO DIỆN CHAT AI CHÍNH
// =========================================================================

function openAIChatView(initialPrompt = null) {
  if (typeof saveCurrentViewScroll === 'function') {
    saveCurrentViewScroll();
  }
  currentView = 'ai';
  if (typeof shuffleAIWelcomePrompts === 'function') shuffleAIWelcomePrompts();
  render();

  const messages = getActiveUserChatMessages();

  if (initialPrompt && typeof initialPrompt === 'string' && initialPrompt.trim()) {
    sendAIPromptChip(initialPrompt);
  } else {
    // Nếu chưa chat gì (màn hình chào Welcome Hero): luôn đặt thanh cuộn ở đầu trang (top = 0)
    if (!messages || messages.length === 0) {
      if (typeof globalViewScrollPositions !== 'undefined') {
        globalViewScrollPositions['ai'] = 0;
      }
      applyPageScroll(0);
    } else if (typeof globalViewScrollPositions !== 'undefined' && typeof globalViewScrollPositions['ai'] === 'number') {
      applyPageScroll(globalViewScrollPositions['ai']);
    } else {
      scrollAIChatToBottom(false);
    }
  }
}

function renderAIChatView() {
  const activeUser = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;
  const allItems = (typeof DB !== 'undefined' && DB.isReady) ? DB.getItems() : [];
  const allCats = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCategories() : [];
  const userOrders = activeUser && Array.isArray(activeUser.orders) ? activeUser.orders : [];
  const messages = getActiveUserChatMessages();
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const apiConnected = isExternalAPIConfigured();
  const providerInfo = AI_PROVIDER_PRESETS[aiConfig.provider] || AI_PROVIDER_PRESETS.gemini;
  const displayProfLabel = (aiConfig.profileName || '').trim()
    ? `${aiConfig.profileName}`
    : `${providerInfo.badge} (${aiConfig.model})`;
  const apiStatusText = apiConnected
    ? ` ${displayProfLabel}`
    : `⚡ AI Thông minh • Quản lý Profile`;

  const savedProfiles = Array.isArray(aiProfilesState?.profiles) ? aiProfilesState.profiles : [];
  const activeProfIdForSelect = apiConnected && aiConfig.profileId && savedProfiles.some(p => p.id === aiConfig.profileId)
    ? aiConfig.profileId
    : '__local__';

  app.innerHTML = `
    <div class="ai-chat-view-container fade-in">
      <!-- Sticky Chat AI Top Header -->
      <div class="ai-chat-header">
        <div class="ai-chat-header-left">
          <div class="ai-bot-avatar-ring">
            <span>🤖</span>
            <span class="ai-online-dot ${apiConnected ? 'api-live' : 'local-smart'}"></span>
          </div>
          <div class="ai-header-titles">
            <div class="ai-header-title-row">
              <span class="ai-header-name">Trợ Lý Ẩm Thực AI</span>
              <span class="ai-context-count-pill">${allItems.length} món</span>
            </div>
            <div class="ai-header-subtitle">
              Đã đồng bộ ${allCats.length} danh mục • ${userOrders.length} đơn đã đặt của ${escapeHtml(activeUser ? activeUser.name : 'bạn')}
            </div>
          </div>
        </div>

        <div class="ai-chat-header-actions">
          <button type="button"
            class="ai-api-status-btn ${apiConnected ? 'connected' : ''}"
            onclick="openAISettingsModal()"
            title="Quản lý & Lưu các Profile AI (Gemini, DeepSeek, OpenAI, Groq, OpenRouter, Ollama...)"
          >
            <span class="ai-api-status-icon">${FluentIcons.settingsOutline}</span>
            <span class="ai-api-btn-label">${escapeHtml(apiStatusText)}</span>
          </button>

          ${cartCount > 0 ? `
            <button type="button" class="ai-header-icon-btn cart-pill" onclick="openCartView()" title="Xem giỏ hàng">
              ${FluentIcons.cartRegular} <span>${cartCount}</span>
            </button>
          ` : ''}

          ${messages.length > 0 ? `
            <button type="button" class="ai-header-icon-btn" onclick="clearCurrentAIChat()" title="Làm mới cuộc trò chuyện">
              ${FluentIcons.sync}
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Khu vực nội dung tin nhắn hoặc Màn hình chào + Gợi ý Prompt -->
      <div class="ai-messages-viewport${messages.length === 0 && !aiIsGenerating ? ' is-empty' : ''}" id="ai-messages-viewport">
        ${messages.length === 0
      ? renderAIWelcomeScreen(activeUser, allItems.length, allCats.length, userOrders.length)
      : renderAIMessageList(messages, activeUser)}

        ${aiIsGenerating ? `
          <div class="ai-msg-row assistant">
            <div class="ai-msg-content-col">
              <div class="ai-reasoning" id="ai-reasoning">
                <div class="ai-reasoning-list" id="ai-reasoning-list">
                  ${aiLiveStageLogs.map(l => `<div class="ai-reason-step done">${escapeHtml(l)}</div>`).join('')}
                  <div class="ai-reason-step active">${escapeHtml(aiLiveProgressText || 'Đang phân tích yêu cầu của bạn')}</div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Dynamic spacer cho turn đang hoạt động: chỉ chiếm diện tích khi đang generate để cuộn câu hỏi lên top, tự biến mất khi AI trả lời xong -->
        <div id="ai-turn-spacer" class="ai-turn-spacer ${aiIsGenerating ? 'active' : ''}"></div>
      </div>
    </div>

      <!-- Hiệu ứng nền Aura Halo khi AI đang suy luận (2 giai đoạn: thinking → working) -->
      ${renderAIAuraLayer()}

      <!-- Khung soạn thảo: tách hẳn ra ngoài container, cố định (fixed) ở đáy màn hình -->
      <div class="ai-composer-dock">
        <div class="ai-quick-prompts-wrap">
          <div class="ai-quick-prompts-bar" id="ai-quick-prompts-bar">
            ${messages.length >= 2 && !aiIsGenerating ? `
              <button
                type="button"
                class="ai-quick-chip ai-retry-chip"
                onclick="retryAIChatMessage()"
                title="Hỏi lại câu hỏi gần nhất"
              >
                ${FluentIcons.sync}
              </button>
            ` : ''}
            ${AI_QUICK_BAR_PROMPTS.map((qp, idx) => `
              <button
                type="button"
                class="ai-quick-chip"
                onclick="handleQuickBarPrompt(${idx})"
                ${aiIsGenerating ? 'disabled' : ''}
              >
                ${escapeHtml(qp.label)}
              </button>
            `).join('')}
          </div>
          <div class="scroll-arrow-controls ai-smart-scroll-controls" data-scroll-target="ai-quick-prompts-bar">
            <button type="button" class="scroll-arrow-btn small" data-scroll-dir="left" onclick="scrollHorizontally('ai-quick-prompts-bar', -220)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button type="button" class="scroll-arrow-btn small" data-scroll-dir="right" onclick="scrollHorizontally('ai-quick-prompts-bar', 220)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
        </div>

        <div class="ai-input-box-row">
          <textarea
            id="ai-chat-input"
            class="ai-chat-textarea"
            rows="1"
            placeholder="Hỏi tôi mọi thứ"
            oninput="handleAIChatInputResize(this)"
            onkeydown="handleAIChatKeydown(event)"
            onfocus="handleAIChatInputFocus(this)"
            onblur="handleAIChatInputBlur(this)"
            ${aiIsGenerating ? 'disabled' : ''}
          >${escapeHtml(aiDraftInput)}</textarea>
          ${aiIsGenerating ? `
            <button
              type="button"
              class="ai-stop-btn"
              onclick="stopAIChatGeneration()"
              title="Dừng tạo câu trả lời (Phím Esc)"
              aria-label="Dừng tạo câu trả lời"
            >
              <span class="ai-stop-square">■</span>
              <span>Dừng</span>
            </button>
          ` : `
            <button
              type="button"
              class="ai-send-btn"
              onclick="submitAIChatMessage()"
              aria-label="Gửi tin nhắn"
            >
              ${FluentIcons.arrowRight}
            </button>
          `}
        </div>
      </div>
  `;

  // Thiết lập xử lý bàn phím ảo & cử chỉ chạm trên điện thoại
  if (typeof initAIMobileKeyboardHandlers === 'function') {
    initAIMobileKeyboardHandlers();
  }
  if (typeof syncAIMobileKeyboardViewport === 'function') {
    syncAIMobileKeyboardViewport();
  }
  if (typeof syncAIDockClearance === 'function') {
    syncAIDockClearance();
    initAIDockObserver();
  }
  if (typeof initAISmartScrollControls === 'function') {
    initAISmartScrollControls();
  }
}

let aiSmartScrollResizeBound = false;

function syncAISmartScrollControls() {
  document.querySelectorAll('.ai-smart-scroll-controls[data-scroll-target]').forEach((ctrl) => {
    const targetId = ctrl.getAttribute('data-scroll-target');
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;

    const maxScroll = Math.max(0, target.scrollWidth - target.clientWidth);
    if (maxScroll <= 2) {
      ctrl.classList.add('is-non-scrollable');
      return;
    }

    ctrl.classList.remove('is-non-scrollable');
    const leftBtn = ctrl.querySelector('[data-scroll-dir="left"]');
    const rightBtn = ctrl.querySelector('[data-scroll-dir="right"]');
    if (leftBtn) leftBtn.disabled = target.scrollLeft <= 2;
    if (rightBtn) rightBtn.disabled = target.scrollLeft >= maxScroll - 2;
  });
}

function initAISmartScrollControls() {
  document.querySelectorAll('.ai-smart-scroll-controls[data-scroll-target]').forEach((ctrl) => {
    const targetId = ctrl.getAttribute('data-scroll-target');
    const target = targetId ? document.getElementById(targetId) : null;
    if (target && !target.dataset.smartScrollBound) {
      target.dataset.smartScrollBound = '1';
      target.addEventListener('scroll', syncAISmartScrollControls, { passive: true });
    }
  });

  if (!aiSmartScrollResizeBound) {
    aiSmartScrollResizeBound = true;
    window.addEventListener('resize', syncAISmartScrollControls, { passive: true });
  }

  requestAnimationFrame(syncAISmartScrollControls);
}

function renderAIWelcomeScreen(activeUser, itemsCount, catsCount, ordersCount) {
  const userName = activeUser ? activeUser.name : 'bạn';
  return `
    <div class="ai-welcome-hero">
      <div class="ai-welcome-badge">${FluentIcons.sparkleFilled} AI Đọc Trực Tiếp Bảng Hàng & Đơn Đã Đặt</div>
      <h2 class="ai-welcome-title">Xin chào ${escapeHtml(userName)}! Hôm nay ăn gì để AI chọn giúp nhé? 🍜</h2>
      <p class="ai-welcome-desc">
        Mình nắm rõ toàn bộ <strong>${itemsCount} mặt hàng</strong> thuộc <strong>${catsCount} danh mục</strong>, giá bán, kích cỡ, topping, phí ship và <strong>${ordersCount} đơn hàng bạn đã đặt</strong> để gợi ý món trực quan chuẩn gu nhất.
      </p>

      <div class="ai-context-pills-row">
        <span class="ai-ctx-pill">📦 Đọc 100% bảng hàng</span>
        <span class="ai-ctx-pill">🧾 Nhớ đơn bạn từng đặt</span>
        <span class="ai-ctx-pill">🃏 Hiển thị thẻ món trực quan</span>
        <span class="ai-ctx-pill link" onclick="openAISettingsModal()">🔌 Hỗ trợ gắn API Key riêng</span>
      </div>

      <div class="ai-prompt-section-head">
        <div class="ai-prompt-section-label">💡 Gợi ý câu hỏi dành cho bạn (Chạm để hỏi ngay):</div>
        <div class="scroll-arrow-controls ai-smart-scroll-controls" data-scroll-target="ai-prompt-grid">
          <button type="button" class="scroll-arrow-btn small" data-scroll-dir="left" onclick="scrollHorizontally('ai-prompt-grid', -280)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
            ${FluentIcons.chevronLeft}
          </button>
          <button type="button" class="scroll-arrow-btn small" data-scroll-dir="right" onclick="scrollHorizontally('ai-prompt-grid', 280)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
            ${FluentIcons.chevronRight}
          </button>
        </div>
      </div>
      <div class="ai-prompt-grid" id="ai-prompt-grid">
        ${getAIWelcomePromptOrder().map((idx) => {
    const card = AI_WELCOME_PROMPT_CARDS[idx];
    return `
          <div class="ai-prompt-card" onclick="handleWelcomePromptCard(${idx})">
            <div class="ai-prompt-card-top">
              <span class="ai-prompt-card-icon">${card.icon}</span>
              <span class="ai-prompt-card-tag">${escapeHtml(card.tag)}</span>
            </div>
            <div class="ai-prompt-card-title">${escapeHtml(card.title)}</div>
            <div class="ai-prompt-card-desc">${escapeHtml(card.desc)}</div>
          </div>
        `;
  }).join('')}
      </div>
    </div>
  `;
}

// Gợi ý câu hỏi ngẫu nhiên: chỉ hiện tối đa 6 thẻ, xáo trộn mỗi lần mở trang AI
const AI_WELCOME_PROMPT_MAX = 6;
let aiWelcomePromptOrder = null;

function shuffleAIWelcomePrompts() {
  const ids = AI_WELCOME_PROMPT_CARDS.map((_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  aiWelcomePromptOrder = ids.slice(0, AI_WELCOME_PROMPT_MAX);
}

function getAIWelcomePromptOrder() {
  if (!aiWelcomePromptOrder) shuffleAIWelcomePrompts();
  return aiWelcomePromptOrder;
}

function renderAIAgentTraceBox(trace) {
  if (!trace || !Array.isArray(trace.steps) || trace.steps.length === 0) return '';
  const stages = trace.stagesCount || 2;
  const usedServer = trace.steps.some(s => String(s.source || '').includes('Server'));
  const sourceShort = usedServer ? 'Server Search API' : 'Browser DB';

  return `
    <details class="ai-agent-trace-box">
      <summary>
        <span class="ai-trace-summary-left">
          <span>🔗 Tương tác ${stages} giai đoạn</span>
        </span>
        <span class="ai-trace-toggle-hint">Xem chi tiết ▾</span>
      </summary>
      <div class="ai-agent-trace-body">
        <div class="ai-trace-meta-header">
          <span>${FluentIcons.settingsOutline} <strong>${trace.steps.length} lệnh truy vấn phần mềm</strong></span>
          <span class="ai-trace-source-badge">${escapeHtml(sourceShort)}</span>
        </div>
        ${trace.thought ? `
          <div class="ai-trace-thought">
            <strong>🧠 AI định hướng truy vấn:</strong> ${escapeHtml(trace.thought)}
          </div>
        ` : ''}
        ${trace.steps.map((st, i) => `
          <div class="ai-trace-step-card">
            <div class="ai-trace-step-head">
              <span>Bước ${i + 1} (Vòng ${st.round || 1}): <span class="ai-trace-tool-pill">${escapeHtml(st.tool)}</span></span>
              <span class="ai-trace-source-pill">${escapeHtml(st.source || 'Software')}</span>
            </div>
            <div class="ai-trace-code-line">AI → Phần mềm: ${escapeHtml(st.paramsText || '{}')}</div>
            <div class="ai-trace-result-line">Phần mềm → AI: ${escapeHtml(st.resultSummary || '')}</div>
          </div>
        `).join('')}
      </div>
    </details>
  `;
}

function getRelevantCurrentOrders(activeUser, targetOrderId = null) {
  if (!activeUser || !Array.isArray(activeUser.orders) || activeUser.orders.length === 0) return [];
  // Nếu có ID đơn cụ thể
  if (targetOrderId) {
    const specific = activeUser.orders.filter(o => o.orderId === targetOrderId);
    if (specific.length > 0) return specific;
  }
  // Chỉ lấy đơn hàng hiện tại đang giao (delivering)
  const delivering = activeUser.orders.filter(o => o.categoryStatus === 'delivering');
  if (delivering.length > 0) return delivering.slice(0, 2);

  // Nếu không có đơn đang giao, chỉ hiển thị nếu có mã đơn được chỉ định
  if (targetOrderId) return [activeUser.orders[0]];
  return [];
}

function renderAIMessageList(messages, activeUser) {
  const userAvatar = activeUser && activeUser.avatar ? activeUser.avatar : '👨‍🎓';

  return `
    <div class="ai-messages-list">
      ${messages.map((msg, idx) => {
    const isUser = msg.role === 'user';
    const isLastAssistant = !isUser && idx === messages.length - 1;

    const dishItems = (!isUser && Array.isArray(msg.dishIds) && msg.dishIds.length > 0)
      ? msg.dishIds.map(id => getCatalogItemSmart(id)).filter(Boolean)
      : [];

    const relevantOrders = (!isUser && msg.showOrders && activeUser)
      ? getRelevantCurrentOrders(activeUser, msg.orderId)
      : [];
    const showOrderCards = relevantOrders.length > 0;
    const followUps = (isLastAssistant && Array.isArray(msg.followUps)) ? msg.followUps : [];

    return `
          <div class="ai-msg-row ${isUser ? 'user' : 'assistant'}">
            <div class="ai-msg-content-col">
              <div class="ai-msg-bubble ${isUser ? 'user' : 'assistant'}">
                ${!isUser && msg.agentTrace ? renderAIAgentTraceBox(msg.agentTrace) : ''}
                <div class="ai-msg-formatted-text">${isUser ? escapeHtml(msg.content) : formatAIMarkdown(msg.content)}</div>
                ${!isUser && msg.sourceBadge ? `

                ` : ''}
              </div>

              ${!isUser ? `
                <div class="ai-msg-actions-row">
                  <button
                    type="button"
                    class="ai-msg-action-btn retry"
                    onclick="retryAIChatMessage(${idx})"
                    ${aiIsGenerating ? 'disabled' : ''}
                    title="Hỏi lại câu hỏi này"
                  >
                    ${FluentIcons.sync} Hỏi lại
                  </button>
                  <button
                    type="button"
                    class="ai-msg-action-btn copy"
                    onclick="copyAIMessageText(${idx}, this)"
                    title="Sao chép nội dung"
                  >
                    📋 Sao chép
                  </button>
                </div>
              ` : ''}

              <!-- Hiển thị Trực quan Đơn Hàng Hiện Tại (chỉ mở khi có liên quan tới đơn hàng hiện tại) -->
              ${showOrderCards ? renderAIOrdersVisualList(relevantOrders) : ''}

              <!-- Hiển thị Trực quan Thẻ Mặt Hàng Gợi Ý -->
              ${dishItems.length > 0 ? renderAIDishVisualCards(dishItems, idx) : ''}

              <!-- Gợi ý câu hỏi tiếp theo (Follow-up Prompts) -->
              ${followUps.length > 0 && !aiIsGenerating ? `
                <div class="ai-followup-row">
                  ${followUps.map((fText, fIdx) => `
                    <button
                      type="button"
                      class="ai-followup-chip"
                      onclick="handleFollowUpClick(${idx}, ${fIdx})"
                    >
                      💬 ${escapeHtml(fText)}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

// =========================================================================
// 2. HIỂN THỊ THẺ MÓN HÀNG & ĐƠN ĐÃ ĐẶT TRỰC QUAN TRONG CHAT
// =========================================================================

function renderAIDishVisualCards(items, msgIdx) {
  const stripId = `ai-dish-strip-${msgIdx}`;
  const validComboCount = items.filter(it => it.inStock !== false).slice(0, 3).length;
  return `
    <div class="ai-visual-dishes-block ai-fade-late">
      <div class="ai-visual-header-row">
        <span>🍽️ Món ăn gợi ý trực quan (${items.length} món)</span>
        <div class="ai-visual-header-actions">
          ${validComboCount >= 2 ? `
            <button type="button" class="ai-add-all-combo-btn" onclick="quickAddMultipleFromAI(${msgIdx})">
              ${FluentIcons.flashFilled} Thêm cả ${validComboCount} món vào giỏ
            </button>
          ` : ''}
          <div class="scroll-arrow-controls ai-smart-scroll-controls" data-scroll-target="${stripId}">
            <button type="button" class="scroll-arrow-btn small" data-scroll-dir="left"
              onclick="scrollHorizontally('${stripId}', -260)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button type="button" class="scroll-arrow-btn small" data-scroll-dir="right"
              onclick="scrollHorizontally('${stripId}', 260)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
        </div>
      </div>

      <div class="ai-dish-cards-strip" id="${stripId}">
        ${items.map(item => {
    const store = DB.data.restaurants.find(r => Number(r.id) === Number(item.restaurantId));
    const isFreeship = store ? store.isFreeship : true;
    const rating = store ? store.rating : '4.9';
    const delivTime = store ? store.deliveryTime : '15 - 20 phút';
    const outStock = item.inStock === false;
    const sizesCount = Array.isArray(item.sizes) ? item.sizes.length : 1;
    const topCount = Array.isArray(item.toppings) ? item.toppings.length : 0;

    return `
            <div class="ai-dish-card ${outStock ? 'out-of-stock' : ''}">
              <div class="ai-dish-card-img-wrap" onclick="openDishFromAI('${escapeHtml(item.id)}')">
                <img
                  data-vt-dish="${escapeHtml(String(item.id))}"
                  src="${escapeHtml(item.image)}"
                  alt="${escapeHtml(item.name)}"
                  onerror="this.src='assets/images/hung_chien_gion.jpg'"
                >
                <span class="ai-dish-rating-pill">⭐ ${rating}</span>
                ${isFreeship ? `<span class="ai-dish-freeship-pill">Freeship 0đ</span>` : ''}
                ${outStock ? `<div class="ai-dish-soldout-mask">Tạm hết</div>` : ''}
              </div>

              <div class="ai-dish-card-body">
                <div class="ai-dish-cat-row">
                  <span class="ai-dish-cat-tag">${escapeHtml(item.category)}</span>
                  <span class="ai-dish-sku">${escapeHtml(item.sku || '')}</span>
                </div>

                <div class="ai-dish-title" onclick="openDishFromAI('${escapeHtml(item.id)}')" title="${escapeHtml(item.name)}">
                  ${escapeHtml(item.name)}
                </div>

                <div class="ai-dish-store" onclick="openStoreSearchFromAI('${escapeHtml(item.restaurantName)}')">
                  ${FluentIcons.shop} ${escapeHtml(item.restaurantName)} • ${escapeHtml(delivTime)}
                </div>

                <div class="ai-dish-options-meta">
                  ${sizesCount} kích cỡ${topCount > 0 ? ` • ${topCount} topping` : ''}
                </div>

                <div class="ai-dish-price-row">
                  <span class="ai-dish-price">${formatVND(item.price)}</span>
                  <div class="ai-dish-btn-group">
                    <button
                      type="button"
                      class="ai-dish-opt-btn"
                      onclick="openDishFromAI('${escapeHtml(item.id)}')"
                      ${outStock ? 'disabled' : ''}
                      title="Xem chi tiết mô tả, dinh dưỡng, chứng nhận an toàn & tùy chỉnh"
                    >
                      Xem món
                    </button>
                    <button
                      type="button"
                      class="ai-dish-add-btn"
                      onclick="quickAddDishFromAI('${escapeHtml(item.id)}')"
                      ${outStock ? 'disabled' : ''}
                      title="Thêm nhanh 1 phần vào giỏ hàng"
                    >
                      + Giỏ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
}

function renderAIOrdersVisualList(orders) {
  if (!orders || orders.length === 0) return '';
  const isDelivering = orders.some(o => o.categoryStatus === 'delivering');
  const title = isDelivering
    ? `🛵 Đơn hàng hiện tại đang giao (${orders.length})`
    : `📦 Thông tin đơn hàng hiện tại (${orders.length})`;

  return `
    <div class="ai-orders-visual-block">
      <div class="ai-visual-header-row">
        <span>${title}</span>
      </div>
      <div class="ai-order-cards-list">
        ${orders.map(o => {
    const statusClass = o.categoryStatus === 'delivering'
      ? 'delivering'
      : o.categoryStatus === 'cancelled'
        ? 'cancelled'
        : 'completed';
    return `
            <div class="ai-order-mini-card">
              <img
                src="${escapeHtml(o.restaurantImage || 'assets/images/hung_chien_gion.jpg')}"
                alt="${escapeHtml(o.restaurantName || o.resName || 'Quán ăn')}"
                onerror="this.src='assets/images/hung_chien_gion.jpg'"
              >
              <div class="ai-order-mini-info">
                <div class="ai-order-mini-top">
                  <strong>${escapeHtml(o.orderId)}</strong>
                  <span class="ai-order-status-pill ${statusClass}">${escapeHtml(o.statusText)}</span>
                </div>
                <div class="ai-order-mini-store">${FluentIcons.shop} ${escapeHtml(o.restaurantName || o.resName || 'ptitngon')}</div>
                <div class="ai-order-mini-items">${escapeHtml(o.itemsSummary || (o.items ? o.items.map(it => `${it.quantity}x ${it.dishName || it.name}`).join(', ') : ''))}</div>
                <div class="ai-order-mini-bottom">
                  <span class="ai-order-mini-total">${formatVND(o.totalAmount)}</span>
                  <div class="ai-order-mini-btns">
                    <button type="button" onclick="openOrderFromAI('${escapeHtml(o.orderId)}')">Xem tiến độ</button>
                    ${o.categoryStatus !== 'delivering' ? `<button type="button" class="primary" onclick="reorderOrder('${escapeHtml(o.orderId)}')">Đặt lại</button>` : ''}
                  </div>
                </div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
}

// ── Tương tác trực tiếp từ Thẻ món ăn trong Chat AI ──
function openDishFromAI(itemId) {
  const item = getCatalogItemSmart(itemId);
  if (!item) return;
  if (item.inStock === false) {
    showToast('alertRegular', `Món "${item.name}" hiện đang tạm hết hàng!`);
    return;
  }
  const store = (Array.isArray(restaurants) && restaurants.find(r => Number(r.id) === Number(item.restaurantId)))
    || (typeof DB !== 'undefined' && DB.data?.restaurants?.find(r => Number(r.id) === Number(item.restaurantId)));
  openDishOptionModal(item, store);
}

function quickAddDishFromAI(itemId, customQuantity = 1, silentToast = false) {
  const item = getCatalogItemSmart(itemId);
  if (!item) return null;
  if (item.inStock === false) {
    if (!silentToast) showToast('alertRegular', `Món "${item.name}" hiện đang tạm hết hàng!`);
    return null;
  }
  const store = (typeof DB !== 'undefined' && DB.data?.restaurants)
    ? DB.data.restaurants.find(r => Number(r.id) === Number(item.restaurantId))
    : null;
  const defaultSize = (Array.isArray(item.sizes) && item.sizes[0])
    ? item.sizes[0]
    : { name: 'Phần Tiêu Chuẩn', extraPrice: 0 };
  const qty = Math.max(1, Math.min(20, Number(customQuantity) || 1));
  const unitPrice = Number(item.price) + (Number(defaultSize.extraPrice) || 0);

  let result = null;
  if (typeof window !== 'undefined' && typeof window.addOrMergeCartItem === 'function') {
    result = window.addOrMergeCartItem({
      dishId: item.id,
      dishName: item.name,
      restaurantName: store ? store.name : item.restaurantName,
      restaurantId: store ? store.id : item.restaurantId,
      image: item.image,
      size: defaultSize,
      toppings: [],
      note: '',
      quantity: qty,
      unitPrice: unitPrice
    });
  } else {
    const fallbackItem = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      dishId: item.id,
      dishName: item.name,
      restaurantName: store ? store.name : item.restaurantName,
      restaurantId: store ? store.id : item.restaurantId,
      image: item.image,
      size: defaultSize,
      toppings: [],
      note: '',
      quantity: qty,
      unitPrice: unitPrice,
      totalPrice: unitPrice * qty
    };
    cart.push(fallbackItem);
    result = { merged: false, item: fallbackItem };
  }

  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserCart(cart);
  }
  updateFloatingCartBar();
  syncAIChatCartBadgeInPlace();
  if (!silentToast) {
    const curTotal = result.item ? result.item.totalPrice : (unitPrice * qty);
    const toastMsg = result.merged
      ? `Đã tăng số lượng "${item.name}" lên ${result.item.quantity} (${formatVND(curTotal)}) trong giỏ!`
      : `Đã thêm ${qty}x "${item.name}" (${formatVND(unitPrice * qty)}) vào giỏ hàng!`;
    showToast('cartFilled', toastMsg);
  }
  return { name: item.name, quantity: qty, unitPrice, totalPrice: unitPrice * qty };
}

function syncAIChatCartBadgeInPlace() {
  const totalCount = Array.isArray(cart) ? cart.reduce((s, x) => s + (x.quantity || 1), 0) : 0;
  document.querySelectorAll('.ai-chat-header .cart-pill span, .floating-topbar-inner .cart-pill span').forEach(el => {
    el.textContent = totalCount;
  });
  if (typeof updateBottomNavIconsAndState === 'function') {
    updateBottomNavIconsAndState();
  }
}

function quickAddMultipleFromAI(msgIdx) {
  const messages = getActiveUserChatMessages();
  const msg = messages[msgIdx];
  if (!msg || !Array.isArray(msg.dishIds)) return;

  const validItems = msg.dishIds
    .map(id => getCatalogItemSmart(id))
    .filter(it => it && it.inStock !== false)
    .slice(0, 3);

  if (validItems.length === 0) return;

  let addedTotal = 0;
  validItems.forEach(item => {
    const store = DB.data.restaurants.find(r => Number(r.id) === Number(item.restaurantId));
    const defaultSize = (Array.isArray(item.sizes) && item.sizes[0])
      ? item.sizes[0]
      : { name: 'Phần Tiêu Chuẩn', extraPrice: 0 };
    const unitPrice = Number(item.price) + (Number(defaultSize.extraPrice) || 0);
    addedTotal += unitPrice;

    if (typeof window !== 'undefined' && typeof window.addOrMergeCartItem === 'function') {
      window.addOrMergeCartItem({
        dishId: item.id,
        dishName: item.name,
        restaurantName: store ? store.name : item.restaurantName,
        restaurantId: store ? store.id : item.restaurantId,
        image: item.image,
        size: defaultSize,
        toppings: [],
        note: 'Combo gợi ý từ AI',
        quantity: 1,
        unitPrice: unitPrice
      });
    } else {
      cart.push({
        id: Date.now() + Math.random().toString(36).substring(2, 6),
        dishId: item.id,
        dishName: item.name,
        restaurantName: store ? store.name : item.restaurantName,
        restaurantId: store ? store.id : item.restaurantId,
        image: item.image,
        size: defaultSize,
        toppings: [],
        note: 'Combo gợi ý từ AI',
        quantity: 1,
        unitPrice: unitPrice,
        totalPrice: unitPrice
      });
    }
  });

  DB.saveCurrentUserCart(cart);
  updateFloatingCartBar();
  syncAIChatCartBadgeInPlace();
  showToast('cartFilled', `Đã thêm ${validItems.length} món (${formatVND(addedTotal)}) vào giỏ hàng!`);
}

function openStoreSearchFromAI(storeName) {
  if (typeof openStoreDetailByName === 'function') {
    openStoreDetailByName(storeName);
    return;
  }
  openSearchView(storeName);
}

function openOrderFromAI(orderId) {
  viewingOrderDetailId = orderId;
  openActivityView();
}

// =========================================================================
// 3. XỬ LÝ GỬI TIN NHẮN, ĐIỀU PHỐI AI ĐA GIAI ĐOẠN & AI NỘI BỘ
// =========================================================================

function handleWelcomePromptCard(idx) {
  const card = AI_WELCOME_PROMPT_CARDS[idx];
  if (card) sendAIPromptChip(card.prompt);
}

function handleQuickBarPrompt(idx) {
  const item = AI_QUICK_BAR_PROMPTS[idx];
  if (item) sendAIPromptChip(item.prompt);
}

function handleFollowUpClick(msgIdx, followIdx) {
  const messages = getActiveUserChatMessages();
  const msg = messages[msgIdx];
  if (msg && Array.isArray(msg.followUps) && msg.followUps[followIdx]) {
    sendAIPromptChip(msg.followUps[followIdx]);
  }
}

function sendAIPromptChip(promptText) {
  if (aiIsGenerating) return;
  aiDraftInput = promptText;
  submitAIChatMessage(promptText);
}

function handleAIChatInputResize(el) {
  if (!el) return;
  aiDraftInput = el.value;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content')) {
    return;
  }
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}

function handleAIChatKeydown(e) {
  if (e.key === 'Escape' && aiIsGenerating) {
    e.preventDefault();
    stopAIChatGeneration();
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (e.isComposing || e.keyCode === 229) {
      return;
    }
    submitAIChatMessage();
  }
}

// ── Tối ưu vị trí & độ cao thanh AI Composer Dock riêng cho điện thoại khi bật bàn phím ảo ──
function syncAIMobileKeyboardViewport() {
  if (typeof currentView === 'undefined' || currentView !== 'ai') return;
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    document.body.classList.remove('ai-keyboard-open');
    document.documentElement.style.removeProperty('--ai-keyboard-offset');
    return;
  }

  const input = document.getElementById('ai-chat-input');
  const isFocused = input && document.activeElement === input;

  if (window.visualViewport) {
    const vv = window.visualViewport;
    // Chênh lệch giữa innerHeight và chiều cao thực tế nhìn thấy khi có bàn phím ảo
    const diff = Math.max(0, window.innerHeight - (vv.height + Math.round(vv.offsetTop)));
    const isKeyboardActive = diff > 60 || isFocused;

    if (isKeyboardActive) {
      document.body.classList.add('ai-keyboard-open');
      document.documentElement.style.setProperty('--ai-keyboard-offset', `${diff}px`);
    } else {
      document.body.classList.remove('ai-keyboard-open');
      document.documentElement.style.setProperty('--ai-keyboard-offset', '0px');
    }
  } else {
    if (isFocused) {
      document.body.classList.add('ai-keyboard-open');
      document.documentElement.style.setProperty('--ai-keyboard-offset', '0px');
    } else {
      document.body.classList.remove('ai-keyboard-open');
      document.documentElement.style.setProperty('--ai-keyboard-offset', '0px');
    }
  }
  if (typeof syncAIDockClearance === 'function') {
    syncAIDockClearance();
  }
}

function handleAIChatInputFocus(el) {
  if (window.innerWidth <= 768) {
    document.body.classList.add('ai-keyboard-open');
    syncAIMobileKeyboardViewport();
    // Cuộn mượt tin nhắn mới nhất lên trên khung gõ phím
    setTimeout(() => {
      scrollAIChatToBottom(true);
    }, 220);
  }
}

function handleAIChatInputBlur(el) {
  if (window.innerWidth <= 768) {
    // Chờ 150ms để kiểm tra xem người dùng có bấm vào nút Gửi/Dừng hoặc đổi sang nút khác không
    setTimeout(() => {
      const activeEl = document.activeElement;
      if (!activeEl || activeEl.id !== 'ai-chat-input') {
        document.body.classList.remove('ai-keyboard-open');
        syncAIMobileKeyboardViewport();
        if (aiIsGenerating) {
          scrollUserMessageToTop();
        }
      }
    }, 150);
  }
}

function initAIMobileKeyboardHandlers() {
  const messagesVp = document.getElementById('ai-messages-viewport');
  if (messagesVp && !messagesVp.dataset.keyboardTouchBound) {
    messagesVp.dataset.keyboardTouchBound = 'true';
    // Chạm vào danh sách tin nhắn để thu gọn bàn phím ảo một cách tự nhiên (như Messenger/Telegram)
    messagesVp.addEventListener('touchstart', (e) => {
      if (document.body.classList.contains('ai-keyboard-open')) {
        if (!e.target.closest('button, a, input, textarea, select')) {
          const inp = document.getElementById('ai-chat-input');
          if (inp && document.activeElement === inp) {
            inp.blur();
          }
        }
      }
    }, { passive: true });
  }
}

if (typeof window !== 'undefined') {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncAIMobileKeyboardViewport);
    window.visualViewport.addEventListener('scroll', syncAIMobileKeyboardViewport);
  }
  window.addEventListener('resize', () => {
    syncAIMobileKeyboardViewport();
    if (typeof currentView !== 'undefined' && currentView === 'ai' && aiIsGenerating) {
      if (typeof updateAITurnSpacerHeight === 'function') updateAITurnSpacerHeight();
    }
  });
}

// Lắng nghe phím Esc trên toàn trang để dừng AI khi đang tạo
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aiIsGenerating) {
      stopAIChatGeneration();
    }
  });
}

function stopAIChatGeneration() {
  if (!aiIsGenerating) return;
  aiIsGenerating = false;
  stopAIAura(true);

  if (aiCurrentAbortController) {
    try {
      aiCurrentAbortController.abort();
    } catch (_) { }
    aiCurrentAbortController = null;
  }
  if (activeLiveWS) {
    try {
      activeLiveWS.close();
    } catch (_) { }
    activeLiveWS = null;
  }

  aiLiveProgressText = '';
  aiLiveStageLogs = [];
  aiReasoningLastShownAt = 0;

  const messages = getActiveUserChatMessages();
  if (messages && messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'user') {
      messages.push({
        role: 'assistant',
        content: '⏹ *Bạn đã dừng câu trả lời của AI.*',
        sourceBadge: '⏹ Đã dừng',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      });
      saveAIChatHistories();
    }
  }

  if (currentView === 'ai') {
    renderAIChatView();
  }
  // Đã có tin nhắn '⏹ Bạn đã dừng câu trả lời của AI' trong khung chat, không cần bật popup toast gây phiền
}

async function retryAIChatMessage(msgIdx = null) {
  if (aiIsGenerating) return;
  const messages = getActiveUserChatMessages();
  if (!messages || messages.length === 0) return;

  let userQuery = '';
  let targetUserIdx = -1;

  if (typeof msgIdx === 'number' && msgIdx >= 0 && msgIdx < messages.length) {
    for (let i = msgIdx; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuery = messages[i].content;
        targetUserIdx = i;
        break;
      }
    }
  }

  if (!userQuery) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuery = messages[i].content;
        targetUserIdx = i;
        break;
      }
    }
  }

  if (!userQuery || targetUserIdx === -1) {
    return;
  }

  // Xoá câu trả lời cũ của assistant và các tin nhắn phía sau
  messages.splice(targetUserIdx + 1);
  saveAIChatHistories();

  // Không bật toast 'Đang hỏi lại AI...' vì luồng trả lời của AI lập tức hiển thị trên giao diện
  await executeAIResponseGeneration(userQuery);
}

function copyAIMessageText(msgIdx, btnEl = null) {
  const messages = getActiveUserChatMessages();
  if (!messages || !messages[msgIdx]) return;
  const text = messages[msgIdx].content || '';
  if (!text) return;

  // Xác định nút bấm để hiển thị phản hồi trực quan tại chỗ thay vì bật popup toast
  if (!btnEl && typeof window !== 'undefined' && window.event) {
    const target = window.event.currentTarget || window.event.target;
    if (target && typeof target.closest === 'function') {
      btnEl = target.closest('.ai-msg-action-btn') || target;
    }
  }

  const markBtnCopied = () => {
    if (btnEl && btnEl.classList) {
      const origHtml = btnEl.innerHTML;
      btnEl.classList.add('copied');
      btnEl.innerHTML = '✓ Đã chép';
      setTimeout(() => {
        btnEl.classList.remove('copied');
        btnEl.innerHTML = origHtml;
      }, 1500);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      markBtnCopied();
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }

  function fallbackCopy(str) {
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      markBtnCopied();
    } catch (_) { }
    document.body.removeChild(ta);
  }
}

function clearCurrentAIChat() {
  const user = DB.getCurrentUser();
  const uid = user ? user.id : 'guest';
  aiChatHistories[uid] = [];
  saveAIChatHistories();
  if (typeof globalViewScrollPositions !== 'undefined') {
    globalViewScrollPositions['ai'] = 0;
  }
  renderAIChatView();
  applyPageScroll(0);
  showToast('sparkleRegular', 'Đã tạo cuộc trò chuyện AI mới!');
}

// ── Tính toán động khoảng trống đáy (clearance) theo độ cao & vị trí thực tế của ai-composer-dock:
// Đảm bảo tin nhắn cuối cùng không bao giờ bị thanh dock che khuất trên mọi kích cỡ màn hình / thiết bị
let aiDockResizeObserver = null;

function syncAIDockClearance() {
  if (typeof currentView !== 'undefined' && currentView !== 'ai') return 0;
  const dock = document.querySelector('.ai-composer-dock');
  const container = document.querySelector('.ai-chat-view-container');
  if (!dock) return 0;

  // Đo khoảng cách thực tế từ đỉnh dock tới đáy màn hình (bao gồm cả bottom offset, safe area, quick prompts, multiline...)
  const rect = dock.getBoundingClientRect();
  const dockOffsetFromBottom = Math.max(0, Math.round(window.innerHeight - rect.top));
  // Thêm 12px đệm thở để phần tử cuối không dính sát sạt vào mép trên của dock
  const clearance = dockOffsetFromBottom > 0 ? (dockOffsetFromBottom + 12) : 110;

  document.documentElement.style.setProperty('--ai-dock-clearance', `${clearance}px`);
  if (container) {
    container.style.setProperty('padding-bottom', `${clearance}px`, 'important');
  }

  return clearance;
}
window.syncAIDockClearance = syncAIDockClearance;

function initAIDockObserver() {
  if (typeof ResizeObserver === 'undefined') return;
  const dock = document.querySelector('.ai-composer-dock');
  if (!dock) return;
  if (aiDockResizeObserver) {
    aiDockResizeObserver.disconnect();
  }
  aiDockResizeObserver = new ResizeObserver(() => {
    syncAIDockClearance();
  });
  aiDockResizeObserver.observe(dock);
}

// ── Tính toán động độ cao của ai-turn-spacer:
// Sao cho khi tin nhắn mới nhất nằm ở vị trí neo (cách header 7px),
// trang vừa chạm đáy (maxScrollY = targetY) và người dùng không thể lướt thêm khoảng trống thừa
function updateAITurnSpacerHeight(customTargetY = null) {
  if (typeof currentView !== 'undefined' && currentView !== 'ai') return 0;
  const spacerEl = document.getElementById('ai-turn-spacer');
  if (!spacerEl) return 0;

  if (!aiIsGenerating) {
    spacerEl.style.height = '0px';
    syncAIDockClearance();
    if (typeof window.refreshSmoothScroll === 'function') {
      window.refreshSmoothScroll();
    }
    return 0;
  }

  // Luôn đảm bảo khoảng đệm dock được tính toán chính xác trước khi đo document height
  syncAIDockClearance();

  const userRows = document.querySelectorAll('.ai-msg-row.user');
  const lastUserRow = userRows[userRows.length - 1];
  if (!lastUserRow) {
    spacerEl.style.height = '0px';
    return 0;
  }

  const headerEl = document.querySelector('.ai-chat-header');
  const headerH = headerEl ? headerEl.offsetHeight : 64;
  const rect = lastUserRow.getBoundingClientRect();
  const scrollY = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || 0;
  const targetY = customTargetY !== null ? customTargetY : Math.max(0, Math.round(scrollY + rect.top - headerH - 7));

  // Đo chiều cao document hiện tại và trừ đi độ cao spacer đã có
  const currentScrollH = Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0
  );
  const currentSpacerH = spacerEl.offsetHeight || parseFloat(spacerEl.style.height) || 0;
  const scrollH0 = currentScrollH - currentSpacerH;

  // Khoảng trống vừa vặn để maxScrollY đúng bằng targetY (không thừa 1px để lướt)
  const neededSpacer = Math.max(0, Math.round(targetY + window.innerHeight - scrollH0));
  spacerEl.style.height = `${neededSpacer}px`;

  // Báo ngay lập tức cho Locomotive/Lenis cập nhật scroll limit mới mà không bị trễ frame
  if (typeof window.refreshSmoothScroll === 'function') {
    window.refreshSmoothScroll();
  }

  return neededSpacer;
}
window.updateAITurnSpacerHeight = updateAITurnSpacerHeight;

function scrollUserMessageToTop() {
  if (typeof currentView !== 'undefined' && currentView !== 'ai') return;

  function doScroll() {
    if (typeof currentView !== 'undefined' && currentView !== 'ai') return;
    const userRows = document.querySelectorAll('.ai-msg-row.user');
    const lastUserRow = userRows[userRows.length - 1];
    if (!lastUserRow) return;

    const headerEl = document.querySelector('.ai-chat-header');
    const headerH = headerEl ? headerEl.offsetHeight : 64;
    const rect = lastUserRow.getBoundingClientRect();
    const scrollY = window.pageYOffset || window.scrollY || document.documentElement.scrollTop || 0;
    const targetY = Math.max(0, Math.round(scrollY + rect.top - headerH - 7));

    // Cập nhật độ cao spacer tức thì theo targetY
    updateAITurnSpacerHeight(targetY);

    const lenis = (window.locomotiveScroll && window.locomotiveScroll.lenisInstance) || null;
    if (lenis && typeof lenis.scrollTo === 'function') {
      try {
        if (typeof lenis.resize === 'function') lenis.resize();
        lenis.scrollTo(targetY, { duration: 0.65, force: true, lock: false });
      } catch (_) { }
    } else if (window.locomotiveScroll && typeof window.locomotiveScroll.scrollTo === 'function') {
      try {
        window.locomotiveScroll.scrollTo(targetY, { duration: 0.65, force: true });
      } catch (_) { }
    }
    // Luôn đảm bảo native scroll hoạt động song song để chống trượt
    window.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });
  }

  // Đảm bảo DOM đã paint trước khi đo và cuộn (chống trượt khi có nhiều tin nhắn trước đó)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      doScroll();
      setTimeout(doScroll, 80);
    });
  });
}

function scrollAIChatToBottom(smooth = true) {
  if (typeof currentView !== 'undefined' && currentView !== 'ai') return;
  setTimeout(() => {
    if (typeof currentView !== 'undefined' && currentView !== 'ai') return;
    if (typeof window.refreshSmoothScroll === 'function') {
      window.refreshSmoothScroll();
    }
    const vp = document.getElementById('ai-messages-viewport');
    if (vp && vp.scrollHeight > vp.clientHeight && getComputedStyle(vp).overflowY !== 'visible') {
      vp.scrollTo({ top: vp.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }
    if (window.locomotiveScroll && typeof window.locomotiveScroll.scrollTo === 'function') {
      window.locomotiveScroll.scrollTo('bottom', {
        duration: smooth ? 0.75 : 0,
        immediate: !smooth
      });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }
  }, 40);
}

async function submitAIChatMessage(overrideText = null) {
  if (aiIsGenerating) return;
  const inputEl = document.getElementById('ai-chat-input');
  const rawText = overrideText !== null ? overrideText : (inputEl ? inputEl.value : aiDraftInput);
  const text = String(rawText || '').trim();
  if (!text) return;

  aiDraftInput = '';
  const messages = getActiveUserChatMessages();
  const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  messages.push({
    role: 'user',
    content: text,
    time: nowStr
  });
  saveAIChatHistories();

  await executeAIResponseGeneration(text);
}

async function executeAIResponseGeneration(text) {
  aiIsGenerating = true;
  startAIAura();
  aiCurrentAbortController = new AbortController();
  aiLiveProgressText = 'Đang phân tích yêu cầu của bạn';
  aiLiveStageLogs = [];
  aiReasoningLastShownAt = Date.now();
  if (currentView === 'ai') {
    renderAIChatView();
    revealLastAIMessage('user');
    scrollUserMessageToTop();
  }

  const messages = getActiveUserChatMessages();

  try {
    let aiResult = null;

    if (isExternalAPIConfigured()) {
      try {
        aiResult = await callExternalLLMAPI(messages);
      } catch (apiErr) {
        if (apiErr.message === 'ABORTED_BY_USER' || apiErr.name === 'AbortError' || (aiCurrentAbortController && aiCurrentAbortController.signal.aborted)) {
          return;
        }
        console.warn('Lỗi gọi API ngoài:', apiErr);
        if (aiConfig.autoFallbackLocal) {
          const localRes = await generateSmartLocalAIResponse(text);
          aiResult = {
            ...localRes,
            content: `*(Lưu ý: Không thể kết nối API ngoài — \`${apiErr.message}\`. Đã tự động chuyển sang AI Nội bộ)*\n\n` + localRes.content,
            sourceBadge: '⚡ AI Nội bộ (Fallback)'
          };
        } else {
          aiResult = {
            content: `❌ **Lỗi kết nối API (${AI_PROVIDER_PRESETS[aiConfig.provider]?.badge || 'API'}):** ${apiErr.message}\n\nBạn hãy bấm nút **⚙️ API** ở góc phải trên để kiểm tra lại API Key, Model, hoặc bật \`node server.js\` nhé!`,
            dishIds: [],
            showOrders: false,
            followUps: ['Kiểm tra lại món ngon dưới 40K', 'Xem món mình đã đặt'],
            sourceBadge: '⚠️ Lỗi API'
          };
        }
      }
    } else {
      await setAILiveStageProgress('Đang tìm kiếm các mặt hàng phù hợp');
      aiResult = await generateSmartLocalAIResponse(text);
    }

    if (aiCurrentAbortController && aiCurrentAbortController.signal.aborted) {
      return;
    }

    if (aiResult) {
      messages.push({
        role: 'assistant',
        content: aiResult.content,
        dishIds: aiResult.dishIds || [],
        showOrders: Boolean(aiResult.showOrders),
        orderId: aiResult.orderId || null,
        followUps: aiResult.followUps || [],
        agentTrace: aiResult.agentTrace || null,
        sourceBadge: aiResult.sourceBadge || '⚡ AI Nội bộ ptitngon',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      });
      saveAIChatHistories();
    }
  } finally {
    aiIsGenerating = false;
    stopAIAura(false);
    aiCurrentAbortController = null;
    activeLiveWS = null;
    aiLiveProgressText = '';
    aiLiveStageLogs = [];
    aiReasoningLastShownAt = 0;
    if (currentView === 'ai') {
      // Ghi nhớ vị trí viewport của tin nhắn người dùng trước khi AI trả lời
      const userRows = document.querySelectorAll('.ai-msg-row.user');
      const lastUserRow = userRows[userRows.length - 1];
      const prevRectTop = lastUserRow ? lastUserRow.getBoundingClientRect().top : null;

      renderAIChatView();
      revealLastAIMessage('assistant');

      // Khóa cố định vị trí câu hỏi trên màn hình, không bị tụt dòng hay giật màn hình
      if (prevRectTop !== null) {
        const newUserRows = document.querySelectorAll('.ai-msg-row.user');
        const newLastUserRow = newUserRows[newUserRows.length - 1];
        if (newLastUserRow) {
          const newRectTop = newLastUserRow.getBoundingClientRect().top;
          const diff = Math.round(newRectTop - prevRectTop);
          if (diff !== 0) {
            window.scrollBy({ top: diff, behavior: 'instant' });
          }
        }
      }
    }
  }
}

// ── Hiệu ứng hiện tin nhắn mới: bong bóng fade, từng từ hiện dần, thẻ gợi ý hiện sau cùng ──
function revealLastAIMessage(role) {
  const rows = document.querySelectorAll(`.ai-msg-row.${role}`);
  const row = rows[rows.length - 1];
  if (!row) return;
  const col = row.querySelector('.ai-msg-content-col');
  const bubble = row.querySelector('.ai-msg-bubble');
  if (!col || !bubble) return;

  bubble.classList.add('ai-fade-bubble');
  if (typeof triggerHaptic === 'function') {
    triggerHaptic('bubble');
  }
  if (role !== 'assistant') return;

  const textEl = bubble.querySelector('.ai-msg-formatted-text');
  let totalMs = 0;
  if (textEl) {
    const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    const wordCount = textNodes.reduce((n, t) => n + (t.nodeValue.match(/\S+/g) || []).length, 0);
    const step = Math.max(8, Math.min(32, 1800 / Math.max(1, wordCount)));
    let idx = 0;

    textNodes.forEach(node => {
      const parts = node.nodeValue.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      parts.forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement('span');
          span.className = 'ai-word-fade';
          span.style.animationDelay = `${Math.round(idx * step)}ms`;
          span.textContent = part;
          frag.appendChild(span);
          idx++;
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
    totalMs = Math.round(idx * step);
  }

  Array.from(col.children).forEach(child => {
    if (child === bubble) return;
    child.classList.add('ai-fade-late');
    child.style.animationDelay = `${Math.min(totalMs, 2000) + 150}ms`;
  });
}

// =========================================================================
// 4. KIẾN TRÚC AI ĐA GIAI ĐOẠN (AGENTIC TOOL LOOP) & BỘ CÔNG CỤ TRUY VẤN
//    - Không đẩy toàn bộ bảng hàng vào Prompt (Sẵn sàng quy mô 1 Triệu mặt hàng)
//    - Giai đoạn 1: AI phân tích ý định -> xuất mã lệnh <<<TOOL_CALL>>>
//    - Bước trung gian: Trình duyệt gọi Server Search API (/api/catalog/*)
//      hoặc đọc trạng thái người dùng (Giỏ hàng / Đơn cũ / Kcal)
//    - Giai đoạn 2..N: AI tự động nới lỏng bộ lọc nếu 0 kết quả, hoặc tổng hợp câu trả lời
// =========================================================================

const MAX_AGENT_TOOL_ROUNDS = 5;

function buildAgenticSystemPrompt() {
  const user = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;
  const categories = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCategories() : [];
  const catNames = categories.map(c => c.name).join(', ');
  const cartQty = cart.reduce((s, c) => s + c.quantity, 0);
  const ordersCount = (user && Array.isArray(user.orders)) ? user.orders.length : 0;

  let personaBrief = 'Bình thường';
  if (user && typeof getTodayNutritionSummary === 'function' && typeof getPersonaMeta === 'function') {
    const nut = getTodayNutritionSummary(user);
    const pMeta = getPersonaMeta(nut.hp.personaType);
    personaBrief = `${pMeta.shortLabel} (Mục tiêu ${nut.hp.dailyCalorieGoal} kcal/ngày, còn lại ${nut.remainingCalories} kcal)`;
  }

  return `Bạn là "Trợ Lý Ẩm Thực AI ptitngon" của ứng dụng giao đồ ăn sinh viên PTIT.
Hệ thống quản lý cơ sở dữ liệu mặt hàng quy mô lớn thông qua các Công cụ Truy vấn (Tools) — dữ liệu mặt hàng KHÔNG nằm sẵn trong prompt này.

=== TỔNG QUAN MÔI TRƯỜNG HIỆN TẠI ===
- Người dùng: ${user ? `${user.name} (${user.memberTier || 'Thành viên'}) | Nhận tại: ${user.addressLabel || user.shortAddress || 'PTIT'}` : 'Khách vãng lai'}
- Con trỏ trạng thái cá nhân: Giỏ hàng đang có ${cartQty} món | Lịch sử đã đặt: ${ordersCount} đơn | Thể trạng: ${personaBrief}. (Muốn xem chi tiết món trong giỏ, đơn đã đặt hoặc chỉ số dinh dưỡng, hãy gọi tool "get_user_context").
- Các danh mục mặt hàng hiện có: ${catNames}.
- Mã giảm giá hệ thống: PTITNGON50 (giảm 50% tối đa 50K), HUNGCHIENGION (giảm 50K), FREESHIP (miễn phí giao hàng 15K), PTITNGON10 (giảm 10%).

=== BỘ MÃ CÔNG CỤ TRUY VẤN VÀ THỰC THI (TOOLS) ===
Bộ công cụ được chia làm 2 nhóm rõ rệt:

[NHÓM 1 — CÔNG CỤ TRA CỨU & KHẢO SÁT DỮ LIỆU (QUERY & RETRIEVAL TOOLS)]
1. "search_items": Tìm kiếm & lọc mặt hàng từ Server Index (query, categories, tags, minPrice, maxPrice, freeshipOnly, inStockOnly, maxCalories, minProtein, dietMode, sortBy, limit).
2. "get_catalog_overview": Lấy thống kê tổng số mặt hàng, tồn kho, tầm giá min/max/trung bình và số món từng danh mục.
3. "get_item_details": Lấy chi tiết kích cỡ, danh sách topping, voucher quán cho các mã món cụ thể: { "itemIds": ["item_1_1", ...] }.
4. "search_stores": Tra cứu danh sách cửa hàng, khoảng cách, phí ship, thực đơn mẫu.
5. "get_user_context": Đọc dữ liệu cá nhân của khách trên trình duyệt (giỏ hàng, đơn cũ, mục tiêu kcal): { "includeCart": true, "includeOrders": true, "includeNutrition": true, "orderStatus": "all"|"delivering"|"completed"|"cancelled" (tùy chọn lọc đơn theo trạng thái) }.
6. "track_order": Tra cứu chi tiết hành trình di chuyển, vị trí shipper, lộ trình và tiến độ của đơn hàng đang giao. Params: { "orderId": "mã_đơn" (để trống "" để tra cứu đơn đang giao gần nhất) }.
7. "user_profile_action": Xem thông tin cài đặt & hồ sơ hiện tại của người dùng. Params: { "action": "view" }.

[NHÓM 2 — CÔNG CỤ THỰC HIỆN HÀNH ĐỘNG / CÔNG VIỆC (ACTION TOOLS)]
8. "cart_action": Thực hiện các thao tác quản lý giỏ hàng:
   - Thêm món: { "action": "add_item", "itemId": "mã_id_thật_đã_xác_thực", "quantity": 1 }
   - Xóa 1 món cụ thể: { "action": "remove_item", "dishName": "tên món cần xóa", "itemId": "mã_id" }
   - Xóa sạch toàn bộ giỏ: { "action": "clear_cart" }
   - Áp mã giảm giá: { "action": "apply_voucher", "voucherCode": "PTITNGON50" }
9. "checkout_action": Thực hiện hành động thanh toán & tạo đơn hàng từ giỏ hàng hiện tại. Params: { "paymentMethod": "cod"|"qr"|"momo", "note": "ghi chú cho shipper", "voucherCode": "..." }.
10. "order_action": Thực hiện hành động tương tác với hành trình đơn hàng:
    - Hối giao hàng nhanh: { "action": "urge_delivery", "orderId": "mã_đơn" }
    - Đổi ghi chú giao hàng: { "action": "update_note", "orderId": "mã_đơn", "note": "ghi chú mới" }
    - Lấy thông tin liên hệ shipper: { "action": "call_shipper", "orderId": "mã_đơn" }
    - Hủy đơn hàng: { "action": "cancel_order", "orderId": "mã_đơn" }
    - Xác nhận đã nhận món: { "action": "confirm_received", "orderId": "mã_đơn" }
    - Đặt lại đơn hoặc combo đã hủy/hoàn tất: { "action": "reorder", "orderId": "mã_đơn" }
11. "user_profile_action": Xem & Sửa thông tin cài đặt, hồ sơ, địa chỉ người dùng:
    - Xem thông tin: { "action": "view" }
    - Sửa thông tin: { "action": "update", "name": "...", "phone": "...", "email": "...", "address": "...", "addressLabel": "...", "note": "...", "useCurrentLocation": true, "dailyCalorieGoal": 2000, "dietaryNotes": [...] }
    - Tự động lấy vị trí hiện tại: Khi người dùng yêu cầu định vị, lấy vị trí hiện tại hoặc đổi địa chỉ theo GPS, đặt "useCurrentLocation": true (hoặc gọi { "action": "detect_location" }).
    - QUY TẮC ĐỊNH DẠNG:
      + Số điện thoại: BẮT BUỘC đúng chuẩn Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84).
      + Email: BẮT BUỘC đúng định dạng email (VD: sinhvien@stu.ptit.edu.vn hoặc user@gmail.com).

=== KHẢ NĂNG THỰC HIỆN NHIỀU TÁC VỤ CÙNG LÚC (MULTI-TASKING CAPABILITY) ===
- BẠN CÓ THỂ VÀ ĐƯỢC PHÉP THỰC HIỆN NHIỀU TÁC VỤ CÙNG MỘT LÚC TRONG MỘT LƯỢT, CHO DÙ CÁC TÁC VỤ ĐÓ HOÀN TOÀN KHÁC NHAU VỀ BẢN CHẤT!
- Đừng chia lẻ thành nhiều câu hỏi nếu người dùng đã yêu cầu; hãy gom tất cả các thao tác vào mảng "calls" của một khối <<<TOOL_CALL>>> duy nhất:
  Ví dụ người dùng yêu cầu: "Cập nhật số điện thoại 0987654321, email nguyenvana@ptit.edu.vn, thêm món vào giỏ và xem đơn hàng của mình đang ở đâu":
<<<TOOL_CALL
{
  "thought": "Thực hiện đồng thời nhiều tác vụ khác nhau: sửa thông tin liên hệ, thêm món vào giỏ hàng và tra cứu hành trình đơn đang giao",
  "calls": [
    { "tool": "user_profile_action", "params": { "action": "update", "phone": "0987654321", "email": "nguyenvana@ptit.edu.vn" } },
    { "tool": "cart_action", "params": { "action": "add_item", "itemId": "item_1_1", "quantity": 1 } },
    { "tool": "track_order", "params": { "orderId": "" } }
  ]
}
TOOL_CALL>>>
- Hệ thống sẽ lần lượt thực thi đầy đủ toàn bộ các tác vụ trên và gửi kết quả về cho bạn tổng hợp.

=== NGUYÊN TẮC PHÂN BỔ CÔNG VIỆC TRONG TƯƠNG TÁC NHIỀU GIAI ĐOẠN (BẮT BUỘC TUÂN THỦ) ===

1. LẦN TƯƠNG TÁC ĐẦU TIÊN (LƯỢT 1 — KHẢO SÁT & TÌM KIẾM DỮ LIỆU):
- NGUYÊN TẮC CỐT LÕI: TUYỆT ĐỐI KHÔNG ĐƯỢC THỰC HIỆN BẤT KỲ CÔNG VIỆC / HÀNH ĐỘNG (ACTION) NÀO Ở LẦN TƯƠNG TÁC ĐẦU TIÊN!
- Lý do: Ở lần giao tiếp đầu tiên, bạn chưa khảo sát dữ liệu thực tế trên phần mềm thì CHƯA THỂ BIẾT giỏ hàng có gì, đơn hàng nào đang giao, hoặc mặt hàng nào phù hợp với mã định danh thực tế là gì để thao tác an toàn.
- Kể cả khi người dùng yêu cầu thực hiện công việc (ví dụ: "xóa món X trong giỏ", "thanh toán luôn giỏ hàng", "hối shipper giao nhanh", "đổi địa chỉ nhận"), bạn KHÔNG ĐƯỢC gọi Action Tool ngay ở lượt đầu.
- Ở lần giao tiếp đầu tiên, bạn BẮT BUỘC chỉ được dùng các công cụ TRA CỨU & KHẢO SÁT (Query Tools như search_items, get_user_context, track_order, user_profile_action view) để đọc dữ liệu cần thiết từ phần mềm trước.
- Xuất duy nhất khối lệnh <<<TOOL_CALL>>>:
<<<TOOL_CALL
{
  "thought": "Cần tra cứu dữ liệu thực tế từ phần mềm trước để có thông tin đối tượng chính xác",
  "calls": [
    { "tool": "search_items", "params": { "query": "tên món cần tìm", "limit": 6 } }
  ]
}
TOOL_CALL>>>

2. LẦN TƯƠNG TÁC CUỐI CÙNG (LƯỢT THỰC HIỆN CÔNG VIỆC & TỔNG HỢP PHẢN HỒI):
- Khi trình duyệt đã phản hồi <<<TOOL_RESULTS>>> chứa các dữ liệu và mặt hàng thực tế kèm mã "id" có thật:
  + NẾU NGƯỜI DÙNG CÓ YÊU CẦU THỰC HIỆN CÔNG VIỆC: Lúc này — ở lần tương tác cuối cùng khi đã có đầy đủ thông tin xác thực từ phần mềm — bạn mới thực hiện công việc/hành động đó (gọi Action Tool tương ứng như cart_action, checkout_action, order_action, user_profile_action update).
  + NẾU KẾT QUẢ TÌM KIẾM VỀ 0 MÓN: Có thể xuất 1 lượt <<<TOOL_CALL>>> nới lỏng điều kiện lọc.
  + NẾU NGƯỜI DÙNG CẦN TƯ VẤN / TÌM MÓN: Trả lời thân thiện, chính xác tên món, quán và giá tiền thực tế vừa nhận.
  + BẮT BUỘC ở cuối câu trả lời tư vấn, xuất khối <<<RECOMMEND_JSON>>> để hiển thị thẻ giao diện trực quan:
<<<RECOMMEND_JSON
{
  "dishIds": ["id_mon_thật_1", "id_mon_thật_2"],
  "showOrders": false,
  "followUps": ["Gợi ý tiếp theo 1", "Gợi ý tiếp theo 2"]
}
RECOMMEND_JSON>>>
(Chỉ điền các mã "id" có thật từ kết quả tra cứu vào "dishIds" tối đa 6 món; chỉ đặt "showOrders": true khi câu hỏi hoặc thao tác liên quan trực tiếp tới ĐƠN HÀNG HIỆN TẠI như đang giao, vừa thanh toán, hoặc tra cứu hành trình ship. TUYỆT ĐỐI không bật showOrders khi chỉ tư vấn món ăn, danh mục hoặc hồ sơ calo).${(aiConfig.customPrompt && aiConfig.customPrompt.trim()) ? `

=== PHONG CÁCH & VAI TRÒ RIÊNG CỦA PROFILE AI ("${aiConfig.profileName || 'Tùy chỉnh'}") ===
${aiConfig.customPrompt.trim()}` : ''}`;
}

// ── Thực thi từng Tool trên Phần mềm (Ưu tiên Server Search API -> Fallback Browser DB) ──

function runLocalBrowserItemSearch(params = {}) {
  const t0 = performance.now();
  const allItems = (typeof DB !== 'undefined' && DB.isReady) ? DB.getItems() : [];
  const stores = (typeof DB !== 'undefined' && DB.data?.restaurants) ? DB.data.restaurants : [];
  const storeMap = new Map(stores.map(s => [Number(s.id), s]));

  const rawQuery = Array.isArray(params.keywords) ? params.keywords.join(' ') : String(params.query || params.keyword || '');
  const qLower = rawQuery.toLowerCase().trim();
  const qAscii = removeVnTones(qLower).trim();
  const hasAccents = qLower !== qAscii;
  const stopWords = new Set(['mon', 'an', 'do', 'quan', 'ngon', 'cho', 'minh', 'tim', 'goi', 'cac', 'nhung', 'ptit', 'quanh', 'gia', 'duoi', 'tren']);
  const queryTokens = qAscii.split(/[^a-z0-9]+/).filter(t => t.length >= 2 && !stopWords.has(t));

  const catInputs = Array.isArray(params.categories) ? params.categories : (params.category ? [params.category] : []);
  const catAsciiList = catInputs.map(c => removeVnTones(c).trim()).filter(Boolean);
  const tagInputs = Array.isArray(params.tags) ? params.tags : (params.tag ? [params.tag] : []);
  const tagsAscii = tagInputs.map(t => removeVnTones(t).trim()).filter(Boolean);

  const minPrice = params.minPrice ? Number(params.minPrice) : null;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : null;
  const freeshipOnly = Boolean(params.freeshipOnly);
  const inStockOnly = params.inStockOnly !== false;
  const restaurantId = params.restaurantId ? Number(params.restaurantId) : null;
  const excludeSet = new Set(Array.isArray(params.excludeIds) ? params.excludeIds.map(String) : []);
  const sortBy = String(params.sortBy || 'relevance').toLowerCase();
  const limit = Math.max(1, Math.min(20, Number(params.limit) || 8));

  const matched = [];
  for (const it of allItems) {
    if (inStockOnly && it.inStock === false) continue;
    if (excludeSet.has(String(it.id))) continue;
    if (restaurantId && Number(it.restaurantId) !== restaurantId) continue;
    if (minPrice !== null && Number(it.price) < minPrice) continue;
    if (maxPrice !== null && Number(it.price) > maxPrice) continue;

    const store = storeMap.get(Number(it.restaurantId));
    const isFreeship = store ? Boolean(store.isFreeship) : true;
    if (freeshipOnly && !isFreeship) continue;

    const nameLower = String(it.name || '').toLowerCase();
    const catLower = String(it.category || '').toLowerCase();
    const nameAscii = removeVnTones(nameLower);
    const catAscii = removeVnTones(catLower);
    const descAscii = removeVnTones(it.description || '');
    const storeAscii = removeVnTones(it.restaurantName || '');
    const fullAscii = `${nameAscii} ${catAscii} ${storeAscii} ${descAscii}`;
    const nameTokenSet = new Set(nameAscii.split(/[^a-z0-9]+/).filter(Boolean));
    const catTokenSet = new Set(catAscii.split(/[^a-z0-9]+/).filter(Boolean));

    if (catAsciiList.length > 0) {
      const okCat = catAsciiList.some(cf => catAscii.includes(cf) || cf.includes(catAscii) || nameAscii.includes(cf));
      if (!okCat) continue;
    }

    let score = 10;
    if (hasAccents && qLower.length >= 2) {
      if (nameLower.includes(qLower)) score += 75;
      if (catLower.includes(qLower)) score += 55;
    }

    let hitTokens = 0;
    queryTokens.forEach(tk => {
      if (nameTokenSet.has(tk)) { score += 26; hitTokens++; }
      else if (catTokenSet.has(tk)) { score += 20; hitTokens++; }
      else if (fullAscii.includes(tk) && tk.length >= 4) { score += 8; hitTokens++; }
    });

    if (queryTokens.length > 0 && catAsciiList.length === 0 && tagsAscii.length === 0 && hitTokens === 0) {
      continue;
    }

    tagsAscii.forEach(tg => {
      if (fullAscii.includes(tg)) score += 20;
    });

    score += (Number(store?.rating) || 4.8) * 1.5;
    if (isFreeship) score += 4;

    matched.push({
      item: {
        id: it.id,
        sku: it.sku || '',
        name: it.name,
        price: Number(it.price) || 0,
        category: it.category,
        restaurantId: it.restaurantId,
        restaurantName: store ? store.name : it.restaurantName,
        isFreeship,
        rating: Number(store?.rating) || 4.8,
        deliveryTime: store?.deliveryTime || '15 - 20 phút',
        inStock: it.inStock !== false,
        sizes: (it.sizes || []).map(s => ({ name: s.name, extraPrice: s.extraPrice || 0 })),
        toppingsCount: Array.isArray(it.toppings) ? it.toppings.length : 0,
        description: it.description || ''
      },
      score
    });
  }

  matched.sort((a, b) => {
    if (sortBy === 'price_asc') return a.item.price - b.item.price || b.score - a.score;
    if (sortBy === 'price_desc') return b.item.price - a.item.price || b.score - a.score;
    if (sortBy === 'rating_desc') return b.item.rating - a.item.rating || b.score - a.score;
    return b.score - a.score || a.item.price - b.item.price;
  });

  const sliced = matched.slice(0, limit).map(m => m.item);
  return {
    totalCatalogSize: allItems.length,
    totalMatched: matched.length,
    returnedCount: sliced.length,
    elapsedMs: Number((performance.now() - t0).toFixed(2)),
    items: sliced
  };
}

function stripItemForLLMContext(it) {
  return {
    id: it.id,
    sku: it.sku || undefined,
    name: it.name,
    price: it.price,
    category: it.category,
    restaurantName: it.restaurantName,
    isFreeship: it.isFreeship,
    rating: it.rating,
    deliveryTime: it.deliveryTime,
    inStock: it.inStock,
    calories: it.calories || undefined,
    protein: it.protein || undefined,
    sizes: it.sizes,
    description: it.description ? String(it.description).substring(0, 120) : undefined
  };
}

async function executeSoftwareToolCall(toolName, rawParams = {}) {
  const params = (rawParams && typeof rawParams === 'object') ? rawParams : {};
  const name = String(toolName || '').trim();

  // 1. search_items
  if (name === 'search_items') {
    const serverRes = await fetchServerCatalogEndpoint('/api/catalog/search', 'POST', params);
    if (serverRes.ok && serverRes.data) {
      const d = serverRes.data;
      cacheServerCatalogItems(d.items);
      return {
        tool: name,
        source: 'Server Search API (/api/catalog/search)',
        retrievedIds: (d.items || []).map(i => i.id),
        usedOrders: false,
        resultSummary: `Khớp ${d.totalMatched}/${d.totalCatalogSize} mặt hàng → Nạp ${d.returnedCount} món (${d.elapsedMs}ms)`,
        llmPayload: {
          totalCatalogSize: d.totalCatalogSize,
          totalMatched: d.totalMatched,
          returnedCount: d.returnedCount,
          items: (d.items || []).map(stripItemForLLMContext)
        }
      };
    }

    const localData = runLocalBrowserItemSearch(params);
    return {
      tool: name,
      source: 'Browser Local DB',
      retrievedIds: localData.items.map(i => i.id),
      usedOrders: false,
      resultSummary: `Khớp ${localData.totalMatched}/${localData.totalCatalogSize} mặt hàng → Nạp ${localData.returnedCount} món (${localData.elapsedMs}ms)`,
      llmPayload: {
        totalCatalogSize: localData.totalCatalogSize,
        totalMatched: localData.totalMatched,
        returnedCount: localData.returnedCount,
        items: localData.items.map(stripItemForLLMContext)
      }
    };
  }

  // 2. get_catalog_overview
  if (name === 'get_catalog_overview') {
    const serverRes = await fetchServerCatalogEndpoint('/api/catalog/overview', 'GET');
    if (serverRes.ok && serverRes.data) {
      const ov = serverRes.data;
      return {
        tool: name,
        source: 'Server Search API (/api/catalog/overview)',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: `Tổng quan ${ov.totalItems} mặt hàng, ${ov.categories?.length || 0} danh mục, ${ov.totalStores} quán`,
        llmPayload: ov
      };
    }

    const allItems = DB.getItems();
    const inStock = allItems.filter(i => i.inStock !== false);
    const prices = allItems.map(i => Number(i.price) || 0).filter(p => p > 0);
    const ovLocal = {
      totalItems: allItems.length,
      inStockCount: inStock.length,
      outOfStockCount: allItems.length - inStock.length,
      totalStores: (DB.data?.restaurants || []).length,
      priceRange: {
        min: prices.length ? Math.min(...prices) : 0,
        max: prices.length ? Math.max(...prices) : 0,
        avg: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
      },
      categories: DB.getCategories().map(c => ({
        id: c.id,
        name: c.name,
        itemCount: allItems.filter(i => i.category === c.name).length
      }))
    };
    return {
      tool: name,
      source: 'Browser Local DB',
      retrievedIds: [],
      usedOrders: false,
      resultSummary: `Tổng quan ${ovLocal.totalItems} mặt hàng, ${ovLocal.categories.length} danh mục`,
      llmPayload: ovLocal
    };
  }

  // 3. get_item_details
  if (name === 'get_item_details') {
    const ids = Array.isArray(params.itemIds) ? params.itemIds : (params.ids || (params.itemId ? [params.itemId] : []));
    const serverRes = await fetchServerCatalogEndpoint('/api/catalog/items-by-ids', 'POST', { ids });
    let items = [];
    let src = 'Browser Local DB';
    if (serverRes.ok && serverRes.data && Array.isArray(serverRes.data.items)) {
      cacheServerCatalogItems(serverRes.data.items);
      items = serverRes.data.items;
      src = 'Server Search API (/api/catalog/items-by-ids)';
    } else {
      items = ids.map(id => getCatalogItemSmart(id)).filter(Boolean);
    }

    return {
      tool: name,
      source: src,
      retrievedIds: items.map(i => i.id),
      usedOrders: false,
      resultSummary: `Đã nạp chi tiết ${items.length} mặt hàng`,
      llmPayload: {
        items: items.map(it => ({
          id: it.id,
          name: it.name,
          price: it.price,
          category: it.category,
          restaurantName: it.restaurantName,
          inStock: it.inStock !== false,
          calories: it.calories,
          protein: it.protein,
          sizes: it.sizes || [],
          toppings: it.toppings || [],
          description: it.description || ''
        }))
      }
    };
  }

  // 4. search_stores
  if (name === 'search_stores') {
    const serverRes = await fetchServerCatalogEndpoint('/api/catalog/stores', 'POST', params);
    if (serverRes.ok && serverRes.data) {
      const sampleIds = [];
      (serverRes.data.stores || []).forEach(s => {
        (s.sampleItems || []).forEach(it => sampleIds.push(it.id));
      });
      return {
        tool: name,
        source: 'Server Search API (/api/catalog/stores)',
        retrievedIds: sampleIds,
        usedOrders: false,
        resultSummary: `Tìm thấy ${serverRes.data.totalMatched} cửa hàng (hiển thị ${serverRes.data.stores?.length || 0})`,
        llmPayload: serverRes.data
      };
    }

    const stores = (DB.data?.restaurants || []).slice(0, 6).map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      rating: s.rating,
      distanceText: s.distanceText,
      deliveryTime: s.deliveryTime,
      shippingFee: s.shippingFee,
      isFreeship: s.isFreeship,
      vouchers: s.vouchers || []
    }));
    return {
      tool: name,
      source: 'Browser Local DB',
      retrievedIds: [],
      usedOrders: false,
      resultSummary: `Đã lấy thông tin ${stores.length} cửa hàng`,
      llmPayload: { totalMatched: stores.length, stores }
    };
  }

  // 5. get_user_context
  if (name === 'get_user_context') {
    const user = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;
    const includeCart = params.includeCart !== false;
    const includeOrders = params.includeOrders !== false;
    const includeNutrition = params.includeNutrition !== false;

    const resultObj = {
      userName: user ? user.name : 'Khách vãng lai',
      memberTier: user?.memberTier || 'Thành viên',
      deliveryAddress: user?.address || 'PTIT Hà Đông'
    };

    if (includeCart) {
      const subtotal = cart.reduce((s, c) => s + c.totalPrice, 0);
      resultObj.cart = {
        totalItemsCount: cart.reduce((s, c) => s + c.quantity, 0),
        subtotal,
        items: cart.map(c => ({
          dishName: c.dishName,
          restaurantName: c.restaurantName,
          size: c.size?.name || 'Tiêu chuẩn',
          quantity: c.quantity,
          totalPrice: c.totalPrice
        }))
      };
    }

    if (includeOrders) {
      const rawOrders = (user && Array.isArray(user.orders))
        ? user.orders
        : (typeof ordersList !== 'undefined' && Array.isArray(ordersList) ? ordersList : []);
      const statusFilter = typeof params.orderStatus === 'string' ? params.orderStatus.trim().toLowerCase() : 'all';
      const filteredOrders = (statusFilter && statusFilter !== 'all')
        ? rawOrders.filter(o => String(o.categoryStatus || '').toLowerCase() === statusFilter)
        : rawOrders;

      resultObj.orders = filteredOrders.map(o => ({
        orderId: o.orderId,
        statusText: o.statusText,
        categoryStatus: o.categoryStatus,
        orderTime: o.orderTime,
        restaurantName: o.restaurantName || o.resName,
        totalAmount: o.totalAmount,
        items: Array.isArray(o.items)
          ? o.items.map(it => `${it.qty || it.quantity || 1}x ${it.name || it.dishName} (${it.unitPrice || 0}đ)`)
          : [o.itemsSummary || '']
      }));
    }

    if (includeNutrition && user && typeof getTodayNutritionSummary === 'function' && typeof getPersonaMeta === 'function') {
      const nut = getTodayNutritionSummary(user);
      const pMeta = getPersonaMeta(nut.hp.personaType);
      resultObj.nutritionProfile = {
        persona: pMeta.title,
        weightKg: nut.hp.weightKg,
        heightCm: nut.hp.heightCm,
        bmi: nut.hp.bmiInfo.bmi,
        bmiStatus: nut.hp.bmiInfo.status,
        dailyCalorieGoal: nut.hp.dailyCalorieGoal,
        consumedCaloriesToday: nut.consumed.calories,
        remainingCaloriesToday: nut.remainingCalories,
        proteinGoalGrams: nut.hp.macroGoals.protein,
        dietaryNotes: nut.hp.dietaryNotes || []
      };
    }

    return {
      tool: name,
      source: 'Browser User Session',
      retrievedIds: [],
      usedOrders: false,
      resultSummary: `Đã đọc hồ sơ khách (${includeCart ? `Giỏ: ${cart.length} dòng` : ''}${includeOrders ? `, Đơn cũ: ${resultObj.orders?.length || 0}` : ''})`,
      llmPayload: resultObj
    };
  }

  // 6. cart_action (Thao tác giỏ hàng: thêm, xóa 1 món, xóa sạch, áp mã)
  if (name === 'cart_action') {
    const act = String(params.action || 'add_item').toLowerCase();

    // 6a. Xóa 1 mặt hàng cụ thể trong giỏ
    if (act === 'remove_item') {
      const targetQuery = String(params.dishName || params.itemId || params.query || '').toLowerCase().trim();
      if (!targetQuery) {
        return {
          tool: name,
          source: 'Browser Cart Controller',
          retrievedIds: [],
          usedOrders: false,
          resultSummary: 'Thiếu tên món hoặc mã món cần xóa khỏi giỏ',
          llmPayload: { ok: false, error: 'Vui lòng cung cấp dishName hoặc itemId cần xóa khỏi giỏ hàng' }
        };
      }
      const idx = cart.findIndex(c =>
        (c.id && String(c.id).toLowerCase() === targetQuery) ||
        (c.dishName && c.dishName.toLowerCase().includes(targetQuery))
      );
      if (idx >= 0) {
        const removed = cart.splice(idx, 1)[0];
        if (typeof DB !== 'undefined' && DB.isReady) DB.saveCurrentUserCart(cart);
        if (typeof updateFloatingCartBar === 'function') updateFloatingCartBar();
        if (typeof renderCartView === 'function' && typeof currentView !== 'undefined' && currentView === 'cart') renderCartView();
        if (typeof showToast === 'function') showToast('deleteRegular', `Đã xóa "${removed.dishName}" khỏi giỏ hàng`);
        return {
          tool: name,
          source: 'Browser Cart Controller',
          retrievedIds: [],
          usedOrders: false,
          resultSummary: `Đã xóa "${removed.dishName}" khỏi giỏ hàng`,
          llmPayload: {
            ok: true,
            removedDish: removed.dishName,
            remainingItemsCount: cart.length,
            cartSubtotal: cart.reduce((s, c) => s + c.totalPrice, 0)
          }
        };
      }
      return {
        tool: name,
        source: 'Browser Cart Controller',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: `Không tìm thấy món "${targetQuery}" trong giỏ hàng`,
        llmPayload: {
          ok: false,
          error: `Không tìm thấy món "${targetQuery}" trong giỏ hàng hiện tại`,
          currentCartItems: cart.map(c => c.dishName)
        }
      };
    }

    // 6b. Xóa sạch giỏ hàng
    if (act === 'clear_cart') {
      const prevCount = cart.length;
      cart = [];
      if (typeof DB !== 'undefined' && DB.isReady) DB.saveCurrentUserCart(cart);
      if (typeof updateFloatingCartBar === 'function') updateFloatingCartBar();
      if (typeof renderCartView === 'function' && typeof currentView !== 'undefined' && currentView === 'cart') renderCartView();
      if (typeof showToast === 'function') showToast('deleteRegular', 'Đã xóa sạch toàn bộ giỏ hàng');
      return {
        tool: name,
        source: 'Browser Cart Controller',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: `Đã làm trống toàn bộ giỏ hàng (${prevCount} món đã xóa)`,
        llmPayload: { ok: true, clearedCount: prevCount, cartEmpty: true }
      };
    }

    // 6c. Áp dụng mã giảm giá
    if (act === 'apply_voucher') {
      const code = String(params.voucherCode || params.code || '').trim().toUpperCase();
      if (typeof applyPromoCode === 'function') {
        applyPromoCode(code);
      }
      return {
        tool: name,
        source: 'Browser Cart Controller',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: `Đã xử lý mã giảm giá "${code}"`,
        llmPayload: { ok: true, appliedVoucher: appliedVoucher }
      };
    }

    // 6d. Thêm món vào giỏ
    if (act === 'add_item') {
      const candidateId = String(params.itemId || '').trim();
      const directItem = candidateId ? getCatalogItemSmart(candidateId) : null;
      if (!directItem) {
        return {
          tool: name,
          source: 'Browser Cart Controller',
          retrievedIds: [],
          usedOrders: false,
          resultSummary: `Từ chối hành động: Chưa tìm kiếm bảng hàng, mã "${candidateId}" không tồn tại`,
          llmPayload: {
            ok: false,
            error: `Mã món "${candidateId}" không tồn tại hoặc chưa được tìm kiếm! Ở giai đoạn 1 bạn không được dùng cart_action luôn. Hãy gọi "search_items" để tìm món và lấy mã itemId có thật trước!`
          }
        };
      }
      const added = quickAddDishFromAI(directItem.id, params.quantity || 1, false);
      if (added) {
        return {
          tool: name,
          source: 'Browser Cart Controller',
          retrievedIds: [directItem.id],
          usedOrders: false,
          resultSummary: `Đã thêm ${added.quantity}x "${added.name}" vào giỏ hàng`,
          llmPayload: { ok: true, added }
        };
      }
      return {
        tool: name,
        source: 'Browser Cart Controller',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: `Không thể thêm "${directItem.name}" (món tạm hết hàng)`,
        llmPayload: { ok: false, error: 'Món tạm hết hàng' }
      };
    }
  }

  // 7. checkout_action (Thực hiện hành động thanh toán & tạo đơn hàng)
  if (name === 'checkout_action') {
    if (!cart || cart.length === 0) {
      return {
        tool: name,
        source: 'Browser Checkout Engine',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: 'Từ chối thanh toán: Giỏ hàng hiện đang trống',
        llmPayload: { ok: false, error: 'Giỏ hàng hiện đang trống, chưa có món ăn nào để thanh toán!' }
      };
    }

    const orderId = 'PTIT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const subtotal = cart.reduce((s, c) => s + c.totalPrice, 0);
    const shippingFee = 15000;
    let discountAmount = 0;
    if (appliedVoucher) {
      discountAmount = typeof computeVoucherDiscount === 'function'
        ? computeVoucherDiscount(appliedVoucher, subtotal, cart)
        : Math.min(subtotal, appliedVoucher.discount || 0);
    }
    const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('vi-VN');

    const resName = cart[0]?.restaurantName || 'Quán ăn quanh PTIT';
    const payMethod = params.paymentMethod || selectedPaymentMethod || 'cod';
    const payLabels = { cod: 'Tiền mặt khi nhận', qr: 'Chuyển khoản VietQR', momo: 'Ví MoMo' };

    const newOrder = {
      orderId,
      categoryStatus: 'delivering',
      statusText: 'Đang chuẩn bị món (Dự kiến 15-20 phút)',
      currentStep: 2,
      orderTime: `${dateStr}, ${nowStr}`,
      estimatedTime: 'Khoảng 15 - 20 phút nữa',
      resName,
      resAddress: 'Khu ẩm thực quanh Học viện PTIT',
      resPhone: '0901 234 567',
      deliveryAddress: userDeliveryInfo.address,
      recipientName: userDeliveryInfo.name,
      recipientPhone: userDeliveryInfo.phone,
      driverNote: params.note || userDeliveryInfo.note || '',
      items: [...cart],
      paymentMethod: payMethod,
      paymentMethodName: payLabels[payMethod] || 'Tiền mặt',
      subtotal,
      shippingFee,
      discountAmount,
      totalAmount,
      driver: {
        name: 'Nguyễn Văn Tài',
        phone: '0909 123 456',
        vehicle: '29-P1 889.24 • Honda Wave Alpha',
        rating: 4.9,
        avatar: '🛵'
      }
    };

    if (typeof DB !== 'undefined' && DB.isReady) {
      DB.recordOrderForCurrentUser(newOrder);
      if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
    } else {
      ordersList.unshift(newOrder);
    }

    const itemsSummary = cart.map(c => `${c.quantity}x ${c.dishName}`).join(', ');
    cart = [];
    if (typeof DB !== 'undefined' && DB.isReady) DB.saveCurrentUserCart(cart);
    if (typeof updateFloatingCartBar === 'function') updateFloatingCartBar();
    appliedVoucher = null;
    viewingOrderDetailId = newOrder.orderId;
    activityFilter = 'delivering';
    if (typeof showToast === 'function') showToast('checkmarkFilled', `Đã đặt thành công đơn hàng ${newOrder.orderId}!`);

    return {
      tool: name,
      source: 'Browser Checkout Engine',
      retrievedIds: newOrder.items.map(i => i.id).filter(Boolean),
      usedOrders: true,
      orderId: newOrder.orderId,
      resultSummary: `Đặt đơn ${newOrder.orderId} thành công (${formatVND(totalAmount)})`,
      llmPayload: {
        ok: true,
        orderId: newOrder.orderId,
        resName: newOrder.resName,
        itemsSummary,
        totalAmount,
        deliveryAddress: newOrder.deliveryAddress,
        recipientName: newOrder.recipientName,
        estimatedTime: newOrder.estimatedTime,
        driver: newOrder.driver,
        paymentMethod: newOrder.paymentMethodName
      }
    };
  }

  // 8. track_order (Tra cứu hành trình di chuyển đơn hàng)
  if (name === 'track_order') {
    const user = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;
    const allOrders = (user && Array.isArray(user.orders)) ? user.orders : ordersList;
    let targetOrder = null;
    if (params.orderId) {
      targetOrder = allOrders.find(o => String(o.orderId).toLowerCase().includes(String(params.orderId).toLowerCase()));
    } else {
      targetOrder = allOrders.find(o => o.categoryStatus === 'delivering') || allOrders[0];
    }
    if (!targetOrder) {
      return {
        tool: name,
        source: 'Browser Delivery Tracker',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: 'Không tìm thấy đơn hàng nào đang giao',
        llmPayload: { ok: false, message: 'Bạn chưa có đơn hàng nào đang giao hoặc mã đơn không khớp' }
      };
    }
    const stepDescriptions = {
      1: 'Đã nhận đơn hàng',
      2: 'Quán đang chuẩn bị món ăn',
      3: 'Tài xế đang giao tới bạn',
      4: 'Tài xế đã đến sảnh / cổng nhận món'
    };
    return {
      tool: name,
      source: 'Browser Delivery Tracker',
      retrievedIds: (targetOrder.items || []).map(i => i.id || i.dishId).filter(Boolean),
      usedOrders: true,
      orderId: targetOrder.orderId,
      resultSummary: `Đơn ${targetOrder.orderId}: ${targetOrder.statusText}`,
      llmPayload: {
        ok: true,
        orderId: targetOrder.orderId,
        statusText: targetOrder.statusText,
        categoryStatus: targetOrder.categoryStatus,
        currentStep: targetOrder.currentStep || 2,
        stepDescription: stepDescriptions[targetOrder.currentStep] || targetOrder.statusText,
        estimatedDeliveryTime: targetOrder.estimatedTime || '15 - 20 phút',
        orderTime: targetOrder.orderTime,
        restaurant: { name: targetOrder.resName, address: targetOrder.resAddress || 'Quanh PTIT' },
        recipient: { name: targetOrder.recipientName, address: targetOrder.deliveryAddress, phone: targetOrder.recipientPhone, note: targetOrder.driverNote || '' },
        driver: targetOrder.driver || { name: 'Nguyễn Văn Tài', phone: '0909 123 456', vehicle: '29-P1 889.24', rating: 4.9 },
        totalAmount: targetOrder.totalAmount,
        items: (targetOrder.items || []).map(i => ({ name: i.dishName || i.name, quantity: i.quantity, price: i.totalPrice }))
      }
    };
  }

  // 9. order_action (Tương tác với hành trình đơn hàng)
  if (name === 'order_action') {
    const user = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;
    const allOrders = (user && Array.isArray(user.orders)) ? user.orders : ordersList;
    let targetOrder = null;
    if (params.orderId) {
      targetOrder = allOrders.find(o => String(o.orderId).toLowerCase().includes(String(params.orderId).toLowerCase()));
    } else {
      targetOrder = allOrders.find(o => o.categoryStatus === 'delivering') || allOrders[0];
    }
    if (!targetOrder) {
      return {
        tool: name,
        source: 'Browser Delivery Controller',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: 'Không tìm thấy đơn hàng cần tương tác',
        llmPayload: { ok: false, error: 'Không tìm thấy đơn hàng tương ứng để thực hiện thao tác' }
      };
    }

    const act = params.action;
    if (act === 'urge_delivery') {
      if (typeof showToast === 'function') showToast('sparkleRegular', `Đã hối giao gấp cho đơn ${targetOrder.orderId}!`);
      return {
        tool: name,
        source: 'Browser Delivery Controller',
        retrievedIds: [],
        usedOrders: true,
        orderId: targetOrder.orderId,
        resultSummary: `Đã gửi tín hiệu hối giao gấp cho đơn ${targetOrder.orderId}`,
        llmPayload: { ok: true, message: `Đã gửi tín hiệu hối giao gấp tới tài xế ${targetOrder.driver?.name || 'giao hàng'}. Dự kiến giao: ${targetOrder.estimatedTime}.` }
      };
    }
    if (act === 'update_note') {
      targetOrder.driverNote = String(params.note || '');
      if (typeof DB !== 'undefined' && DB.isReady) DB.saveCurrentUserOrders(allOrders);
      if (typeof showToast === 'function') showToast('checkmarkFilled', `Đã cập nhật ghi chú giao hàng`);
      return {
        tool: name,
        source: 'Browser Delivery Controller',
        retrievedIds: [],
        usedOrders: true,
        orderId: targetOrder.orderId,
        resultSummary: `Đã đổi ghi chú đơn ${targetOrder.orderId}`,
        llmPayload: { ok: true, orderId: targetOrder.orderId, newNote: targetOrder.driverNote }
      };
    }
    if (act === 'call_shipper' || act === 'contact_driver') {
      return {
        tool: name,
        source: 'Browser Delivery Controller',
        retrievedIds: [],
        usedOrders: true,
        orderId: targetOrder.orderId,
        resultSummary: `Đã lấy số hotline tài xế ${targetOrder.driver?.name}`,
        llmPayload: { ok: true, driverName: targetOrder.driver?.name, driverPhone: targetOrder.driver?.phone, vehicle: targetOrder.driver?.vehicle }
      };
    }
    if (act === 'cancel_order') {
      if (typeof cancelActiveOrder === 'function') {
        cancelActiveOrder(targetOrder.orderId);
      } else {
        targetOrder.categoryStatus = 'cancelled';
        targetOrder.statusText = 'Đã hủy đơn hàng (Theo yêu cầu)';
        if (typeof DB !== 'undefined' && DB.isReady) DB.saveCurrentUserOrders(allOrders);
      }
      return {
        tool: name,
        source: 'Browser Delivery Controller',
        retrievedIds: [],
        usedOrders: true,
        orderId: targetOrder.orderId,
        resultSummary: `Đã hủy đơn hàng ${targetOrder.orderId}`,
        llmPayload: { ok: true, orderId: targetOrder.orderId, status: 'cancelled' }
      };
    }
    if (act === 'confirm_received') {
      if (typeof completeActiveOrder === 'function') {
        completeActiveOrder(targetOrder.orderId);
      } else {
        targetOrder.categoryStatus = 'completed';
        targetOrder.statusText = 'Giao hàng thành công';
        if (typeof DB !== 'undefined' && DB.isReady) DB.saveCurrentUserOrders(allOrders);
      }
      return {
        tool: name,
        source: 'Browser Delivery Controller',
        retrievedIds: [],
        usedOrders: true,
        orderId: targetOrder.orderId,
        resultSummary: `Đã hoàn tất đơn hàng ${targetOrder.orderId}`,
        llmPayload: { ok: true, orderId: targetOrder.orderId, status: 'completed' }
      };
    }
    if (act === 'reorder' || act === 'reorder_cancelled') {
      if (typeof reorderOrder === 'function') {
        reorderOrder(targetOrder.orderId);
      }
      return {
        tool: name,
        source: 'Browser Delivery Controller',
        retrievedIds: (targetOrder.items || []).map(i => i.id || i.dishId).filter(Boolean),
        usedOrders: true,
        orderId: targetOrder.orderId,
        resultSummary: `Đã nạp lại ${targetOrder.items?.length || 0} món từ đơn ${targetOrder.orderId} vào giỏ`,
        llmPayload: {
          ok: true,
          orderId: targetOrder.orderId,
          message: `Đã thêm lại toàn bộ món của đơn ${targetOrder.orderId} vào giỏ hàng thành công!`
        }
      };
    }
  }

  // 10. user_profile_action (Xem thông tin cài đặt, Sửa thông tin người dùng, Tự động lấy vị trí)
  if (name === 'user_profile_action') {
    const user = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;

    // Tự động lấy vị trí hiện tại
    if (params.action === 'detect_location' || params.useCurrentLocation) {
      const detectedAddr = 'Học viện Công nghệ Bưu chính Viễn thông (PTIT), Km10 Đường Trần Phú, P. Mộ Lao, Q. Hà Đông, Hà Nội';
      userDeliveryInfo.address = detectedAddr;
      userDeliveryInfo.shortAddress = 'PTIT Km10 Trần Phú, Hà Đông';
      userDeliveryInfo.label = 'PTIT Hà Đông';

      if (user && typeof DB !== 'undefined') {
        DB.updateUser(user.id, {
          address: detectedAddr,
          addressLabel: 'PTIT Hà Đông'
        });
      }
      if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
      if (typeof showToast === 'function') showToast('locationRegular', 'Đã tự động cập nhật vị trí hiện tại: PTIT Hà Đông');

      if (params.action === 'detect_location') {
        return {
          tool: name,
          source: 'Browser Geolocation Service',
          retrievedIds: [],
          usedOrders: false,
          resultSummary: 'Đã định vị thành công vị trí hiện tại',
          llmPayload: {
            ok: true,
            detectedAddress: detectedAddr,
            label: 'PTIT Hà Đông',
            message: 'Đã tự động xác định và cập nhật địa chỉ giao hàng theo vị trí GPS hiện tại của người dùng.'
          }
        };
      }
    }

    if (params.action === 'update') {
      // Kiểm tra định dạng số điện thoại
      if (params.phone && typeof isValidPhoneNumber === 'function' && !isValidPhoneNumber(params.phone)) {
        return {
          tool: name,
          source: 'Browser User Profile Manager',
          retrievedIds: [],
          usedOrders: false,
          resultSummary: 'Lỗi: Số điện thoại không hợp lệ',
          llmPayload: {
            ok: false,
            error: `Số điện thoại "${params.phone}" không đúng định dạng Việt Nam! Yêu cầu 10 số, bắt đầu bằng 03, 05, 07, 08, 09 (hoặc +84).`
          }
        };
      }

      // Kiểm tra định dạng Email
      if (params.email && typeof isValidEmail === 'function' && !isValidEmail(params.email)) {
        return {
          tool: name,
          source: 'Browser User Profile Manager',
          retrievedIds: [],
          usedOrders: false,
          resultSummary: 'Lỗi: Email không hợp lệ',
          llmPayload: {
            ok: false,
            error: `Email "${params.email}" không đúng định dạng (VD: sinhvien@stu.ptit.edu.vn hoặc user@gmail.com)!`
          }
        };
      }

      if (params.name) userDeliveryInfo.name = params.name;
      if (params.phone) userDeliveryInfo.phone = params.phone;
      if (params.email) userDeliveryInfo.email = params.email;
      if (params.address) {
        userDeliveryInfo.address = params.address;
        userDeliveryInfo.shortAddress = params.address.length > 30 ? params.address.substring(0, 30) + '...' : params.address;
      }
      if (params.addressLabel) userDeliveryInfo.label = params.addressLabel;
      if (params.note) userDeliveryInfo.note = params.note;

      if (user && typeof DB !== 'undefined') {
        const updates = {};
        if (params.name) updates.name = params.name;
        if (params.phone) updates.phone = params.phone;
        if (params.email) updates.email = params.email;
        if (params.address) updates.address = params.address;
        if (params.addressLabel) updates.addressLabel = params.addressLabel;
        if (params.note) updates.addressNote = params.note;
        DB.updateUser(user.id, updates);

        if (params.dailyCalorieGoal || params.dietaryNotes) {
          const hPatch = {};
          if (params.dailyCalorieGoal) hPatch.dailyCalorieGoal = Number(params.dailyCalorieGoal);
          if (params.dietaryNotes) hPatch.dietaryNotes = Array.isArray(params.dietaryNotes) ? params.dietaryNotes : [params.dietaryNotes];
          DB.updateUserHealthProfile(user.id, hPatch);
        }
      }
      if (typeof syncGlobalChromeUI === 'function') syncGlobalChromeUI();
      if (typeof showToast === 'function') showToast('checkmarkFilled', 'Đã cập nhật hồ sơ & cài đặt người dùng!');
      return {
        tool: name,
        source: 'Browser User Profile Manager',
        retrievedIds: [],
        usedOrders: false,
        resultSummary: 'Đã cập nhật thông tin cài đặt người dùng',
        llmPayload: {
          ok: true,
          updatedProfile: {
            name: userDeliveryInfo.name,
            phone: userDeliveryInfo.phone,
            email: userDeliveryInfo.email || (user ? user.email || '' : ''),
            address: userDeliveryInfo.address,
            addressLabel: userDeliveryInfo.label,
            note: userDeliveryInfo.note
          }
        }
      };
    }

    // Mặc định: view
    return {
      tool: name,
      source: 'Browser User Profile Manager',
      retrievedIds: [],
      usedOrders: false,
      resultSummary: `Hồ sơ ${userDeliveryInfo.name} (${userDeliveryInfo.phone})`,
      llmPayload: {
        ok: true,
        profile: {
          name: userDeliveryInfo.name,
          phone: userDeliveryInfo.phone,
          email: userDeliveryInfo.email || (user ? user.email || '' : ''),
          address: userDeliveryInfo.address,
          addressLabel: userDeliveryInfo.label || 'Văn phòng',
          defaultNote: userDeliveryInfo.note || '',
          memberTier: user?.memberTier || 'Thành viên',
          healthGoal: user?.healthProfile ? {
            dailyCalorieGoal: user.healthProfile.dailyCalorieGoal,
            dietaryNotes: user.healthProfile.dietaryNotes || []
          } : null
        }
      }
    };
  }

  return {
    tool: name,
    source: 'Software Router',
    retrievedIds: [],
    usedOrders: false,
    resultSummary: `Công cụ "${name}" không xác định`,
    llmPayload: { error: `Unknown tool: ${name}` }
  };
}

// ── Nhận diện & Xử lý Gemini Live API qua WebSocket (bidiGenerateContent) ──

function isGeminiLiveModel(model) {
  const m = String(model || '').toLowerCase();
  return m.includes('live-preview') || m.includes('realtime-exp') || m.includes('bidigeneratecontent') || m.includes('gemini-3.1-flash-live');
}

async function invokeGeminiRestFallback(systemPrompt, conversationTurns, options = {}) {
  const fallbackModel = options.model || 'gemini-2.5-flash';
  const apiKey = (aiConfig.apiKey || options.apiKey || '').trim();
  const maxTokens = options.maxTokens || 2000;
  const temperature = options.temperature ?? 0.45;

  const baseUrl = (aiConfig.endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
  const url = `${baseUrl}/models/${encodeURIComponent(fallbackModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = (conversationTurns || []).map(m => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m.content || m.text || '') }]
  })).filter(t => t.parts[0].text.trim().length > 0);

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Xin chào' }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens
    }
  };

  const { res, viaProxy } = await fetchViaLocalProxyOrDirect(
    url,
    'gemini',
    { 'Content-Type': 'application/json' },
    payload,
    'Gemini REST Fallback'
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map(p => p.text || '')
    .join('\n')
    .trim();
  return { text, viaProxy, model: fallbackModel, provider: 'gemini' };
}

async function invokeGeminiLiveWebSocket(systemPrompt, conversationTurns, options = {}) {
  const apiKey = (aiConfig.apiKey || options.apiKey || '').trim();
  if (!apiKey) throw new Error('Chưa nhập Gemini API Key để kết nối Gemini Live WebSocket');

  const rawModel = (options.model || aiConfig.model || 'gemini-3.1-flash-live-preview').trim();
  const cleanModel = rawModel.replace(/^models\//i, '');
  const modelResource = `models/${cleanModel}`;
  const maxTokens = options.maxTokens || 2048;
  const temperature = options.temperature ?? 0.45;

  // Endpoint chuẩn v1beta của Gemini Multimodal Live API
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;

  return new Promise((resolve, reject) => {
    const WS = (typeof window !== 'undefined' && window.WebSocket) ? window.WebSocket : (typeof globalThis !== 'undefined' ? globalThis.WebSocket : null);
    if (!WS) {
      return reject(new Error('Môi trường trình duyệt hiện tại không hỗ trợ WebSocket cho Gemini Live API'));
    }

    let ws;
    try {
      ws = new WS(wsUrl);
    } catch (e) {
      return reject(new Error(`Không thể khởi tạo WebSocket tới Gemini Live: ${e.message}`));
    }

    let fullText = '';
    let isSetupComplete = false;
    let isFinished = false;

    const cleanup = () => {
      try {
        if (ws && (ws.readyState === WS.OPEN || ws.readyState === WS.CONNECTING)) {
          ws.close();
        }
      } catch (_) { }
    };

    const triggerFallback = async (reasonMsg) => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      console.warn(`[Gemini Live] ${reasonMsg}. Tự động fallback sang REST API (gemini-2.5-flash)...`);
      if (typeof showToast === 'function') {
        showToast('infoRegular', 'Model Live âm thanh không trả về chữ, đã tự động chuyển sang Gemini 2.5 Flash!');
      }
      try {
        const fallbackRes = await invokeGeminiRestFallback(systemPrompt, conversationTurns, {
          ...options,
          model: 'gemini-2.5-flash'
        });
        resolve(fallbackRes);
      } catch (fbErr) {
        reject(new Error(`${reasonMsg}. Thử lại với REST thất bại: ${fbErr.message}`));
      }
    };

    const timeout = setTimeout(() => {
      if (isFinished) return;
      if (fullText.trim()) {
        isFinished = true;
        cleanup();
        resolve({ text: fullText.trim(), viaProxy: false, model: cleanModel, provider: 'gemini-live' });
      } else {
        triggerFallback('Quá thời gian kết nối WebSocket Gemini Live (Timeout sau 25s)');
      }
    }, 25000);

    ws.onopen = () => {
      // Gửi cấu hình Setup cho session Live (Hỗ trợ Audio + Bật Output Transcription để nhận text)
      const setupMsg = {
        setup: {
          model: modelResource,
          generationConfig: {
            responseModalities: ['AUDIO'],
            temperature: Math.min(Math.max(temperature, 0), 2),
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Aoede'
                }
              }
            }
          },
          outputAudioTranscription: {}
        }
      };
      if (systemPrompt && systemPrompt.trim()) {
        setupMsg.setup.systemInstruction = {
          parts: [{ text: systemPrompt.trim() }]
        };
      }
      try {
        ws.send(JSON.stringify(setupMsg));
      } catch (err) {
        triggerFallback(`Lỗi gửi gói tin Setup: ${err.message}`);
      }
    };

    ws.onmessage = async (event) => {
      let rawData = event.data;
      if (typeof Blob !== 'undefined' && rawData instanceof Blob) {
        try {
          rawData = await rawData.text();
        } catch (_) {
          return;
        }
      }
      let msg;
      try {
        msg = JSON.parse(rawData);
      } catch (_) {
        return;
      }

      // 2. Xử lý lỗi từ server Google
      if (msg.error) {
        triggerFallback(msg.error.message || `Lỗi Gemini Live WebSocket (${msg.error.code || 'unknown'})`);
        return;
      }

      // 3. Sau khi Setup hoàn tất, gửi nội dung câu hỏi/hội thoại của người dùng
      if (msg.setupComplete && !isSetupComplete) {
        isSetupComplete = true;
        const turns = (conversationTurns || []).map(m => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(m.content || m.text || '') }]
        })).filter(t => t.parts[0].text.trim().length > 0);

        const clientContentMsg = {
          clientContent: {
            turns: turns.length > 0 ? turns : [{ role: 'user', parts: [{ text: 'Xin chào' }] }],
            turnComplete: true
          }
        };
        try {
          ws.send(JSON.stringify(clientContentMsg));
        } catch (err) {
          triggerFallback(`Lỗi gửi clientContent: ${err.message}`);
        }
        return;
      }

      // 4. Nhận các phần văn bản được model sinh ra theo thời gian thực
      if (msg.serverContent) {
        // Nhận transcript văn bản của câu trả lời giọng nói
        if (msg.serverContent.outputTranscription?.text) {
          fullText += msg.serverContent.outputTranscription.text;
        }
        // Nhận text từ modelTurn thông thường (nếu có)
        const parts = msg.serverContent.modelTurn?.parts || [];
        for (const p of parts) {
          if (p.text) fullText += p.text;
        }

        if (msg.serverContent.turnComplete) {
          isFinished = true;
          clearTimeout(timeout);
          cleanup();
          if (fullText.trim()) {
            resolve({
              text: fullText.trim(),
              viaProxy: false,
              model: cleanModel,
              provider: 'gemini-live'
            });
          } else {
            triggerFallback('Gemini Live WebSocket báo hoàn tất turn nhưng không có văn bản');
          }
        }
      }
    };

    ws.onerror = (err) => {
      triggerFallback(`Lỗi kết nối Gemini Live WebSocket: ${err?.message || 'Lỗi mạng hoặc xác thực'}`);
    };

    ws.onclose = (event) => {
      if (isFinished) return;
      clearTimeout(timeout);
      if (fullText.trim()) {
        isFinished = true;
        cleanup();
        resolve({ text: fullText.trim(), viaProxy: false, model: cleanModel, provider: 'gemini-live' });
      } else {
        const detail = event.reason ? `mã ${event.code} (${event.reason})` : `mã ${event.code}`;
        triggerFallback(`WebSocket Gemini Live đã đóng (${detail})`);
      }
    };
  });
}

if (typeof window !== 'undefined') {
  window.isGeminiLiveModel = isGeminiLiveModel;
  window.invokeGeminiLiveWebSocket = invokeGeminiLiveWebSocket;
  window.invokeGeminiRestFallback = invokeGeminiRestFallback;
  window.stopAIChatGeneration = stopAIChatGeneration;
  window.retryAIChatMessage = retryAIChatMessage;
  window.copyAIMessageText = copyAIMessageText;
  window.syncAIMobileKeyboardViewport = syncAIMobileKeyboardViewport;
  window.handleAIChatInputFocus = handleAIChatInputFocus;
  window.handleAIChatInputBlur = handleAIChatInputBlur;
  window.initAIMobileKeyboardHandlers = initAIMobileKeyboardHandlers;
  try {
    Object.defineProperty(window, 'aiIsGenerating', {
      get: () => aiIsGenerating,
      set: (v) => { aiIsGenerating = v; },
      configurable: true
    });
  } catch (_) { }
}

// ── Gọi 1 lượt LLM duy nhất (Dùng chung cho mọi Giai đoạn & Tư vấn Dinh dưỡng) ──

async function invokeSingleTurnLLM(systemPrompt, conversationTurns, options = {}) {
  if (aiCurrentAbortController && aiCurrentAbortController.signal.aborted) {
    throw new Error('ABORTED_BY_USER');
  }
  const provider = aiConfig.provider;
  const model = (aiConfig.model || '').trim() || AI_PROVIDER_PRESETS[provider]?.defaultModel || 'gemini-2.5-flash';
  const apiKey = (aiConfig.apiKey || '').trim();
  const maxTokens = options.maxTokens || (model.includes('reasoner') ? 2500 : 1500);
  const temperature = options.temperature ?? 0.45;
  const stageLabel = options.stageLabel || '';

  if (provider === 'gemini') {
    // Nếu là model Gemini Live (ví dụ: gemini-3.1-flash-live-preview) -> kết nối trực tiếp qua WebSocket (bidiGenerateContent)
    if (isGeminiLiveModel(model)) {
      return await invokeGeminiLiveWebSocket(systemPrompt, conversationTurns, options);
    }

    const baseUrl = (aiConfig.endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const contents = conversationTurns.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    };

    try {
      const { res, viaProxy } = await fetchViaLocalProxyOrDirect(
        url,
        provider,
        { 'Content-Type': 'application/json' },
        payload,
        stageLabel
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        // Nếu Gemini báo lỗi model chỉ hỗ trợ WebSocket Live API (bidiGenerateContent), tự động fallback sang WebSocket
        if (/bidiGenerateContent|WebSocket|live-preview|realtime/i.test(errMsg)) {
          console.info('🔄 Phát hiện model Gemini Live API -> Tự động chuyển tiếp sang WebSocket (bidiGenerateContent)...');
          return await invokeGeminiLiveWebSocket(systemPrompt, conversationTurns, options);
        }
        throw new Error(errMsg);
      }
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || '')
        .join('\n')
        .trim();
      return { text, viaProxy, model, provider };
    } catch (err) {
      if (/bidiGenerateContent|WebSocket|live-preview|realtime/i.test(err.message)) {
        console.info('🔄 Phát hiện model Gemini Live API -> Tự động chuyển tiếp sang WebSocket (bidiGenerateContent)...');
        return await invokeGeminiLiveWebSocket(systemPrompt, conversationTurns, options);
      }
      throw err;
    }
  }

  // Chuẩn OpenAI-compatible (DeepSeek, OpenAI, Groq, OpenRouter, Custom Local Ollama / LM Studio)
  const rawEndpoint = (aiConfig.endpoint || AI_PROVIDER_PRESETS[provider]?.endpoint || '').trim();
  const endpoint = normalizeOpenAICompatibleEndpoint(rawEndpoint, provider);
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = (window.location.protocol.startsWith('http') ? window.location.href : 'http://localhost:3000');
    headers['X-Title'] = 'ptitngon Food Delivery AI';
  }

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...conversationTurns.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const payload = {
    model,
    messages: apiMessages,
    max_tokens: maxTokens
  };
  if (!model.includes('reasoner')) {
    payload.temperature = temperature;
  }

  const { res, viaProxy } = await fetchViaLocalProxyOrDirect(endpoint, provider, headers, payload, stageLabel);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
  }
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return { text, viaProxy, model, provider };
}

function parseToolCallDirective(rawText) {
  if (!rawText) return null;
  const regex = /<<<TOOL_CALL\s*([\s\S]*?)(?:TOOL_CALL>>>|$)/i;
  const match = rawText.match(regex);
  if (!match) return null;

  try {
    const cleaned = match[1]
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const calls = Array.isArray(parsed.calls)
      ? parsed.calls
      : (parsed.tool ? [{ tool: parsed.tool, params: parsed.params || {} }] : []);
    if (calls.length === 0) return null;
    return {
      thought: String(parsed.thought || '').trim(),
      calls: calls.slice(0, 8)
    };
  } catch (err) {
    console.warn('Không thể đọc khối TOOL_CALL từ AI:', err);
    return null;
  }
}

async function callExternalLLMAPI(conversationMessages) {
  const systemPrompt = buildAgenticSystemPrompt();
  const workingTurns = conversationMessages.slice(-8).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }));

  const agentTrace = {
    stagesCount: 0,
    thought: '',
    steps: []
  };
  const allRetrievedItemIds = [];
  let anyOrdersQueried = false;
  let relevantOrderId = null;
  let finalRawReply = '';
  let lastMeta = { viaProxy: false, model: aiConfig.model, provider: aiConfig.provider };

  for (let round = 1; round <= MAX_AGENT_TOOL_ROUNDS; round++) {
    if (aiCurrentAbortController && aiCurrentAbortController.signal.aborted) {
      throw new Error('ABORTED_BY_USER');
    }
    if (round === 1) {
      await setAILiveStageProgress('Đang phân tích yêu cầu của bạn');
    } else {
      await setAILiveStageProgress('Đang cân nhắc kết quả để trả lời');
    }

    const turnRes = await invokeSingleTurnLLM(systemPrompt, workingTurns, {
      stageLabel: `GiaiDoan-${round}`,
      temperature: round === 1 ? 0.3 : 0.6
    });
    lastMeta = turnRes;
    agentTrace.stagesCount = round;

    if (!turnRes.text) {
      throw new Error('API trả về phản hồi rỗng');
    }

    const toolDirective = (round < MAX_AGENT_TOOL_ROUNDS) ? parseToolCallDirective(turnRes.text) : null;

    if (toolDirective && toolDirective.calls.length > 0) {
      if (toolDirective.thought && !agentTrace.thought) {
        agentTrace.thought = toolDirective.thought;
      }

      // An toàn Giai đoạn 1: Ở lần tương tác đầu tiên, tuyệt đối không thực hiện action luôn
      // Nếu người dùng có yêu cầu thực hiện công việc, phải khảo sát/tìm kiếm trước, hành động chỉ thực hiện ở lần tương tác cuối
      if (round === 1) {
        toolDirective.calls.forEach(c => {
          if (isActionTool(c.tool)) {
            const rawDishHint = String(c.params?.itemId || c.params?.query || c.params?.dishName || c.params?.keyword || '').trim();
            c.tool = 'search_items';
            c.params = { query: rawDishHint, limit: 6 };
          }
        });
      }

      if (toolDirective.calls.length > 1) {
        await setAILiveStageProgress(`Đang xử lý ${toolDirective.calls.length} tác vụ cùng lúc...`);
      } else {
        await setAILiveStageProgress(getAIToolFriendlyLabel(toolDirective.calls[0].tool));
      }

      // Thực thi tuần tự các lệnh mà AI yêu cầu để bảo đảm tính toàn vẹn và dữ liệu phụ thuộc
      const executedResults = [];
      for (let idx = 0; idx < toolDirective.calls.length; idx++) {
        const c = toolDirective.calls[idx];
        if (idx > 0 && toolDirective.calls.length > 1) {
          await setAILiveStageProgress(getAIToolFriendlyLabel(c.tool));
        }
        const execRes = await executeSoftwareToolCall(c.tool, c.params);
        executedResults.push(execRes);
      }

      const toolResponseBatch = [];
      for (let idx = 0; idx < executedResults.length; idx++) {
        const execRes = executedResults[idx];
        const rawCall = toolDirective.calls[idx];
        agentTrace.steps.push({
          round,
          tool: execRes.tool,
          paramsText: JSON.stringify(rawCall.params || {}),
          source: execRes.source,
          resultSummary: execRes.resultSummary
        });

        execRes.retrievedIds.forEach(id => {
          if (!allRetrievedItemIds.includes(id)) allRetrievedItemIds.push(id);
        });
        if (execRes.usedOrders) {
          anyOrdersQueried = true;
          if (execRes.orderId) relevantOrderId = execRes.orderId;
        }

        // Nếu AI gọi nhiều lệnh một lượt, hiển thị lần lượt từng việc (trừ lệnh đầu đã hiện ở trên)
        if (idx > 0) {
          await setAILiveStageProgress(getAIToolFriendlyLabel(rawCall.tool));
        }

        toolResponseBatch.push({
          tool: execRes.tool,
          result: execRes.llmPayload
        });
      }

      workingTurns.push({
        role: 'assistant',
        content: turnRes.text
      });

      const isFinalAnswerOnlyNext = (round === MAX_AGENT_TOOL_ROUNDS - 1);
      const isLastToolCallNext = (round === MAX_AGENT_TOOL_ROUNDS - 2);
      const nextInstruction = isFinalAnswerOnlyNext
        ? 'Đây là dữ liệu cuối cùng từ phần mềm. Lượt tiếp theo chỉ dùng để tổng hợp câu trả lời cuối cùng cho người dùng (KHÔNG xuất thêm <<<TOOL_CALL>>> nữa, kèm khối <<<RECOMMEND_JSON ... RECOMMEND_JSON>>> ở cuối nếu phù hợp). Tuyệt đối chỉ xác nhận đã thêm/hủy/đặt món nếu trong <<<TOOL_RESULTS>>> ở trên đã thực sự có kết quả thành công của Action Tool tương ứng.'
        : isLastToolCallNext
          ? 'Đây là dữ liệu từ phần mềm. Nếu người dùng có yêu cầu thực hiện công việc (như thêm vào giỏ hàng, hủy đơn, áp voucher...), hãy gọi Action Tool ở lượt tiếp theo này với mã id thật đã xác thực, hoặc tổng hợp câu trả lời chi tiết cho người dùng kèm khối <<<RECOMMEND_JSON ... RECOMMEND_JSON>>> ở cuối.'
          : 'Nếu kết quả trả về "totalMatched": 0 do điều kiện quá hẹp, bạn có thể xuất 1 lượt <<<TOOL_CALL>>> nới lỏng điều kiện lọc. Ngược lại, nếu đã có dữ liệu phù hợp: nếu người dùng có yêu cầu thực hiện công việc, bạn có thể thực hiện hành động đó ở lượt này với mã itemId thật đã xác thực, hoặc viết câu trả lời tư vấn kèm khối <<<RECOMMEND_JSON ... RECOMMEND_JSON>>>.';

      workingTurns.push({
        role: 'user',
        content: `<<<TOOL_RESULTS\n${JSON.stringify(toolResponseBatch, null, 2)}\nTOOL_RESULTS>>>\n\n${nextInstruction}`
      });

      continue;
    }

    // Không còn TOOL_CALL -> Đây là câu trả lời cuối cùng cho người dùng
    finalRawReply = turnRes.text;
    break;
  }

  const parsed = parseLLMVisualResponse(finalRawReply, allRetrievedItemIds);
  const badgeLabel = AI_PROVIDER_PRESETS[lastMeta.provider]?.badge || 'API';
  const stageSuffix = agentTrace.steps.length > 0 ? ` • ${agentTrace.stagesCount} giai đoạn` : '';

  return {
    content: parsed.cleanText,
    dishIds: parsed.dishIds,
    showOrders: Boolean(parsed.showOrders || anyOrdersQueried),
    orderId: relevantOrderId || null,
    followUps: parsed.followUps,
    agentTrace: agentTrace.steps.length > 0 ? agentTrace : null,
    sourceBadge: `${badgeLabel} (${lastMeta.model})${lastMeta.viaProxy ? ' • Proxy' : ''}${stageSuffix}`
  };
}

function parseLLMVisualResponse(rawText, candidateItemIds = []) {
  let cleanText = String(rawText || '')
    .replace(/<<<TOOL_CALL[\s\S]*?(?:TOOL_CALL>>>|$)/gi, '')
    .trim();
  let dishIds = [];
  let showOrders = false;
  let followUps = [];

  const regex = /<<<RECOMMEND_JSON\s*([\s\S]*?)\s*RECOMMEND_JSON>>>/i;
  const match = cleanText.match(regex);

  if (match) {
    cleanText = cleanText.replace(regex, '').trim();
    try {
      const jsonStr = match[1].replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const obj = JSON.parse(jsonStr);
      if (Array.isArray(obj.dishIds)) {
        dishIds = obj.dishIds.filter(id => getCatalogItemSmart(id));
      }
      if (obj.showOrders) showOrders = true;
      if (Array.isArray(obj.followUps)) {
        followUps = obj.followUps.map(s => String(s).trim()).filter(Boolean).slice(0, 3);
      }
    } catch (e) {
      console.warn('Không thể parse RECOMMEND_JSON:', e);
    }
  }

  // Fallback tự động khớp tên mặt hàng trong văn bản nếu model quên xuất dishIds
  if (dishIds.length === 0) {
    dishIds = extractMentionedDishesFallback(cleanText, candidateItemIds);
  }

  if (followUps.length === 0) {
    followUps = [
      'Gợi ý thêm đồ uống đi kèm',
      'Món nào đang có Freeship 0đ?',
      'Xem các món dưới 35.000đ'
    ];
  }

  return { cleanText, dishIds: dishIds.slice(0, 6), showOrders, followUps };
}

function extractMentionedDishesFallback(text, candidateItemIds = []) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = [];

  // Ưu tiên dò trên danh sách mặt hàng vừa lấy từ Server Search API
  for (const id of candidateItemIds) {
    const it = getCatalogItemSmart(id);
    if (it && it.name && it.name.length >= 4 && lower.includes(it.name.toLowerCase())) {
      matched.push(it.id);
      if (matched.length >= 6) return matched;
    }
  }

  if (typeof DB !== 'undefined' && DB.isReady) {
    const allItems = DB.getItems();
    for (const it of allItems) {
      if (it.name && it.name.length >= 5 && lower.includes(it.name.toLowerCase()) && !matched.includes(it.id)) {
        matched.push(it.id);
        if (matched.length >= 6) break;
      }
    }
  }
  return matched;
}

// =========================================================================
// 5. ENGINE AI THÔNG MINH NỘI BỘ (ĐỌC TRỰC TIẾP BẢNG HÀNG & ĐƠN ĐÃ ĐẶT)
// =========================================================================

function removeVnTones(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function parseBudgetFromText(qLower) {
  // Hỗ trợ "dưới 40k", "35k", "50.000", "50000", "45 nghìn", "45 ngàn"
  const kMatch = qLower.match(/(?:duoi|tầm|tam|khoang|gia|<|<=|\b)\s*(\d{2,3})\s*(?:k|nghin|ngan)\b/);
  if (kMatch) {
    return Number(kMatch[1]) * 1000;
  }
  const vndMatch = qLower.match(/(\d{2,3})[.,](\d{3})\s*(?:d|đ|vnd)?/);
  if (vndMatch) {
    return Number(vndMatch[1] + vndMatch[2]);
  }
  const plainMatch = qLower.match(/\b(\d{5,6})\s*(?:d|đ|vnd)\b/);
  if (plainMatch) {
    return Number(plainMatch[1]);
  }
  return null;
}

function generateSmartLocalAIResponse(userMessage) {
  const activeUser = DB.getCurrentUser();
  const allItems = DB.getItems();
  const inStockItems = allItems.filter(it => it.inStock !== false);
  const allCats = DB.getCategories();
  const stores = DB.data.restaurants || [];
  const userOrders = (activeUser && Array.isArray(activeUser.orders)) ? activeUser.orders : [];

  const qRaw = userMessage.trim();
  const qLower = qRaw.toLowerCase();
  const qAscii = removeVnTones(qRaw);

  // ── CASE 0: Tư vấn Dinh dưỡng, Kcal, Tập Gym, Giữ dáng, Cân nặng theo Hồ sơ Người dùng ──
  if (
    typeof getTodayNutritionSummary === 'function' &&
    typeof getPersonalizedDishRecommendations === 'function' &&
    (
      qAscii.includes('kcal') ||
      qAscii.includes('calo') ||
      qAscii.includes('dinh duong') ||
      qAscii.includes('tap gym') ||
      qAscii.includes('tang co') ||
      qAscii.includes('giu dang') ||
      qAscii.includes('giam can') ||
      qAscii.includes('eat clean') ||
      qAscii.includes('thuc don') ||
      qAscii.includes('can nang')
    )
  ) {
    const nut = getTodayNutritionSummary(activeUser);
    const pMeta = getPersonaMeta(nut.hp.personaType);
    const mode = qAscii.includes('gym') || qAscii.includes('tang co')
      ? 'high_protein'
      : (qAscii.includes('giam can') || qAscii.includes('it calo'))
        ? 'low_cal'
        : 'best';
    const recs = getPersonalizedDishRecommendations(activeUser, mode, 5);
    const recLines = recs.map((r, i) =>
      `${i + 1}. **${r.item.name}** (~**${r.prof.calories} kcal** • Đạm **${r.prof.protein}g** • Healthy **${r.prof.healthyScore}/10**) — *${r.reasonText}*`
    ).join('\n');

    return {
      content: `${pMeta.icon} **Thực đơn cá nhân hóa cho ${activeUser ? activeUser.name : 'bạn'} (${pMeta.shortLabel} • ${nut.hp.weightKg}kg, BMI ${nut.hp.bmiInfo.bmi}):**\n- **Quỹ năng lượng hôm nay:** Đã nạp **${nut.consumed.calories} / ${nut.hp.dailyCalorieGoal} kcal** (Còn lại **${Math.max(0, nut.remainingCalories)} kcal** • Mục tiêu Đạm **${nut.hp.macroGoals.protein}g/ngày**).\n\n🥗 **Top món ăn được chấm điểm phù hợp nhất với thể trạng của bạn:**\n${recLines}\n\nBạn có thể bấm vào từng thẻ món bên dưới để xem chi tiết nguyên liệu hoặc thêm vào giỏ nhé!`,
      dishIds: recs.map(r => r.item.id),
      showOrders: false,
      followUps: ['Món giàu đạm cho người tập Gym', 'Món giữ dáng ít calo dưới 420 kcal', 'Kiểm tra giỏ hàng của mình'],
      sourceBadge: '🥗 AI Dinh dưỡng • Cá nhân hóa Kcal'
    };
  }

  // ── CASE 1: Hỏi về Giỏ hàng & Voucher khuyến mãi ──
  if (
    qAscii.includes('gio hang') ||
    (qAscii.includes('voucher') && cart.length > 0) ||
    qAscii.includes('ma giam gia')
  ) {
    if (cart.length === 0) {
      const topPicks = inStockItems.slice(0, 4);
      return {
        content: `🛒 **Giỏ hàng của bạn hiện đang trống!**\n\nHệ thống đang có các mã siêu hời:\n- **PTITNGON50**: Giảm **50%** (tối đa 50.000đ) cho mọi đơn.\n- **HUNGCHIENGION**: Giảm thẳng **50.000đ**.\n- **FREESHIP**: Miễn phí giao hàng 0đ.\n\nBạn có thể bấm **+ Giỏ** ngay trên các món bán chạy bên dưới để áp mã nhé:`,
        dishIds: topPicks.map(i => i.id),
        showOrders: false,
        followUps: ['Gợi ý món ngon dưới 40K', 'Ghép combo ăn trưa + trà sữa', 'Xem các món mình đã đặt'],
        sourceBadge: '⚡ AI Nội bộ • Đọc Giỏ hàng'
      };
    }

    const subtotal = cart.reduce((s, c) => s + c.totalPrice, 0);
    const totalQty = cart.reduce((s, c) => s + c.quantity, 0);
    const discount50 = Math.min(Math.round(subtotal * 0.5), 50000);
    const bestCode = subtotal >= 60000 ? 'PTITNGON50' : 'FREESHIP';

    // Gợi ý món ăn kèm / đồ uống cùng quán hoặc tráng miệng
    const firstStoreId = cart[0].restaurantId;
    const sameStoreDrinksOrSides = inStockItems.filter(it =>
      !cart.some(c => c.dishName === it.name) &&
      (Number(it.restaurantId) === Number(firstStoreId) || it.category === 'Trà sữa' || it.category === 'Cà phê' || it.category === 'Chè')
    ).slice(0, 4);

    const cartLines = cart.map(c => `- **${c.quantity}x ${c.dishName}** (${c.size?.name || 'Tiêu chuẩn'}) — **${formatVND(c.totalPrice)}**`).join('\n');

    return {
      content: `🛒 **Giỏ hàng hiện tại của ${activeUser ? activeUser.name : 'bạn'} (${totalQty} món — Tạm tính: ${formatVND(subtotal)}):**\n${cartLines}\n\n💡 **Tư vấn tối ưu hóa đơn:**\n- Dùng mã **${bestCode}** khi thanh toán: với **PTITNGON50** bạn được giảm ngay **${formatVND(discount50)}**!\n- Bạn có muốn thêm món phụ hoặc đồ uống giải khát đi kèm bên dưới không?`,
      dishIds: sameStoreDrinksOrSides.map(i => i.id),
      showOrders: false,
      followUps: ['Gợi ý thêm trà sữa dưới 35K', 'Xem lịch sử đơn mình đã đặt', 'Món tráng miệng ngon'],
      sourceBadge: '⚡ AI Nội bộ • Đọc Giỏ hàng'
    };
  }

  // ── CASE 2: Hỏi về Lịch sử đơn hàng / Những mặt hàng ĐÃ ĐẶT / Gu cá nhân ──
  if (
    qAscii.includes('da dat') ||
    qAscii.includes('tung dat') ||
    qAscii.includes('tung an') ||
    qAscii.includes('lich su') ||
    qAscii.includes('don hang cua minh') ||
    qAscii.includes('don cu') ||
    qAscii.includes('dang giao') ||
    qAscii.includes('hop khau vi') ||
    qAscii.includes('hop gu')
  ) {
    if (userOrders.length === 0) {
      const starterDishes = inStockItems.slice(0, 5);
      return {
        content: `🧾 Hồ sơ **${activeUser ? activeUser.name : 'của bạn'}** hiện chưa có đơn đặt hàng nào trong lịch sử.\n\nDưới đây là **Top 5 món Best-seller** được sinh viên PTIT đặt nhiều nhất để bạn mở hàng đơn đầu tiên kèm mã **PTITNGON50 (-50%)**:`,
        dishIds: starterDishes.map(i => i.id),
        showOrders: false,
        followUps: ['Món ngon dưới 35.000đ', 'Quán Freeship 0đ gần nhất', 'Combo ăn trưa + đồ uống'],
        sourceBadge: '⚡ AI Nội bộ • Đọc Hồ sơ'
      };
    }

    // Thống kê mặt hàng đã đặt
    const orderedDishNames = [];
    const orderedStoreIds = new Set();
    let totalSpent = 0;

    userOrders.forEach(o => {
      if (o.restaurantId) orderedStoreIds.add(Number(o.restaurantId));
      if (o.categoryStatus !== 'cancelled') totalSpent += (Number(o.totalAmount) || 0);
      if (Array.isArray(o.items)) {
        o.items.forEach(it => orderedDishNames.push(`${it.qty || 1}x ${it.name}`));
      } else if (o.itemsSummary) {
        orderedDishNames.push(o.itemsSummary);
      }
    });

    // Tìm các món liên quan tới quán quen hoặc cùng danh mục mà khách chưa thử / hay ăn
    const favCategories = new Set();
    stores.forEach(s => {
      if (orderedStoreIds.has(Number(s.id))) favCategories.add(s.category);
    });

    let recommendedForUser = inStockItems.filter(it =>
      orderedStoreIds.has(Number(it.restaurantId)) || favCategories.has(it.category)
    );
    if (recommendedForUser.length < 4) {
      recommendedForUser = [...recommendedForUser, ...inStockItems.slice(0, 6)];
    }
    // Khử trùng và lấy 5 món hấp dẫn
    const uniqueRecIds = [...new Set(recommendedForUser.map(i => i.id))].slice(0, 5);

    const deliveringOrders = userOrders.filter(o => o.categoryStatus === 'delivering');
    const delivNote = deliveringOrders.length > 0
      ? `\n- 🛵 Hiện bạn có **${deliveringOrders.length} đơn đang giao**: **${deliveringOrders.map(d => `${d.orderId} (${d.restaurantName})`).join(', ')}**.`
      : '';

    return {
      content: `🧾 **Tổng hợp lịch sử đặt món của ${activeUser.name}:**\n- Tổng số đơn đã ghi nhớ: **${userOrders.length} đơn** (Tổng chi tiêu: **${formatVND(totalSpent)}**).${delivNote}\n- **Các mặt hàng bạn đã đặt:** ${orderedDishNames.slice(0, 6).join(' • ')}.\n\n🎯 **Gợi ý chuẩn gu của bạn:** Dựa trên khẩu vị bạn yêu thích (${[...favCategories].join(', ') || 'Đậm đà, nóng giòn'}), mình chọn ra các món rất hợp gu bên dưới để bạn đổi vị hoặc đặt lại nhanh:`,
      dishIds: uniqueRecIds,
      showOrders: true,
      followUps: ['Gợi ý món mới lạ mình chưa thử', 'Combo tiết kiệm dưới 65K', 'Món tráng miệng & trà sữa'],
      sourceBadge: '⚡ AI Nội bộ • Đọc Đơn đã đặt'
    };
  }

  // ── CASE 3: Hỏi tổng quan Toàn bộ Bảng hàng / Danh mục / Thống kê Database ──
  if (
    qAscii.includes('bang hang') ||
    qAscii.includes('toan bo mat hang') ||
    qAscii.includes('bao nhieu mon') ||
    qAscii.includes('thong ke') ||
    qAscii.includes('tat ca danh muc') ||
    qAscii.includes('danh sach loai')
  ) {
    const outCount = allItems.length - inStockItems.length;
    const customItems = allItems.filter(i => i.isCustom);
    const customCats = allCats.filter(c => c.isCustom);
    const prices = allItems.map(i => Number(i.price) || 0).filter(p => p > 0);
    const minP = prices.length ? Math.min(...prices) : 0;
    const maxP = prices.length ? Math.max(...prices) : 0;
    const avgP = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

    const catPreview = allCats.map(c => `${c.icon} ${c.name}`).join(', ');
    const showcase = [
      ...customItems.slice(0, 2),
      ...inStockItems.filter((_, idx) => idx % 18 === 0).slice(0, 5)
    ].slice(0, 5);

    return {
      content: `📊 **Báo cáo Trực tiếp Toàn Bộ Bảng Mặt Hàng (\`database.json\`):**\n- **Tổng số mặt hàng:** **${allItems.length} món** (Đang còn hàng: **${inStockItems.length}** • Tạm hết: **${outCount}**${customItems.length > 0 ? ` • Mặt hàng tùy chỉnh mới thêm: **${customItems.length}**` : ''}).\n- **Tổng số cửa hàng:** **${stores.length} gian hàng** quanh khu vực PTIT.\n- ** Mức giá:** Từ **${formatVND(minP)}** đến **${formatVND(maxP)}** (Trung bình khoảng **${formatVND(avgP)}**/món).\n- **${allCats.length} Danh mục mặt hàng${customCats.length ? ` (${customCats.length} tùy chỉnh)` : ''}:** ${catPreview}.\n\nDưới đây là một số mặt hàng tiêu biểu trong bảng hàng:`,
      dishIds: showcase.map(i => i.id),
      showOrders: false,
      followUps: ['Tìm các món rẻ nhất bảng hàng', 'Gợi ý các món dưới 40.000đ', 'Món nào thuộc quán Freeship 0đ?'],
      sourceBadge: `⚡ AI Nội bộ • Đọc ${allItems.length} mặt hàng`
    };
  }

  // ── CASE 4: Thiết kế Combo (Ăn chính + Đồ uống / Tráng miệng) ──
  if (qAscii.includes('combo') || (qAscii.includes('an') && (qAscii.includes('uong') || qAscii.includes('nuoc') || qAscii.includes('tra sua')))) {
    const budget = parseBudgetFromText(qAscii) || 80000;
    const drinkCats = ['Trà sữa', 'Cà phê', 'Chè'];
    const drinks = inStockItems.filter(it => drinkCats.includes(it.category) && it.price <= Math.max(35000, budget * 0.5));
    const mains = inStockItems.filter(it => !drinkCats.includes(it.category) && it.price <= budget * 0.65);

    const pickMain1 = mains[Math.floor(Math.random() * Math.min(8, mains.length))] || inStockItems[0];
    const pickDrink1 = drinks.find(d => (pickMain1.price + d.price) <= budget + 5000) || drinks[0] || inStockItems[1];

    const pickMain2 = mains.find(m => m.id !== pickMain1.id && m.category !== pickMain1.category) || mains[1];
    const pickDrink2 = drinks.find(d => d.id !== pickDrink1.id) || drinks[1];

    const comboPicks = [pickMain1, pickDrink1, pickMain2, pickDrink2].filter(Boolean);
    const pairTotal = (pickMain1?.price || 0) + (pickDrink1?.price || 0);

    return {
      content: `🍱 **Gợi ý Combo Ăn ngon + Giải khát cực hời dành cho bạn:**\n\n- **Combo Đề xuất #1 (${formatVND(pairTotal)}):** **${pickMain1?.name}** (${formatVND(pickMain1?.price)}) kết hợp cùng **${pickDrink1?.name}** (${formatVND(pickDrink1?.price)}).\n${pickMain2 && pickDrink2 ? `- **Combo Đổi vị #2 (${formatVND(pickMain2.price + pickDrink2.price)}):** **${pickMain2.name}** (${formatVND(pickMain2.price)}) + **${pickDrink2.name}** (${formatVND(pickDrink2.price)}).\n` : ''}\n💡 *Mẹo:* Áp thêm mã **PTITNGON50** ở bước Giỏ hàng để giảm tới **50%**! Bạn có thể bấm **⚡ Thêm cả món vào giỏ** ngay bên dưới:`,
      dishIds: [...new Set(comboPicks.map(i => i.id))],
      showOrders: false,
      followUps: ['Đổi sang combo dưới 60.000đ', 'Gợi ý thêm món ăn vặt', 'Xem giỏ hàng của mình'],
      sourceBadge: '⚡ AI Nội bộ • Thiết kế Combo'
    };
  }

  // ── CASE 5: Truy vấn thông minh theo Ngân sách + Freeship + Khẩu vị + Tên món / Danh mục ──
  const budgetLimit = parseBudgetFromText(qAscii);
  const wantFreeship = qAscii.includes('freeship') || qAscii.includes('0d') || qAscii.includes('mien phi ship');
  const wantFastOrNear = qAscii.includes('gan') || qAscii.includes('nhanh') || qAscii.includes('15 phut');
  const wantCheap = qAscii.includes('re') || qAscii.includes('sinh vien') || qAscii.includes('tiet kiem') || qAscii.includes('binh dan');
  const wantSpicy = qAscii.includes('cay') || qAscii.includes('te') || qAscii.includes('ot') || qAscii.includes('hoa nguc');
  const wantCrispy = qAscii.includes('chien') || qAscii.includes('gion') || qAscii.includes('ran') || qAscii.includes('nuong');
  const wantHealthy = qAscii.includes('healthy') || qAscii.includes('thanh dam') || qAscii.includes('it dau') || qAscii.includes('rau') || qAscii.includes('giam can') || qAscii.includes('nhe bung');
  const wantHotSoup = qAscii.includes('nuoc') || qAscii.includes('nong hoi') || qAscii.includes('mua') || qAscii.includes('bun') || qAscii.includes('pho') || qAscii.includes('chao') || qAscii.includes('lau');
  const wantDrinkSweet = qAscii.includes('tra sua') || qAscii.includes('ca phe') || qAscii.includes('coffee') || qAscii.includes('che') || qAscii.includes('ngot') || qAscii.includes('trang mieng') || qAscii.includes('an vat');

  // Tách từ khóa ý nghĩa từ câu hỏi người dùng
  const stopWords = new Set(['goi', 'cho', 'minh', 'toi', 'ban', 'cac', 'nhung', 'mon', 'nao', 'ngon', 'nhat', 'quanh', 'ptit', 'dang', 'con', 'hang', 'trong', 'bang', 'voi', 'gia', 'duoi', 'tam', 'khoang', 'xem', 'tim', 'giup', 'nhe', 'nha', 'an', 'gi', 'hom', 'nay', 'cua', 'quan', 'mot', 'vai']);
  const queryTokens = qAscii
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  const storeMap = new Map(stores.map(s => [Number(s.id), s]));

  const scored = inStockItems.map(item => {
    let score = 0;
    const store = storeMap.get(Number(item.restaurantId));
    const itemNameAscii = removeVnTones(item.name);
    const catAscii = removeVnTones(item.category);
    const descAscii = removeVnTones(item.description || '');
    const storeAscii = removeVnTones(item.restaurantName || '');
    const fullBlob = `${itemNameAscii} ${catAscii} ${descAscii} ${storeAscii}`;

    // Lọc cứng theo ngân sách nếu người dùng nêu rõ mức trần
    if (budgetLimit && item.price > budgetLimit) {
      return { item, store, score: -999 };
    }
    if (wantFreeship && store && !store.isFreeship) {
      return { item, store, score: -500 };
    }

    // Khớp trực tiếp cụm tên danh mục hoặc tên món
    if (itemNameAscii.includes(qAscii) && qAscii.length >= 3) score += 60;
    if (catAscii.includes(qAscii) && qAscii.length >= 3) score += 50;
    allCats.forEach(c => {
      const cNameA = removeVnTones(c.name);
      if (cNameA.length >= 3 && qAscii.includes(cNameA) && catAscii === cNameA) {
        score += 55;
      }
    });

    // Khớp theo từng token
    queryTokens.forEach(tk => {
      if (itemNameAscii.includes(tk)) score += 16;
      if (catAscii.includes(tk)) score += 14;
      if (storeAscii.includes(tk)) score += 10;
      if (descAscii.includes(tk)) score += 7;
    });

    // Khớp theo ý định ẩm thực
    if (wantSpicy && (fullBlob.includes('cay') || fullBlob.includes('ot') || fullBlob.includes('sa te') || fullBlob.includes('hoa nguc') || catAscii.includes('bun bo') || catAscii.includes('lau'))) {
      score += 25;
    }
    if (wantCrispy && (fullBlob.includes('gion') || fullBlob.includes('chien') || fullBlob.includes('ran') || fullBlob.includes('nuong') || catAscii.includes('ga ran') || catAscii.includes('banh xeo') || catAscii.includes('banh mi'))) {
      score += 25;
    }
    if (wantHealthy && (catAscii.includes('goi cuon') || catAscii.includes('sushi') || catAscii.includes('chao') || fullBlob.includes('thanh dam') || fullBlob.includes('rau') || fullBlob.includes('tuoi'))) {
      score += 26;
    }
    if (wantHotSoup && (catAscii.includes('pho') || catAscii.includes('bun') || catAscii.includes('chao') || catAscii.includes('lau') || catAscii.includes('hu tieu') || catAscii.includes('mi quang'))) {
      score += 22;
    }
    if (wantDrinkSweet && (catAscii.includes('tra sua') || catAscii.includes('ca phe') || catAscii.includes('che') || fullBlob.includes('tran chau') || fullBlob.includes('ngot'))) {
      score += 28;
    }
    if (wantFreeship && store?.isFreeship) score += 20;
    if (wantFastOrNear && store) {
      score += Math.max(0, 20 - (Number(store.distance) || 1) * 8);
    }
    if (wantCheap || budgetLimit) {
      score += Math.max(0, Math.round((65000 - item.price) / 2500));
    }
    if (item.isCustom) score += 4;
    if (store?.rating) score += Number(store.rating) * 1.5;

    return { item, store, score };
  }).filter(x => x.score > -100);

  scored.sort((a, b) => b.score - a.score || a.item.price - b.item.price);

  const topResults = scored.slice(0, 5);
  if (topResults.length === 0) {
    const fallbackCheap = [...inStockItems].sort((a, b) => a.price - b.price).slice(0, 4);
    return {
      content: `Mình đã kiểm tra toàn bộ **${allItems.length} mặt hàng** nhưng chưa thấy món nào khớp chính xác mức lọc "${qRaw}".\n\nTuy nhiên, đây là các món **giá tiết kiệm nhất đang còn hàng** trong hệ thống để bạn tham khảo nhé:`,
      dishIds: fallbackCheap.map(i => i.id),
      showOrders: false,
      followUps: ['Xem tất cả món dưới 45.000đ', 'Gợi ý quán Freeship 0đ', 'Xem toàn bộ bảng hàng'],
      sourceBadge: '⚡ AI Nội bộ • Đọc Bảng hàng'
    };
  }

  const bulletLines = topResults.slice(0, 4).map(({ item, store }) => {
    const shipTag = store?.isFreeship ? ' • 🚚 Freeship 0đ' : '';
    const sizesInfo = Array.isArray(item.sizes) && item.sizes.length > 1
      ? ` *(Có ${item.sizes.length} cỡ)*`
      : '';
    return `- **${item.name}** — **${formatVND(item.price)}** tại *${item.restaurantName}*${shipTag}${sizesInfo}`;
  }).join('\n');

  let introHeader = `🍽️ Mình đã tra cứu bảng hàng và chọn ra **${topResults.length} món phù hợp nhất** cho yêu cầu của bạn:`;
  if (budgetLimit) {
    introHeader = `💸 Với ngân sách **dưới ${formatVND(budgetLimit)}**, đây là **${topResults.length} món ngon đang còn hàng** đáng thử nhất:`;
  } else if (wantFreeship) {
    introHeader = `🚚 Đây là những món nổi bật thuộc các **quán Freeship 0đ giao nhanh** quanh PTIT:`;
  } else if (wantHealthy) {
    introHeader = `🥗 Gợi ý thực đơn **thanh đạm, tươi ngon, nhẹ bụng** từ bảng hàng cho bạn:`;
  } else if (wantSpicy || wantCrispy) {
    introHeader = `🔥 Chuẩn cơn thèm **nóng giòn / đậm vị**, mình gợi ý ngay các cực phẩm bán chạy nhất:`;
  }

  return {
    content: `${introHeader}\n\n${bulletLines}\n\n👇 Bạn có thể chạm **Tùy chỉnh** để chọn kích cỡ/topping hoặc bấm **+ Giỏ** ngay trên thẻ món bên dưới nhé!`,
    dishIds: topResults.map(r => r.item.id),
    showOrders: false,
    followUps: [
      budgetLimit ? 'Ghép thêm đồ uống vào bữa này' : 'Lọc các món dưới 40.000đ',
      'Món nào giao nhanh nhất?',
      'Xem các món mình từng đặt'
    ],
    sourceBadge: `⚡ AI Nội bộ • Đọc ${allItems.length} mặt hàng`
  };
}

// =========================================================================
// 6. FORMAT MARKDOWN NHẸ NHÀNG TRONG BONG BÓNG CHAT AI
// =========================================================================

function formatAIMarkdown(raw) {
  if (!raw) return '';
  const escaped = escapeHtml(raw);
  const lines = escaped.split(/\r?\n/);
  const htmlLines = lines.map(line => {
    let l = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    if (/^\s*[-•]\s+/.test(l)) {
      return `<div class="ai-md-bullet">• <span>${l.replace(/^\s*[-•]\s+/, '')}</span></div>`;
    }
    if (l.trim() === '') {
      return `<div class="ai-md-spacer"></div>`;
    }
    return `<div class="ai-md-p">${l}</div>`;
  });
  return htmlLines.join('');
}

// =========================================================================
// 7. MODAL QUẢN LÝ PROFILE AI & KẾT NỐI API (GIAO DIỆN PHÂN TÁCH DANH SÁCH & BIỂU MẪU)
// =========================================================================

let aiModalViewMode = 'list'; // 'list': màn hình chọn profile | 'form': màn hình tạo mới/chỉnh sửa

function openAISettingsModal() {
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  aiModalViewMode = 'list';
  aiModelsExplorerState.open = false;
  aiModelsExplorerState.loading = false;
  aiModelsExplorerState.error = '';

  tempModalProvider = aiConfig.provider || 'gemini';
  const preset = AI_PROVIDER_PRESETS[tempModalProvider] || AI_PROVIDER_PRESETS.gemini;
  tempModalDraft = {
    profileId: aiConfig.profileId || '',
    profileName: aiConfig.profileName || '',
    provider: tempModalProvider,
    apiKey: aiConfig.apiKey || '',
    model: aiConfig.model || preset.defaultModel,
    endpoint: aiConfig.endpoint || preset.endpoint,
    customPrompt: aiConfig.customPrompt || '',
    useLocalProxy: aiConfig.useLocalProxy !== false,
    autoFallbackLocal: aiConfig.autoFallbackLocal !== false
  };

  renderAISettingsSheetContent();
  overlay.classList.add('active');
  refreshModalProxyStatus();
}

function openAIProfileListMode() {
  aiModalViewMode = 'list';
  aiModelsExplorerState.open = false;
  renderAISettingsSheetContent('', false);
}

function openAIProfileForm(profileId = null) {
  aiModalViewMode = 'form';
  aiModelsExplorerState.open = false;
  aiModelsExplorerState.searchQuery = '';
  aiModelsExplorerState.filterMode = 'all';

  if (profileId) {
    const target = aiProfilesState.profiles.find(p => String(p.id) === String(profileId));
    if (target) {
      tempModalProvider = target.provider;
      tempModalDraft = { ...target, id: target.id, profileId: target.id };
    }
  } else {
    tempModalProvider = 'gemini';
    const preset = AI_PROVIDER_PRESETS.gemini;
    tempModalDraft = {
      id: '',
      profileId: '',
      profileName: '',
      provider: 'gemini',
      apiKey: '',
      model: preset.defaultModel,
      endpoint: preset.endpoint,
      customPrompt: '',
      useLocalProxy: true,
      autoFallbackLocal: true
    };
  }

  renderAISettingsSheetContent('', false);
  setTimeout(() => {
    document.getElementById('ai-cfg-profname')?.focus();
  }, 40);
}

function getProxyStatusBadgeHtml() {
  if (localProxyStatus.online) {
    return `
      <div id="ai-proxy-live-badge" class="ai-test-banner ok" style="margin-bottom:12px; font-size:12px; padding:8px 12px;">
         <strong>Đang kết nối Local Server (${escapeHtml(localProxyStatus.baseUrl)})</strong>
      </div>
    `;
  }
  return `
    <div id="ai-proxy-live-badge" class="ai-test-banner info" style="margin-bottom:12px; font-size:12px; padding:8px 12px;">
      🌐 <strong>Chế độ Trực Tiếp Trình Duyệt:</strong> Google Gemini & OpenRouter kết nối trực tiếp không cần server. DeepSeek tự động chuyển tiếp qua Cloud Gateway.
    </div>
  `;
}

async function refreshModalProxyStatus() {
  await checkLocalProxyHealth();
  if (localProxyStatus.online) {
    await syncAIProfilesFromServer();
  }
  const badgeEl = document.getElementById('ai-proxy-live-badge');
  if (badgeEl) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = getProxyStatusBadgeHtml().trim();
    if (wrapper.firstElementChild) {
      badgeEl.replaceWith(wrapper.firstElementChild);
    }
  }
}

function renderAISettingsSheetContent(statusBannerHtml = '', preserveScroll = true) {
  const sheet = document.getElementById('modal-bottom-sheet');
  if (!sheet) return;

  const bodyEl = sheet.querySelector('.delivery-modal-body');
  const savedScrollTop = (preserveScroll && bodyEl) ? bodyEl.scrollTop : 0;

  if (aiModalViewMode === 'form') {
    renderAIProfileFormView(statusBannerHtml);
  } else {
    renderAIProfilesListView(statusBannerHtml);
  }

  if (preserveScroll && savedScrollTop > 0) {
    const newBodyEl = sheet.querySelector('.delivery-modal-body');
    if (newBodyEl) {
      newBodyEl.scrollTop = savedScrollTop;
    }
  }
}

// ── MÀN HÌNH 1: DANH SÁCH & QUẢN LÝ PROFILE (GỌN GÀNG, DỄ DÙNG) ──

function renderAIProfilesListView(statusBannerHtml = '') {
  const sheet = document.getElementById('modal-bottom-sheet');
  if (!sheet) return;

  const profiles = Array.isArray(aiProfilesState?.profiles) ? aiProfilesState.profiles : [];
  const apiActive = isExternalAPIConfigured();

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        <span>🤖</span>
        <span>Quản Lý Profile AI</span>
      </div>
      <button type="button" class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      ${getProxyStatusBadgeHtml()}
      ${statusBannerHtml}

      <!-- Thẻ trạng thái Profile đang dùng -->
      <div class="ai-active-profile-card">
        <div class="ai-active-card-label">CHẾ ĐỘ AI ĐANG HOẠT ĐỘNG</div>
        <div class="ai-active-card-main">
          ${apiActive ? `
            <div class="ai-active-card-icon">🤖</div>
            <div class="ai-active-card-details">
              <div class="ai-active-card-name">
                <span>${escapeHtml(aiConfig.profileName || defaultProfileNameForConfig(aiConfig))}</span>
                <span class="ai-prof-active-pill"> Đang sử dụng</span>
              </div>
              <div class="ai-active-card-sub">
                ${escapeHtml(AI_PROVIDER_PRESETS[aiConfig.provider]?.badge || aiConfig.provider)} • <strong>${escapeHtml(aiConfig.model)}</strong> • Key: ${escapeHtml(maskApiKey(aiConfig.apiKey))}
              </div>
            </div>
          ` : `
            <div class="ai-active-card-icon local">${FluentIcons.flashFilled}</div>
            <div class="ai-active-card-details">
              <div class="ai-active-card-name">
                <span>AI Thông minh Nội bộ</span>
                <span class="ai-prof-active-pill"> Đang sử dụng</span>
              </div>
              <div class="ai-active-card-sub">
                Tự động phân tích món ăn quanh PTIT, giỏ hàng & đơn cũ • Hoàn toàn miễn phí
              </div>
            </div>
          `}
        </div>
      </div>

      <!-- Tùy chọn chuyển nhanh sang AI Nội bộ nếu đang dùng API -->
      ${apiActive ? `
        <div class="ai-profile-quick-switch-row" onclick="switchActiveAIProfile('__local__', true)" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')switchActiveAIProfile('__local__', true)" title="Chuyển ngay sang AI Nội bộ (không mất cấu hình API đã lưu)">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:22px;">${FluentIcons.flashFilled}</span>
            <div>
              <div style="font-size:13px; font-weight:800; color:#0f172a;">Chuyển về AI Thông minh Nội bộ</div>
              <div style="font-size:11.5px; color:#64748b;">Dùng ngay không cần API Key, các Profile đã lưu vẫn được giữ nguyên</div>
            </div>
          </div>
          <button type="button" class="ai-prof-mini-btn" onclick="event.stopPropagation(); switchActiveAIProfile('__local__', true)">Chọn dùng</button>
        </div>
      ` : ''}

      <!-- Danh sách các Profile đã lưu -->
      <div class="ai-profiles-list-section">
        <div class="ai-profiles-list-head">
          <div class="ai-profiles-list-title">
            🗂️ Profile API đã lưu (${profiles.length})
          </div>
          <div class="ai-profiles-head-btns">
            ${profiles.length > 0 ? `
              <button type="button" class="ai-prof-mini-btn" onclick="exportAIProfilesToFile()" title="Xuất danh sách Profile ra file JSON">
                📤 Xuất JSON
              </button>
            ` : ''}
            <button type="button" class="ai-prof-mini-btn" onclick="triggerImportAIProfilesFile()" title="Nhập danh sách Profile từ file JSON">
              📥 Nhập JSON
            </button>
            <input
              type="file"
              id="ai-profiles-import-input"
              accept=".json,application/json"
              style="display:none;"
              onchange="handleImportAIProfilesFile(event)"
            >
          </div>
        </div>

        ${profiles.length === 0 ? `
          <div class="ai-profiles-empty-state">
            <div style="font-size:32px; margin-bottom:6px;">${FluentIcons.sparkleFilled}</div>
            <div style="font-weight:700; color:#1e293b; margin-bottom:4px;">Chưa có Profile AI nào được tạo</div>
            <div style="font-size:12px; color:#64748b; line-height:1.4;">
              Bấm nút bên dưới để thêm Profile Gemini, DeepSeek, OpenRouter hoặc OpenAI và chuyển đổi chỉ với 1 click!
            </div>
          </div>
        ` : `
          <div class="ai-profiles-list">
            ${profiles.map(prof => {
    const isCurrentActive = apiActive && aiConfig.profileId === prof.id;
    const pPreset = AI_PROVIDER_PRESETS[prof.provider] || AI_PROVIDER_PRESETS.gemini;
    const personaHint = prof.customPrompt ? ' • 🎭 Có phong cách riêng' : '';
    return `
                <div class="ai-profile-item-card ${isCurrentActive ? 'active' : ''}">
                  <div class="ai-profile-card-info" onclick="switchActiveAIProfile('${escapeHtml(prof.id)}', true)" role="button" tabindex="0" aria-pressed="${isCurrentActive}" onkeydown="if(event.key==='Enter'||event.key===' ')switchActiveAIProfile('${escapeHtml(prof.id)}', true)" style="cursor:pointer;">
                    <div class="ai-profile-card-name">
                      <span>${escapeHtml(prof.profileName)}</span>
                      ${isCurrentActive ? `<span class="ai-prof-active-pill"> Đang dùng</span>` : ''}
                    </div>
                    <div class="ai-profile-card-sub">
                      ${escapeHtml(pPreset.badge)} • <strong>${escapeHtml(prof.model)}</strong> • Key: ${escapeHtml(maskApiKey(prof.apiKey))}${personaHint}
                    </div>
                  </div>
                  <div class="ai-profile-card-actions">
                    ${!isCurrentActive ? `
                      <button type="button" class="ai-prof-mini-btn primary" onclick="switchActiveAIProfile('${escapeHtml(prof.id)}', true)">
                        Dùng
                      </button>
                    ` : ''}
                    <button type="button" class="ai-prof-mini-btn" onclick="openAIProfileForm('${escapeHtml(prof.id)}')" title="Chỉnh sửa cấu hình Profile này">
                      ✏️ Sửa
                    </button>
                    <button type="button" class="ai-prof-mini-btn danger" onclick="deleteSavedAIProfile('${escapeHtml(prof.id)}')" title="Xóa Profile này">
                      ${FluentIcons.deleteRegular}
                    </button>
                  </div>
                </div>
              `;
  }).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Nút thêm Profile mới cố định dưới cùng modal -->
    <div class="delivery-modal-footer">
      <button
        type="button"
        class="btn-primary-large"
        style="flex: 1; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;"
        onclick="openAIProfileForm(null)"
      >
        <span>➕</span>
        <span>Thêm Profile AI Mới</span>
      </button>
    </div>
  `;
}

// ── MÀN HÌNH 2: BIỂU MẪU TẠO MỚI HOẶC CHỈNH SỬA PROFILE (CHỈ HIỆN KHI CẦN) ──

function renderAIProfileFormView(statusBannerHtml = '') {
  const sheet = document.getElementById('modal-bottom-sheet');
  if (!sheet) return;

  const preset = AI_PROVIDER_PRESETS[tempModalProvider] || AI_PROVIDER_PRESETS.gemini;
  const draft = tempModalDraft || {
    id: '',
    profileId: '',
    profileName: '',
    provider: tempModalProvider,
    apiKey: '',
    model: preset.defaultModel,
    endpoint: preset.endpoint,
    customPrompt: '',
    useLocalProxy: true,
    autoFallbackLocal: true
  };
  tempModalDraft = draft;

  const currentProfId = String(draft.profileId || draft.id || '').trim();
  const isEditingExisting = Boolean(
    currentProfId && aiProfilesState.profiles.some(p => String(p.id) === currentProfId)
  );
  const suggestedName = `${preset.badge} • ${draft.model || preset.defaultModel}`;

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title" style="display:flex; align-items:center; gap:8px;">
        <button
          type="button"
          class="page-back-icon-btn"
          onclick="openAIProfileListMode()"
          title="Quay lại danh sách Profile"
          aria-label="Quay lại danh sách Profile"
        >
          ${FluentIcons.arrowLeft}
        </button>
        <span>${isEditingExisting ? '✏️ Chỉnh Sửa Profile' : '➕ Tạo Profile AI Mới'}</span>
      </div>
      <button type="button" class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      ${statusBannerHtml}
      <input type="hidden" id="ai-cfg-profid" value="${escapeHtml(currentProfId)}">

      <!-- Tên gợi nhớ Profile AI -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">
          ${FluentIcons.tagFilled} Đặt tên gợi nhớ cho Profile:
        </label>
        <input
          type="text"
          id="ai-cfg-profname"
          class="delivery-input-field"
          placeholder="VD: ${escapeHtml(suggestedName)} (Để trống sẽ tự đặt tên)"
          value="${escapeHtml(draft.profileName || '')}"
        >
      </div>

      <!-- Chọn Nhà cung cấp API -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">1. Chọn nền tảng AI API:</label>
        <div class="ai-provider-pills">
          ${Object.entries(AI_PROVIDER_PRESETS).map(([key, info]) => `
            <button
              type="button"
              class="ai-provider-pill ${tempModalProvider === key ? 'active' : ''}"
              onclick="selectModalAIProvider('${key}')"
            >
              ${escapeHtml(info.badge)}
            </button>
          `).join('')}
        </div>
        <div style="font-size:11.5px; color:var(--gray-500); margin-top:5px;">
          ℹ️ ${escapeHtml(preset.name)} — ${escapeHtml(preset.helpText)}
        </div>
      </div>

      <!-- API Key -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">2. API Key (${escapeHtml(preset.badge)}):</label>
        <div style="display:flex; gap:8px;">
          <input
            type="${tempShowApiKey ? 'text' : 'password'}"
            id="ai-cfg-apikey"
            class="delivery-input-field"
            style="flex:1;"
            placeholder="${escapeHtml(preset.keyPlaceholder)}"
            value="${escapeHtml(draft.apiKey)}"
            autocomplete="off"
          >
          <button
            type="button"
            class="db-secondary-btn"
            onclick="toggleShowAIApiKey()"
            title="Hiện / Ẩn API Key"
          >
            ${tempShowApiKey ? '🙈 Ẩn' : '👁️ Hiện'}
          </button>
        </div>
      </div>

      <!-- Chọn hoặc nhập Model -->
      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <div class="ai-model-label-row">
            <label class="delivery-input-label">3. Tên Model AI:</label>
            <button
              type="button"
              class="ai-fetch-models-btn"
              onclick="toggleOrFetchAPIModelsExplorer(false)"
              title="Truy vấn trực tiếp danh sách toàn bộ Model khả dụng từ API"
            >
              <span>📋</span>
              <span>${aiModelsExplorerState.open
      ? `Ẩn danh sách (${aiModelsExplorerState.models.length})`
      : 'Xem tất cả Model trong API'}</span>
            </button>
          </div>
          <input
            type="text"
            id="ai-cfg-model"
            class="delivery-input-field"
            placeholder="VD: ${escapeHtml(preset.defaultModel)}"
            value="${escapeHtml(draft.model)}"
          >
          <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:6px;">
            ${preset.models.map(m => `
              <span
                class="note-chip"
                style="font-size:11px; padding:3px 8px;"
                onclick="selectModelFromAPIExplorer('${escapeHtml(m)}')"
              >${escapeHtml(m)}</span>
            `).join('')}
          </div>
        </div>

        <div class="delivery-input-group">
          <label class="delivery-input-label">4. API Endpoint URL:</label>
          <input
            type="text"
            id="ai-cfg-endpoint"
            class="delivery-input-field"
            value="${escapeHtml(draft.endpoint)}"
          >
        </div>
      </div>

      ${renderAPIModelsExplorerBoxHtml(draft)}

      <!-- Phong cách / Chỉ dẫn riêng cho từng Profile -->
      <div class="delivery-input-group">
        <label class="delivery-input-label">5. Tính cách / Vai trò riêng cho Profile này (Tùy chọn):</label>
        <textarea
          id="ai-cfg-customprompt"
          class="delivery-input-field"
          rows="2"
          style="resize:vertical; min-height:54px; font-family:inherit;"
          placeholder="VD: Luôn tư vấn kỹ Calo & Protein, hoặc xưng hô vui vẻ kiểu sinh viên PTIT..."
        >${escapeHtml(draft.customPrompt || '')}</textarea>
        <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:6px;">
          ${AI_PERSONA_PRESET_CHIPS.map((chip, idx) => `
            <span
              class="note-chip"
              style="font-size:11px; padding:3px 8px;"
              onclick="applyPersonaPresetChip(${idx})"
            >${escapeHtml(chip.label)}</span>
          `).join('')}
        </div>
      </div>

      <label class="db-checkbox-row">
        <input type="checkbox" id="ai-cfg-proxy" ${draft.useLocalProxy !== false ? 'checked' : ''}>
        <span>Tự động vượt rào cản CORS (Ưu tiên Cloud Proxy hoặc Local Server nếu có)</span>
      </label>

      <label class="db-checkbox-row">
        <input type="checkbox" id="ai-cfg-fallback" ${draft.autoFallbackLocal !== false ? 'checked' : ''}>
        <span>Tự động dự phòng bằng AI Nội bộ nếu mất mạng hoặc hết hạn mức API</span>
      </label>
    </div>

    <!-- Thanh nút thao tác lưu & kiểm tra API cố định mép dưới cùng -->
    <div class="delivery-modal-footer" style="flex-wrap: wrap; gap: 8px;">
      <button type="button" class="db-secondary-btn" onclick="testAIConnectionFromModal()">
        🔌 Kiểm tra API
      </button>
      <button type="button" class="db-secondary-btn" onclick="openAIProfileListMode()">
        Hủy
      </button>
      ${isEditingExisting ? `
        <button type="button" class="db-secondary-btn" onclick="saveAISettingsFromModal(true)" title="Lưu cấu hình này thành một bản Profile mới riêng biệt">
          ➕ Lưu thành bản mới
        </button>
        <button type="button" class="btn-primary-large" style="flex: 1; min-width: 160px;" onclick="saveAISettingsFromModal(false)">
          ${FluentIcons.saveFilled} Cập nhật Profile
        </button>
      ` : `
        <button type="button" class="btn-primary-large" style="flex: 1; min-width: 180px;" onclick="saveAISettingsFromModal(false)">
          ${FluentIcons.saveFilled} Lưu & Kích Hoạt Dùng
        </button>
      `}
    </div>
  `;
}

function applyPersonaPresetChip(chipIdx) {
  const chip = AI_PERSONA_PRESET_CHIPS[chipIdx];
  if (!chip) return;
  const el = document.getElementById('ai-cfg-customprompt');
  if (el) {
    el.value = chip.prompt;
  }
}

// ── Trình khám phá & Tải danh sách tất cả Model trực tiếp từ API (/models) ──

function formatContextWindowBadge(tokens) {
  const n = Number(tokens);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1000000) {
    const m = Math.round((n / 1048576) * 10) / 10;
    return `${m >= 1 ? m : 1}M ctx`;
  }
  if (n >= 1000) {
    return `${Math.round(n / 1024)}K ctx`;
  }
  return `${n} ctx`;
}

function deriveCandidateModelsEndpoints(draft) {
  const prov = draft.provider || 'gemini';
  const rawEndpoint = String(draft.endpoint || AI_PROVIDER_PRESETS[prov]?.endpoint || '').trim().replace(/\/+$/, '');

  // 1. Google Gemini API (/v1beta/models?key=...)
  if (prov === 'gemini' || rawEndpoint.includes('generativelanguage.googleapis.com')) {
    const base = rawEndpoint.replace(/\/models(\/.*)?$/i, '') || 'https://generativelanguage.googleapis.com/v1beta';
    const sep = base.includes('?') ? '&' : '?';
    return [`${base}/models${sep}pageSize=200&key=${encodeURIComponent(draft.apiKey || '')}`];
  }

  // 2. OpenAI-Compatible APIs (DeepSeek, OpenAI, Groq, OpenRouter, Ollama, LM Studio, vLLM...)
  if (!rawEndpoint) return [];

  // Nếu người dùng đã nhập sẵn URL kết thúc bằng /models hoặc /api/tags
  if (/\/(models|tags)$/i.test(rawEndpoint)) {
    return [rawEndpoint];
  }

  const root = rawEndpoint
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/responses$/i, '')
    .replace(/\/+$/, '');

  const candidates = [`${root}/models`];
  if (!/\/v\d+$/i.test(root)) {
    candidates.push(`${root}/v1/models`);
  }

  // Hỗ trợ thêm chuẩn gốc /api/tags của Ollama nội bộ
  try {
    const u = new URL(root);
    if (prov === 'custom' || u.port === '11434') {
      candidates.push(`${u.origin}/api/tags`);
    }
  } catch (_) { }

  return Array.from(new Set(candidates));
}

function parseProviderModelsPayload(json, provider, presetModels = []) {
  if (!json || typeof json !== 'object') return [];

  let rawArr = [];
  let isGeminiShape = false;

  if (Array.isArray(json.data)) {
    rawArr = json.data;
  } else if (Array.isArray(json.models)) {
    rawArr = json.models;
    if (provider === 'gemini' || rawArr.some(m => m && m.supportedGenerationMethods)) {
      isGeminiShape = true;
    }
  } else if (Array.isArray(json)) {
    rawArr = json;
  }

  const presetSet = new Set((presetModels || []).map(s => String(s).toLowerCase()));
  const seenIds = new Set();
  const normalized = [];

  for (const item of rawArr) {
    if (!item) continue;

    if (typeof item === 'string') {
      const id = item.trim();
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        normalized.push({
          id,
          displayName: '',
          owner: '',
          contextTokens: null,
          isFree: id.endsWith(':free'),
          isRecommended: presetSet.has(id.toLowerCase()),
          isReasoning: /reasoner|r1|thinking|o1|o3|o4|-pro\b/i.test(id),
          paramSize: ''
        });
      }
      continue;
    }

    // Lọc bỏ các model thuần embedding / kiểm duyệt của Gemini để chỉ giữ model sinh văn bản Chat & Live API
    if (isGeminiShape && Array.isArray(item.supportedGenerationMethods)) {
      const canGenerate = item.supportedGenerationMethods.includes('generateContent') ||
        item.supportedGenerationMethods.includes('bidiGenerateContent');
      if (!canGenerate) {
        continue;
      }
    }

    const rawId = String(item.id || item.name || item.model || '').trim();
    const id = isGeminiShape ? rawId.replace(/^models\//i, '') : rawId;
    if (!id || seenIds.has(id)) continue;

    // Bỏ qua các model thuần embedding/whisper/tts rõ ràng trên OpenAI/Groq để danh sách gọn sạch
    if (/^(text-embedding|whisper-|tts-|dall-e-|omni-moderation)/i.test(id)) {
      continue;
    }

    seenIds.add(id);

    const displayName = String(item.displayName || (item.name && item.name !== rawId ? item.name : '') || '').trim();
    const owner = String(item.owned_by || item.details?.family || (isGeminiShape ? 'Google' : '') || '').trim();
    const contextTokens = Number(
      item.context_length || item.context_window || item.top_provider?.context_length || item.inputTokenLimit || 0
    ) || null;
    const isFree = Boolean(
      id.endsWith(':free') ||
      (item.pricing && String(item.pricing.prompt) === '0' && String(item.pricing.completion) === '0')
    );
    const paramSize = String(item.details?.parameter_size || '').trim();
    const desc = String(item.description || '').trim();

    normalized.push({
      id,
      displayName: displayName !== id ? displayName : '',
      owner,
      description: desc,
      contextTokens,
      isFree,
      isRecommended: presetSet.has(id.toLowerCase()),
      isReasoning: /reasoner|\br1\b|thinking|\bo1\b|\bo3\b|\bo4\b|-pro\b|qwq/i.test(`${id} ${displayName}`),
      paramSize
    });
  }

  // Sắp xếp: Model đề xuất của nền tảng lên đầu, sau đó theo thứ tự bảng chữ cái
  normalized.sort((a, b) => {
    if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  return normalized;
}

async function fetchAvailableModelsFromAPI(draft, forceRefresh = false) {
  const prov = draft.provider || 'gemini';
  const preset = AI_PROVIDER_PRESETS[prov] || AI_PROVIDER_PRESETS.gemini;
  const requiresKey = prov === 'gemini' || prov === 'deepseek' || prov === 'openai' || prov === 'groq' || prov === 'nvidia';

  if (requiresKey && (!draft.apiKey || draft.apiKey.trim().length < 5)) {
    throw new Error(`Vui lòng nhập API Key (${preset.badge}) ở mục 2 trước để truy vấn danh sách tất cả Model từ tài khoản API của bạn.`);
  }

  const cacheKey = `${prov}|${draft.endpoint}|${(draft.apiKey || '').slice(-6)}`;
  if (!forceRefresh && aiModelsListCache.has(cacheKey)) {
    return aiModelsListCache.get(cacheKey);
  }

  const candidateUrls = deriveCandidateModelsEndpoints(draft);
  if (candidateUrls.length === 0) {
    throw new Error('Không xác định được URL danh sách Model từ API Endpoint hiện tại.');
  }

  const headers = { Accept: 'application/json' };
  if (prov !== 'gemini' && draft.apiKey && draft.apiKey.trim()) {
    headers.Authorization = `Bearer ${draft.apiKey.trim()}`;
  }

  let lastErrorMsg = 'Không nhận được danh sách model hợp lệ từ máy chủ API.';

  for (const url of candidateUrls) {
    try {
      const { res, viaProxy } = await fetchViaLocalProxyOrDirect(
        url,
        prov,
        headers,
        null,
        'List-Models',
        'GET',
        draft.useLocalProxy !== false
      );

      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (_) { }

      if (!res.ok) {
        const apiErr = parsed?.error?.message || parsed?.message || `HTTP ${res.status}`;
        lastErrorMsg = `Máy chủ API trả lỗi (${res.status}): ${apiErr}`;
        // Nếu lỗi xác thực Key (401/403) thì dừng ngay không thử URL dự phòng
        if (res.status === 401 || res.status === 403) break;
        continue;
      }

      const models = parseProviderModelsPayload(parsed, prov, preset.models);
      if (models.length > 0) {
        const safeUrlLabel = url.replace(/([?&]key=)[^&]+/i, '$1••••');
        const resultObj = {
          models,
          sourceUrl: safeUrlLabel,
          viaProxy
        };
        aiModelsListCache.set(cacheKey, resultObj);
        return resultObj;
      }
      lastErrorMsg = 'Kết nối thành công nhưng API trả về danh sách rỗng (0 model).';
    } catch (err) {
      lastErrorMsg = err.message || String(err);
    }
  }

  throw new Error(lastErrorMsg);
}

async function toggleOrFetchAPIModelsExplorer(forceRefresh = false) {
  const draft = readModalAIConfigDraft();
  tempModalDraft = draft;

  if (aiModelsExplorerState.open && !forceRefresh && !aiModelsExplorerState.loading) {
    aiModelsExplorerState.open = false;
    renderAISettingsSheetContent();
    return;
  }

  aiModelsExplorerState.open = true;
  aiModelsExplorerState.loading = true;
  aiModelsExplorerState.error = '';
  renderAISettingsSheetContent();

  try {
    const result = await fetchAvailableModelsFromAPI(draft, forceRefresh);
    aiModelsExplorerState.loading = false;
    aiModelsExplorerState.error = '';
    aiModelsExplorerState.models = result.models;
    aiModelsExplorerState.sourceUrl = result.sourceUrl;
    aiModelsExplorerState.viaProxy = result.viaProxy;
    renderAISettingsSheetContent();
    setTimeout(() => {
      document.getElementById('ai-models-search-input')?.focus();
    }, 40);
  } catch (err) {
    aiModelsExplorerState.loading = false;
    aiModelsExplorerState.error = err.message || 'Không thể tải danh sách Model.';
    aiModelsExplorerState.models = [];
    renderAISettingsSheetContent();
  }
}

function closeAPIModelsExplorer() {
  tempModalDraft = readModalAIConfigDraft();
  aiModelsExplorerState.open = false;
  renderAISettingsSheetContent();
}

function getFilteredExplorerModels() {
  const q = String(aiModelsExplorerState.searchQuery || '').toLowerCase().trim();
  const mode = aiModelsExplorerState.filterMode || 'all';

  return (aiModelsExplorerState.models || []).filter(m => {
    if (mode === 'free' && !m.isFree) return false;
    if (mode === 'reasoning' && !m.isReasoning) return false;
    if (!q) return true;
    const hay = `${m.id} ${m.displayName || ''} ${m.owner || ''} ${m.description || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderAPIModelsListRowsHtml(currentModelId) {
  const filtered = getFilteredExplorerModels();
  if (filtered.length === 0) {
    return `
      <div style="padding:16px 10px; text-align:center; font-size:12px; color:#64748b;">
        Không tìm thấy model nào khớp từ khóa <strong>"${escapeHtml(aiModelsExplorerState.searchQuery)}"</strong>.
      </div>
    `;
  }

  return filtered.map(m => {
    const isSelected = String(currentModelId || '').trim() === m.id;
    const ctxLabel = formatContextWindowBadge(m.contextTokens);
    const subParts = [];
    if (m.displayName) subParts.push(m.displayName);
    if (m.owner) subParts.push(` Hãng/Nguồn: ${m.owner}`);
    if (m.description) subParts.push(m.description);

    return `
      <div
        class="ai-model-item-row ${isSelected ? 'selected' : ''}"
        onclick="selectModelFromAPIExplorer('${escapeHtml(m.id)}')"
      >
        <div class="ai-model-item-main">
          <div class="ai-model-id-line">
            <span class="ai-model-id-code">${escapeHtml(m.id)}</span>
            ${m.isRecommended ? `<span class="ai-model-meta-tag rec">⭐ Đề xuất</span>` : ''}
            ${m.isFree ? `<span class="ai-model-meta-tag free">🆓 FREE</span>` : ''}
            ${ctxLabel ? `<span class="ai-model-meta-tag ctx">${escapeHtml(ctxLabel)}</span>` : ''}
            ${m.paramSize ? `<span class="ai-model-meta-tag">${escapeHtml(m.paramSize)}</span>` : ''}
          </div>
          ${subParts.length > 0 ? `
            <div class="ai-model-sub-line">${escapeHtml(subParts.join(' • '))}</div>
          ` : ''}
        </div>
        <button type="button" class="ai-prof-mini-btn ${isSelected ? 'primary' : ''}">
          ${isSelected ? '✓ Đang chọn' : 'Chọn'}
        </button>
      </div>
    `;
  }).join('');
}

function renderAPIModelsExplorerBoxHtml(draft) {
  if (!aiModelsExplorerState.open) return '';

  if (aiModelsExplorerState.loading) {
    return `
      <div class="ai-models-explorer-box">
        <div style="font-size:12.5px; color:#0369a1; font-weight:700; padding:6px 2px;">
          ⏳ Đang kết nối API để lấy toàn bộ danh sách Model khả dụng...
        </div>
      </div>
    `;
  }

  if (aiModelsExplorerState.error) {
    return `
      <div class="ai-models-explorer-box" style="border-color:#fecaca; background:#fef2f2;">
        <div class="ai-models-explorer-head" style="margin-bottom:6px;">
          <div class="ai-models-explorer-title" style="color:#b91c1c;">
            ⚠️ Không tải được danh sách Model từ API
          </div>
          <div class="ai-profiles-head-btns">
            <button type="button" class="ai-prof-mini-btn" onclick="toggleOrFetchAPIModelsExplorer(true)">${FluentIcons.sync} Thử lại</button>
            <button type="button" class="ai-prof-mini-btn" onclick="closeAPIModelsExplorer()">✕ Đóng</button>
          </div>
        </div>
        <div style="font-size:12px; color:#991b1b; line-height:1.45;">
          ${escapeHtml(aiModelsExplorerState.error)}
        </div>
      </div>
    `;
  }

  const allModels = aiModelsExplorerState.models || [];
  const filteredCount = getFilteredExplorerModels().length;
  const freeCount = allModels.filter(m => m.isFree).length;
  const reasonCount = allModels.filter(m => m.isReasoning).length;
  const routeBadge = aiModelsExplorerState.viaProxy ? 'Qua Local Proxy' : 'Kết nối trực tiếp';

  return `
    <div class="ai-models-explorer-box">
      <div class="ai-models-explorer-head">
        <div class="ai-models-explorer-title">
          <span>📋 Tất cả Model trong API (${allModels.length} model)</span>
          <span class="ai-prof-active-pill">${escapeHtml(routeBadge)}</span>
        </div>
        <div class="ai-profiles-head-btns">
          <button type="button" class="ai-prof-mini-btn" onclick="toggleOrFetchAPIModelsExplorer(true)" title="Gọi lại API để làm mới danh sách">
            ${FluentIcons.sync} Làm mới
          </button>
          <button type="button" class="ai-prof-mini-btn" onclick="closeAPIModelsExplorer()">
            ✕ Thu gọn
          </button>
        </div>
      </div>

      <div class="ai-models-toolbar">
        <input
          type="text"
          id="ai-models-search-input"
          class="ai-models-search-input"
          placeholder="🔍 Tìm nhanh trong ${allModels.length} model (VD: flash, pro, reasoner, gpt-4o, llama, coder, free...)"
          value="${escapeHtml(aiModelsExplorerState.searchQuery)}"
          oninput="onAPIModelsSearchInput(this.value)"
        >
        <div class="ai-models-filter-pills">
          <div class="ai-models-filter-group">
            <button
              type="button"
              class="ai-models-filter-pill ${aiModelsExplorerState.filterMode === 'all' ? 'active' : ''}"
              onclick="setAPIModelsFilterMode('all')"
            >Tất cả (${allModels.length})</button>
            ${freeCount > 0 ? `
              <button
                type="button"
                class="ai-models-filter-pill ${aiModelsExplorerState.filterMode === 'free' ? 'active' : ''}"
                onclick="setAPIModelsFilterMode('free')"
              >🆓 Miễn phí (${freeCount})</button>
            ` : ''}
            ${reasonCount > 0 ? `
              <button
                type="button"
                class="ai-models-filter-pill ${aiModelsExplorerState.filterMode === 'reasoning' ? 'active' : ''}"
                onclick="setAPIModelsFilterMode('reasoning')"
              >🧠 Suy luận / Pro (${reasonCount})</button>
            ` : ''}
          </div>
          <span id="ai-models-count-summary" style="font-size:11px; color:#64748b; font-weight:700;">
            Đang hiện ${filteredCount}/${allModels.length}
          </span>
        </div>
      </div>

      <div class="ai-models-results-list" id="ai-models-results-list">
        ${renderAPIModelsListRowsHtml(draft.model)}
      </div>
    </div>
  `;
}

function onAPIModelsSearchInput(queryVal) {
  aiModelsExplorerState.searchQuery = String(queryVal || '');
  const currentModelVal = document.getElementById('ai-cfg-model')?.value || tempModalDraft?.model || '';
  const listEl = document.getElementById('ai-models-results-list');
  if (listEl) {
    listEl.innerHTML = renderAPIModelsListRowsHtml(currentModelVal);
  }
  const countEl = document.getElementById('ai-models-count-summary');
  if (countEl) {
    countEl.textContent = `Đang hiện ${getFilteredExplorerModels().length}/${aiModelsExplorerState.models.length}`;
  }
}

function setAPIModelsFilterMode(mode) {
  tempModalDraft = readModalAIConfigDraft();
  aiModelsExplorerState.filterMode = mode || 'all';
  renderAISettingsSheetContent();
}

function selectModelFromAPIExplorer(modelId) {
  const cleanId = String(modelId || '').trim();
  if (!cleanId) return;

  const modelInput = document.getElementById('ai-cfg-model');
  if (modelInput) {
    modelInput.value = cleanId;
  }

  const profNameInput = document.getElementById('ai-cfg-profname');
  const preset = AI_PROVIDER_PRESETS[tempModalProvider] || AI_PROVIDER_PRESETS.gemini;
  if (profNameInput && !profNameInput.value.trim()) {
    profNameInput.placeholder = `VD: ${preset.badge} • ${cleanId} (Để trống sẽ tự đặt tên)`;
  }

  if (tempModalDraft) {
    tempModalDraft.model = cleanId;
  }

  const listEl = document.getElementById('ai-models-results-list');
  if (listEl) {
    listEl.innerHTML = renderAPIModelsListRowsHtml(cleanId);
  }

  if (typeof showToast === 'function') {
    showToast('checkmarkFilled', `Đã chọn Model: ${cleanId}`);
  }
}

function loadProfileIntoModalForm(profileId) {
  openAIProfileForm(profileId);
}

function startNewAIProfileDraft() {
  openAIProfileForm(null);
}

function deleteSavedAIProfile(profileId) {
  const idx = aiProfilesState.profiles.findIndex(p => p.id === profileId);
  if (idx < 0) return;

  const removed = aiProfilesState.profiles[idx];
  aiProfilesState.profiles.splice(idx, 1);

  let bannerMsg = `🗑️ Đã xóa Profile <strong>${escapeHtml(removed.profileName)}</strong>.`;

  if (aiConfig.profileId === profileId || aiProfilesState.activeProfileId === profileId) {
    if (aiProfilesState.profiles.length > 0) {
      const nextProf = aiProfilesState.profiles[0];
      aiProfilesState.activeProfileId = nextProf.id;
      applyProfileToActiveAIConfig(nextProf);
      bannerMsg += ` Hệ thống đã tự động chuyển sang Profile <strong>${escapeHtml(nextProf.profileName)}</strong>.`;
    } else {
      aiProfilesState.activeProfileId = null;
      aiConfig = {
        profileId: '',
        profileName: '',
        provider: 'gemini',
        apiKey: '',
        model: AI_PROVIDER_PRESETS.gemini.defaultModel,
        endpoint: AI_PROVIDER_PRESETS.gemini.endpoint,
        customPrompt: '',
        useLocalProxy: true,
        autoFallbackLocal: true
      };
      saveAIConfigToStorage();
      bannerMsg += ' Đã chuyển về <strong>AI Thông minh Nội bộ</strong>.';
    }
  }

  saveAIProfilesState(true);

  if (tempModalDraft && tempModalDraft.profileId === profileId) {
    tempModalProvider = aiConfig.provider || 'gemini';
    tempModalDraft = { ...aiConfig };
  }

  renderAISettingsSheetContent(`<div class="ai-test-banner warn">${bannerMsg}</div>`, true);
  updateGlobalAIChromeStatus();
}

function exportAIProfilesToFile() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'ptitngon-ai-profiles',
    activeProfileId: aiProfilesState.activeProfileId,
    profiles: aiProfilesState.profiles
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ptitngon-ai-profiles-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') {
    showToast('checkmarkFilled', `Đã xuất ${aiProfilesState.profiles.length} Profile AI ra file JSON!`);
  }
}

function triggerImportAIProfilesFile() {
  const input = document.getElementById('ai-profiles-import-input');
  if (input) input.click();
}

function handleImportAIProfilesFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      const rawList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.profiles) ? parsed.profiles : []);
      const validList = rawList.map(normalizeSavedProfileItem).filter(Boolean);
      if (validList.length === 0) {
        renderAISettingsSheetContent(`
          <div class="ai-test-banner err">❌ File JSON không chứa Profile AI hợp lệ nào!</div>
        `);
        return;
      }

      const mapById = new Map(aiProfilesState.profiles.map(p => [p.id, p]));
      validList.forEach(vp => mapById.set(vp.id, vp));
      aiProfilesState.profiles = Array.from(mapById.values());

      const chosenActive = validList[0];
      aiProfilesState.activeProfileId = chosenActive.id;
      applyProfileToActiveAIConfig(chosenActive);
      saveAIProfilesState(true);

      tempModalProvider = chosenActive.provider;
      tempModalDraft = { ...aiConfig };

      renderAISettingsSheetContent(`
        <div class="ai-test-banner ok">
          ✅ Đã nhập thành công <strong>${validList.length} Profile AI</strong> và kích hoạt <strong>${escapeHtml(chosenActive.profileName)}</strong>!
        </div>
      `, true);
      updateGlobalAIChromeStatus();
    } catch (err) {
      renderAISettingsSheetContent(`
        <div class="ai-test-banner err">❌ Không thể đọc file JSON: ${escapeHtml(err.message)}</div>
      `);
    }
  };
  reader.readAsText(file);
}

function selectModalAIProvider(providerKey) {
  const prevForm = readModalAIConfigDraft();
  const matchingSaved = aiProfilesState.profiles.find(p => p.provider === providerKey);

  if (providerKey !== tempModalProvider) {
    aiModelsExplorerState.open = false;
    aiModelsExplorerState.searchQuery = '';
    aiModelsExplorerState.filterMode = 'all';
  }

  tempModalProvider = providerKey;
  const preset = AI_PROVIDER_PRESETS[providerKey] || AI_PROVIDER_PRESETS.gemini;

  // Nếu đang tạo mới (chưa gắn profileId) hoặc đang giữ profileId cũ khác provider -> giữ ngữ cảnh thông minh
  const activeProfId = String(prevForm.profileId || prevForm.id || '').trim();
  if (activeProfId) {
    // Đang sửa 1 Profile cụ thể và muốn đổi nền tảng API của Profile đó -> giữ nguyên profileId, tên & customPrompt
    tempModalDraft = {
      id: activeProfId,
      profileId: activeProfId,
      profileName: prevForm.profileName,
      provider: providerKey,
      apiKey: (matchingSaved && providerKey === matchingSaved.provider) ? matchingSaved.apiKey : '',
      model: preset.defaultModel,
      endpoint: preset.endpoint,
      customPrompt: prevForm.customPrompt || '',
      useLocalProxy: prevForm.useLocalProxy,
      autoFallbackLocal: prevForm.autoFallbackLocal
    };
  } else {
    tempModalDraft = {
      id: '',
      profileId: '',
      profileName: prevForm.profileName || '',
      provider: providerKey,
      apiKey: '',
      model: preset.defaultModel,
      endpoint: preset.endpoint,
      customPrompt: prevForm.customPrompt || '',
      useLocalProxy: prevForm.useLocalProxy,
      autoFallbackLocal: prevForm.autoFallbackLocal
    };
  }
  renderAISettingsSheetContent('', true);
}

function toggleShowAIApiKey() {
  tempShowApiKey = !tempShowApiKey;
  const input = document.getElementById('ai-cfg-apikey');
  const btn = document.querySelector('[onclick*="toggleShowAIApiKey()"]');
  if (input) {
    input.type = tempShowApiKey ? 'text' : 'password';
  }
  if (btn) {
    btn.innerHTML = tempShowApiKey ? '🙈 Ẩn' : '👁️ Hiện';
  }
}

function readModalAIConfigDraft() {
  const preset = AI_PROVIDER_PRESETS[tempModalProvider] || AI_PROVIDER_PRESETS.gemini;
  const rawEndpoint = (document.getElementById('ai-cfg-endpoint')?.value || '').trim() || preset.endpoint;
  const domProfId = (document.getElementById('ai-cfg-profid')?.value || '').trim();
  const activeProfId = domProfId || tempModalDraft?.profileId || tempModalDraft?.id || '';
  return {
    id: activeProfId,
    profileId: activeProfId,
    profileName: (document.getElementById('ai-cfg-profname')?.value || '').trim(),
    provider: tempModalProvider,
    apiKey: (document.getElementById('ai-cfg-apikey')?.value || '').trim(),
    model: (document.getElementById('ai-cfg-model')?.value || '').trim() || preset.defaultModel,
    endpoint: normalizeOpenAICompatibleEndpoint(rawEndpoint, tempModalProvider),
    customPrompt: (document.getElementById('ai-cfg-customprompt')?.value || '').trim(),
    useLocalProxy: document.getElementById('ai-cfg-proxy')
      ? document.getElementById('ai-cfg-proxy').checked
      : true,
    autoFallbackLocal: document.getElementById('ai-cfg-fallback')?.checked !== false
  };
}

async function testAIConnectionFromModal() {
  const draft = readModalAIConfigDraft();
  tempModalDraft = draft;
  aiConfig = { ...draft };

  if (!isExternalAPIConfigured()) {
    renderAISettingsSheetContent(`
      <div class="ai-test-banner warn">
        ⚠️ Bạn chưa nhập API Key. Nếu cần dùng <strong>AI Thông minh Nội bộ</strong> miễn phí, hãy bấm nút <strong>⚡ Dùng AI Nội bộ</strong>!
      </div>
    `, true);
    return;
  }

  renderAISettingsSheetContent(`
    <div class="ai-test-banner info">
      ⏳ Đang kiểm tra kết nối tới <strong>${escapeHtml(AI_PROVIDER_PRESETS[draft.provider]?.name || draft.provider)}</strong> (${escapeHtml(draft.model)})...
    </div>
  `, true);

  try {
    const testRes = await callExternalLLMAPI([
      { role: 'user', content: 'Hãy tra cứu 2 món ăn ngon dưới 40.000đ đang còn hàng và giới thiệu ngắn gọn 1 câu!' }
    ]);
    saveAIConfigToStorage();
    const traceInfo = testRes.agentTrace
      ? `Đã chạy <strong>${testRes.agentTrace.stagesCount} giai đoạn</strong> (${testRes.agentTrace.steps.length} lệnh truy vấn phần mềm), trích xuất ${testRes.dishIds.length} thẻ món.`
      : `Đã trích xuất ${testRes.dishIds.length} thẻ món.`;
    renderAISettingsSheetContent(`
      <div class="ai-test-banner ok">
        ✅ <strong>Kết nối API & Tương tác Đa Giai Đoạn thành công!</strong> ${traceInfo}<br>
        <em>"${escapeHtml(testRes.content.substring(0, 140))}..."</em>
      </div>
    `, true);
  } catch (err) {
    renderAISettingsSheetContent(`
      <div class="ai-test-banner err">
        ❌ <strong>Không thể kết nối:</strong> ${escapeHtml(err.message)}
      </div>
    `, true);
  }
}

function saveAISettingsFromModal(saveAsNew = false) {
  const draft = readModalAIConfigDraft();
  const hasExternalCredentials = (draft.provider === 'custom' && draft.endpoint && draft.endpoint.trim())
    || Boolean(draft.apiKey && draft.apiKey.trim().length > 5);

  aiModalViewMode = 'list';
  if (hasExternalCredentials) {
    const savedProf = upsertProfileFromConfig(draft, saveAsNew);
    tempModalDraft = { ...aiConfig };
    closeModal();
    showToast('checkmarkFilled', `Đã lưu & kích hoạt Profile "${savedProf.profileName}"!`);
  } else {
    // Chưa nhập Key -> chuyển về chế độ AI Nội bộ nhưng không làm mất các Profile đã lưu trước đó
    aiProfilesState.activeProfileId = null;
    aiConfig = { ...draft, profileId: '', profileName: '' };
    tempModalDraft = { ...aiConfig };
    saveAIConfigToStorage();
    saveAIProfilesState(true);
    closeModal();
    showToast('sparkleRegular', 'Đang sử dụng chế độ AI Thông minh Nội bộ!');
  }

  updateGlobalAIChromeStatus();
}

function disconnectExternalAI() {
  switchActiveAIProfile('__local__', true);
}

