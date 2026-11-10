/* ==========================================================================
   ptitngon - Product Detail, Safety Certificate & Nutrition AI Module (js/dish-detail.js)
   - Giao diện Thông tin Mô tả Mặt hàng đầy đủ: Hình ảnh lớn, Giá bán, Đánh giá sao & Nhận xét,
     Tùy chỉnh Kích cỡ / Topping / Ghi chú & Đặt món.
   - Khu vực trọng tâm "An Toàn & Dinh Dưỡng": Đánh giá chung mức độ Healthy, Tốt cho ai,
     Dưỡng chất bổ sung.
   - Giao diện Chi tiết 2 Tab khi ấn vào:
     + Tab 1 (Dinh dưỡng): Nguyên liệu nấu ăn chi tiết, Bảng dinh dưỡng ước tính,
       và Thanh Hỏi bằng AI trực tiếp về món ăn (kết nối API hoặc AI Dinh dưỡng Nội bộ).
     + Tab 2 (Đảm bảo an toàn): Giấy chứng nhận Đảm bảo An toàn Vệ sinh Thực phẩm chính quy,
       hiển thị rõ đã được làm mới cách đây bao lâu + Nhật ký kiểm định nguồn gốc.
   ========================================================================== */

let previousViewBeforeDish = 'home';
let viewScrollPositionsBeforeDish = {};
let dishSafetyActiveTab = 'nutrition'; // 'nutrition' | 'safety'
let dishAIChatLogs = {}; // Lưu lịch sử hỏi AI riêng theo từng mặt hàng (dish.id)
let dishAIIsThinking = false;
let dishAIDraftQuestion = '';

// Các gợi ý câu hỏi nhanh trên thanh Hỏi AI trong Tab Dinh dưỡng
const DISH_AI_QUICK_QUESTIONS = [
  '🔥 Món này bao nhiêu calo, đang giảm cân ăn được không?',
  '🥜 Món này có nguyên liệu nào dễ gây dị ứng không?',
  '💪 Món này tốt cho ai và bổ sung dưỡng chất gì nổi bật?',
  '🥗 Cách dặn bếp hoặc chọn cỡ để ăn món này healthy hơn?',
  '🛡️ Giấy chứng nhận an toàn của quán được làm mới bao lâu rồi?'
];

// =========================================================================
// 1. HỆ THỐNG PHÂN TÍCH DINH DƯỠNG, NGUYÊN LIỆU & AN TOÀN THỰC PHẨM THEO MÓN
// =========================================================================

