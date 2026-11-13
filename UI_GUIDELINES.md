# Hướng Dẫn Thiết Kế & Phát Triển Giao Diện (UI/UX Guidelines) — PtitNgon

Tài liệu này tổng hợp các quy ước bắt buộc khi xây dựng hoặc chỉnh sửa giao diện (HTML/CSS/JS) trong dự án **APP Giao Hang PtitNgon** để AI và lập trình viên luôn giữ sự đồng bộ giữa **Mobile** và **PC**, không gây giật layout hay mất DOM.

---

## 1. Khác biệt cốt lõi giữa giao diện PC và Điện thoại

Hệ thống viết CSS theo hướng **Mobile-first**, sau đó mở rộng cho Desktop trong `@media (min-width: 768px)` (xem [css/style.css](css/style.css)).

| Thành phần | Điện thoại (`< 768px`) | PC / Desktop (`>= 768px`) |
| :--- | :--- | :--- |
| **Điều hướng chính** | `.bottom-nav` cố định ở đáy màn hình (`padding-bottom` hỗ trợ `env(safe-area-inset-bottom)`). | Ẩn `.bottom-nav`, hiển thị `.desktop-sidebar` cố định bên trái với độ rộng `var(--sidebar-width, 270px)`. |
| **Header trang con** | `.page-nav-header` dính ở đỉnh (`position: sticky; top: 0;`), nền trắng, viền dưới rõ. | `.page-nav-header` trong suốt, nằm tự nhiên đầu luồng trang; khi cuộn qua (`scrollY > 45`), hiện `.floating-page-topbar` dạng viên thuốc nổi ở đỉnh. |
| **Modal / Dialog** | Dạng Bottom Sheet trượt từ đáy lên (`align-items: flex-end`, bo tròn 2 góc trên `24px 24px 0 0`). | Căn giữa vùng nội dung bên phải sidebar (`left: var(--sidebar-width, 270px)`, `align-items: center`, bo 4 góc `24px`, `max-width: 580px`). |
| **Danh sách ngang** | Vuốt trực tiếp bằng tay (`overflow-x: auto`, ẩn scrollbar). Ẩn `.scroll-arrow-controls`. | Hiển thị `.scroll-arrow-controls` thông minh bên phải tiêu đề hoặc cạnh thanh cuộn; nhiều danh sách lớn chuyển sang CSS Grid. |
| **Bố cục trang chi tiết / giỏ / thanh toán** | Xếp 1 cột theo chiều dọc; CTA chính cố định đáy màn hình. | Chia **2 cột** (nội dung trái + cột tóm tắt `sticky` bên phải). |

---

## 2. Tối ưu Button: Không làm mất DOM, cập nhật tại chỗ, không reload

1. **Bắt buộc dùng `<button type="button">`:**
   - Tuyệt đối **không** dùng `<a href="#">` để làm nút bấm (dễ kích hoạt `hashchange`, đẩy URL về `#`, gây cuộn đầu trang hoặc hỏng lịch sử `window.history`).
   - Mọi thẻ `<button>` không dùng để submit form đều phải có `type="button"`.
   - Kiểm tra lại các thẻ `<button>` sau khi sửa HTML/JS để chắc chắn không thiếu `type="button"` và không còn thẻ `<a href="#">` làm nút bấm.
2. **Cập nhật DOM tại chỗ (In-place DOM Update):**
   - Với các thao tác cục bộ (tăng/giảm số lượng, xóa một món trong giỏ, áp/gỡ voucher, chọn size/topping, đổi trạng thái chip, bật/tắt yêu thích), **không** gọi lại `render()` để thay toàn bộ `app.innerHTML`.
   - Gọi `app.innerHTML = ...` liên tục sẽ phá hủy DOM đang có, làm mất focus ô nhập liệu, giật thanh cuộn và kích hoạt lại animation từ đầu.
   - Hãy tham khảo và dùng các hàm cập nhật tại chỗ như `updateCartViewInPlace()` trong [js/app.js](js/app.js) và `updateDishDetailCustomizerInPlace()` trong [js/dish-detail.js](js/dish-detail.js).
3. **Khi bắt buộc phải chuyển view (`render()`):**
   - Lưu và khôi phục vị trí cuộn qua `saveCurrentViewScroll()` và `restoreViewScroll()`.
   - Tránh đặt `useEffect`/observer/animation làm thay đổi chiều cao hoặc `padding` của phần tử sticky khi đang cuộn.

---

## 3. Quy chuẩn `page-nav-header` và `floating-topbar-inner`

