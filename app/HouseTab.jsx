// Your House — live energy flow, weather-driven scene + node pop-ups.
const WEEK_SAVED = 8.40; // shared with Dashboard week figure
const WEATHER_LAT = 51.48, WEATHER_LON = -0.20; // Fulham, SW6
const PRICES = { importP: 20, exportP: 10, p2p: 15 }; // pence / kWh
const BATTERY_SOC = 40; // %

// Open-Meteo WMO weather codes → 3 buckets
function classifyWeather(code) {
  if (code <= 1) return 'sunny';            // 0 clear, 1 mainly clear
  if (code <= 48) return 'cloudy';          // 2-3 cloudy, 45/48 fog
  return 'rainy';                           // 51+ drizzle / rain / snow / storm
}

function sceneFor(kind) {
  if (kind === 'sunny') return {
    solarKw: 3.8, useKw: 1.2, thirdKw: 2.6, thirdLabel: 'Surplus', prodPct: 90,
    caption: 'You are generating more than you use. The extra is powering 2 neighbours. See how',
    community: 'surplus',
  };
  if (kind === 'cloudy') return {
    solarKw: 1.7, useKw: 1.2, thirdKw: 0.5, thirdLabel: 'Surplus', prodPct: 40,
    caption: 'Cloudy day — modest production. Small surplus is supporting 1 neighbour.',
    community: 'surplus',
  };
  return {
    solarKw: 0, useKw: 1.2, thirdKw: 0.8, thirdLabel: 'Battery', prodPct: 0,
    caption: 'No solar today. Your battery is supporting the community. See how',
    community: 'shortage',
  };
}

const CANVAS_BG = {
  sunny:  'linear-gradient(180deg, #F5EFE0 0%, #E8F2E4 100%)',
  cloudy: 'linear-gradient(180deg, #E8E4DA 0%, #DCE3DA 100%)',
  rainy:  'linear-gradient(180deg, #BFC9D2 0%, #95A4B0 100%)',
};

