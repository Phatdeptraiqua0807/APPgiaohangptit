/* ==========================================================================
   ptitngon - Personal User Health, Daily Kcal Tracker & Smart Product Advisor
   (js/user-nutrition.js)
   - Khảo sát & Quản lý Hồ sơ Thể trạng Người dùng trong Tab Tài khoản:
     + Phân loại người dùng: Mua sắm bình thường, Tập Gym, Giữ dáng, Giảm cân
     + Câu hỏi muốn giữ dáng hay không, cân nặng hiện tại, chiều cao, vận động
   - Quản lý Dinh dưỡng & Theo dõi lượng Kcal + Macro (Đạm/Tinh bột/Béo) hàng ngày
   - Gợi ý sản phẩm trực quan cá nhân hóa theo thể trạng & quỹ Kcal còn lại
   ========================================================================== */

let nutritionRecFilter = 'best'; // 'best' | 'low_cal' | 'high_protein' | 'keep_fit' | 'meal'
let isNutritionSurveyModalOpen = false;
let showInlineHealthSurvey = false;

const USER_PERSONA_OPTIONS = [
  {
    id: 'normal',
    icon: '🛍️',
    title: 'Người mua sắm bình thường',
    shortLabel: 'Mua sắm bình thường',
    desc: 'Ăn uống cân bằng, đa dạng món ngon, ưu tiên hương vị & tiện lợi hàng ngày',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd'
  },
  {
    id: 'gym',
    icon: '💪',
    title: 'Người tập Gym / Tăng cơ',
    shortLabel: 'Tập Gym • Tăng cơ',
    desc: 'Ưu tiên thực phẩm giàu Protein, nạp năng lượng sạch phục hồi & phát triển cơ bắp',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca'
  },
  {
    id: 'keep_fit',
    icon: '🥗',
    title: 'Muốn giữ dáng / Eat Clean',
    shortLabel: 'Giữ dáng • Eat Clean',
    desc: 'Thanh đạm, nhiều rau xanh & chất xơ, hạn chế dầu mỡ chiên rán và đường tinh luyện',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#6ee7b7'
  },
  {
    id: 'weight_loss',
    icon: '🔥',
    title: 'Giảm cân / Siết mỡ',
    shortLabel: 'Giảm cân • Kiểm soát Kcal',
    desc: 'Thâm hụt Kcal khoa học mỗi ngày, ưu tiên món ít calo nhưng giàu đạm giúp no lâu',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a'
  }
];

const ACTIVITY_LEVEL_OPTIONS = [
  { id: 'sedentary', label: '🪑 Ít vận động (Ngồi học / làm việc nhiều)', factor: 1.25 },
  { id: 'moderate', label: '🚶 Vận động vừa (Đi bộ / Thể thao 2-3 buổi/tuần)', factor: 1.45 },
  { id: 'active', label: '🏋️ Tập luyện tích cực (Gym / Thể thao 4-6 buổi/tuần)', factor: 1.65 }
];

const DIETARY_NOTE_TAGS = [
  'Ít đường',
  'Ít dầu mỡ',
  'Nhiều rau xanh',
  'Giàu Protein',
  'Không cay',
  'Hạn chế tinh bột tối'
];

// =========================================================================
// 1. CÔNG THỨC TÍNH BMI, ĐỊNH MỨC KCAL & MACRO HÀNG NGÀY THEO THỂ TRẠNG
// =========================================================================

function getTodayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPersonaMeta(personaId) {
  return USER_PERSONA_OPTIONS.find(p => p.id === personaId) || USER_PERSONA_OPTIONS[0];
}

function pickVariedHealthComment(pool, seedNum = 0) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  const hourBucket = Math.floor(new Date().getHours() / 4); // Đổi nhẹ theo khung giờ trong ngày
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const idx = Math.abs(Math.round(seedNum) + hourBucket + dayOfYear) % pool.length;
  return pool[idx];
}

function computeBMIInfo(weightKg, heightCm, hpContext = {}) {
  const w = Math.max(30, Number(weightKg) || 60);
  const hMeter = Math.max(1.2, (Number(heightCm) || 168) / 100);
  const bmi = Number((w / (hMeter * hMeter)).toFixed(1));
  const persona = hpContext.personaType || 'normal';
  const act = hpContext.activityLevel || 'moderate';
  const seed = Math.round(bmi * 10 + w + (Number(heightCm) || 168));

  if (bmi < 18.5) {
    const lowPool = [
      'Nên ăn đủ 3 bữa chính và bổ sung thêm đạm nạc + tinh bột hấp thu chậm.',
      'Cơ thể cần thêm năng lượng tích cực — hãy ưu tiên phở bò, cơm tấm sườn hoặc sinh tố bơ hạt nhé!',
      'Hãy chia nhỏ bữa ăn trong ngày, kết hợp thêm bữa phụ giàu Protein để tăng cân khỏe mạnh.',
      'Đừng bỏ bữa sáng nhé! Bổ sung thêm trứng, sữa và thịt nạc sẽ giúp thể lực cải thiện rõ rệt.'
    ];
    return {
      bmi,
      status: 'Hơi thiếu cân',
      color: '#0284c7',
      advice: pickVariedHealthComment(lowPool, seed),
      advicePool: lowPool
    };
  }

  if (bmi < 23) {
    let idealPool = [];
    if (persona === 'gym') {
      idealPool = [
        'Tỷ lệ cơ thể rất chuẩn để phát triển cơ bắp! Hãy ưu tiên nạp đủ 2g Protein/kg mỗi ngày.',
        'Phong độ thể hình tuyệt vời! Đừng quên bổ sung đạm và tinh bột tốt trong vòng 1 giờ sau tập nhé.',
        'Chỉ số BMI vàng cho Gymer! Kết hợp thịt nạc, ức gà, trứng cùng giấc ngủ sâu để phục hồi cơ tối ưu.',
        'Nền tảng thể lực rất săn chắc! Hãy duy trì chia đều lượng đạm qua các bữa ăn trong ngày.'
      ];
    } else if (persona === 'keep_fit' || hpContext.wantKeepFit) {
      idealPool = [
        'Vóc dáng đang ở ngưỡng vàng! Ưu tiên thực đơn Eat Clean, gỏi cuốn, bún tươi và rau xanh để giữ form.',
        'Chỉ số cơ thể rất cân đối! Hãy duy trì thói quen uống đủ nước và hạn chế trà sữa nhiều đường.',
        'Form người rất gọn gàng chuẩn chỉnh! Chia tỷ lệ 50% rau xanh - 25% đạm - 25% tinh bột mỗi bữa là đẹp nhất.',
        'Thể trạng săn chắc đáng mơ ước! Hãy ưu tiên các món hấp, luộc, áp chảo ít dầu mỡ cho bữa tối nhé.'
      ];
    } else if (act === 'active') {
      idealPool = [
        'Thể lực và vóc dáng rất năng động! Hãy bù đủ điện giải, nước lọc và đạm chất lượng sau khi vận động.',
        'Cơ thể cân đối, trao đổi chất tốt! Bạn có thể thoải mái thưởng thức các bữa chính giàu năng lượng.',
        'Chỉ số BMI lý tưởng cho người hay vận động! Chú ý nạp đủ tinh bột tốt để luôn tràn đầy sức bền.'
      ];
    } else {
      idealPool = [
        'Vóc dáng cân đối chuẩn chỉnh! Hãy kết hợp đa dạng đạm nạc, rau củ tươi và uống đủ nước mỗi ngày.',
        'Chỉ số BMI rất đẹp! Duy trì nhịp sinh hoạt điều độ và ăn tối trước 20h00 sẽ giúp cơ thể luôn nhẹ nhàng.',
        'Thể trạng đang ở vùng khỏe mạnh nhất! Ưu tiên món ăn tươi nóng, cân bằng giữa thịt, cá và rau xanh nhé.',
        'Cơ thể rất hài hòa! Một bữa trưa đủ chất và bữa tối thanh đạm sẽ giúp bạn giữ vững phong độ học tập & làm việc.',
        'Tỷ lệ chiều cao - cân nặng rất chuẩn! Hãy lắng nghe cơ thể, ăn vừa đủ no (khoảng 80%) để hệ tiêu hóa luôn khỏe.',
        'Sức khỏe nền tảng rất tốt! Đừng quên nhấp từng ngụm nước lọc trong ngày và tăng cường trái cây tươi nhé.'
      ];
    }
    const subStatus = bmi < 20 ? 'Thể trạng thon gọn chuẩn' : (bmi <= 21.8 ? 'Vóc dáng cân đối chuẩn' : 'Thể hình săn chắc cân đối');
    return {
      bmi,
      status: subStatus,
      color: '#059669',
      advice: pickVariedHealthComment(idealPool, seed),
      advicePool: idealPool
    };
  }

  if (bmi < 25) {
    const warmPool = [
      'Ưu tiên các món thanh đạm nhiều rau xanh, giảm nhẹ đồ chiên rán và nước ngọt có gas nhé.',
      'Chỉ cần giảm khoảng 200–300 kcal mỗi ngày và đi bộ nhẹ 20 phút sau bữa tối là vóc dáng sẽ cực kỳ gọn gàng!',
      'Hãy bắt đầu bữa ăn bằng rau củ hoặc canh trước khi ăn tinh bột để no lâu và kiểm soát đường huyết tốt hơn.',
      'Thay thế đồ ăn vặt chiều bằng trái cây ít ngọt hoặc sữa chua không đường sẽ giúp bạn nhẹ bụng hơn rất nhiều.'
    ];
    return {
      bmi,
      status: 'Hơi đầy đặn',
      color: '#d97706',
      advice: pickVariedHealthComment(warmPool, seed),
      advicePool: warmPool
    };
  }

  const highPool = [
    'Khuyến nghị kiểm soát quỹ Kcal hàng ngày, tăng cường đạm nạc (ức gà, cá, đậu hũ) và rau xanh giàu chất xơ.',
    'Hãy ưu tiên phương pháp chế biến luộc, hấp, trộn salad và hạn chế ăn khuya sau 20h30 để giảm mỡ bền vững.',
    'Chia rõ khẩu phần từng bữa: tăng gấp đôi lượng rau củ và uống 1 cốc nước lọc trước bữa ăn 15 phút nhé!',
    'Kết hợp thâm hụt Kcal vừa phải (300–400 kcal/ngày) cùng vận động đều đặn sẽ giúp cơ thể săn chắc khỏe khoắn.'
  ];
  return {
    bmi,
    status: 'Cần kiểm soát cân nặng',
    color: '#dc2626',
    advice: pickVariedHealthComment(highPool, seed),
    advicePool: highPool
  };
}

