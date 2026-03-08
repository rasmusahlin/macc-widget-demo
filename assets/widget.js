(() => {
  const state = {
    service: 'alla',
    query: '',
    searchPoint: null,
    searchLabel: '',
    mapCenter: null,
    searching: false,
  };

  const fmtDate = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const fmtDayTime = (s, e) => `${fmtDate.format(s)} ${fmtTime.format(s)}–${fmtTime.format(e)}`;

  let locations = [], stops = [], map, clusterGroup;
  let markerById = new Map();
  let mapMoveTimer = null;

  const normalize = (str = '') => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const esc = (s = '') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const servicePill = (s) => ({ vaccin: 'Vaccinering', provtagning: 'Provtagning' }[s] || s);
  const filterLabel = (s) => ({ alla: 'Alla tjänster', vaccin: 'Enbart vaccinering', provtagning: 'Enbart provtagning' }[s] || s);

  function now() { return new Date(); }

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
        if (r.ok) { const d = await r.json(); if (d[0]) return { lat: +d[0].lat, lon: +d[0].lon, label: d[0].display_name.split(',')[0] }; }
      } catch {}
    }
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=sv`);
    if (!r.ok) throw new Error('fail');
    const d = await r.json();
    const f = d.features?.[0];
    if (!f) return null;
    const [lon, lat] = f.geometry.coordinates;
    return { lat, lon, label: f.properties.name || query };
  }

  function getRankCenter() { return state.mapCenter || state.searchPoint; }

  function rankLocations(forceAll = false) {
    const n = now();
    const qNorm = normalize(state.query);
    let pool = locations.filter(l => l.active && locationMatchesFilter(l));
    const center = getRankCenter();

    if (!center && qNorm) {
      const tf = pool.filter(l => textMatch(l, qNorm));
      if (tf.length) pool = tf;
    }

    let showingAll = false;
    if (center) {
      pool = pool.map(l => ({ ...l, _distanceKm: haversineKm(center.lat, center.lon, l.lat, l.lon) }));
      let local = pool.filter(l => l._distanceKm <= 50);
      if (local.length < 3) local = pool.filter(l => l._distanceKm <= 100);
      if (local.length && !forceAll) {
        pool = local;
      } else {
        showingAll = true;
        pool = [...pool].sort((a,b) => a._distanceKm - b._distanceKm).slice(0, 12);
      }
    } else {
      pool = pool.map(l => ({ ...l, _distanceKm: null }));
    }

    const enriched = pool.map(l => {
      const stops = getRelevantStops(l.id);
      const next = stops[0] || null;
      const hoursToNext = next ? Math.max(0, (next._start - n) / 36e5) : 9999;
      const distScore = l._distanceKm ?? 999;
      const score = center ? distScore : hoursToNext;
      return { ...l, _next: next, _upcomingStops: stops.slice(0,2), _score: score };
    });

    return { ranked: enriched.sort((a,b) => a._score - b._score), showingAll };
  }

  function locationCard(loc) {
    // Address line
    const addressHtml = loc.address
      ? `<div class="mw-card-address">${esc(loc.address)}</div>`
      : '';

    // Distance badge
    const distHtml = (state.searchPoint || state.mapCenter) && loc._distanceKm != null
      ? `<span class="mw-dist">${loc._distanceKm.toFixed(1)} km</span>`
      : '';

    // Service badges — show all services the location offers (excluding 'bada' internal tag)
    const svcBadges = (loc.services || [])
      .filter(s => s !== 'bada')
      .map(s => `<span class="mw-badge mw-badge--${s}">${servicePill(s)}</span>`)
      .join('');

    // Upcoming times (up to 2)
    let timesHtml;
    if (loc._upcomingStops.length) {
      timesHtml = `<div class="mw-times">
        <span class="mw-times-label">Nästa öppettid</span>
        ${loc._upcomingStops.map((s,i) => `<div class="mw-time${i>0?' mw-time--dim':''}">${fmtDayTime(s._start, s._end)}</div>`).join('')}
      </div>`;
    } else {
      timesHtml = `<div class="mw-times mw-times--empty">
        <span class="mw-times-label">Nästa öppettid</span>
        <div class="mw-time mw-time--none">Ingen planerad tid just nu</div>
      </div>`;
    }

    const hasNext = loc._upcomingStops.length > 0;
    const hasVaccin = (loc.services||[]).includes('vaccin') || (loc.services||[]).includes('bada');
    const hasProv   = (loc.services||[]).includes('provtagning') || (loc.services||[]).includes('bada');

    let actionsHtml;
    if (state.service === 'alla' && hasVaccin && hasProv) {
      // Both services — merge to one button if URLs are the same
      const vUrl = loc.bookVaccinUrl || loc.readMoreUrl;
      const pUrl = loc.bookProvtagningUrl || loc.readMoreUrl;
      const sameUrl = vUrl === pUrl;
      actionsHtml = hasNext
        ? sameUrl
          ? `<a class="mw-btn mw-btn--primary" href="${esc(vUrl)}" target="_blank" rel="noopener">Boka tid</a>
             <a class="mw-btn mw-btn--ghost" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>`
          : `<a class="mw-btn mw-btn--primary" href="${esc(vUrl)}" target="_blank" rel="noopener">Boka vaccinering</a>
             <a class="mw-btn mw-btn--outline" href="${esc(pUrl)}" target="_blank" rel="noopener">Boka provtagning</a>
             <a class="mw-btn mw-btn--ghost" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>`
        : `<a class="mw-btn mw-btn--ghost" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Se öppettider</a>`;
    } else if (state.service === 'vaccin' || (state.service === 'alla' && hasVaccin)) {
      const url = hasNext ? (loc.bookVaccinUrl || loc.readMoreUrl) : loc.readMoreUrl;
      actionsHtml = `<a class="mw-btn mw-btn--primary" href="${esc(url)}" target="_blank" rel="noopener">${hasNext ? 'Boka vaccinering' : 'Se öppettider'}</a>
                     <a class="mw-btn mw-btn--ghost" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>`;
    } else {
      const url = hasNext ? (loc.bookProvtagningUrl || loc.readMoreUrl) : loc.readMoreUrl;
      actionsHtml = `<a class="mw-btn mw-btn--primary" href="${esc(url)}" target="_blank" rel="noopener">${hasNext ? 'Boka provtagning' : 'Se öppettider'}</a>
                     <a class="mw-btn mw-btn--ghost" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>`;
    }

    return `
      <article class="mw-card" data-location-id="${esc(loc.id)}">
        <div class="mw-card-head">
          <div class="mw-card-title-group">
            <h3 class="mw-card-title">${esc(loc.name)}</h3>
            ${addressHtml}
          </div>
          <div class="mw-card-right">
            ${distHtml}
            <div class="mw-badges">${svcBadges}</div>
          </div>
        </div>
        ${timesHtml}
        <div class="mw-actions">${actionsHtml}</div>
      </article>`;
  }

  function popupHtml(loc) {
    const next = loc._next || getRelevantStops(loc.id)[0];
    const nextStr = next ? fmtDayTime(next._start, next._end) : 'Ingen planerad tid';
    const bookUrl = loc.bookVaccinUrl || loc.bookProvtagningUrl || loc.readMoreUrl;
    return `<div class="mw-popup-title">${esc(loc.name)}</div>
      <div class="mw-popup-addr">${esc(loc.address || loc.city)}</div>
      <div class="mw-popup-next">${esc(nextStr)}</div>
      <div class="mw-popup-actions">
        <a href="${esc(next ? bookUrl : loc.readMoreUrl)}" target="_blank" rel="noopener">${next ? 'Boka tid' : 'Se öppettider'}</a>
        <a href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>
      </div>`;
  }

  function markerIcon(hasNext) {
    const bg = hasNext ? '#d7263d' : '#0d6973';
    return L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${bg};border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25)"></div>`,
      iconSize: [18,18], iconAnchor: [9,9]
    });
  }

  function renderMap(ranked) {
    const mapEl = document.getElementById('macc-widget-map');
    const fresh = !map || !mapEl || map.getContainer() !== mapEl;

    if (fresh) {
      if (map) { try { map.remove(); } catch {} }
      map = L.map('macc-widget-map', { scrollWheelZoom: false }).setView([56.5, 13.5], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      clusterGroup = L.markerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true });
      map.addLayer(clusterGroup);

      map.on('moveend', () => {
        clearTimeout(mapMoveTimer);
        mapMoveTimer = setTimeout(() => {
          const c = map.getCenter();
          state.mapCenter = { lat: c.lat, lon: c.lng };
          const root = document.getElementById('macc-booking-widget');
          if (root) refreshList(root);
        }, 350);
      });
    }

    clusterGroup.clearLayers();
    markerById = new Map();
    ranked.forEach(loc => {
      const m = L.marker([loc.lat, loc.lon], { icon: markerIcon(!!loc._next) });
      m.bindPopup(popupHtml(loc));
      clusterGroup.addLayer(m);
      markerById.set(loc.id, m);
    });

    if (!state.mapCenter && ranked.length) {
      if (state.searchPoint) {
        map.setView([state.searchPoint.lat, state.searchPoint.lon], 10);
      } else {
        map.fitBounds(L.latLngBounds(ranked.map(l => [l.lat, l.lon])).pad(0.1), { maxZoom: ranked.length === 1 ? 13 : 8 });
      }
    }
  }

  function refreshList(root) {
    const { ranked, showingAll } = rankLocations();

    // Sync markers: remove stale, add new
    const newIds = new Set(ranked.map(l => l.id));
    markerById.forEach((m, id) => {
      if (!newIds.has(id)) { clusterGroup.removeLayer(m); markerById.delete(id); }
    });
    ranked.forEach(loc => {
      if (markerById.has(loc.id)) {
        const m = markerById.get(loc.id);
        m.setIcon(markerIcon(!!loc._next));
        m.setPopupContent(popupHtml(loc));
      } else {
        const m = L.marker([loc.lat, loc.lon], { icon: markerIcon(!!loc._next) });
        m.bindPopup(popupHtml(loc));
        clusterGroup.addLayer(m);
        markerById.set(loc.id, m);
      }
    });

    // Update list
    const leftEl = root.querySelector('.mw-left');
    if (leftEl) {
      leftEl.innerHTML = buildListHtml(ranked, showingAll);
      bindListEvents(root, ranked);
    }
  }

  function buildContextLine() {
    if (state.mapCenter && state.searchPoint) return `Visar orter nära kartans mittpunkt. <button class="mw-link-btn" data-reset-map>Återgå till sökning</button>`;
    if (state.mapCenter) return `Visar orter nära kartans mittpunkt.`;
    if (state.searchLabel) return `Visar träffar nära <strong>${esc(state.searchLabel)}</strong>`;
    return 'Visar alla platser.';
  }

  function buildListHtml(ranked, showingAll) {
    let cardsHtml;
    if (ranked.length === 0) {
      cardsHtml = `<div class="mw-empty">Inga träffar för vald kombination. <button class="mw-link-btn" data-show-all>Visa alla orter i närheten</button></div>`;
    } else if (showingAll) {
      cardsHtml = `<div class="mw-fallback-note">Inga träffar inom 100 km — visar närmaste alternativ.</div>${ranked.map(locationCard).join('')}`;
    } else {
      cardsHtml = ranked.map(locationCard).join('');
    }
    return `<div class="mw-context">${buildContextLine()}</div><div class="mw-card-list">${cardsHtml}</div>`;
  }

  function bindListEvents(root, ranked) {
    root.querySelectorAll('[data-location-id]').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('a,button')) return;
        const m = markerById.get(card.dataset.locationId);
        if (m) { map.setView(m.getLatLng(), 12); m.openPopup(); }
      });
    });
    root.querySelector('[data-show-all]')?.addEventListener('click', () => {
      const { ranked } = rankLocations(true);
      const leftEl = root.querySelector('.mw-left');
      if (leftEl) { leftEl.innerHTML = buildListHtml(ranked, true); bindListEvents(root, ranked); }
    });
    root.querySelector('[data-reset-map]')?.addEventListener('click', () => {
      state.mapCenter = null;
      refreshList(root);
      if (state.searchPoint) map.setView([state.searchPoint.lat, state.searchPoint.lon], 10);
    });
  }

  function render(root) {
    const { ranked, showingAll } = rankLocations();
    root.innerHTML = `
      <div class="macc-widget">
        <section class="mw-controls">
          <div class="mw-controls-row">
            <div class="mw-filter-group">
              ${['alla','vaccin','provtagning'].map(s => `
                <button class="mw-filter-btn${state.service===s?' is-active':''}" data-service="${s}">${filterLabel(s)}</button>
              `).join('')}
            </div>
            <div class="mw-search-group">
              <div class="mw-search-wrap">
                <span class="mw-search-icon">⌕</span>
                <input class="mw-search-input" data-search-input placeholder="Sök ort, adress eller postnummer" value="${esc(state.query)}" />
                <button class="mw-geo-btn" data-geo-btn title="Använd min plats">📍</button>
              </div>
              <button class="mw-search-btn${state.searching?' is-loading':''}" data-search-btn ${state.searching?'disabled':''}>
                ${state.searching?'Söker…':'Sök'}
              </button>
            </div>
          </div>
        </section>
        <div class="mw-main">
          <div class="mw-left">${buildListHtml(ranked, showingAll)}</div>
          <div class="mw-right">
            <div class="mw-map-hint">Flytta kartan för att uppdatera listan</div>
            <div id="macc-widget-map" class="mw-map"></div>
          </div>
        </div>
      </div>`;

    renderMap(ranked);

    root.querySelectorAll('[data-service]').forEach(btn =>
      btn.addEventListener('click', () => { state.service = btn.dataset.service; state.mapCenter = null; render(root); })
    );
    root.querySelector('[data-search-btn]').addEventListener('click', () => runSearch(root));
    root.querySelector('[data-search-input]').addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); runSearch(root); } });
    root.querySelector('[data-geo-btn]').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(pos => {
        state.searchPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        state.searchLabel = 'din plats';
        state.mapCenter = null;
        state.query = '';
        root.querySelector('[data-search-input]').value = '';
        render(root);
      });
    });
    bindListEvents(root, ranked);
  }

  async function runSearch(root) {
    const input = root.querySelector('[data-search-input]');
    const query = input.value.trim();
    state.query = query;
    state.mapCenter = null;
    if (!query) { state.searchPoint = null; state.searchLabel = ''; render(root); return; }

    // Local match first (instant)
    const qNorm = normalize(query);
    const local = locations.find(l => textMatch(l, qNorm));
    if (local) {
      state.searchPoint = { lat: local.lat, lon: local.lon, label: local.name };
      state.searchLabel = local.name;
      render(root);
      return;
    }

    // Remote geocode
    state.searching = true;
    const btn = root.querySelector('[data-search-btn]');
    if (btn) { btn.disabled = true; btn.textContent = 'Söker…'; btn.classList.add('is-loading'); }

    try {
      const geo = await geocode(query);
      state.searchPoint = geo || null;
      state.searchLabel = geo ? (geo.label || query) : query;
    } catch {
      state.searchPoint = null;
      state.searchLabel = query;
    } finally {
      state.searching = false;
    }
    render(root);
  }

  async function init() {
    const root = document.getElementById('macc-booking-widget');
    if (!root) return;
    const [lr, sr] = await Promise.all([
      fetch('./assets/macc-locations.json', { cache: 'no-store' }),
      fetch('./assets/macc-stops.json', { cache: 'no-store' })
    ]);
    locations = (await lr.json()).locations || [];
    stops = (await sr.json()).stops || [];
    render(root);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