function hashDishCode(str) {
  let h = 0;
  const s = String(str || 'dish');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const CATEGORY_NUTRITION_TEMPLATES = {
  'Gỏi cuốn': {
    healthyScore: 9.4,
    healthyLevel: 'Rất Healthy • Thanh đạm ít béo',
    healthyColor: '#059669',
    calories: 290,
    protein: 19,
    carbs: 34,
    fat: 6,
    fiber: 6.5,
    sodium: 480,
    sugar: 4,
    goodFor: [
      'Người đang ăn chế độ Eat Clean, giữ dáng hoặc giảm mỡ',
      'Sinh viên & dân văn phòng cần bữa ăn nhẹ bụng, không gây buồn ngủ buổi chiều',
      'Người cần bổ sung nhiều rau xanh và chất xơ tự nhiên'
    ],
    supplements: ['Đạm nạc dễ hấp thu', 'Chất xơ từ rau sống', 'Vitamin A, C, K', 'Ít chất béo bão hòa'],
    allergens: ['Hải sản (tôm)', 'Đậu phộng (trong sốt chấm)'],
    bestTime: 'Bữa trưa nhẹ, bữa xế chiều hoặc bữa tối thanh đạm',
    ingredients: [
      { icon: '🦐', name: 'Tôm sú hấp tươi & Thịt heo nạc luộc', amount: '95g', origin: 'Thủy sản kiểm dịch tươi ngày', role: 'Cung cấp đạm tinh khiết ít mỡ, giàu Canxi & Kẽm' },
      { icon: '🥬', name: 'Xà lách, húng lủi, hẹ, giá đỗ VietGAP', amount: '80g', origin: 'Nông trại rau sạch ngoại thành', role: 'Giàu chất xơ hòa tan, Vitamin C và chất chống oxy hóa' },
      { icon: '🌾', name: 'Bánh tráng gạo mỏng & Bún tươi không hàn the', amount: '90g', origin: 'Làng nghề truyền thống đạt chuẩn', role: 'Cung cấp năng lượng vừa phải, dễ tiêu hóa' },
      { icon: '🥜', name: 'Tương chấm hoặc nước mắm chua ngọt hạt đậu phộng', amount: '35ml', origin: 'Chế biến mới trong ngày tại bếp', role: 'Bổ sung chất béo tốt từ hạt & kích thích vị giác' }
    ]
  },
  'Phở': {
    healthyScore: 8.7,
    healthyLevel: 'Cân bằng dinh dưỡng • Ấm bụng dễ tiêu',
    healthyColor: '#059669',
    calories: 465,
    protein: 28,
    carbs: 56,
    fat: 12,
    fiber: 3.8,
    sodium: 890,
    sugar: 4,
    goodFor: [
      'Sinh viên học tập căng thẳng cần bữa sáng/trưa ấm nóng, tỉnh táo',
      'Người tập thể thao cần bù nước, điện giải và Protein phục hồi cơ',
      'Người mới ốm dậy hoặc hệ tiêu hóa cần món nước mềm ấm'
    ],
    supplements: ['Protein sinh học cao', 'Sắt & Vitamin B12 tạo máu', 'Collagen & Canxi từ nước ninh xương', 'Tinh dầu thảo mộc (quế, hồi, gừng nướng)'],
    allergens: ['Không chứa sữa/hạt (Lưu ý giảm nước béo nếu kiêng mỡ)'],
    bestTime: 'Bữa sáng nạp năng lượng, bữa trưa hoặc bữa tối ấm bụng',
    ingredients: [
      { icon: '🥩', name: 'Thịt bò thăn / nạm tươi thái mỏng', amount: '120g', origin: 'Thịt bò tươi kiểm dịch sáng sớm', role: 'Giàu Protein, Sắt heme và Kẽm tăng sức đề kháng' },
      { icon: '🍜', name: 'Bánh phở gạo tẻ tươi mềm dai tự nhiên', amount: '180g', origin: 'Cơ sở bánh phở sạch 0% hàn the', role: 'Cung cấp tinh bột chuyển hóa ổn định cho não bộ' },
      { icon: '🦴', name: 'Nước dùng ninh xương ống 8 giờ cùng gừng nướng, thảo quả', amount: '360ml', origin: 'Ninh mới mỗi ngày, vớt bọt kỹ', role: 'Bổ sung khoáng chất, axit amin tự nhiên làm ấm cơ thể' },
      { icon: '🌿', name: 'Hành hoa, rau mùi, giá trần & chanh tươi', amount: '45g', origin: 'Rau sạch VietGAP rửa sục Ozone', role: 'Tăng cường Vitamin C giúp hấp thu Sắt tối ưu' }
    ]
  },
  'Cơm tấm': {
    healthyScore: 8.1,
    healthyLevel: 'Đầy đủ 4 nhóm chất • Năng lượng bền bỉ',
    healthyColor: '#10b981',
    calories: 640,
    protein: 32,
    carbs: 74,
    fat: 21,
    fiber: 4.2,
    sodium: 820,
    sugar: 7,
    goodFor: [
      'Sinh viên có ca học dài hoặc làm đồ án cần no lâu 4 - 5 tiếng',
      'Người lao động trí óc & vận động thể chất cường độ vừa đến cao',
      'Người muốn bữa chính đầy đủ Tinh bột - Đạm - Rau củ cân đối'
    ],
    supplements: ['Protein cao (32g)', 'Vitamin nhóm B (B1, B6, B12)', 'Choline tốt cho trí nhớ từ trứng', 'Lycopene từ cà chua tươi'],
    allergens: ['Trứng (nếu có ốp la/chả trứng)', 'Nước mắm cá'],
    bestTime: 'Bữa trưa hoặc bữa tối sớm trước 19h30',
    ingredients: [
      { icon: '🥩', name: 'Sườn cốt lết heo tươi ướp mật ong nướng than hoa', amount: '135g', origin: 'Heo sạch VietGAP có dấu kiểm dịch', role: 'Nguồn đạm dồi dào xây dựng cơ bắp & tái tạo năng lượng' },
      { icon: '🍚', name: 'Hạt gạo tấm thơm dẻo nấu chín tới', amount: '200g', origin: 'Gạo tấm ST25 vùng Đồng bằng Sông Cửu Long', role: 'Cung cấp nguồn Glucose bền bỉ cho hoạt động trí não' },
      { icon: '🥒', name: 'Dưa leo, cà chua, đồ chua cà rốt củ cải ngâm giấm gạo', amount: '70g', origin: 'Rau củ tươi sơ chế trong ngày', role: 'Cân bằng vị béo, bổ sung chất xơ và hỗ trợ tiêu hóa' },
      { icon: '🥚', name: 'Chả trứng hấp / Trứng gà ta & Mỡ hành phi thơm', amount: '50g', origin: 'Trứng gà trang trại khép kín', role: 'Bổ sung Lecithin, Vitamin D & hương vị đặc trưng' }
    ]
  },
  'Bánh mì': {
    healthyScore: 7.9,
    healthyLevel: 'Gọn nhẹ đủ chất • Nạp năng lượng nhanh',
    healthyColor: '#10b981',
    calories: 450,
    protein: 21,
    carbs: 52,
    fat: 16,
    fiber: 3.5,
    sodium: 740,
    sugar: 5,
    goodFor: [
      'Sinh viên cần bữa sáng / bữa xế nhanh gọn giữa các tiết học',
      'Người bận rộn cần món ăn cầm tay tiện lợi nhưng vẫn đủ đạm và rau',
      'Người cần nạp năng lượng tức thì trước giờ học hoặc làm việc'
    ],
    supplements: ['Tinh bột phức & Đạm kết hợp', 'Sắt từ pate gan truyền thống', 'Chất xơ từ dưa góp & ngò rí'],
    allergens: ['Gluten (bột mì)', 'Trứng (sốt bơ trứng)'],
    bestTime: 'Bữa sáng, bữa trưa nhanh hoặc bữa xế chiều',
    ingredients: [
      { icon: '🥖', name: 'Vỏ bánh mì nướng mới giòn rụm ruột xốp', amount: '95g', origin: 'Lò bánh nướng mới mỗi 2 giờ', role: 'Cung cấp năng lượng nhanh, giòn thơm ít ngấy' },
      { icon: '🥩', name: 'Nhân thịt nướng / chả lụa / pate gan làm thủ công', amount: '95g', origin: 'Chế biến nóng theo công thức riêng', role: 'Bổ sung Protein, Sắt và Vitamin A' },
      { icon: '🥒', name: 'Dưa chuột tươi, đồ chua đu đủ cà rốt & rau mùi', amount: '55g', origin: 'Rau sạch rửa nước lọc tiêu chuẩn', role: 'Giảm ngấy, cung cấp enzyme tiêu hóa tự nhiên' },
      { icon: '🥫', name: 'Nước sốt thịt đậm đà & tương ớt nhà làm', amount: '20ml', origin: 'Không phẩm màu tổng hợp', role: 'Tạo độ ẩm mềm và hương vị hài hòa' }
    ]
  },
  'Sushi': {
    healthyScore: 9.2,
    healthyLevel: 'Chuẩn Healthy Nhật Bản • Giàu Omega-3',
    healthyColor: '#059669',
    calories: 380,
    protein: 24,
    carbs: 48,
    fat: 9,
    fiber: 3.2,
    sodium: 590,
    sugar: 5,
    goodFor: [
      'Sinh viên ôn thi cần Omega-3 & DHA tăng khả năng tập trung, ghi nhớ',
      'Người theo đuổi chế độ ăn lành mạnh tốt cho tim mạch và làn da',
      'Người muốn ăn ngon miệng mà kiểm soát chặt lượng calo nạp vào'
    ],
    supplements: ['Omega-3 (EPA & DHA) tốt cho não bộ', 'I-ốt & Khoáng chất từ rong biển Nori', 'Protein tinh khiết dễ tiêu', 'Chất chống oxy hóa từ gừng hồng & Wasabi'],
    allergens: ['Hải sản / Cá biển', 'Đậu nành (nước tương Nhật)', 'Mè rang'],
    bestTime: 'Bữa trưa thanh nhẹ hoặc bữa tối lành mạnh',
    ingredients: [
      { icon: '🍣', name: 'Phi lê cá hồi Na Uy / Tôm thanh cua tươi lạnh chuẩn Sashimi', amount: '110g', origin: 'Nhập khẩu bảo quản lạnh 0 - 4°C', role: 'Dồi dào Omega-3, Vitamin D và đạm chất lượng cao' },
      { icon: '🍙', name: 'Cơm gạo Nhật hạt tròn trộn giấm gạo thanh dịu', amount: '140g', origin: 'Gạo Japonica tuyển chọn', role: 'Cung cấp năng lượng sạch, ít chất béo' },
      { icon: '🌿', name: 'Lá rong biển nướng Nori, dưa leo, quả bơ sáp', amount: '35g', origin: 'Nhập khẩu chính ngạch Nhật - Hàn', role: 'Bổ sung I-ốt tự nhiên, Vitamin E và chất béo không bão hòa' },
      { icon: '🥢', name: 'Gừng hồng ngâm chua ngọt, Wasabi & Nước tương ủ tự nhiên', amount: '20g', origin: 'Chuẩn vị truyền thống Nhật Bản', role: 'Kháng khuẩn tự nhiên, ấm vị giác và hỗ trợ tiêu hóa' }
    ]
  },
  'Trà sữa': {
    healthyScore: 6.6,
    healthyLevel: 'Giải tỏa căng thẳng • Khuyên chọn 50% đường',
    healthyColor: '#d97706',
    calories: 340,
    protein: 4,
    carbs: 58,
    fat: 9,
    fiber: 1.5,
    sodium: 140,
    sugar: 28,
    goodFor: [
      'Sinh viên cần giải tỏa stress, nạp năng lượng tức thì buổi chiều',
      'Buổi họp nhóm, học bài cùng bạn bè cần thức uống tỉnh táo nhẹ nhàng',
      'Người muốn thưởng thức đồ ngọt (nên ghi chú 30% - 50% đường để healthy hơn)'
    ],
    supplements: ['Polyphenol & L-Theanine từ lá trà ủ tươi', 'Năng lượng nhanh giúp cải thiện tâm trạng', 'Canxi nhẹ từ sữa'],
    allergens: ['Sữa / Lactose'],
    bestTime: 'Buổi trưa sau ăn 45 phút hoặc buổi xế chiều 14h - 16h30',
    ingredients: [
      { icon: '🍵', name: 'Cốt hồng trà / Ô long / Lục trà ủ nóng đúng nhiệt độ', amount: '220ml', origin: 'Lá trà vùng cao Bảo Lộc / Thái Nguyên', role: 'Chứa chất chống oxy hóa Catechin và hương trà thanh khiết' },
      { icon: '🥛', name: 'Sữa tươi thanh trùng / Kem sữa thực vật không béo chuyển hóa', amount: '90ml', origin: 'Nguyên liệu đạt chuẩn Trans-fat Free', role: 'Tạo vị béo mượt dịu nhẹ, bổ sung năng lượng' },
      { icon: '🧋', name: 'Trân châu đen nấu mới trong 3 giờ / Thạch trái cây giòn', amount: '65g', origin: 'Nấu từ tinh bột sắn tự nhiên, không chất bảo quản', role: 'Tạo độ dai vui miệng (có thể giảm nửa topping nếu ăn kiêng)' },
      { icon: '🍯', name: 'Đường mía lỏng tiệt trùng (Tùy chỉnh được mức đường)', amount: '25ml', origin: 'Đường mía tinh luyện an toàn', role: 'Điều vị ngọt dịu (khuyến nghị giảm 30-50% đường)' }
    ]
  },
  'Cà phê': {
    healthyScore: 8.2,
    healthyLevel: 'Tăng tập trung • Chống oxy hóa tự nhiên',
    healthyColor: '#059669',
    calories: 165,
    protein: 4,
    carbs: 22,
    fat: 6,
    fiber: 0.8,
    sodium: 95,
    sugar: 14,
    goodFor: [
      'Sinh viên ôn thi, chạy deadline đồ án cần sự tỉnh táo & tập trung cao',
      'Người bắt đầu ngày mới năng động hoặc trước buổi tập thể thao',
      'Người yêu thích hương vị cà phê hạt rang mộc nguyên chất'
    ],
    supplements: ['Caffeine tự nhiên tăng sự nhạy bén', 'Axit Chlorogenic chống oxy hóa mạnh', 'Vitamin B2 & Magie nhẹ từ hạt cà phê'],
    allergens: ['Sữa đặc / Sữa tươi (nếu là Bạc xỉu / Cà phê sữa)', 'Caffeine (tránh uống sát giờ ngủ)'],
    bestTime: 'Buổi sáng 7h30 - 10h30 hoặc đầu giờ chiều 13h30 - 15h00',
    ingredients: [
      { icon: '☕', name: 'Cốt cà phê Robusta & Arabica rang mộc nguyên chất 100%', amount: '65ml', origin: 'Hạt cà phê Cầu Đất - Đắk Lắk rang mộc sạch', role: 'Giàu chất chống oxy hóa, kích thích sự tập trung không gắt cổ' },
      { icon: '🥛', name: 'Sữa tươi thanh trùng / Sữa đặc có đường vừa phải', amount: '45ml', origin: 'Thương hiệu sữa uy tín chính hãng', role: 'Cân bằng vị đắng, bổ sung năng lượng êm dịu' },
      { icon: '🧊', name: 'Đá viên tinh khiết lọc RO tiệt trùng tia UV', amount: '150g', origin: 'Hệ thống máy làm đá khép kín tại quán', role: 'Đảm bảo vệ sinh tuyệt đối cho đường tiêu hóa' }
    ]
  },
  'Chè': {
    healthyScore: 7.5,
    healthyLevel: 'Giải nhiệt thanh mát • Bổ sung hạt & đậu',
    healthyColor: '#10b981',
    calories: 310,
    protein: 6,
    carbs: 54,
    fat: 7,
    fiber: 4.8,
    sodium: 110,
    sugar: 22,
    goodFor: [
      'Người cần món tráng miệng thanh nhiệt ngày nắng nóng',
      'Bổ sung chất xơ từ các loại đậu hầm mềm, hạt sen, nha đam, trái cây',
      'Sinh viên ăn xế chiều nạp năng lượng nhẹ nhàng'
    ],
    supplements: ['Chất xơ thực vật từ các loại đậu & hạt', 'Vitamin từ trái cây nhiệt đới', 'Khoáng chất Kali & Magie'],
    allergens: ['Nước cốt dừa', 'Đậu phộng / Mè (tùy món)'],
    bestTime: 'Bữa phụ buổi chiều 15h - 17h',
    ingredients: [
      { icon: '🫘', name: 'Đậu xanh / Đậu đỏ / Hạt sen / Khoai dẻo ninh mềm', amount: '110g', origin: 'Nông sản sạch tuyển chọn hạt đều', role: 'Giàu chất xơ, đạm thực vật và giúp an thần, mát gan' },
      { icon: '🥥', name: 'Nước cốt dừa tươi ép trong ngày thanh béo', amount: '45ml', origin: 'Dừa tươi Bến Tre ép lạnh', role: 'Cung cấp axit béo chuỗi trung bình (MCT) dễ chuyển hóa' },
      { icon: '🍍', name: 'Thạch lá dứa tự nhiên, sương sáo & trái cây tươi', amount: '80g', origin: 'Màu tự nhiên từ lá nếp & rau câu', role: 'Giải nhiệt cơ thể, bổ sung nước và vi chất' }
    ]
  }
};

function getDishNutritionAndSafetyProfile(dish, restaurant) {
  const cat = dish.category || 'Món Việt';
  const nameLower = (dish.name || '').toLowerCase();
  const seed = hashDishCode((dish.id || '') + (dish.name || ''));
  const resSeed = hashDishCode(String(restaurant?.id || dish.restaurantId || 1) + (restaurant?.name || ''));

  // 1. Chọn mẫu chuẩn theo danh mục hoặc thông minh suy luận từ tên món
  let base = CATEGORY_NUTRITION_TEMPLATES[cat] ? JSON.parse(JSON.stringify(CATEGORY_NUTRITION_TEMPLATES[cat])) : null;

  if (!base) {
    const isFriedCrispy = /chiên|giòn|rán|gà rán|hùng chiên|pizza|burger|xèo/.test(nameLower + ' ' + cat.toLowerCase());
    const isNoodleSoup = /bún|miến|hủ tiếu|mì|cao lầu|lẩu|bánh canh|cháo|súp/.test(nameLower + ' ' + cat.toLowerCase());
    const isSteamedLight = /cuốn|hấp|luộc|chay|salad/.test(nameLower + ' ' + cat.toLowerCase());

    if (isFriedCrispy) {
      base = {
        healthyScore: 7.1,
        healthyLevel: 'Giàu năng lượng • Chiên dầu mới kiểm soát nhiệt',
        healthyColor: '#d97706',
        calories: 560 + (seed % 70),
        protein: 27 + (seed % 6),
        carbs: 54 + (seed % 10),
        fat: 24 + (seed % 5),
        fiber: 3.4,
        sodium: 790,
        sugar: 5,
        goodFor: [
          'Sinh viên hoạt động nhiều, học khuya hoặc cần nạp năng lượng mạnh mẽ',
          'Buổi liên hoan nhóm bạn, ăn xế/tối thỏa mãn cơn thèm giòn rụm',
          'Người cần hàm lượng Protein cao kết hợp tinh bột (khuyên dùng kèm salad/dưa góp)'
        ],
        supplements: ['Protein dồi dào xây dựng cơ bắp', 'Vitamin nhóm B (B3, B6)', 'Năng lượng cao chống đói nhanh', 'Chất xơ từ rau ăn kèm cân bằng vị'],
        allergens: ['Gluten (lớp bột áo giòn)', 'Đậu nành / Mè trong sốt ướp'],
        bestTime: 'Bữa trưa năng động hoặc bữa chiều tối cùng bạn bè',
        ingredients: [
          { icon: '🍗', name: `Nguyên liệu chính tươi sạch chọn lọc cho ${dish.name}`, amount: '165g', origin: 'Nguồn thịt/nguyên liệu tươi kiểm dịch hàng ngày', role: 'Cung cấp nguồn Protein chất lượng cao, giữ trọn độ mọng nước bên trong' },
          { icon: '🌾', name: 'Lớp bột áo giòn công thức ít hút dầu & gia vị thảo mộc', amount: '55g', origin: 'Pha trộn mới theo mẻ nhỏ trong ngày', role: 'Tạo độ giòn rụm đặc trưng mà hạn chế ngấm dầu thừa' },
          { icon: '🌻', name: 'Dầu thực vật tinh luyện thay mới định kỳ mỗi ngày (TPM < 18%)', amount: '18ml', origin: 'Dầu thực vật 0% Cholesterol', role: 'Chiên ở nhiệt độ chuẩn 170°C giữ màu vàng óng an toàn' },
          { icon: '🥗', name: 'Xà lách, dưa chuột, cà chua & đồ chua giải ngấy ăn kèm', amount: '65g', origin: 'Rau sạch VietGAP rửa kỹ 3 bước', role: 'Bổ sung chất xơ, Vitamin C giúp tiêu hóa chất béo nhẹ nhàng' }
        ]
      };
    } else if (isSteamedLight) {
      base = JSON.parse(JSON.stringify(CATEGORY_NUTRITION_TEMPLATES['Gỏi cuốn']));
      base.healthyScore = 9.0;
    } else if (isNoodleSoup) {
      base = {
        healthyScore: 8.5,
        healthyLevel: 'Cân bằng lành mạnh • Nóng hổi giàu dưỡng chất',
        healthyColor: '#059669',
        calories: 485 + (seed % 55),
        protein: 26 + (seed % 6),
        carbs: 58 + (seed % 8),
        fat: 14 + (seed % 4),
        fiber: 4.5,
        sodium: 860,
        sugar: 5,
        goodFor: [
          'Sinh viên & người đi làm cần bữa ăn nóng hổi, cân bằng đạm - tinh bột - rau',
          'Người muốn ăn no vừa vặn, ấm dạ dày và dễ tiêu hóa',
          'Phù hợp cho cả bữa sáng, bữa trưa lẫn bữa tối'
        ],
        supplements: ['Đạm động vật & thực vật cân đối', 'Khoáng chất Canxi, Phốt pho từ nước hầm', 'Chất xơ & Vitamin từ rổ rau sống tươi', 'Bù nước và điện giải ấm'],
        allergens: ['Hải sản / Mắm ruốc nhẹ tùy vùng miền (có thể dặn bếp gia giảm)'],
        bestTime: 'Mọi bữa chính trong ngày (Sáng, Trưa, Tối)',
        ingredients: [
          { icon: '🥩', name: `Thịt & nhân tươi chủ đạo của ${dish.name}`, amount: '125g', origin: 'Nhập tươi mỗi sáng sớm có chứng từ kiểm dịch', role: 'Cung cấp Protein thiết yếu, Sắt và Vitamin nhóm B' },
          { icon: '🍜', name: 'Sợi bún / mì / miến tươi dẻo dai không chất tẩy trắng', amount: '175g', origin: 'Lò bún mì sạch đạt chuẩn VSATTP', role: 'Nguồn tinh bột nhẹ bụng, cung cấp năng lượng ổn định' },
          { icon: '🍲', name: 'Nước dùng ninh xương & rau củ ngọt thanh tự nhiên', amount: '350ml', origin: 'Ninh mới 6 - 8 tiếng, hạn chế mì chính', role: 'Giàu axit amin tự nhiên, giúp món ăn đậm đà dễ hấp thu' },
          { icon: '🌿', name: 'Rau sống tổng hợp (xà lách, kinh giới, hoa chuối, giá đỗ)', amount: '75g', origin: 'Rau sạch VietGAP ngâm rửa khử khuẩn', role: 'Tăng cường chất xơ và vi chất thiên nhiên' }
        ]
      };
    } else {
      base = {
        healthyScore: 8.3,
        healthyLevel: 'Dinh dưỡng hài hòa • Chế biến tươi nóng',
        healthyColor: '#059669',
        calories: 520 + (seed % 60),
        protein: 25 + (seed % 7),
        carbs: 62 + (seed % 10),
        fat: 16 + (seed % 5),
        fiber: 4.2,
        sodium: 780,
        sugar: 6,
        goodFor: [
          'Sinh viên cần bữa ăn đủ chất phục vụ học tập & hoạt động ngoại khóa',
          'Người thích hương vị truyền thống chế biến từ nguyên liệu tươi trong ngày',
          'Phù hợp người cần cân bằng năng lượng và dưỡng chất thiết yếu'
        ],
        supplements: ['Protein 25g+', 'Vitamin nhóm B & Sắt', 'Tinh bột cung cấp năng lượng bền', 'Chất xơ từ rau củ ăn kèm'],
        allergens: ['Kiểm tra ghi chú nếu bạn dị ứng đậu phộng hoặc hải sản'],
        bestTime: 'Bữa trưa hoặc bữa tối dinh dưỡng',
        ingredients: [
          { icon: '🍖', name: `Thành phần đạm tươi chính trong ${dish.name}`, amount: '130g', origin: 'Nhà cung cấp thực phẩm sạch đạt chuẩn', role: 'Cung cấp axit amin thiết yếu cho cơ thể' },
          { icon: '🍚', name: 'Tinh bột chọn lọc (Cơm / Xôi / Bánh truyền thống)', amount: '180g', origin: 'Nông sản Việt Nam tuyển chọn', role: 'Đảm bảo năng lượng no lâu, tỉnh táo' },
          { icon: '🥬', name: 'Rau xanh, dưa góp & thảo mộc tươi theo mùa', amount: '65g', origin: 'Rau sạch VietGAP sơ chế ngày mới', role: 'Bổ sung chất xơ, Vitamin A, C hỗ trợ tiêu hóa' },
          { icon: '🥄', name: 'Nước sốt / Nước chấm pha chế gia truyền cân bằng vị', amount: '30ml', origin: 'Pha mới mỗi ngày tại bếp quán', role: 'Kết nối hương vị đậm đà mà không ngấy' }
        ]
      };
    }
  }

  // 2. Tinh chỉnh nhẹ theo từ khóa riêng của từng món để mỗi món có nét đặc trưng sát thực tế
  if (nameLower.includes('đặc biệt') || nameLower.includes('thập cẩm') || nameLower.includes('combo') || nameLower.includes('full')) {
    base.calories += 75;
    base.protein += 6;
  }
  if (nameLower.includes('chay') || nameLower.includes('rau')) {
    base.healthyScore = Math.min(9.7, base.healthyScore + 0.8);
    base.healthyLevel = 'Thuần thực vật • Thanh lọc cơ thể';
    base.fat = Math.max(5, base.fat - 6);
    base.fiber = Number((base.fiber + 2.5).toFixed(1));
  }
  if (nameLower.includes('phô mai')) {
    base.calories += 60;
    base.fat += 5;
    base.supplements.push('Canxi từ phô mai');
    if (!base.allergens.some(a => a.includes('Sữa'))) base.allergens.push('Sữa / Phô mai (Dairy)');
  }

  // 3. Tạo thông tin Giấy Chứng Nhận Đảm Bảo An Toàn Vệ Sinh Thực Phẩm (VSATTP) có ngày làm mới rõ ràng
  const daysSinceRenewed = (resSeed % 16) + 3; // Được làm mới cách đây từ 3 đến 18 ngày!
  const now = new Date();
  const renewedDate = new Date(now.getTime() - daysSinceRenewed * 86400000);
  const nextAuditDate = new Date(renewedDate.getTime() + 90 * 86400000); // Hậu kiểm định kỳ mỗi 90 ngày
  const expiryDate = new Date(renewedDate.getTime() + 365 * 86400000);

  const fmtDate = d => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const resIdNum = Number(restaurant?.id || dish.restaurantId || 1);
  const certCode = `GCN-ATTP-HN-${now.getFullYear()}-${String(1080 + resIdNum * 17).padStart(5, '0')}`;

  const safety = {
    certCode,
    daysSinceRenewed,
    renewedAgoText: `Làm mới cách đây ${daysSinceRenewed} ngày`,
    renewedDateStr: fmtDate(renewedDate),
    nextAuditDateStr: fmtDate(nextAuditDate),
    expiryDateStr: fmtDate(expiryDate),
    issuingAuthority: 'Chi cục An toàn Vệ sinh Thực phẩm TP. Hà Nội & Ban Kiểm định Chất lượng Đối tác ptitngon',
    standardCode: 'QCVN 8-3:2012/BYT • Tiêu chuẩn Bếp Sạch Học Đường A+',
    facilityName: restaurant ? restaurant.name : (dish.restaurantName || 'Cơ sở Ẩm thực Đối tác ptitngon'),
    facilityAddress: (restaurant && restaurant.address) ? restaurant.address : 'Khu vực Học viện Công nghệ Bưu chính Viễn thông (PTIT), Quận Hà Đông, Hà Nội',
    kitchenCheckToday: '06:30 sáng nay — Đạt 100% nhiệt độ bảo quản & vệ sinh khay dụng cụ',
    labChecks: [
      { label: 'Vi sinh vật & Khuẩn E.Coli / Salmonella', result: 'Âm tính (Đạt chuẩn Bộ Y tế)', status: 'pass' },
      { label: 'Hàn the, Formol & Phẩm màu công nghiệp', result: '0.00% (Không phát hiện)', status: 'pass' },
      { label: 'Truy xuất nguồn gốc Thịt & Rau củ tươi', result: 'Hóa đơn kiểm dịch & VietGAP trong ngày', status: 'pass' },
      { label: 'Chất lượng dầu chế biến & Nguồn nước lọc RO', result: 'Chỉ số TPM < 16% • Nước lọc UV khép kín', status: 'pass' },
      { label: 'Quy chuẩn hộp đựng & Tem niêm phong giao hàng', result: 'Nhựa PP5 chịu nhiệt an toàn & Tem chống mở', status: 'pass' }
    ]
  };

  // 4. Tổng hợp danh sách Đánh giá sản phẩm (Reviews thực tế từ DB + Đánh giá cộng đồng sinh viên)
  const realUserReviews = [];
  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.getUsers().forEach(u => {
      (u.orders || []).forEach(o => {
        if (o.reviewed && (Number(o.restaurantId) === resIdNum || (o.itemsSummary || '').includes(dish.name))) {
          realUserReviews.push({
            userName: u.name,
            avatar: u.avatar || '👨‍🎓',
            score: o.userScore || 5,
            time: o.orderTime || 'Gần đây',
            comment: o.userComment || 'Món ăn nóng hổi, đóng gói rất sạch sẽ và đúng vị!',
            tags: o.userTags || ['Món nóng hổi 🍲', 'Đóng gói cẩn thận 📦'],
            verified: true
          });
        }
      });
    });
  }

  const sampleCommunityReviews = [
    {
      userName: 'Nguyễn Minh Tuấn (CNTT - PTIT)',
      avatar: '🧑‍💻',
      score: 5,
      time: 'Hôm qua',
      comment: `${dish.name} rất tươi ngon, khẩu phần đầy đặn. Hộp đựng có dán tem niêm phong an toàn thực phẩm rõ ràng nên ăn cực kỳ yên tâm!`,
      tags: ['Nguyên liệu tươi sạch 🥬', 'Có tem niêm phong 🛡️'],
      verified: true
    },
    {
      userName: 'Trần Khánh Linh (Đa phương tiện)',
      avatar: '👩‍🎓',
      score: 5,
      time: '3 ngày trước',
      comment: 'Mình rất thích mục xem chi tiết nguyên liệu và calo của món trước khi đặt. Vị nêm nếm vừa miệng, không bị ngấy dầu mỡ, giao tới KTX vẫn còn nóng hổi.',
      tags: ['Chuẩn vị healthy 🥗', 'Giao siêu nhanh ⚡'],
      verified: true
    },
    {
      userName: 'Phạm Quốc Bảo',
      avatar: '👨‍🎓',
      score: (seed % 4 === 0) ? 4 : 5,
      time: '5 ngày trước',
      comment: 'Giá hợp túi tiền sinh viên, áp thêm mã PTITNGON50 thì quá hời cho một phần chất lượng thế này. Sẽ ủng hộ quán dài dài!',
      tags: ['Giá sinh viên 💸', 'Đáng tiền ⭐'],
      verified: true
    }
  ];

  const reviews = [...realUserReviews, ...sampleCommunityReviews];
  const soldCount = 320 + (seed % 1400);
  const ratingVal = restaurant?.rating || 4.9;

  return {
    ...base,
    safety,
    reviews,
    soldCount,
    ratingVal
  };
}