### `.page-nav-header`
- **Mobile (`< 768px`):**
  - Dùng `padding: 13px var(--safe-padding); min-height: 64px;`, `position: sticky; top: 0; z-index: 500;`.
  - Khi thêm class `.is-scrolled` lúc cuộn, **tuyệt đối không thay đổi `padding` hay chiều cao** (tránh vòng lặp giật layout).
- **Desktop (`>= 768px`):**
  - Container cấp trang (`cart-view-container`, `checkout-view-container`, `activity-view-container`, `dish-safety-nutrition-view-container`, `product-detail-page`, `osv-container`) chuẩn hóa cùng `padding: 24px 36px 60px !important;`.
  - `.page-nav-header` giữ `padding: 30px 0 20px 0 !important; min-height: 90px !important; margin-bottom: 8px !important;`.
  - Khi `.is-scrolled` trên Desktop: ẩn mượt bằng `opacity: 0; visibility: hidden; pointer-events: none;`, giữ nguyên kích thước & padding để không làm thay đổi chiều cao toàn trang.
- **Cấu trúc HTML chuẩn bên trong `.page-nav-header`:**
  ```html
  <div class="page-nav-header">
    <button type="button" class="page-back-icon-btn" onclick="window.goBack()" aria-label="Quay lại">
      ${FluentIcons.arrowLeft}
    </button>
    <div class="page-nav-title">Tiêu đề trang</div>
    <div class="page-nav-spacer"></div> <!-- hoặc cụm nút hành động bên phải -->
  </div>
  ```
  - Nếu bên phải không có nút chức năng, luôn dùng `<div class="page-nav-spacer"></div>` (`38px x 38px`) để `.page-nav-title` được căn giữa chính xác.

### `.floating-page-topbar` & `.floating-topbar-inner`
- Quản lý bởi `updateFloatingTopBar()` trong [js/app.js](js/app.js).
- **Chỉ hiển thị trên Desktop (`>= 768px`)** khi trang có `.page-nav-header` và cuộn qua ngưỡng (`scrollY > 45`, có vùng đệm hysteresis `scrollY > 32` để chống nhấp nháy). Tự động ẩn nếu `.dbm-bulk-bar.active` đang bật.
- Kiểu dáng viên thuốc nổi (`border-radius: 9999px`), căn theo vùng làm việc bên phải sidebar (`left: calc(var(--sidebar-width, 270px) + 24px); right: 24px;`).
- Bên trong `.floating-topbar-inner`: các nút back dùng kích thước gọn `36px x 36px`, tiêu đề `15.5px` luôn nằm trên 1 dòng có ellipsis.
- Khi đồng bộ HTML vào `#floating-topbar-inner`, phải cache chuỗi HTML (`lastSyncedTopBarHtml`) để không gán lại `innerHTML` mỗi sự kiện `scroll`.

---

## 4. `scroll-arrow-controls` thông minh cho giao diện PC

Mọi hàng cuộn ngang (danh mục, gợi ý món, `ai-quick-prompts-bar`, `ai-prompt-grid`, subtabs) khi hiển thị trên PC cần gắn `.scroll-arrow-controls` thông minh:

1. **Ẩn tự động trên Mobile:** Quy tắc toàn cục trong [css/style.css](css/style.css) đã ẩn `.scroll-arrow-controls { display: none !important; }` dưới `768px` để ưu tiên vuốt cảm ứng.
2. **HTML chuẩn:**
   ```html
   <div class="scroll-arrow-controls ai-smart-scroll-controls" data-scroll-target="target-scroll-id">
     <button type="button" class="scroll-arrow-btn small" data-scroll-dir="left"
       onclick="scrollHorizontally('target-scroll-id', -240)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
       ${FluentIcons.chevronLeft}
     </button>
     <button type="button" class="scroll-arrow-btn small" data-scroll-dir="right"
       onclick="scrollHorizontally('target-scroll-id', 240)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
       ${FluentIcons.chevronRight}
     </button>
   </div>
   ```
3. **Hành vi thông minh (xem `initAISmartScrollControls` & `syncAISmartScrollControls` trong [js/ai-chat.js](js/ai-chat.js)):**
   - **Không tràn ngang (`scrollWidth - clientWidth <= 2`):** Thêm class `.is-non-scrollable` để ẩn luôn cặp mũi tên.
   - **Đang ở đầu (`scrollLeft <= 2`):** Đặt `disabled = true` cho nút trái.
   - **Đang chạm cuối (`scrollLeft >= maxScroll - 2`):** Đặt `disabled = true` cho nút phải.
   - Gắn listener `scroll` (`{ passive: true }`) lên vùng cuộn và `resize` lên `window`, gọi `requestAnimationFrame` ngay sau khi render view.

