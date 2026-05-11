// screens.jsx — main app screens for the redesigned bulletin board

const STORY_CATS = ['immigration', 'job', 'housing', 'health', 'food', 'esol', 'college', 'money', 'childcare', 'career-fair'];

// ─── FEED ─────────────────────────────────────────────────────
function FeedScreen({ lang, onOpenPost, onOpenCategory, posts }) {
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100%', paddingBottom: 90 }}>
      {/* Search row */}
      <div style={{ padding: '12px 14px 8px', background: '#fff' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#f1f5f9', borderRadius: 14, padding: '12px 14px',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m17 17 4 4" />
          </svg>
          <span style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>{t('search', lang)}</span>
        </div>
      </div>

      {/* Stories — resource categories */}
      <div style={{
        background: '#fff', padding: '4px 0 14px',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{
          padding: '8px 14px 4px', fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          color: '#475569', textTransform: 'uppercase',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>{t('tapAny', lang)}</span>
        </div>
        <div style={{
          display: 'flex', gap: 12, padding: '4px 14px', overflowX: 'auto',
        }}>
          {STORY_CATS.map(c => (
            <StoryBubble key={c} cat={c} lang={lang} onTap={() => onOpenCategory(c)} />
          ))}
        </div>
      </div>

      {/* Feed */}
      <div style={{ padding: '14px 12px' }}>
        <div style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 800,
          color: '#0a1d3a', textTransform: 'uppercase', letterSpacing: 0.6,
          padding: '4px 4px 10px',
        }}>
          {lang === 'ES' ? 'Nuevo de tus consejeros' : 'New from your advisors'}
        </div>
        {posts.map(p => (
          <PostCard key={p.id} post={p} lang={lang}
            onOpen={() => onOpenPost(p)} onSave={() => {}} />
        ))}
      </div>
    </div>
  );
}

// ─── RESOURCES ────────────────────────────────────────────────
function ResourcesScreen({ lang, onOpenCategory }) {
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100%', paddingBottom: 90 }}>
      <div style={{
        padding: '20px 16px 24px',
        background: 'linear-gradient(180deg, #0a1d3a 0%, #15315e 100%)',
        color: '#fff',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
          color: '#7eb1ff', textTransform: 'uppercase',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          {lang === 'ES' ? 'Recursos' : 'Resources'}
        </div>
        <h1 style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 30, fontWeight: 800,
          margin: '4px 0 6px', textWrap: 'pretty', lineHeight: 1.05,
        }}>{lang === 'ES' ? 'Encuentra ayuda hoy' : 'Find help today'}</h1>
      </div>

      <div style={{ padding: '16px 12px 0' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {CATEGORIES_ORDER.map(c => {
            const meta = CAT_META[c];
            const count = RESOURCES.filter(r => r.cat === c).length;
            return (
              <button key={c} onClick={() => onOpenCategory(c)} style={{
                border: 'none', background: '#fff', borderRadius: 18, padding: 14,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
                textAlign: 'left', cursor: 'pointer', minHeight: 156,
                boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 6px 16px rgba(10,29,58,0.05)',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>
                <div style={{ width: 56, height: 56 }}><CategoryIcon id={c} size={56} /></div>
                <div>
                  <div style={{
                    fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 800,
                    color: '#0a1d3a', lineHeight: 1.1,
                  }}>{lang === 'ES' ? meta.es : meta.en}</div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 4 }}>
                    {count} {count === 1 ? 'place' : 'places'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{
          marginTop: 18, padding: 16, background: '#fff8eb',
          border: '1.5px solid #ffc857', borderRadius: 16,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{ width: 40, height: 40, flexShrink: 0 }}>
            <CategoryIcon id="announcement" size={40} />
          </div>
          <div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: '#7c2d12', fontSize: 15 }}>
              {lang === 'ES' ? '¿No encuentras algo?' : "Can't find what you need?"}
            </div>
            <div style={{ fontSize: 13, color: '#92400e', marginTop: 2 }}>
              {lang === 'ES' ? 'Llama a la escuela: 617-635-5114' : 'Call the school: 617-635-5114'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RESOURCE CATEGORY DETAIL ─────────────────────────────────
function ResourceCategoryScreen({ cat, lang, onBack }) {
  const meta = CAT_META[cat];
  const list = RESOURCES.filter(r => r.cat === cat);
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100%', paddingBottom: 90 }}>
      <div style={{
        padding: '14px 16px 22px',
        background: `linear-gradient(180deg, ${meta.accent} 0%, ${meta.heroBot} 100%)`,
      }}>
        <button onClick={onBack} style={{
          border: 'none', background: 'rgba(255,255,255,0.2)',
          color: '#fff', borderRadius: 999, padding: '8px 14px',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>← {lang === 'ES' ? 'Atrás' : 'Back'}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <div style={{ width: 64, height: 64 }}><CategoryIcon id={cat} size={64} /></div>
          <div style={{ color: '#fff' }}>
            <h1 style={{
              fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 800,
              margin: 0, lineHeight: 1.05,
            }}>{lang === 'ES' ? meta.es : meta.en}</h1>
            <div style={{ fontSize: 13, opacity: 0.92, fontWeight: 600 }}>
              {list.length} {lang === 'ES' ? 'lugares cerca' : 'places nearby'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 12px' }}>
        {list.map(r => <ResourceCard key={r.id} r={r} lang={lang} accent={meta.accent} />)}
      </div>
    </div>
  );
}

function ResourceCard({ r, lang, accent }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12,
      boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 6px 16px rgba(10,29,58,0.05)',
    }}>
      <div style={{
        fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 800,
        color: '#0a1d3a', lineHeight: 1.2,
      }}>{r.name}</div>
      <p style={{ fontSize: 14, color: '#334155', margin: '4px 0 12px', lineHeight: 1.45 }}>
        {r.desc}
      </p>

      {r.address && (
        <div style={{
          fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 10, fontWeight: 600,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21 s7-7 7-11 a7 7 0 1 0-14 0 c0 4 7 11 7 11 Z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {r.address}
        </div>
      )}

      {r.languages && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {r.languages.map(l => (
            <span key={l} style={{
              fontSize: 10.5, fontWeight: 800,
              background: '#f1f5f9', color: '#475569',
              padding: '3px 8px', borderRadius: 999,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}>{l}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {r.phone && (
          <ActionButton kind="call" label={lang === 'ES' ? 'Llamar' : 'Call'}
            sub={r.phone} primary accent={accent} />
        )}
        {r.address && (
          <ActionButton kind="directions" label={lang === 'ES' ? 'Cómo llegar' : 'Directions'}
            sub={r.address} accent={accent} />
        )}
        {r.url && !r.phone && !r.address && (
          <ActionButton kind="link" label={lang === 'ES' ? 'Abrir sitio' : 'Open site'}
            sub={r.url} primary accent={accent} />
        )}
        {r.url && (r.phone || r.address) && (
          <ActionButton kind="link" label={lang === 'ES' ? 'Sitio web' : 'Website'}
            sub={r.url} accent={accent} />
        )}
      </div>
    </div>
  );
}

// ─── CALENDAR ─────────────────────────────────────────────────
function CalendarScreen({ lang, onOpenPost }) {
  const dated = POSTS.filter(p => p.deadline);
  const grouped = [
    { label: 'This week', labelEs: 'Esta semana', items: dated.slice(0, 3) },
    { label: 'Next week', labelEs: 'Próxima semana', items: dated.slice(3) },
  ];
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100%', paddingBottom: 90 }}>
      <div style={{
        padding: '20px 16px 24px',
        background: 'linear-gradient(180deg, #0a1d3a 0%, #15315e 100%)', color: '#fff',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
          color: '#7eb1ff', textTransform: 'uppercase',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>{lang === 'ES' ? 'Fechas' : 'Important dates'}</div>
        <h1 style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 28, fontWeight: 800,
          margin: '4px 0 6px', lineHeight: 1.1,
        }}>{lang === 'ES' ? 'No te pierdas nada' : "Don't miss a thing"}</h1>
      </div>

      <div style={{ padding: '14px 12px' }}>
        {grouped.map(g => (
          <div key={g.label} style={{ marginBottom: 18 }}>
            <div style={{
              fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 800,
              color: '#0a1d3a', textTransform: 'uppercase', letterSpacing: 0.6,
              padding: '4px 4px 10px',
            }}>{lang === 'ES' ? g.labelEs : g.label}</div>
            {g.items.map(p => {
              const meta = CAT_META[p.category];
              const deadline = lang === 'ES' && p.deadlineEs ? p.deadlineEs : p.deadline;
              const title = lang === 'ES' && p.titleEs ? p.titleEs : p.title;
              return (
                <button key={p.id} onClick={() => onOpenPost(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  background: '#fff', border: 'none', borderRadius: 16, padding: 14,
                  marginBottom: 8, cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 12px rgba(10,29,58,0.04)',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  <div style={{
                    width: 56, height: 64, borderRadius: 12,
                    background: meta.tint, color: meta.accent,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {p.deadline.split(' ')[1] || 'May'}
                    </div>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
                      {(p.deadline.match(/\d+/) || ['—'])[0]}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: meta.accent,
                      textTransform: 'uppercase', letterSpacing: 0.4,
                    }}>{lang === 'ES' ? meta.es : meta.en}</div>
                    <div style={{
                      fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 16,
                      color: '#0a1d3a', lineHeight: 1.15, marginTop: 2,
                    }}>{title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 600 }}>{deadline}</div>
                  </div>
                  {p.deadlineUrgent && (
                    <span style={{
                      width: 10, height: 10, borderRadius: 99, background: '#e88a2a',
                      flexShrink: 0,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ABOUT ────────────────────────────────────────────────────
function AboutScreen({ lang }) {
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100%', paddingBottom: 90 }}>
      <div style={{
        padding: '24px 16px 28px',
        background: 'linear-gradient(180deg, #0a1d3a 0%, #15315e 100%)', color: '#fff',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg, #2e7af0, #7eb1ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, marginBottom: 12, boxShadow: '0 8px 24px rgba(46,122,240,0.4)',
        }}>⚓</div>
        <h1 style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 800,
          margin: 0, lineHeight: 1.1,
        }}>East Boston Harborside</h1>
        <div style={{ color: '#a9c8ff', fontSize: 14, fontWeight: 600, marginTop: 4 }}>
          Community School · Adult Education
        </div>
      </div>

      <div style={{ padding: '14px 12px' }}>
        <AboutAction icon="directions" title="312 Border Street"
          sub="East Boston, MA 02128 · Inside Mario Umana Academy"
          cta={lang === 'ES' ? 'Cómo llegar' : 'Get directions'} accent="#2e7af0" />
        <AboutAction icon="call" title="617-635-5114"
          sub={lang === 'ES' ? 'Llama a la oficina' : 'Call the school office'}
          cta={lang === 'ES' ? 'Llamar' : 'Call'} accent="#1aa37a" />
        <AboutAction icon="message" title="mcreed@ebhcs.org"
          sub={lang === 'ES' ? 'Reportar problema' : 'Report a problem'}
          cta={lang === 'ES' ? 'Email' : 'Email'} accent="#7b4ec7" />
        <AboutAction icon="link" title="ebhcs.org"
          sub={lang === 'ES' ? 'Sitio web de la escuela' : 'School website'}
          cta={lang === 'ES' ? 'Abrir' : 'Open'} accent="#e88a2a" />

        <div style={{
          marginTop: 16, padding: 16, background: '#fff', borderRadius: 16,
          boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 12px rgba(10,29,58,0.04)',
        }}>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: '#0a1d3a', fontSize: 15 }}>
            {lang === 'ES' ? 'Para consejeros' : 'For advisors'}
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
            {lang === 'ES' ? 'Inicia sesión para publicar.' : 'Sign in to post a bulletin.'}
          </div>
          <button style={{
            marginTop: 12, width: '100%', padding: '12px',
            background: '#0a1d3a', color: '#ffc857', border: 'none', borderRadius: 12,
            fontWeight: 800, fontSize: 14, cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>⛵ {lang === 'ES' ? 'Portal de consejeros' : 'Advisor Portal'}</button>
        </div>
      </div>
    </div>
  );
}

function AboutAction({ icon, title, sub, cta, accent }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 12px rgba(10,29,58,0.04)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: accent,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ACTION_ICON[icon]}
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: '#0a1d3a', fontSize: 15, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 500 }}>{sub}</div>
      </div>
      <button style={{
        background: 'transparent', border: `1.5px solid ${accent}`, color: accent,
        borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 800,
        fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer', flexShrink: 0,
      }}>{cta}</button>
    </div>
  );
}

// ─── POST DETAIL ──────────────────────────────────────────────
function PostDetailScreen({ post, lang, onBack }) {
  const meta = CAT_META[post.category];
  const title = lang === 'ES' && post.titleEs ? post.titleEs : post.title;
  const summary = lang === 'ES' && post.summaryEs ? post.summaryEs : post.summary;
  const deadline = lang === 'ES' && post.deadlineEs ? post.deadlineEs : post.deadline;
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100%', paddingBottom: 90 }}>
      <div style={{ position: 'relative', height: 220 }}>
        <PostHero category={post.category} accent={meta.accent} />
        <button onClick={onBack} style={{
          position: 'absolute', top: 12, left: 12,
          width: 40, height: 40, borderRadius: 999,
          background: 'rgba(10,29,58,0.7)', border: 'none', color: '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12 H5 M12 5 l-7 7 7 7" />
          </svg>
        </button>
      </div>

      <div style={{
        background: '#fff', marginTop: -20, borderRadius: '20px 20px 0 0',
        padding: '20px 16px', position: 'relative',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          color: meta.accent, textTransform: 'uppercase',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>{lang === 'ES' ? meta.es : meta.en}</div>
        <h1 style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 800,
          color: '#0a1d3a', lineHeight: 1.1, margin: '4px 0 10px',
          textWrap: 'pretty',
        }}>{title}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: meta.accent, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Outfit', fontWeight: 800, fontSize: 13,
          }}>{post.avatar}</div>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <strong style={{ color: '#0a1d3a' }}>{post.advisor}</strong> · {post.posted} ago
          </div>
        </div>

        {deadline && (
          <div style={{
            padding: '12px 14px',
            background: post.deadlineUrgent ? 'linear-gradient(90deg, #fff5e8, #ffe2c2)' : '#f1f5f9',
            border: `1.5px solid ${post.deadlineUrgent ? '#e88a2a' : '#e2e8f0'}`,
            borderRadius: 14, marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={post.deadlineUrgent ? '#c2410c' : '#475569'} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" /><path d="M12 7 v5 l3 2" />
            </svg>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: post.deadlineUrgent ? '#9a3412' : '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {lang === 'ES' ? 'Fecha importante' : 'Important date'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: post.deadlineUrgent ? '#7c2d12' : '#0a1d3a' }}>{deadline}</div>
            </div>
          </div>
        )}

        <p style={{
          fontSize: 16, color: '#334155', lineHeight: 1.55, margin: '0 0 8px',
          textWrap: 'pretty',
        }}>{summary}</p>
        <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.55, margin: '0 0 18px' }}>
          {lang === 'ES'
            ? 'Si tienes preguntas, llama a la oficina o pregúntale a tu consejero. Estamos aquí para ayudarte.'
            : 'If you have questions, call the office or ask your advisor. We are here to help you.'}
        </p>

        {post.tags && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
            {post.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 12, fontWeight: 700,
                background: meta.tint, color: meta.accent,
                padding: '6px 10px', borderRadius: 999,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>{tag}</span>
            ))}
          </div>
        )}

        {post.actions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {post.actions.map((a, i) => (
              <ActionButton key={i} {...a} primary={i === 0} accent={meta.accent} />
            ))}
          </div>
        )}

        <button style={{
          marginTop: 12, width: '100%', padding: '14px',
          background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 14,
          color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M9 5 a3 3 0 1 0 0 .1 M15 19 a3 3 0 1 0 0 -.1 M9 12 l6-6 M9 12 l6 6" />
          </svg>
          {lang === 'ES' ? 'Compartir con un amigo' : 'Share with a friend'}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  FeedScreen, ResourcesScreen, ResourceCategoryScreen, ResourceCard,
  CalendarScreen, AboutScreen, PostDetailScreen, STORY_CATS,
});