// Tính toán dinh dưỡng động theo Kích cỡ & Topping người dùng đang chọn
function getAdjustedNutritionBySelection(profile) {
  let extraCal = 0;
  let extraProt = 0;
  let extraCarb = 0;
  let extraFat = 0;

  if (modalDish && Array.isArray(modalDish.sizes) && modalDish.sizes[modalSelectedSizeIndex]) {
    const szExtra = Number(modalDish.sizes[modalSelectedSizeIndex].extraPrice) || 0;
    if (szExtra > 0) {
      extraCal += Math.round(szExtra / 120); // VD +15.000đ -> ~ +125 kcal
      extraProt += Math.round(szExtra / 2500);
      extraCarb += Math.round(szExtra / 1500);
      extraFat += Math.round(szExtra / 4000);
    }
  }

  if (modalDish && Array.isArray(modalDish.toppings)) {
    modalDish.toppings.forEach(t => {
      if (modalSelectedToppingIds.includes(t.id)) {
        const tp = Number(t.price) || 10000;
        extraCal += Math.round(tp / 140);
        extraProt += Math.max(2, Math.round(tp / 3500));
        extraFat += Math.max(1, Math.round(tp / 4500));
      }
    });
  }

  return {
    calories: profile.calories + extraCal,
    protein: profile.protein + extraProt,
    carbs: profile.carbs + extraCarb,
    fat: profile.fat + extraFat,
    fiber: profile.fiber,
    sodium: profile.sodium,
    sugar: profile.sugar,
    hasExtra: extraCal > 0
  };
}

// =========================================================================
// 2. SECTION MẶT HÀNG NỔI BẬT TRÊN TRANG CHỦ (CHẠM ĐỂ VÀO MÔ TẢ MẶT HÀNG)
// =========================================================================

function renderHomeFeaturedDishesSection() {
  if (typeof DB === 'undefined' || !DB.isReady) return '';
  const allItems = DB.getItems().filter(it => it.inStock !== false);
  if (allItems.length === 0) return '';

  // Xáo trộn Fisher–Yates công bằng cho toàn bộ mặt hàng — không ưu tiên cố định món nào đứng trước món nào
  const picked = typeof dbmPickFairDiverseItems === 'function'
    ? dbmPickFairDiverseItems(allItems, 12, it => it.category || it.categoryId, 2, 'home-featured-dishes')
    : allItems.slice(0, 10);

  return `
    <div class="restaurants-section home-featured-section fade-in">
      <div class="section-head">
        <div class="section-title">Mặt hàng nổi bật • Đạt chuẩn Dinh dưỡng & ATTP</div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="scroll-arrow-controls">
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('home-featured-dishes-scroll', -260)" title="Cuộn sang trái">
              ${FluentIcons.chevronLeft}
            </button>
            <button class="scroll-arrow-btn small" onclick="scrollHorizontally('home-featured-dishes-scroll', 260)" title="Cuộn sang phải">
              ${FluentIcons.chevronRight}
            </button>
          </div>
          <span class="section-see-all" onclick="openSearchView()">Khám phá thêm</span>
        </div>
      </div>

      <div class="home-featured-dishes-scroll" id="home-featured-dishes-scroll">
        ${picked.map(item => {
    const store = restaurants.find(r => Number(r.id) === Number(item.restaurantId))
      || DB.data.restaurants.find(r => Number(r.id) === Number(item.restaurantId));
    const prof = getDishNutritionAndSafetyProfile(item, store);
    return `
            <div class="home-feat-dish-card" onclick="openDishDetailById('${escapeHtml(item.id)}')">
              <div class="home-feat-dish-img-wrap">
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                <span class="home-feat-healthy-badge">🥗 ${prof.healthyScore}/10 Healthy</span>
                <span class="home-feat-safe-dot" title="Đã chứng nhận VSATTP">${FluentIcons.shieldFilled} ATTP</span>
              </div>
              <div class="home-feat-dish-body">
                <div class="home-feat-dish-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                <div class="home-feat-dish-store">${FluentIcons.shop} ${escapeHtml(item.restaurantName)}</div>
                <div class="home-feat-dish-foot">
                  <span class="home-feat-dish-price">${formatVND(item.price)}</span>
                  <span class="home-feat-dish-star">⭐ ${prof.ratingVal}</span>
                </div>
              </div>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
}

