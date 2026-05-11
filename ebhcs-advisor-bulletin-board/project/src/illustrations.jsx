// illustrations.jsx — custom illustrated category icons
// Consistent style: 80x80 viewBox, squircle bg, simple geometric subject.

const Squircle = ({ fill, children }) => (
  <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
    <defs>
      <clipPath id="squircleClip">
        <path d="M40 0 C70 0, 80 10, 80 40 C80 70, 70 80, 40 80 C10 80, 0 70, 0 40 C0 10, 10 0, 40 0 Z" />
      </clipPath>
    </defs>
    <rect width="80" height="80" rx="22" fill={fill} />
    {children}
  </svg>
);

// Each illustration uses 2-3 layered shapes. Subject is centered around 40,40.
const IconJobs = () => (
  <Squircle fill="#1f3d7a">
    {/* briefcase */}
    <rect x="22" y="32" width="36" height="26" rx="5" fill="#fff" />
    <rect x="32" y="26" width="16" height="8" rx="3" fill="#fff" />
    <rect x="22" y="40" width="36" height="3" fill="#1f3d7a" opacity="0.25" />
    <circle cx="40" cy="46" r="2.5" fill="#ffc857" />
  </Squircle>
);

const IconImmigration = () => (
  <Squircle fill="#0d8a7a">
    {/* globe */}
    <circle cx="40" cy="40" r="18" fill="#fff" />
    <ellipse cx="40" cy="40" rx="9" ry="18" fill="none" stroke="#0d8a7a" strokeWidth="2" />
    <line x1="22" y1="40" x2="58" y2="40" stroke="#0d8a7a" strokeWidth="2" />
    <line x1="40" y1="22" x2="40" y2="58" stroke="#0d8a7a" strokeWidth="2" />
  </Squircle>
);

const IconHousing = () => (
  <Squircle fill="#d96a4a">
    {/* house */}
    <path d="M40 18 L60 36 L60 60 L20 60 L20 36 Z" fill="#fff" />
    <rect x="34" y="44" width="12" height="16" rx="2" fill="#d96a4a" />
    <rect x="38" y="51" width="2" height="2" fill="#ffc857" />
  </Squircle>
);

const IconHealth = () => (
  <Squircle fill="#e0497d">
    {/* heart with cross */}
    <path d="M40 60 C18 46, 22 26, 32 24 C36 23, 39 26, 40 28 C41 26, 44 23, 48 24 C58 26, 62 46, 40 60 Z" fill="#fff" />
    <rect x="37" y="34" width="6" height="14" rx="1" fill="#e0497d" />
    <rect x="33" y="38" width="14" height="6" rx="1" fill="#e0497d" />
  </Squircle>
);

const IconFood = () => (
  <Squircle fill="#2d8a4a">
    {/* basket / apple */}
    <path d="M28 36 L52 36 L48 60 L32 60 Z" fill="#fff" />
    <rect x="26" y="34" width="28" height="5" rx="2" fill="#fff" />
    <path d="M36 36 C36 30, 44 30, 44 36" stroke="#fff" strokeWidth="2" fill="none" />
    <circle cx="40" cy="48" r="4" fill="#d96a4a" />
  </Squircle>
);

const IconChildcare = () => (
  <Squircle fill="#c08a3e">
    {/* big & small figure */}
    <circle cx="32" cy="32" r="6" fill="#fff" />
    <path d="M22 56 C22 46, 42 46, 42 56 Z" fill="#fff" />
    <circle cx="52" cy="40" r="4" fill="#fff" />
    <path d="M46 58 C46 50, 58 50, 58 58 Z" fill="#fff" />
  </Squircle>
);

const IconESOL = () => (
  <Squircle fill="#7b4ec7">
    {/* speech bubbles */}
    <path d="M20 26 C20 22, 22 20, 26 20 L46 20 C50 20, 52 22, 52 26 L52 36 C52 40, 50 42, 46 42 L32 42 L26 48 L26 42 C22 42, 20 40, 20 36 Z" fill="#fff" />
    <text x="36" y="34" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7b4ec7" fontFamily="Outfit, sans-serif">ABC</text>
    <circle cx="56" cy="50" r="6" fill="#fff" opacity="0.7" />
  </Squircle>
);

