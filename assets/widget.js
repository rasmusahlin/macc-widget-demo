(() => {
  const CONFIG = {
    locationsUrl: './assets/macc-locations.json?v=demo1',
    stopsUrl: './assets/macc-stops.json?v=demo1',
    geocodeUrl: 'https://photon.komoot.io/api/',
    defaultCenter: [57.8, 13.2],
    defaultZoom: 6,
    radiusKm: 50,
    fallbackRadiusKm: 100,
    maxListResults: 8,
    maxStopResults: 6,
  };

  const state = {
    service: 'vaccin',
    sort: 'nearest',
    query: '',
    anchor: null,
    locations: [],
    stops: [],
    filtered: [],
    relevantStops: [],
    map: null,
    markersLayer: null,
    popupById: new Map(),
  };

  const el = {};

  const normalize = (str) => String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const escapeHtml = (s) => String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const serviceLabel = (key) => ({ vaccin: 'Vaccinering', provtagning: 'Provtagning', bada: 'Båda' }[key] || key);
  const fmtDistance = (km, anchorName='vald plats') => `${km.toFixed(1)} km från ${anchorName}`;
  const parseDate = (s) => new Date(s);
  const now = () => new Date('2026-03-06T09:00:00+01:00');
  const fmtShortDate = (d) => new Intl.DateTimeFormat('sv-SE', { weekday:'short', day:'numeric', month:'short' }).format(d);
  const fmtTime = (d) => new Intl.DateTimeFormat('sv-SE', { hour:'2-digit', minute:'2-digit' }).format(d);
  const fmtWindow = (start, end) => `${fmtShortDate(start)} ${fmtTime(start)}–${fmtTime(end)}`;

  function locationSupportsService(loc, service) {
    if (service === 'bada') return loc.services.includes('vaccin') || loc.services.includes('provtagning');
    return loc.services.includes(service);
  }
  function stopSupportsService(stop, service) {
    if (service === 'bada') return stop.services.includes('vaccin') || stop.services.includes('provtagning');
    return stop.services.includes(service);
  }

  function nextStopForLocation(locationId) {
    return state.stops
      .filter(s => s.locationId === locationId && s.status === 'scheduled' && stopSupportsService(s, state.service) && parseDate(s.end) >= now())
      .sort((a, b) => parseDate(a.start) - parseDate(b.start))[0] || null;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fetch failed: ${url}`);
    return res.json();
  }

  async function geocode(query) {
    const q = query.trim();
    if (!q) return null;
    const params = new URLSearchParams({ q: `${q}, Sweden`, limit: '1', lang: 'sv' });
    const res = await fetch(`${CONFIG.geocodeUrl}?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.features?.[0];
    if (!hit) return null;
    return {
      lat: hit.geometry.coordinates[1],
      lon: hit.geometry.coordinates[0],
      label: hit.properties?.name || q,
    };
  }

  function localAnchorFromQuery(query) {
    const q = normalize(query);
    if (!q) return null;
    const candidates = state.locations.filter(loc => {
      const fields = [loc.name, loc.city, loc.postalCode, loc.address, ...(loc.searchTerms || [])].map(normalize);
      return fields.some(v => v.includes(q));
    });
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const aExact = normalize(a.city) === q || normalize(a.name) === q || normalize(a.postalCode) === q;
      const bExact = normalize(b.city) === q || normalize(b.name) === q || normalize(b.postalCode) === q;
      return Number(bExact) - Number(aExact);
    });
    const best = candidates[0];
    return { lat: best.lat, lon: best.lon, label: best.city || best.name };
  }

  function searchScore(loc, anchor) {
    const dist = anchor ? haversineKm(anchor.lat, anchor.lon, loc.lat, loc.lon) : 999;
    const next = nextStopForLocation(loc.id);
    const hours = next ? Math.max(0, (parseDate(next.start) - now()) / 36e5) : 999;
    return dist * 0.65 + hours * 0.35;
  }

  async function runSearch() {
    state.query = el.input.value.trim();
    const localAnchor = localAnchorFromQuery(state.query);
    state.anchor = localAnchor || (state.query ? await geocode(state.query) : null);
    applyFilters();
  }

  function applyFilters() {
    let candidates = state.locations.filter(loc => loc.active && locationSupportsService(loc, state.service));

    if (state.anchor) {
      candidates = candidates.map(loc => ({
        ...loc,
        distanceKm: haversineKm(state.anchor.lat, state.anchor.lon, loc.lat, loc.lon),
      }));
      let within = candidates.filter(loc => loc.distanceKm <= CONFIG.radiusKm);
      if (within.length < 3) within = candidates.filter(loc => loc.distanceKm <= CONFIG.fallbackRadiusKm);
      if (!within.length) within = candidates.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, CONFIG.maxListResults);
      candidates = within;
    } else {
      candidates = candidates.map(loc => ({ ...loc, distanceKm: null }));
    }

    candidates.sort((a, b) => {
      if (state.sort === 'upcoming') {
        const aNext = nextStopForLocation(a.id);
        const bNext = nextStopForLocation(b.id);
        return (aNext ? parseDate(aNext.start) : Infinity) - (bNext ? parseDate(bNext.start) : Infinity);
      }
      return searchScore(a, state.anchor) - searchScore(b, state.anchor);
    });

    state.filtered = candidates.slice(0, CONFIG.maxListResults);

    const stopCandidates = state.stops
      .filter(s => s.status === 'scheduled' && stopSupportsService(s, state.service) && parseDate(s.end) >= now())
      .map(s => {
        const loc = state.locations.find(l => l.id === s.locationId);
        return { ...s, location: loc, distanceKm: state.anchor && loc ? haversineKm(state.anchor.lat, state.anchor.lon, loc.lat, loc.lon) : null };
      })
      .filter(s => s.location);

    let relevantStops = stopCandidates;
    if (state.anchor) {
      relevantStops = stopCandidates.filter(s => s.distanceKm <= CONFIG.radiusKm);
      if (relevantStops.length < 3) relevantStops = stopCandidates.filter(s => s.distanceKm <= CONFIG.fallbackRadiusKm);
    }
    relevantStops.sort((a, b) => {
      const da = a.distanceKm ?? 999;
      const db = b.distanceKm ?? 999;
      const ta = parseDate(a.start);
      const tb = parseDate(b.start);
      return da * 0.6 + (ta - now()) / 36e5 * 0.4 - (db * 0.6 + (tb - now()) / 36e5 * 0.4);
    });
    state.relevantStops = relevantStops.slice(0, CONFIG.maxStopResults);

    renderStatus();
    renderList();
    renderStops();
    renderMap();
  }

  function serviceChips(loc) {
    return loc.services.map(s => `<span class="macc-chip">${escapeHtml(serviceLabel(s))}</span>`).join('');
  }

  function bookUrlForLocation(loc) {
    if (state.service === 'provtagning') return loc.bookProvtagningUrl || loc.bookVaccinUrl;
    if (state.service === 'bada') return loc.bookVaccinUrl || loc.bookProvtagningUrl;
    return loc.bookVaccinUrl || loc.bookProvtagningUrl;
  }

  function renderStatus() {
    const count = state.filtered.length;
    const anchorLabel = state.anchor?.label || '';
    el.status.innerHTML = state.anchor
      ? `Visar träffar nära <strong>${escapeHtml(anchorLabel)}</strong>`
      : `Visar relevanta platser för vald tjänst`;
    el.countBadge.textContent = `${count} träff${count === 1 ? '' : 'ar'}`;
  }

  function renderList() {
    if (!state.filtered.length) {
      el.list.innerHTML = `<div class="macc-empty">Inga platser matchade din sökning. Prova en annan ort eller använd Min plats.</div>`;
      return;
    }
    el.list.innerHTML = state.filtered.map(loc => {
      const next = nextStopForLocation(loc.id);
      const distance = state.anchor && loc.distanceKm != null ? fmtDistance(loc.distanceKm, state.anchor.label) : escapeHtml(loc.city);
      const btnLabel = state.service === 'provtagning' ? 'Boka provtagning' : 'Boka vaccinering';
      return `
        <article class="macc-location" data-id="${escapeHtml(loc.id)}">
          <div class="macc-location__head">
            <div class="macc-location__title">${escapeHtml(loc.name)}</div>
            <div class="macc-distance">${escapeHtml(distance)}</div>
          </div>
          <div class="macc-chips">${serviceChips(loc)}</div>
          <div class="macc-next">
            <div class="macc-next__label">NÄSTA ÖPPETTID</div>
            <div class="macc-next__time">${next ? escapeHtml(fmtWindow(parseDate(next.start), parseDate(next.end))) : 'Ingen planerad tid'}</div>
          </div>
          <div class="macc-address">${escapeHtml(loc.address)}</div>
          <div class="macc-note">Drop-in i mån av tid erbjuds under öppettiderna. Tidsbokning rekommenderas.</div>
          <div class="macc-actions">
            <a class="macc-linkbtn macc-linkbtn--primary" href="${escapeHtml(bookUrlForLocation(loc) || '#')}" target="_blank" rel="noopener">${escapeHtml(btnLabel)}</a>
            <a class="macc-linkbtn macc-linkbtn--secondary" href="${escapeHtml(loc.readMoreUrl || '#')}" target="_blank" rel="noopener">Läs mer</a>
          </div>
        </article>`;
    }).join('');
  }

  function renderStops() {
    if (!state.relevantStops.length) {
      el.stops.innerHTML = `<div class="macc-empty">Inga kommande stopp matchar just nu din sökning.</div>`;
      return;
    }
    el.stops.innerHTML = state.relevantStops.map(stop => {
      const loc = stop.location;
      const bookLabel = state.service === 'provtagning' ? 'Boka provtagning' : 'Boka vaccinering';
      return `
        <article class="macc-stop-card">
          <div class="macc-stop-card__time">${escapeHtml(fmtWindow(parseDate(stop.start), parseDate(stop.end)))}</div>
          <div class="macc-stop-card__place">${escapeHtml(loc.name)}</div>
          <div class="macc-stop-card__meta">${escapeHtml(loc.address)}<br>${escapeHtml(stop.displayNote || '')}</div>
          <div class="macc-actions">
            <a class="macc-linkbtn macc-linkbtn--primary" href="${escapeHtml(bookUrlForLocation(loc) || '#')}" target="_blank" rel="noopener">${escapeHtml(bookLabel)}</a>
            <a class="macc-linkbtn macc-linkbtn--secondary" href="${escapeHtml(loc.readMoreUrl || '#')}" target="_blank" rel="noopener">Läs mer</a>
          </div>
        </article>`;
    }).join('');
  }

  function popupHtml(loc) {
    const next = nextStopForLocation(loc.id);
    const nextHtml = next ? `
      <div class="macc-popup__next">
        <div class="macc-next__label">NÄSTA ÖPPETTID</div>
        <div class="macc-next__time">${escapeHtml(fmtWindow(parseDate(next.start), parseDate(next.end)))}</div>
      </div>` : '';
    return `
      <div class="macc-popup">
        <div class="macc-popup__title">${escapeHtml(loc.name)}</div>
        <div class="macc-popup__meta">${escapeHtml(loc.address)}</div>
        ${nextHtml}
        <div class="macc-popup__actions">
          <a class="macc-linkbtn macc-linkbtn--primary" href="${escapeHtml(bookUrlForLocation(loc) || '#')}" target="_blank" rel="noopener">Boka</a>
          <a class="macc-linkbtn macc-linkbtn--secondary" href="${escapeHtml(loc.readMoreUrl || '#')}" target="_blank" rel="noopener">Läs mer</a>
        </div>
      </div>`;
  }

  function renderMap() {
    if (!state.map) {
      state.map = L.map('macc-map', { scrollWheelZoom: false }).setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(state.map);
    }
    if (state.markersLayer) state.map.removeLayer(state.markersLayer);

    const markerIcon = (active) => L.divIcon({
      className: '',
      html: `<div style="width:${active ? 24 : 18}px;height:${active ? 24 : 18}px;border-radius:999px;background:${active ? '#d94c5f' : '#7fa8ae'};border:3px solid rgba(255,255,255,.95);box-shadow:0 8px 18px rgba(16,36,41,.18)"></div>`,
      iconSize: [active ? 24 : 18, active ? 24 : 18],
      iconAnchor: [active ? 12 : 9, active ? 12 : 9],
    });

    state.markersLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => L.divIcon({ className: '', html: `<div class="macc-cluster">${cluster.getChildCount()}</div>`, iconSize: [42, 42] })
    });

    state.filtered.forEach(loc => {
      const active = !!nextStopForLocation(loc.id);
      const marker = L.marker([loc.lat, loc.lon], { icon: markerIcon(active) });
      marker.bindPopup(popupHtml(loc));
      state.markersLayer.addLayer(marker);
    });

    state.map.addLayer(state.markersLayer);

    if (state.filtered.length) {
      const bounds = L.latLngBounds(state.filtered.map(loc => [loc.lat, loc.lon]));
      state.map.fitBounds(bounds.pad(0.2));
    } else {
      state.map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    }

    setTimeout(() => state.map.invalidateSize(), 50);
  }

  function mountLayout() {
    const root = document.getElementById('macc-booking-widget');
    root.innerHTML = `
      <div class="macc-widget">
        <section class="macc-panel macc-controls">
          <div class="macc-topline">
            <div class="macc-service-toggle" role="tablist">
              <button data-service="vaccin" class="active">Vaccinering</button>
              <button data-service="provtagning">Provtagning</button>
              <button data-service="bada">Båda</button>
            </div>
            <div class="macc-searchbar">
              <label class="macc-input-wrap">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
                <input type="search" placeholder="Sök ort, postnummer eller mottagning" />
              </label>
              <button class="macc-btn macc-btn--primary" data-role="search">Sök</button>
              <button class="macc-btn macc-btn--secondary" data-role="geo">Min plats</button>
            </div>
            <div class="macc-controls-foot">
              <div class="macc-status"></div>
              <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <span class="macc-chip" id="macc-count-badge">0 träffar</span>
                <div class="macc-sort-toggle">
                  <button data-sort="nearest" class="active">Närmast</button>
                  <button data-sort="upcoming">Kommande</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="macc-grid">
          <div class="macc-panel macc-card">
            <h2>Platser nära dig</h2>
            <div class="macc-subtext">Sökresultatet sorteras efter avstånd och nästa relevanta öppettid.</div>
            <div class="macc-list"></div>
          </div>
          <div class="macc-panel macc-card macc-map-wrap">
            <div>
              <h2>Karta</h2>
              <div class="macc-subtext">Kartan visar samma filtrerade platser som listan.</div>
            </div>
            <div class="macc-map-box"><div id="macc-map"></div></div>
            <div class="macc-map-foot"><span>Kartan hjälper användaren att få överblick, men listan är huvudvägen till bokning.</span><span>Röd pin = kommande öppettid</span></div>
          </div>
        </section>

        <section class="macc-panel macc-card macc-stops">
          <h2>Kommande stopp nära dig</h2>
          <div class="macc-subtext">Endast de mest relevanta tillfällena nära din sökning visas här.</div>
          <div class="macc-stop-grid"></div>
        </section>
      </div>`;

    el.input = root.querySelector('input');
    el.status = root.querySelector('.macc-status');
    el.countBadge = root.querySelector('#macc-count-badge');
    el.list = root.querySelector('.macc-list');
    el.stops = root.querySelector('.macc-stop-grid');

    root.querySelectorAll('[data-service]').forEach(btn => btn.addEventListener('click', () => {
      state.service = btn.dataset.service;
      root.querySelectorAll('[data-service]').forEach(b => b.classList.toggle('active', b === btn));
      applyFilters();
    }));

    root.querySelectorAll('[data-sort]').forEach(btn => btn.addEventListener('click', () => {
      state.sort = btn.dataset.sort;
      root.querySelectorAll('[data-sort]').forEach(b => b.classList.toggle('active', b === btn));
      applyFilters();
    }));

    root.querySelector('[data-role="search"]').addEventListener('click', runSearch);
    el.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
    root.querySelector('[data-role="geo"]').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        state.anchor = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'din plats' };
        el.input.value = '';
        state.query = '';
        applyFilters();
      });
    });
  }

  async function init() {
    const [locJson, stopJson] = await Promise.all([fetchJson(CONFIG.locationsUrl), fetchJson(CONFIG.stopsUrl)]);
    state.locations = locJson.locations || [];
    state.stops = stopJson.stops || [];
    mountLayout();
    applyFilters();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