---

## 5. Giao diện 2 cột tối ưu cho PC

Các màn hình có danh sách/nội dung dài kết hợp bảng tóm tắt hoặc thao tác đặt hàng/thanh toán (Giỏ hàng, Xác nhận đơn hàng, Chi tiết đơn hàng, Chi tiết món ăn) phải chuyển sang **2 cột** từ `>= 768px`:

- **Grid chính:**
  - Tỉ lệ khuyến nghị: `grid-template-columns: 1.4fr 1fr` (hoặc `minmax(0, 1.38fr) minmax(350px, 0.95fr)` cho PDP), `gap: 24px–32px; align-items: start;`.
  - Mọi phần tử con trực tiếp trong Grid hoặc Flex có chứa chữ dài / thanh cuộn ngang **bắt buộc có `min-width: 0`** để tránh tràn cột.
- **Cột phải Sticky:**
  - `.cart-right-col`, `.checkout-right-col` sử dụng `position: sticky; top: 90px; display: flex; flex-direction: column; gap: 16px;`.
  - Trên Desktop, đưa nút CTA chính (VD: `.cart-bottom-bar`) từ thanh fixed dưới đáy màn hình vào bên trong cột phải (`position: static`) để người dùng vừa nhìn tổng tiền vừa bấm đặt hàng ngay.

---

## 6. Sử dụng Fluent Icons thay vì Emoji & Quy tắc thêm màu

1. **Ưu tiên `FluentIcons.*` ([js/fluent-icons.js](js/fluent-icons.js)):**
   - Dùng icon SVG chuẩn Microsoft Fluent cho **toàn bộ** icon điều hướng, nút bấm, tab, trạng thái, bộ lọc, giỏ hàng, thanh toán, cảnh báo.
   - Không dùng emoji thay cho icon giao diện vì emoji hiển thị khác nhau giữa Windows/iOS/Android và khó căn chỉnh kích thước.
   - Emoji chỉ dùng hạn chế cho nội dung mang tính minh họa ẩm thực/chào hỏi khi không cần đồng bộ hệ thống nút.
2. **Có nên thêm màu cho Fluent Icon không?**
   - **Mặc định không tô màu cứng (dùng `fill="currentColor"` và `color: inherit`):** Áp dụng cho icon trong nút bấm, thanh tab, menu điều hướng, card thao tác — để icon tự đổi màu đồng nhất với chữ khi `:hover`, `.active` hoặc `disabled`.
   - **Chỉ thêm màu khi icon mang ngữ nghĩa trạng thái rõ ràng (Semantic Color):**
     - Thương hiệu / xác nhận / thành công: xanh lá (`var(--green-600)` / `#10b981`).
     - Đánh giá sao / nổi bật / cảnh báo nhẹ: vàng cam (`#f59e0b`).
     - Xóa / cảnh báo lỗi / yêu thích (tim đầy): đỏ (`#dc2626` / `#ef4444`).
     - AI / thông minh: xanh dương / tím (`#6366f1`, `#00b14f`).
   - Tránh tô nhiều màu sặc sỡ trên cùng một hàng nút để không làm phân tán sự chú ý khỏi CTA chính.

---

## 7. Quy chuẩn `modal-overlay`, Static Backdrop, nút đóng đỏ nổi bật & Modal Footer

1. **Chạm ra ngoài không bị thoát (Static Backdrop):**
   - Dùng `onclick="closeModalOnBackdrop(event)"` (hoặc hàm tương đương cho modal riêng).
   - Khi người dùng bấm ra vùng nền mờ `.modal-overlay` bên ngoài `.bottom-sheet`, **không đóng modal** (tránh mất dữ liệu form/lựa chọn món đang làm dở).
   - Thay vào đó, kích hoạt phản hồi trực quan:
     - Thêm/replay class `.modal-shake-prompt` trên `.bottom-sheet` (rung nhẹ viền đỏ).
     - Thêm/replay class `.close-btn-nudge` trên nút đóng để chỉ dẫn vị trí đóng modal (xem `closeModalOnBackdrop` trong [js/app.js](js/app.js)).
2. **Nút đóng rõ ràng, nổi bật sắc đỏ:**
   - Đặt nút đóng cố định ở góc header của modal (`.dish-modal-close-btn`, `.dbm-close-btn` hoặc `.modal-close-btn`).
   - Style khuyến nghị: nút tròn `34px–36px`, dễ bấm, có trạng thái nhấn mạnh màu đỏ (`background: #fee2e2; color: #dc2626;` khi hover/active, hoặc nổi đỏ `linear-gradient(135deg, #ef4444, #dc2626)` chữ trắng với modal cần cảnh báo/thoát rõ ràng) để người dùng nhận ra ngay nút thoát hợp lệ sau khi bị chặn chạm nền ngoài.
