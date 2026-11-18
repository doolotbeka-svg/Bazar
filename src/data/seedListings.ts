import { Listing } from '../types/marketplace';

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

export const SEED_LISTINGS: Listing[] = [
  {
    id: 'kg-101',
    category: 'transport',
    titleKg: 'Toyota Camry 70, 2019-ж., 2.5 бензин, абалы эң жакшы',
    titleRu: 'Toyota Camry 70, 2019 г., 2.5 бензин, отличное состояние',
    descriptionKg:
      'Бишкектен сатылат. Өзүбүз айдап жүргөн унаа, боёгу таза, кыймылдаткыч жана автомат коробкасы идеалдуу иштейт. Тери салон, арткы камера, климат-контроль бар. Бардык май-суусу убагында алмашкан. Соодалашуу капоттун алдында.',
    descriptionRu:
      'Продаётся в Бишкеке. Собственный автомобиль, в родной краске, двигатель и АКПП работают идеально. Кожаный салон, камера заднего вида, климат-контроль. Все расходники заменены вовремя. Торг у капота.',
    price: 19800,
    currency: 'USD',
    negotiable: true,
    locationId: 'bishkek',
    images: ['/src/assets/images/listing_camry_bishkek_1794982516215.jpg'],
    phone: '+996 (700) 45-12-89',
    hasWhatsapp: true,
    sellerName: 'Бектур Алиев',
    sellerId: 'seed-seller-1',
    sellerSince: '2023',
    createdAt: hoursAgo(2),
    views: 348,
    promoteTier: 'vip',
    status: 'active'
  },
  {
    id: 'kg-102',
    category: 'real_estate',
    titleKg: 'Ош шаарынан 2-бөлмөлүү жарык батир узак мөөнөткө ижарага берилет',
    titleRu: 'Сдаётся светлая 2-комнатная квартира в Оше на длительный срок',
    descriptionKg:
      'Ош шаарынын борборунда, Сулайман-Тоо жакта жайгашкан жаңы үйдөгү 2 бөлмөлүү батир. Бардык эмеректери жана тиричилик техникасы (муздаткыч, кир жуугуч машина, Wi-Fi, кондиционер) бар. Таза, тынч үй-бүлөгө же жумушчуларга берилет.',
    descriptionRu:
      'Сдаётся 2-комнатная квартира в новом доме в центре Оша, район Сулайман-Тоо. Полностью меблирована, вся бытовая техника (холодильник, стиральная машина, Wi-Fi, кондиционер). Сдаётся аккуратной семье или работающим.',
    price: 32000,
    currency: 'KGS',
    negotiable: false,
    locationId: 'osh',
    images: ['/src/assets/images/listing_apartment_osh_1794982516659.jpg'],
    phone: '+996 (555) 81-34-20',
    hasWhatsapp: true,
    sellerName: 'Айгүл Сатыбалдиева',
    sellerId: 'seed-seller-2',
    sellerSince: '2022',
    createdAt: hoursAgo(4),
    views: 274,
    promoteTier: 'vip',
    status: 'active'
  },
  {
    id: 'kg-103',
    category: 'electronics',
    titleKg: 'iPhone 15 Pro 256GB Natural Titanium, кутусу жана кабелдери бар',
    titleRu: 'iPhone 15 Pro 256GB Natural Titanium, коробка и оригинал кабель',
    descriptionKg:
      'Америкадан келген оригинал iPhone 15 Pro, эс тутуму 256GB, батареясы 96%. Эч кандай чийиги жок, ачылган эмес, сууга түшкөн эмес. Кутусу, оригинал шнуру бар. Бишкек ичинде жеткирип беребиз же жолугуп текшерип алсаңыз болот.',
    descriptionRu:
      'Оригинальный iPhone 15 Pro (LL/A), память 256GB, ёмкость аккумулятора 96%. Без царапин, не вскрывался. В комплекте коробка и оригинальный кабель. Встреча и проверка в Бишкеке.',
    price: 78000,
    currency: 'KGS',
    negotiable: true,
    locationId: 'bishkek',
    images: ['/src/assets/images/listing_iphone_bishkek_1794982518109.jpg'],
    phone: '+996 (777) 29-90-14',
    hasWhatsapp: true,
    sellerName: 'Дастан Кубатов',
    sellerId: 'seed-seller-3',
    sellerSince: '2024',
    createdAt: hoursAgo(5),
    views: 412,
    promoteTier: 'vip',
    status: 'active'
  },
  {
    id: 'kg-104',
    category: 'animals',
    titleKg: 'Нарындын асыл тукум гиссар койлору жана кочкор сатылат',
    titleRu: 'Продаются племенные гиссарские овцы и баран-производитель в Нарыне',
    descriptionKg:
      'Нарын облусундагы жайытта багылган дени сак, семиз гиссар тукумундагы койлор жана 2 жашар асыл тукум кочкор сатылат. Баары эмдөөдөн өткөн, тукумга же союшка эң сонун. Дүңүнөн алганда баасын түшүрүп беребиз.',
    descriptionRu:
      'Продаются здоровые откормленные овцы гиссарской породы и племенной баран 2 лет с высокогорных пастбищ Нарына. Все прививки сделаны. Отлично подойдут на развод или на мясо. При покупке оптом — скидка.',
    price: 28000,
    currency: 'KGS',
    negotiable: true,
    locationId: 'naryn',
    images: ['/src/assets/images/listing_sheep_naryn_1794982517046.jpg'],
    phone: '+996 (702) 63-18-05',
    hasWhatsapp: true,
    sellerName: 'Талантбек Өмүралиев',
    sellerId: 'seed-seller-4',
    sellerSince: '2021',
    createdAt: hoursAgo(8),
    views: 196,
    promoteTier: 'top',
    status: 'active'
  },
  {
    id: 'kg-105',
    category: 'home_garden',
    titleKg: 'Караколдо колго жасалган нукура жүн шырдак 2×3 метр',
    titleRu: 'Натуральный войлочный шырдак ручной работы 2×3 м, Каракол',
    descriptionKg:
      'Ысык-Көл облусунда таза кой жүнүнөн колго тигилген салттуу кыргыз шырдагы. Өлчөмү 2×3 метр, боёктору өчпөйт, абдан калың жана жылуу. Боз үйгө, конок бөлмөгө же белекке эң сонун табылга. Бишкекке жана Ошко жөнөтүү бар.',
    descriptionRu:
      'Традиционный кыргызский шырдак ручной работы из 100% натуральной овечьей шерсти. Размер 2×3 м, стойкие природные оттенки, плотный и тёплый войлок. Отправка в Бишкек и Ош маршруткой или карго.',
    price: 24500,
    currency: 'KGS',
    negotiable: true,
    locationId: 'karakol',
    images: ['/src/assets/images/listing_shyrdak_karakol_1794982517868.jpg'],
    phone: '+996 (500) 74-22-91',
    hasWhatsapp: true,
    sellerName: 'Гүлмира Эсенгулова',
    sellerId: 'seed-seller-5',
    sellerSince: '2023',
    createdAt: hoursAgo(14),
    views: 129,
    promoteTier: 'none',
    status: 'active'
  },
  {
    id: 'kg-106',
    category: 'electronics',
    titleKg: 'MacBook Air M2 13.6" 16GB / 512GB Silver — таза, 35 цикл',
    titleRu: 'MacBook Air M2 13.6" 16GB / 512GB Silver — идеальный, 35 циклов',
    descriptionKg:
      'Токмок шаарында. Программалоо жана дизайн үчүн эң ыңгайлуу ноутбук. 16GB оперативдик эс тутум, 512GB SSD. Батареясы болгону 35 цикл, 15 саатка чейин жетет. Оригинал MagSafe кубаттагычы бар. Бишкекке жеткирип бере алам.',
    descriptionRu:
      'Находится в Токмоке. Отличный ноутбук для разработки и дизайна: 16GB RAM, 512GB SSD. Всего 35 циклов зарядки, держит до 15 часов. Оригинальное зарядное устройство MagSafe в комплекте.',
    price: 84000,
    currency: 'KGS',
    negotiable: false,
    locationId: 'tokmok',
    images: ['/src/assets/images/listing_macbook_tokmok_1794982518706.jpg'],
    phone: '+996 (708) 19-44-67',
    hasWhatsapp: true,
    sellerName: 'Эрлан Жумабеков',
    sellerId: 'seed-seller-6',
    sellerSince: '2024',
    createdAt: hoursAgo(19),
    views: 87,
    promoteTier: 'none',
    status: 'active'
  },
  {
    id: 'kg-107',
    category: 'animals',
    titleKg: 'Таластан таза кандуу тору мингич ат (5 жаш), улакка даяр',
    titleRu: 'Чистокровный гнедой жеребец 5 лет в Таласе, обучен под улак',
    descriptionKg:
      'Талас облусунда багылган 5 жаштагы тору ат. Бою бийик, тынч мүнөздүү, минип жүрүүгө жана көк бөрүгө мыкты үйрөтүлгөн. Ден соолугу чың, буттары таза. Келип көрүп кетсеңиз болот.',
    descriptionRu:
      'Гнедой конь 5 лет в Таласе. Высокий рост, спокойный нрав, хорошо обучен для верховой езды и кок-бору. Полностью здоров, можно приехать и посмотреть на месте.',
    price: 145000,
    currency: 'KGS',
    negotiable: true,
    locationId: 'talas',
    images: ['/src/assets/images/listing_horse_talas_1794982518952.jpg'],
    phone: '+996 (771) 52-09-33',
    hasWhatsapp: true,
    sellerName: 'Нурбек Батыров',
    sellerId: 'seed-seller-7',
    sellerSince: '2022',
    createdAt: hoursAgo(27),
    views: 254,
    promoteTier: 'none',
    status: 'active'
  },
  {
    id: 'kg-108',
    category: 'transport',
    titleKg: 'Hyundai Porter II, 2015-ж., дизель 2.5 CRDi — Жалал-Абад',
    titleRu: 'Hyundai Porter II, 2015 г., дизель 2.5 CRDi — Джалал-Абад',
    descriptionKg:
      'Кореядан жаңы келген, Жалал-Абадда турат. Рамасы таза, чирик жок, дөңгөлөктөрү жаңы, кузову узун (супер). Ишке толук даяр, соодалашуу бар.',
    descriptionRu:
      'Свежепригнан из Кореи, находится в Джалал-Абаде. Рама целая без ржавчины, новая резина, длинная база. Полностью готов к работе, торг уместен.',
    price: 11200,
    currency: 'USD',
    negotiable: true,
    locationId: 'jalal_abad',
    images: ['/src/assets/images/listing_porter_jalalabad_1794982519498.jpg'],
    phone: '+996 (550) 37-88-12',
    hasWhatsapp: true,
    sellerName: 'Рустам Кадыров',
    sellerId: 'seed-seller-8',
    sellerSince: '2023',
    createdAt: hoursAgo(32),
    views: 183,
    promoteTier: 'none',
    status: 'active'
  }
];
