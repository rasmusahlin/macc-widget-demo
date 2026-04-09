(() => {
  const state = {
    service: 'alla',
    query: '',
    searchPoint: null,
    searchLabel: '',
    mapCenter: null,
    searching: false,
    expandedId: null,
    pinnedLocationId: null,
  };

  const fmtDate = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });

  let locations = [], stops = [], map, clusterGroup;
  let markerById = new Map();
  let mapMoveTimer = null;

  const normalize = (str = '') => String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const esc = (s = '') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const servicePill = (s) => ({ vaccin: 'Vaccinering', provtagning: 'Provtagning', bada: 'Vaccinering + provtagning' }[s] || s);
  const filterLabel = (s) => ({ alla: 'Alla tjänster', vaccin: 'Enbart vaccinering', provtagning: 'Enbart provtagning' }[s] || s);
  const statusLabel = (status) => ({ cancelled: 'Inställt', scheduled: 'Planerat' }[status] || status || '');

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

  function getDisplayNote(stop) {
    if (!stop || stop.status === 'cancelled') return '';
    const service = normalizeStopService(stop.services || []);
    if (service === 'provtagning') return 'Drop-in i mån av tid erbjuds under öppettiderna.';
    if (service === 'vaccin' || service === 'bada') return 'Välkommen på drop-in eller tidsbokning!';
    return '';
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

  function getDisplayStops(locId) {
    const n = now();
    return stops
      .filter(s => s.locationId === locId && stopMatchesFilter(s.services || []))
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
    return { ...l, _distanceKm: distanceKm, _next: next, _upcomingStops: stopsForLoc.slice(0,5), _score: score };
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

    let primaryHtml;
    if (state.service === 'alla' && hasVaccin && hasProv) {
      const vUrl = loc.bookVaccinUrl || loc.readMoreUrl;
      const pUrl = loc.bookProvtagningUrl || loc.readMoreUrl;
      const sameUrl = vUrl === pUrl;
      if (hasNext && sameUrl) {
        primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(vUrl)}" target="_blank" rel="noopener">Boka tid</a>`;
      } else if (hasNext) {
        primaryHtml = `<a class="mw-btn mw-btn--primary" href="${esc(vUrl)}" target="_blank" rel="noopener">Boka vaccinering</a><a class="mw-btn mw-btn--outline" href="${esc(pUrl)}" target="_blank" rel="noopener">Boka provtagning</a>`;
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

    return `<div class="mw-actions">${primaryHtml}<a class="mw-btn mw-btn--ghost" href="${esc(loc.readMoreUrl)}" target="_blank" rel="noopener">Läs mer</a><button class="mw-btn mw-btn--ghost" type="button" data-show-on-map="${esc(loc.id)}">Visa på karta</button></div>`;
  }

  function locationCard(loc) {
    const expanded = state.expandedId === loc.id;
    const distHtml = (state.searchPoint || state.mapCenter) && loc._distanceKm != null ? `<div class="mw-card-meta-distance">${loc._distanceKm.toFixed(1)} km bort</div>` : '';
    const addressHtml = loc.address ? `<div class="mw-card-address">${esc(loc.address)}</div>` : '';
    const svcBadges = (loc.services || []).filter(s => s !== 'bada').map(s => `<span class="mw-badge mw-badge--${s}">${servicePill(s)}</span>`).join('');

    const nextHtml = loc._next
      ? `<div class="mw-next"><div class="mw-next-label">Nästa öppettid</div><div class="mw-next-service">${stopServiceBadge(loc._next.services)}</div><div class="mw-next-main">${esc(fmtDateLine(loc._next._start))}</div><div class="mw-next-sub">${esc(fmtTimeLine(loc._next._start, loc._next._end))}</div></div>`
      : `<div class="mw-next mw-next--empty"><div class="mw-next-label">Nästa öppettid</div><div class="mw-next-main">Ingen planerad tid just nu</div></div>`;

    const displayStops = getDisplayStops(loc.id);
    const countText = displayStops.length ? `${displayStops.length} visade tider` : 'Inga tider';
    const detailRows = displayStops.length
      ? displayStops.map(s => {
          const statusHtml = s.status === 'cancelled' ? `<span class="mw-status mw-status--cancelled">${esc(statusLabel(s.status))}</span>` : '';
          const note = getDisplayNote(s);
          const noteHtml = note ? `<span class="mw-upcoming-note">${esc(note)}</span>` : '';
          return `<li class="mw-upcoming-item${s.status === 'cancelled' ? ' mw-upcoming-item--cancelled' : ''}"><div class="mw-upcoming-primary"><span class="mw-upcoming-date">${esc(fmtDateLine(s._start))}</span><span class="mw-upcoming-time">${esc(fmtTimeLine(s._start, s._end))}</span>${noteHtml}</div><div class="mw-upcoming-right">${statusHtml}<div class="mw-upcoming-service">${stopServiceBadge(s.services)}</div></div></li>`;
        }).join('')
      : `<li class="mw-upcoming-item mw-upcoming-item--empty">Ingen planerad tid just nu.</li>`;

    return `<article class="mw-card${expanded ? ' is-expanded' : ''}" data-location-id="${esc(loc.id)}"><button class="mw-card-toggle" type="button" data-toggle-card="${esc(loc.id)}" aria-expanded="${expanded ? 'true' : 'false'}"><div class="mw-card-top"><div class="mw-card-title-wrap"><h3 class="mw-card-title">${esc(loc.name)}</h3>${addressHtml}<div class="mw-card-meta">${distHtml}<div class="mw-badges">${svcBadges}</div></div></div><div class="mw-card-right">${nextHtml}<div class="mw-accordion-cta">${expanded ? 'Dölj tider' : 'Visa fler tider'}<span class="mw-accordion-count">${esc(countText)}</span></div></div></div></button><div class="mw-card-inline-actions">${buildQuickActions(loc)}</div><div class="mw-card-details"${expanded ? '' : ' hidden'}><div class="mw-card-details-inner"><div class="mw-upcoming-block"><div class="mw-upcoming-title">Tider</div><ul class="mw-upcoming-list">${detailRows}</ul></div></div></div></article>`;
  }

  function popupHtml(loc) {
    const next = loc._next || getRelevantStops(loc.id)[0];
    const cancelled = getDisplayStops(loc.id).filter(s => s.status === 'cancelled').slice(0, 2);
    const nextStr = next ? fmtDayTime(next._start, next._end) : 'Ingen planerad tid';
    const nextLabel = next ? `${servicePill(normalizeStopService(next.services))} · ${nextStr}` : nextStr;
    const cancelledHtml = cancelled.length ? `<div class="mw-popup-cancelled">${cancelled.map(s => `<div><strong>Inställt:</strong> ${esc(fmtDayTime(s._start, s._end))}</div>`).join('')}</div>` : '';
    const bookUrl = loc.bookVaccinUrl || loc.bookProvtagningUrl || loc.readMoreUrl;
    return `<div class="mw-popup-title">${esc(loc.name)}</div><div class="mw-popup-addr">${esc(loc.address || loc.city || '')}</div><div class="mw-popup-next">${esc(nextLabel)}</div>${cancelledHtml}<div class="mw-popup-actions"><a href="${esc(next ? bookUrl : loc.readMoreUrl)}" target="_blank" rel="noopener">${next ? 'Boka tid' : 'Se öppettider'}</a><button type="button" class="mw-popup-list-link" data-popup-open-card="${esc(loc.id)}">Visa tider i listan</button></div>`;
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
    state.expandedId = state.expandedId === locationId ? null : locationId;
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

  function bindListEvents(root) {
    root.querySelectorAll('[data-toggle-card]').forEach(btn => btn.addEventListener('click', e => openCard(root, e.currentTarget.getAttribute('data-toggle-card'), false)));
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