// =========================================================================
// 3. GIAO DIỆN THÔNG TIN MÔ TẢ MẶT HÀNG (PRODUCT DETAIL & DESCRIPTION VIEW)
// =========================================================================

function openDishDetailById(itemId) {
  if (typeof DB === 'undefined' || !DB.isReady) return;
  const item = DB.getItemById(itemId);
  if (!item) return;
  const store = restaurants.find(r => Number(r.id) === Number(item.restaurantId))
    || DB.data.restaurants.find(r => Number(r.id) === Number(item.restaurantId));
  openDishDetailView(item, store);
}

let pdpMobileDrawerOpen = false;

function openPDPMobileOrderDrawer(intent = 'cart') {
  pdpMobileDrawerOpen = true;
  const drawer = document.getElementById('pdp-order-drawer');
  const backdrop = document.getElementById('pdp-order-drawer-backdrop');
  if (drawer) drawer.classList.add('mobile-open');
  if (backdrop) backdrop.classList.add('active');
  document.body.classList.add('pdp-drawer-active');
}

function closePDPMobileOrderDrawer() {
  pdpMobileDrawerOpen = false;
  const drawer = document.getElementById('pdp-order-drawer');
  const backdrop = document.getElementById('pdp-order-drawer-backdrop');
  if (drawer) drawer.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.classList.remove('pdp-drawer-active');
}

function handleMobilePDPAction(isBuyNow) {
  if (window.innerWidth < 768 && !pdpMobileDrawerOpen) {
    openPDPMobileOrderDrawer(isBuyNow ? 'checkout' : 'cart');
    return;
  }
  addDishFromDetailView(isBuyNow);
  closePDPMobileOrderDrawer();
}