function getDynamicNutritionRingAdvice(summary) {
  if (!summary || !summary.healthProfile) return 'Hãy duy trì chế độ dinh dưỡng cân bằng và uống đủ nước hôm nay.';
  const hp = summary.healthProfile;
  const consumedCal = Number(summary.consumed?.calories) || 0;
  const goalCal = Math.max(1000, Number(hp.dailyCalorieGoal) || 2000);
  const calRatio = consumedCal / goalCal;
  const consumedProt = Number(summary.consumed?.protein) || 0;
  const goalProt = Math.max(30, Number(hp.macroGoals?.protein) || 75);
  const protRatio = consumedProt / goalProt;
  const waterCups = Number(summary.waterCups) || 0;
  const waterGoal = Math.max(6, Number(hp.recommendedWaterCups) || 8);
  const entriesCount = Array.isArray(summary.entries) ? summary.entries.length : 0;
  const hour = new Date().getHours();
  const seed = Math.round(consumedCal + consumedProt * 3 + waterCups * 7 + entriesCount * 13 + hp.weightKg);

  if (summary.isOverCalories) {
    const overCal = Math.abs(summary.remainingCalories);
    const overPool = [
      `Hôm nay bạn đã nạp nhỉnh hơn mục tiêu ${overCal} kcal — hãy đi bộ nhẹ 20 phút và uống thêm nước ấm để tiêu hóa tốt nhé!`,
      `Vượt nhẹ ${overCal} kcal không sao cả! Bữa tiếp theo hãy ưu tiên rau luộc, canh thanh đạm và hạn chế đồ ngọt nhé.`,
      `Năng lượng hôm nay khá dồi dào (+${overCal} kcal). Bạn có thể tập giãn cơ hoặc vận động nhẹ buổi tối để cân bằng lại!`
    ];
    return pickVariedHealthComment(overPool, seed);
  }

  if (entriesCount === 0 || consumedCal === 0) {
    if (hour < 10) {
      const morningPool = [
        `Chào buổi sáng! BMI ${hp.bmiInfo.bmi} (${hp.bmiInfo.status.toLowerCase()}) — hãy khởi động ngày mới với 1 cốc nước ấm và bữa sáng giàu đạm nhé.`,
        `${hp.bmiInfo.advice} Quỹ năng lượng hôm nay của bạn là ${goalCal} kcal.`,
        `Một bữa sáng ấm nóng (phở, bún hoặc bánh mì trứng) sẽ giúp bạn tập trung học tập & làm việc suốt buổi sáng!`
      ];
      return pickVariedHealthComment(morningPool, seed);
    }
    if (hour < 14) {
      const lunchPool = [
        `Đến giờ nạp năng lượng bữa trưa rồi! Bạn đang có trọn vẹn ${goalCal} kcal — hãy chọn món đủ đạm và rau xanh nhé.`,
        `${hp.bmiInfo.advice} Đừng quên ghi nhận bữa trưa để theo dõi đa lượng trong ngày!`,
        `Chỉ số BMI ${hp.bmiInfo.bmi} rất ổn định! Hãy ưu tiên bữa trưa cân bằng để chiều làm việc không bị buồn ngủ nhé.`
      ];
      return pickVariedHealthComment(lunchPool, seed);
    }
    return hp.bmiInfo.advice;
  }

  if (calRatio < 0.45) {
    const earlyProgressPool = [
      `Khởi đầu rất tốt (${consumedCal}/${goalCal} kcal)! Bạn còn ${summary.remainingCalories} kcal cho các bữa tiếp theo trong ngày.`,
      `Nhịp ăn hôm nay rất hợp lý! Đã nạp ${consumedProt}g Đạm — hãy tiếp tục duy trì thực đơn cân bằng và tươi sạch nhé.`,
      waterCups < Math.floor(waterGoal / 2)
        ? `Bạn đã nạp ${consumedCal} kcal gọn nhẹ. Nhớ uống thêm nước lọc (${waterCups}/${waterGoal} cốc) để trao đổi chất hiệu quả hơn!`
        : `${hp.bmiInfo.advice} Hiện bạn đã hoàn thành ${Math.round(calRatio * 100)}% định mức Kcal hôm nay.`
    ];
    return pickVariedHealthComment(earlyProgressPool, seed);
  }

  if (calRatio <= 0.85) {
    const midProgressPool = [
      protRatio >= 0.7
        ? `Tuyệt vời! Lượng Đạm đã đạt ${consumedProt}g/${goalProt}g (${Math.round(protRatio * 100)}%), rất lý tưởng để nuôi dưỡng cơ bắp săn chắc.`
        : `Bạn đã đi được ${Math.round(calRatio * 100)}% quỹ Kcal hôm nay. Bữa tới hãy ưu tiên món giàu Đạm nạc (còn thiếu ~${Math.max(0, goalProt - consumedProt)}g Đạm) nhé!`,
      `Còn lại ${summary.remainingCalories} kcal cho hôm nay — vừa vặn cho một bữa ăn thanh đạm, nhiều rau xanh và ít dầu mỡ!`,
      `Cơ thể đang hấp thu năng lượng rất cân đối (${consumedCal} kcal). Kết hợp uống đủ ${waterGoal} cốc nước để giữ vóc dáng chuẩn nhé!`
    ];
    return pickVariedHealthComment(midProgressPool, seed);
  }

  const nearGoalPool = [
    `Quỹ năng lượng hôm nay gần chạm đích hoàn hảo (còn ${summary.remainingCalories} kcal)! Nếu đói nhẹ, hãy dùng trái cây ít ngọt hoặc sữa chua nhé.`,
    `Bạn đã hoàn thành ${Math.round(calRatio * 100)}% mục tiêu Kcal hôm nay rất kỷ luật! Hãy nghỉ ngơi điều độ và hạn chế ăn khuya nhé.`,
    `Dinh dưỡng hôm nay rất trọn vẹn (${consumedCal}/${goalCal} kcal • ${consumedProt}g Đạm). Uống thêm 1 cốc nước ấm sẽ giúp tiêu hóa êm ái hơn!`
  ];
  return pickVariedHealthComment(nearGoalPool, seed);
}

let isTodayMealLogsExpanded = false;

function toggleTodayMealLogsExpanded() {
  isTodayMealLogsExpanded = !isTodayMealLogsExpanded;
  const box = document.querySelector('.un-meal-logs-box');
  if (box && typeof getNormalizedUserHealthProfile === 'function' && typeof getTodayDateKey === 'function') {
    const user = (typeof DB !== 'undefined' && DB.isReady) ? DB.getCurrentUser() : null;
    if (user) {
      const hp = getNormalizedUserHealthProfile(user);
      const summary = getTodayNutritionSummary(user, hp, getTodayDateKey());
      box.innerHTML = renderTodayMealLogsBoxInnerHtml(summary);
      return;
    }
  }
  updateProfileNutritionDashboardInPlace();
}

