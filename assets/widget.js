
(() => {
  const DATA_CACHE_KEY = 'maccWidgetDataCacheV1';
  const GEO_CACHE_KEY = 'maccWidgetGeoCacheV1';
  const DATA_CACHE_TTL_MS = 15 * 60 * 1000;
  const GEO_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

  const state = {
    service: 'alla',
    query: '',
    searchPoint: null,
    searchLabel: '',
    mapCenter: null,
    searching: false,
    loading: true,
    expandedId: null,
    pendingScrollId: null,
  };

  const fmtDate = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });

  let locations = [];
  let stops = [];
  let map;
  let clusterGroup;
  let markerById = new Map();
  let mapMoveTimer = null;
  let mapReady = false;
  let dataReady = false;
  let didInitialFit = false;
  let stopCacheByFilter = new Map();

  const normalize = (str = '') => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const esc = (s = '') => String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const servicePill = (s) => ({ vaccin: 'Vaccinering', provtagning: 'Provtagning' }[s] || s);
  const filterLabel = (s) => ({ alla: 'Alla tjänster', vaccin: 'Vaccinering', provtagning: 'Provtagning' }[s] || s);

  function now() { return new Date(); }

  function fmtDateLine(start) {
    return fmtDate.format(start).replace('.', '');
  }

  function fmtTimeLine(start, end) {
    return `kl ${fmtTime.format(start)}–${fmtTime.format(end)}`;
  }

  function fmtDayTime(start, end) {
    return `${fmtDateLine(start)} ${fmtTimeLine(start, end)}`;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const r = d => d * Math.PI / 180;
    const dLat = r(lat2 - lat1);
    const dLon = r(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function locationType(loc) {
    const raw = normalize(loc.locationType || loc.kind || loc.type || '');
    if (['mottagning', 'clinic', 'fast', 'fast mottagning'].includes(raw)) return 'mottagning';
    if (['buss', 'mobil', 'mobil mottagning', 'mobile', 'bus'].includes(raw)) return 'buss';
    return '';
  }

  function locationTypeBadge(loc) {
    const type = locationType(loc);
    if (type === 'mottagning') return `<span class="mw-type-badge mw-type-badge--clinic">🏥 Mottagning</span>`;
    if (type === 'buss') return `<span class="mw-type-badge mw-type-badge--mobile">🚐 Mobil</span>`;
    return '';
  }

  function locationMatchesFilter(loc) {
    if (state.service === 'alla') return true;
    return (loc.services || []).includes(state.service);
  }

  function stopMatchesFilter(services = []) {
    if (state.service === 'alla') return services.some(s => ['vaccin', 'provtagning', 'bada'].includes(s));
    if (services.includes('bada')) return true;
    return services.includes(state.service);
  }

  function buildStopCache() {
    stopCacheByFilter.clear();
    const n = now();

    for (const serviceKey of ['alla', 'vaccin', 'provtagning']) {
      const perLocation = new Map();

      for (const s of stops) {
        if (s.status !== 'scheduled') continue;
        const services = s.services || [];
        const matches = serviceKey === 'alla'
          ? services.some(v => ['vaccin', 'provtagning', 'bada'].includes(v))
          : (services.includes('bada') || services.includes(serviceKey));

        if (!matches) continue;

        const start = new Date(s.start);
        const end = new Date(s.end);
        if (end < n) continue;

        const arr = perLocation.get(s.locationId) || [];
        arr.push({ ...s, _start: start, _end: end });
        perLocation.set(s.locationId, arr);
      }

      for (const arr of perLocation.values()) {
        arr.sort((a, b) => a._start - b._start);
      }

      stopCacheByFilter.set(serviceKey, perLocation);
    }
  }

  function getRelevantStops(locId) {
    return (stopCacheByFilter.get(state.service) || new Map()).get(locId) || [];
  }

  function textMatch(loc, qNorm) {
    if (!qNorm) return true;
    const postalNorm = normalize((loc.postalCode || '').replace(/\s/g, ''));
    const hay = [
      loc.name, loc.city, loc.postalCode, loc.address, postalNorm,
      ...(loc.searchTerms || [])
    ].map(normalize);
    return hay.some(v => v.includes(qNorm));
  }

  function getLocalStorageJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setLocalStorageJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function getCachedGeocode(query) {
    const cache = getLocalStorageJson(GEO_CACHE_KEY) || {};
    const hit = cache[normalize(query)];
    if (!hit) return null;
    if ((Date.now() - hit.ts) > GEO_CACHE_TTL_MS) return null;
    return hit.value;
  }

  function saveCachedGeocode(query, value) {
    const cache = getLocalStorageJson(GEO_CACHE_KEY) || {};
    cache[normalize(query)] = { ts: Date.now(), value };
    setLocalStorageJson(GEO_CACHE_KEY, cache);
  }

  async function fetchJsonWithCache(url, cacheKey) {
    const cache = getLocalStorageJson(cacheKey);
    if (cache && cache.ts && (Date.now() - cache.ts) < DATA_CACHE_TTL_MS && cache.payload) {
      return cache.payload;
    }
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Kunde inte läsa ${url}`);
    const payload = await response.json();
    setLocalStorageJson(cacheKey, { ts: Date.now(), payload });
    return payload;
  }

  async function geocodeWithNominatim(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'sv' } });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.[0]) return null;
    return {
      lat: +d[0].lat,
      lon: +d[0].lon,
      label: (d[0].display_name || query).split(',')[0]
    };
  }

  async function geocodePostal(postalCode) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&postalcode=${encodeURIComponent(postalCode)}`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'sv' } });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.[0]) return null;
    return {
      lat: +d[0].lat,
      lon: +d[0].lon,
      label: (d[0].display_name || postalCode).split(',')[0]
    };
  }

  async function geocodeWithPhoton(query) {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=sv`);
    if (!r.ok) return null;
    const d = await r.json();
    const f = d?.features?.[0];
    if (!f?.geometry?.coordinates) return null;
    const [lon, lat] = f.geometry.coordinates;
    return { lat, lon, label: f.properties?.name || query };
  }

  async function geocode(query) {
    const cached = getCachedGeocode(query);
    if (cached !== null) return cached;

    const postalMatch = query.replace(/\s/g, '').match(/^(\d{5})$/);
    let result = null;

    try {
      if (postalMatch) result = await geocodePostal(postalMatch[1]);
      if (!result) result = await geocodeWithNominatim(query);
      if (!result) result = await geocodeWithPhoton(query);
    } catch {
      result = null;
    }

    saveCachedGeocode(query, result);
    return result;
  }

  function getRankCenter() {
    return state.mapCenter || state.searchPoint;
  }

  function enrichLocation(loc, center) {
    const relevantStops = getRelevantStops(loc.id);
    const next = relevantStops[0] || null;
    const hoursToNext = next ? Math.max(0, (next._start - now()) / 36e5) : 9999;
    const distanceKm = center ? haversineKm(center.lat, center.lon, loc.lat, loc.lon) : null;
    const score = center ? distanceKm : hoursToNext;

    return {
      ...loc,
      _distanceKm: distanceKm,
      _next: next,
      _upcomingStops: relevantStops.slice(0, 5),
      _score: score,
      _hasFutureStops: relevantStops.length > 0
    };
  }

  function rankLocations(forceAll = false) {
    const qNorm = normalize(state.query);
    const center = getRankCenter();
    let pool = locations.filter(l => l.active && locationMatchesFilter(l));
    let usedTextFallback = false;
    let showingFallbackNearest = false;

    if (!center && qNorm) {
      const directTextMatches = pool.filter(l => textMatch(l, qNorm));
      if (directTextMatches.length) {
        pool = directTextMatches;
        usedTextFallback = true;
      }
    }

    if (center) {
      pool = pool.map(l => enrichLocation(l, center));
      let local = pool.filter(l => l._distanceKm <= 35);
      if (local.length < 3) local = pool.filter(l => l._distanceKm <= 60);
      if (local.length < 3) local = pool.filter(l => l._distanceKm <= 100);

      if (local.length && !forceAll) {
        pool = local;
      } else {
        showingFallbackNearest = true;
        pool = [...pool].sort((a, b) => a._distanceKm - b._distanceKm).slice(0, 12);
      }
    } else {
      pool = pool.map(l => enrichLocation(l, null));
    }

    pool.sort((a, b) => {
      if (a._score !== b._score) return a._score - b._score;
      return String(a.name).localeCompare(String(b.name), 'sv');
    });

    return {
      ranked: pool,
      usedTextFallback,
      showingFallbackNearest
    };
  }

  function fitMapToLocations(allActive) {
    if (!map || !allActive.length) return;
    const coords = allActive.map(l => [l.lat, l.lon]);
    const isMobile = window.innerWidth <= 760;

    map.fitBounds(L.latLngBounds(coords), {
      paddingTopLeft: isMobile ? [20, 20] : [36, 36],
      paddingBottomRight: isMobile ? [20, 20] : [36, 36],
      maxZoom: isMobile ? 6 : 7
    });
  }

  function buildActionButtons(loc) {
    const hasNext = loc._upcomingStops.length > 0;
    const hasVaccin = (loc.services || []).includes('vaccin') || (loc.services || []).includes('bada');
    const hasProv = (loc.services || []).includes('provtagning') || (loc.services || []).includes('bada');

    let primaryHtml = '';
    if (state.service === 'alla' && hasVaccin && hasProv) {
      const vUrl = loc.bookVaccinUrl || loc.readMoreUrl;
      const pUrl = loc.bookProvtagningUrl || loc.readMoreUrl;
      const sameUrl = vUrl === pUrl;
      if (hasNext && sameUrl) {
        primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(vUrl)}" target="_blank" rel="noopener">Boka tid</a>`;
      } else if (hasNext) {
        primaryHtml = `
          <a class="mw-btn mw-btn--primary" href="${esc(vUrl)}" target="_blank" rel="noopener">Boka vaccinering</a>
          <a class="mw-btn mw-btn--outline" href="${esc(pUrl)}" target="_blank" rel="noopener">Boka provtagning</a>
        `;
      } else {
        primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Se öppettider</a>`;
      }
    } else if (state.service === 'vaccin' || (state.service === 'alla' && hasVaccin)) {
      const url = hasNext ? (loc.bookVaccinUrl || loc.readMoreUrl) : loc.readMoreUrl;
      primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(url)}" target="_blank" rel="noopener">${hasNext ? 'Boka vaccinering' : 'Se öppettider'}</a>`;
    } else {
      const url = hasNext ? (loc.bookProvtagningUrl || loc.readMoreUrl) : loc.readMoreUrl;
      primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(url)}" target="_blank" rel="noopener">${hasNext ? 'Boka provtagning' : 'Se öppettider'}</a>`;
    }

    return `
      <div class="mw-actions">
        ${primaryHtml}
        <a class="mw-btn mw-btn--ghost" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>
        <button class="mw-btn mw-btn--ghost" type="button" data-show-on-map="${esc(loc.id)}">Visa på karta</button>
      </div>
    `;
  }

  function locationCard(loc) {
    const expanded = state.expandedId === loc.id;
    const distHtml = (state.searchPoint || state.mapCenter) && loc._distanceKm != null
      ? `<div class="mw-card-meta-distance">${loc._distanceKm.toFixed(1)} km bort</div>`
      : '';

    const addressHtml = loc.address
      ? `<div class="mw-card-address">${esc(loc.address)}</div>`
      : '';

    const svcBadges = (loc.services || [])
      .filter(s => s !== 'bada')
      .map(s => `<span class="mw-badge mw-badge--${s}">${servicePill(s)}</span>`)
      .join('');

    const typeBadge = locationTypeBadge(loc);

    const nextHtml = loc._next
      ? `
        <div class="mw-next">
          <div class="mw-next-label">Nästa öppettid</div>
          <div class="mw-next-main">${esc(fmtDateLine(loc._next._start))}</div>
          <div class="mw-next-sub">${esc(fmtTimeLine(loc._next._start, loc._next._end))}</div>
        </div>
      `
      : `
        <div class="mw-next mw-next--empty">
          <div class="mw-next-label">Nästa öppettid</div>
          <div class="mw-next-main">Ingen planerad tid just nu</div>
        </div>
      `;

    const countText = loc._upcomingStops.length
      ? `${loc._upcomingStops.length} kommande tider`
      : 'Inga kommande tider';

    const detailRows = loc._upcomingStops.length
      ? loc._upcomingStops.map(s => `
          <li class="mw-upcoming-item">
            <span class="mw-upcoming-date">${esc(fmtDateLine(s._start))}</span>
            <span class="mw-upcoming-time">${esc(fmtTimeLine(s._start, s._end))}</span>
          </li>
        `).join('')
      : `<li class="mw-upcoming-item mw-upcoming-item--empty">Ingen planerad tid just nu.</li>`;

    return `
      <article class="mw-card${expanded ? ' is-expanded' : ''}" data-location-id="${esc(loc.id)}">
        <button class="mw-card-toggle" type="button" data-toggle-card="${esc(loc.id)}" aria-expanded="${expanded ? 'true' : 'false'}">
          <div class="mw-card-top">
            <div class="mw-card-title-wrap">
              <h3 class="mw-card-title">${esc(loc.name)}</h3>
              ${addressHtml}
              <div class="mw-card-meta">
                ${typeBadge}
                ${distHtml}
                <div class="mw-badges">${svcBadges}</div>
              </div>
            </div>
            <div class="mw-card-right">
              ${nextHtml}
              <div class="mw-accordion-cta">${expanded ? 'Dölj tider' : 'Visa fler tider'}<span class="mw-accordion-count">${esc(countText)}</span></div>
            </div>
          </div>
        </button>

        <div class="mw-card-details"${expanded ? '' : ' hidden'}>
          <div class="mw-card-details-inner">
            <div class="mw-upcoming-block">
              <div class="mw-upcoming-title">Kommande tider</div>
              <ul class="mw-upcoming-list">${detailRows}</ul>
            </div>
            ${buildActionButtons(loc)}
          </div>
        </div>
      </article>
    `;
  }

  function popupHtml(loc) {
    const next = loc._next || getRelevantStops(loc.id)[0];
    const nextStr = next ? fmtDayTime(next._start, next._end) : 'Ingen planerad tid';
    const bookUrl = loc.bookVaccinUrl || loc.bookProvtagningUrl || loc.readMoreUrl;

    return `
      <div class="mw-popup-title">${esc(loc.name)}</div>
      <div class="mw-popup-addr">${esc(loc.address || loc.city || '')}</div>
      <div class="mw-popup-next">${esc(nextStr)}</div>
      <div class="mw-popup-actions">
        <a href="${esc(next ? bookUrl : loc.readMoreUrl)}" target="_blank" rel="noopener">${next ? 'Boka tid' : 'Se öppettider'}</a>
        <button type="button" class="mw-popup-list-link" data-popup-open-card="${esc(loc.id)}">Visa tider i listan</button>
      </div>
    `;
  }

  function markerIcon(loc) {
    const hasNext = !!loc._next;
    const type = locationType(loc);
    const color = hasNext ? '#d7263d' : '#0d6973';
    const symbol = type === 'mottagning' ? '🏥' : (type === 'buss' ? '🚐' : '');

    const pulse = hasNext ? `<div class="mw-marker-pulse" style="background:${color}"></div>` : '';
    const html = `
      <div class="mw-marker-wrap">
        ${pulse}
        <div class="mw-marker-pin" style="background:${color}">
          <span class="mw-marker-symbol">${symbol || '•'}</span>
        </div>
      </div>
    `;

    return L.divIcon({
      className: '',
      html,
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      popupAnchor: [0, -34]
    });
  }

  function scrollCardIntoView(root, locationId) {
    if (!locationId) return;
    const el = root.querySelector(`[data-location-id="${CSS.escape(locationId)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function openCard(root, locationId, scroll = false) {
    state.expandedId = state.expandedId === locationId ? null : locationId;
    refreshList(root);
    if (scroll && state.expandedId) {
      setTimeout(() => scrollCardIntoView(root, locationId), 60);
    }
  }

  function renderMap() {
    const mapEl = document.getElementById('macc-widget-map');
    const fresh = !map || !mapEl || map.getContainer() !== mapEl;

    if (fresh) {
      if (map) {
        try { map.remove(); } catch {}
      }

      map = L.map('macc-widget-map', { scrollWheelZoom: false }).setView([56.5, 13.5], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 45,
        chunkedLoading: true
      });
      map.addLayer(clusterGroup);

      map.on('moveend', () => {
        if (!mapReady) return;
        clearTimeout(mapMoveTimer);
        mapMoveTimer = setTimeout(() => {
          const c = map.getCenter();
          state.mapCenter = { lat: c.lat, lon: c.lng };
          const root = document.getElementById('macc-booking-widget');
          if (root) refreshList(root);
        }, 300);
      });

      map.on('popupopen', () => {
        const root = document.getElementById('macc-booking-widget');
        const btn = document.querySelector('.mw-popup-list-link');
        if (!root || !btn) return;
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-popup-open-card');
          state.expandedId = id;
          refreshList(root);
          scrollCardIntoView(root, id);
        }, { once: true });
      });

      window.addEventListener('resize', () => {
        if (!map) return;
        requestAnimationFrame(() => {
          map.invalidateSize();
          if (!state.searchPoint && !state.mapCenter) {
            fitMapToLocations(locations.filter(l => l.active));
          }
        });
      });

      setTimeout(() => { mapReady = true; }, 850);
    }

    clusterGroup.clearLayers();
    markerById = new Map();

    const allActive = locations.filter(l => l.active && locationMatchesFilter(l)).map(l => enrichLocation(l, null));

    allActive.forEach(loc => {
      const marker = L.marker([loc.lat, loc.lon], { icon: markerIcon(loc) });
      marker.bindPopup(popupHtml(loc));
      marker.on('click', () => {
        const root = document.getElementById('macc-booking-widget');
        if (!root) return;
        state.expandedId = loc.id;
        refreshList(root);
        setTimeout(() => scrollCardIntoView(root, loc.id), 60);
      });
      clusterGroup.addLayer(marker);
      markerById.set(loc.id, marker);
    });

    if (!didInitialFit && !state.searchPoint && !state.mapCenter) {
      requestAnimationFrame(() => {
        map.invalidateSize();
        fitMapToLocations(allActive);
        setTimeout(() => {
          map.invalidateSize();
          fitMapToLocations(allActive);
        }, 150);
        didInitialFit = true;
      });
    }
  }

  function updateMapViewportForSearch() {
    if (!map) return;

    if (state.searchPoint) {
      map.invalidateSize();
      map.setView([state.searchPoint.lat, state.searchPoint.lon], 10);
      return;
    }

    if (!state.mapCenter) {
      map.invalidateSize();
      fitMapToLocations(locations.filter(l => l.active && locationMatchesFilter(l)));
    }
  }

  function buildContextLine() {
    if (state.mapCenter && state.searchPoint) {
      return `
        Visar orter nära kartans mittpunkt.
        <button class="mw-link-btn" data-reset-map>Återgå till sökning</button>
        <button class="mw-link-btn" data-show-all-map>Visa alla orter</button>
      `;
    }
    if (state.mapCenter) {
      return `
        Visar orter nära kartans mittpunkt.
        <button class="mw-link-btn" data-show-all-map>Visa alla orter</button>
      `;
    }
    if (state.searchLabel) {
      return `
        Visar träffar nära <strong>${esc(state.searchLabel)}</strong>.
        <button class="mw-link-btn" data-show-all-map>Visa alla orter</button>
      `;
    }
    return 'Visar alla platser.';
  }

  function buildListHtml(ranked, flags) {
    let cardsHtml = '';
    if (!ranked.length) {
      cardsHtml = `
        <div class="mw-empty">
          Vi hittade ingen direkt träff. Prova en närliggande ort eller flytta kartan.
          <div class="mw-empty-actions">
            <button class="mw-link-btn" data-show-all-map>Visa alla orter</button>
          </div>
        </div>
      `;
    } else if (flags.showingFallbackNearest) {
      cardsHtml = `
        <div class="mw-fallback-note">Ingen plats inom vald radie hittades — visar närmaste alternativ.</div>
        ${ranked.map(locationCard).join('')}
      `;
    } else if (flags.usedTextFallback && !state.searchPoint) {
      cardsHtml = `
        <div class="mw-fallback-note">Visar matchande orter baserat på namn eller adress.</div>
        ${ranked.map(locationCard).join('')}
      `;
    } else {
      cardsHtml = ranked.map(locationCard).join('');
    }

    return `
      <div class="mw-context">${buildContextLine()}</div>
      <div class="mw-card-list">${cardsHtml}</div>
    `;
  }

  function bindListEvents(root) {
    root.querySelectorAll('[data-toggle-card]').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.currentTarget.getAttribute('data-toggle-card');
        openCard(root, id);
      });
    });

    root.querySelectorAll('[data-show-on-map]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-show-on-map');
        const marker = markerById.get(id);
        if (marker) {
          const latLng = marker.getLatLng();
          map.setView(latLng, 12);
          marker.openPopup();
        }
      });
    });

    root.querySelector('[data-reset-map]')?.addEventListener('click', () => {
      state.mapCenter = null;
      refreshList(root);
      updateMapViewportForSearch();
    });

    root.querySelector('[data-show-all-map]')?.addEventListener('click', () => {
      state.mapCenter = null;
      state.searchPoint = null;
      state.searchLabel = '';
      state.query = '';
      state.expandedId = null;
      const input = root.querySelector('[data-search-input]');
      if (input) input.value = '';
      render(root);
    });
  }

  function refreshList(root) {
    const result = rankLocations();
    const leftEl = root.querySelector('.mw-left');
    if (!leftEl) return;
    leftEl.innerHTML = buildListHtml(result.ranked, result);
    bindListEvents(root);

    if (state.pendingScrollId) {
      const id = state.pendingScrollId;
      state.pendingScrollId = null;
      setTimeout(() => scrollCardIntoView(root, id), 60);
    }
  }

  function skeletonCardsHtml() {
    return `
      <div class="mw-skeleton-list">
        ${Array.from({ length: 4 }).map(() => `
          <div class="mw-skeleton-card">
            <div class="mw-skel mw-skel--title"></div>
            <div class="mw-skel mw-skel--line"></div>
            <div class="mw-skel mw-skel--line mw-skel--short"></div>
            <div class="mw-skel mw-skel--block"></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function render(root) {
    const result = dataReady ? rankLocations() : { ranked: [], usedTextFallback: false, showingFallbackNearest: false };
    const listHtml = dataReady ? buildListHtml(result.ranked, result) : skeletonCardsHtml();

    root.innerHTML = `
      <div class="macc-widget">
        <section class="mw-controls">
          <div class="mw-controls-row">
            <div class="mw-filter-group">
              ${['alla', 'vaccin', 'provtagning'].map(s => `
                <button class="mw-filter-btn${state.service === s ? ' is-active' : ''}" data-service="${s}">${filterLabel(s)}</button>
              `).join('')}
            </div>
            <div class="mw-search-group">
              <div class="mw-search-wrap">
                <span class="mw-search-icon">⌕</span>
                <input class="mw-search-input" data-search-input placeholder="Sök ort, adress eller postnummer" value="${esc(state.query)}" />
              </div>
              <button class="mw-geo-btn" data-geo-btn title="Använd min plats" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>
                  <circle cx="12" cy="12" r="7" stroke-dasharray="none" opacity=".25"></circle>
                </svg>
              </button>
              <button class="mw-search-btn${state.searching ? ' is-loading' : ''}" data-search-btn type="button" ${state.searching ? 'disabled' : ''}>
                ${state.searching ? 'Söker…' : 'Sök'}
              </button>
            </div>
          </div>
        </section>

        <div class="mw-main">
          <div class="mw-left">${listHtml}</div>
          <div class="mw-right">
            <div class="mw-map-hint">
              Sökning styr listan. Om du inte hittar rätt kan du flytta kartan för att visa andra orter i området.
            </div>
            <div id="macc-widget-map" class="mw-map${dataReady ? '' : ' is-loading'}"></div>
          </div>
        </div>
      </div>
    `;

    if (dataReady) {
      renderMap();
      bindListEvents(root);
      updateMapViewportForSearch();
    }

    root.querySelectorAll('[data-service]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.service = btn.dataset.service;
        state.mapCenter = null;
        state.expandedId = null;
        render(root);
      });
    });

    root.querySelector('[data-search-btn]')?.addEventListener('click', () => runSearch(root));
    root.querySelector('[data-search-input]')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch(root);
      }
    });

    root.querySelector('[data-geo-btn]')?.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(pos => {
        state.searchPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        state.searchLabel = 'din plats';
        state.mapCenter = null;
        state.query = '';
        state.expandedId = null;
        render(root);
      });
    });
  }

  async function runSearch(root) {
    const input = root.querySelector('[data-search-input]');
    const query = (input?.value || '').trim();

    state.query = query;
    state.mapCenter = null;
    state.expandedId = null;

    if (!query) {
      state.searchPoint = null;
      state.searchLabel = '';
      render(root);
      return;
    }

    const qNorm = normalize(query);
    const exactLocal = locations.find(l => textMatch(l, qNorm));
    if (exactLocal) {
      state.searchPoint = { lat: exactLocal.lat, lon: exactLocal.lon };
      state.searchLabel = exactLocal.name;
      render(root);
      return;
    }

    state.searching = true;
    render(root);

    let geo = null;
    try {
      geo = await geocode(query);
    } catch {
      geo = null;
    }

    state.searching = false;
    state.searchPoint = geo || null;
    state.searchLabel = geo ? (geo.label || query) : query;

    render(root);
  }

  async function init() {
    const root = document.getElementById('macc-booking-widget');
    if (!root) return;

    render(root);

    try {
      const [locationPayload, stopPayload] = await Promise.all([
        fetchJsonWithCache('./assets/macc-locations.json', `${DATA_CACHE_KEY}:locations`),
        fetchJsonWithCache('./assets/macc-stops.json', `${DATA_CACHE_KEY}:stops`)
      ]);

      locations = locationPayload.locations || [];
      stops = stopPayload.stops || [];
      buildStopCache();
      dataReady = true;
      state.loading = false;
      render(root);
    } catch (err) {
      dataReady = false;
      state.loading = false;
      root.innerHTML = `
        <div class="macc-widget">
          <div class="mw-empty">
            Widgeten kunde inte laddas just nu. Försök igen om en stund.
          </div>
        </div>
      `;
      console.error(err);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
