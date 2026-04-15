(() => {
  // ── Inject CSS ───────────────────────────────────────────────────────────
  if (!document.getElementById('mw-styles')) {
    const _s = document.createElement('style');
    _s.id = 'mw-styles';
    _s.textContent = ":root { --mw-bg: #f4f7f7; --mw-surface: #ffffff; --mw-surface-2: #eef4f4; --mw-text: #173036; --mw-muted: #5c7378; --mw-border: #d7e2e4; --mw-primary: #0d6973; --mw-primary-hover: #0b5b63; --mw-accent: #d7263d; --mw-shadow: 0 12px 32px rgba(23,48,54,.08); --mw-radius-lg: 20px; --mw-radius-md: 14px; --mw-radius-sm: 10px; } body { margin: 0; background: linear-gradient(180deg,#f7f9f9 0%,#edf3f4 100%); color: var(--mw-text); font-family: 'Inter', system-ui, sans-serif; } .demo-shell { max-width: 1280px; margin: 0 auto; padding: 32px 20px 48px; } .demo-hero { margin-bottom: 22px; } .demo-eyebrow { margin: 0 0 8px; color: var(--mw-primary); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; } .demo-hero h1 { margin: 0; font-size: clamp(28px,5vw,46px); line-height: 1.05; } .demo-intro { max-width: 860px; margin: 12px 0 0; color: var(--mw-muted); font-size: 16px; line-height: 1.6; } .macc-widget, .macc-widget * { box-sizing: border-box; } .macc-widget { display: grid; gap: 18px; } .mw-controls { background: rgba(255,255,255,.78); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.85); border-radius: 24px; box-shadow: var(--mw-shadow); padding: 18px 22px; } .mw-controls-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; } .mw-filter-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; } .mw-filter-btn { border: 1.5px solid var(--mw-border); background: var(--mw-surface); color: var(--mw-muted); border-radius: 999px; height: 40px; padding: 0 16px; font-size: 13px; font-weight: 700; cursor: pointer; transition: .15s ease; white-space: nowrap; } .mw-filter-btn:hover { border-color: var(--mw-primary); color: var(--mw-primary); } .mw-filter-btn.is-active { background: var(--mw-primary); border-color: var(--mw-primary); color: #fff; } .mw-search-group { display: flex; gap: 8px; flex: 1 1 320px; min-width: 0; } .mw-search-wrap { position: relative; flex: 1; min-width: 0; } .mw-search-input { width: 100%; height: 48px; padding: 0 16px 0 46px; border-radius: 14px; border: 1.5px solid var(--mw-border); background: var(--mw-surface); font-size: 15px; color: var(--mw-text); outline: none; transition: border-color .15s; } .mw-search-input:focus { border-color: var(--mw-primary); box-shadow: 0 0 0 3px rgba(13,105,115,.1); } .mw-search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--mw-muted); font-size: 18px; pointer-events: none; } .mw-geo-btn { border: 1.5px solid var(--mw-border); background: var(--mw-surface); color: var(--mw-primary); cursor: pointer; width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; transition: .15s; flex-shrink: 0; } .mw-geo-btn:hover { background: var(--mw-surface-2); border-color: var(--mw-primary); box-shadow: 0 0 0 3px rgba(13,105,115,.1); } .mw-geo-btn svg { display: block; } .mw-geo-btn--labeled { width: auto; padding: 0 16px; gap: 8px; font-size: 13px; font-weight: 700; white-space: nowrap; color: #fff; background: var(--mw-primary); border-color: var(--mw-primary); } .mw-geo-btn--labeled:hover { background: var(--mw-primary-hover); border-color: var(--mw-primary-hover); box-shadow: 0 0 0 3px rgba(13,105,115,.15); } .mw-search-btn { height: 48px; padding: 0 22px; border-radius: 14px; border: 1.5px solid var(--mw-primary); background: var(--mw-primary); color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; white-space: nowrap; transition: .15s; } .mw-search-btn:hover { background: var(--mw-primary-hover); } .mw-search-btn.is-loading { opacity: .7; cursor: default; } .mw-main { display: grid; grid-template-columns: minmax(360px, 1.1fr) minmax(360px, .9fr); gap: 18px; align-items: start; } .mw-left, .mw-right { min-width: 0; } .mw-context { font-size: 13px; color: var(--mw-muted); margin-bottom: 14px; line-height: 1.5; } .mw-context strong { color: var(--mw-text); } .mw-link-btn { background: none; border: none; padding: 0; color: var(--mw-primary); font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: underline; } .mw-fallback-note { font-size: 13px; color: var(--mw-muted); background: #fffbe6; border: 1px solid #f0e090; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; } .mw-card-list { display: grid; gap: 12px; } .mw-card { background: #fff; border: 1.5px solid var(--mw-border); border-radius: 18px; padding: 18px; display: grid; gap: 12px; cursor: pointer; transition: box-shadow .15s, border-color .15s; } .mw-card:hover { box-shadow: var(--mw-shadow); border-color: #b8ced2; } .mw-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; } .mw-card-title-group { flex: 1; min-width: 0; } .mw-card-title { margin: 0; font-size: 18px; line-height: 1.2; color: var(--mw-text); } .mw-card-address { margin-top: 3px; font-size: 12px; color: var(--mw-muted); line-height: 1.4; } .mw-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; } .mw-dist { font-size: 12px; color: var(--mw-muted); font-weight: 700; white-space: nowrap; } .mw-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; } .mw-badge { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: .02em; } .mw-badge--vaccin { background: #e8f5f6; color: var(--mw-primary); } .mw-badge--provtagning { background: #f0eeff; color: #5b45b0; } .mw-badge--bada { background: #edf8ef; color: #1f7a43; } .mw-times { background: #f6fafb; border: 1px solid #ddebed; border-radius: 12px; padding: 12px 14px; } .mw-times--empty { background: #fafafa; border-color: var(--mw-border); } .mw-times-label { display: block; margin-bottom: 5px; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--mw-muted); } .mw-time { font-size: 15px; font-weight: 800; line-height: 1.4; } .mw-time--dim { font-size: 13px; font-weight: 600; color: var(--mw-muted); margin-top: 2px; } .mw-time--none { font-size: 14px; font-weight: 600; color: #aab8ba; } .mw-actions { display: flex; gap: 8px; flex-wrap: wrap; } .mw-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px; border-radius: 10px; font-size: 13px; font-weight: 800; text-decoration: none; border: 1.5px solid transparent; cursor: pointer; transition: .15s; } .mw-btn--primary { background: var(--mw-primary); color: #fff; border-color: var(--mw-primary); } .mw-btn--primary:hover { background: var(--mw-primary-hover); } .mw-btn--outline { background: #fff; color: var(--mw-primary); border-color: var(--mw-primary); } .mw-btn--outline:hover { background: var(--mw-surface-2); } .mw-btn--ghost { background: #fff; color: var(--mw-muted); border-color: var(--mw-border); } .mw-btn--ghost:hover { border-color: #b8ced2; color: var(--mw-text); } .mw-btn-text-link { font-size: 13px; font-weight: 700; color: var(--mw-primary); text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; align-self: center; } .mw-btn-text-link:hover { text-decoration: underline; } .mw-notice { display: flex; gap: 10px; align-items: flex-start; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #7a4500; line-height: 1.5; } .mw-notice-icon { flex-shrink: 0; font-size: 15px; } .mw-empty { border: 1.5px dashed var(--mw-border); border-radius: 14px; padding: 20px; color: var(--mw-muted); background: #fff; font-size: 14px; } .mw-right { display: flex; flex-direction: column; position: sticky; top: 18px; align-self: start; } .mw-map-hint { font-size: 12px; color: var(--mw-muted); text-align: center; margin-bottom: 8px; letter-spacing: .01em; } .mw-map-shell { position: sticky; top: 18px; } .mw-map { height: 620px; border-radius: 18px; overflow: hidden; border: 1.5px solid var(--mw-border); box-shadow: 0 8px 24px rgba(23,48,54,.07); } .mw-popup-title { font-weight: 800; font-size: 15px; margin-bottom: 4px; } .mw-popup-addr { font-size: 12px; color: var(--mw-muted); margin-bottom: 4px; } .mw-popup-next { font-size: 13px; font-weight: 700; margin-bottom: 10px; } .mw-popup-actions { display: flex; gap: 7px; flex-wrap: wrap; } .mw-popup-actions a { text-decoration: none; padding: 7px 11px; border-radius: 9px; font-size: 12px; font-weight: 800; border: 1.5px solid var(--mw-border); } .mw-popup-actions a:first-child { background: var(--mw-primary); color: #fff; border-color: var(--mw-primary); } .mw-popup-actions a:last-child { background: #fff; color: var(--mw-primary); } .mw-marker-wrap { position: relative; width: 28px; height: 36px; filter: drop-shadow(0 3px 6px rgba(0,0,0,.28)); } .mw-marker-wrap svg { display: block; } .mw-marker-pulse { position: absolute; top: 3px; left: 50%; transform: translateX(-50%); width: 28px; height: 28px; border-radius: 50%; opacity: 0; animation: mw-pulse 2.2s ease-out infinite; } @keyframes mw-pulse { 0% { transform: translateX(-50%) scale(.6); opacity: .55; } 70% { transform: translateX(-50%) scale(2); opacity: 0; } 100% { transform: translateX(-50%) scale(2); opacity: 0; } } .mw-autocomplete { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 1000; margin: 0; padding: 6px; list-style: none; background: #fff; border: 1.5px solid var(--mw-border); border-radius: 14px; box-shadow: 0 12px 32px rgba(23,48,54,.13); overflow: hidden; } .mw-autocomplete[hidden] { display: none; } .mw-autocomplete-item { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 9px 12px; border-radius: 9px; cursor: pointer; transition: background .1s; } .mw-autocomplete-item:hover, .mw-autocomplete-item.is-active { background: var(--mw-surface-2); } .mw-autocomplete-name { font-size: 14px; font-weight: 700; color: var(--mw-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .mw-autocomplete-city { font-size: 12px; color: var(--mw-muted); white-space: nowrap; flex-shrink: 0; } @media (max-width: 980px) { .mw-main { grid-template-columns: 1fr; } .mw-map-shell { position: static; } .mw-map { height: 420px; } .mw-right { order: -1; } } @media (max-width: 680px) { .demo-shell { padding: 16px 12px 32px; } .mw-controls { padding: 14px 16px; } .mw-controls-row { flex-direction: column; align-items: stretch; } .mw-filter-group { justify-content: flex-start; } .mw-search-group { flex-wrap: wrap; } .mw-search-wrap { flex: 1 1 0; min-width: 0; } .mw-search-btn { flex: 1 1 100%; width: 100%; } .mw-map { height: 300px; } .mw-actions { flex-direction: column; } .mw-btn { width: 100%; } } .mw-card { padding: 0; overflow: hidden; cursor: default; gap: 0; } .mw-card-toggle { display: block; width: 100%; border: 0; background: transparent; padding: 0; text-align: left; cursor: pointer; } .mw-card-top { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; padding: 18px; align-items: start; } .mw-card-title-wrap { min-width: 0; } .mw-card-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; } .mw-card-meta-distance { color: var(--mw-primary); font-weight: 700; font-size: 13px; } .mw-card-right { align-items: flex-end; max-width: 220px; } .mw-next { background: #f6fafb; border: 1px solid #ddebed; border-radius: 12px; padding: 10px 12px; min-width: 180px; } .mw-next--empty { background: #fafafa; border-color: var(--mw-border); } .mw-next-label { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--mw-muted); margin-bottom: 5px; } .mw-next-service { margin-bottom: 8px; } .mw-next-service .mw-badge { height: auto; min-height: 24px; padding-top: 4px; padding-bottom: 4px; } .mw-next-main { font-size: 15px; font-weight: 800; line-height: 1.3; } .mw-next-sub { font-size: 13px; color: var(--mw-muted); font-weight: 600; margin-top: 2px; } .mw-accordion-cta { margin-top: 8px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 13px; font-weight: 800; color: var(--mw-primary); } .mw-accordion-count { font-size: 11px; color: var(--mw-muted); font-weight: 700; } .mw-card-inline-actions { padding: 0 18px 18px; } .mw-card-details { border-top: 1px solid var(--mw-border); background: #fff; } .mw-card-details-inner { padding: 16px 18px 18px; display: grid; gap: 14px; } .mw-upcoming-title { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--mw-muted); margin-bottom: 8px; } .mw-upcoming-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; } .mw-upcoming-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; background: #f7fafb; border: 1px solid #e5eef0; border-radius: 10px; padding: 10px 12px; } .mw-upcoming-primary { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .mw-upcoming-service { flex-shrink: 0; display: flex; align-items: center; } .mw-upcoming-item--empty { color: var(--mw-muted); } .mw-upcoming-date { font-weight: 700; } .mw-upcoming-time { color: var(--mw-muted); font-weight: 600; } .mw-popup-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; } .mw-popup-actions button, .mw-popup-actions a { appearance: none; border: 1px solid var(--mw-border); background: #fff; color: var(--mw-primary); padding: 8px 10px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; cursor: pointer; } .mw-popup-actions a:first-child { background: var(--mw-primary); color: #fff; border-color: var(--mw-primary); } @media (max-width: 980px) { .mw-card-right { max-width: none; width: 100%; align-items: stretch; } } @media (max-width: 680px) { .mw-card-top { grid-template-columns: 1fr; } .mw-card-right { width: 100%; } .mw-next { min-width: 0; } .mw-accordion-cta { align-items: flex-start; } .mw-upcoming-item { flex-direction: column; gap: 2px; } }";
    document.head.appendChild(_s);
  }

  // ── Load Leaflet + MarkerCluster dynamically ──────────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = reject;
      document.head.appendChild(el);
    });
  }
  function loadStyle(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const el = document.createElement('link');
    el.rel = 'stylesheet'; el.href = href;
    document.head.appendChild(el);
  }

  const state = {
    service: 'alla',
    query: '',
    searchPoint: null,
    searchLabel: '',
    mapCenter: null,
    searching: false,
    expandedId: null,
    pinnedLocationId: null,
    showAllStopsIds: new Set(),
  };

  const fmtDate = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });

  let locations = [], stops = [], notice = '', map, clusterGroup;
  let markerById = new Map();
  let mapMoveTimer = null;

  const normalize = (str = '') => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const esc = (s = '') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const servicePill = (s) => ({ vaccin: 'Vaccinering', provtagning: 'Provtagning', bada: 'Vaccinering + provtagning' }[s] || s);
  const filterLabel = (s) => ({ alla: 'Alla tjänster', vaccin: 'Enbart vaccinering', provtagning: 'Enbart provtagning' }[s] || s);

  function normalizeStopService(services = []) {
    const list = Array.isArray(services) ? services : [];
    const set = new Set(list);
    if (set.has('bada') || (set.has('vaccin') && set.has('provtagning'))) return 'bada';
    if (set.has('vaccin')) return 'vaccin';
    if (set.has('provtagning')) return 'provtagning';
    return list[0] || '';
  }

  function stopServiceBadge(services = []) {
    const key = normalizeStopService(services);
    if (!key) return '';
    return `<span class="mw-badge mw-badge--${key}">${servicePill(key)}</span>`;
  }

  function now() { return new Date(); }
  function fmtDateLine(start) { return fmtDate.format(start).replace('.', ''); }
  function fmtTimeLine(start, end) { return `kl ${fmtTime.format(start)}–${fmtTime.format(end)}`; }
  function fmtDayTime(start, end) { return `${fmtDateLine(start)} ${fmtTimeLine(start, end)}`; }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, r = d => d * Math.PI / 180;
    const dLat = r(lat2 - lat1), dLon = r(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function locationMatchesFilter(loc) {
    if (state.service === 'alla') return true;
    return (loc.services || []).includes(state.service);
  }

  function stopMatchesFilter(services = []) {
    if (state.service === 'alla') return services.some(s => ['vaccin','provtagning','bada'].includes(s));
    if (services.includes('bada')) return true;
    return services.includes(state.service);
  }

  function getRelevantStops(locId) {
    const n = now();
    return stops
      .filter(s => s.locationId === locId && s.status === 'scheduled' && stopMatchesFilter(s.services || []))
      .map(s => ({ ...s, _start: new Date(s.start), _end: new Date(s.end) }))
      .filter(s => s._end >= n)
      .sort((a, b) => a._start - b._start);
  }

  function textMatch(loc, qNorm) {
    if (!qNorm) return true;
    const pn = normalize((loc.postalCode || '').replace(/\s/g, ''));
    const hay = [loc.name, loc.city, loc.postalCode, loc.address, pn, ...(loc.searchTerms || [])].map(normalize);
    return hay.some(v => v.includes(qNorm));
  }

  async function geocode(query) {
    const pm = query.replace(/\s/g,'').match(/^(\d{5})$/);
    if (pm) {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pm[1]}&country=SE&format=json&limit=1`, { headers: { 'Accept-Language': 'sv' } });
        if (r.ok) {
          const d = await r.json();
          if (d[0]) return { lat: +d[0].lat, lon: +d[0].lon, label: d[0].display_name.split(',')[0] };
        }
      } catch {}
    }
    try {
      const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=sv`);
      if (!r.ok) throw new Error('fail');
      const d = await r.json();
      const f = d.features?.[0];
      if (!f) return null;
      const [lon, lat] = f.geometry.coordinates;
      return { lat, lon, label: f.properties.name || query };
    } catch {
      return null;
    }
  }

  function getRankCenter() { return state.mapCenter || state.searchPoint; }

  function enrichLocation(l, center, n = now()) {
    const stopsForLoc = getRelevantStops(l.id);
    const next = stopsForLoc[0] || null;
    const hoursToNext = next ? Math.max(0, (next._start - n) / 36e5) : 9999;
    const distanceKm = center ? haversineKm(center.lat, center.lon, l.lat, l.lon) : null;
    const score = center ? (distanceKm ?? 999) : hoursToNext;
    const limit = state.showAllStopsIds.has(l.id) ? stopsForLoc.length : 5;
    return { ...l, _distanceKm: distanceKm, _next: next, _upcomingStops: stopsForLoc.slice(0,limit), _upcomingStopsTotal: stopsForLoc.length, _score: score };
  }

  function rankLocations(forceAll = false) {
    const qNorm = normalize(state.query);
    const center = getRankCenter();
    let pool = locations.filter(l => l.active && locationMatchesFilter(l));

    if (!center && qNorm) {
      const tf = pool.filter(l => textMatch(l, qNorm));
      if (tf.length) pool = tf;
    }

    let showingAll = false;
    if (center) {
      pool = pool.map(l => enrichLocation(l, center));
      let local = pool.filter(l => l._distanceKm <= 50);
      if (local.length < 3) local = pool.filter(l => l._distanceKm <= 100);
      if (local.length && !forceAll) {
        pool = local;
      } else {
        showingAll = true;
        pool = [...pool].sort((a,b) => a._distanceKm - b._distanceKm).slice(0, 12);
      }
    } else {
      pool = pool.map(l => enrichLocation(l, null));
    }

    pool.sort((a,b) => a._score - b._score || String(a.name).localeCompare(String(b.name), 'sv'));

    if (state.pinnedLocationId && !pool.some(l => l.id === state.pinnedLocationId)) {
      const pinned = locations.find(l => l.id === state.pinnedLocationId && l.active && locationMatchesFilter(l));
      if (pinned) pool = [enrichLocation(pinned, center), ...pool];
    }

    return { ranked: pool, showingAll };
  }

  function buildQuickActions(loc) {
    const hasNext = loc._upcomingStops.length > 0;
    const hasVaccin = (loc.services || []).includes('vaccin') || (loc.services || []).includes('bada');
    const hasProv   = (loc.services || []).includes('provtagning') || (loc.services || []).includes('bada');

    // Internal ortssidor (maccpeople.se) open in same tab; external booking systems keep _blank
    const isInternal = url => url && url.includes('maccpeople.se');
    const linkTarget = url => isInternal(url) ? '' : ' target="_blank" rel="noopener"';

    let primaryHtml;
    if (state.service === 'alla' && hasVaccin && hasProv) {
      const vUrl = loc.bookVaccinUrl || loc.readMoreUrl;
      const pUrl = loc.bookProvtagningUrl || loc.readMoreUrl;
      const sameUrl = vUrl === pUrl;
      if (hasNext && sameUrl) {
        primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(vUrl)}"${linkTarget(vUrl)}>Boka tid</a>`;
      } else if (hasNext) {
        primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(vUrl)}"${linkTarget(vUrl)}>Boka vaccinering</a><a class="mw-btn mw-btn--outline" href="${esc(pUrl)}"${linkTarget(pUrl)}>Boka provtagning</a>`;
      } else {
        primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(loc.readMoreUrl)}"${linkTarget(loc.readMoreUrl)}>Se öppettider</a>`;
      }
    } else if (state.service === 'vaccin' || (state.service === 'alla' && hasVaccin)) {
      const url = hasNext ? (loc.bookVaccinUrl || loc.readMoreUrl) : loc.readMoreUrl;
      primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(url)}"${linkTarget(url)}>${hasNext ? 'Boka vaccinering' : 'Se öppettider'}</a>`;
    } else {
      const url = hasNext ? (loc.bookProvtagningUrl || loc.readMoreUrl) : loc.readMoreUrl;
      primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(url)}"${linkTarget(url)}>${hasNext ? 'Boka provtagning' : 'Se öppettider'}</a>`;
    }

    // "Läs mer" as text link (no ghost button), "Visa på karta" removed
    const lasmerHtml = loc.readMoreUrl ? `<a class="mw-btn-text-link" href="${esc(loc.readMoreUrl)}"${linkTarget(loc.readMoreUrl)}>Läs mer om ${esc(loc.name.split(' ')[0])} →</a>` : '';
    return `<div class="mw-actions">${primaryHtml}${lasmerHtml}</div>`;
  }

  function locationCard(loc) {
    const expanded = state.expandedId === loc.id;
    const distHtml = (state.searchPoint || state.mapCenter) && loc._distanceKm != null ? `<div class="mw-card-meta-distance">${loc._distanceKm.toFixed(1)} km bort</div>` : '';
    const addressHtml = loc.address ? `<div class="mw-card-address">${esc(loc.address)}</div>` : '';
    const svcBadges = (loc.services || []).filter(s => s !== 'bada').map(s => `<span class="mw-badge mw-badge--${s}">${servicePill(s)}</span>`).join('');

    const nextHtml = loc._next
      ? `<div class="mw-next"><div class="mw-next-label">Nästa öppettid</div><div class="mw-next-service">${stopServiceBadge(loc._next.services)}</div><div class="mw-next-main">${esc(fmtDateLine(loc._next._start))}</div><div class="mw-next-sub">${esc(fmtTimeLine(loc._next._start, loc._next._end))}</div></div>`
      : `<div class="mw-next mw-next--empty"><div class="mw-next-label">Nästa öppettid</div><div class="mw-next-main">Ingen planerad tid just nu</div></div>`;

    const showingAll = state.showAllStopsIds.has(loc.id);
    const hasMore = !showingAll && loc._upcomingStopsTotal > loc._upcomingStops.length;
    const countText = loc._upcomingStopsTotal ? (hasMore ? `${loc._upcomingStops.length} av ${loc._upcomingStopsTotal} tider` : `${loc._upcomingStopsTotal} kommande tider`) : 'Inga kommande tider';
    const detailRows = loc._upcomingStops.length
      ? loc._upcomingStops.map(s => `<li class="mw-upcoming-item"><div class="mw-upcoming-primary"><span class="mw-upcoming-date">${esc(fmtDateLine(s._start))}</span><span class="mw-upcoming-time">${esc(fmtTimeLine(s._start, s._end))}</span></div><div class="mw-upcoming-service">${stopServiceBadge(s.services)}</div></li>`).join('')
      : `<li class="mw-upcoming-item mw-upcoming-item--empty">Ingen planerad tid just nu.</li>`;
    const showAllBtn = hasMore ? `<button class="mw-btn mw-btn--ghost" style="margin-top:8px;width:100%;font-size:13px;" type="button" data-show-all-stops="${esc(loc.id)}">Visa alla ${loc._upcomingStopsTotal} tider</button>` : '';

    return `<article class="mw-card${expanded ? ' is-expanded' : ''}" data-location-id="${esc(loc.id)}"><button class="mw-card-toggle" type="button" data-toggle-card="${esc(loc.id)}" aria-expanded="${expanded ? 'true' : 'false'}"><div class="mw-card-top"><div class="mw-card-title-wrap"><h3 class="mw-card-title">${esc(loc.name)}</h3>${addressHtml}<div class="mw-card-meta">${distHtml}<div class="mw-badges">${svcBadges}</div></div></div><div class="mw-card-right">${nextHtml}<div class="mw-accordion-cta">${expanded ? 'Dölj tider' : 'Visa fler tider'}<span class="mw-accordion-count">${esc(countText)}</span></div></div></div></button><div class="mw-card-inline-actions">${buildQuickActions(loc)}</div><div class="mw-card-details"${expanded ? '' : ' hidden'}><div class="mw-card-details-inner"><div class="mw-upcoming-block"><div class="mw-upcoming-title">Kommande tider</div><ul class="mw-upcoming-list">${detailRows}</ul>${showAllBtn}</div></div></div></article>`;
  }

  function popupHtml(loc) {
    const next = loc._next || getRelevantStops(loc.id)[0];
    const nextStr = next ? fmtDayTime(next._start, next._end) : 'Ingen planerad tid';
    const nextLabel = next ? `${servicePill(normalizeStopService(next.services))} · ${nextStr}` : nextStr;
    const bookUrl = loc.bookVaccinUrl || loc.bookProvtagningUrl || loc.readMoreUrl;
    const tgt = bookUrl && bookUrl.includes('maccpeople.se') ? '' : ' target="_blank" rel="noopener"';
    return `<div class="mw-popup-title">${esc(loc.name)}</div><div class="mw-popup-addr">${esc(loc.address || loc.city || '')}</div><div class="mw-popup-next">${esc(nextLabel)}</div><div class="mw-popup-actions"><a href="${esc(next ? bookUrl : loc.readMoreUrl)}"${tgt}>${next ? 'Boka tid' : 'Se öppettider'}</a><button type="button" class="mw-popup-list-link" data-popup-open-card="${esc(loc.id)}">Visa tider i listan</button></div>`;
  }

  function markerIcon(hasNext) {
    const color = hasNext ? '#d7263d' : '#0d6973';
    const pulse = hasNext ? `<div class="mw-marker-pulse" style="background:${color}"></div>` : '';
    const html = `<div class="mw-marker-wrap">${pulse}<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="${color}"/><path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="url(#pin-grad-${hasNext?'red':'teal'})" opacity="0.35"/><circle cx="14" cy="14" r="6" fill="white" opacity="0.95"/>${hasNext ? `<path d="M14 10v4l2.5 2.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>` : `<circle cx="14" cy="14" r="2.5" fill="${color}"/>`}<defs><radialGradient id="pin-grad-red" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="white" stop-opacity="0.4"/><stop offset="100%" stop-color="black" stop-opacity="0"/></radialGradient><radialGradient id="pin-grad-teal" cx="40%" cy="30%" r="70%"><stop offset="0%" stop-color="white" stop-opacity="0.4"/><stop offset="100%" stop-color="black" stop-opacity="0"/></radialGradient></defs></svg></div>`;
    return L.divIcon({ className: '', html, iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -34] });
  }

  function fitMapToAllActive() {
    const allActive = locations.filter(l => l.active);
    const coords = allActive.map(l => [l.lat, l.lon]);
    if (!coords.length || !map) return;
    const isMobile = window.innerWidth <= 760;
    map.fitBounds(L.latLngBounds(coords), { paddingTopLeft: isMobile ? [20,20] : [36,36], paddingBottomRight: isMobile ? [20,20] : [36,36], maxZoom: isMobile ? 6 : 7 });
  }

  function scrollCardIntoView(root, locationId) {
    if (!locationId) return;
    const escapedId = window.CSS && typeof window.CSS.escape === 'function' ? window.CSS.escape(locationId) : locationId.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    const el = root.querySelector(`[data-location-id="${escapedId}"]`);
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top - 12;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function preserveMapViewport(root, fn) {
    const mapEl = root.querySelector('#macc-widget-map');
    const isMobile = window.innerWidth <= 980;
    if (!mapEl || !isMobile) { fn(); return; }
    const beforeTop = mapEl.getBoundingClientRect().top;
    const scrollY = window.scrollY;
    fn();
    const afterTop = mapEl.getBoundingClientRect().top;
    const delta = afterTop - beforeTop;
    if (Math.abs(delta) > 1) window.scrollTo({ top: scrollY + delta, behavior: 'auto' });
  }

  function openCard(root, locationId, scroll = false) {
    state.pinnedLocationId = locationId;
    const closing = state.expandedId === locationId;
    state.expandedId = closing ? null : locationId;
    if (closing) state.showAllStopsIds.delete(locationId);
    refreshList(root);
    if (scroll && state.expandedId) setTimeout(() => scrollCardIntoView(root, locationId), 60);
  }

  function renderMap() {
    const mapEl = document.getElementById('macc-widget-map');
    const fresh = !map || !mapEl || map.getContainer() !== mapEl;

    if (fresh) {
      if (map) { try { map.remove(); } catch {} }
      map = L.map('macc-widget-map', { scrollWheelZoom: false }).setView([56.5, 13.5], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      clusterGroup = L.markerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true, maxClusterRadius: 45, chunkedLoading: true });
      map.addLayer(clusterGroup);

      let mapReady = false;
      map.on('moveend', () => {
        if (!mapReady) return;
        clearTimeout(mapMoveTimer);
        mapMoveTimer = setTimeout(() => {
          const c = map.getCenter();
          state.mapCenter = { lat: c.lat, lon: c.lng };
          const root = document.getElementById('macc-booking-widget');
          if (root) refreshList(root, { preserveMapViewport: true });
        }, 300);
      });

      map.on('popupopen', (evt) => {
        const root = document.getElementById('macc-booking-widget');
        const popupEl = evt.popup && evt.popup.getElement ? evt.popup.getElement() : null;
        const btn = popupEl ? popupEl.querySelector('.mw-popup-list-link') : null;
        if (!root || !btn) return;
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-popup-open-card');
          state.pinnedLocationId = id;
          state.expandedId = id;
          refreshList(root);
          setTimeout(() => scrollCardIntoView(root, id), 60);
        }, { once: true });
      });

      setTimeout(() => { mapReady = true; }, 850);
    }

    clusterGroup.clearLayers();
    markerById = new Map();

    const allActive = locations.filter(l => l.active);
    allActive.forEach(loc => {
      const relevant = getRelevantStops(loc.id);
      const next = relevant[0] || null;
      const m = L.marker([loc.lat, loc.lon], { icon: markerIcon(!!next) });
      m.bindPopup(popupHtml({ ...loc, _next: next }));
      clusterGroup.addLayer(m);
      markerById.set(loc.id, m);
    });

    if (!state.mapCenter) {
      if (state.searchPoint) {
        map.setView([state.searchPoint.lat, state.searchPoint.lon], 10);
      } else {
        requestAnimationFrame(() => { map.invalidateSize(); fitMapToAllActive(); setTimeout(() => { map.invalidateSize(); fitMapToAllActive(); }, 150); });
      }
    }
  }

  function refreshList(root, opts = {}) {
    const { ranked, showingAll } = rankLocations();
    const leftEl = root.querySelector('.mw-left');
    if (!leftEl) return;
    const update = () => { leftEl.innerHTML = buildListHtml(ranked, showingAll); bindListEvents(root); };
    if (opts.preserveMapViewport) preserveMapViewport(root, update); else update();
  }

  function buildContextLine() {
    if (state.mapCenter && state.searchPoint) return `Visar orter nära kartans mittpunkt. <button class="mw-link-btn" data-reset-map>Återgå till sökning</button>`;
    if (state.mapCenter) return `Visar orter nära kartans mittpunkt.`;
    if (state.searchLabel) return `Visar träffar nära <strong>${esc(state.searchLabel)}</strong>`;
    return 'Visar alla platser.';
  }

  function buildListHtml(ranked, showingAll) {
    const noticeHtml = notice ? `<div class="mw-notice"><span class="mw-notice-icon">⚠</span><span>${esc(notice)}</span></div>` : '';
    let cardsHtml;
    if (ranked.length === 0) {
      cardsHtml = `<div class="mw-empty">Inga träffar för vald kombination. <button class="mw-link-btn" data-show-all>Visa alla orter i närheten</button></div>`;
    } else if (showingAll) {
      cardsHtml = `<div class="mw-fallback-note">Inga träffar inom 100 km — visar närmaste alternativ.</div>${ranked.map(locationCard).join('')}`;
    } else {
      cardsHtml = ranked.map(locationCard).join('');
    }
    return `${noticeHtml}<div class="mw-context">${buildContextLine()}</div><div class="mw-card-list">${cardsHtml}</div>`;
  }

  function bindListEvents(root) {
    root.querySelectorAll('[data-toggle-card]').forEach(btn => btn.addEventListener('click', e => openCard(root, e.currentTarget.getAttribute('data-toggle-card'), false)));
    root.querySelectorAll('[data-show-all-stops]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-show-all-stops');
      state.showAllStopsIds.add(id);
      refreshList(root);
    }));
    root.querySelectorAll('[data-show-on-map]').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-show-on-map');
      const marker = markerById.get(id);
      if (marker && map) {
        const latLng = marker.getLatLng();
        map.setView(latLng, 12);
        marker.openPopup();
      }
    }));
    root.querySelector('[data-show-all]')?.addEventListener('click', () => {
      const { ranked } = rankLocations(true);
      const leftEl = root.querySelector('.mw-left');
      if (leftEl) { leftEl.innerHTML = buildListHtml(ranked, true); bindListEvents(root); }
    });
    root.querySelector('[data-reset-map]')?.addEventListener('click', () => {
      state.mapCenter = null;
      refreshList(root);
      if (state.searchPoint) map.setView([state.searchPoint.lat, state.searchPoint.lon], 10); else fitMapToAllActive();
    });
  }

  function buildSuggestions(query) {
    const q = normalize(query);
    if (!q || q.length < 2) return [];
    return locations
      .filter(l => l.active && textMatch(l, q))
      .sort((a, b) => {
        const an = normalize(a.name), bn = normalize(b.name);
        const aStarts = an.startsWith(q) ? 0 : 1;
        const bStarts = bn.startsWith(q) ? 0 : 1;
        return aStarts - bStarts || an.localeCompare(bn, 'sv');
      })
      .slice(0, 7);
  }

  function bindAutocomplete(root) {
    const input = root.querySelector('[data-search-input]');
    if (!input) return;

    const dropdown = document.createElement('ul');
    dropdown.className = 'mw-autocomplete';
    dropdown.setAttribute('role', 'listbox');
    dropdown.hidden = true;
    input.parentNode.appendChild(dropdown);

    let activeIdx = -1;
    let suggestions = [];
    let lastQuery = '';

    function closeDropdown() {
      dropdown.hidden = true;
      dropdown.innerHTML = '';
      activeIdx = -1;
    }

    function renderDropdown(sugg) {
      if (!sugg.length) { closeDropdown(); return; }
      dropdown.innerHTML = sugg.map((loc, i) =>
        `<li class="mw-autocomplete-item" role="option" data-idx="${i}">
          <span class="mw-autocomplete-name">${esc(loc.name)}</span>
          <span class="mw-autocomplete-city">${esc(loc.city || '')}</span>
        </li>`
      ).join('');
      dropdown.hidden = false;
      activeIdx = -1;
    }

    function setActive(idx) {
      const items = dropdown.querySelectorAll('.mw-autocomplete-item');
      items.forEach((el, i) => el.classList.toggle('is-active', i === idx));
      activeIdx = idx;
      if (idx >= 0 && suggestions[idx]) input.value = suggestions[idx].name;
    }

    function pickSuggestion(loc) {
      input.value = loc.name;
      state.query = loc.name;
      closeDropdown();
      state.searchPoint = { lat: loc.lat, lon: loc.lon };
      state.searchLabel = loc.name;
      state.mapCenter = null;
      state.expandedId = null;
      state.pinnedLocationId = null;
      render(root);
    }

    input.addEventListener('input', () => {
      const q = input.value;
      if (q === lastQuery) return;
      lastQuery = q;
      suggestions = buildSuggestions(q);
      renderDropdown(suggestions);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && suggestions[activeIdx]) {
          pickSuggestion(suggestions[activeIdx]);
        } else {
          closeDropdown();
          runSearch(root);
        }
        return;
      }
      if (!dropdown.hidden && suggestions.length) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActive(Math.min(activeIdx + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActive(Math.max(activeIdx - 1, 0));
        } else if (e.key === 'Escape') {
          closeDropdown();
        }
      }
    });

    dropdown.addEventListener('mousedown', e => {
      const item = e.target.closest('.mw-autocomplete-item');
      if (!item) return;
      e.preventDefault();
      const idx = +item.dataset.idx;
      if (suggestions[idx]) pickSuggestion(suggestions[idx]);
    });

    document.addEventListener('click', e => {
      if (!root.contains(e.target)) closeDropdown();
    }, true);
  }

  function render(root) {
    const { ranked, showingAll } = rankLocations();
    root.innerHTML = `<div class="macc-widget"><section class="mw-controls"><div class="mw-controls-row"><div class="mw-filter-group">${['alla','vaccin','provtagning'].map(s => `<button class="mw-filter-btn${state.service===s?' is-active':''}" data-service="${s}">${filterLabel(s)}</button>`).join('')}</div><div class="mw-search-group"><div class="mw-search-wrap"><span class="mw-search-icon">⌕</span><input class="mw-search-input" data-search-input placeholder="Sök ort, adress eller postnummer" value="${esc(state.query)}" /></div><button class="mw-geo-btn mw-geo-btn--labeled" data-geo-btn title="Använd min plats" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Nära mig</button><button class="mw-search-btn${state.searching?' is-loading':''}" data-search-btn type="button" ${state.searching?'disabled':''}>${state.searching?'Söker…':'Sök'}</button></div></div></section><div class="mw-main"><div class="mw-left">${buildListHtml(ranked, showingAll)}</div><div class="mw-right"><div class="mw-map-hint">Sök först. Om du vill justera resultatet kan du sedan flytta kartan. Klicka på en ort i kartan och välj <strong>Visa tider i listan</strong> när du vill hoppa till kortet.</div><div id="macc-widget-map" class="mw-map"></div></div></div></div>`;

    renderMap();

    root.querySelectorAll('[data-service]').forEach(btn => btn.addEventListener('click', () => { state.service = btn.dataset.service; state.mapCenter = null; state.expandedId = null; state.pinnedLocationId = null; render(root); }));
    root.querySelector('[data-search-btn]').addEventListener('click', () => runSearch(root));
    bindAutocomplete(root);
    root.querySelector('[data-geo-btn]').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(pos => {
        state.searchPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        state.searchLabel = 'din plats';
        state.mapCenter = null;
        state.query = '';
        state.expandedId = null;
        state.pinnedLocationId = null;
        root.querySelector('[data-search-input]').value = '';
        render(root);
      });
    });
    bindListEvents(root);
  }

  async function runSearch(root) {
    const input = root.querySelector('[data-search-input]');
    const query = input.value.trim();
    state.query = query;
    state.mapCenter = null;
    state.expandedId = null;
    state.pinnedLocationId = null;
    if (!query) { state.searchPoint = null; state.searchLabel = ''; render(root); return; }

    const qNorm = normalize(query);
    const local = locations.find(l => textMatch(l, qNorm));
    if (local) {
      state.searchPoint = { lat: local.lat, lon: local.lon, label: local.name };
      state.searchLabel = local.name;
      render(root);
      return;
    }

    state.searching = true;
    const btn = root.querySelector('[data-search-btn]');
    if (btn) { btn.disabled = true; btn.textContent = 'Söker…'; btn.classList.add('is-loading'); }

    try {
      const geo = await geocode(query);
      state.searchPoint = geo || null;
      state.searchLabel = geo ? (geo.label || query) : query;
    } finally {
      state.searching = false;
    }
    render(root);
  }

  async function init() {
    const root = document.getElementById('macc-booking-widget');
    if (!root) return;

    // Load Leaflet and MarkerCluster from CDN
    loadStyle('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');
    loadStyle('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.css');
    loadStyle('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.css');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js');

    const base = (root.dataset.base || 'https://maccpeople.com/widget').replace(/\/$/, '');
    const [lr, sr, cr] = await Promise.all([
      fetch(`${base}/assets/macc-locations.json`, { cache: 'no-store' }),
      fetch(`${base}/assets/macc-stops.json`,     { cache: 'no-store' }),
      fetch(`${base}/assets/macc-config.json`,    { cache: 'no-store' })
    ]);
    locations = (await lr.json()).locations || [];
    stops     = (await sr.json()).stops     || [];
    const config = await cr.json().catch(() => ({}));
    notice = config.notice || '';
    render(root);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