function HouseTab({ onNavigate, highlight, onClearHighlight }) {
  const [tick, setTick] = React.useState(0);
  const [glowing, setGlowing] = React.useState(false);
  const [hovBanner, setHovBanner] = React.useState(false);
  const [hovSavings, setHovSavings] = React.useState(false);
  const [weather, setWeather] = React.useState(null); // null = loading; { kind, temp, error? }
  const [override, setOverride] = React.useState(null); // null | 'sunny' | 'cloudy' | 'rainy'
  const [showOverride, setShowOverride] = React.useState(false);
  const [popup, setPopup] = React.useState(null); // 'sun' | 'home' | 'grid' | 'community' | null

  React.useEffect(() => {
    let raf;
    const start = performance.now();
    const loop = () => {
      setTick((performance.now() - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  React.useEffect(() => {
    if (!highlight) return;
    onClearHighlight && onClearHighlight();
    setGlowing(true);
    const t = setTimeout(() => setGlowing(false), 4000);
    return () => clearTimeout(t);
  }, [highlight]);

  React.useEffect(() => {
    let cancelled = false;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,weather_code&timezone=Europe%2FLondon`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d && d.current && typeof d.current.weather_code === 'number') {
          setWeather({
            kind: classifyWeather(d.current.weather_code),
            temp: Math.round(d.current.temperature_2m),
          });
        } else {
          setWeather({ kind: 'sunny', temp: 18, error: true });
        }
      })
      .catch(() => { if (!cancelled) setWeather({ kind: 'sunny', temp: 18, error: true }); });
    return () => { cancelled = true; };
  }, []);

  const liveKind = weather?.kind ?? 'sunny';
  const activeKind = override || liveKind;
  const activeTemp = weather?.temp ?? 18;
  const isLoading = !weather;
  const hasError = !!weather?.error;
  const isLive = !override && weather && !hasError;
  const scene = sceneFor(activeKind);

  if (showOverride) {
    return (
      <OverridePanel
        override={override} onChange={setOverride}
        liveKind={liveKind} isLive={isLive} isLoading={isLoading} hasError={hasError}
        onBack={() => setShowOverride(false)}
      />
    );
  }

  return (
    <div className="pw-screen">
      <style>{`
        @keyframes pwHouseMapGlow {
          0%   { box-shadow: var(--shadow-sm); }
          30%  { box-shadow: var(--shadow-sm), 0 0 0 3px rgba(0,192,111,0.6), 0 0 32px rgba(0,192,111,0.25); }
          40%  { box-shadow: var(--shadow-sm), 0 0 0 3px rgba(0,192,111,0.6), 0 0 32px rgba(0,192,111,0.25); }
          100% { box-shadow: var(--shadow-sm); }
        }
        @keyframes pwLivePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.15); }
        }
      `}</style>
      <TabHeader eyebrow="Home" title="Your home"/>

      <div style={{
        padding: '0 24px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div className="t-label" style={{ color: 'var(--ink-500)', fontSize: 13 }}>
          Live energy flow
        </div>
        <WeatherPill
          isLoading={isLoading}
          override={override}
          onTap={() => setShowOverride(true)}
        />
      </div>

      <div style={{ padding: '0 0 90px' }}>
        <div style={{
          margin: '0 16px',
          height: 360, position: 'relative',
          borderRadius: 'var(--r-lg)',
          background: CANVAS_BG[activeKind],
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
          animation: glowing ? 'pwHouseMapGlow 3.2s ease-in-out forwards' : 'none',
          transition: 'background 0.6s ease',
        }}>
          <HouseScene tick={tick} kind={activeKind} onTap={setPopup}/>
          {popup && (
            <NodePopup
              kind={popup}
              weatherKind={activeKind}
              temp={activeTemp}
              scene={scene}
              onClose={() => setPopup(null)}
            />
          )}
        </div>

        <div style={{ padding: '20px 24px 0' }}>
          <button onClick={() => onNavigate && onNavigate('community', true)}
            onMouseEnter={() => setHovBanner(true)} onMouseLeave={() => setHovBanner(false)}
            style={{
              appearance: 'none', border: '1px solid var(--cream-200)', cursor: 'pointer', width: '100%', textAlign: 'left',
              padding: '10px 14px',
              background: hovBanner ? 'var(--ink-900)' : 'var(--surface)',
              borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'var(--font-sans)',
              transition: 'background .15s, color .15s',
            }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: hovBanner ? 'rgba(0,192,111,0.20)' : 'var(--lime-50)',
              color: hovBanner ? 'var(--lime-400)' : 'var(--lime-600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconBolt size={13}/>
            </div>
            <div style={{
              flex: 1,
              fontSize: 13, fontWeight: 500,
              color: hovBanner ? '#fff' : 'var(--ink-900)', letterSpacing: '-0.005em',
              textWrap: 'pretty',
            }}>
              {scene.caption}
            </div>
            <IconChevron size={13} style={{ color: hovBanner ? '#fff' : 'var(--ink-400)', flexShrink: 0 }}/>
          </button>
        </div>

        <div style={{ padding: '20px 24px 0' }}>
          <div className="t-label" style={{ color: 'var(--ink-500)', marginBottom: 10, fontSize: 13 }}>
            Live readouts
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
          }}>
            <Readout icon={<IconSolar size={14}/>}      label="Generating"      value={scene.solarKw.toFixed(1)} unit="kW" accent={scene.solarKw > 0}/>
            <Readout icon={<IconHome size={14}/>}       label="Using"           value={scene.useKw.toFixed(1)}   unit="kW"/>
            <Readout icon={<IconArrowRight size={14}/>} label={scene.thirdLabel} value={scene.thirdKw.toFixed(1)} unit="kW" accent/>
          </div>
        </div>

        <div style={{ padding: '12px 24px 0' }}>
          <button onClick={() => onNavigate && onNavigate('dashboard')}
            onMouseEnter={() => setHovSavings(true)} onMouseLeave={() => setHovSavings(false)}
            style={{
              appearance: 'none', border: '1px solid var(--cream-200)', cursor: 'pointer', width: '100%', textAlign: 'left',
              padding: '10px 14px',
              background: hovSavings ? 'var(--ink-900)' : 'var(--surface)',
              borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'var(--font-sans)',
              transition: 'background .15s, color .15s',
            }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: hovSavings ? 'rgba(0,192,111,0.20)' : 'var(--lime-50)',
              color: hovSavings ? 'var(--lime-400)' : 'var(--lime-600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 13, fontWeight: 700,
              fontFamily: 'var(--font-sans)',
            }}>
              £
            </div>
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 500,
              color: hovSavings ? '#fff' : 'var(--ink-900)', letterSpacing: '-0.005em',
            }}>
              £{WEEK_SAVED.toFixed(2)} saved this week. See how
            </span>
            <IconChevron size={13} style={{ color: hovSavings ? '#fff' : 'var(--ink-400)', flexShrink: 0 }}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function Readout({ icon, label, value, unit, accent }) {
  return (
    <div style={{
      padding: '12px 12px',
      background: accent ? 'var(--lime-50)' : 'var(--surface)',
      border: '1px solid ' + (accent ? 'var(--lime-100)' : 'var(--cream-200)'),
      borderRadius: 'var(--r-md)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        color: accent ? 'var(--lime-600)' : 'var(--ink-500)', marginBottom: 6,
      }}>
        {icon}
        <span className="t-label" style={{ fontSize: 11 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span className="t-num" style={{
          fontSize: 19, color: 'var(--ink-900)', fontWeight: 600,
          letterSpacing: '-0.03em',
        }}>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-400)', fontWeight: 500 }}>{unit}</span>
      </div>
    </div>
  );
}

function WeatherPill({ isLoading, override, onTap }) {
  let dotColor, text;
  if (override)         { dotColor = '#E4A23A'; text = `Demo · ${override}`; }
  else if (isLoading)   { dotColor = '#9CA3A0'; text = 'Connecting…'; }
  else                  { dotColor = '#00C06F'; text = 'Connected'; }
  const pulse = !override && !isLoading;

  return (
    <button onClick={onTap} style={{
      appearance: 'none', border: '1px solid var(--cream-200)',
      background: 'var(--surface)', cursor: 'pointer',
      padding: '5px 10px 5px 8px', borderRadius: 999,
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, color: 'var(--ink-700)',
      fontFamily: 'var(--font-sans)', fontWeight: 500,
      letterSpacing: '-0.005em', whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: 999, background: dotColor,
        animation: pulse ? 'pwLivePulse 2s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }}/>
      <span>{text}</span>
    </button>
  );
}

function OverridePanel({ override, onChange, liveKind, isLive, isLoading, hasError, onBack }) {
  const options = ['sunny', 'cloudy', 'rainy'];
  const sliderValue = options.indexOf(override || liveKind);

  return (
    <div className="pw-screen">
      <TabHeader eyebrow="Home" title="Weather demo"/>

      <div style={{ padding: '0 24px 90px' }}>
        <button onClick={onBack} style={{
          appearance: 'none', border: 0, background: 'transparent',
          display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--ink-700)', fontSize: 14, fontWeight: 500,
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
          padding: '4px 0', marginBottom: 16,
        }}>
          <IconChevron dir="left" size={14}/>
          <span>Back to home</span>
        </button>

        <p style={{
          fontSize: 14, lineHeight: 1.55, color: 'var(--ink-700)',
          margin: '0 0 24px',
        }}>
          Only for demo purposes, manually override the weather state. Move the slider to switch between sunny, cloudy and rainy. Tap "Reset to live" to use the real forecast.
        </p>

        <div style={{
          padding: '12px 16px', marginBottom: 22,
          background: 'var(--surface)', border: '1px solid var(--cream-200)',
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999,
            background: override ? '#E4A23A' : (isLive ? '#00C06F' : (hasError ? '#D4524B' : '#9CA3A0')),
            flexShrink: 0,
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-label" style={{ color: 'var(--ink-500)', fontSize: 11, marginBottom: 2 }}>Status</div>
            <div style={{ fontSize: 13, color: 'var(--ink-900)', fontWeight: 500 }}>
              {override
                ? `Demo override · ${override}`
                : isLoading ? 'Connecting to weather…'
                : hasError  ? 'Could not reach weather (using sunny)'
                : `Live · ${liveKind} in Fulham`}
            </div>
          </div>
        </div>

        <div className="t-label" style={{ color: 'var(--ink-500)', fontSize: 11, marginBottom: 14 }}>
          Override
        </div>

        <div style={{
          padding: '20px 16px 16px',
          background: 'var(--surface)', border: '1px solid var(--cream-200)',
          borderRadius: 'var(--r-md)',
          marginBottom: 14,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            fontSize: 11, color: 'var(--ink-500)',
            fontFamily: 'var(--font-sans)', fontWeight: 500,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            <span style={{ textAlign: 'left' }}>Sunny</span>
            <span style={{ textAlign: 'center' }}>Cloudy</span>
            <span style={{ textAlign: 'right' }}>Rainy</span>
          </div>
          <input
            type="range" min="0" max="2" step="1" value={sliderValue}
            onChange={(e) => onChange(options[+e.target.value])}
            style={{ width: '100%', accentColor: 'var(--lime-500)' }}
          />
          <div style={{
            marginTop: 14, fontSize: 13,
            color: 'var(--ink-700)', fontFamily: 'var(--font-sans)',
          }}>
            Showing: <span style={{ color: 'var(--ink-900)', fontWeight: 600, textTransform: 'capitalize' }}>
              {override || liveKind}
            </span> {override ? '(override)' : '(live)'}
          </div>
        </div>

        <button
          onClick={() => onChange(null)}
          disabled={!override}
          style={{
            appearance: 'none', cursor: override ? 'pointer' : 'default',
            width: '100%', padding: '12px 14px',
            background: override ? 'var(--ink-900)' : 'var(--cream-100)',
            color: override ? '#fff' : 'var(--ink-400)',
            border: '1px solid ' + (override ? 'var(--ink-900)' : 'var(--cream-200)'),
            borderRadius: 'var(--r-md)',
            fontSize: 14, fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.005em',
          }}>
          Reset to live forecast
        </button>
      </div>
    </div>
  );
}

function NodePopup({ kind, weatherKind, temp, scene, onClose }) {
  const labels = { sunny: 'Clear / sunny', cloudy: 'Cloudy', rainy: 'Rainy' };
  const map = {
    sun: {
      title: 'Sun',
      icon: <IconSolar size={14}/>,
      rows: [
        ['Temperature', `${temp}°C`],
        ['Conditions', labels[weatherKind]],
      ],
    },
    home: {
      title: 'Your home',
      icon: <IconHome size={14}/>,
      rows: [
        ['Battery', `${BATTERY_SOC}%`],
        ['Solar production', `${scene.prodPct}%`],
      ],
    },
    grid: {
      title: 'Grid',
      icon: <IconBolt size={14}/>,
      rows: [
        ['Import', `${PRICES.importP}p / kWh`],
        ['Export', `${PRICES.exportP}p / kWh`],
      ],
    },
    community: {
      title: 'Community',
      icon: <IconBolt size={14}/>,
      rows: [
        ['Status', scene.community === 'surplus' ? 'Surplus' : 'Shortage'],
        ['Peer-to-peer price', `${PRICES.p2p}p / kWh`],
      ],
    },
  };
  const c = map[kind];
  if (!c) return null;

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0,
      background: 'rgba(20,28,24,0.32)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 5, borderRadius: 'var(--r-lg)',
      padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 240, padding: '14px 16px 12px',
        background: 'var(--surface)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--cream-200)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)',
        position: 'relative',
        fontFamily: 'var(--font-sans)',
      }}>
        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 6, right: 6,
          width: 26, height: 26, borderRadius: 999, border: 0,
          background: 'transparent', cursor: 'pointer',
          color: 'var(--ink-500)', fontSize: 18, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}>×</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'var(--lime-50)', color: 'var(--lime-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{c.icon}</div>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: 'var(--ink-900)', letterSpacing: '-0.01em',
          }}>{c.title}</div>
        </div>
        {c.rows.map(([label, value], i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0',
            borderTop: i === 0 ? 0 : '1px solid var(--cream-200)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--ink-600)' }}>{label}</span>
            <span style={{
              fontSize: 13, color: 'var(--ink-900)', fontWeight: 600,
              fontFamily: 'var(--font-sans)',
            }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Layout: SUN top-center, HOUSE middle-center, GRID bottom-left, COMMUNITY bottom-right.
function HouseScene({ tick, kind, onTap }) {
  const HOUSE_X = 180, HOUSE_Y = 175;
  const GRID_X = 90,  GRID_Y = 290;
  const COMM_X = 270, COMM_Y = 290;
  const SUN_X = 180,  SUN_Y = 55;

  const tap = (id) => (e) => { e.stopPropagation(); onTap(id); };
  const tappableStyle = { cursor: 'pointer' };

  const showSun = kind !== 'rainy';

  return (
    <svg viewBox="0 0 360 360" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%"  stopColor="#FFE8A0" stopOpacity="0.9"/>
          <stop offset="60%" stopColor="#FFD46A" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#FFD46A" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#2A3A34"/>
          <stop offset="100%" stopColor="#1A2A24"/>
        </linearGradient>
        <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#1a3c2e"/>
          <stop offset="100%" stopColor="#0e2a1f"/>
        </linearGradient>
      </defs>

      {/* SUN (sunny + cloudy) */}
      {showSun && (
        <g style={tappableStyle} onClick={tap('sun')}>
          <rect x={SUN_X - 50} y={SUN_Y - 50} width="100" height="100" fill="transparent"/>
          <circle cx={SUN_X} cy={SUN_Y} r="44" fill="url(#sunGlow)" opacity={kind === 'cloudy' ? 0.55 : 1}/>
          <circle cx={SUN_X} cy={SUN_Y} r="20" fill="#FFC94A" opacity={kind === 'cloudy' ? 0.85 : 1}/>
          {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
            const r1 = 26 + Math.sin(tick * 2 + a) * 1.5;
            const r2 = 32 + Math.sin(tick * 2 + a) * 1.5;
            const x1 = SUN_X + Math.cos(a * Math.PI/180) * r1;
            const y1 = SUN_Y + Math.sin(a * Math.PI/180) * r1;
            const x2 = SUN_X + Math.cos(a * Math.PI/180) * r2;
            const y2 = SUN_Y + Math.sin(a * Math.PI/180) * r2;
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2}
                         stroke="#FFC94A" strokeWidth="2.5" strokeLinecap="round"
                         opacity={kind === 'cloudy' ? 0.7 : 1}/>;
          })}
        </g>
      )}

      {/* CLOUDS — small accent on cloudy, heavy on rainy (rainy clouds are tappable as 'sun') */}
      {kind === 'cloudy' && (
        <g style={{ pointerEvents: 'none' }}>
          <Cloud cx={SUN_X + 26}  cy={SUN_Y + 8}   scale={0.85}/>
          <Cloud cx={SUN_X - 78}  cy={SUN_Y + 22}  scale={0.75}/>
          <Cloud cx={SUN_X - 130} cy={SUN_Y - 20}  scale={0.65}/>
          <Cloud cx={SUN_X + 110} cy={SUN_Y - 18}  scale={0.8}/>
        </g>
      )}
      {kind === 'rainy' && (
        <g style={tappableStyle} onClick={tap('sun')}>
          <rect x={SUN_X - 110} y={SUN_Y - 40} width="220" height="90" fill="transparent"/>
          <Cloud cx={SUN_X} cy={SUN_Y + 4} scale={1.45} dark/>
          <Cloud cx={SUN_X - 78} cy={SUN_Y + 22} scale={0.95} dark/>
          <Cloud cx={SUN_X + 78} cy={SUN_Y + 28} scale={0.9} dark/>
        </g>
      )}

      {/* RAIN */}
      {kind === 'rainy' && <Rain tick={tick}/>}

      {/* HOUSE */}
      <g style={tappableStyle} onClick={tap('home')}>
        <rect x={HOUSE_X - 55} y={HOUSE_Y - 50} width="110" height="120" fill="transparent"/>
        <g transform={`translate(${HOUSE_X - 40}, ${HOUSE_Y - 40})`}>
          <ellipse cx="40" cy="92" rx="50" ry="4" fill="rgba(0,0,0,0.12)"/>
          <rect x="5" y="40" width="70" height="50" fill="#F7F3E8" stroke="#E4E0D4" strokeWidth="1"/>
          <polygon points="-5,42 40,8 85,42 75,42 40,18 5,42" fill="url(#roofGrad)"/>
          <polygon points="8,40 38,17 38,30 12,47" fill="url(#panelGrad)" stroke="#00C06F" strokeWidth="0.6"/>
          <polygon points="42,17 72,40 68,47 42,30" fill="url(#panelGrad)" stroke="#00C06F" strokeWidth="0.6"/>
          {kind !== 'rainy' && <polygon points="8,40 38,17 38,30 12,47" fill="#FFE8A0" opacity={kind === 'cloudy' ? 0.15 : 0.3}/>}
          {kind !== 'rainy' && <polygon points="42,17 72,40 68,47 42,30" fill="#FFE8A0" opacity={kind === 'cloudy' ? 0.15 : 0.3}/>}
          <rect x="14" y="52" width="18" height="18" fill="#B8D4E8"/>
          <line x1="23" y1="52" x2="23" y2="70" stroke="#8FA8BC" strokeWidth="0.5"/>
          <line x1="14" y1="61" x2="32" y2="61" stroke="#8FA8BC" strokeWidth="0.5"/>
          <rect x="45" y="62" width="14" height="28" fill="#2a3a34"/>
          <circle cx="56" cy="77" r="0.8" fill="#00C06F"/>
        </g>
        <NodeLabel x={HOUSE_X} y={HOUSE_Y + 74} text="YOUR HOME"/>
      </g>

      {/* GRID */}
      <g style={tappableStyle} onClick={tap('grid')}>
        <rect x={GRID_X - 30} y={COMM_Y - 30} width="60" height="80" fill="transparent"/>
        <g transform={`translate(${GRID_X}, ${COMM_Y + 5})`}>
          <rect x="-2" y="-22" width="4" height="44" fill="#6B7370"/>
          <rect x="-18" y="-26" width="36" height="5" rx="0.5" fill="#6B7370"/>
          <rect x="-18" y="-16" width="36" height="5" rx="0.5" fill="#6B7370"/>
          <line x1="-18" y1="-30" x2="-12" y2="-22" stroke="#6B7370" strokeWidth="2"/>
          <line x1="18"  y1="-30" x2="12"  y2="-22" stroke="#6B7370" strokeWidth="2"/>
        </g>
        <NodeLabel x={GRID_X} y={COMM_Y + 50} text="GRID"/>
      </g>

      {/* COMMUNITY */}
      <g style={tappableStyle} onClick={tap('community')}>
        <rect x={COMM_X - 45} y={COMM_Y - 30} width="90" height="80" fill="transparent"/>
        <g transform={`translate(${COMM_X}, ${COMM_Y})`}>
          {[
            { x: -26, y: 6,  h: 30 },
            { x: 0,   y: -6, h: 38 },
            { x: 26,  y: 8,  h: 28 },
          ].map((c, i) => (
            <g key={i} transform={`translate(${c.x}, ${c.y})`}>
              <rect x="-11" y="-5" width="22" height={c.h} fill="#F7F3E8" stroke="#E4E0D4" strokeWidth="0.8"/>
              <polygon points="-13,-5 0,-16 13,-5" fill="#2a3a34"/>
              <rect x="-4" y="3" width="6" height="7" fill="#FFC94A"
                    opacity={0.6 + 0.3 * Math.sin(tick * 2.5 + i)}/>
            </g>
          ))}
        </g>
        <NodeLabel x={COMM_X} y={COMM_Y + 50} text="COMMUNITY"/>
      </g>

      {/* FLOWS — depend on weather */}
      {/* sun → home (sunny + cloudy) */}
      {kind !== 'rainy' && (
        <FlowLine
          path={`M ${SUN_X} ${SUN_Y + 25} Q ${SUN_X} ${HOUSE_Y - 60} ${HOUSE_X} ${HOUSE_Y - 32}`}
          tick={tick} color="#FFB83D" speed={0.7} particles={3} dashed/>
      )}

      {/* home → community (always — solar surplus, or battery on rainy) */}
      <FlowLine
        path={`M ${HOUSE_X + 30} ${HOUSE_Y + 30} Q ${HOUSE_X + 65} ${HOUSE_Y + 80} ${COMM_X - 30} ${COMM_Y - 10}`}
        tick={tick}
        color={kind === 'rainy' ? '#5B8DBF' : '#00A862'}
        speed={0.9} particles={4}/>

      {/* grid → community (rainy only) */}
      {kind === 'rainy' && (
        <FlowLine
          path={`M ${GRID_X + 22} ${GRID_Y - 18} Q ${(GRID_X + COMM_X) / 2} ${COMM_Y + 42} ${COMM_X - 30} ${COMM_Y + 6}`}
          tick={tick} color="#5B8DBF" speed={0.85} particles={4}/>
      )}

      {/* home → grid (sunny + cloudy, dashed static) */}
      {kind !== 'rainy' && (
        <path
          d={`M ${HOUSE_X - 30} ${HOUSE_Y + 30} Q ${HOUSE_X - 65} ${HOUSE_Y + 80} ${GRID_X + 22} ${GRID_Y - 18}`}
          fill="none" stroke="#9CA3A0" strokeWidth="1.5"
          strokeDasharray="3 5" strokeOpacity="0.55"/>
      )}
    </svg>
  );
}

function Cloud({ cx, cy, scale = 1, dark = false }) {
  const fill = dark ? '#5B6770' : '#FFFFFF';
  const op   = dark ? 0.92 : 0.94;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`} opacity={op}>
      <ellipse cx="-14" cy="3"  rx="13" ry="9"  fill={fill}/>
      <ellipse cx="0"   cy="-4" rx="16" ry="11" fill={fill}/>
      <ellipse cx="13"  cy="2"  rx="12" ry="9"  fill={fill}/>
      <ellipse cx="-6"  cy="7"  rx="11" ry="6"  fill={fill}/>
      <ellipse cx="6"   cy="7"  rx="11" ry="6"  fill={fill}/>
    </g>
  );
}

function Rain({ tick }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 32 }).map((_, i) => {
        const x = (i * 11 + 6) % 360;
        const phase = (i * 37) % 100 / 100;
        const y = (((tick * 90) + phase * 320) % 320) + 30;
        return (
          <line key={i} x1={x} y1={y} x2={x - 3} y2={y + 9}
                stroke="#7BA0C9" strokeWidth="1.3" strokeOpacity="0.6"
                strokeLinecap="round"/>
        );
      })}
    </g>
  );
}

