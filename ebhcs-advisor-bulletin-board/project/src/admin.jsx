// admin.jsx — redesigned advisor portal screens

function AdminLoginScreen({ lang, onLogin }) {
  return (
    <div style={{
      minHeight: '100%', background: 'linear-gradient(180deg, #0a1d3a 0%, #15315e 100%)',
      padding: '40px 20px 90px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: 'linear-gradient(135deg, #2e7af0, #7eb1ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, marginBottom: 18, boxShadow: '0 12px 30px rgba(46,122,240,0.4)',
        alignSelf: 'flex-start',
      }}>⛵</div>
      <h1 style={{
        fontFamily: 'Outfit, sans-serif', fontSize: 30, fontWeight: 800,
        color: '#fff', margin: 0, lineHeight: 1.05,
      }}>Advisor Portal</h1>
      <p style={{ color: '#a9c8ff', fontSize: 15, marginTop: 6, fontWeight: 500 }}>
        Post bulletins for your students.
      </p>

      <div style={{
        background: '#fff', borderRadius: 20, padding: 20, marginTop: 28,
        boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
      }}>
        <Field label="Email" placeholder="jorge@ebhcs.org" />
        <Field label="Password" placeholder="••••••••" type="password" />

        <button onClick={onLogin} style={{
          width: '100%', padding: 16, marginTop: 6,
          background: '#0a1d3a', color: '#ffc857', border: 'none',
          borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          boxShadow: '0 6px 16px rgba(10,29,58,0.3)',
        }}>Sign in</button>

        <div style={{
          marginTop: 12, padding: 12, background: '#f1f5f9',
          borderRadius: 12, fontSize: 12, color: '#475569',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 8 v4 M12 16 v.01" />
          </svg>
          <div>Forgot your password? Email <strong>mcreed@ebhcs.org</strong></div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, type = 'text', value, onChange, multi, rows = 3 }) {
  const Tag = multi ? 'textarea' : 'input';
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: '#475569',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      }}>{label}</div>
      <Tag type={type} placeholder={placeholder} value={value || ''} onChange={onChange}
        rows={multi ? rows : undefined}
        style={{
          width: '100%', padding: '14px 14px',
          border: '1.5px solid #e2e8f0', borderRadius: 12,
          fontSize: 16, fontFamily: 'Plus Jakarta Sans, sans-serif',
          background: '#fff', color: '#0a1d3a', outline: 'none',
          resize: multi ? 'vertical' : undefined, boxSizing: 'border-box',
        }} />
    </label>
  );
}

