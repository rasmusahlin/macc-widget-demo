(() => {
  const state = {
    service: 'vaccin',
    query: '',
    sort: 'nearest',
    searchPoint: null,
    searchLabel: '',
    selectedLocationId: null
  };

  const DOMAINS = {
    geocode: 'https://photon.komoot.io/api/'
  };

  const fmtDate = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const fmtDayTime = (start, end) => `${fmtDate.format(start)} ${fmtTime.format(start)}–${fmtTime.format(end)}`;

  let locations = [];
  let stops = [];
  let map, clusterGroup;
  let markerById = new Map();

  const normalize = (str = '') => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const serviceLabel = (service) => ({ vaccin: 'Vaccinering', provtagning: 'Provtagning', bada: 'Båda' }[service] || service);
  const servicePill = (service) => ({ vaccin: 'Vaccinering', provtagning: 'Provtagning' }[service] || service);
  const sortLabel = (sort) => ({ nearest: 'Närmast', upcoming: 'Kommande' }[sort] || sort);
  const esc = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

  function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = d => d * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function nowRef() {
    return new Date('2026-03-06T12:00:00+01:00');
  }

  function getBookUrl(loc) {
    if (state.service === 'provtagning') return loc.bookProvtagningUrl || loc.bookVaccinUrl || loc.readMoreUrl;
    if (state.service === 'bada') return loc.bookVaccinUrl || loc.bookProvtagningUrl || loc.readMoreUrl;
    return loc.bookVaccinUrl || loc.bookProvtagningUrl || loc.readMoreUrl;
  }

  function serviceMatches(entityServices = []) {
    if (state.service === 'bada') return entityServices.includes('vaccin') || entityServices.includes('provtagning') || entityServices.includes('bada');
    if (entityServices.includes('bada')) return true; // 'bada' means both vaccin and provtagning
    return entityServices.includes(state.service);
  }

  function getRelevantStops(locId) {
    const now = nowRef();
    return stops
      .filter(s => s.locationId === locId && s.status === 'scheduled' && serviceMatches(s.services || []))
      .map(s => ({ ...s, _start: new Date(s.start), _end: new Date(s.end) }))
      .filter(s => s._end >= now)
      .sort((a, b) => a._start - b._start);
  }

  function getNextStop(locId) {
    return getRelevantStops(locId)[0] || null;
  }

  function textMatch(loc, qNorm) {
    if (!qNorm) return true;
    const postalNorm = normalize((loc.postalCode || '').replace(/\s/g, ''));
    const hay = [loc.name, loc.city, loc.postalCode, loc.address, postalNorm, ...(loc.searchTerms || [])].map(normalize);
    return hay.some(v => v.includes(qNorm));
  }

  async function geocode(query) {
    const url = `${DOMAINS.geocode}?q=${encodeURIComponent(query)}&limit=1&lang=sv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    const feature = data.features && data.features[0];
    if (!feature) return null;
    const [lon, lat] = feature.geometry.coordinates;
    return { lat, lon, label: feature.properties.name || query };
  }

  function buildSearchPoint(query) {
    const qNorm = normalize(query);
    if (!qNorm) return null;
    const exact = locations.find(loc => textMatch(loc, qNorm));
    if (exact) return { lat: exact.lat, lon: exact.lon, label: exact.name, source: 'local' };
    return null;
  }

  function rankLocations() {
    const now = nowRef();
    const qNorm = normalize(state.query);
    let pool = locations.filter(loc => loc.active && serviceMatches(loc.services || []));

    // Important: if we have a searchPoint, search should be distance-driven, not text-restrictive.
    // Text matching should only be used when we do not have a resolved point.
    if (!state.searchPoint && qNorm) {
      const textFiltered = pool.filter(loc => textMatch(loc, qNorm));
      if (textFiltered.length) pool = textFiltered;
    }

    if (state.searchPoint) {
      pool = pool.map(loc => ({
        ...loc,
        _distanceKm: haversineKm(state.searchPoint.lat, state.searchPoint.lon, loc.lat, loc.lon)
      }));

      let radius = 50;
      let local = pool.filter(loc => loc._distanceKm <= radius);
      if (local.length < 3) {
        radius = 100;
        local = pool.filter(loc => loc._distanceKm <= radius);
      }
      if (local.length) {
        pool = local;
      } else {
        // hard fallback: if still empty, take nearest 8
        pool = [...pool].sort((a,b) => a._distanceKm - b._distanceKm).slice(0, 8);
      }
    } else {
      pool = pool.map(loc => ({ ...loc, _distanceKm: null }));
    }

    const enriched = pool.map(loc => {
      const next = getNextStop(loc.id);
      const hoursToNext = next ? Math.max(0, (next._start - now) / 36e5) : 9999;
      const distanceScore = loc._distanceKm == null ? 999 : loc._distanceKm;
      const score = state.sort === 'upcoming'
        ? (hoursToNext * 0.65) + (distanceScore * 0.35)
        : (distanceScore * 0.6) + (hoursToNext * 0.4);
      return { ...loc, _next: next, _score: score };
    });

    return enriched.sort((a, b) => a._score - b._score || (a._distanceKm ?? 9999) - (b._distanceKm ?? 9999));
  }

  function getNearbyStops(rankedLocations) {
    const ids = new Set(rankedLocations.slice(0, 8).map(l => l.id));
    return stops
      .filter(s => s.status === 'scheduled' && ids.has(s.locationId) && serviceMatches(s.services || []))
      .map(s => ({ ...s, _start: new Date(s.start), _end: new Date(s.end), _loc: rankedLocations.find(l => l.id === s.locationId) }))
      .filter(s => s._end >= nowRef())
      .sort((a, b) => a._start - b._start)
      .slice(0, 6);
  }

  function locationCard(loc) {
    const nextHtml = loc._next
      ? `<div class="macc-widget__next"><span class="macc-widget__next-label">Nästa öppettid</span><div class="macc-widget__next-time">${fmtDayTime(loc._next._start, loc._next._end)}</div></div>`
      : `<div class="macc-widget__next"><span class="macc-widget__next-label">Nästa öppettid</span><div class="macc-widget__next-time">Ingen planerad tid just nu</div></div>`;

    const distanceHtml = state.searchPoint && loc._distanceKm != null
      ? `<div class="macc-widget__distance">${loc._distanceKm.toFixed(1)} km från ${esc(state.searchLabel)}</div>`
      : `<div class="macc-widget__distance">${esc(loc.city)}</div>`;

    return `
      <article class="macc-widget__card" data-location-id="${esc(loc.id)}">
        <div class="macc-widget__card-top">
          <div>
            <h3 class="macc-widget__card-title">${esc(loc.name)}</h3>
          </div>
          ${distanceHtml}
        </div>
        <div class="macc-widget__badges">${loc.services.map(s => `<span class="macc-widget__badge">${servicePill(s)}</span>`).join('')}</div>
        ${nextHtml}
        <div class="macc-widget__subtle">Drop-in i mån av tid erbjuds under öppettiderna. Tidsbokning rekommenderas.</div>
        <div class="macc-widget__actions">
          <a class="macc-widget__btn macc-widget__btn--primary" href="${esc(getBookUrl(loc))}" target="_blank" rel="noopener">${state.service === 'provtagning' ? 'Boka provtagning' : state.service === 'vaccin' ? 'Boka vaccinering' : 'Boka tid'}</a>
          <a class="macc-widget__btn macc-widget__btn--secondary" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>
        </div>
      </article>`;
  }

  function stopCard(stop) {
    return `<article class="macc-widget__stop-card">
      <div class="macc-widget__stop-date">${fmtDayTime(stop._start, stop._end)}</div>
      <div><strong>${esc(stop._loc.name)}</strong></div>
      <div class="macc-widget__subtle">${esc(stop.displayNote || 'Drop-in i mån av tid erbjuds under öppettiderna.')}</div>
      <div class="macc-widget__actions">
        <a class="macc-widget__btn macc-widget__btn--primary" href="${esc(getBookUrl(stop._loc))}" target="_blank" rel="noopener">${state.service === 'provtagning' ? 'Boka provtagning' : state.service === 'vaccin' ? 'Boka vaccinering' : 'Boka tid'}</a>
        <a class="macc-widget__btn macc-widget__btn--secondary" href="${esc(stop._loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>
      </div>
    </article>`;
  }

  function popupHtml(loc) {
    const next = loc._next;
    const nextStr = next ? fmtDayTime(next._start, next._end) : 'Ingen planerad tid just nu';
    return `<div class="macc-widget__popup-title">${esc(loc.name)}</div>
      <div class="macc-widget__popup-meta">${esc(loc.city)}${loc._distanceKm != null ? ` • ${loc._distanceKm.toFixed(1)} km` : ''}</div>
      <div class="macc-widget__subtle" style="margin-bottom:10px"><strong>Nästa öppettid:</strong> ${esc(nextStr)}</div>
      <div class="macc-widget__popup-actions">
        <a href="${esc(getBookUrl(loc))}" target="_blank" rel="noopener">Boka</a>
        <a href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a>
      </div>`;
  }

  function createMarkerIcon(active) {
    const bg = active ? '#d7263d' : '#0d6973';
    return L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:999px;background:${bg};border:3px solid #fff;box-shadow:0 8px 18px rgba(0,0,0,.18)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  function renderMap(rankedLocations) {
    // Root is re-rendered on every state change, so the map container is recreated.
    // Recreate Leaflet map safely whenever the old container is gone.
    const mapEl = document.getElementById('macc-widget-map');
    const needsFreshMap = !map || !mapEl || map.getContainer() !== mapEl;

    if (needsFreshMap) {
      if (map) {
        try { map.remove(); } catch {}
      }
      map = L.map('macc-widget-map', { scrollWheelZoom: false }).setView([56.5, 13.5], 6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      clusterGroup = L.markerClusterGroup({ showCoverageOnHover: false, spiderfyOnMaxZoom: true });
      map.addLayer(clusterGroup);
    }

    clusterGroup.clearLayers();
    markerById = new Map();

    rankedLocations.forEach(loc => {
      const marker = L.marker([loc.lat, loc.lon], { icon: createMarkerIcon(!!loc._next) });
      marker.bindPopup(popupHtml(loc));
      marker.on('click', () => { state.selectedLocationId = loc.id; });
      clusterGroup.addLayer(marker);
      markerById.set(loc.id, marker);
    });

    if (rankedLocations.length) {
      const bounds = L.latLngBounds(rankedLocations.map(loc => [loc.lat, loc.lon]));
      map.fitBounds(bounds.pad(0.1), { maxZoom: rankedLocations.length === 1 ? 14 : 13 });
    }
  }

  function bindEvents(root) {
    root.querySelectorAll('[data-service]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.service = btn.dataset.service;
        render(root);
      });
    });
    root.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.sort = btn.dataset.sort;
        render(root);
      });
    });
    root.querySelector('[data-search-btn]').addEventListener('click', async () => runSearch(root));
    root.querySelector('[data-search-input]').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await runSearch(root);
      }
    });
    root.querySelector('[data-geo-btn]').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(pos => {
        state.searchPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        state.searchLabel = 'din plats';
        state.query = '';
        root.querySelector('[data-search-input]').value = '';
        render(root);
      });
    });
    root.querySelectorAll('[data-location-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        const id = card.dataset.locationId;
        const marker = markerById.get(id);
        if (marker) {
          map.setView(marker.getLatLng(), 11);
          marker.openPopup();
        }
      });
    });
  }

  async function runSearch(root) {
    const input = root.querySelector('[data-search-input]');
    const query = input.value.trim();
    state.query = query;
    if (!query) {
      state.searchPoint = null;
      state.searchLabel = '';
      render(root);
      return;
    }

    const localPoint = buildSearchPoint(query);
    if (localPoint) {
      state.searchPoint = localPoint;
      state.searchLabel = localPoint.label;
      render(root);
      return;
    }

    try {
      const geocoded = await geocode(query);
      if (geocoded) {
        state.searchPoint = geocoded;
        state.searchLabel = geocoded.label || query;
      } else {
        state.searchPoint = null;
        state.searchLabel = query;
      }
    } catch {
      state.searchPoint = null;
      state.searchLabel = query;
    }
    render(root);
  }

  function render(root) {
    const ranked = rankLocations();
    const nearbyStops = getNearbyStops(ranked);

    root.innerHTML = `
      <div class="macc-widget">
        <section class="macc-widget__panel macc-widget__controls">
          <div class="macc-widget__service-row">
            ${['vaccin','provtagning','bada'].map(service => `<button class="macc-widget__service-btn ${state.service === service ? 'is-active' : ''}" data-service="${service}">${serviceLabel(service)}</button>`).join('')}
          </div>
          <div class="macc-widget__search-grid">
            <div class="macc-widget__search-wrap">
              <span class="macc-widget__search-icon">⌕</span>
              <input class="macc-widget__search-input" data-search-input placeholder="Sök ort, postnummer eller mottagning" value="${esc(state.query)}" />
            </div>
            <button class="macc-widget__search-btn" data-search-btn>Sök</button>
            <button class="macc-widget__geo-btn" data-geo-btn>Min plats</button>
          </div>
          <div class="macc-widget__meta-row">
            <div class="macc-widget__context">${state.searchLabel ? `Visar träffar nära <strong>${esc(state.searchLabel)}</strong>` : 'Visar relevanta platser för vald tjänst.'}</div>
            <div class="macc-widget__sort-row">
              ${['nearest','upcoming'].map(sort => `<button class="macc-widget__sort-btn ${state.sort === sort ? 'is-active' : ''}" data-sort="${sort}">${sortLabel(sort)}</button>`).join('')}
            </div>
          </div>
        </section>

        <div class="macc-widget__main">
          <div class="macc-widget__left">
            <section class="macc-widget__section">
              <h2>Platser nära dig</h2>
              <p class="macc-widget__section-sub">Sökresultatet sorteras efter avstånd och nästa relevanta öppettid.</p>
              <div class="macc-widget__card-list">
                ${ranked.length ? ranked.map(locationCard).join('') : `<div class="macc-widget__empty">Inga träffar för vald kombination just nu.</div>`}
              </div>
            </section>
            <section class="macc-widget__section" style="margin-top:18px">
              <h2>Kommande stopp nära dig</h2>
              <p class="macc-widget__section-sub">Endast de mest relevanta tillfällena nära din sökning visas här.</p>
              <div class="macc-widget__stop-list">
                ${nearbyStops.length ? nearbyStops.map(stopCard).join('') : `<div class="macc-widget__empty">Inga kommande stopp nära din sökning just nu.</div>`}
              </div>
            </section>
          </div>
          <div class="macc-widget__right">
            <section class="macc-widget__section macc-widget__map-shell">
              <h2>Karta</h2>
              <p class="macc-widget__section-sub">Kartan visar samma filtrerade platser som listan.</p>
              <div id="macc-widget-map" class="macc-widget__map"></div>
            </section>
          </div>
        </div>
      </div>`;

    renderMap(ranked);
    bindEvents(root);
  }

  async function init() {
    const root = document.getElementById('macc-booking-widget');
    if (!root) return;
    const [locRes, stopRes] = await Promise.all([
      fetch('./assets/macc-locations.json', { cache: 'no-store' }),
      fetch('./assets/macc-stops.json', { cache: 'no-store' })
    ]);
    const locJson = await locRes.json();
    const stopJson = await stopRes.json();
    locations = locJson.locations || [];
    stops = stopJson.stops || [];
    render(root);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
