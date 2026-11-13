/* ========================================
   ptitngon - Store Detail View
   Trang Xem Cửa Hàng: Dành cho bạn, Thực đơn,
   Đánh giá chung & Gợi ý quán khác theo từ khóa
   ======================================== */

var viewingStoreDetailId = null;
var storeDetailActiveTab = 'for-you'; // 'for-you' | 'menu' | 'reviews'
var storeDetailMenuQuery = '';
var storeDetailMenuTag = 'all';
var storeDetailReviewFilter = 'all';
var storeDetailSuggestKeyword = '';
var storeDetailSourceView = 'home';

function findStoreByIdOrName(idOrName) {
  const list = Array.isArray(restaurants) ? restaurants : [];
  if (idOrName === null || idOrName === undefined) return null;
  const numId = Number(idOrName);
  if (Number.isFinite(numId) && String(idOrName).trim() !== '') {
    const byId = list.find(r => Number(r.id) === numId);
    if (byId) return byId;
  }
  const nameLower = String(idOrName).trim().toLowerCase();
  if (!nameLower) return null;
  return list.find(r => String(r.name || '').trim().toLowerCase() === nameLower)
    || list.find(r => String(r.name || '').toLowerCase().includes(nameLower))
    || null;
}

function openStoreDetailView(storeId, tab = 'for-you', sourceView = null) {
  const store = findStoreByIdOrName(storeId);
  if (!store) {
    if (typeof openSearchView === 'function') {
      openSearchView(typeof storeId === 'string' ? storeId : '');
    }
    return;
  }

  if (typeof saveCurrentViewScroll === 'function') {
    saveCurrentViewScroll();
  }

  if (sourceView) {
    storeDetailSourceView = sourceView;
  } else if (typeof currentView === 'string' && currentView !== 'store-detail') {
    storeDetailSourceView = currentView;
  }

  const normalizedTab = (tab === 'menu' || tab === 'reviews') ? tab : 'for-you';
  viewingStoreDetailId = Number(store.id);
  storeDetailActiveTab = normalizedTab;
  storeDetailMenuQuery = '';
  storeDetailMenuTag = 'all';
  storeDetailReviewFilter = 'all';

  const keywords = getStoreKeywordSuggestions(store);
  storeDetailSuggestKeyword = keywords.length > 0 ? keywords[0] : (store.category || '');

  currentView = 'store-detail';
  render({ scrollTop: 0 });
}

function openStoreDetailByName(storeName, tab = 'for-you') {
  const store = findStoreByIdOrName(storeName);
  if (store) {
    openStoreDetailView(store.id, tab);
  } else if (typeof openSearchView === 'function') {
    openSearchView(storeName || '');
  }
}

function backFromStoreDetailView() {
  if (storeDetailSourceView === 'favorites' && typeof openFavoritesView === 'function') {
    openFavoritesView();
    return;
  }
  if (storeDetailSourceView === 'search' && typeof openSearchView === 'function') {
    openSearchView(typeof searchQuery === 'string' ? searchQuery : '', typeof activeFilterChip !== 'undefined' ? activeFilterChip : null);
    return;
  }
  if (storeDetailSourceView === 'dish-detail' && typeof modalDish !== 'undefined' && modalDish && typeof renderDishDetailView === 'function') {
    currentView = 'dish-detail';
    render();
    return;
  }
  if (typeof openHomeView === 'function') {
    openHomeView();
  } else {
    currentView = 'home';
    render();
  }
}

function getStoreKeywordSuggestions(store) {
  const kwMap = new Map();
  const addKw = (raw) => {
    const clean = String(raw || '').trim();
    if (!clean || clean.length < 2) return;
    const key = clean.toLowerCase();
    if (!kwMap.has(key)) kwMap.set(key, clean);
  };

  if (store.category) addKw(store.category);
  if (Array.isArray(store.tags)) {
    store.tags.forEach(addKw);
  }

  const dishes = Array.isArray(store.relatedDishes) ? store.relatedDishes : [];
  dishes.forEach(d => {
    if (d.category) addKw(d.category);
    if (Array.isArray(d.tags)) d.tags.forEach(addKw);
  });

  // Trích từ khóa ẩm thực phổ biến từ tên quán nếu còn ít
  const commonTokens = ['Phở', 'Bún', 'Cơm', 'Bánh mì', 'Gà rán', 'Trà sữa', 'Cà phê', 'Đồ uống', 'Pizza', 'Sushi', 'Healthy', 'Lẩu', 'Mì'];
  const nameLower = String(store.name || '').toLowerCase();
  commonTokens.forEach(tok => {
    if (nameLower.includes(tok.toLowerCase())) addKw(tok);
  });

  return Array.from(kwMap.values()).slice(0, 8);
}

