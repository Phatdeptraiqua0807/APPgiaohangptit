/* ==========================================================================
   ptitngon - Multi-Channel QR Payment Gateway (Demo VPBank & MoMo)
   (js/qr-payment.js)
   - Hỗ trợ đầy đủ 2 kênh quét mã QR thật chuẩn EMVCo NAPAS 247 / VietQR Đa Năng:
     1. Chuyển khoản QR Ngân hàng ('qr') -> VPBank (BIN 970432) • STK: 0921030342
     2. Ví điện tử MoMo ('momo')        -> Ví MoMo (BIN 971025) • TK/SĐT: 0866072227
   - Hiển thị trực tiếp khi chọn phương thức ở trang Thanh toán + Cổng xác nhận
     thanh toán QR tương tác (đếm ngược, sao chép 1 chạm, đối soát Demo & mở lại từ đơn hàng)
   ========================================================================== */

const QR_PAYMENT_CHANNELS = {
  qr: {
    methodKey: 'qr',
    channelBadge: 'VPBank',
    subBadge: 'VietQR • NAPAS 247',
    icon: '📲',
    themeClass: 'vpbank',
    bankBin: '970432',
    providerShortName: 'VPBank',
    providerFullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)',
    accountLabelTitle: 'Số tài khoản nhận (VPBank)',
    accountNo: '0921030342',
    txPrefix: 'VPB',
    modalHeaderTitle: 'Thanh Toán Chuyển Khoản VietQR',
    scanGuideHtml: 'Mở bất kỳ <strong>App Ngân hàng</strong> hoặc <strong>Ví điện tử</strong> quét mã bên cạnh — hệ thống tự trỏ tới tài khoản <strong>VPBank 0921030342</strong>:'
  },
  momo: {
    methodKey: 'momo',
    channelBadge: 'Ví MoMo',
    subBadge: 'QR Đa Năng • MoMo',
    icon: '👛',
    themeClass: 'momo',
    bankBin: '971025',
    providerShortName: 'Ví MoMo',
    providerFullName: 'Ví điện tử MoMo (M_Service)',
    accountLabelTitle: 'Tài khoản / SĐT nhận MoMo',
    accountNo: '0866072227',
    txPrefix: 'MOMO',
    modalHeaderTitle: 'Thanh Toán Mã QR Ví MoMo',
    scanGuideHtml: 'Mở ứng dụng <strong>MoMo</strong> (hoặc mọi App Ngân hàng hỗ trợ QR Đa Năng) quét mã bên cạnh — chuyển trực tiếp tới <strong>Ví MoMo 0866072227</strong>:'
  }
};

// Giữ tương thích hằng số cũ nếu nơi khác tham chiếu
const VPBANK_QR_CONFIG = QR_PAYMENT_CHANNELS.qr;

let pendingCheckoutOrderId = null;
let vqrLockExactAmount = true; // true: điền sẵn đúng tổng tiền đơn; false: QR mở để tự nhập số tiền khi test
let vqrCountdownInterval = null;
let vqrRemainingSeconds = 600;
let vqrIsVerifying = false;

function isQRBasedPaymentMethod(method) {
  return method === 'qr' || method === 'momo';
}

function getQRChannelConfig(method) {
  return QR_PAYMENT_CHANNELS[method] || QR_PAYMENT_CHANNELS.qr;
}

// =========================================================================
// 1. TẠO MÃ ĐƠN TẠM & CHUẨN EMVCo VIETQR NAPAS 247 (VPBANK & MOMO)
// =========================================================================

function getOrCreatePendingCheckoutOrderId() {
  if (!pendingCheckoutOrderId) {
    pendingCheckoutOrderId = '#PTIT-' + Math.floor(100000 + Math.random() * 900000);
  }
  return pendingCheckoutOrderId;
}

function resetPendingCheckoutOrderId() {
  pendingCheckoutOrderId = null;
}

function buildTransferMemoFromOrderId(orderId) {
  const digits = String(orderId || '').replace(/[^0-9]/g, '') || '888999';
  return `PTIT ${digits}`;
}

function sanitizeVietQRMemo(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25);
}

function formatEmvTlv(tag, value) {
  const str = String(value);
  const len = String(str.length).padStart(2, '0');
  return `${tag}${len}${str}`;
}