function NodeLabel({ x, y, text }) {
  return (
    <g>
      <text x={x} y={y} textAnchor="middle"
            fontSize="13" fontFamily="Inter, Geist, sans-serif"
            fill="var(--ink-900)" letterSpacing="0.03em" fontWeight="900">
        {text}
      </text>
    </g>
  );
}

function FlowLine({ path, tick, color, speed = 1, particles = 4, dashed }) {
  const ref = React.useRef();
  const [len, setLen] = React.useState(0);
  React.useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength());
  }, [path]);

  const pts = [];
  if (len) {
    for (let i = 0; i < particles; i++) {
      const p = ((tick * speed * 0.22 + i / particles) % 1) * len;
      if (ref.current) {
        const pt = ref.current.getPointAtLength(p);
        pts.push({ x: pt.x, y: pt.y, phase: i / particles });
      }
    }
  }

  return (
    <g style={{ pointerEvents: 'none' }}>
      <path ref={ref} d={path} fill="none" stroke={color} strokeOpacity="0.3"
            strokeWidth="1.5" strokeDasharray={dashed ? "2 4" : "3 4"}/>
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color}>
          <animate attributeName="opacity" values="0;1;0"
                   dur={`${2/speed}s`} repeatCount="indefinite"
                   begin={`${p.phase * 2/speed}s`}/>
        </circle>
      ))}
    </g>
  );
}

Object.assign(window, { HouseTab });
