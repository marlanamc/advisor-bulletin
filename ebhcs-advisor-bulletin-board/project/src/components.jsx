// components.jsx — shared UI atoms
// Phone-frame internal components for the EBHCS bulletin redesign.

const I18N = {
  feed: { EN: 'Home', ES: 'Inicio' },
  resources: { EN: 'Help', ES: 'Ayuda' },
  calendar: { EN: 'Dates', ES: 'Fechas' },
  about: { EN: 'About', ES: 'Acerca' },
  saved: { EN: 'Saved', ES: 'Guardado' },
  search: { EN: 'Search for help…', ES: 'Buscar ayuda…' },
  call: { EN: 'Call', ES: 'Llamar' },
  directions: { EN: 'Directions', ES: 'Cómo llegar' },
  open: { EN: 'Open', ES: 'Abrir' },
  message: { EN: 'Message', ES: 'Enviar' },
  link: { EN: 'Open link', ES: 'Abrir' },
  readmore: { EN: 'Read full post', ES: 'Ver más' },
  share: { EN: 'Share', ES: 'Compartir' },
  save: { EN: 'Save', ES: 'Guardar' },
  saved2: { EN: 'Saved', ES: 'Guardado' },
  postedBy: { EN: 'Posted by', ES: 'Publicado por' },
  due: { EN: 'Due', ES: 'Fecha' },
  newPost: { EN: 'New', ES: 'Nuevo' },
  allHelp: { EN: 'All help in one place', ES: 'Toda la ayuda aquí' },
  tapAny: { EN: 'Tap any picture for help', ES: 'Toca una imagen' },
};
const t = (k, lang) => (I18N[k] || {})[lang] || (I18N[k] || {}).EN || k;

// ─── Status / chrome bar inside the phone ────────────────────
function PhoneTopBar({ lang, setLang, title = 'EBHCS', sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px 12px', background: '#0a1d3a',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'linear-gradient(135deg, #2e7af0, #7eb1ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'Outfit', fontWeight: 800, fontSize: 17,
          boxShadow: '0 4px 10px rgba(46,122,240,0.4)',
        }}>⚓</div>
        <div>
          <div style={{ color: '#fff', fontFamily: 'Outfit', fontWeight: 700, fontSize: 17, lineHeight: 1.1 }}>{title}</div>
          {sub && <div style={{ color: '#7eb1ff', fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{sub}</div>}
        </div>
      </div>
      <LangPill lang={lang} setLang={setLang} />
    </div>
  );
}

function LangPill({ lang, setLang }) {
  const codes = ['EN', 'ES'];
  return (
    <div style={{
      display: 'flex', background: 'rgba(255,255,255,0.1)',
      borderRadius: 999, padding: 3, gap: 2,
    }}>
      {codes.map(c => (
        <button key={c} onClick={() => setLang(c)} style={{
          border: 'none', background: lang === c ? '#fff' : 'transparent',
          color: lang === c ? '#0a1d3a' : '#a9c8ff',
          padding: '6px 12px', borderRadius: 999, fontWeight: 700,
          fontSize: 12, fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer',
        }}>{c}</button>
      ))}
    </div>
  );
}