const IconCollege = () => (
  <Squircle fill="#0a1d3a">
    {/* graduation cap */}
    <path d="M16 36 L40 26 L64 36 L40 46 Z" fill="#fff" />
    <path d="M28 41 L28 52 C28 56, 52 56, 52 52 L52 41" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    <circle cx="62" cy="38" r="2" fill="#ffc857" />
    <line x1="62" y1="40" x2="62" y2="50" stroke="#ffc857" strokeWidth="2" />
  </Squircle>
);

const IconCareerFair = () => (
  <Squircle fill="#e88a2a">
    {/* handshake */}
    <rect x="18" y="38" width="20" height="6" rx="3" fill="#fff" transform="rotate(-15 28 41)" />
    <rect x="42" y="38" width="20" height="6" rx="3" fill="#fff" transform="rotate(15 52 41)" />
    <circle cx="40" cy="42" r="6" fill="#fff" />
    <circle cx="40" cy="42" r="3" fill="#e88a2a" />
  </Squircle>
);

const IconMoney = () => (
  <Squircle fill="#1aa37a">
    {/* coin stack */}
    <ellipse cx="40" cy="54" rx="18" ry="5" fill="#fff" />
    <rect x="22" y="44" width="36" height="10" fill="#fff" />
    <ellipse cx="40" cy="44" rx="18" ry="5" fill="#fff" />
    <rect x="22" y="34" width="36" height="10" fill="#fff" />
    <ellipse cx="40" cy="34" rx="18" ry="5" fill="#fff" />
    <text x="40" y="38" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1aa37a" fontFamily="Outfit, sans-serif">$</text>
  </Squircle>
);

const IconAnnounce = () => (
  <Squircle fill="#2e7af0">
    {/* megaphone */}
    <path d="M22 36 L42 28 L42 52 L22 44 Z" fill="#fff" />
    <rect x="42" y="34" width="14" height="12" rx="3" fill="#fff" />
    <circle cx="58" cy="40" r="3" fill="#ffc857" />
  </Squircle>
);

// Map by id
const ICONS = {
  job: IconJobs,
  immigration: IconImmigration,
  housing: IconHousing,
  health: IconHealth,
  food: IconFood,
  childcare: IconChildcare,
  esol: IconESOL,
  college: IconCollege,
  'career-fair': IconCareerFair,
  money: IconMoney,
  announcement: IconAnnounce,
  training: IconESOL,
};

const CategoryIcon = ({ id, size = 56 }) => {
  const Comp = ICONS[id] || IconAnnounce;
  return <div style={{ width: size, height: size, flexShrink: 0 }}><Comp /></div>;
};

// Decorative full-bleed post header illustration. Renders a soft scenic
// composition keyed off the post's category. ~16:9.
const PostHero = ({ category, accent }) => {
  const C = CAT_META[category] || CAT_META.announcement;
  return (
    <svg viewBox="0 0 400 220" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`heroG-${category}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.heroTop} />
          <stop offset="100%" stopColor={C.heroBot} />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#heroG-${category})`} />
      {/* sun / moon */}
      <circle cx="320" cy="60" r="28" fill={C.sun} opacity="0.9" />
      {/* horizon rolling shapes (harbor) */}
      <path d="M0 160 Q 80 130 160 150 T 320 150 T 480 145 L 480 220 L 0 220 Z" fill={C.fg1} />
      <path d="M0 180 Q 100 160 200 175 T 400 170 L 400 220 L 0 220 Z" fill={C.fg2} />
      {/* big icon emblem */}
      <g transform="translate(40, 50)">
        <foreignObject x="0" y="0" width="100" height="100">
          <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: 100, height: 100 }}>
            <CategoryIcon id={category} size={100} />
          </div>
        </foreignObject>
      </g>
    </svg>
  );
};