// CRC-16/CCITT-FALSE chuẩn đặc tả EMVCo QRCPS-MPM & NAPAS VietQR
function computeEmvCrc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) & 0xFF) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildChannelVietQRPayload(channelKey = 'qr', amountVnd = 0, rawMemo = '') {
  const channel = getQRChannelConfig(channelKey);
  const cleanAmount = Math.max(0, Math.round(Number(amountVnd) || 0));
  const cleanMemo = sanitizeVietQRMemo(rawMemo);

  // Tag 00: Payload Format Indicator = 01
  const tag00 = formatEmvTlv('00', '01');
  // Tag 01: Point of Initiation Method (12 = Dynamic QR có số tiền, 11 = Static QR)
  const tag01 = formatEmvTlv('01', cleanAmount > 0 ? '12' : '11');

  // Tag 38: NAPAS 247 VietQR Account Transfer -> VPBank (970432-0921030342) hoặc MoMo (971025-0866072227)
  const guid = formatEmvTlv('00', 'A000000727');
  const beneficiaryInner =
    formatEmvTlv('00', channel.bankBin) +
    formatEmvTlv('01', channel.accountNo);
  const beneficiary = formatEmvTlv('01', beneficiaryInner);
  const serviceCode = formatEmvTlv('02', 'QRIBFTTA');
  const tag38 = formatEmvTlv('38', guid + beneficiary + serviceCode);

  // Tag 53: VND (704), Tag 54: Amount, Tag 58: Country VN
  const tag53 = formatEmvTlv('53', '704');
  const tag54 = cleanAmount > 0 ? formatEmvTlv('54', String(cleanAmount)) : '';
  const tag58 = formatEmvTlv('58', 'VN');

  // Tag 62: Additional Data Field Template -> Subtag 08 (Nội dung chuyển khoản)
  const tag62 = cleanMemo ? formatEmvTlv('62', formatEmvTlv('08', cleanMemo)) : '';

  const payloadWithoutCrc = `${tag00}${tag01}${tag38}${tag53}${tag54}${tag58}${tag62}6304`;
  const crcHex = computeEmvCrc16(payloadWithoutCrc);
  return `${payloadWithoutCrc}${crcHex}`;
}

function getChannelQRUrls(channelKey, amountVnd, memoText) {
  const channel = getQRChannelConfig(channelKey);
  const effectiveAmount = vqrLockExactAmount ? Math.max(0, Math.round(Number(amountVnd) || 0)) : 0;
  const cleanMemo = sanitizeVietQRMemo(memoText);
  const emvPayload = buildChannelVietQRPayload(channel.methodKey, effectiveAmount, cleanMemo);

  // 1. Nguồn chính: VietQR.io chính thức với BIN tương ứng (970432 cho VPBank, 971025 cho Ví MoMo)
  const queryParts = [];
  if (effectiveAmount > 0) queryParts.push(`amount=${effectiveAmount}`);
  if (cleanMemo) queryParts.push(`addInfo=${encodeURIComponent(cleanMemo)}`);
  const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const primaryVietQRUrl = `https://img.vietqr.io/image/${channel.bankBin}-${channel.accountNo}-compact.png${qs}`;

  // 2. Nguồn dự phòng 1 & 2: Mã hóa trực tiếp chuỗi EMVCo NAPAS 247 / QR Đa Năng
  const colorParam = channel.methodKey === 'momo' ? '&color=a50064' : '';
  const fallbackQrServerUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&ecc=M${colorParam}&data=${encodeURIComponent(emvPayload)}`;
  const fallbackQuickChartUrl = `https://quickchart.io/qr?size=320&margin=1&ecLevel=M&text=${encodeURIComponent(emvPayload)}`;

  return {
    channel,
    effectiveAmount,
    cleanMemo,
    emvPayload,
    primaryVietQRUrl,
    fallbackQrServerUrl,
    fallbackQuickChartUrl
  };
}

// Xử lý tự động chuyển đổi nguồn ảnh QR nếu mạng chặn 1 CDN hoặc ngoại tuyến hoàn toàn
function handleVietQRImageError(imgEl) {
  if (!imgEl) return;
  const step = Number(imgEl.dataset.fallbackStep || '0');
  if (step === 0 && imgEl.dataset.fb1) {
    imgEl.dataset.fallbackStep = '1';
    imgEl.src = imgEl.dataset.fb1;
  } else if (step === 1 && imgEl.dataset.fb2) {
    imgEl.dataset.fallbackStep = '2';
    imgEl.src = imgEl.dataset.fb2;
  } else {
    imgEl.style.display = 'none';
    const offlineBox = imgEl.parentElement?.querySelector('.vqr-offline-fallback');
    if (offlineBox) offlineBox.style.display = 'flex';
  }
}