function getStoreForYouDishes(store) {
  const dishes = Array.isArray(store.relatedDishes) ? store.relatedDishes : [];
  if (dishes.length === 0) return [];

  const user = (typeof DB !== 'undefined' && DB.isReady && typeof DB.getCurrentUser === 'function')
    ? DB.getCurrentUser()
    : null;
  const hp = user && user.healthProfile ? user.healthProfile : null;
  const favSet = new Set((user && Array.isArray(user.favoriteItemIds) ? user.favoriteItemIds : []).map(x => String(x)));
  const wantHealthy = !!(hp && (hp.wantKeepFit || hp.personaType === 'gym' || hp.personaType === 'diet'));

  const scored = dishes.map((dish, originalIdx) => {
    let score = 0;
    let reason = 'Món nổi bật tại quán';
    const isOut = dish.inStock === false;
    if (isOut) score -= 100;

    if (favSet.has(String(dish.id)) || dish.fav) {
      score += 25;
      reason = 'Bạn đã thả tim món này';
    }

    const healthyScore = (typeof dbmGetItemHealthy === 'function')
      ? Number(dbmGetItemHealthy(dish).score || 7.5)
      : Number(dish.healthyScore || 7.5);

    if (wantHealthy && healthyScore >= 7.8) {
      score += 20 + healthyScore;
      reason = `Hợp mục tiêu Healthy (${healthyScore.toFixed(1)}/10)`;
    } else if (healthyScore >= 8.2) {
      score += 12;
      reason = `Lành mạnh ${healthyScore.toFixed(1)}/10`;
    }

    const sold = Number(dish.soldCount || 0);
    if (sold > 0) {
      score += Math.min(15, sold / 40);
      if (reason === 'Món nổi bật tại quán' && sold >= 100) {
        reason = `Bán chạy (${sold}+ phần)`;
      }
    }

    if (Number(dish.price) > 0 && Number(dish.price) <= 40000) {
      score += 8;
      if (reason === 'Món nổi bật tại quán') reason = 'Giá sinh viên dễ chọn';
    }

    return { dish, originalIdx, score, reason };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6);
}

function buildStoreReviewsData(store) {
  const dishes = Array.isArray(store.relatedDishes) ? store.relatedDishes : [];
  const collected = [];

  // 1. Lấy các review có sẵn trên món của quán
  dishes.forEach(d => {
    if (Array.isArray(d.reviews)) {
      d.reviews.forEach(rv => {
        collected.push({
          author: rv.author || 'Sinh viên PTIT',
          avatar: rv.avatar || '🧑‍🎓',
          rating: Number(rv.rating || 5),
          date: rv.date || 'Gần đây',
          dishName: d.name,
          comment: rv.comment || rv.text || ''
        });
      });
    }
  });

  // 2. Bổ sung review tổng quan gắn với quán nếu ít review
  const baseRating = Number(store.rating || 4.8);
  const sampleDish1 = dishes[0] ? dishes[0].name : 'món chính';
  const sampleDish2 = dishes[1] ? dishes[1].name : sampleDish1;

  if (collected.length < 4) {
    const defaults = [
      {
        author: 'Minh Anh • D22CNTT',
        avatar: '👩‍💻',
        rating: 5,
        date: 'Hôm nay',
        dishName: sampleDish1,
        comment: `${store.shortReview || 'Đồ ăn nóng hổi, đóng gói cẩn thận.'} Giao tới cổng PTIT rất nhanh!`
      },
      {
        author: 'Tuấn Kiệt • KTX B2',
        avatar: '🧑‍🎓',
        rating: 5,
        date: '2 ngày trước',
        dishName: sampleDish2,
        comment: 'Phần ăn đầy đặn, đúng chuẩn vị và giá hợp túi tiền sinh viên.'
      },
      {
        author: 'Thảo Vy • D23Marketing',
        avatar: '🎧',
        rating: baseRating >= 4.7 ? 5 : 4,
        date: '4 ngày trước',
        dishName: sampleDish1,
        comment: 'Đặt giờ trưa hơi đông nhưng quán làm món gọn gàng, sạch sẽ, không bị đổ nước sốt.'
      },
      {
        author: 'Hoàng Nam • PTIT',
        avatar: '⚽',
        rating: 4,
        date: 'Tuần trước',
        dishName: sampleDish2,
        comment: 'Hương vị ổn định, rất đáng thử nếu ở quanh khu vực Trần Phú - Hà Đông.'
      }
    ];
    defaults.forEach(d => {
      if (!collected.some(x => x.comment === d.comment)) {
        collected.push(d);
      }
    });
  }

  const total = collected.length;
  const avg = total > 0
    ? (collected.reduce((s, r) => s + Number(r.rating || 5), 0) / total)
    : baseRating;
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  collected.forEach(r => {
    const star = Math.min(5, Math.max(1, Math.round(Number(r.rating || 5))));
    dist[star] = (dist[star] || 0) + 1;
  });

  return {
    average: Number(store.rating || avg || 4.8).toFixed(1),
    countLabel: store.reviewCount || `${total}+ đánh giá`,
    reviews: collected,
    dist
  };
}

function getSuggestedOtherStores(store, keyword) {
  const list = Array.isArray(restaurants) ? restaurants : [];
  const others = list.filter(r => Number(r.id) !== Number(store.id));
  const kwLower = String(keyword || '').trim().toLowerCase();

  if (!kwLower) {
    return others
      .slice()
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 6);
  }

  const scored = others.map(r => {
    let score = 0;
    const nameL = String(r.name || '').toLowerCase();
    const catL = String(r.category || '').toLowerCase();
    const reviewL = String(r.shortReview || '').toLowerCase();
    const tagsL = Array.isArray(r.tags) ? r.tags.map(t => String(t).toLowerCase()) : [];

    if (catL.includes(kwLower)) score += 30;
    if (nameL.includes(kwLower)) score += 25;
    if (tagsL.some(t => t.includes(kwLower))) score += 20;
    if (reviewL.includes(kwLower)) score += 10;

    const dishes = Array.isArray(r.relatedDishes) ? r.relatedDishes : [];
    const matchedDishes = dishes.filter(d =>
      String(d.name || '').toLowerCase().includes(kwLower) ||
      String(d.category || '').toLowerCase().includes(kwLower) ||
      (Array.isArray(d.tags) && d.tags.some(t => String(t).toLowerCase().includes(kwLower)))
    );
    score += Math.min(25, matchedDishes.length * 8);

    return { store: r, score, matchedCount: matchedDishes.length };
  }).filter(x => x.score > 0);

  scored.sort((a, b) => b.score - a.score || Number(b.store.rating || 0) - Number(a.store.rating || 0));
  return scored.slice(0, 6).map(x => ({ ...x.store, _matchedDishCount: x.matchedCount }));
}