function renderTodayMealLogsBoxInnerHtml(summary) {
  const entries = Array.isArray(summary?.entries) ? summary.entries : [];
  const sortedEntries = [...entries].sort((a, b) => (Number(b.calories) || 0) - (Number(a.calories) || 0));
  const totalCount = sortedEntries.length;
  const initialLimit = 3;
  const hasOverflow = totalCount > initialLimit;
  const visibleEntries = (hasOverflow && !isTodayMealLogsExpanded)
    ? sortedEntries.slice(0, initialLimit)
    : sortedEntries;
  const hiddenCount = Math.max(0, totalCount - initialLimit);

  const renderLogRow = (en) => {
    const cleanOrderId = en.orderId ? String(en.orderId).replace(/^#/, '') : '';
    const hasDishLink = Boolean(en.dishId);
    return `
      <div class="un-meal-log-row">
        <div class="un-meal-log-top">
          <div class="un-meal-meta-left">
            <span class="un-meal-tag">${escapeHtml(en.mealType || 'Bữa ăn')}${en.time ? ` • ${escapeHtml(en.time)}` : ''}</span>
            ${cleanOrderId ? `<span class="un-order-ref" title="Ghi nhận từ đơn hàng #${escapeHtml(cleanOrderId)}">#${escapeHtml(cleanOrderId)}</span>` : ''}
          </div>
          <div class="un-meal-meta-right">
            <button
              type="button"
              class="un-remove-log-btn"
              onclick="removeTodayMealEntry('${escapeHtml(en.id)}')"
              title="Xóa khỏi nhật ký hôm nay"
              aria-label="Xóa mục nhật ký"
            >✕</button>
          </div>
        </div>

        <div class="un-meal-name-row">
          <div
            class="un-meal-name ${hasDishLink ? 'is-clickable' : ''}"
            ${hasDishLink ? `role="button" tabindex="0" onclick="openDishDetailById('${escapeHtml(String(en.dishId))}')" title="Chạm để xem chi tiết dinh dưỡng mặt hàng"` : ''}
          >
            ${en.quantity > 1 ? `<span class="un-meal-qty-badge">${en.quantity}x</span>` : ''}
            <span class="un-meal-dish-title" title="${escapeHtml(en.dishName)}">${escapeHtml(en.dishName)}</span>
            <span class="un-meal-kcal-badge">${FluentIcons.fireFilled} ${en.calories} kcal</span>
          </div>
        </div>

        <div class="un-meal-macros-grid">
          <div class="un-macro-pill prot">
            <span class="un-mp-lbl">🥩 Đạm</span>
            <strong>${en.protein}g</strong>
          </div>
          <div class="un-macro-pill carb">
            <span class="un-mp-lbl">🌾 Tinh bột</span>
            <strong>${en.carbs}g</strong>
          </div>
          <div class="un-macro-pill fat">
            <span class="un-mp-lbl">🥑 Chất béo</span>
            <strong>${en.fat}g</strong>
          </div>
        </div>
      </div>
    `;
  };

  const expandBtnHtml = hasOverflow ? `
    <button
      type="button"
      class="un-meal-expand-btn ${isTodayMealLogsExpanded ? 'is-expanded' : ''}"
      onclick="toggleTodayMealLogsExpanded()"
      aria-expanded="${isTodayMealLogsExpanded ? 'true' : 'false'}"
      aria-controls="un-meal-log-list-container"
    >
      <span class="un-expand-icon">${FluentIcons.chevronDown}</span>
      <span>${isTodayMealLogsExpanded ? 'Thu gọn danh sách' : `Mở rộng xem thêm ${hiddenCount} món khác`}</span>
      <span class="un-expand-count-pill">${isTodayMealLogsExpanded ? 'Đang hiện tất cả' : `+${hiddenCount}`}</span>
    </button>
  ` : '';

  return `
    <div class="un-meal-logs-head">
      <div class="un-meal-logs-title-wrap">
        <span class="un-meal-logs-title">🍽️ Nhật ký món đã tiêu thụ hôm nay</span>
        <span class="un-meal-count-badge">${totalCount} mục</span>
      </div>
    </div>

    ${totalCount === 0 ? `
      <div class="un-empty-log">
        Hôm nay bạn chưa ghi nhận bữa ăn nào. Khi bạn đặt đơn hàng hoặc bấm <strong>"🍽️ Đã ăn"</strong> ở danh sách gợi ý bên dưới, lượng Kcal sẽ tự động cập nhật tại đây!
      </div>
    ` : `
      <div class="un-meal-log-list" id="un-meal-log-list-container">
        ${visibleEntries.map(renderLogRow).join('')}
        ${hasOverflow && !isTodayMealLogsExpanded ? expandBtnHtml : ''}
      </div>

      ${hasOverflow && isTodayMealLogsExpanded ? `
        <div class="un-meal-expand-wrap">
          ${expandBtnHtml}
        </div>
      ` : ''}
    `}
  `;
}

function computePersonalNutritionTargets(hp) {
  const weight = Math.max(32, Math.min(180, Number(hp.weightKg) || 62));
  const height = Math.max(130, Math.min(220, Number(hp.heightCm) || 170));
  const age = Math.max(14, Math.min(90, Number(hp.age) || 20));
  const gender = hp.gender === 'female' ? 'female' : 'male';
  const persona = hp.personaType || 'normal';
  const wantKeepFit = Boolean(hp.wantKeepFit || persona === 'keep_fit' || persona === 'weight_loss');

  // Công thức Mifflin-St Jeor chuẩn y khoa dinh dưỡng
  const bmr = gender === 'female'
    ? (10 * weight + 6.25 * height - 5 * age - 161)
    : (10 * weight + 6.25 * height - 5 * age + 5);

  const actObj = ACTIVITY_LEVEL_OPTIONS.find(a => a.id === hp.activityLevel) || ACTIVITY_LEVEL_OPTIONS[1];
  let tdee = Math.round(bmr * actObj.factor);

  let recommendedCalories = tdee;
  if (persona === 'gym') {
    recommendedCalories = wantKeepFit ? tdee + 100 : tdee + 260;
  } else if (persona === 'weight_loss') {
    recommendedCalories = Math.max(1250, tdee - 380);
  } else if (persona === 'keep_fit' || wantKeepFit) {
    recommendedCalories = Math.max(1350, tdee - 160);
  }

  // Làm tròn đẹp đến bội số 10 kcal
  recommendedCalories = Math.round(recommendedCalories / 10) * 10;

  const finalCalorieGoal = (hp.customCalorieGoal && Number(hp.dailyCalorieGoal) >= 1000)
    ? Math.round(Number(hp.dailyCalorieGoal))
    : recommendedCalories;

  // Phân bổ Macro (Protein / Carbs / Fat) theo nhóm người dùng & cân nặng
  let proteinGrams;
  let fatRatio;
  if (persona === 'gym') {
    proteinGrams = Math.round(weight * 2.0); // 2.0g Protein / kg thể trọng
    fatRatio = 0.25;
  } else if (persona === 'weight_loss') {
    proteinGrams = Math.round(weight * 1.75);
    fatRatio = 0.25;
  } else if (persona === 'keep_fit' || wantKeepFit) {
    proteinGrams = Math.round(weight * 1.55);
    fatRatio = 0.26;
  } else {
    proteinGrams = Math.round(weight * 1.25);
    fatRatio = 0.28;
  }

  const fatGrams = Math.max(35, Math.round((finalCalorieGoal * fatRatio) / 9));
  const remainingCalForCarbs = Math.max(320, finalCalorieGoal - (proteinGrams * 4) - (fatGrams * 9));
  const carbsGrams = Math.round(remainingCalForCarbs / 4);
  const recommendedWaterCups = Math.max(6, Math.min(14, Math.round((weight * 35) / 250)));

  return {
    bmr: Math.round(bmr),
    tdee,
    recommendedCalories,
    dailyCalorieGoal: finalCalorieGoal,
    macroGoals: {
      protein: proteinGrams,
      carbs: carbsGrams,
      fat: fatGrams
    },
    recommendedWaterCups,
    bmiInfo: computeBMIInfo(weight, height, { personaType: persona, activityLevel: hp.activityLevel || 'moderate', wantKeepFit })
  };
}

function getNormalizedUserHealthProfile(user) {
  const u = user || (typeof DB !== 'undefined' && DB.isReady ? DB.getCurrentUser() : null);
  const raw = (u && u.healthProfile) ? u.healthProfile : {};
  const computed = computePersonalNutritionTargets(raw);

  return {
    personaType: raw.personaType || 'normal',
    wantKeepFit: Boolean(raw.wantKeepFit || raw.personaType === 'keep_fit' || raw.personaType === 'weight_loss'),
    gender: raw.gender || 'male',
    age: Number(raw.age) || 20,
    heightCm: Number(raw.heightCm) || 170,
    weightKg: Number(raw.weightKg) || 62,
    targetWeightKg: Number(raw.targetWeightKg) || Number(raw.weightKg) || 60,
    activityLevel: raw.activityLevel || 'moderate',
    customCalorieGoal: Boolean(raw.customCalorieGoal),
    dailyCalorieGoal: computed.dailyCalorieGoal,
    recommendedCalories: computed.recommendedCalories,
    tdee: computed.tdee,
    macroGoals: computed.macroGoals,
    recommendedWaterCups: computed.recommendedWaterCups,
    bmiInfo: computed.bmiInfo,
    dietaryNotes: Array.isArray(raw.dietaryNotes) ? raw.dietaryNotes : [],
    isConfigured: Boolean(raw.isConfigured)
  };
}

// =========================================================================
// 2. TÍNH TOÁN LƯỢNG KCAL ĐÃ TIÊU THỤ HÔM NAY & TỰ ĐỘNG GHI NHẬN TỪ ĐƠN ĐẶT
// =========================================================================

function estimateCartOrOrderItemNutrition(item) {
  const dishName = item.dishName || item.name || 'Món ăn';
  const qty = Math.max(1, Number(item.quantity || item.qty) || 1);

  let matchedDish = null;
  if (typeof DB !== 'undefined' && DB.isReady) {
    matchedDish = DB.getItems().find(it =>
      (item.dishId && it.id === item.dishId) ||
      it.name.toLowerCase() === dishName.toLowerCase()
    );
  }

  let cal = 480;
  let prot = 22;
  let carb = 56;
  let fat = 14;

  if (matchedDish && typeof getDishNutritionAndSafetyProfile === 'function') {
    const store = (typeof restaurants !== 'undefined')
      ? restaurants.find(r => Number(r.id) === Number(matchedDish.restaurantId))
      : null;
    const prof = getDishNutritionAndSafetyProfile(matchedDish, store);
    cal = prof.calories;
    prot = prof.protein;
    carb = prof.carbs;
    fat = prof.fat;
  }

  // Cộng thêm theo cỡ và topping nếu có
  const extraSizePrice = Number(item.size?.extraPrice) || 0;
  if (extraSizePrice > 0) {
    cal += Math.round(extraSizePrice / 120);
    prot += Math.round(extraSizePrice / 2500);
    carb += Math.round(extraSizePrice / 1500);
  }
  if (Array.isArray(item.toppings)) {
    item.toppings.forEach(t => {
      const tp = Number(t.price) || 10000;
      cal += Math.round(tp / 140);
      prot += Math.max(2, Math.round(tp / 3500));
      fat += Math.max(1, Math.round(tp / 4500));
    });
  }

  return {
    dishId: matchedDish ? matchedDish.id : (item.dishId || ''),
    dishName,
    quantity: qty,
    calories: cal * qty,
    protein: prot * qty,
    carbs: carb * qty,
    fat: fat * qty
  };
}

// Tự động được gọi từ DB.recordOrderForCurrentUser khi người dùng đặt đơn thành công
window.autoLogOrderNutritionForUser = function (user, newOrder) {
  if (!user || !newOrder || !Array.isArray(newOrder.items)) return;
  const dateKey = getTodayDateKey();
  if (!user.dailyNutritionLogs) user.dailyNutritionLogs = {};
  if (!user.dailyNutritionLogs[dateKey]) {
    user.dailyNutritionLogs[dateKey] = { waterCups: 0, entries: [] };
  }

  const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const hour = new Date().getHours();
  const mealType = hour < 10 ? 'Bữa sáng' : hour < 14 ? 'Bữa trưa' : hour < 18 ? 'Bữa xế' : 'Bữa tối';

  newOrder.items.forEach(item => {
    const est = estimateCartOrOrderItemNutrition(item);
    user.dailyNutritionLogs[dateKey].entries.unshift({
      id: 'nutri_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      time: nowTime,
      mealType,
      dishId: est.dishId,
      dishName: est.dishName,
      quantity: est.quantity,
      calories: est.calories,
      protein: est.protein,
      carbs: est.carbs,
      fat: est.fat,
      orderId: newOrder.orderId,
      source: 'order'
    });
  });
};

function getTodayNutritionSummary(user) {
  const u = user || (typeof DB !== 'undefined' && DB.isReady ? DB.getCurrentUser() : null);
  const hp = getNormalizedUserHealthProfile(u);
  const dateKey = getTodayDateKey();
  const dayLog = (u && u.dailyNutritionLogs && u.dailyNutritionLogs[dateKey])
    ? u.dailyNutritionLogs[dateKey]
    : { waterCups: 0, entries: [] };

  const entries = Array.isArray(dayLog.entries) ? dayLog.entries : [];
  const consumed = entries.reduce((acc, e) => {
    acc.calories += Number(e.calories) || 0;
    acc.protein += Number(e.protein) || 0;
    acc.carbs += Number(e.carbs) || 0;
    acc.fat += Number(e.fat) || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Tính thêm lượng Kcal đang nằm chờ trong Giỏ hàng
  const activeCart = (typeof cart !== 'undefined' && Array.isArray(cart)) ? cart : [];
  const cartPending = activeCart.reduce((acc, c) => {
    const est = estimateCartOrOrderItemNutrition(c);
    acc.calories += est.calories;
    acc.protein += est.protein;
    return acc;
  }, { calories: 0, protein: 0 });

  const remainingCalories = hp.dailyCalorieGoal - consumed.calories;
  const pctCalories = Math.min(100, Math.round((consumed.calories / Math.max(1, hp.dailyCalorieGoal)) * 100));

  return {
    dateKey,
    hp,
    entries,
    waterCups: Number(dayLog.waterCups) || 0,
    consumed,
    cartPending,
    remainingCalories,
    isOverCalories: remainingCalories < 0,
    pctCalories
  };
}

// =========================================================================
// 3. THUẬT TOÁN GỢI Ý SẢN PHẨM CÁ NHÂN HÓA THEO HỒ SƠ & QUỸ KCAL HÀNG NGÀY
// =========================================================================

function getPersonalizedDishRecommendations(user, filterMode = 'best', limit = 8) {
  if (typeof DB === 'undefined' || !DB.isReady || typeof getDishNutritionAndSafetyProfile !== 'function') {
    return [];
  }

  const summary = getTodayNutritionSummary(user);
  const hp = summary.hp;
  const remainingCal = summary.remainingCalories;
  // Ngân sách hợp lý cho 1 bữa tiếp theo (tối thiểu 320 kcal để vẫn gợi ý món nhẹ nếu đã gần đủ Kcal)
  const mealBudgetCal = remainingCal > 350 ? Math.min(remainingCal, Math.round(hp.dailyCalorieGoal * 0.45)) : 380;

  const allItems = DB.getItems().filter(it => it.inStock !== false);

  const scored = allItems.map(item => {
    const store = (typeof restaurants !== 'undefined')
      ? restaurants.find(r => Number(r.id) === Number(item.restaurantId))
      : null;
    const prof = getDishNutritionAndSafetyProfile(item, store);

    let score = 50;
    const reasons = [];

    // 1. Chấm điểm theo Nhóm người dùng (Persona) & Mục tiêu Giữ dáng
    if (hp.personaType === 'gym') {
      score += prof.protein * 2.1;
      if (prof.protein >= 26) {
        score += 18;
        reasons.push(`Giàu đạm (${prof.protein}g Protein) nuôi cơ`);
      }
      if (prof.healthyScore >= 8.0) score += 10;
      if (prof.sugar > 20) score -= 18;
    } else if (hp.personaType === 'weight_loss') {
      score += prof.healthyScore * 6;
      if (prof.calories <= 450) {
        score += 24;
        reasons.push(`Ít năng lượng (~${prof.calories} kcal) hỗ trợ giảm cân`);
      } else if (prof.calories > 580) {
        score -= 28;
      }
      if (prof.fat <= 14) score += 14;
      score += prof.fiber * 3;
    } else if (hp.personaType === 'keep_fit' || hp.wantKeepFit) {
      score += prof.healthyScore * 6.5;
      score += prof.fiber * 3.5;
      if (prof.healthyScore >= 8.5) {
        score += 20;
        reasons.push(`Chuẩn giữ dáng (${prof.healthyScore}/10 Healthy)`);
      }
      if (prof.fat > 20 || prof.sugar > 22) score -= 22;
    } else {
      // Người mua sắm bình thường: cân bằng độ ngon (rating), Healthy & vừa túi tiền
      score += (prof.ratingVal || 4.8) * 8;
      score += prof.healthyScore * 3.2;
      if (item.price <= 45000) score += 8;
      reasons.push(`Cân bằng dinh dưỡng (${prof.calories} kcal • ⭐ ${prof.ratingVal})`);
    }

    // 2. Chấm điểm theo Quỹ Kcal còn lại trong ngày của người dùng
    if (prof.calories <= mealBudgetCal) {
      score += 16;
      if (remainingCal > 0) {
        const sharePct = Math.max(5, Math.round((prof.calories / remainingCal) * 100));
        if (reasons.length === 0 || sharePct <= 60) {
          reasons.push(`Vừa vặn ${sharePct}% quỹ Kcal còn lại hôm nay`);
        }
      }
    } else if (remainingCal < 450 && prof.calories > 450) {
      score -= 25;
    }

    // 3. Chấm điểm theo Ghi chú ăn uống cá nhân (dietaryNotes)
    if (hp.dietaryNotes.includes('Ít đường') && prof.sugar <= 8) score += 10;
    if (hp.dietaryNotes.includes('Ít dầu mỡ') && prof.fat <= 12) score += 12;
    if (hp.dietaryNotes.includes('Nhiều rau xanh') && prof.fiber >= 4.0) score += 12;
    if (hp.dietaryNotes.includes('Giàu Protein') && prof.protein >= 25) score += 14;

    const isDrinkOrDessert = ['Trà sữa', 'Cà phê', 'Chè'].includes(item.category);

    return {
      item,
      store,
      prof,
      score,
      isDrinkOrDessert,
      reasonText: reasons.slice(0, 2).join(' • ') || `Cung cấp ~${prof.calories} kcal & ${prof.protein}g Protein`
    };
  });

  // Lọc theo tab con người dùng đang chọn
  let filtered = scored;
  if (filterMode === 'low_cal') {
    filtered = scored.filter(x => x.prof.calories <= 420);
  } else if (filterMode === 'high_protein') {
    filtered = scored.filter(x => x.prof.protein >= 24);
  } else if (filterMode === 'keep_fit') {
    filtered = scored.filter(x => x.prof.healthyScore >= 8.3 && x.prof.fat <= 16);
  } else if (filterMode === 'meal') {
    filtered = scored.filter(x => !x.isDrinkOrDessert && x.prof.protein >= 18);
  }

  // Đa dạng hóa danh mục để danh sách gợi ý phong phú, hấp dẫn
  filtered.sort((a, b) => b.score - a.score);
  const picked = [];
  const catCount = {};
  for (const entry of filtered) {
    if (picked.length >= limit) break;
    const cat = entry.item.category || 'Khác';
    if ((catCount[cat] || 0) < 2) {
      catCount[cat] = (catCount[cat] || 0) + 1;
      picked.push(entry);
    }
  }
  if (picked.length < limit) {
    for (const entry of filtered) {
      if (picked.length >= limit) break;
      if (!picked.includes(entry)) picked.push(entry);
    }
  }

  return picked;
}

// =========================================================================
// 4. GIAO DIỆN QUẢN LÝ NGƯỜI DÙNG, DINH DƯỠNG & KCAL TRONG TAB TÀI KHOẢN
// =========================================================================

function renderProfileHealthSummaryStrip(activeUser) {
  const summary = getTodayNutritionSummary(activeUser);
  const hp = summary.hp;
  const persona = getPersonaMeta(hp.personaType);

  return `
    <div class="profile-health-strip" style="border-color: ${persona.border}; background: ${persona.bg};">
      <div class="phs-left">
        <span class="phs-icon">${persona.icon}</span>
        <div>
          <div class="phs-title-row">
            <strong style="color: ${persona.color};">${escapeHtml(persona.title)}</strong>
            ${hp.wantKeepFit ? `<span class="phs-fit-pill">${FluentIcons.sparkleFilled} Ưu tiên Giữ dáng</span>` : ''}
          </div>
          <div class="phs-metrics">
            ⚖️ Cân nặng: <strong>${hp.weightKg} kg</strong> (BMI ${hp.bmiInfo.bmi}) •
            ${FluentIcons.fireFilled} Hôm nay: <strong>${summary.consumed.calories} / ${hp.dailyCalorieGoal} kcal</strong>
          </div>
        </div>
      </div>
      <button type="button" class="phs-edit-btn" onclick="openUserNutritionSurveyModal('${escapeHtml(activeUser.id)}')">
        ${FluentIcons.targetFilled} Cá nhân hoá mục tiêu sức khoẻ
      </button>
    </div>
  `;
}

function renderProfileNutritionManagerTab(activeUser) {
  const summary = getTodayNutritionSummary(activeUser);
  const hp = summary.hp;
  const persona = getPersonaMeta(hp.personaType);
  const recs = getPersonalizedDishRecommendations(activeUser, nutritionRecFilter, 6);

  const ringRadius = 52;
  const circumference = 2 * Math.PI * ringRadius;
  const ringRatio = Math.min(1, summary.consumed.calories / Math.max(1, hp.dailyCalorieGoal));
  const strokeDashoffset = Math.round(circumference * (1 - ringRatio));
  const ringColor = summary.isOverCalories ? '#dc2626' : (ringRatio > 0.85 ? '#d97706' : '#059669');

  const protPct = Math.min(100, Math.round((summary.consumed.protein / Math.max(1, hp.macroGoals.protein)) * 100));
  const carbPct = Math.min(100, Math.round((summary.consumed.carbs / Math.max(1, hp.macroGoals.carbs)) * 100));
  const fatPct = Math.min(100, Math.round((summary.consumed.fat / Math.max(1, hp.macroGoals.fat)) * 100));

  return `
    <div class="un-dashboard-wrap">
      <!-- BẢNG QUẢN LÝ LƯỢNG KCAL & DINH DƯỠNG TIÊU THỤ HÀNG NGÀY -->
      <div class="un-card un-tracker-card">
        <div class="un-card-head">
          <div>
            <div class="un-card-title">${FluentIcons.fireFilled} Quản lý Dinh dưỡng & Lượng Kcal Tiêu thụ Hôm nay</div>
            <div class="un-card-sub">
              Tự động cộng Kcal khi bạn đặt đơn trên app hoặc ghi nhận món ăn trong ngày (${summary.dateKey.split('-').reverse().join('/')})
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="db-primary-btn" onclick="openManualMealLogModal()">
              + Ghi nhận bữa ăn
            </button>
          </div>
        </div>

        <div class="un-kcal-tracker-grid">
          <!-- Đồng hồ Vòng tròn Kcal -->
          <div class="un-ring-box">
            <div class="un-svg-ring-wrap">
              <svg width="132" height="132" viewBox="0 0 132 132">
                <circle cx="66" cy="66" r="${ringRadius}" stroke="#e2e8f0" stroke-width="11" fill="none" />
                <circle
                  cx="66"
                  cy="66"
                  r="${ringRadius}"
                  stroke="${ringColor}"
                  stroke-width="11"
                  fill="none"
                  stroke-linecap="round"
                  stroke-dasharray="${Math.round(circumference)}"
                  stroke-dashoffset="${strokeDashoffset}"
                  transform="rotate(-90 66 66)"
                />
              </svg>
              <div class="un-ring-center">
                <div class="un-ring-eaten" style="color:${ringColor};">${summary.consumed.calories}</div>
                <div class="un-ring-goal">/ ${hp.dailyCalorieGoal} kcal</div>
              </div>
            </div>

            <div class="un-ring-status">
              ${summary.isOverCalories ? `
                <span class="un-budget-pill over">
                  ⚠️ Vượt ${Math.abs(summary.remainingCalories)} kcal hôm nay
                </span>
              ` : `
                <span class="un-budget-pill ok">
                  ${FluentIcons.sparkleFilled} Còn lại: <strong>${summary.remainingCalories} kcal</strong> hôm nay
                </span>
              `}
              <div class="un-ring-subnote">${escapeHtml(getDynamicNutritionRingAdvice(summary))}</div>
            </div>
          </div>

          <!-- 3 Thanh Đa lượng (Protein / Carbs / Fat) + Nước uống -->
          <div class="un-macros-panel">
            <div class="un-macro-item">
              <div class="un-macro-lbl-row">
                <span>🥩 Chất đạm (Protein) ${hp.personaType === 'gym' ? '• Ưu tiên Gym' : ''}</span>
                <strong>${summary.consumed.protein}g / ${hp.macroGoals.protein}g (${protPct}%)</strong>
              </div>
              <div class="sn-bar-bg"><div class="sn-bar-fill prot" style="width:${protPct}%;"></div></div>
            </div>

            <div class="un-macro-item">
              <div class="un-macro-lbl-row">
                <span>🌾 Tinh bột (Carbs)</span>
                <strong>${summary.consumed.carbs}g / ${hp.macroGoals.carbs}g (${carbPct}%)</strong>
              </div>
              <div class="sn-bar-bg"><div class="sn-bar-fill carb" style="width:${carbPct}%;"></div></div>
            </div>

            <div class="un-macro-item">
              <div class="un-macro-lbl-row">
                <span>🥑 Chất béo (Fat)</span>
                <strong>${summary.consumed.fat}g / ${hp.macroGoals.fat}g (${fatPct}%)</strong>
              </div>
              <div class="sn-bar-bg"><div class="sn-bar-fill fat" style="width:${fatPct}%;"></div></div>
            </div>

            <!-- Thanh theo dõi Nước uống hàng ngày theo cân nặng -->
            <div class="un-water-bar">
              <div>
                <span style="font-weight:800; color:#0369a1;">💧 Nước uống hôm nay:</span>
                <strong>${summary.waterCups} / ${hp.recommendedWaterCups} cốc</strong>
                <span style="font-size:11.5px; color:var(--gray-500);">(${summary.waterCups * 250}ml)</span>
              </div>
              <div class="un-water-btns">
                <button type="button" onclick="adjustTodayWater(-1)">−</button>
                <button type="button" class="plus" onclick="adjustTodayWater(1)">+ 1 cốc</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Cảnh báo thông minh nếu Giỏ hàng đang có món chờ đặt -->
        ${summary.cartPending.calories > 0 ? `
          <div class="un-cart-kcal-alert" onclick="openCartView()">
            <span>🛒 Giỏ hàng hiện tại của bạn đang có món tương đương <strong>+${summary.cartPending.calories} kcal</strong> (~${summary.cartPending.protein}g Đạm). Sau khi đặt sẽ đạt <strong>${summary.consumed.calories + summary.cartPending.calories} / ${hp.dailyCalorieGoal} kcal</strong>.</span>
            <strong>Xem giỏ hàng →</strong>
          </div>
        ` : ''}

        <!-- Danh sách Nhật ký Bữa ăn Hôm nay -->
        <div class="un-meal-logs-box">
          ${renderTodayMealLogsBoxInnerHtml(summary)}
        </div>
      </div>

      <!-- KHỐI 3: GỢI Ý SẢN PHẨM CÁ NHÂN HÓA DỰA TRÊN THỂ TRẠNG & QUỸ KCAL -->
      <div class="un-card un-recommendations-card">
        <div class="un-card-head">
          <div>
            <div class="un-card-title">
              ${FluentIcons.sparkleFilled} Gợi ý Sản phẩm Dành riêng cho ${escapeHtml(activeUser.name)} (${escapeHtml(persona.shortLabel)} • ${hp.weightKg}kg)
            </div>
            <div class="un-card-sub">
              Được chấm điểm tự động từ ${DB.getItems().length} mặt hàng theo mục tiêu ${hp.wantKeepFit ? 'Giữ dáng, ' : ''}cân nặng ${hp.weightKg}kg và quỹ <strong>${Math.max(0, summary.remainingCalories)} kcal</strong> còn lại hôm nay
            </div>
          </div>
          <button
            type="button"
            class="db-secondary-btn"
            onclick="openAIChatView('Tư vấn thực đơn hôm nay cho mình (${persona.shortLabel}, nặng ${hp.weightKg}kg, còn ${Math.max(0, summary.remainingCalories)} kcal)')"
          >
            🤖 Nhờ AI lên thực đơn cả ngày
          </button>
        </div>

        <!-- Bộ lọc nhanh chế độ gợi ý -->
        <div class="db-filter-chips-row" style="margin-bottom: 14px;">
          <button type="button" class="db-chip ${nutritionRecFilter === 'best' ? 'active' : ''}" onclick="setNutritionRecFilter('best')">
            ${FluentIcons.targetFilled} Phù hợp nhất với bạn
          </button>
          <button type="button" class="db-chip ${nutritionRecFilter === 'low_cal' ? 'active' : ''}" onclick="setNutritionRecFilter('low_cal')">
            ${FluentIcons.fireFilled} Nhẹ bụng (&le; 420 kcal)
          </button>
          <button type="button" class="db-chip ${nutritionRecFilter === 'high_protein' ? 'active' : ''}" onclick="setNutritionRecFilter('high_protein')">
            💪 Giàu Đạm Gym (24g+)
          </button>
          <button type="button" class="db-chip ${nutritionRecFilter === 'keep_fit' ? 'active' : ''}" onclick="setNutritionRecFilter('keep_fit')">
            🥗 Giữ dáng (Healthy 8.3+)
          </button>
          <button type="button" class="db-chip ${nutritionRecFilter === 'meal' ? 'active' : ''}" onclick="setNutritionRecFilter('meal')">
            🍱 Bữa chính đủ chất
          </button>
        </div>

        ${recs.length === 0 ? `
          <div class="un-empty-log">Không có mặt hàng nào khớp bộ lọc này. Hãy chọn "Phù hợp nhất với bạn"!</div>
        ` : `
          <div class="un-rec-dishes-grid">
            ${recs.map(({ item, prof, reasonText }) => `
              <div class="un-rec-dish-card">
                <div class="un-rec-img-wrap" onclick="openDishDetailById('${escapeHtml(item.id)}')">
                  <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                  <span class="un-rec-kcal-badge">${FluentIcons.fireFilled} ~${prof.calories} kcal</span>
                  <span class="un-rec-healthy-badge">🥗 ${prof.healthyScore}/10</span>
                </div>

                <div class="un-rec-body">
                  <div class="un-rec-title" onclick="openDishDetailById('${escapeHtml(item.id)}')">${escapeHtml(item.name)}</div>
                  <div class="un-rec-store">${FluentIcons.shop} ${escapeHtml(item.restaurantName)} • <strong>${formatVND(item.price)}</strong></div>

                  <div class="un-rec-macros-mini">
                    <span>🥩 Đạm <strong>${prof.protein}g</strong></span>
                    <span>🌾 Carb <strong>${prof.carbs}g</strong></span>
                    <span>🥑 Béo <strong>${prof.fat}g</strong></span>
                  </div>

                  <div class="un-rec-reason">💡 ${escapeHtml(reasonText)}</div>

                  <div class="un-rec-actions">
                    <button type="button" class="un-rec-btn detail" onclick="openDishDetailById('${escapeHtml(item.id)}')">
                      Xem món
                    </button>
                    <button type="button" class="un-rec-btn log" onclick="quickLogDishEaten('${escapeHtml(item.id)}')" title="Ghi nhận đã ăn món này vào Kcal hôm nay">
                      🍽️ Đã ăn
                    </button>
                    <button type="button" class="un-rec-btn cart" onclick="quickAddRecommendedDishToCart('${escapeHtml(item.id)}')">
                      🛒 Đặt
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

// =========================================================================
// 4B. KHẢO SÁT THỂ TRẠNG DẠNG MODAL OVERLAY (UN-CARD UN-SURVEY-CARD MODAL)
// =========================================================================

function openUserNutritionSurveyModal(targetUserId = null) {
  const user = targetUserId
    ? DB.getUsers().find(u => u.id === targetUserId)
    : DB.getCurrentUser();
  if (!user) return;

  const overlay = document.getElementById('modal-overlay');
  const sheet = document.getElementById('modal-bottom-sheet');
  if (!overlay || !sheet) return;

  isNutritionSurveyModalOpen = true;
  renderUserNutritionSurveyModalContent(user);
  overlay.classList.add('active');
}

function renderUserNutritionSurveyModalContent(targetUser = null) {
  const activeUser = targetUser || DB.getCurrentUser();
  if (!activeUser) return;

  const sheet = document.getElementById('modal-bottom-sheet');
  if (!sheet) return;

  const summary = getTodayNutritionSummary(activeUser);
  const hp = summary.hp;
  const persona = getPersonaMeta(hp.personaType);

  sheet.innerHTML = `
    <div class="delivery-modal-header un-survey-modal-header">
      <div class="delivery-modal-title">
        <span>${FluentIcons.targetFilled}</span>
        <span>Phân loại Người dùng &amp; Thể trạng</span>
      </div>
      <button type="button" class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body un-survey-modal-body">
      <div class="un-card un-survey-card un-survey-card-modal">
        <div class="un-card-head" style="margin-bottom: 12px;">
          <div>
            <div class="un-card-title">
              <span>${FluentIcons.targetFilled} Phân loại &amp; Thể trạng của <strong>${escapeHtml(activeUser.name)}</strong></span>
            </div>
            <div class="un-card-sub">
              Cho hệ thống biết mục tiêu, chế độ ăn &amp; cân nặng hiện tại để quản lý Kcal và gợi ý món chuẩn xác nhất
            </div>
          </div>
        </div>

        <!-- 4 Thẻ chọn nhanh Nhóm người dùng 1 chạm -->
        <div class="un-persona-grid">
          ${USER_PERSONA_OPTIONS.map(opt => {
    const isSelected = hp.personaType === opt.id;
    return `
              <div
                class="un-persona-card ${isSelected ? 'active' : ''}"
                style="${isSelected ? `border-color:${opt.color}; background:${opt.bg};` : ''}"
                onclick="quickSelectUserPersona('${opt.id}')"
                role="button"
                tabindex="0"
                aria-pressed="${isSelected}"
                onkeydown="if(event.key==='Enter'||event.key===' ')quickSelectUserPersona('${opt.id}')"
              >
                <div class="un-persona-top">
                  <span class="un-persona-emoji">${opt.icon}</span>
                  <span class="un-persona-check">${isSelected ? '✓ Đang chọn' : 'Chọn'}</span>
                </div>
                <div class="un-persona-name">${escapeHtml(opt.title)}</div>
                <div class="un-persona-desc">${escapeHtml(opt.desc)}</div>
              </div>
            `;
  }).join('')}
        </div>

        <!-- Thanh câu hỏi nhanh: Muốn giữ dáng không? + Cân nặng, Chiều cao hiện tại thế nào? -->
        <div class="un-quick-questions-bar">
          <!-- Câu hỏi 1: Muốn giữ dáng hay không -->
          <div class="un-qq-box">
            <div class="un-qq-label">🪞 Bạn có muốn giữ dáng / kiểm soát dầu mỡ không?</div>
            <div class="un-keepfit-toggle-row">
              <button
                type="button"
                class="un-toggle-pill ${hp.wantKeepFit ? 'active' : ''}"
                onclick="quickToggleKeepFit(true)"
              >
                🥗 Có, muốn giữ dáng
              </button>
              <button
                type="button"
                class="un-toggle-pill ${!hp.wantKeepFit ? 'active' : ''}"
                onclick="quickToggleKeepFit(false)"
              >
                🍽️ Không, ăn thoải mái
              </button>
            </div>
          </div>

          <!-- Câu hỏi 2: Cân nặng hiện tại thế nào -->
          <div class="un-qq-box">
            <div class="un-qq-label">⚖️ Cân nặng &amp; Chiều cao hiện tại của bạn:</div>
            <div class="un-weight-inline-controls">
              <div class="un-stepper-field">
                <button type="button" onclick="quickAdjustUserWeight(-1)" title="Giảm 1kg">−</button>
                <input
                  type="number"
                  min="32"
                  max="180"
                  step="0.5"
                  value="${hp.weightKg}"
                  onchange="quickSetUserWeight(this.value)"
                  aria-label="Cân nặng hiện tại (kg)"
                >
                <span>kg</span>
                <button type="button" onclick="quickAdjustUserWeight(1)" title="Tăng 1kg">+</button>
              </div>

              <div class="un-height-mini">
                <span>Cao:</span>
                <input
                  type="number"
                  min="130"
                  max="220"
                  value="${hp.heightCm}"
                  onchange="quickSetUserHeight(this.value)"
                  aria-label="Chiều cao (cm)"
                >
                <span>cm</span>
              </div>

              <span class="un-bmi-chip" style="color:${hp.bmiInfo.color}; background:${hp.bmiInfo.color}14; border-color:${hp.bmiInfo.color}40;">
                BMI ${hp.bmiInfo.bmi} • ${escapeHtml(hp.bmiInfo.status)}
              </span>
            </div>
          </div>
        </div>

        <!-- Mức độ vận động & Ưu tiên cá nhân -->
        <div class="un-expanded-settings" style="display: block; margin-top: 14px;">
          <div class="un-expanded-row">
            <div>
              <div class="un-qq-label" style="margin-bottom:6px;">🏃 Mức độ vận động hàng tuần:</div>
              <div class="un-act-pills">
                ${ACTIVITY_LEVEL_OPTIONS.map(act => `
                  <button
                    type="button"
                    class="un-act-pill ${hp.activityLevel === act.id ? 'active' : ''}"
                    onclick="quickSelectActivityLevel('${act.id}')"
                  >
                    ${escapeHtml(act.label)}
                  </button>
                `).join('')}
              </div>
            </div>

            <div>
              <div class="un-qq-label" style="margin-bottom:6px;">${FluentIcons.tagFilled} Ưu tiên dinh dưỡng cá nhân (chạm để bật/tắt):</div>
              <div class="un-act-pills">
                ${DIETARY_NOTE_TAGS.map(tag => {
    const hasTag = hp.dietaryNotes.includes(tag);
    return `
                    <button
                      type="button"
                      class="un-act-pill ${hasTag ? 'active' : ''}"
                      onclick="quickToggleDietaryNote('${escapeHtml(tag)}')"
                    >
                      ${hasTag ? '✓ ' : '+ '}${escapeHtml(tag)}
                    </button>
                  `;
  }).join('')}
              </div>
            </div>
          </div>

          <div class="un-expanded-footer" style="margin-top: 16px;">
            <span>💡 Dựa trên cân nặng <strong>${hp.weightKg}kg</strong> &amp; mục tiêu <strong>${escapeHtml(persona.shortLabel)}</strong>, mức năng lượng khuyến nghị của bạn là <strong>${hp.recommendedCalories} kcal/ngày</strong>.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Nút lưu & hoàn tất thể trạng cố định dưới cùng modal -->
    <div class="delivery-modal-footer un-survey-modal-footer">
      <button type="button" class="db-secondary-btn" onclick="openHealthProfileSetupModal('${escapeHtml(activeUser.id)}')">
        📋 Thông số chi tiết
      </button>
      <button type="button" class="btn-primary-large" style="flex:1;" onclick="closeModal(); showToast('checkmarkFilled', 'Đã lưu thiết lập thể trạng thành công!')">
        ✓ Hoàn tất &amp; Lưu Thể Trạng
      </button>
    </div>
  `;
}

// =========================================================================
// 5. THAO TÁC NHANH TRÊN BẢNG KHẢO SÁT & NHẬT KÝ KCAL (CẬP NHẬT IN-PLACE TẠI CHỖ)
// =========================================================================

function renderRecDishesGridHtml(recs) {
  if (!recs || recs.length === 0) {
    return `<div class="un-empty-log">Không có mặt hàng nào khớp bộ lọc này. Hãy chọn "Phù hợp nhất với bạn"!</div>`;
  }
  return `
    <div class="un-rec-dishes-grid">
      ${recs.map(({ item, prof, reasonText }) => `
        <div class="un-rec-dish-card">
          <div class="un-rec-img-wrap" onclick="openDishDetailById('${escapeHtml(item.id)}')">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
            <span class="un-rec-kcal-badge">${FluentIcons.fireFilled} ~${prof.calories} kcal</span>
            <span class="un-rec-healthy-badge">🥗 ${prof.healthyScore}/10</span>
          </div>

          <div class="un-rec-body">
            <div class="un-rec-title" onclick="openDishDetailById('${escapeHtml(item.id)}')">${escapeHtml(item.name)}</div>
            <div class="un-rec-store">${FluentIcons.shop} ${escapeHtml(item.restaurantName)} • <strong>${formatVND(item.price)}</strong></div>

            <div class="un-rec-macros-mini">
              <span>🥩 Đạm <strong>${prof.protein}g</strong></span>
              <span>🌾 Carb <strong>${prof.carbs}g</strong></span>
              <span>🥑 Béo <strong>${prof.fat}g</strong></span>
            </div>

            <div class="un-rec-reason">💡 ${escapeHtml(reasonText)}</div>

            <div class="un-rec-actions">
              <button type="button" class="un-rec-btn detail" onclick="openDishDetailById('${escapeHtml(item.id)}')">
                Xem món
              </button>
              <button type="button" class="un-rec-btn log" onclick="quickLogDishEaten('${escapeHtml(item.id)}')" title="Ghi nhận đã ăn món này vào Kcal hôm nay">
                🍽️ Đã ăn
              </button>
              <button type="button" class="un-rec-btn cart" onclick="quickAddRecommendedDishToCart('${escapeHtml(item.id)}')">
                🛒 Đặt
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function updateSurveyModalInPlace(hp) {
  const modalSurvey = document.querySelector('.un-survey-card-modal');
  if (!modalSurvey) return;

  const persona = getPersonaMeta(hp.personaType);

  // 1. Cập nhật thẻ Persona
  modalSurvey.querySelectorAll('.un-persona-card').forEach(card => {
    const onclickAttr = card.getAttribute('onclick') || '';
    const isSelected = onclickAttr.includes(`'${hp.personaType}'`) || onclickAttr.includes(`"${hp.personaType}"`);
    card.classList.toggle('active', isSelected);
    card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    const checkSpan = card.querySelector('.un-persona-check');
    if (checkSpan) {
      checkSpan.textContent = isSelected ? '✓ Đang chọn' : 'Chọn';
    }
    if (isSelected) {
      card.style.borderColor = persona.color;
      card.style.background = persona.bg;
    } else {
      card.style.borderColor = '';
      card.style.background = '';
    }
  });

  // 2. Cập nhật toggle giữ dáng
  const togglePills = modalSurvey.querySelectorAll('.un-keepfit-toggle-row .un-toggle-pill');
  if (togglePills.length >= 2) {
    togglePills[0].classList.toggle('active', Boolean(hp.wantKeepFit));
    togglePills[1].classList.toggle('active', !hp.wantKeepFit);
  }

  // 3. Cập nhật ô nhập cân nặng & chiều cao (giữ nguyên con trỏ nếu người dùng đang gõ)
  const weightInput = modalSurvey.querySelector('.un-stepper-field input');
  if (weightInput && document.activeElement !== weightInput) {
    weightInput.value = hp.weightKg;
  }
  const heightInput = modalSurvey.querySelector('.un-height-mini input');
  if (heightInput && document.activeElement !== heightInput) {
    heightInput.value = hp.heightCm;
  }

  // 4. Cập nhật thẻ BMI
  const bmiChip = modalSurvey.querySelector('.un-bmi-chip');
  if (bmiChip && hp.bmiInfo) {
    bmiChip.textContent = `BMI ${hp.bmiInfo.bmi} • ${hp.bmiInfo.status}`;
    bmiChip.style.color = hp.bmiInfo.color;
    bmiChip.style.background = `${hp.bmiInfo.color}14`;
    bmiChip.style.borderColor = `${hp.bmiInfo.color}40`;
  }

  // 5. Cập nhật mức độ vận động & ghi chú dinh dưỡng
  modalSurvey.querySelectorAll('.un-act-pills .un-act-pill').forEach(pill => {
    const onclickAttr = pill.getAttribute('onclick') || '';
    if (onclickAttr.includes('quickSelectActivityLevel')) {
      const isAct = onclickAttr.includes(`'${hp.activityLevel}'`) || onclickAttr.includes(`"${hp.activityLevel}"`);
      pill.classList.toggle('active', isAct);
    } else if (onclickAttr.includes('quickToggleDietaryNote')) {
      DIETARY_NOTE_TAGS.forEach(tag => {
        if (onclickAttr.includes(`'${tag}'`) || onclickAttr.includes(`"${tag}"`)) {
          const hasTag = hp.dietaryNotes && hp.dietaryNotes.includes(tag);
          pill.classList.toggle('active', hasTag);
          pill.textContent = (hasTag ? '✓ ' : '+ ') + tag;
        }
      });
    }
  });

  // 6. Cập nhật dòng nhắc nhở định mức năng lượng
  const footerSpan = modalSurvey.querySelector('.un-expanded-footer span');
  if (footerSpan) {
    footerSpan.innerHTML = `💡 Dựa trên cân nặng <strong>${hp.weightKg}kg</strong> &amp; mục tiêu <strong>${escapeHtml(persona.shortLabel)}</strong>, mức năng lượng khuyến nghị của bạn là <strong>${hp.recommendedCalories} kcal/ngày</strong>.`;
  }
}

function updateProfileNutritionDashboardInPlace() {
  const dashWrap = document.querySelector('.un-dashboard-wrap');
  if (!dashWrap) {
    if (currentView === 'profile' && typeof renderProfileView === 'function') {
      renderProfileView();
    }
    return;
  }
  const user = DB.getCurrentUser();
  if (!user) return;
  const summary = getTodayNutritionSummary(user);
  const hp = summary.hp;
  const persona = getPersonaMeta(hp.personaType);

  // 1. Cập nhật Vòng tròn Kcal SVG
  const ringRadius = 52;
  const circumference = 2 * Math.PI * ringRadius;
  const ringRatio = Math.min(1, summary.consumed.calories / Math.max(1, hp.dailyCalorieGoal));
  const strokeDashoffset = Math.round(circumference * (1 - ringRatio));
  const ringColor = summary.isOverCalories ? '#dc2626' : (ringRatio > 0.85 ? '#d97706' : '#059669');

  const circles = dashWrap.querySelectorAll('.un-svg-ring-wrap svg circle');
  if (circles.length >= 2) {
    circles[1].setAttribute('stroke', ringColor);
    circles[1].setAttribute('stroke-dashoffset', strokeDashoffset);
  }
  const ringEaten = dashWrap.querySelector('.un-ring-eaten');
  if (ringEaten) {
    ringEaten.textContent = summary.consumed.calories;
    ringEaten.style.color = ringColor;
  }
  const ringGoal = dashWrap.querySelector('.un-ring-goal');
  if (ringGoal) {
    ringGoal.textContent = `/ ${hp.dailyCalorieGoal} kcal`;
  }
  const ringStatus = dashWrap.querySelector('.un-ring-status');
  if (ringStatus) {
    ringStatus.innerHTML = `
      ${summary.isOverCalories ? `
        <span class="un-budget-pill over">
          ⚠️ Vượt ${Math.abs(summary.remainingCalories)} kcal hôm nay
        </span>
      ` : `
        <span class="un-budget-pill ok">
          ${FluentIcons.sparkleFilled} Còn lại: <strong>${summary.remainingCalories} kcal</strong> hôm nay
        </span>
      `}
      <div class="un-ring-subnote">${escapeHtml(getDynamicNutritionRingAdvice(summary))}</div>
    `;
  }

  // 2. Cập nhật 3 thanh đa lượng (Protein / Carbs / Fat)
  const protPct = Math.min(100, Math.round((summary.consumed.protein / Math.max(1, hp.macroGoals.protein)) * 100));
  const carbPct = Math.min(100, Math.round((summary.consumed.carbs / Math.max(1, hp.macroGoals.carbs)) * 100));
  const fatPct = Math.min(100, Math.round((summary.consumed.fat / Math.max(1, hp.macroGoals.fat)) * 100));

  const macroItems = dashWrap.querySelectorAll('.un-macro-item');
  if (macroItems.length >= 3) {
    // Protein
    const pLbl = macroItems[0].querySelector('.un-macro-lbl-row');
    const pFill = macroItems[0].querySelector('.sn-bar-fill.prot');
    if (pLbl) pLbl.innerHTML = `<span>🥩 Chất đạm (Protein) ${hp.personaType === 'gym' ? '• Ưu tiên Gym' : ''}</span><strong>${summary.consumed.protein}g / ${hp.macroGoals.protein}g (${protPct}%)</strong>`;
    if (pFill) pFill.style.width = `${protPct}%`;

    // Carbs
    const cLbl = macroItems[1].querySelector('.un-macro-lbl-row');
    const cFill = macroItems[1].querySelector('.sn-bar-fill.carb');
    if (cLbl) cLbl.innerHTML = `<span>🌾 Tinh bột (Carbs)</span><strong>${summary.consumed.carbs}g / ${hp.macroGoals.carbs}g (${carbPct}%)</strong>`;
    if (cFill) cFill.style.width = `${carbPct}%`;

    // Fat
    const fLbl = macroItems[2].querySelector('.un-macro-lbl-row');
    const fFill = macroItems[2].querySelector('.sn-bar-fill.fat');
    if (fLbl) fLbl.innerHTML = `<span>🥑 Chất béo (Fat)</span><strong>${summary.consumed.fat}g / ${hp.macroGoals.fat}g (${fatPct}%)</strong>`;
    if (fFill) fFill.style.width = `${fatPct}%`;
  }

  // 3. Cập nhật thanh nước uống
  const waterBar = dashWrap.querySelector('.un-water-bar');
  if (waterBar) {
    const strong = waterBar.querySelector('strong');
    const spanMl = waterBar.querySelector('span[style*="font-size:11.5px"], span[style*="color:var(--gray-500)"]');
    if (strong) strong.textContent = `${summary.waterCups} / ${hp.recommendedWaterCups} cốc`;
    if (spanMl) spanMl.textContent = `(${summary.waterCups * 250}ml)`;
  }

  // 4. Cập nhật cảnh báo Kcal giỏ hàng
  const cartAlert = dashWrap.querySelector('.un-cart-kcal-alert');
  if (summary.cartPending.calories > 0) {
    const alertHtml = `
      <span>🛒 Giỏ hàng hiện tại của bạn đang có món tương đương <strong>+${summary.cartPending.calories} kcal</strong> (~${summary.cartPending.protein}g Đạm). Sau khi đặt sẽ đạt <strong>${summary.consumed.calories + summary.cartPending.calories} / ${hp.dailyCalorieGoal} kcal</strong>.</span>
      <strong>Xem giỏ hàng →</strong>
    `;
    if (cartAlert) {
      cartAlert.innerHTML = alertHtml;
      cartAlert.style.display = 'flex';
    } else {
      const trackerGrid = dashWrap.querySelector('.un-kcal-tracker-grid');
      if (trackerGrid) {
        const div = document.createElement('div');
        div.className = 'un-cart-kcal-alert';
        div.onclick = () => openCartView();
        div.innerHTML = alertHtml;
        trackerGrid.insertAdjacentElement('afterend', div);
      }
    }
  } else if (cartAlert) {
    cartAlert.style.display = 'none';
  }

  // 5. Cập nhật danh sách món ăn đã tiêu thụ hôm nay
  const mealLogsBox = dashWrap.querySelector('.un-meal-logs-box');
  if (mealLogsBox) {
    mealLogsBox.innerHTML = renderTodayMealLogsBoxInnerHtml(summary);
  }

  // 6. Cập nhật khối Gợi ý Sản phẩm Cá nhân hóa
  const recCard = dashWrap.querySelector('.un-recommendations-card');
  if (recCard) {
    const titleEl = recCard.querySelector('.un-card-title');
    const subEl = recCard.querySelector('.un-card-sub');
    if (titleEl) {
      titleEl.innerHTML = `${FluentIcons.sparkleFilled} Gợi ý Sản phẩm Dành riêng cho ${escapeHtml(user.name)} (${escapeHtml(persona.shortLabel)} • ${hp.weightKg}kg)`;
    }
    if (subEl) {
      subEl.innerHTML = `Được chấm điểm tự động từ ${DB.getItems().length} mặt hàng theo mục tiêu ${hp.wantKeepFit ? 'Giữ dáng, ' : ''}cân nặng ${hp.weightKg}kg và quỹ <strong>${Math.max(0, summary.remainingCalories)} kcal</strong> còn lại hôm nay`;
    }
    const recs = getPersonalizedDishRecommendations(user, nutritionRecFilter, 6);
    const gridContainer = recCard.querySelector('.un-rec-dishes-grid, .un-empty-log');
    if (gridContainer) {
      gridContainer.outerHTML = renderRecDishesGridHtml(recs);
    }
  }
}

function updateDishDetailMatchBannerInPlace() {
  const bar = document.querySelector('.pdp-personal-match-bar');
  if (!bar) return;
  const dish = (typeof currentDetailDish !== 'undefined') ? currentDetailDish : null;
  if (!dish) return;
  const dynNutri = (typeof computeDetailDishNutriTotals === 'function') ? computeDetailDishNutriTotals() : null;
  if (!dynNutri) return;
  const newHtml = renderPersonalDishMatchBanner(dish, dynNutri);
  if (newHtml) {
    bar.outerHTML = newHtml;
  }
}

function saveActiveUserHealthPatch(patch, toastMsg = null) {
  const user = DB.getCurrentUser();
  if (!user) return;
  const currentHp = getNormalizedUserHealthProfile(user);
  const merged = { ...currentHp, ...patch };
  const computed = computePersonalNutritionTargets(merged);
  merged.dailyCalorieGoal = merged.customCalorieGoal ? merged.dailyCalorieGoal : computed.recommendedCalories;
  merged.macroGoals = computed.macroGoals;

  DB.updateUserHealthProfile(user.id, merged);
  if (toastMsg) {
    showToast('checkmarkFilled', toastMsg);
  }

  // Cập nhật in-place trên Survey Modal nếu đang mở
  updateSurveyModalInPlace(merged);

  // Cập nhật in-place trên Profile Dashboard hoặc Dish Detail
  if (currentView === 'profile') {
    updateProfileNutritionDashboardInPlace();
  } else if (currentView === 'dish-detail') {
    updateDishDetailMatchBannerInPlace();
  }
}

function quickSelectUserPersona(personaId) {
  const meta = getPersonaMeta(personaId);
  const patch = {
    personaType: personaId,
    customCalorieGoal: false
  };
  if (personaId === 'keep_fit' || personaId === 'weight_loss') {
    patch.wantKeepFit = true;
  } else if (personaId === 'normal') {
    patch.wantKeepFit = false;
  }
  saveActiveUserHealthPatch(patch, `Đã chuyển sang chế độ: ${meta.icon} ${meta.title}!`);
}

function quickToggleKeepFit(val) {
  const want = Boolean(val);
  saveActiveUserHealthPatch(
    { wantKeepFit: want, customCalorieGoal: false },
    want ? '🥗 Đã bật ưu tiên Giữ dáng & kiểm soát dầu mỡ!' : '🍽️ Đã chuyển sang chế độ ăn uống thoải mái!'
  );
}

function quickAdjustUserWeight(delta) {
  const user = DB.getCurrentUser();
  if (!user) return;
  const hp = getNormalizedUserHealthProfile(user);
  const nextW = Math.max(32, Math.min(180, Number((hp.weightKg + delta).toFixed(1))));
  saveActiveUserHealthPatch({ weightKg: nextW, customCalorieGoal: false }, `⚖️ Đã cập nhật cân nặng: ${nextW} kg`);
}

function quickSetUserWeight(val) {
  const num = Number(val);
  if (!num || num < 30 || num > 200) return;
  saveActiveUserHealthPatch({ weightKg: Number(num.toFixed(1)), customCalorieGoal: false }, `⚖️ Đã lưu cân nặng hiện tại: ${num} kg`);
}

function quickSetUserHeight(val) {
  const num = Math.round(Number(val));
  if (!num || num < 120 || num > 230) return;
  saveActiveUserHealthPatch({ heightCm: num, customCalorieGoal: false }, `📏 Đã lưu chiều cao: ${num} cm`);
}

function quickSelectActivityLevel(actId) {
  saveActiveUserHealthPatch({ activityLevel: actId, customCalorieGoal: false }, '🏃 Đã cập nhật mức độ vận động & định mức Kcal!');
}

function quickToggleDietaryNote(tag) {
  const user = DB.getCurrentUser();
  if (!user) return;
  const hp = getNormalizedUserHealthProfile(user);
  const notes = [...hp.dietaryNotes];
  const idx = notes.indexOf(tag);
  if (idx > -1) notes.splice(idx, 1);
  else notes.push(tag);
  saveActiveUserHealthPatch({ dietaryNotes: notes });
}

function setNutritionRecFilter(mode) {
  nutritionRecFilter = mode;
  const card = document.querySelector('.un-recommendations-card');
  if (card) {
    card.querySelectorAll('.db-chip').forEach(chip => {
      const onclickAttr = chip.getAttribute('onclick') || '';
      chip.classList.toggle('active', onclickAttr.includes(`'${mode}'`) || onclickAttr.includes(`"${mode}"`));
    });
    const user = DB.getCurrentUser();
    const recs = getPersonalizedDishRecommendations(user, nutritionRecFilter, 6);
    const gridContainer = card.querySelector('.un-rec-dishes-grid, .un-empty-log');
    if (gridContainer) {
      gridContainer.outerHTML = renderRecDishesGridHtml(recs);
    }
  } else if (typeof renderProfileView === 'function') {
    renderProfileView();
  }
}

function adjustTodayWater(delta) {
  const user = DB.getCurrentUser();
  if (!user) return;
  const nextCups = DB.updateWaterIntakeForUser(user.id, delta, getTodayDateKey());
  const waterBar = document.querySelector('.un-water-bar');
  const hp = getNormalizedUserHealthProfile(user);
  if (waterBar) {
    const strong = waterBar.querySelector('strong');
    const spanMl = waterBar.querySelector('span[style*="font-size:11.5px"], span[style*="color:var(--gray-500)"]');
    if (strong) strong.textContent = `${nextCups} / ${hp.recommendedWaterCups} cốc`;
    if (spanMl) spanMl.textContent = `(${nextCups * 250}ml)`;
  }
  showToast('sparkleRegular', `💧 Đã cập nhật nước uống: ${nextCups}/${hp.recommendedWaterCups} cốc (${nextCups * 250}ml)`);
}

function quickLogDishEaten(itemId) {
  const user = DB.getCurrentUser();
  const item = DB.getItemById(itemId);
  if (!user || !item) return;

  const store = (typeof restaurants !== 'undefined')
    ? restaurants.find(r => Number(r.id) === Number(item.restaurantId))
    : null;
  const prof = getDishNutritionAndSafetyProfile(item, store);
  const hour = new Date().getHours();
  const mealType = hour < 10 ? 'Bữa sáng' : hour < 14 ? 'Bữa trưa' : hour < 18 ? 'Bữa xế' : 'Bữa tối';
  const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  DB.logNutritionEntryForUser(user.id, {
    id: 'nutri_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    time: nowTime,
    mealType,
    dishId: item.id,
    dishName: item.name,
    quantity: 1,
    calories: prof.calories,
    protein: prof.protein,
    carbs: prof.carbs,
    fat: prof.fat,
    source: 'manual'
  }, getTodayDateKey());

  showToast('checkmarkFilled', `🍽️ Đã cộng +${prof.calories} kcal (${item.name}) vào nhật ký hôm nay!`);
  updateProfileNutritionDashboardInPlace();
}

function quickAddRecommendedDishToCart(itemId) {
  const item = DB.getItemById(itemId);
  if (!item || item.inStock === false) return;
  const size = (item.sizes && item.sizes[0]) ? item.sizes[0] : { name: 'Phần Tiêu Chuẩn', extraPrice: 0 };
  const unitPrice = Number(item.price) + (Number(size.extraPrice) || 0);

  if (typeof window !== 'undefined' && typeof window.addOrMergeCartItem === 'function') {
    window.addOrMergeCartItem({
      dishId: item.id,
      dishName: item.name,
      restaurantName: item.restaurantName || 'ptitngon Kitchen',
      restaurantId: item.restaurantId || 1,
      image: item.image,
      size,
      toppings: [],
      note: '',
      quantity: 1,
      unitPrice
    });
  } else {
    cart.push({
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      dishId: item.id,
      dishName: item.name,
      restaurantName: item.restaurantName || 'ptitngon Kitchen',
      restaurantId: item.restaurantId || 1,
      image: item.image,
      size,
      toppings: [],
      note: '',
      quantity: 1,
      unitPrice,
      totalPrice: unitPrice
    });
  }

  DB.saveCurrentUserCart(cart);
  updateFloatingCartBar();
  showToast('cartFilled', `🛒 Đã thêm "${item.name}" vào giỏ hàng!`);
  updateProfileNutritionDashboardInPlace();
}

function removeTodayMealEntry(entryId) {
  const user = DB.getCurrentUser();
  if (!user) return;
  if (DB.removeNutritionEntryForUser(user.id, entryId, getTodayDateKey())) {
    showToast('deleteRegular', 'Đã xóa mục khỏi nhật ký Kcal hôm nay');
    updateProfileNutritionDashboardInPlace();
  }
}

// =========================================================================
// 6. MODAL THIẾT LẬP ĐẦY ĐỦ THÔNG SỐ CƠ THỂ & MODAL GHI NHẬN BỮA ĂN
// =========================================================================

let modalDraftPersona = 'normal';
let modalDraftKeepFit = false;
let modalDraftGender = 'male';
let modalDraftAct = 'moderate';

function openHealthProfileSetupModal(targetUserId = null) {
  const user = targetUserId
    ? DB.getUsers().find(u => u.id === targetUserId)
    : DB.getCurrentUser();
  if (!user) return;

  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  const hp = getNormalizedUserHealthProfile(user);
  modalDraftPersona = hp.personaType;
  modalDraftKeepFit = hp.wantKeepFit;
  modalDraftGender = hp.gender;
  modalDraftAct = hp.activityLevel;

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        <span>🥗</span>
        <span>Hồ Sơ Thể Trạng & Dinh Dưỡng — ${escapeHtml(user.name)}</span>
      </div>
      <button type="button" class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      <div class="delivery-input-group">
        <label class="delivery-input-label">1. Bạn thuộc nhóm người dùng nào?</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          ${USER_PERSONA_OPTIONS.map(p => `
            <div
              class="delivery-tag-btn ${modalDraftPersona === p.id ? 'active' : ''}"
              style="text-align:left; padding:10px 12px; border-radius:12px;"
              onclick="modalDraftPersona='${p.id}'; if('${p.id}'==='keep_fit'||'${p.id}'==='weight_loss'){modalDraftKeepFit=true;} this.parentElement.querySelectorAll('.delivery-tag-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active');"
            >
              <div style="font-weight:800;">${p.icon} ${escapeHtml(p.shortLabel)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">2. Bạn có muốn giữ dáng / kiểm soát mỡ thừa không?</label>
        <div class="delivery-tag-selector">
          <div
            class="delivery-tag-btn ${modalDraftKeepFit ? 'active' : ''}"
            onclick="modalDraftKeepFit=true; this.parentElement.querySelectorAll('.delivery-tag-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active');"
          >
            🥗 Có, ưu tiên giữ dáng
          </div>
          <div
            class="delivery-tag-btn ${!modalDraftKeepFit ? 'active' : ''}"
            onclick="modalDraftKeepFit=false; this.parentElement.querySelectorAll('.delivery-tag-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active');"
          >
            🍽️ Không, ăn uống bình thường
          </div>
        </div>
      </div>

      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">3. Cân nặng hiện tại (kg):</label>
          <input type="number" id="hp-modal-weight" class="delivery-input-field" min="32" max="180" step="0.5" value="${hp.weightKg}">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Cân nặng mục tiêu (kg):</label>
          <input type="number" id="hp-modal-target-weight" class="delivery-input-field" min="32" max="180" step="0.5" value="${hp.targetWeightKg}">
        </div>
      </div>

      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Chiều cao (cm):</label>
          <input type="number" id="hp-modal-height" class="delivery-input-field" min="130" max="220" value="${hp.heightCm}">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Độ tuổi:</label>
          <input type="number" id="hp-modal-age" class="delivery-input-field" min="14" max="90" value="${hp.age}">
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Giới tính sinh học (để tính TDEE chính xác):</label>
        <div class="delivery-tag-selector">
          <div class="delivery-tag-btn ${modalDraftGender === 'male' ? 'active' : ''}" onclick="modalDraftGender='male'; this.parentElement.querySelectorAll('.delivery-tag-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active');">
            👨 Nam
          </div>
          <div class="delivery-tag-btn ${modalDraftGender === 'female' ? 'active' : ''}" onclick="modalDraftGender='female'; this.parentElement.querySelectorAll('.delivery-tag-btn').forEach(b=>b.classList.remove('active')); this.classList.add('active');">
            👩 Nữ
          </div>
        </div>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Cường độ vận động hàng tuần:</label>
        <select id="hp-modal-activity" class="delivery-input-field" onchange="modalDraftAct=this.value">
          ${ACTIVITY_LEVEL_OPTIONS.map(a => `
            <option value="${a.id}" ${modalDraftAct === a.id ? 'selected' : ''}>${escapeHtml(a.label)}</option>
          `).join('')}
        </select>
      </div>

      <div class="delivery-input-group">
        <label class="delivery-input-label">Mục tiêu Kcal/ngày tùy chỉnh (Để trống = Tự động tính chuẩn theo cân nặng):</label>
        <input
          type="number"
          id="hp-modal-custom-kcal"
          class="delivery-input-field"
          placeholder="Tự động (~${hp.recommendedCalories} kcal/ngày)"
          value="${hp.customCalorieGoal ? hp.dailyCalorieGoal : ''}"
        >
      </div>
    </div>

    <!-- Nút lưu hồ sơ thể trạng cố định dưới cùng modal -->
    <div class="delivery-modal-footer">
      <button type="button" class="btn-primary-large" style="flex:1; width:100%;" onclick="submitHealthProfileSetupModal('${escapeHtml(user.id)}')">
        ${FluentIcons.saveFilled} Lưu Hồ Sơ Thể Trạng & Cập Nhật Gợi Ý Món
      </button>
    </div>
  `;

  overlay.classList.add('active');
}

function submitHealthProfileSetupModal(userId) {
  const weightKg = Math.max(32, Math.min(180, Number(document.getElementById('hp-modal-weight')?.value) || 62));
  const targetWeightKg = Math.max(32, Math.min(180, Number(document.getElementById('hp-modal-target-weight')?.value) || weightKg));
  const heightCm = Math.max(130, Math.min(220, Math.round(Number(document.getElementById('hp-modal-height')?.value) || 170)));
  const age = Math.max(14, Math.min(90, Math.round(Number(document.getElementById('hp-modal-age')?.value) || 20)));
  const activityLevel = document.getElementById('hp-modal-activity')?.value || modalDraftAct || 'moderate';
  const customKcalRaw = document.getElementById('hp-modal-custom-kcal')?.value.trim();

  const user = DB.getUsers().find(u => u.id === userId) || DB.getCurrentUser();
  const prevHp = getNormalizedUserHealthProfile(user);

  const patch = {
    ...prevHp,
    personaType: modalDraftPersona,
    wantKeepFit: modalDraftKeepFit,
    gender: modalDraftGender,
    weightKg,
    targetWeightKg,
    heightCm,
    age,
    activityLevel,
    customCalorieGoal: Boolean(customKcalRaw && Number(customKcalRaw) >= 1000)
  };

  if (patch.customCalorieGoal) {
    patch.dailyCalorieGoal = Math.round(Number(customKcalRaw));
  }

  const computed = computePersonalNutritionTargets(patch);
  patch.dailyCalorieGoal = computed.dailyCalorieGoal;
  patch.macroGoals = computed.macroGoals;

  DB.updateUserHealthProfile(user.id, patch);
  closeModal();
  showToast('checkmarkFilled', `Đã lưu thể trạng (${weightKg}kg • Mục tiêu ${patch.dailyCalorieGoal} kcal/ngày)!`);
  render();
}

function openManualMealLogModal() {
  const user = DB.getCurrentUser();
  if (!user) return;
  const sheet = document.getElementById('modal-bottom-sheet');
  const overlay = document.getElementById('modal-overlay');
  if (!sheet || !overlay) return;

  const items = DB.getItems().slice(0, 40);

  sheet.innerHTML = `
    <div class="delivery-modal-header">
      <div class="delivery-modal-title">
        <span>🍽️</span>
        <span>Ghi Nhận Bữa Ăn Vào Kcal Hôm Nay</span>
      </div>
      <button type="button" class="dish-modal-close-btn" onclick="closeModal()" title="Đóng">
        ${FluentIcons.dismiss}
      </button>
    </div>

    <div class="delivery-modal-body">
      <div class="delivery-input-group">
        <label class="delivery-input-label">Chọn nhanh mặt hàng trên hệ thống (tự điền Kcal & Đạm):</label>
        <select id="manual-meal-preset" class="delivery-input-field" onchange="fillManualMealFromItem(this.value)">
          <option value="">-- Hoặc tự nhập món ăn bên dưới --</option>
          ${items.map(it => `<option value="${escapeHtml(it.id)}">${escapeHtml(it.name)} (${escapeHtml(it.restaurantName)})</option>`).join('')}
        </select>
      </div>

      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Tên món ăn / đồ uống (*):</label>
          <input type="text" id="manual-meal-name" class="delivery-input-field" placeholder="VD: 2 quả trứng luộc, Cơm ức gà...">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Bữa ăn:</label>
          <select id="manual-meal-type" class="delivery-input-field">
            <option value="Bữa sáng">🌅 Bữa sáng</option>
            <option value="Bữa trưa" selected>☀️ Bữa trưa</option>
            <option value="Bữa xế">🥤 Bữa xế / Trước tập</option>
            <option value="Bữa tối">🌙 Bữa tối</option>
          </select>
        </div>
      </div>

      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Năng lượng (kcal) (*):</label>
          <input type="number" id="manual-meal-kcal" class="delivery-input-field" min="10" max="3000" value="350">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Chất đạm - Protein (g):</label>
          <input type="number" id="manual-meal-prot" class="delivery-input-field" min="0" max="200" value="20">
        </div>
      </div>

      <div class="db-form-two-col">
        <div class="delivery-input-group">
          <label class="delivery-input-label">Tinh bột - Carbs (g):</label>
          <input type="number" id="manual-meal-carb" class="delivery-input-field" min="0" max="300" value="40">
        </div>
        <div class="delivery-input-group">
          <label class="delivery-input-label">Chất béo - Fat (g):</label>
          <input type="number" id="manual-meal-fat" class="delivery-input-field" min="0" max="150" value="10">
        </div>
      </div>
    </div>

    <!-- Nút thêm bữa ăn cố định dưới cùng modal -->
    <div class="delivery-modal-footer">
      <button type="button" class="btn-primary-large" style="flex:1; width:100%;" onclick="submitManualMealLogModal()">
        ➕ Cộng Vào Lượng Kcal Tiêu Thụ Hôm Nay
      </button>
    </div>
  `;

  overlay.classList.add('active');
}

function fillManualMealFromItem(itemId) {
  if (!itemId) return;
  const item = DB.getItemById(itemId);
  if (!item) return;
  const store = (typeof restaurants !== 'undefined')
    ? restaurants.find(r => Number(r.id) === Number(item.restaurantId))
    : null;
  const prof = getDishNutritionAndSafetyProfile(item, store);

  const nameEl = document.getElementById('manual-meal-name');
  const kcalEl = document.getElementById('manual-meal-kcal');
  const protEl = document.getElementById('manual-meal-prot');
  const carbEl = document.getElementById('manual-meal-carb');
  const fatEl = document.getElementById('manual-meal-fat');

  if (nameEl) nameEl.value = item.name;
  if (kcalEl) kcalEl.value = prof.calories;
  if (protEl) protEl.value = prof.protein;
  if (carbEl) carbEl.value = prof.carbs;
  if (fatEl) fatEl.value = prof.fat;
}

function submitManualMealLogModal() {
  const user = DB.getCurrentUser();
  if (!user) return;
  const dishName = document.getElementById('manual-meal-name')?.value.trim();
  const mealType = document.getElementById('manual-meal-type')?.value || 'Bữa ăn';
  const calories = Math.max(0, Math.round(Number(document.getElementById('manual-meal-kcal')?.value) || 0));
  const protein = Math.max(0, Math.round(Number(document.getElementById('manual-meal-prot')?.value) || 0));
  const carbs = Math.max(0, Math.round(Number(document.getElementById('manual-meal-carb')?.value) || 0));
  const fat = Math.max(0, Math.round(Number(document.getElementById('manual-meal-fat')?.value) || 0));

  if (!dishName) {
    showToast('alertRegular', 'Vui lòng nhập tên món ăn!');
    return;
  }

  const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  DB.logNutritionEntryForUser(user.id, {
    id: 'nutri_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    time: nowTime,
    mealType,
    dishId: document.getElementById('manual-meal-preset')?.value || '',
    dishName,
    quantity: 1,
    calories,
    protein,
    carbs,
    fat,
    source: 'manual'
  }, getTodayDateKey());

  closeModal();
  showToast('checkmarkFilled', `Đã ghi nhận "${dishName}" (+${calories} kcal) vào nhật ký hôm nay!`);
  if (currentView === 'profile') renderProfileView();
}

// =========================================================================
// 7. ĐÁNH GIÁ MỨC ĐỘ PHÙ HỢP CÁ NHÂN TRÊN TRANG MÔ TẢ MẶT HÀNG (PDP BADGE)
// =========================================================================

function renderPersonalDishMatchBanner(dish, dynNutri) {
  if (typeof DB === 'undefined' || !DB.isReady) return '';
  const user = DB.getCurrentUser();
  if (!user) return '';

  const summary = getTodayNutritionSummary(user);
  const hp = summary.hp;
  const persona = getPersonaMeta(hp.personaType);
  const dailyGoal = Math.max(1, hp.dailyCalorieGoal);
  const eatenCal = summary.consumed.calories;
  const dishCal = dynNutri.calories;
  const totalAfter = eatenCal + dishCal;
  const isOver = totalAfter > dailyGoal;
  const afterRemaining = dailyGoal - totalAfter;

  const eatenPct = Math.min(100, Math.round((eatenCal / dailyGoal) * 100));
  const addPct = Math.min(Math.max(0, 100 - eatenPct), Math.round((dishCal / dailyGoal) * 100));
  const statusClass = isOver ? 'warn' : 'good';

  return `
    <div class="pdp-personal-match-bar ${statusClass}" onclick="event.stopPropagation(); openProfileView('nutrition')">
      <div class="ppm-content">
        <div class="ppm-top">
          <span>${persona.icon} <strong>${escapeHtml(user.name)}</strong>: Đã nạp <strong>${eatenCal}</strong> + <strong class="ppm-add-text">+${dishCal} kcal</strong> / ${dailyGoal} kcal</span>
        </div>
        <div class="ppm-progress-track">
          <div class="ppm-progress-base" style="width: ${eatenPct}%;" title="Đã nạp: ${eatenCal} kcal"></div>
          <div class="ppm-progress-add" style="width: ${addPct}%;" title="Món này tăng thêm: +${dishCal} kcal"></div>
        </div>
        <div class="ppm-verdict">
          <span>${isOver
      ? `⚠️ Sẽ vượt ${totalAfter - dailyGoal} kcal so với mục tiêu hôm nay`
      : `✓ Sau khi ăn còn ${afterRemaining} kcal trong ngân sách hôm nay`}</span>
          <span class="ppm-link">Quản lý Kcal →</span>
        </div>
      </div>
    </div>
  `;
}

// Export global survey modal functions
if (typeof window !== 'undefined') {
  window.openUserNutritionSurveyModal = openUserNutritionSurveyModal;
  window.renderUserNutritionSurveyModalContent = renderUserNutritionSurveyModalContent;
  window.saveActiveUserHealthPatch = saveActiveUserHealthPatch;
  window.quickSelectUserPersona = quickSelectUserPersona;
  window.quickToggleKeepFit = quickToggleKeepFit;
  window.quickAdjustUserWeight = quickAdjustUserWeight;
  window.quickSetUserWeight = quickSetUserWeight;
  window.quickSetUserHeight = quickSetUserHeight;
  window.quickSelectActivityLevel = quickSelectActivityLevel;
  window.quickToggleDietaryNote = quickToggleDietaryNote;
  window.setNutritionRecFilter = setNutritionRecFilter;
  window.adjustTodayWater = adjustTodayWater;
  window.quickLogDishEaten = quickLogDishEaten;
  window.quickAddRecommendedDishToCart = quickAddRecommendedDishToCart;
  window.removeTodayMealEntry = removeTodayMealEntry;
  window.updateProfileNutritionDashboardInPlace = updateProfileNutritionDashboardInPlace;
  window.updateSurveyModalInPlace = updateSurveyModalInPlace;
  try {
    Object.defineProperty(window, 'showInlineHealthSurvey', {
      get: () => isNutritionSurveyModalOpen,
      set: (val) => {
        if (val) openUserNutritionSurveyModal();
        else closeModal();
      },
      configurable: true
    });
  } catch (_) { }
}