// ─── Bottom tab bar ──────────────────────────────────────────
const NAV_TABS = [
  { id: 'feed', label: 'Home', labelEs: 'Inicio', icon: <path d="M4 12 L12 4 L20 12 M6 10 L6 20 L10 20 L10 14 L14 14 L14 20 L18 20 L18 10" /> },
  { id: 'resources', label: 'Help', labelEs: 'Ayuda', icon: <><circle cx="12" cy="12" r="9" /><path d="M9 10 a3 3 0 1 1 5 2 c-1 1-2 1-2 3" /><circle cx="12" cy="17" r=".7" fill="currentColor" /></> },
  { id: 'calendar', label: 'Dates', labelEs: 'Fechas', icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10 h16 M9 3 v4 M15 3 v4" /></> },
  { id: 'about', label: 'About', labelEs: 'Info', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7 v.01 M12 11 v6" strokeLinecap="round" /></> },
];

function BottomNav({ active, onChange, lang }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderTop: '1px solid #e2e8f0',
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
      paddingBottom: 22, paddingTop: 8,
    }}>
      {NAV_TABS.map(tab => {
        const on = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 0',
            color: on ? '#2e7af0' : '#475569',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={on ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
              {tab.icon}
            </svg>
            <span style={{
              fontSize: 11, fontWeight: on ? 800 : 600,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}>{lang === 'ES' ? tab.labelEs : tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Story bubble (resource category quick access) ───────────
function StoryBubble({ cat, lang, onTap }) {
  const meta = CAT_META[cat];
  return (
    <button onClick={onTap} style={{
      border: 'none', background: 'transparent', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: 0, flexShrink: 0, width: 76,
    }}>
      <div style={{
        width: 70, height: 70, borderRadius: '50%', padding: 3,
        background: `conic-gradient(from 200deg, ${meta.accent}, #ffc857, ${meta.accent})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: '#fff', padding: 4, boxSizing: 'border-box',
        }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
            <CategoryIcon id={cat} size={56} />
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#0a1d3a',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        textAlign: 'center', lineHeight: 1.15,
        maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{lang === 'ES' ? meta.es : meta.en}</div>
    </button>
  );
}

// ─── Action button (inside post card / resource) ────────────
const ACTION_ICON = {
  call: <><path d="M3 5 a2 2 0 0 1 2-2 h2 l2 5 l-2.5 1.5 a11 11 0 0 0 6 6 L14 13 l5 2 v2 a2 2 0 0 1-2 2 A16 16 0 0 1 3 5 Z" /></>,
  directions: <><circle cx="12" cy="10" r="3" /><path d="M12 21 s7-7 7-11 a7 7 0 1 0-14 0 c0 4 7 11 7 11 Z" /></>,
  link: <><path d="M9 15 L20 4 M14 4 h6 v6" /></>,
  message: <><path d="M4 5 a2 2 0 0 1 2-2 h12 a2 2 0 0 1 2 2 v9 a2 2 0 0 1-2 2 H10 l-4 4 v-4 H6 a2 2 0 0 1-2-2 Z" /></>,
};

function ActionButton({ kind, label, sub, primary, accent = '#2e7af0' }) {
  return (
    <button style={{
      border: primary ? 'none' : `1.5px solid ${accent}`,
      background: primary ? accent : '#fff',
      color: primary ? '#fff' : accent,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
      cursor: 'pointer', flex: 1, minHeight: 56,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      textAlign: 'left',
      boxShadow: primary ? `0 4px 12px ${accent}40` : 'none',
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {ACTION_ICON[kind] || ACTION_ICON.link}
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.1 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </button>
  );
}

// ─── Post card (full-width, Instagram-feel) ──────────────────
function PostCard({ post, lang, onOpen, onSave }) {
  const meta = CAT_META[post.category];
  const title = lang === 'ES' && post.titleEs ? post.titleEs : post.title;
  const summary = lang === 'ES' && post.summaryEs ? post.summaryEs : post.summary;
  const deadline = lang === 'ES' && post.deadlineEs ? post.deadlineEs : post.deadline;

  return (
    <article style={{
      background: '#fff', borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 8px 24px rgba(10,29,58,0.06)',
      marginBottom: 16,
    }}>
      {/* Header strip */}
      <div style={{
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: meta.accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Outfit', fontWeight: 800, fontSize: 16,
        }}>{post.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0a1d3a' }}>
            {post.advisor} · <span style={{ color: meta.accent }}>{lang === 'ES' ? meta.es : meta.en}</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{post.posted} ago</div>
        </div>
        <button onClick={onSave} aria-label="Save" style={{
          border: 'none', background: 'transparent', cursor: 'pointer', padding: 6,
          color: post.saved ? '#e88a2a' : '#475569',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={post.saved ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4 a1 1 0 0 1 1-1 h12 a1 1 0 0 1 1 1 v17 l-7-4 l-7 4 Z" />
          </svg>
        </button>
      </div>

      {/* Hero */}
      <div style={{ height: 160, position: 'relative' }}>
        <PostHero category={post.category} accent={meta.accent} />
        {post.deadlineUrgent && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: '#0a1d3a', color: '#ffc857',
            padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: '#ffc857' }} />
            {lang === 'ES' ? 'Pronto' : 'Soon'}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px 16px' }}>
        <h3 style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 19, fontWeight: 800,
          color: '#0a1d3a', lineHeight: 1.2, margin: 0,
          textWrap: 'pretty',
        }}>{title}</h3>
        <p style={{
          fontSize: 14.5, color: '#334155', margin: '8px 0 0', lineHeight: 1.45,
          textWrap: 'pretty',
        }}>{summary}</p>

        {deadline && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: post.deadlineUrgent ? '#fff5e8' : '#f1f5f9',
            border: `1px solid ${post.deadlineUrgent ? '#ffd99e' : '#e2e8f0'}`,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={post.deadlineUrgent ? '#c2410c' : '#475569'} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7 v5 l3 2" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 700, color: post.deadlineUrgent ? '#9a3412' : '#334155' }}>{deadline}</div>
          </div>
        )}

        {post.actions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {post.actions.slice(0, 2).map((a, i) => (
              <ActionButton key={i} {...a} primary={i === 0} accent={meta.accent} />
            ))}
          </div>
        )}

        <button onClick={onOpen} style={{
          width: '100%', marginTop: 12, padding: '12px',
          background: 'transparent', border: 'none',
          color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>{t('readmore', lang)} →</button>
      </div>
    </article>
  );
}

Object.assign(window, {
  PhoneTopBar, LangPill, BottomNav, StoryBubble, ActionButton, PostCard,
  NAV_TABS, I18N, t,
});