function AdminComposeScreen({ onBack, onPreview }) {
  const [cat, setCat] = React.useState('job');
  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [deadline, setDeadline] = React.useState('');

  const meta = CAT_META[cat];
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100%', paddingBottom: 90 }}>
      <div style={{
        background: '#0a1d3a', color: '#fff', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{
          width: 38, height: 38, borderRadius: 999, background: 'rgba(255,255,255,0.1)',
          border: 'none', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12 H5 M12 5 l-7 7 7 7" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7eb1ff', letterSpacing: 0.5, textTransform: 'uppercase' }}>New post</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 18, fontWeight: 800 }}>Write a bulletin</div>
        </div>
      </div>

      <div style={{ padding: '16px 14px' }}>
        {/* Category picker - visible chips, not dropdown */}
        <div style={{
          fontSize: 12, fontWeight: 800, color: '#475569',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>1 · Pick a category</div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
          marginBottom: 18,
        }}>
          {['job', 'training', 'announcement', 'immigration', 'housing', 'health', 'food', 'career-fair'].map(c => {
            const m = CAT_META[c];
            const on = c === cat;
            return (
              <button key={c} onClick={() => setCat(c)} style={{
                border: on ? `2px solid ${m.accent}` : '1.5px solid #e2e8f0',
                background: on ? m.tint : '#fff', borderRadius: 12, padding: 8,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: 'pointer', minHeight: 76,
              }}>
                <div style={{ width: 36, height: 36 }}><CategoryIcon id={c} size={36} /></div>
                <div style={{
                  fontSize: 10, fontWeight: 800, color: on ? m.accent : '#475569',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  textAlign: 'center', lineHeight: 1.1,
                }}>{m.short}</div>
              </button>
            );
          })}
        </div>

        <div style={{
          fontSize: 12, fontWeight: 800, color: '#475569',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>2 · Write it simply</div>
        <Field label="Title (short, clear)" placeholder="Free CNA class starts in June"
          value={title} onChange={e => setTitle(e.target.value)} />
        <Field label="Summary (1-2 sentences)" multi rows={3}
          placeholder="Become a Certified Nursing Assistant. 8 weeks. Free."
          value={summary} onChange={e => setSummary(e.target.value)} />
        <Field label="Deadline (optional)" placeholder="May 30, 2026"
          value={deadline} onChange={e => setDeadline(e.target.value)} />

        <div style={{
          padding: 12, background: '#fff', borderRadius: 12, marginTop: 4, marginBottom: 14,
          border: '1.5px dashed #cbd5e1',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#dde9ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2e7af0',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" /><path d="M9 10 a3 3 0 1 1 5 2 c-1 1-2 1-2 3" /><circle cx="12" cy="17" r=".7" fill="currentColor" />
            </svg>
          </div>
          <div style={{ flex: 1, fontSize: 12, color: '#475569', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            <strong style={{ color: '#0a1d3a', fontSize: 13 }}>Auto-translate</strong><br/>
            Spanish version will be created from your text.
          </div>
        </div>

        {/* Live preview */}
        <div style={{
          fontSize: 12, fontWeight: 800, color: '#475569',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>3 · Preview · what students see</div>
        <div style={{
          background: '#fff', borderRadius: 18, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(10,29,58,0.08)',
          border: '2px solid ' + meta.accent,
        }}>
          <div style={{ height: 110, position: 'relative' }}>
            <PostHero category={cat} accent={meta.accent} />
          </div>
          <div style={{ padding: '12px 14px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: meta.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {meta.en}
            </div>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 800, color: '#0a1d3a', marginTop: 2, lineHeight: 1.15, textWrap: 'pretty' }}>
              {title || 'Title appears here'}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
              {summary || 'Your summary appears here. Keep it short and simple.'}
            </div>
            {deadline && (
              <div style={{
                marginTop: 8, padding: '6px 10px', background: '#fff5e8',
                border: '1px solid #ffd99e', borderRadius: 999,
                fontSize: 11, fontWeight: 800, color: '#9a3412',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>📅 {deadline}</div>
            )}
          </div>
        </div>

        <button onClick={onPreview} style={{
          width: '100%', padding: 16, marginTop: 16,
          background: '#0a1d3a', color: '#ffc857', border: 'none',
          borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          boxShadow: '0 6px 16px rgba(10,29,58,0.3)',
        }}>Post bulletin</button>
        <button style={{
          width: '100%', padding: 14, marginTop: 8,
          background: 'transparent', color: '#475569', border: '1.5px solid #e2e8f0',
          borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>Save as draft</button>
      </div>
    </div>
  );
}

function AdminDashboardScreen({ onCompose, onBack }) {
  const stats = [
    { label: 'Live posts', value: '12', color: '#2e7af0' },
    { label: 'Saved by students', value: '47', color: '#1aa37a' },
    { label: 'Expiring this week', value: '3', color: '#e88a2a' },
  ];
  return (
    <div style={{ background: '#f4f6fb', minHeight: '100%', paddingBottom: 90 }}>
      <div style={{
        background: 'linear-gradient(180deg, #0a1d3a 0%, #15315e 100%)',
        color: '#fff', padding: '20px 16px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
            borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>← Sign out</button>
          <div style={{ fontSize: 12, color: '#7eb1ff', fontWeight: 600 }}>Logged in as Jorge</div>
        </div>

        <div style={{ fontSize: 12, color: '#7eb1ff', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 800, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Welcome back</div>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 28, fontWeight: 800, margin: '4px 0 14px', lineHeight: 1.05 }}>Hola, Jorge 👋</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12,
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10.5, color: '#a9c8ff', fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 12px' }}>
        <button onClick={onCompose} style={{
          width: '100%', padding: 16, marginBottom: 16,
          background: 'linear-gradient(135deg, #2e7af0, #1f5acf)', color: '#fff',
          border: 'none', borderRadius: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-start',
          boxShadow: '0 8px 22px rgba(46,122,240,0.4)',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>+</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Write a new bulletin</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Share a job, event, or announcement</div>
          </div>
        </button>

        <div style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 800,
          color: '#0a1d3a', textTransform: 'uppercase', letterSpacing: 0.6,
          padding: '4px 4px 10px',
        }}>Your posts</div>

        {POSTS.slice(0, 4).map(p => {
          const m = CAT_META[p.category];
          return (
            <div key={p.id} style={{
              background: '#fff', borderRadius: 14, padding: 12, marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 4px 12px rgba(10,29,58,0.04)',
            }}>
              <div style={{ width: 44, height: 44, flexShrink: 0 }}><CategoryIcon id={p.category} size={44} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: 14, color: '#0a1d3a', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
                  {p.posted} ago · {p.deadlineUrgent ? '⚡ urgent' : 'live'}
                </div>
              </div>
              <button style={{
                background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 999,
                padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>Edit</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { AdminLoginScreen, AdminComposeScreen, AdminDashboardScreen });