function renderStoreDishRowCard(dish, storeId, originalIdx, badgeText = '') {
  const isOut = dish.inStock === false;
  const isDishFav = (typeof dish.fav === 'boolean')
    ? dish.fav
    : (typeof DB !== 'undefined' && DB.isItemFavorite ? DB.isItemFavorite(dish.id) : false);
  const dishIdEsc = escapeHtml(String(dish.id));

  return `
    <article class="store-dish-card ${isOut ? 'dish-out-of-stock' : ''}"
      role="button"
      tabindex="0"
      onclick="${isOut ? `showToast('alertRegular', 'Món này hiện đang tạm hết hàng!')` : `openDishOptionModalByIndices(${storeId}, ${originalIdx})`}"
    >
      <div class="store-dish-img-wrap">
        <img class="store-dish-img" data-vt-dish="${dishIdEsc}" src="${escapeHtml(dish.image)}" alt="${escapeHtml(dish.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
        <button type="button"
          class="dish-fav-btn ${isDishFav ? 'active' : ''}"
          data-fav-dish-id="${dishIdEsc}"
          onclick="event.stopPropagation(); toggleDishFav('${dishIdEsc}', ${storeId})"
          title="Lưu món yêu thích"
          aria-label="Lưu món yêu thích"
        >
          ${isDishFav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
        </button>
      </div>
      <div class="store-dish-body">
        ${badgeText ? `<div class="store-dish-reason-pill">${escapeHtml(badgeText)}</div>` : ''}
        <div class="store-dish-name" title="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</div>
        <div class="store-dish-desc">${escapeHtml(dish.description || 'Chế biến tươi nóng trong ngày, nguyên liệu tuyển chọn sạch sẽ.')}</div>
        <div class="store-dish-footer">
          <span class="store-dish-price">${dish.priceFormatted || formatVND(dish.price)}</span>
          ${isOut ? `
            <span class="fav-dish-out-badge">Hết hàng</span>
          ` : `
            <button type="button"
              class="store-dish-add-btn"
              onclick="event.stopPropagation(); openDishOptionModalByIndices(${storeId}, ${originalIdx})"
              title="Chọn tuỳ chọn & thêm vào giỏ"
            >
              + Thêm
            </button>
          `}
        </div>
      </div>
    </article>
  `;
}