// Category metadata - colors, labels (en/es)
const CAT_META = {
  announcement: { id: 'announcement', en: 'Announcements', es: 'Anuncios', short: 'News', accent: '#2e7af0', tint: '#dde9ff', heroTop: '#a9c8ff', heroBot: '#dde9ff', sun: '#fff8eb', fg1: '#7eb1ff', fg2: '#dde9ff' },
  job: { id: 'job', en: 'Jobs', es: 'Trabajos', short: 'Jobs', accent: '#1f3d7a', tint: '#e1e9f7', heroTop: '#7eb1ff', heroBot: '#e1e9f7', sun: '#ffc857', fg1: '#1f3d7a', fg2: '#5a7bb7' },
  training: { id: 'training', en: 'Training', es: 'Entrenamiento', short: 'Class', accent: '#7b4ec7', tint: '#ece4f9', heroTop: '#b89bea', heroBot: '#ece4f9', sun: '#fff', fg1: '#7b4ec7', fg2: '#c4afe7' },
  college: { id: 'college', en: 'College & GED', es: 'Universidad', short: 'School', accent: '#0a1d3a', tint: '#dde2eb', heroTop: '#5a7bb7', heroBot: '#dde2eb', sun: '#ffc857', fg1: '#0a1d3a', fg2: '#3a4f78' },
  immigration: { id: 'immigration', en: 'Immigration', es: 'Inmigración', short: 'Legal', accent: '#0d8a7a', tint: '#cfeee8', heroTop: '#5fc4b3', heroBot: '#cfeee8', sun: '#fff', fg1: '#0d8a7a', fg2: '#7fd4c6' },
  housing: { id: 'housing', en: 'Housing', es: 'Vivienda', short: 'Home', accent: '#d96a4a', tint: '#fbdcd1', heroTop: '#f0a78f', heroBot: '#fbdcd1', sun: '#fff8eb', fg1: '#d96a4a', fg2: '#f5b7a3' },
  health: { id: 'health', en: 'Health', es: 'Salud', short: 'Health', accent: '#e0497d', tint: '#fbd6e3', heroTop: '#f0a3bd', heroBot: '#fbd6e3', sun: '#fff', fg1: '#e0497d', fg2: '#f0a3bd' },
  food: { id: 'food', en: 'Food', es: 'Comida', short: 'Food', accent: '#2d8a4a', tint: '#cfead9', heroTop: '#7cc795', heroBot: '#cfead9', sun: '#ffc857', fg1: '#2d8a4a', fg2: '#9bd5af' },
  childcare: { id: 'childcare', en: 'Family', es: 'Familia', short: 'Family', accent: '#c08a3e', tint: '#f5e3c4', heroTop: '#e0bb7a', heroBot: '#f5e3c4', sun: '#fff', fg1: '#c08a3e', fg2: '#e0bb7a' },
  esol: { id: 'esol', en: 'English class', es: 'Clase de inglés', short: 'ESOL', accent: '#7b4ec7', tint: '#ece4f9', heroTop: '#b89bea', heroBot: '#ece4f9', sun: '#fff', fg1: '#7b4ec7', fg2: '#c4afe7' },
  'career-fair': { id: 'career-fair', en: 'Career Fair', es: 'Feria', short: 'Fair', accent: '#e88a2a', tint: '#fbe6cc', heroTop: '#f5c285', heroBot: '#fbe6cc', sun: '#fff', fg1: '#e88a2a', fg2: '#f5c285' },
  money: { id: 'money', en: 'Money help', es: 'Ayuda', short: 'Money', accent: '#1aa37a', tint: '#cfeee0', heroTop: '#6dcfa9', heroBot: '#cfeee0', sun: '#ffc857', fg1: '#1aa37a', fg2: '#9fdcc4' },
};

Object.assign(window, { CategoryIcon, PostHero, CAT_META, ICONS });