3. **Luôn tách vùng Footer cố định cho Button (`.delivery-modal-footer` / `.modal-footer`):**
   - Cấu trúc modal 3 phần theo trục dọc Flex (`display: flex; flex-direction: column; max-height: 90vh;` trên Mobile / `88vh` trên Desktop):
     1. **Header** (`flex-shrink: 0`): tiêu đề + nút đóng.
     2. **Body** (`flex: 1 1 auto; min-height: 0; overflow-y: auto;`): nội dung form/danh sách cuộn độc lập.
     3. **Footer** (`.delivery-modal-footer` / `.modal-footer`): `position: sticky; bottom: 0; flex-shrink: 0; padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));` chứa nút Hủy / Lưu / Xác nhận. Không đặt nút xác nhận trôi tuột xuống cuối danh sách dài.

---

## 8. Mật độ chữ & tối ưu 1 dòng cho màn hình Điện thoại

- **Không viết dài dòng trên UI di động:** Ở chiều rộng `360px–430px`, văn bản quá dài làm vỡ nút, đẩy lệch cột hoặc tạo khoảng trắng xấu.
- **Ưu tiên giữ 1 dòng cho:**
  - Tiêu đề `.page-nav-title`, `.floating-topbar-inner .page-nav-title`
  - Nhãn nút bấm (CTA, chip filter, tab điều hướng, pill gợi ý nhanh)
  - Tên quán/địa chỉ tóm tắt trên thẻ nhỏ và sidebar
  - Sử dụng bộ CSS chuẩn:
    ```css
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    ```
- **Giới hạn tối đa 2 dòng cho tiêu đề/mô tả thẻ món:**
  - Dùng `-webkit-line-clamp: 2` (`display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;`) để mọi card trong cùng hàng/lưới có chiều cao đồng đều.
- **Thông tin giải thích dài** (mô tả chi tiết món, dinh dưỡng chuyên sâu, hướng dẫn/lưu ý) đưa vào màn hình chi tiết hoặc modal riêng thay vì nhồi lên màn hình danh sách.

---

## 9. Bài học thực tế: Bảo vệ `sticky` Header, Chống tràn Grid Mobile & `backdrop-filter`

1. **Giữ `position: sticky` cho `.page-nav-header` trên Mobile:**
   - **Không** đặt `overflow-x: hidden` (hay `overflow: hidden` / `auto`) lên container cấp trang chứa `.page-nav-header` (VD: `.favorites-view-container`, `.cart-view-container`), vì sẽ làm `sticky` mất tác dụng và cuốn header trôi theo trang.
   - Mọi container cấp trang có `.fade-in` **bắt buộc** phải được thêm vào nhóm `fade-opacity-only` trong [css/style.css](css/style.css) để tránh `transform` tạo containing block làm hỏng `sticky` / `fixed`.
   - Trên Mobile, không đặt `padding` ngang lên container cấp trang (để `.page-nav-header` tràn sát 2 mép), mà đặt `padding: 0 var(--safe-padding)` ở các khối nội dung bên dưới header.
2. **Chống tràn ngang CSS Grid / Flex trên Mobile (thay vì dùng `overflow-x: hidden` ở trang):**
   - Dùng `grid-template-columns: minmax(0, 1fr)` thay vì `1fr` (`1fr` tương đương `minmax(auto, 1fr)` nên vẫn có thể phình quá `100%` theo phần tử con).
   - Đặt `min-width: 0; max-width: 100%; box-sizing: border-box;` cho thẻ card và các hàng flex (`-top`, `-bottom`) chứa chữ `text-overflow: ellipsis`. Nếu cần cắt tràn, đặt `overflow: hidden` ở **từng card**, không đặt trên container ngoài của `.page-nav-header`.
3. **Hiệu ứng kính mờ (`backdrop-filter`) rõ nét trên nền ảnh:**
   - Giữ độ đục nền ở mức vừa phải (`rgba(255, 255, 255, 0.55–0.65)`) kèm `backdrop-filter: blur(16px) saturate(180%)`; nền `>= 0.85` sẽ che gần hết màu ảnh phía sau khiến hiệu ứng blur không nhìn thấy được.
   - Tránh đặt `.fade-in` (có `transform` / `opacity`) lên phần tử cha bọc trực tiếp các nút dùng `backdrop-filter` (như `.home-header .location-row.fade-in`) để không tách stacking context làm mất blur.