function renderStoreTabContent(store) {
  const dishes = Array.isArray(store.relatedDishes) ? store.relatedDishes : [];

  if (storeDetailActiveTab === 'for-you') {
    const forYouList = getStoreForYouDishes(store);
    const revData = buildStoreReviewsData(store);
    return `
      <section class="store-section">
        <div class="store-section-head">
          <div>
            <h2 class="store-section-title">${FluentIcons.sparkleFilled} Dành riêng cho bạn tại quán</h2>
            <p class="store-section-sub">Gợi ý dựa trên sở thích, độ lành mạnh và món được đặt nhiều nhất</p>
          </div>
          <button type="button" class="store-inline-link-btn" onclick="switchStoreDetailTab('menu')">
            Xem tất cả (${dishes.length}) →
          </button>
        </div>
        ${forYouList.length === 0 ? `
          <div class="fav-section-empty">Quán hiện chưa cập nhật món ăn nào.</div>
        ` : `
          <div class="store-dishes-grid">
            ${forYouList.map(({ dish, originalIdx, reason }) => renderStoreDishRowCard(dish, store.id, originalIdx, reason)).join('')}
          </div>
        `}
      </section>

      <section class="store-section store-reviews-preview-box">
        <div class="store-section-head">
          <div>
            <h2 class="store-section-title">${FluentIcons.starFilled} Đánh giá nổi bật (${revData.average}★)</h2>
            <p class="store-section-sub">${escapeHtml(revData.countLabel)} từ khách hàng đã đặt</p>
          </div>
          <button type="button" class="store-inline-link-btn" onclick="switchStoreDetailTab('reviews')">
            Xem đánh giá →
          </button>
        </div>
        <div class="store-review-list compact">
          ${revData.reviews.slice(0, 2).map(rv => `
            <div class="store-review-card">
              <div class="store-review-top">
                <div class="store-review-author">
                  <span class="store-review-avatar">${rv.avatar}</span>
                  <div>
                    <div class="store-review-name">${escapeHtml(rv.author)}</div>
                    <div class="store-review-meta">${escapeHtml(rv.date)} • Món: ${escapeHtml(rv.dishName)}</div>
                  </div>
                </div>
                <span class="store-review-stars">${FluentIcons.starFilled} ${Number(rv.rating).toFixed(1)}</span>
              </div>
              <p class="store-review-text">${escapeHtml(rv.comment)}</p>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  if (storeDetailActiveTab === 'menu') {
    const tagSet = new Set();
    dishes.forEach(d => {
      if (d.category) tagSet.add(String(d.category).trim());
      if (Array.isArray(d.tags)) {
        d.tags.slice(0, 2).forEach(t => tagSet.add(String(t).trim()));
      }
    });
    const menuTags = Array.from(tagSet).filter(Boolean).slice(0, 10);

    const qL = storeDetailMenuQuery.trim().toLowerCase();
    const filtered = dishes
      .map((dish, originalIdx) => ({ dish, originalIdx }))
      .filter(({ dish }) => {
        if (storeDetailMenuTag !== 'all') {
          const catMatch = String(dish.category || '').toLowerCase() === storeDetailMenuTag.toLowerCase();
          const tagMatch = Array.isArray(dish.tags) && dish.tags.some(t => String(t).toLowerCase() === storeDetailMenuTag.toLowerCase());
          if (!catMatch && !tagMatch) return false;
        }
        if (qL) {
          const inName = String(dish.name || '').toLowerCase().includes(qL);
          const inDesc = String(dish.description || '').toLowerCase().includes(qL);
          const inTags = Array.isArray(dish.tags) && dish.tags.some(t => String(t).toLowerCase().includes(qL));
          if (!inName && !inDesc && !inTags) return false;
        }
        return true;
      });

    return `
      <section class="store-section">
        <div class="store-menu-toolbar">
          <div class="store-menu-search-box">
            ${FluentIcons.searchRegular}
            <input type="text"
              id="store-menu-search-input"
              value="${escapeHtml(storeDetailMenuQuery)}"
              placeholder="Tìm món trong thực đơn của quán..."
              oninput="handleStoreMenuSearchInput(this.value)"
            >
            ${storeDetailMenuQuery ? `
              <button type="button" class="store-menu-clear-btn" onclick="handleStoreMenuSearchInput('', true)" aria-label="Xóa tìm kiếm">
                ${FluentIcons.dismiss}
              </button>
            ` : ''}
          </div>
          ${menuTags.length > 1 ? `
            <div class="store-menu-tag-chips">
              <button type="button" class="store-tag-chip ${storeDetailMenuTag === 'all' ? 'active' : ''}" onclick="switchStoreMenuTag('all')">
                Tất cả (${dishes.length})
              </button>
              ${menuTags.map(t => `
                <button type="button" class="store-tag-chip ${storeDetailMenuTag === t ? 'active' : ''}" onclick="switchStoreMenuTag('${escapeHtml(t)}')">
                  ${escapeHtml(t)}
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div id="store-menu-list-wrap">
          ${filtered.length === 0 ? `
            <div class="fav-section-empty">Không tìm thấy món nào khớp "${escapeHtml(storeDetailMenuQuery || storeDetailMenuTag)}" trong thực đơn quán.</div>
          ` : `
            <div class="store-dishes-grid">
              ${filtered.map(({ dish, originalIdx }) => renderStoreDishRowCard(dish, store.id, originalIdx)).join('')}
            </div>
          `}
        </div>
      </section>
    `;
  }

  // Tab: reviews
  const revData = buildStoreReviewsData(store);
  const filteredReviews = revData.reviews.filter(rv => {
    if (storeDetailReviewFilter === 'all') return true;
    return Math.round(Number(rv.rating || 5)) === Number(storeDetailReviewFilter);
  });

  return `
    <section class="store-section">
      <div class="store-reviews-summary-card">
        <div class="store-reviews-score-col">
          <div class="store-reviews-big-num">${revData.average}</div>
          <div class="store-reviews-stars-row">${FluentIcons.starFilled}${FluentIcons.starFilled}${FluentIcons.starFilled}${FluentIcons.starFilled}${FluentIcons.starFilled}</div>
          <div class="store-reviews-count-lbl">${escapeHtml(revData.countLabel)}</div>
        </div>
        <div class="store-reviews-bars-col">
          ${[5, 4, 3, 2, 1].map(star => {
            const count = revData.dist[star] || 0;
            const pct = revData.reviews.length > 0 ? Math.round((count / revData.reviews.length) * 100) : 0;
            return `
              <div class="store-rating-bar-row">
                <span>${star}★</span>
                <div class="store-rating-bar-track"><div class="store-rating-bar-fill" style="width:${pct}%"></div></div>
                <span class="store-rating-bar-cnt">${count}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="store-menu-tag-chips" style="margin-bottom:14px;">
        <button type="button" class="store-tag-chip ${storeDetailReviewFilter === 'all' ? 'active' : ''}" onclick="switchStoreReviewFilter('all')">
          Tất cả (${revData.reviews.length})
        </button>
        ${[5, 4, 3].map(star => `
          <button type="button" class="store-tag-chip ${String(storeDetailReviewFilter) === String(star) ? 'active' : ''}" onclick="switchStoreReviewFilter('${star}')">
            ${star} Sao (${revData.dist[star] || 0})
          </button>
        `).join('')}
      </div>

      <div class="store-review-list">
        ${filteredReviews.length === 0 ? `
          <div class="fav-section-empty">Chưa có đánh giá nào ở mức ${storeDetailReviewFilter} sao.</div>
        ` : filteredReviews.map(rv => `
          <div class="store-review-card">
            <div class="store-review-top">
              <div class="store-review-author">
                <span class="store-review-avatar">${rv.avatar}</span>
                <div>
                  <div class="store-review-name">${escapeHtml(rv.author)}</div>
                  <div class="store-review-meta">${escapeHtml(rv.date)} • Món: ${escapeHtml(rv.dishName)}</div>
                </div>
              </div>
              <span class="store-review-stars">${FluentIcons.starFilled} ${Number(rv.rating).toFixed(1)}</span>
            </div>
            <p class="store-review-text">${escapeHtml(rv.comment)}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderStoreKeywordSuggestionsSection(store) {
  const keywords = getStoreKeywordSuggestions(store);
  const suggestedStores = getSuggestedOtherStores(store, storeDetailSuggestKeyword);

  return `
    <section class="store-section store-similar-section">
      <div class="store-section-head">
        <div>
          <h2 class="store-section-title">${FluentIcons.shop} Quán khác gợi ý theo từ khóa</h2>
          <p class="store-section-sub">Chọn hoặc nhập từ khóa để khám phá thêm quán tương tự</p>
        </div>
        <div class="scroll-arrow-controls">
          <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('store-similar-scroll', -300)" title="Cuộn sang trái" aria-label="Cuộn sang trái">
            ${FluentIcons.chevronLeft}
          </button>
          <button type="button" class="scroll-arrow-btn small" onclick="scrollHorizontally('store-similar-scroll', 300)" title="Cuộn sang phải" aria-label="Cuộn sang phải">
            ${FluentIcons.chevronRight}
          </button>
        </div>
      </div>

      <div class="store-suggest-kw-controls">
        <div class="store-menu-search-box compact">
          ${FluentIcons.searchRegular}
          <input type="text"
            id="store-suggest-kw-input"
            value="${escapeHtml(storeDetailSuggestKeyword)}"
            placeholder="Nhập từ khóa gợi ý quán khác (VD: Phở, Cơm, Trà sữa...)"
            oninput="handleStoreSuggestKeywordChange(this.value, false)"
          >
        </div>
        <div class="store-menu-tag-chips">
          ${keywords.map(kw => `
            <button type="button"
              class="store-tag-chip ${storeDetailSuggestKeyword.toLowerCase() === kw.toLowerCase() ? 'active' : ''}"
              onclick="handleStoreSuggestKeywordChange('${escapeHtml(kw)}', true)"
            >
              #${escapeHtml(kw)}
            </button>
          `).join('')}
        </div>
      </div>

      <div id="store-similar-list-wrap">
        ${renderStoreSimilarCardsHtml(suggestedStores)}
      </div>
    </section>
  `;
}

function renderStoreSimilarCardsHtml(suggestedStores) {
  if (!suggestedStores || suggestedStores.length === 0) {
    return `<div class="fav-section-empty">Chưa tìm thấy quán khác phù hợp từ khóa "${escapeHtml(storeDetailSuggestKeyword)}". Thử từ khóa khác nhé!</div>`;
  }
  return `
    <div class="store-similar-scroll" id="store-similar-scroll">
      ${suggestedStores.map(r => `
        <article class="store-similar-card" onclick="openStoreDetailView(${r.id}, 'for-you')">
          <div class="store-similar-img-wrap">
            <img class="store-similar-img" data-vt-store="${r.id}" src="${escapeHtml(r.image)}" alt="${escapeHtml(r.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
            <button type="button"
              class="restaurant-card-fav ${r.fav ? 'active' : ''}"
              onclick="event.stopPropagation(); toggleFav(${r.id})"
              title="Lưu quán yêu thích"
              aria-label="Lưu quán yêu thích"
            >
              ${r.fav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
            </button>
          </div>
          <div class="store-similar-body">
            <div class="store-similar-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</div>
            <div class="store-similar-meta">
              <span class="fav-store-rating">${FluentIcons.starFilled} ${r.rating}</span>
              <span class="restaurant-card-dot"></span>
              <span>${escapeHtml(r.distanceText || '0.6 km')}</span>
              <span class="restaurant-card-dot"></span>
              <span>${escapeHtml(r.deliveryTime || '15-20p')}</span>
            </div>
            <div class="store-similar-sub">
              ${r._matchedDishCount ? `Khớp ${r._matchedDishCount} món` : escapeHtml(r.category || 'Quán ngon PTIT')}
            </div>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function switchStoreDetailTab(tab) {
  const normalized = (tab === 'menu' || tab === 'reviews') ? tab : 'for-you';
  if (storeDetailActiveTab === normalized) return;
  storeDetailActiveTab = normalized;

  document.querySelectorAll('.store-nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-store-tab') === normalized);
  });

  const store = findStoreByIdOrName(viewingStoreDetailId);
  const tabBody = document.getElementById('store-detail-tab-body');
  if (store && tabBody) {
    tabBody.innerHTML = renderStoreTabContent(store);
  }

  if (typeof window.Router !== 'undefined' && typeof window.Router.syncUrl === 'function') {
    window.Router.syncUrl({ replace: true });
  }
}

function handleStoreMenuSearchInput(val, shouldSetInput = false) {
  storeDetailMenuQuery = String(val || '');
  if (shouldSetInput) {
    const inp = document.getElementById('store-menu-search-input');
    if (inp) inp.value = storeDetailMenuQuery;
  }
  const store = findStoreByIdOrName(viewingStoreDetailId);
  const wrap = document.getElementById('store-menu-list-wrap');
  if (!store || !wrap) return;

  const dishes = Array.isArray(store.relatedDishes) ? store.relatedDishes : [];
  const qL = storeDetailMenuQuery.trim().toLowerCase();
  const filtered = dishes
    .map((dish, originalIdx) => ({ dish, originalIdx }))
    .filter(({ dish }) => {
      if (storeDetailMenuTag !== 'all') {
        const catMatch = String(dish.category || '').toLowerCase() === storeDetailMenuTag.toLowerCase();
        const tagMatch = Array.isArray(dish.tags) && dish.tags.some(t => String(t).toLowerCase() === storeDetailMenuTag.toLowerCase());
        if (!catMatch && !tagMatch) return false;
      }
      if (qL) {
        const inName = String(dish.name || '').toLowerCase().includes(qL);
        const inDesc = String(dish.description || '').toLowerCase().includes(qL);
        const inTags = Array.isArray(dish.tags) && dish.tags.some(t => String(t).toLowerCase().includes(qL));
        if (!inName && !inDesc && !inTags) return false;
      }
      return true;
    });

  wrap.innerHTML = filtered.length === 0
    ? `<div class="fav-section-empty">Không tìm thấy món nào khớp "${escapeHtml(storeDetailMenuQuery || storeDetailMenuTag)}" trong thực đơn quán.</div>`
    : `<div class="store-dishes-grid">${filtered.map(({ dish, originalIdx }) => renderStoreDishRowCard(dish, store.id, originalIdx)).join('')}</div>`;
}

function switchStoreMenuTag(tag) {
  storeDetailMenuTag = tag || 'all';
  const store = findStoreByIdOrName(viewingStoreDetailId);
  const tabBody = document.getElementById('store-detail-tab-body');
  if (store && tabBody) {
    tabBody.innerHTML = renderStoreTabContent(store);
  }
}

function switchStoreReviewFilter(star) {
  storeDetailReviewFilter = star || 'all';
  const store = findStoreByIdOrName(viewingStoreDetailId);
  const tabBody = document.getElementById('store-detail-tab-body');
  if (store && tabBody) {
    tabBody.innerHTML = renderStoreTabContent(store);
  }
}

function handleStoreSuggestKeywordChange(kw, syncInput = false) {
  storeDetailSuggestKeyword = String(kw || '');
  if (syncInput) {
    const inp = document.getElementById('store-suggest-kw-input');
    if (inp) inp.value = storeDetailSuggestKeyword;
  }

  document.querySelectorAll('.store-similar-section .store-tag-chip').forEach(btn => {
    const chipKw = btn.textContent.replace(/^#/, '').trim().toLowerCase();
    btn.classList.toggle('active', chipKw === storeDetailSuggestKeyword.trim().toLowerCase());
  });

  const store = findStoreByIdOrName(viewingStoreDetailId);
  const wrap = document.getElementById('store-similar-list-wrap');
  if (store && wrap) {
    const suggestedStores = getSuggestedOtherStores(store, storeDetailSuggestKeyword);
    wrap.innerHTML = renderStoreSimilarCardsHtml(suggestedStores);
  }
}

function renderStoreDetailView() {
  const app = (typeof syncAppTargetForView === 'function')
    ? syncAppTargetForView('store-detail')
    : document.getElementById('app');
  if (!app) return;

  const store = findStoreByIdOrName(viewingStoreDetailId);
  if (!store) {
    if (typeof openHomeView === 'function') openHomeView();
    return;
  }

  const cartCount = (typeof cart !== 'undefined' && Array.isArray(cart))
    ? cart.reduce((s, item) => s + (item.quantity || 1), 0)
    : 0;
  const dishesCount = Array.isArray(store.relatedDishes) ? store.relatedDishes.length : 0;

  app.innerHTML = `
    <div class="store-detail-view-container fade-in">
      <div class="page-nav-header">
        <button type="button" class="page-back-icon-btn" onclick="window.goBack()" aria-label="Quay lại">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">${escapeHtml(store.name)}</div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button type="button"
            class="page-back-icon-btn res-detail-top-fav-btn ${store.fav ? 'active' : ''}"
            onclick="toggleFav(${store.id})"
            title="Lưu quán yêu thích"
            aria-label="Lưu quán yêu thích"
          >
            ${store.fav ? FluentIcons.heartFilled : FluentIcons.heartRegular}
          </button>
          <button type="button" class="ai-header-icon-btn cart-pill" onclick="openCartView()" title="Giỏ hàng">
            ${FluentIcons.cartRegular} <span>${cartCount}</span>
          </button>
        </div>
      </div>

      <div class="store-detail-content">
        <!-- Hero thông tin cửa hàng -->
        <div class="store-hero-card">
          <div class="store-hero-main">
            <div class="store-hero-img-wrap">
              <img class="store-hero-img" data-vt-store="${store.id}" src="${escapeHtml(store.image)}" alt="${escapeHtml(store.name)}" decoding="sync" onerror="this.src='assets/images/hung_chien_gion.jpg'">
              ${store.badge ? `<span class="store-hero-badge">${escapeHtml(store.badge)}</span>` : ''}
            </div>
            <div class="store-hero-info">
              <h1 class="store-hero-title">${escapeHtml(store.name)}</h1>
              <p class="store-hero-desc">${escapeHtml(store.shortReview || 'Quán ăn đối tác được sinh viên PTIT yêu thích.')}</p>
              <div class="store-hero-meta-pills">
                <span class="store-meta-pill rating">${FluentIcons.starFilled} <strong>${store.rating || 4.8}</strong> (${escapeHtml(store.reviewCount || '100+')})</span>
                <span class="store-meta-pill">${FluentIcons.locationRegular} ${escapeHtml(store.distanceText || '0.6 km')}</span>
                <span class="store-meta-pill">${FluentIcons.clockRegular} ${escapeHtml(store.deliveryTime || '15 - 20 phút')}</span>
                <span class="store-meta-pill ${store.isFreeship ? 'freeship' : ''}">${FluentIcons.truckRegular} ${store.isFreeship ? 'Freeship' : `Ship ${escapeHtml(store.shippingFee || '15.000đ')}`}</span>
              </div>
              ${store.address ? `
                <div class="store-hero-address">${FluentIcons.locationFilled} ${escapeHtml(store.address)}</div>
              ` : ''}
            </div>
          </div>

          ${Array.isArray(store.vouchers) && store.vouchers.length > 0 ? `
            <div class="store-hero-vouchers">
              ${store.vouchers.map(v => `<span class="voucher-tag-pill">${FluentIcons.tagRegular} ${escapeHtml(v)}</span>`).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Tabs: Dành cho bạn / Thực đơn / Đánh giá chung -->
        <div class="store-tabs-bar" role="tablist" aria-label="Thông tin cửa hàng">
          <button type="button" class="store-nav-tab ${storeDetailActiveTab === 'for-you' ? 'active' : ''}" data-store-tab="for-you" onclick="switchStoreDetailTab('for-you')">
            ${FluentIcons.sparkleFilled} <span>Dành cho bạn</span>
          </button>
          <button type="button" class="store-nav-tab ${storeDetailActiveTab === 'menu' ? 'active' : ''}" data-store-tab="menu" onclick="switchStoreDetailTab('menu')">
            ${FluentIcons.boxFilled} <span>Thực đơn (${dishesCount})</span>
          </button>
          <button type="button" class="store-nav-tab ${storeDetailActiveTab === 'reviews' ? 'active' : ''}" data-store-tab="reviews" onclick="switchStoreDetailTab('reviews')">
            ${FluentIcons.starFilled} <span>Đánh giá chung</span>
          </button>
        </div>

        <!-- Nội dung tab -->
        <div id="store-detail-tab-body">
          ${renderStoreTabContent(store)}
        </div>

        <!-- Gợi ý quán khác theo từ khóa -->
        ${renderStoreKeywordSuggestionsSection(store)}
      </div>

      <div class="bottom-spacer"></div>
    </div>
  `;
}

window.openStoreDetailView = openStoreDetailView;
window.openStoreDetailByName = openStoreDetailByName;
window.renderStoreDetailView = renderStoreDetailView;
window.switchStoreDetailTab = switchStoreDetailTab;
window.backFromStoreDetailView = backFromStoreDetailView;
window.handleStoreMenuSearchInput = handleStoreMenuSearchInput;
window.switchStoreMenuTag = switchStoreMenuTag;
window.switchStoreReviewFilter = switchStoreReviewFilter;
window.handleStoreSuggestKeywordChange = handleStoreSuggestKeywordChange;