function copyVietQRField(value, label) {
  const str = String(value || '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(str).catch(() => {});
  }
  showToast('copyRegular', `Đã sao chép ${label}: ${str}`);
}

function toggleVietQRAmountMode(lockExact, totalAmount, channelKey = 'qr', existingOrderId = null) {
  vqrLockExactAmount = Boolean(lockExact);
  if (existingOrderId) {
    openExistingOrderVietQRModal(existingOrderId);
  } else {
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.classList.contains('active') && document.getElementById('vqr-gateway-modal-root')) {
      openVietQRPaymentModal(totalAmount, false, channelKey);
    }
    if (currentView === 'checkout') {
      renderCheckoutView();
    }
  }
}

// =========================================================================
// 2. KHỐI HIỂN THỊ TRỰC TIẾP TRONG TRANG CHECKOUT KHI CHỌN VIETQR HOẶC MOMO
// =========================================================================

function renderInlineCheckoutVietQRCard(totalAmount, draftOrderId, methodKey = null) {
  const activeMethod = methodKey || selectedPaymentMethod || 'qr';
  const channel = getQRChannelConfig(activeMethod);
  const orderCode = draftOrderId || getOrCreatePendingCheckoutOrderId();
  const memo = buildTransferMemoFromOrderId(orderCode);
  const qrData = getChannelQRUrls(channel.methodKey, totalAmount, memo);

  return `
    <div class="vqr-inline-checkout-box theme-${channel.themeClass}">
      <div class="vqr-inline-header">
        <div class="vqr-inline-brand">
          <span class="vqr-bank-pill ${channel.themeClass}">${channel.icon} ${escapeHtml(channel.channelBadge)}</span>
          <span class="vqr-napas-pill">${escapeHtml(channel.subBadge)}</span>
        </div>
        <span class="vqr-demo-tag ${channel.themeClass}">⚡ Demo • QR thật tới ${channel.accountNo}</span>
      </div>

      <div class="vqr-inline-grid">
        <!-- Cột trái: Ảnh mã QR quét trực tiếp -->
        <div class="vqr-qr-frame-wrap">
          <div class="vqr-qr-frame ${channel.themeClass}">
            <span class="vqr-corner tl"></span>
            <span class="vqr-corner tr"></span>
            <span class="vqr-corner bl"></span>
            <span class="vqr-corner br"></span>
            <img
              class="vqr-qr-img"
              src="${qrData.primaryVietQRUrl}"
              data-fb1="${qrData.fallbackQrServerUrl}"
              data-fb2="${qrData.fallbackQuickChartUrl}"
              data-fallback-step="0"
              alt="QR ${escapeHtml(channel.providerShortName)} ${channel.accountNo}"
              onerror="handleVietQRImageError(this)"
            >
            <div class="vqr-offline-fallback" style="display:none;">
              <div style="font-size:28px;">${channel.icon}</div>
              <strong>${escapeHtml(channel.providerShortName)} • ${channel.accountNo}</strong>
              <span>Số tiền: ${formatVND(totalAmount)}</span>
              <span>ND: ${escapeHtml(qrData.cleanMemo)}</span>
            </div>
          </div>
          <div class="vqr-amount-mode-switch">
            <button
              type="button"
              class="vqr-mode-btn ${channel.themeClass} ${vqrLockExactAmount ? 'active' : ''}"
              onclick="toggleVietQRAmountMode(true, ${totalAmount}, '${channel.methodKey}')"
            >
              Đúng số tiền (${formatVND(totalAmount)})
            </button>
            <button
              type="button"
              class="vqr-mode-btn ${channel.themeClass} ${!vqrLockExactAmount ? 'active' : ''}"
              onclick="toggleVietQRAmountMode(false, ${totalAmount}, '${channel.methodKey}')"
            >
              Tự nhập số tiền
            </button>
          </div>
        </div>

        <!-- Cột phải: Thông tin tài khoản nhận (VPBank 0921030342 hoặc MoMo 0866072227) -->
        <div class="vqr-info-panel">
          <div class="vqr-info-note">
            ${channel.scanGuideHtml}
          </div>

          <div class="vqr-detail-rows">
            <div class="vqr-detail-row">
              <div>
                <div class="vqr-lbl">Đơn vị thụ hưởng</div>
                <div class="vqr-val bank ${channel.themeClass}">${channel.icon} ${escapeHtml(channel.providerFullName)}</div>
              </div>
            </div>

            <div class="vqr-detail-row">
              <div>
                <div class="vqr-lbl">${escapeHtml(channel.accountLabelTitle)}</div>
                <div class="vqr-val mono">${channel.accountNo}</div>
              </div>
              <button type="button" class="vqr-copy-btn ${channel.themeClass}" onclick="copyVietQRField('${channel.accountNo}', '${escapeHtml(channel.providerShortName)}')">
                Sao chép
              </button>
            </div>

            <div class="vqr-detail-row">
              <div>
                <div class="vqr-lbl">Số tiền thanh toán</div>
                <div class="vqr-val price">${formatVND(totalAmount)}</div>
              </div>
              <button type="button" class="vqr-copy-btn ${channel.themeClass}" onclick="copyVietQRField('${totalAmount}', 'số tiền chuyển khoản')">
                Sao chép
              </button>
            </div>

            <div class="vqr-detail-row">
              <div>
                <div class="vqr-lbl">Nội dung chuyển khoản</div>
                <div class="vqr-val code">${escapeHtml(qrData.cleanMemo)}</div>
              </div>
              <button type="button" class="vqr-copy-btn ${channel.themeClass}" onclick="copyVietQRField('${escapeHtml(qrData.cleanMemo)}', 'nội dung chuyển khoản')">
                Sao chép
              </button>
            </div>
          </div>

          <button
            type="button"
            class="vqr-open-gateway-btn ${channel.themeClass}"
            onclick="openVietQRPaymentModal(${totalAmount}, true, '${channel.methodKey}')"
          >
            ${channel.icon} Phóng to mã QR ${escapeHtml(channel.providerShortName)} & Xác nhận đã chuyển
          </button>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// 3. CỔNG XÁC NHẬN THANH TOÁN QR MODAL (CHO CẢ VPBANK 0921030342 & MOMO 0866072227)
// =========================================================================

function startVietQRCountdown() {
  if (vqrCountdownInterval) {
    clearInterval(vqrCountdownInterval);
    vqrCountdownInterval = null;
  }
  vqrCountdownInterval = setInterval(() => {
    const overlay = document.getElementById('modal-overlay');
    const timerEl = document.getElementById('vqr-timer-text');
    if (!overlay || !overlay.classList.contains('active') || !timerEl) {
      clearInterval(vqrCountdownInterval);
      vqrCountdownInterval = null;
      return;
    }
    if (vqrRemainingSeconds > 0) {
      vqrRemainingSeconds--;
    }
    const mins = String(Math.floor(vqrRemainingSeconds / 60)).padStart(2, '0');
    const secs = String(vqrRemainingSeconds % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}

function handleCheckoutPrimaryAction(totalAmount) {
  if (isQRBasedPaymentMethod(selectedPaymentMethod)) {
    openVietQRPaymentModal(totalAmount, true, selectedPaymentMethod);
  } else {
    submitOrder(totalAmount);
  }
}

function openVietQRPaymentModal(totalAmount, resetTimer = true, methodKey = null) {
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  const activeMethod = methodKey || selectedPaymentMethod || 'qr';
  const channel = getQRChannelConfig(activeMethod);

  vqrIsVerifying = false;
  if (resetTimer) {
    vqrRemainingSeconds = 600; // 10 phút
  }

  const orderCode = getOrCreatePendingCheckoutOrderId();
  const memo = buildTransferMemoFromOrderId(orderCode);
  const qrData = getChannelQRUrls(channel.methodKey, totalAmount, memo);
  const mins = String(Math.floor(vqrRemainingSeconds / 60)).padStart(2, '0');
  const secs = String(vqrRemainingSeconds % 60).padStart(2, '0');

  sheet.innerHTML = buildVietQRModalHtml({
    channel,
    totalAmount,
    orderCode,
    qrData,
    timerStr: `${mins}:${secs}`,
    existingOrder: null
  });

  overlay.classList.add('active');
  startVietQRCountdown();
}

function openExistingOrderVietQRModal(orderId) {
  const order = (typeof ordersList !== 'undefined')
    ? ordersList.find(o => o.orderId === orderId)
    : null;
  if (!order) return;

  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  const channelKey = order.qrPayment?.channelKey || (order.paymentMethod === 'momo' ? 'momo' : 'qr');
  const channel = getQRChannelConfig(channelKey);

  vqrIsVerifying = false;
  vqrRemainingSeconds = 600;
  const memo = order.qrPayment?.transferContent || buildTransferMemoFromOrderId(order.orderId);
  const qrData = getChannelQRUrls(channel.methodKey, order.totalAmount, memo);

  sheet.innerHTML = buildVietQRModalHtml({
    channel,
    totalAmount: order.totalAmount,
    orderCode: order.orderId,
    qrData,
    timerStr: '10:00',
    existingOrder: order
  });

  overlay.classList.add('active');
  startVietQRCountdown();
}

function buildVietQRModalHtml({ channel, totalAmount, orderCode, qrData, timerStr, existingOrder }) {
  const isAlreadyPaid = Boolean(existingOrder && existingOrder.qrPayment && existingOrder.qrPayment.isPaid);
  const existingOrderIdArg = existingOrder ? `'${escapeHtml(existingOrder.orderId)}'` : 'null';

  return `
    <div id="vqr-gateway-modal-root" class="theme-${channel.themeClass}">
      <div class="delivery-modal-header vqr-modal-head">
        <div class="delivery-modal-title">
          <span>${channel.icon}</span>
          <div>
            <div>${escapeHtml(channel.modalHeaderTitle)}</div>
            <div class="vqr-modal-sub ${channel.themeClass}">${escapeHtml(channel.providerShortName)} • ${channel.accountNo} • Đơn ${escapeHtml(orderCode)}</div>
          </div>
        </div>
        <button class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
          ${FluentIcons.dismiss}
        </button>
      </div>

      <div class="delivery-modal-body vqr-modal-body">
        <!-- Thanh trạng thái phiên thanh toán Demo -->
        <div class="vqr-status-banner ${isAlreadyPaid ? 'paid' : channel.themeClass}" id="vqr-live-status-banner">
          ${isAlreadyPaid ? `
            <div>
              <strong>✅ Đơn hàng đã được xác nhận thanh toán ${escapeHtml(channel.providerShortName)}!</strong>
              <div style="font-size:11.5px; opacity:0.9;">Mã tham chiếu: ${escapeHtml(existingOrder.qrPayment.transactionId)} • Lúc ${escapeHtml(existingOrder.qrPayment.paidAt || 'Vừa xong')}</div>
            </div>
          ` : `
            <div class="vqr-status-left">
              <span class="vqr-pulse-dot ${channel.themeClass}"></span>
              <span>Đang chờ quét mã QR ${escapeHtml(channel.providerShortName)} (Bản Demo)</span>
            </div>
            <div class="vqr-timer-pill">
              ⏱️ <span id="vqr-timer-text">${timerStr}</span>
            </div>
          `}
        </div>

        <!-- Khung mã QR trung tâm -->
        <div class="vqr-modal-qr-stage ${channel.themeClass}">
          <div class="vqr-qr-frame large ${channel.themeClass}">
            <span class="vqr-corner tl"></span>
            <span class="vqr-corner tr"></span>
            <span class="vqr-corner bl"></span>
            <span class="vqr-corner br"></span>
            <img
              class="vqr-qr-img"
              src="${qrData.primaryVietQRUrl}"
              data-fb1="${qrData.fallbackQrServerUrl}"
              data-fb2="${qrData.fallbackQuickChartUrl}"
              data-fallback-step="0"
              alt="Mã QR chuyển khoản ${escapeHtml(channel.providerShortName)} ${channel.accountNo}"
              onerror="handleVietQRImageError(this)"
            >
            <div class="vqr-offline-fallback" style="display:none;">
              <div style="font-size:32px;">${channel.icon}</div>
              <strong>${escapeHtml(channel.providerShortName)} • ${channel.accountNo}</strong>
              <span>Số tiền: ${formatVND(totalAmount)}</span>
              <span>Nội dung: ${escapeHtml(qrData.cleanMemo)}</span>
            </div>
          </div>

          <div class="vqr-amount-mode-switch" style="justify-content:center; margin-top:10px;">
            <button
              type="button"
              class="vqr-mode-btn ${channel.themeClass} ${vqrLockExactAmount ? 'active' : ''}"
              onclick="toggleVietQRAmountMode(true, ${totalAmount}, '${channel.methodKey}', ${existingOrderIdArg})"
            >
              🎯 Khóa đúng số tiền (${formatVND(totalAmount)})
            </button>
            <button
              type="button"
              class="vqr-mode-btn ${channel.themeClass} ${!vqrLockExactAmount ? 'active' : ''}"
              onclick="toggleVietQRAmountMode(false, ${totalAmount}, '${channel.methodKey}', ${existingOrderIdArg})"
            >
              🔓 Mã QR tự nhập số tiền
            </button>
          </div>
        </div>

        <!-- Bảng chi tiết tài khoản thụ hưởng -->
        <div class="vqr-detail-rows modal-box">
          <div class="vqr-detail-row">
            <div>
              <div class="vqr-lbl">Đơn vị thụ hưởng</div>
              <div class="vqr-val bank ${channel.themeClass}">${channel.icon} ${escapeHtml(channel.providerFullName)}</div>
            </div>
          </div>

          <div class="vqr-detail-row">
            <div>
              <div class="vqr-lbl">${escapeHtml(channel.accountLabelTitle)}</div>
              <div class="vqr-val mono">${channel.accountNo}</div>
            </div>
            <button type="button" class="vqr-copy-btn ${channel.themeClass}" onclick="copyVietQRField('${channel.accountNo}', '${escapeHtml(channel.providerShortName)}')">
              Sao chép
            </button>
          </div>

          <div class="vqr-detail-row">
            <div>
              <div class="vqr-lbl">Số tiền cần thanh toán</div>
              <div class="vqr-val price">${formatVND(totalAmount)}</div>
            </div>
            <button type="button" class="vqr-copy-btn ${channel.themeClass}" onclick="copyVietQRField('${totalAmount}', 'số tiền')">
              Sao chép
            </button>
          </div>

          <div class="vqr-detail-row">
            <div>
              <div class="vqr-lbl">Nội dung chuyển khoản</div>
              <div class="vqr-val code">${escapeHtml(qrData.cleanMemo)}</div>
            </div>
            <button type="button" class="vqr-copy-btn ${channel.themeClass}" onclick="copyVietQRField('${escapeHtml(qrData.cleanMemo)}', 'nội dung CK')">
              Sao chép
            </button>
          </div>
        </div>

        <div class="vqr-demo-disclaimer">
          💡 <strong>Lưu ý chế độ Demo:</strong> Mã QR trên sử dụng chuẩn <strong>QR Nhận Tiền Đa Năng thật</strong> trỏ trực tiếp tới <strong>${escapeHtml(channel.providerShortName)} — ${channel.accountNo}</strong>. Sau khi quét thử (hoặc để mô phỏng luồng đặt món), hãy nhấn nút xác nhận bên dưới để hoàn tất đơn hàng!
        </div>

        <!-- Nút hành động xác nhận thanh toán -->
        ${isAlreadyPaid ? `
          <button type="button" class="btn-primary-large" onclick="closeModal()">
            Đóng cửa sổ
          </button>
        ` : existingOrder ? `
          <button
            type="button"
            id="vqr-confirm-paid-btn"
            class="btn-primary-large vqr-confirm-btn ${channel.themeClass}"
            onclick="confirmVietQRForExistingOrder('${escapeHtml(existingOrder.orderId)}')"
          >
            ✅ Tôi đã chuyển ${escapeHtml(channel.providerShortName)} • Xác nhận (${formatVND(totalAmount)})
          </button>
        ` : `
          <div class="vqr-modal-actions">
            <button
              type="button"
              id="vqr-confirm-paid-btn"
              class="btn-primary-large vqr-confirm-btn ${channel.themeClass}"
              onclick="confirmVietQRAndPlaceOrder(${totalAmount}, '${channel.methodKey}')"
            >
              ✅ Tôi đã chuyển ${escapeHtml(channel.providerShortName)} • Hoàn tất đặt đơn (${formatVND(totalAmount)})
            </button>
            <button
              type="button"
              class="vqr-secondary-action-btn"
              onclick="placeOrderWithPendingQR(${totalAmount}, '${channel.methodKey}')"
            >
              🕒 Đặt đơn trước, tôi sẽ quét mã QR ${escapeHtml(channel.providerShortName)} sau
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

// Mô phỏng đối soát giao dịch khi bấm Xác nhận đã chuyển khoản (VPBank hoặc MoMo)
function confirmVietQRAndPlaceOrder(totalAmount, methodKey = null) {
  if (vqrIsVerifying) return;
  vqrIsVerifying = true;

  const channel = getQRChannelConfig(methodKey || selectedPaymentMethod || 'qr');
  selectedPaymentMethod = channel.methodKey;

  const btn = document.getElementById('vqr-confirm-paid-btn');
  const banner = document.getElementById('vqr-live-status-banner');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `🔄 Đang kiểm tra giao dịch ${escapeHtml(channel.providerShortName)} ${channel.accountNo}...`;
  }
  if (banner) {
    banner.innerHTML = `
      <div class="vqr-status-left">
        <span class="vqr-pulse-dot ${channel.themeClass}"></span>
        <span>Đang đối soát giao dịch ${escapeHtml(channel.providerShortName)} tự động (Demo Gateway)...</span>
      </div>
    `;
  }

  const orderCode = getOrCreatePendingCheckoutOrderId();
  const memo = sanitizeVietQRMemo(buildTransferMemoFromOrderId(orderCode));
  const txId = channel.txPrefix + Date.now().toString().slice(-8);
  const paidTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  setTimeout(() => {
    vqrIsVerifying = false;
    if (vqrCountdownInterval) {
      clearInterval(vqrCountdownInterval);
      vqrCountdownInterval = null;
    }
    closeModal();
    submitOrder(totalAmount, {
      isPaid: true,
      channelKey: channel.methodKey,
      bankShortName: channel.providerShortName,
      bankFullName: channel.providerFullName,
      accountNo: channel.accountNo,
      transferContent: memo,
      transactionId: txId,
      paidAt: paidTime
    });
  }, 950);
}

function placeOrderWithPendingQR(totalAmount, methodKey = null) {
  if (vqrIsVerifying) return;
  if (vqrCountdownInterval) {
    clearInterval(vqrCountdownInterval);
    vqrCountdownInterval = null;
  }
  const channel = getQRChannelConfig(methodKey || selectedPaymentMethod || 'qr');
  selectedPaymentMethod = channel.methodKey;

  const orderCode = getOrCreatePendingCheckoutOrderId();
  const memo = sanitizeVietQRMemo(buildTransferMemoFromOrderId(orderCode));
  closeModal();
  submitOrder(totalAmount, {
    isPaid: false,
    channelKey: channel.methodKey,
    bankShortName: channel.providerShortName,
    bankFullName: channel.providerFullName,
    accountNo: channel.accountNo,
    transferContent: memo,
    transactionId: '',
    paidAt: ''
  });
}

function confirmVietQRForExistingOrder(orderId) {
  if (vqrIsVerifying) return;
  const order = (typeof ordersList !== 'undefined')
    ? ordersList.find(o => o.orderId === orderId)
    : null;
  if (!order) return;

  const channelKey = order.qrPayment?.channelKey || (order.paymentMethod === 'momo' ? 'momo' : 'qr');
  const channel = getQRChannelConfig(channelKey);

  vqrIsVerifying = true;
  const btn = document.getElementById('vqr-confirm-paid-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `🔄 Đang xác thực giao dịch ${escapeHtml(channel.providerShortName)} ${channel.accountNo}...`;
  }

  const txId = channel.txPrefix + Date.now().toString().slice(-8);
  const paidTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const memo = order.qrPayment?.transferContent || sanitizeVietQRMemo(buildTransferMemoFromOrderId(order.orderId));

  setTimeout(() => {
    vqrIsVerifying = false;
    order.qrPayment = {
      isPaid: true,
      channelKey: channel.methodKey,
      bankShortName: channel.providerShortName,
      bankFullName: channel.providerFullName,
      accountNo: channel.accountNo,
      transferContent: memo,
      transactionId: txId,
      paidAt: paidTime
    };
    order.paymentMethodName = `${channel.providerShortName} ${channel.accountNo} (Đã thanh toán • Mã GD ${txId})`;

    if (typeof DB !== 'undefined' && DB.isReady) {
      DB.saveCurrentUserOrders(ordersList);
    }

    closeModal();
    showToast('checkmarkFilled', `🎉 Đã xác nhận thanh toán ${channel.providerShortName} (${formatVND(order.totalAmount)}) cho đơn ${order.orderId}!`);
    if (currentView === 'activity') {
      renderActivityView();
    } else if (currentView === 'profile' && typeof renderProfileView === 'function') {
      renderProfileView();
    }
  }, 850);
}