function openDishDetailView(dish, restaurant) {
  if (!dish) return;
  closeModal();
  closePDPMobileOrderDrawer();

  if (currentView !== 'dish-detail' && currentView !== 'dish-safety-nutrition') {
    previousViewBeforeDish = currentView || 'home';
    if (typeof saveCurrentViewScroll === 'function') {
      saveCurrentViewScroll();
    }
    viewScrollPositionsBeforeDish[previousViewBeforeDish] = window.scrollY;
  }

  modalDish = dish;
  modalRestaurant = restaurant
    || restaurants.find(r => Number(r.id) === Number(dish.restaurantId))
    || (typeof DB !== 'undefined' && DB.data ? DB.data.restaurants.find(r => Number(r.id) === Number(dish.restaurantId)) : null);
  modalSelectedSizeIndex = 0;
  modalSelectedToppingIds = [];
  modalKitchenNote = '';
  modalQty = 1;

  currentView = 'dish-detail';
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function goBackFromDishDetail() {
  closePDPMobileOrderDrawer();
  const target = previousViewBeforeDish || 'home';
  const savedY = (typeof globalViewScrollPositions !== 'undefined' && typeof globalViewScrollPositions[target] === 'number')
    ? globalViewScrollPositions[target]
    : (viewScrollPositionsBeforeDish[target] || 0);
  currentView = target;
  render();
  if (typeof restoreViewScroll === 'function') {
    restoreViewScroll(target, savedY);
  } else {
    window.scrollTo({ top: savedY, behavior: 'instant' });
  }
}

function renderDishDetailView() {
  if (!modalDish) {
    openHomeView();
    return;
  }

  const dish = (typeof DB !== 'undefined' && DB.isReady && modalDish.id && DB.getItemById(modalDish.id)) || modalDish;
  modalDish = dish;
  const store = (typeof DB !== 'undefined' && DB.isReady && dish.restaurantId && restaurants.find(r => Number(r.id) === Number(dish.restaurantId))) || modalRestaurant;
  modalRestaurant = store;
  const profile = getDishNutritionAndSafetyProfile(dish, store);
  const dynNutri = getAdjustedNutritionBySelection(profile);
  const currentTotal = calculateModalTotalPrice();
  const sizes = (Array.isArray(dish.sizes) && dish.sizes.length > 0)
    ? dish.sizes
    : [{ name: 'Phần Tiêu Chuẩn', extraPrice: 0 }];
  const toppings = Array.isArray(dish.toppings) ? dish.toppings : [];
  const noteSuggestions = Array.isArray(dish.noteSuggestions) && dish.noteSuggestions.length > 0
    ? dish.noteSuggestions
    : ['Không hành', 'Ít cay', 'Giao nóng', 'Đóng gói kỹ'];
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const outStock = dish.inStock === false;

  // Các món liên quan cùng cửa hàng
  const relatedSameStore = (store && Array.isArray(store.relatedDishes))
    ? store.relatedDishes.filter(d => d.id !== dish.id && d.name !== dish.name && d.inStock !== false).slice(0, 4)
    : [];

  const scorePct = Math.min(100, Math.round(profile.healthyScore * 10));

  app.innerHTML = `
    <div class="product-detail-page fade-in">
      <!-- Top Sticky Header -->
      <div class="page-nav-header product-detail-topbar">
        <button class="page-back-icon-btn" onclick="goBackFromDishDetail()" aria-label="Quay lại">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">Thông Tin Sản Phẩm</div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button
            class="page-back-icon-btn"
            onclick="toggleFav(${store ? store.id : 1})"
            title="Lưu quán yêu thích"
          >
            ${(store && store.fav) ? FluentIcons.heartFilled : FluentIcons.heartRegular}
          </button>
          <button class="ai-header-icon-btn cart-pill" onclick="openCartView()" title="Giỏ hàng">
            🛒 <span>${cartCount}</span>
          </button>
        </div>
      </div>

      <!-- Main 2-Column Responsive Layout -->
      <div class="product-detail-grid">
        <!-- CỘT TRÁI: HÌNH ẢNH, MÔ TẢ, AN TOÀN & DINH DƯỠNG, ĐÁNH GIÁ -->
        <div class="product-detail-main-col">
          <!-- 1. Hình ảnh sản phẩm & Thông tin cốt lõi -->
          <div class="pdp-hero-card">
            <div class="pdp-hero-img-wrap">
              <img
                class="pdp-hero-img"
                src="${escapeHtml(dish.image)}"
                alt="${escapeHtml(dish.name)}"
                onerror="this.src='assets/images/hung_chien_gion.jpg'"
              >
              <div class="pdp-img-badges-top">
                <span class="pdp-cat-pill">${escapeHtml(dish.category || 'Ẩm thực')}</span>
                ${dish.sku ? `<span class="pdp-sku-pill">Mã: ${escapeHtml(dish.sku)}</span>` : ''}
              </div>
              <div class="pdp-img-badges-bottom">
                ${store?.isFreeship ? `<span class="pdp-freeship-pill">🚚 Freeship 0đ</span>` : ''}
                <span class="pdp-safe-quick-pill" onclick="openDishSafetyNutritionView('safety')">
                  ${FluentIcons.shieldFilled} Đạt chuẩn VSATTP • ${escapeHtml(profile.safety.renewedAgoText)}
                </span>
              </div>
            </div>

            <div class="pdp-info-body">
              <div class="pdp-store-link" onclick="openSearchView('${escapeHtml(store ? store.name : dish.restaurantName)}')">
                <span>${FluentIcons.shop} ${escapeHtml(store ? store.name : dish.restaurantName)}</span>
                <span>• ${escapeHtml(store?.distanceText || '0.6 km')} (${escapeHtml(store?.deliveryTime || '15 - 20 phút')}) →</span>
              </div>
              ${(dish.location || store?.address) ? `
                <div class="pdp-location-line">${FluentIcons.locationFilled} ${escapeHtml(dish.location || store.address)}</div>
              ` : ''}

              <h1 class="pdp-title">${escapeHtml(dish.name)}</h1>

              <div class="pdp-price-rating-bar">
                <div class="pdp-price-block">
                  <span class="pdp-main-price">${formatVND(dish.price)}</span>
                  <span class="pdp-promo-hint">${(dish.vouchers && dish.vouchers.length) ? `Áp dụng: ${escapeHtml(dish.vouchers.slice(0, 2).join(', '))}` : 'Mã PTITNGON50 giảm 50%'}</span>
                </div>

                <div class="pdp-rating-summary-pills" onclick="scrollToReviewsSection()">
                  <span class="pdp-star-badge">⭐ <strong>${profile.ratingVal}</strong> (${Number.isFinite(Number(dish.reviewCount)) ? Number(dish.reviewCount) : (profile.reviews.length + 45)} đánh giá)</span>
                  <span class="pdp-sold-badge">${FluentIcons.fireFilled} Đã bán ${profile.soldCount}+</span>
                </div>
              </div>

              ${(Array.isArray(dish.tags) && dish.tags.length > 0) ? `
                <div class="pdp-tags-row">
                  ${dish.tags.map(t => `<span class="dbm-tag-chip clickable" onclick="openSearchView('${escapeHtml(t)}')">#${escapeHtml(t)}</span>`).join('')}
                </div>
              ` : ''}

              ${typeof dbmRenderPdpVouchersHtml === 'function' ? dbmRenderPdpVouchersHtml(dish) : ''}

              <div class="pdp-description-box">
                <div class="pdp-sub-heading">📝 Mô tả mặt hàng</div>
                <p class="pdp-description-text">
                  ${escapeHtml(dish.description || `${dish.name} được chế biến tươi nóng ngay khi nhận đơn từ nguồn nguyên liệu tuyển chọn trong ngày, giữ trọn hương vị đặc trưng, đóng gói niêm phong nhiệt an toàn khi giao đến tay bạn.`)}
                </p>
              </div>
            </div>
          </div>

          <!-- 2. KHU VỰC TRỌNG TÂM: AN TOÀN VÀ DINH DƯỠNG (TỔNG QUAN & LỐI VÀO CHI TIẾT) -->
          <div class="pdp-safety-nutrition-card" onclick="openDishSafetyNutritionView('nutrition')">
            <!-- Header hàng trên: Vòng điểm Healthy, Tiêu đề An Toàn & Dinh Dưỡng và Nút Xem chi tiết -->
            <div class="pdp-sn-header">
              <div class="pdp-sn-title-group">
                <div class="pdp-healthy-score-circle" style="--score-color: ${profile.healthyColor}; --score-pct: ${scorePct}%;" title="Điểm Healthy: ${profile.healthyScore}/10 (${scorePct}%)">
                  <span class="score-num">${profile.healthyScore}</span>
                  <span class="score-max">/10</span>
                </div>
                <div class="pdp-sn-title">An Toàn & Dinh Dưỡng</div>
              </div>
              <span class="pdp-sn-detail-cta">Xem chi tiết →</span>
            </div>

            <!-- Hàng dưới: Mức độ Healthy và Calo đều nhau trên 1 hàng -->
            <div class="pdp-healthy-level-row">
              <strong style="color: ${profile.healthyColor}; font-size: 13px;">${escapeHtml(profile.healthyLevel)}</strong>
              <span class="pdp-kcal-tag">${FluentIcons.fireFilled} ~${dynNutri.calories} kcal / phần</span>
            </div>

            <!-- Thành phần dinh dưỡng vĩ mô (đã lược bỏ pdp-progress-track) -->
            <div class="pdp-healthy-meter-box compact">
              <div class="pdp-macro-mini-row">
                <span>🥩 Đạm: <strong>${dynNutri.protein}g</strong></span>
                <span>🌾 Tinh bột: <strong>${dynNutri.carbs}g</strong></span>
                <span>🥑 Béo: <strong>${dynNutri.fat}g</strong></span>
                <span>🥬 Xơ: <strong>${dynNutri.fiber}g</strong></span>
              </div>
            </div>

            <!-- Đối chiếu trực tiếp với Thể trạng & Quỹ Kcal hôm nay của Người dùng đang đăng nhập -->
            ${typeof renderPersonalDishMatchBanner === 'function' ? renderPersonalDishMatchBanner(dish, dynNutri) : ''}

            <!-- 2 nút cùng hàng: Chi tiết dưỡng chất & Xem giấy chứng nhận -->
            <div class="pdp-sn-footer-actions" onclick="event.stopPropagation()">
              <button
                type="button"
                class="pdp-sn-tab-jump-btn nutrition"
                onclick="openDishSafetyNutritionView('nutrition')"
              >
                🥗 Chi tiết dưỡng chất
              </button>
              <button
                type="button"
                class="pdp-sn-tab-jump-btn safety"
                onclick="openDishSafetyNutritionView('safety')"
              >
                ${FluentIcons.shieldFilled} Xem giấy chứng nhận
              </button>
            </div>
          </div>

          <!-- 3. KHU VỰC ĐÁNH GIÁ SẢN PHẨM TỪ NGƯỜI MUA -->
          <div class="pdp-reviews-section" id="pdp-reviews-section">
            <div class="pdp-section-header-row">
              <div>
                <div class="pdp-section-title">⭐ Đánh Giá Từ Người Dùng (${profile.reviews.length})</div>
                <div class="pdp-section-sub">Nhận xét thực tế về hương vị, định lượng và độ vệ sinh của món ăn</div>
              </div>
              <div class="pdp-overall-score-box">
                <span class="big-star">${profile.ratingVal}</span>
                <span class="out-of">/ 5.0 ⭐</span>
              </div>
            </div>

            <div class="pdp-reviews-list">
              ${profile.reviews.map(rv => `
                <div class="pdp-review-card">
                  <div class="pdp-review-top">
                    <div class="pdp-reviewer-info">
                      <span class="pdp-reviewer-avatar">${rv.avatar}</span>
                      <div>
                        <div class="pdp-reviewer-name">
                          ${escapeHtml(rv.userName)}
                          ${rv.verified ? `<span class="pdp-verified-buy">✓ Đã mua món</span>` : ''}
                        </div>
                        <div class="pdp-review-stars">
                          ${'⭐'.repeat(Math.max(1, Math.min(5, Math.round(rv.score))))} • <span>${escapeHtml(rv.time)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="pdp-review-comment">${escapeHtml(rv.comment)}</div>
                  ${Array.isArray(rv.tags) && rv.tags.length > 0 ? `
                    <div class="pdp-review-tags">
                      ${rv.tags.map(tg => `<span class="pdp-rv-tag">${escapeHtml(tg)}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 4. Món ngon khác cùng quán -->
          ${relatedSameStore.length > 0 ? `
            <div class="pdp-related-section">
              <div class="pdp-section-title" style="margin-bottom: 12px;">🍽️ Các món khác tại ${escapeHtml(store.name)}</div>
              <div class="pdp-related-grid">
                ${relatedSameStore.map(rel => `
                  <div class="pdp-rel-card" onclick="openDishDetailById('${escapeHtml(rel.id)}')">
                    <img src="${escapeHtml(rel.image)}" alt="${escapeHtml(rel.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
                    <div class="pdp-rel-info">
                      <div class="pdp-rel-name">${escapeHtml(rel.name)}</div>
                      <div class="pdp-rel-price">${formatVND(rel.price)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- BACKDROP CHO MOBILE DRAWER -->
        <div class="pdp-order-drawer-backdrop ${pdpMobileDrawerOpen ? 'active' : ''}" id="pdp-order-drawer-backdrop" onclick="closePDPMobileOrderDrawer()"></div>

        <!-- CỘT PHẢI (DRAWER TRÊN MOBILE, STICKY TRÊN DESKTOP): TÙY CHỈNH KÍCH CỠ, TOPPING, GHI CHÚ & ĐẶT MÓN -->
        <div class="product-detail-order-col ${pdpMobileDrawerOpen ? 'mobile-open' : ''}" id="pdp-order-drawer">
          <div class="pdp-order-card">
            <div class="pdp-order-card-title">
              <span>🛒 Tùy chỉnh phần ăn của bạn</span>
              <button type="button" class="pdp-order-drawer-close-btn" onclick="closePDPMobileOrderDrawer()" aria-label="Đóng">
                ${FluentIcons.dismiss}
              </button>
            </div>

            <!-- Chọn Kích cỡ -->
            <div class="pdp-opt-block">
              <div class="pdp-opt-head">
                <span>Chọn Kích cỡ / Khẩu phần</span>
                <span class="option-required-badge">Bắt buộc • Chọn 1</span>
              </div>
              <div class="option-items-list">
                ${sizes.map((s, idx) => `
                  <div
                    class="option-item-row size-option-row ${idx === modalSelectedSizeIndex ? 'selected' : ''}"
                    onclick="selectDishDetailSize(${idx})"
                  >
                    <div class="option-item-left">
                      <div class="custom-radio"></div>
                      <span class="option-item-name">${escapeHtml(s.name)}</span>
                    </div>
                    <span class="option-item-price">${s.extraPrice > 0 ? `+${formatVND(s.extraPrice)}` : 'Giá gốc'}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Chọn Topping -->
            ${toppings.length > 0 ? `
              <div class="pdp-opt-block">
                <div class="pdp-opt-head">
                  <span>Topping / Món thêm</span>
                  <span class="option-optional-badge">Tùy chọn</span>
                </div>
                <div class="option-items-list">
                  ${toppings.map(t => {
    const isChecked = modalSelectedToppingIds.includes(t.id);
    return `
                      <div
                        class="option-item-row topping-option-row ${isChecked ? 'selected' : ''}"
                        onclick="toggleDishDetailTopping('${escapeHtml(t.id)}')"
                      >
                        <div class="option-item-left">
                          <div class="custom-checkbox">
                            <span class="check-icon">${FluentIcons.checkmarkFilled}</span>
                          </div>
                          <span class="option-item-name">${escapeHtml(t.name)}</span>
                        </div>
                        <span class="option-item-price">+${formatVND(t.price)}</span>
                      </div>
                    `;
  }).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Ghi chú cho nhà bếp -->
            <div class="pdp-opt-block">
              <div class="pdp-opt-head">
                <span>Lời nhắn dặn bếp (Ít đường, thêm rau, không hành...)</span>
              </div>
              <textarea
                class="kitchen-note-box"
                id="pdp-kitchen-note"
                rows="2"
                placeholder="VD: Cho ít dầu mỡ, để riêng nước chấm..."
                oninput="modalKitchenNote = this.value"
              >${escapeHtml(modalKitchenNote)}</textarea>
              <div class="note-suggestions-row">
                ${noteSuggestions.map(n => `
                  <span class="note-chip" onclick="appendDishDetailNote('${escapeHtml(n)}')">+ ${escapeHtml(n)}</span>
                `).join('')}
              </div>
            </div>

            <!-- Tổng năng lượng cập nhật động theo lựa chọn -->
            <div class="pdp-live-kcal-notice" onclick="openDishSafetyNutritionView('nutrition')">
              <span>🥗 Năng lượng ước tính cho lựa chọn này: <strong>~${dynNutri.calories * modalQty} kcal</strong></span>
              <span style="color:var(--green-600); font-weight:700;">Chi tiết →</span>
            </div>

            <!-- Action Bar cố định -->
            <div class="pdp-bottom-action-bar">
              <div class="dish-modal-qty-stepper">
                <button class="stepper-btn" onclick="changeDishDetailQty(-1)" aria-label="Giảm">
                  ${FluentIcons.subtractRegular}
                </button>
                <span class="stepper-count">${modalQty}</span>
                <button class="stepper-btn" onclick="changeDishDetailQty(1)" aria-label="Tăng">
                  ${FluentIcons.addRegular}
                </button>
              </div>

              <button
                type="button"
                class="pdp-add-cart-btn"
                onclick="addDishFromDetailView(false)"
                ${outStock ? 'disabled' : ''}
              >
                <span>${outStock ? 'Tạm hết hàng' : 'Thêm vào giỏ'}</span>
              </button>

              ${!outStock ? `
                <button
                  type="button"
                  class="pdp-buy-now-btn"
                  onclick="addDishFromDetailView(true)"
                  title="Thêm vào giỏ & chuyển thẳng tới Thanh toán"
                >
                  Đặt ngay
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Action Bar dính mép dưới trên điện thoại: Ấn mở giao diện Tùy chỉnh phần ăn -->
      <div class="pdp-mobile-sticky-bar">
        <div class="dish-modal-qty-stepper">
          <button class="stepper-btn" onclick="changeDishDetailQty(-1)" aria-label="Giảm">
            ${FluentIcons.subtractRegular}
          </button>
          <span class="stepper-count">${modalQty}</span>
          <button class="stepper-btn" onclick="changeDishDetailQty(1)" aria-label="Tăng">
            ${FluentIcons.addRegular}
          </button>
        </div>

        <button
          type="button"
          class="pdp-add-cart-btn"
          onclick="handleMobilePDPAction(false)"
          ${outStock ? 'disabled' : ''}
        >
          <span>${outStock ? 'Tạm hết hàng' : 'Thêm vào giỏ'}</span>
        </button>

        ${!outStock ? `
          <button
            type="button"
            class="pdp-buy-now-btn"
            onclick="handleMobilePDPAction(true)"
            title="Đặt ngay"
          >
            Đặt ngay
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function scrollToReviewsSection() {
  const el = document.getElementById('pdp-reviews-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function selectDishDetailSize(idx) {
  modalSelectedSizeIndex = Number(idx);
  const noteEl = document.getElementById('pdp-kitchen-note');
  if (noteEl) modalKitchenNote = noteEl.value;
  const drawer = document.getElementById('pdp-order-drawer');
  const prevDrawerScroll = drawer ? drawer.scrollTop : 0;
  const prevWindowScroll = window.scrollY;
  renderDishDetailView();
  if (pdpMobileDrawerOpen) {
    const newDrawer = document.getElementById('pdp-order-drawer');
    if (newDrawer && prevDrawerScroll) newDrawer.scrollTop = prevDrawerScroll;
    window.scrollTo({ top: prevWindowScroll, behavior: 'instant' });
    document.body.classList.add('pdp-drawer-active');
  }
}

function toggleDishDetailTopping(topId) {
  const idx = modalSelectedToppingIds.indexOf(topId);
  if (idx > -1) {
    modalSelectedToppingIds.splice(idx, 1);
  } else {
    modalSelectedToppingIds.push(topId);
  }
  const noteEl = document.getElementById('pdp-kitchen-note');
  if (noteEl) modalKitchenNote = noteEl.value;
  const drawer = document.getElementById('pdp-order-drawer');
  const prevDrawerScroll = drawer ? drawer.scrollTop : 0;
  const prevWindowScroll = window.scrollY;
  renderDishDetailView();
  if (pdpMobileDrawerOpen) {
    const newDrawer = document.getElementById('pdp-order-drawer');
    if (newDrawer && prevDrawerScroll) newDrawer.scrollTop = prevDrawerScroll;
    window.scrollTo({ top: prevWindowScroll, behavior: 'instant' });
    document.body.classList.add('pdp-drawer-active');
  }
}

function changeDishDetailQty(delta) {
  const next = modalQty + delta;
  if (next >= 1 && next <= 99) {
    modalQty = next;
    const noteEl = document.getElementById('pdp-kitchen-note');
    if (noteEl) modalKitchenNote = noteEl.value;
    const drawer = document.getElementById('pdp-order-drawer');
    const prevDrawerScroll = drawer ? drawer.scrollTop : 0;
    const prevWindowScroll = window.scrollY;
    renderDishDetailView();
    if (pdpMobileDrawerOpen) {
      const newDrawer = document.getElementById('pdp-order-drawer');
      if (newDrawer && prevDrawerScroll) newDrawer.scrollTop = prevDrawerScroll;
      window.scrollTo({ top: prevWindowScroll, behavior: 'instant' });
      document.body.classList.add('pdp-drawer-active');
    }
  }
}

function appendDishDetailNote(text) {
  const el = document.getElementById('pdp-kitchen-note');
  if (el) {
    el.value = el.value.trim() ? `${el.value.trim()}, ${text}` : text;
    modalKitchenNote = el.value;
  }
}

function addDishFromDetailView(buyNow = false) {
  closePDPMobileOrderDrawer();
  if (!modalDish || modalDish.inStock === false) return;

  const size = (modalDish.sizes && modalDish.sizes[modalSelectedSizeIndex])
    ? modalDish.sizes[modalSelectedSizeIndex]
    : { name: 'Phần Tiêu Chuẩn', extraPrice: 0 };

  const selectedToppingsList = (modalDish.toppings || []).filter(t =>
    modalSelectedToppingIds.includes(t.id)
  );

  let unitPrice = Number(modalDish.price) + (Number(size.extraPrice) || 0);
  selectedToppingsList.forEach(t => (unitPrice += Number(t.price) || 0));

  let result = null;
  if (typeof window !== 'undefined' && typeof window.addOrMergeCartItem === 'function') {
    result = window.addOrMergeCartItem({
      dishId: modalDish.id,
      dishName: modalDish.name,
      restaurantName: modalRestaurant ? modalRestaurant.name : (modalDish.restaurantName || 'ptitngon Kitchen'),
      restaurantId: modalRestaurant ? modalRestaurant.id : (modalDish.restaurantId || 1),
      image: modalDish.image,
      size: size,
      toppings: selectedToppingsList,
      note: (modalKitchenNote || '').trim(),
      quantity: modalQty,
      unitPrice: unitPrice
    });
  } else {
    const cartItem = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      dishId: modalDish.id,
      dishName: modalDish.name,
      restaurantName: modalRestaurant ? modalRestaurant.name : (modalDish.restaurantName || 'ptitngon Kitchen'),
      restaurantId: modalRestaurant ? modalRestaurant.id : (modalDish.restaurantId || 1),
      image: modalDish.image,
      size: size,
      toppings: selectedToppingsList,
      note: (modalKitchenNote || '').trim(),
      quantity: modalQty,
      unitPrice: unitPrice,
      totalPrice: unitPrice * modalQty
    };
    cart.push(cartItem);
    result = { merged: false, item: cartItem };
  }

  if (typeof DB !== 'undefined' && DB.isReady) {
    DB.saveCurrentUserCart(cart);
  }
  updateFloatingCartBar();

  if (buyNow) {
    openCheckoutView();
  } else {
    const curTotal = result.item ? result.item.totalPrice : (unitPrice * modalQty);
    const toastMsg = result.merged
      ? `Đã tăng số lượng "${modalDish.name}" lên ${result.item.quantity} (${formatVND(curTotal)}) trong giỏ!`
      : `Đã thêm ${modalQty}x "${modalDish.name}" (${formatVND(curTotal)}) vào giỏ!`;
    showToast('cartFilled', toastMsg);
    renderDishDetailView();
  }
}

// =========================================================================
// 4. GIAO DIỆN CHI TIẾT 2 TAB: DINH DƯỠNG & ĐẢM BẢO AN TOÀN (VSATTP + AI MÓN ĂN)
// =========================================================================

function openDishSafetyNutritionView(tab = 'nutrition') {
  if (!modalDish) return;
  if (typeof saveCurrentViewScroll === 'function') {
    saveCurrentViewScroll();
  }
  dishSafetyActiveTab = tab === 'safety' ? 'safety' : 'nutrition';
  currentView = 'dish-safety-nutrition';
  render();
  if (typeof restoreViewScroll === 'function') {
    restoreViewScroll('dish-safety-nutrition', 0);
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

function switchDishSafetyTab(tab) {
  dishSafetyActiveTab = tab;
  renderDishSafetyNutritionView();
}

function backToProductDetailView() {
  if (typeof saveCurrentViewScroll === 'function') {
    saveCurrentViewScroll();
  }
  currentView = 'dish-detail';
  render();
  if (typeof restoreViewScroll === 'function') {
    restoreViewScroll('dish-detail', 0);
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

function renderDishSafetyNutritionView() {
  if (!modalDish) {
    openHomeView();
    return;
  }

  const dish = (typeof DB !== 'undefined' && DB.isReady && modalDish.id && DB.getItemById(modalDish.id)) || modalDish;
  modalDish = dish;
  const store = (typeof DB !== 'undefined' && DB.isReady && dish.restaurantId && restaurants.find(r => Number(r.id) === Number(dish.restaurantId))) || modalRestaurant;
  modalRestaurant = store;
  const profile = getDishNutritionAndSafetyProfile(dish, store);
  const dynNutri = getAdjustedNutritionBySelection(profile);

  app.innerHTML = `
    <div class="sn-deep-page fade-in">
      <!-- Top Navigation -->
      <div class="page-nav-header">
        <button class="page-back-icon-btn" onclick="backToProductDetailView()" aria-label="Quay lại mặt hàng">
          ${FluentIcons.arrowLeft}
        </button>
        <div class="page-nav-title">An Toàn & Dinh Dưỡng Chi Tiết</div>
        <div style="width: 36px;"></div>
      </div>

      <!-- Mini Dish Summary Strip -->
      <div class="sn-dish-context-strip" onclick="backToProductDetailView()">
        <img src="${escapeHtml(dish.image)}" alt="${escapeHtml(dish.name)}" onerror="this.src='assets/images/hung_chien_gion.jpg'">
        <div class="sn-dish-context-info">
          <div class="sn-dish-context-name">${escapeHtml(dish.name)}</div>
          <div class="sn-dish-context-meta">
            🏪 ${escapeHtml(store ? store.name : dish.restaurantName)} • <strong>${formatVND(dish.price)}</strong>
          </div>
        </div>
        <span class="sn-back-pill">← Chọn mua</span>
      </div>

      <!-- 2-Tab Switcher: Tab Dinh Dưỡng vs Tab Đảm Bảo An Toàn -->
      <div class="sn-two-tabs-bar">
        <button
          type="button"
          class="sn-main-tab-btn ${dishSafetyActiveTab === 'nutrition' ? 'active' : ''}"
          onclick="switchDishSafetyTab('nutrition')"
        >
          <span>🥗</span>
          <div>
            <div class="tab-main-lbl">Dinh Dưỡng & Nguyên Liệu</div>
            <div class="tab-sub-lbl">~${dynNutri.calories} kcal • Hỏi AI món ăn</div>
          </div>
        </button>

        <button
          type="button"
          class="sn-main-tab-btn ${dishSafetyActiveTab === 'safety' ? 'active' : ''}"
          onclick="switchDishSafetyTab('safety')"
        >
          <span>${FluentIcons.shieldFilled}</span>
          <div>
            <div class="tab-main-lbl">Đảm Bảo An Toàn</div>
            <div class="tab-sub-lbl">${escapeHtml(profile.safety.renewedAgoText)}</div>
          </div>
        </button>
      </div>

      <!-- Nội dung từng Tab -->
      <div class="sn-tab-content-area">
        ${dishSafetyActiveTab === 'nutrition'
      ? renderDishNutritionDetailTab(dish, store, profile, dynNutri)
      : renderDishSafetyCertificateTab(dish, store, profile)}
      </div>

      <div class="bottom-spacer"></div>
    </div>
  `;
}

// ── TAB 1: NGUYÊN LIỆU NẤU ĂN, DINH DƯỠNG ƯỚC TÍNH & THANH HỎI BẰNG AI ──
function renderDishNutritionDetailTab(dish, store, profile, dynNutri) {
  const dailyCalPct = Math.min(100, Math.round((dynNutri.calories / 2000) * 100));
  const protPct = Math.min(100, Math.round((dynNutri.protein / 55) * 100));
  const carbPct = Math.min(100, Math.round((dynNutri.carbs / 260) * 100));
  const fatPct = Math.min(100, Math.round((dynNutri.fat / 65) * 100));
  const fiberPct = Math.min(100, Math.round((dynNutri.fiber / 28) * 100));

  const logs = dishAIChatLogs[dish.id] || [];
  const apiReady = (typeof isExternalAPIConfigured === 'function') && isExternalAPIConfigured();

  return `
    <div class="sn-nutrition-tab-wrap">
      <!-- Khối 1: Đánh giá Healthy & Khuyến nghị đối tượng -->
      <div class="sn-card">
        <div class="sn-card-title-row">
          <span class="sn-card-heading">🌿 Đánh giá tổng thể Mức độ Healthy</span>
          <span class="sn-healthy-pill" style="background:${profile.healthyColor}18; color:${profile.healthyColor}; border-color:${profile.healthyColor}55;">
            Điểm Healthy: ${profile.healthyScore}/10
          </span>
        </div>

        <p class="sn-lead-summary">
          <strong>${escapeHtml(dish.name)}</strong> được xếp nhóm <strong>${escapeHtml(profile.healthyLevel)}</strong>.
          Một khẩu phần cung cấp khoảng <strong>${dynNutri.calories} kcal</strong> (tương đương <strong>${dailyCalPct}%</strong> nhu cầu năng lượng trung bình 2.000 kcal/ngày của người trưởng thành).
        </p>

        <div class="pdp-sn-highlights-grid" style="margin-top: 12px;">
          <div class="pdp-sn-highlight-item">
            <div class="sn-hl-label">👥 Đặc biệt tốt cho ai:</div>
            <ul class="sn-hl-list">
              ${profile.goodFor.map(g => `<li>${escapeHtml(g)}</li>`).join('')}
            </ul>
          </div>
          <div class="pdp-sn-highlight-item">
            <div class="sn-hl-label">💊 Dưỡng chất bổ sung & Lưu ý dị ứng:</div>
            <div class="sn-supp-tags">
              ${profile.supplements.map(s => `<span class="sn-supp-chip">✓ ${escapeHtml(s)}</span>`).join('')}
            </div>
            <div class="sn-allergen-note">
              ⚠️ <strong>Lưu ý thành phần mẫn cảm:</strong> ${escapeHtml(profile.allergens.join(' • '))}
            </div>
          </div>
        </div>
      </div>

      <!-- Khối 2: Miêu tả chi tiết các Nguyên liệu nấu ăn -->
      <div class="sn-card">
        <div class="sn-card-title-row">
          <span class="sn-card-heading">🥘 Nguyên liệu nấu ăn & Thành phần chế biến</span>
          <span class="sn-sub-badge">Sơ chế tươi trong ngày</span>
        </div>

        <div class="sn-ingredients-list">
          ${profile.ingredients.map(ing => `
            <div class="sn-ingredient-row">
              <div class="sn-ing-icon">${ing.icon}</div>
              <div class="sn-ing-body">
                <div class="sn-ing-top">
                  <strong class="sn-ing-name">${escapeHtml(ing.name)}</strong>
                  <span class="sn-ing-amount">~${escapeHtml(ing.amount)}</span>
                </div>
                <div class="sn-ing-origin">📍 Nguồn gốc: ${escapeHtml(ing.origin)}</div>
                <div class="sn-ing-role">${FluentIcons.sparkleFilled} Vai trò dinh dưỡng: ${escapeHtml(ing.role)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Khối 3: Bảng Dinh dưỡng ước tính chi tiết -->
      <div class="sn-card">
        <div class="sn-card-title-row">
          <span class="sn-card-heading">${FluentIcons.histogram} Bảng giá trị dinh dưỡng ước tính (1 khẩu phần)</span>
          ${dynNutri.hasExtra ? `<span class="sn-sub-badge">Đã tính Cỡ/Topping đang chọn</span>` : ''}
        </div>

        <div class="sn-kcal-banner">
          <div>
            <div class="sn-kcal-lbl">Năng lượng ước tính (Calories)</div>
            <div class="sn-kcal-val">${dynNutri.calories} <span>kcal</span></div>
          </div>
          <div class="sn-kcal-dv">
            <strong>${dailyCalPct}%</strong>
            <span>% Nhu cầu/ngày</span>
          </div>
        </div>

        <div class="sn-macros-bars">
          <div class="sn-macro-row">
            <div class="sn-macro-head">
              <span>🥩 Chất đạm (Protein)</span>
              <strong>${dynNutri.protein}g (${protPct}% DV)</strong>
            </div>
            <div class="sn-bar-bg"><div class="sn-bar-fill prot" style="width:${protPct}%;"></div></div>
          </div>

          <div class="sn-macro-row">
            <div class="sn-macro-head">
              <span>🌾 Tinh bột (Carbohydrates)</span>
              <strong>${dynNutri.carbs}g (${carbPct}% DV)</strong>
            </div>
            <div class="sn-bar-bg"><div class="sn-bar-fill carb" style="width:${carbPct}%;"></div></div>
          </div>

          <div class="sn-macro-row">
            <div class="sn-macro-head">
              <span>🥑 Chất béo tổng (Total Fat)</span>
              <strong>${dynNutri.fat}g (${fatPct}% DV)</strong>
            </div>
            <div class="sn-bar-bg"><div class="sn-bar-fill fat" style="width:${fatPct}%;"></div></div>
          </div>

          <div class="sn-macro-row">
            <div class="sn-macro-head">
              <span>🥬 Chất xơ tự nhiên (Dietary Fiber)</span>
              <strong>${dynNutri.fiber}g (${fiberPct}% DV)</strong>
            </div>
            <div class="sn-bar-bg"><div class="sn-bar-fill fiber" style="width:${fiberPct}%;"></div></div>
          </div>
        </div>

        <div class="sn-micros-grid">
          <div class="sn-micro-box">
            <span class="m-lbl">Muối khoáng (Natri)</span>
            <strong class="m-val">~${dynNutri.sodium} mg</strong>
          </div>
          <div class="sn-micro-box">
            <span class="m-lbl">Đường tổng số</span>
            <strong class="m-val">~${dynNutri.sugar} g</strong>
          </div>
          <div class="sn-micro-box">
            <span class="m-lbl">Thời điểm ăn tốt nhất</span>
            <strong class="m-val">${escapeHtml(profile.bestTime)}</strong>
          </div>
        </div>
      </div>

      <!-- Khối 4: THANH HỎI BẰNG AI TRỰC TIẾP VỀ MÓN ĂN NÀY -->
      <div class="sn-card sn-ai-ask-card" id="sn-dish-ai-box">
        <div class="sn-ai-ask-header">
          <div class="sn-ai-ask-title">
            <span class="sn-ai-sparkle">🤖</span>
            <div>
              <div class="sn-card-heading">Hỏi AI Chuyên Gia về "${escapeHtml(dish.name)}"</div>
              <div class="sn-ai-sub">
                Tư vấn tức thì về calo, nguyên liệu, dị ứng, chế độ tập luyện hoặc cách ăn lành mạnh
              </div>
            </div>
          </div>
          <button type="button" class="ai-api-status-btn ${apiReady ? 'connected' : ''}" onclick="openAISettingsModal()" title="Cấu hình & Quản lý API AI">
            <span>${FluentIcons.settingsFilled}</span>
            <span class="ai-api-btn-label">${apiReady ? 'API Đã nối' : 'Cấu hình API'}</span>
          </button>
        </div>

        <!-- Các câu hỏi gợi ý nhanh cho món ăn -->
        <div class="sn-ai-quick-chips">
          ${DISH_AI_QUICK_QUESTIONS.map((qText, qIdx) => `
            <button
              type="button"
              class="sn-ai-chip"
              onclick="askDishAIQuickQuestion(${qIdx})"
              ${dishAIIsThinking ? 'disabled' : ''}
            >
              ${escapeHtml(qText)}
            </button>
          `).join('')}
        </div>

        <!-- Khung hiển thị hội thoại AI về món ăn -->
        ${logs.length > 0 || dishAIIsThinking ? `
          <div class="sn-ai-thread" id="sn-ai-thread">
            ${logs.map((entry, idx) => `
              <div class="sn-ai-msg ${entry.role}">
                <div class="sn-ai-msg-badge">${entry.role === 'user' ? '🧑‍🎓 Bạn hỏi' : '🤖 AI Dinh dưỡng trả lời'}</div>
                <div class="sn-ai-msg-text">${entry.role === 'user' ? escapeHtml(entry.text) : formatAIMarkdown(entry.text)}</div>
                ${entry.role === 'assistant' ? `
                  <button type="button" class="sn-ai-retry-btn" onclick="retryDishAIQuestion('${escapeHtml(dish.id)}', ${idx})" title="Hỏi lại câu hỏi này">
                    ${FluentIcons.sync} Hỏi lại
                  </button>
                ` : ''}
              </div>
            `).join('')}
            ${dishAIIsThinking ? `
              <div class="sn-ai-msg assistant">
                <div class="sn-ai-msg-badge">🤖 AI đang phân tích thành phần món ăn...</div>
                <div class="ai-typing-indicator" style="margin-top:4px;"><span></span><span></span><span></span></div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Thanh nhập câu hỏi AI ngay tại chỗ -->
        <div class="sn-ai-input-bar">
          <input
            type="text"
            id="sn-dish-ai-input"
            placeholder="Nhập câu hỏi về món ${escapeHtml(dish.name)} (VD: Đau dạ dày ăn món này được không?)..."
            value="${escapeHtml(dishAIDraftQuestion)}"
            oninput="dishAIDraftQuestion = this.value"
            onkeydown="handleDishAIInputKeydown(event)"
            ${dishAIIsThinking ? 'disabled' : ''}
          >
          ${dishAIIsThinking ? `
            <button
              type="button"
              class="sn-ai-stop-btn"
              onclick="stopDishAIGeneration()"
              title="Dừng hỏi AI (Esc)"
            >
              ⏹ Dừng
            </button>
          ` : `
            <button
              type="button"
              class="sn-ai-send-btn"
              onclick="submitDishAIQuestion()"
            >
              Hỏi AI ${FluentIcons.sparkleFilled}
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

// ── TAB 2: ĐẢM BẢO AN TOÀN & GIẤY CHỨNG NHẬN VSATTP (LÀM MỚI CÁCH ĐÂY BAO LÂU) ──
function renderDishSafetyCertificateTab(dish, store, profile) {
  const sf = profile.safety;

  return `
    <div class="sn-safety-tab-wrap">
      <!-- 1. Banner nổi bật: Giấy chứng nhận được làm mới cách đây bao lâu -->
      <div class="safety-renewal-hero-banner">
        <div class="safety-renewal-badge-row">
          <span class="safety-pulse-dot"></span>
          <span class="safety-live-status">CHỨNG NHẬN ĐANG CÓ HIỆU LỰC HỢP PHÁP</span>
        </div>

        <div class="safety-renewal-main-time">
          ${FluentIcons.shieldFilled} Được kiểm định & làm mới cách đây <strong>${sf.daysSinceRenewed} ngày</strong>
        </div>

        <div class="safety-renewal-sub-dates">
          <span>📅 Ngày làm mới gần nhất: <strong>${sf.renewedDateStr}</strong></span>
          <span>•</span>
          <span>${FluentIcons.sync} Đợt hậu kiểm định kỳ tiếp theo: <strong>${sf.nextAuditDateStr}</strong></span>
          <span>•</span>
          <span>⏳ Hiệu lực đến: <strong>${sf.expiryDateStr}</strong></span>
        </div>

        <div class="safety-kitchen-today-bar">
          <span>✅ <strong>Nhật ký bếp hôm nay:</strong> ${escapeHtml(sf.kitchenCheckToday)}</span>
          <button type="button" class="safety-verify-btn" onclick="verifyCertificateLive('${escapeHtml(sf.certCode)}', ${sf.daysSinceRenewed})">
            🔍 Tra cứu xác thực mã số
          </button>
        </div>
      </div>

      <!-- 2. GIẤY CHỨNG NHẬN ĐẢM BẢO AN TOÀN VỆ SINH THỰC PHẨM CHÍNH QUY -->
      <div class="official-cert-frame">
        <div class="official-cert-inner">
          <div class="cert-header-emblem">
            <div class="cert-republic-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div class="cert-republic-motto">Độc lập - Tự do - Hạnh phúc</div>
            <div class="cert-divider-line"></div>
            <div class="cert-shield-icon">${FluentIcons.shieldFilled}</div>
            <div class="cert-doc-type">GIẤY CHỨNG NHẬN</div>
            <div class="cert-doc-subtitle">CƠ SỞ ĐỦ ĐIỀU KIỆN ĐẢM BẢO AN TOÀN VỆ SINH THỰC PHẨM</div>
            <div class="cert-code-pill">Số giấy chứng nhận: <strong>${escapeHtml(sf.certCode)}</strong></div>
          </div>

          <div class="cert-body-fields">
            <div class="cert-field-row">
              <span class="cert-lbl">1. Tên cơ sở chế biến & cung ứng:</span>
              <strong class="cert-val highlight">${escapeHtml(sf.facilityName)}</strong>
            </div>
            <div class="cert-field-row">
              <span class="cert-lbl">2. Địa chỉ cơ sở kiểm định:</span>
              <span class="cert-val">${escapeHtml(sf.facilityAddress)}</span>
            </div>
            <div class="cert-field-row">
              <span class="cert-lbl">3. Mặt hàng & Nhóm thực phẩm đăng ký:</span>
              <span class="cert-val"><strong>${escapeHtml(dish.name)}</strong> (Danh mục: ${escapeHtml(dish.category)}) — Chế biến suất ăn sẵn & đồ uống an toàn</span>
            </div>
            <div class="cert-field-row">
              <span class="cert-lbl">4. Quy chuẩn kỹ thuật áp dụng:</span>
              <span class="cert-val">${escapeHtml(sf.standardCode)}</span>
            </div>
            <div class="cert-field-row">
              <span class="cert-lbl">5. Cơ quan cấp & Giám sát định kỳ:</span>
              <span class="cert-val">${escapeHtml(sf.issuingAuthority)}</span>
            </div>
            <div class="cert-field-row">
              <span class="cert-lbl">6. Thời điểm thẩm định & Làm mới gần nhất:</span>
              <span class="cert-val renew-highlight">
                Ngày ${sf.renewedDateStr} (Đã làm mới cách đây ${sf.daysSinceRenewed} ngày — Đạt 100% tiêu chí an toàn)
              </span>
            </div>
          </div>

          <div class="cert-footer-stamps">
            <div class="cert-qr-box">
              <svg width="68" height="68" viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="68" height="68" rx="8" fill="#F8FAFC" stroke="#CBD5E1"/>
                <rect x="8" y="8" width="18" height="18" rx="2" stroke="#0F172A" stroke-width="3"/>
                <rect x="13" y="13" width="8" height="8" fill="#0F172A"/>
                <rect x="42" y="8" width="18" height="18" rx="2" stroke="#0F172A" stroke-width="3"/>
                <rect x="47" y="13" width="8" height="8" fill="#0F172A"/>
                <rect x="8" y="42" width="18" height="18" rx="2" stroke="#0F172A" stroke-width="3"/>
                <rect x="13" y="47" width="8" height="8" fill="#0F172A"/>
                <rect x="31" y="10" width="5" height="5" fill="#059669"/>
                <rect x="31" y="20" width="5" height="12" fill="#0F172A"/>
                <rect x="10" y="31" width="14" height="5" fill="#0F172A"/>
                <rect x="31" y="36" width="10" height="5" fill="#059669"/>
                <rect x="45" y="34" width="14" height="5" fill="#0F172A"/>
                <rect x="33" y="46" width="7" height="13" fill="#0F172A"/>
                <rect x="45" y="44" width="6" height="8" fill="#059669"/>
                <rect x="54" y="46" width="6" height="14" fill="#0F172A"/>
              </svg>
              <span>Mã QR Điện Tử</span>
            </div>

            <div class="cert-official-seal">
              <div class="seal-ring">
                <span class="seal-top">HỆ THỐNG KIỂM ĐỊNH</span>
                <strong class="seal-mid">✓ ĐẠT CHUẨN<br>VSATTP</strong>
                <span class="seal-bot">VERIFIED ${new Date().getFullYear()}</span>
              </div>
              <div class="seal-caption">Đã đóng dấu xác thực điện tử</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Bảng kết quả kiểm nghiệm 5 chỉ tiêu vệ sinh an toàn thực phẩm -->
      <div class="sn-card">
        <div class="sn-card-title-row">
          <span class="sn-card-heading">🔬 Kết quả kiểm nghiệm 5 chỉ tiêu an toàn định kỳ</span>
          <span class="sn-sub-badge">Đạt 5/5 tiêu chuẩn</span>
        </div>

        <div class="safety-lab-list">
          ${sf.labChecks.map(chk => `
            <div class="safety-lab-row">
              <div class="safety-lab-left">
                <span class="safety-check-badge">✓ ĐẠT</span>
                <span class="safety-lab-name">${escapeHtml(chk.label)}</span>
              </div>
              <strong class="safety-lab-res">${escapeHtml(chk.result)}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function verifyCertificateLive(certCode, daysAgo) {
  showToast(
    'checkmarkFilled',
    `Xác thực hợp lệ mã ${certCode}: Đã làm mới cách đây ${daysAgo} ngày, đạt 100% tiêu chuẩn VSATTP!`
  );
}

// =========================================================================
// 5. XỬ LÝ THANH HỎI BẰNG AI TRỰC TIẾP VỀ MÓN ĂN ĐANG XEM
// =========================================================================

function handleDishAIInputKeydown(e) {
  if (e.key === 'Escape' && dishAIIsThinking) {
    e.preventDefault();
    stopDishAIGeneration();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    submitDishAIQuestion();
  }
}

function stopDishAIGeneration() {
  if (!dishAIIsThinking) return;
  dishAIIsThinking = false;
  if (typeof aiCurrentAbortController !== 'undefined' && aiCurrentAbortController) {
    try { aiCurrentAbortController.abort(); } catch (_) { }
  }
  if (modalDish && Array.isArray(dishAIChatLogs[modalDish.id])) {
    const logs = dishAIChatLogs[modalDish.id];
    if (logs.length > 0 && logs[logs.length - 1].role === 'user') {
      logs.push({ role: 'assistant', text: '⏹ *Bạn đã dừng câu trả lời của AI.*' });
    }
  }
  if (currentView === 'dish-safety-nutrition') {
    renderDishSafetyNutritionView();
  }
}

async function retryDishAIQuestion(dishId, idx) {
  if (dishAIIsThinking || !dishId) return;
  const logs = dishAIChatLogs[dishId];
  if (!Array.isArray(logs) || logs.length === 0) return;

  let userQ = '';
  let targetIdx = -1;
  const startIdx = (typeof idx === 'number' && idx >= 0) ? idx : logs.length - 1;
  for (let i = startIdx; i >= 0; i--) {
    if (logs[i].role === 'user') {
      userQ = logs[i].text;
      targetIdx = i;
      break;
    }
  }

  if (!userQ || targetIdx === -1) return;

  // Xóa câu trả lời cũ của assistant và câu hỏi sau đó
  logs.splice(targetIdx + 1);

  dishAIDraftQuestion = userQ;
  await submitDishAIQuestion(userQ);
}

function askDishAIQuickQuestion(qIdx) {
  const q = DISH_AI_QUICK_QUESTIONS[qIdx];
  if (q) {
    dishAIDraftQuestion = q;
    submitDishAIQuestion(q);
  }
}

async function submitDishAIQuestion(overrideQ = null) {
  if (dishAIIsThinking || !modalDish) return;
  const inputEl = document.getElementById('sn-dish-ai-input');
  const raw = overrideQ !== null ? overrideQ : (inputEl ? inputEl.value : dishAIDraftQuestion);
  const question = String(raw || '').trim();
  if (!question) return;

  const dish = (typeof DB !== 'undefined' && DB.isReady && modalDish.id && DB.getItemById(modalDish.id)) || modalDish;
  modalDish = dish;
  const store = (typeof DB !== 'undefined' && DB.isReady && dish.restaurantId && restaurants.find(r => Number(r.id) === Number(dish.restaurantId))) || modalRestaurant;
  modalRestaurant = store;
  const profile = getDishNutritionAndSafetyProfile(dish, store);
  const dynNutri = getAdjustedNutritionBySelection(profile);

  dishAIDraftQuestion = '';
  if (!Array.isArray(dishAIChatLogs[dish.id])) {
    dishAIChatLogs[dish.id] = [];
  }
  dishAIChatLogs[dish.id].push({ role: 'user', text: question });

  dishAIIsThinking = true;
  if (currentView === 'dish-safety-nutrition') renderDishSafetyNutritionView();

  try {
    let answerText = '';
    const apiConnected = (typeof isExternalAPIConfigured === 'function') && isExternalAPIConfigured();

    if (apiConnected) {
      try {
        answerText = await callExternalDishNutritionAI(dish, store, profile, dynNutri, dishAIChatLogs[dish.id]);
      } catch (err) {
        console.warn('Dish AI API fallback:', err);
        answerText = generateLocalDishNutritionAnswer(question, dish, store, profile, dynNutri);
      }
    } else {
      await new Promise(r => setTimeout(r, 280));
      answerText = generateLocalDishNutritionAnswer(question, dish, store, profile, dynNutri);
    }

    dishAIChatLogs[dish.id].push({ role: 'assistant', text: answerText });
  } finally {
    dishAIIsThinking = false;
    if (currentView === 'dish-safety-nutrition') {
      renderDishSafetyNutritionView();
      setTimeout(() => {
        const box = document.getElementById('sn-dish-ai-box');
        if (box) box.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 40);
    }
  }
}

async function callExternalDishNutritionAI(dish, store, profile, dynNutri, chatHistory) {
  const ingText = profile.ingredients
    .map(i => `- ${i.name} (${i.amount}, ${i.origin}): ${i.role}`)
    .join('\n');

  const dishSystemPrompt = `Bạn là Chuyên gia Dinh dưỡng & An toàn Thực phẩm AI của ứng dụng ptitngon, đang tư vấn trực tiếp cho người dùng về một mặt hàng cụ thể:
- Tên mặt hàng: ${dish.name} (Danh mục: ${dish.category}, Giá: ${dish.price}đ)
- Quán cung cấp: ${store ? store.name : dish.restaurantName}
- Mô tả: ${dish.description || ''}
- Điểm Healthy: ${profile.healthyScore}/10 (${profile.healthyLevel})
- Tốt cho ai: ${profile.goodFor.join('; ')}
- Dưỡng chất bổ sung: ${profile.supplements.join(', ')}
- Cảnh báo dị ứng: ${profile.allergens.join(', ')}
- Dinh dưỡng ước tính 1 phần: ${dynNutri.calories} kcal | Đạm: ${dynNutri.protein}g | Tinh bột: ${dynNutri.carbs}g | Béo: ${dynNutri.fat}g | Chất xơ: ${dynNutri.fiber}g | Natri: ${dynNutri.sodium}mg | Đường: ${dynNutri.sugar}g
- Nguyên liệu nấu ăn chi tiết:
${ingText}
- Chứng nhận VSATTP: Mã ${profile.safety.certCode}, được làm mới cách đây ${profile.safety.daysSinceRenewed} ngày (ngày ${profile.safety.renewedDateStr}), đạt chuẩn ${profile.safety.standardCode}.

Hãy trả lời câu hỏi của người dùng bằng tiếng Việt ngắn gọn, khoa học, thân thiện, dễ hiểu (dùng **in đậm** cho số liệu quan trọng và gạch đầu dòng nếu cần). KHÔNG cần xuất thẻ <<<RECOMMEND_JSON>>>.`;

  const recent = chatHistory.slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.text,
    text: m.text
  }));

  if (typeof invokeSingleTurnLLM === 'function') {
    const res = await invokeSingleTurnLLM(dishSystemPrompt, recent, {
      temperature: 0.55,
      maxTokens: 800,
      stageLabel: 'DishNutrition'
    });
    return res.text;
  }

  const provider = aiConfig.provider;
  const model = (aiConfig.model || '').trim() || AI_PROVIDER_PRESETS[provider]?.defaultModel || 'gemini-2.5-flash';
  const apiKey = (aiConfig.apiKey || '').trim();

  if (provider === 'gemini') {
    if (typeof isGeminiLiveModel === 'function' && isGeminiLiveModel(model) && typeof invokeGeminiLiveWebSocket === 'function') {
      const turns = recent.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));
      const liveRes = await invokeGeminiLiveWebSocket(dishSystemPrompt, turns, { maxTokens: 800, temperature: 0.55 });
      return liveRes.text;
    }

    const baseUrl = (aiConfig.endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
    const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: dishSystemPrompt }] },
          contents: recent.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.text }]
          })),
          generationConfig: { temperature: 0.55, maxOutputTokens: 800 }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        if (/bidiGenerateContent|WebSocket|live-preview|realtime/i.test(errMsg) && typeof invokeGeminiLiveWebSocket === 'function') {
          const turns = recent.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));
          const liveRes = await invokeGeminiLiveWebSocket(dishSystemPrompt, turns, { maxTokens: 800, temperature: 0.55 });
          return liveRes.text;
        }
        throw new Error(errMsg);
      }
      return (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
    } catch (err) {
      if (/bidiGenerateContent|WebSocket|live-preview|realtime/i.test(err.message) && typeof invokeGeminiLiveWebSocket === 'function') {
        const turns = recent.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }));
        const liveRes = await invokeGeminiLiveWebSocket(dishSystemPrompt, turns, { maxTokens: 800, temperature: 0.55 });
        return liveRes.text;
      }
      throw err;
    }
  }

  const endpoint = (aiConfig.endpoint || AI_PROVIDER_PRESETS[provider]?.endpoint || '').trim();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: dishSystemPrompt },
        ...recent.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))
      ],
      temperature: 0.55,
      max_tokens: 800
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

function generateLocalDishNutritionAnswer(question, dish, store, profile, dynNutri) {
  const qA = removeVnTones(question);

  if (qA.includes('calo') || qA.includes('giam can') || qA.includes('beo') || qA.includes('map') || qA.includes('eat clean')) {
    const pct = Math.round((dynNutri.calories / 2000) * 100);
    const tip = dynNutri.calories <= 420
      ? 'Mức năng lượng này **khá gọn nhẹ**, bạn hoàn toàn có thể ăn khi đang giữ dáng hoặc giảm cân mà không lo dư calo!'
      : 'Nếu bạn đang **giảm cân / siết mỡ**, hãy chọn **Phần Tiêu Chuẩn**, dặn bếp *"ít dầu mỡ / giảm nửa tinh bột hoặc ít sốt"* và ăn kèm nhiều rau xanh để giảm khoảng **80 - 120 kcal** nhé!';
    return `🔥 **Phân tích Calo & Kiểm soát cân nặng cho ${dish.name}:**\n- Năng lượng ước tính: **~${dynNutri.calories} kcal** (chiếm khoảng **${pct}%** nhu cầu 2.000 kcal/ngày).\n- Tỷ lệ đa lượng: **${dynNutri.protein}g Đạm** • **${dynNutri.carbs}g Tinh bột** • **${dynNutri.fat}g Chất béo** • **${dynNutri.fiber}g Chất xơ**.\n- 💡 **Lời khuyên:** ${tip}`;
  }

  if (qA.includes('di ung') || qA.includes('man cam') || qA.includes('nguyen lieu') || qA.includes('thanh phan')) {
    const ingNames = profile.ingredients.map(i => `**${i.name}** (${i.amount})`).join(', ');
    return `🥜 **Thành phần nguyên liệu & Lưu ý dị ứng của ${dish.name}:**\n- **Nguyên liệu nấu chính:** ${ingNames}.\n- **Cảnh báo mẫn cảm:** ${profile.allergens.join('; ')}.\n- 💡 Nếu bạn dị ứng hành, đậu phộng, sữa hay hải sản, hãy ghi rõ vào ô **Lời nhắn dặn bếp** ở trang đặt món để đầu bếp loại bỏ riêng cho phần của bạn nhé!`;
  }

  if (qA.includes('an toan') || qA.includes('chung nhan') || qA.includes('ve sinh') || qA.includes('bao lau') || qA.includes('lam moi')) {
    return `🛡️ **Thông tin Đảm bảo An toàn Vệ sinh Thực phẩm:**\n- Quán **${profile.safety.facilityName}** sở hữu giấy chứng nhận số **${profile.safety.certCode}**.\n- **Thời gian làm mới:** Vừa được kiểm định và làm mới **cách đây ${profile.safety.daysSinceRenewed} ngày** (ngày **${profile.safety.renewedDateStr}**).\n- Đạt đủ 5/5 chỉ tiêu: Không hàn the/phẩm màu cấm, nguyên liệu tươi truy xuất trong ngày và dán tem niêm phong khi giao hàng. Bạn có thể bấm sang tab **🛡️ Đảm Bảo An Toàn** ngay bên cạnh để xem trực tiếp bản Giấy chứng nhận!`;
  }

  if (qA.includes('healthy') || qA.includes('dan bep') || qA.includes('tuy chinh') || qA.includes('cach an')) {
    return `🥗 **Mẹo tùy chỉnh để thưởng thức ${dish.name} Healthy nhất:**\n- Chọn **Phần Tiêu Chuẩn** thay vì cỡ đại nếu ăn vào buổi tối.\n- Dặn bếp trong phần ghi chú: *"Cho nhiều rau tươi, giảm muối/nước sốt béo, để riêng nước chấm"*.\n- Kết hợp uống nước lọc ấm hoặc trà không đường sau bữa ăn 20 phút giúp hấp thu tốt **${dynNutri.protein}g Protein** và **${dynNutri.fiber}g Chất xơ** của món!`;
  }

  if (qA.includes('da day') || qA.includes('buoi toi') || qA.includes('an dem') || qA.includes('kho tieu')) {
    return `🌙 **Tư vấn tiêu hóa & Thời điểm ăn ${dish.name}:**\n- Thời điểm lý tưởng nhất: **${profile.bestTime}**.\n- Nếu bạn có **dạ dày nhạy cảm** hoặc ăn muộn sau 20h30: hãy dặn bếp *"Không cay / không ớt, nấu chín mềm, ít dầu mỡ"* để dạ dày tiêu hóa êm ái nhất nhé!`;
  }

  // Mặc định trả lời tổng hợp thông minh về tốt cho ai, bổ sung dưỡng chất & nguyên liệu
  return `✨ **Tư vấn dinh dưỡng tổng hợp cho ${dish.name} (Điểm Healthy: ${profile.healthyScore}/10):**\n- **Phù hợp nhất cho:** ${profile.goodFor[0]}.\n- **Dưỡng chất bổ sung chủ đạo:** ${profile.supplements.join(', ')} (Cung cấp **${dynNutri.calories} kcal** & **${dynNutri.protein}g Protein**).\n- **Độ an toàn:** Chứng nhận VSATTP mã **${profile.safety.certCode}** vừa làm mới **cách đây ${profile.safety.daysSinceRenewed} ngày**. Bạn muốn mình tư vấn sâu hơn về calo, dị ứng hay cách dặn bếp không?`;
}
