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
  let relevantStopsByLocation = new Map();
  let activeLocations = [];

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

  function buildStopCache() {
    const n = now();
    relevantStopsByLocation = new Map();

    for (const s of stops) {
      if (s.status !== 'scheduled') continue;
      const start = new Date(s.start);
      const end = new Date(s.end);
      if (end < n) continue;
      const enriched = { ...s, _start: start, _end: end };
      if (!relevantStopsByLocation.has(s.locationId)) relevantStopsByLocation.set(s.locationId, []);
      relevantStopsByLocation.get(s.locationId).push(enriched);
    }

    relevantStopsByLocation.forEach(arr => arr.sort((a, b) => a._start - b._start));
    activeLocations = locations.filter(l => l.active);
  }

  function getRelevantStops(locId) {
    const base = relevantStopsByLocation.get(locId) || [];
    return base.filter(s => stopMatchesFilter(s.services || []));
  }

  function getNextStop(locId) {
    const relevant = getRelevantStops(locId);
    return relevant[0] || null;
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
    let pool = activeLocations.filter(locationMatchesFilter);
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
      const locStops = getRelevantStops(l.id);
      const next = locStops[0] || null;
      const hoursToNext = next ? Math.max(0, (next._start - n) / 36e5) : 9999;
      const distScore = l._distanceKm ?? 999;
      const score = center ? distScore : hoursToNext;
      return { ...l, _next: next, _upcomingStops: locStops.slice(0,2), _score: score };
    });

    return { ranked: enriched.sort((a,b) => a._score - b._score), showingAll };
  }

  function locationCard(loc) {
    const addressHtml = loc.address ? `<div class="mw-card-address">${esc(loc.address)}</div>` : '';

    const distHtml = (state.searchPoint || state.mapCenter) && loc._distanceKm != null
      ? `<span class="mw-dist">${loc._distanceKm.toFixed(1)} km</span>`
      : '';

    const svcBadges = (loc.services || [])
      .filter(s => s !== 'bada')
      .map(s => `<span class="mw-badge mw-badge--${s}">${servicePill(s)}</span>`)
      .join('');

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
    const hasProv = (loc.services||[]).includes('provtagning') || (loc.services||[]).includes('bada');

    let actionsHtml;
    if (state.service === 'alla' && hasVaccin && hasProv) {
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
    const color = hasNext ? '#d7263d' : '#0d6973';
    const pulse = hasNext ? `<div class="mw-marker-pulse" style="background:${color}"></div>` : '';
    const html = `
      <div class="mw-marker-wrap">
        ${pulse}
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="${color}"/>
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="url(#pin-grad-${hasNext?'red':'teal'})" opacity="0.35"/>
          <circle cx="14" cy="14" r="6" fill="white" opacity="0.95"/>
          ${hasNext
            ? `<path d="M14 10v4l2.5 2.5" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`
            : `<circle cx="14" cy="14" r="2.5" fill="${color}"/>`
          }
          <defs>
            <radialGradient id="pin-grad-red" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stop-color="white" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="black" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="pin-grad-teal" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stop-color="white" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="black" stop-opacity="0"/>
            </radialGradient>
          </defs>
        </svg>
      </div>`;
    return L.divIcon({
      className: '',
      html,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -34]
    });
  }

  function fitMapToActiveLocations() {
    if (!map || !activeLocations.length) return;
    const coords = activeLocations.map(l => [l.lat, l.lon]);
    const isMobile = window.innerWidth <= 680;
    map.fitBounds(L.latLngBounds(coords), {
      paddingTopLeft: isMobile ? [18, 18] : [36, 36],
      paddingBottomRight: isMobile ? [18, 18] : [36, 36],
      maxZoom: isMobile ? 6 : 7
    });
  }

  function ensureAllMarkers() {
    if (!clusterGroup) return;
    clusterGroup.clearLayers();
    markerById = new Map();

    activeLocations.forEach(loc => {
      const next = getNextStop(loc.id);
      const marker = L.marker([loc.lat, loc.lon], { icon: markerIcon(!!next) });
      marker.bindPopup(popupHtml({ ...loc, _next: next }));
      clusterGroup.addLayer(marker);
      markerById.set(loc.id, marker);
    });
  }

  function renderMap(ranked) {
    const mapEl = document.getElementById('macc-widget-map');
    const fresh = !map || !mapEl || map.getContainer() !== mapEl;

    if (fresh) {
      if (map) { try { map.remove(); } catch {} }
      map = L.map('macc-widget-map', { scrollWheelZoom: false }).setView([56.5, 13.5], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 45,
        chunkedLoading: true,
        chunkInterval: 120,
        chunkDelay: 25,
      });
      map.addLayer(clusterGroup);

      let mapReady = false;
      map.on('moveend', () => {
        if (!mapReady) return;
        clearTimeout(mapMoveTimer);
        mapMoveTimer = setTimeout(() => {
          const c = map.getCenter();
          state.mapCenter = { lat: c.lat, lon: c.lng };
          const root = document.getElementById('macc-booking-widget');
          if (root) refreshList(root);
        }, 350);
      });

      setTimeout(() => { mapReady = true; }, 800);
      window.addEventListener('resize', () => {
        if (!map) return;
        clearTimeout(window.__maccResizeTimer);
        window.__maccResizeTimer = setTimeout(() => {
          map.invalidateSize();
          if (!state.searchPoint && !state.mapCenter) fitMapToActiveLocations();
        }, 120);
      });
    }

    ensureAllMarkers();

    if (!state.mapCenter) {
      if (state.searchPoint) {
        map.setView([state.searchPoint.lat, state.searchPoint.lon], 10);
      } else {
        requestAnimationFrame(() => {
          map.invalidateSize();
          fitMapToActiveLocations();
          setTimeout(() => {
            map.invalidateSize();
            fitMapToActiveLocations();
          }, 160);
        });
      }
    }
  }

  function buildContextLine() {
    if (state.mapCenter && state.searchPoint) return `Visar orter nära kartans mittpunkt. <button class="mw-link-btn" data-reset-map>Återgå till sökning</button>`;
    if (state.mapCenter) return `Visar orter nära kartans mittpunkt. <button class="mw-link-btn" data-show-sweden>Visa alla orter</button>`;
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

  function refreshList(root) {
    const { ranked, showingAll } = rankLocations();
    const leftEl = root.querySelector('.mw-left');
    if (leftEl) {
      leftEl.innerHTML = buildListHtml(ranked, showingAll);
      bindListEvents(root, ranked);
    }
  }

  function resetToSearch(root) {
    state.mapCenter = null;
    refreshList(root);
    if (state.searchPoint) {
      map.setView([state.searchPoint.lat, state.searchPoint.lon], 10);
    } else {
      requestAnimationFrame(() => {
        map.invalidateSize();
        fitMapToActiveLocations();
      });
    }
  }

  function showAllLocations(root) {
    state.mapCenter = null;
    state.searchPoint = null;
    state.searchLabel = '';
    state.query = '';
    const input = root.querySelector('[data-search-input]');
    if (input) input.value = '';
    refreshList(root);
    requestAnimationFrame(() => {
      map.invalidateSize();
      fitMapToActiveLocations();
    });
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
      if (leftEl) {
        leftEl.innerHTML = buildListHtml(ranked, true);
        bindListEvents(root, ranked);
      }
    });

    root.querySelector('[data-reset-map]')?.addEventListener('click', () => resetToSearch(root));
    root.querySelector('[data-show-sweden]')?.addEventListener('click', () => showAllLocations(root));
    root.querySelector('[data-reset-map-btn]')?.addEventListener('click', () => {
      if (state.searchPoint) {
        resetToSearch(root);
      } else {
        showAllLocations(root);
      }
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
              </div>
              <button class="mw-geo-btn" data-geo-btn title="Använd min plats">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  <circle cx="12" cy="12" r="7" stroke-dasharray="none" opacity=".25"/>
                </svg>
              </button>
              <button class="mw-search-btn${state.searching?' is-loading':''}" data-search-btn ${state.searching?'disabled':''}>
                ${state.searching?'Söker…':'Sök'}
              </button>
            </div>
          </div>
        </section>
        <div class="mw-main">
          <div class="mw-left">${buildListHtml(ranked, showingAll)}</div>
          <div class="mw-right">
            <div class="mw-map-toolbar">
              <div class="mw-map-hint">Sök först efter ort. Om du inte hittar rätt kan du flytta kartan.</div>
              <button class="mw-map-reset-btn" type="button" data-reset-map-btn>${state.searchPoint ? 'Återgå till sökning' : 'Visa alla orter'}</button>
            </div>
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
    buildStopCache();
    render(root);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
