(function () {
  const CFG = window.CONFIG;
  const { createClient } = window.supabase;
  const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  // ---------- password gate ----------
  const gate = document.getElementById('gate');
  const gateForm = document.getElementById('gate-form');
  const gateInput = document.getElementById('gate-input');
  const gateError = document.getElementById('gate-error');

  async function sha256Hex(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function bootstrapGate() {
    if (sessionStorage.getItem('col-auth') === 'ok') {
      unlock();
      return;
    }
    gateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      gateError.textContent = '';
      const hash = await sha256Hex(gateInput.value);
      if (hash === CFG.PASSWORD_SHA256) {
        sessionStorage.setItem('col-auth', 'ok');
        unlock();
      } else {
        gateError.textContent = 'Incorrect password.';
        gateInput.value = '';
      }
    });
  }

  function unlock() {
    gate.classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initMap();
  }

  // ---------- map ----------
  let map;
  const activeRasters = new Map();   // name -> GeoRasterLayer
  let rasterBoundsUnion = null;

  function initMap() {
    map = L.map('map', { center: [40, -94], zoom: 5, maxZoom: 22 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 22,
      maxNativeZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    loadLayerLists();
  }

  // ---------- bucket listing ----------
  async function listBucket(prefix) {
    const { data, error } = await sb.storage.from(CFG.BUCKET).list(prefix, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    return (data || []).filter(f => f.name && !f.name.endsWith('/') && f.id !== null);
  }

  function publicUrl(path) {
    return `${CFG.SUPABASE_URL}/storage/v1/object/public/${CFG.BUCKET}/${path}`;
  }

  async function loadLayerLists() {
    const rasterListEl = document.getElementById('raster-list');
    const vectorListEl = document.getElementById('vector-list');

    try {
      const [rasters, vectors] = await Promise.all([
        listBucket(CFG.RASTER_PREFIX),
        listBucket(CFG.VECTOR_PREFIX),
      ]);

      const byName = (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

      rasterListEl.innerHTML = '';
      const rasterFiles = rasters.filter(f => /\.tif{1,2}$/i.test(f.name)).sort(byName);
      if (!rasterFiles.length) {
        rasterListEl.textContent = 'No rasters found.';
      } else {
        rasterFiles.forEach(f => rasterListEl.appendChild(buildRasterItem(f.name)));
      }

      vectorListEl.innerHTML = '';
      const vectorFiles = vectors.filter(f => /\.(geojson|json)$/i.test(f.name)).sort(byName);
      if (!vectorFiles.length) {
        vectorListEl.textContent = 'No vectors found.';
      } else {
        vectorFiles.forEach(f => vectorListEl.appendChild(buildVectorItem(f.name)));
      }
    } catch (e) {
      rasterListEl.textContent = 'Error listing bucket: ' + e.message;
      vectorListEl.textContent = '';
    }
  }

  // ---------- raster items ----------
  function buildRasterItem(name) {
    const el = document.createElement('div');
    el.className = 'layer-item';
    el.innerHTML = `
      <div class="layer-item-header">
        <input type="checkbox">
        <label>${escapeHtml(name)}</label>
      </div>
    `;
    const cb = el.querySelector('input[type="checkbox"]');
    el.querySelector('label').addEventListener('click', () => cb.click());

    cb.addEventListener('change', async () => {
      if (cb.checked) {
        el.classList.add('loading');
        try {
          const layer = await createRasterLayer(publicUrl(`${CFG.RASTER_PREFIX}/${name}`));
          layer.setOpacity(CFG.DEFAULT_OPACITY);
          layer.addTo(map);
          activeRasters.set(name, layer);

          const b = layer.getBounds();
          if (b && b.isValid()) {
            rasterBoundsUnion = rasterBoundsUnion
              ? rasterBoundsUnion.extend(b)
              : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
            map.fitBounds(rasterBoundsUnion, { maxZoom: 20 });
          }
        } catch (err) {
          console.error(err);
          alert(`Failed to load ${name}: ${err.message}\n\nCommon causes: CORS not configured, or file is not a valid COG.`);
          cb.checked = false;
        } finally {
          el.classList.remove('loading');
        }
      } else {
        const layer = activeRasters.get(name);
        if (layer) {
          map.removeLayer(layer);
          activeRasters.delete(name);
        }
      }
    });

    return el;
  }

  async function createRasterLayer(url) {
    const georaster = await parseGeoraster(url);
    const nodata = CFG.NODATA_VALUE;
    const rangeSpan = CFG.PIXEL_MAX - CFG.PIXEL_MIN;
    return new GeoRasterLayer({
      georaster,
      resolution: 256,
      pixelValuesToColorFn: (values) => {
        const v = values[0];
        if (v === null || v === undefined || isNaN(v)) return null;
        if (nodata !== null && v === nodata) return null;
        const t = (v - CFG.PIXEL_MIN) / rangeSpan;
        return viridis(t);
      },
    });
  }

  function viridis(t) {
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const stops = CFG.VIRIDIS_STOPS;
    for (let i = 0; i < stops.length - 1; i++) {
      const [t0, c0] = stops[i];
      const [t1, c1] = stops[i + 1];
      if (t >= t0 && t <= t1) {
        const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
        const r = Math.round(c0[0] + k * (c1[0] - c0[0]));
        const g = Math.round(c0[1] + k * (c1[1] - c0[1]));
        const b = Math.round(c0[2] + k * (c1[2] - c0[2]));
        return `rgb(${r},${g},${b})`;
      }
    }
    return 'rgb(0,0,0)';
  }

  // ---------- vector items ----------
  function buildVectorItem(name) {
    const el = document.createElement('div');
    el.className = 'layer-item';
    el.innerHTML = `
      <div class="layer-item-header">
        <input type="checkbox" checked>
        <label>${escapeHtml(name)}</label>
      </div>
    `;
    const cb = el.querySelector('input[type="checkbox"]');
    el.querySelector('label').addEventListener('click', () => cb.click());

    let layer = null;
    loadVectorLayer(name).then(l => {
      layer = l;
      if (cb.checked) layer.addTo(map);
    }).catch(err => {
      console.error(err);
      el.classList.add('error');
      el.querySelector('label').textContent += ` (error: ${err.message})`;
      cb.disabled = true;
    });

    cb.addEventListener('change', () => {
      if (!layer) return;
      if (cb.checked) layer.addTo(map);
      else map.removeLayer(layer);
    });

    return el;
  }

  async function loadVectorLayer(name) {
    const url = publicUrl(`${CFG.VECTOR_PREFIX}/${name}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();
    const firstType = geojson.features?.[0]?.geometry?.type || '';

    if (firstType.includes('Point')) {
      const cluster = L.markerClusterGroup({ chunkedLoading: true });
      L.geoJSON(geojson, {
        pointToLayer: (_f, latlng) => L.circleMarker(latlng, {
          radius: 5, color: '#4a7fff', weight: 1, fillOpacity: 0.7,
        }),
      }).eachLayer(l => cluster.addLayer(l));
      return cluster;
    }

    return L.geoJSON(geojson, {
      style: { color: '#4a7fff', weight: 2, fillOpacity: 0.15 },
      onEachFeature: (feature, layer) => {
        const name = featureName(feature);
        if (name) {
          layer.bindTooltip(String(name), {
            permanent: true,
            direction: 'center',
            className: 'feature-label',
          });
        }
      },
    });
  }

  function featureName(feature) {
    const p = feature?.properties;
    if (!p) return null;
    return p.Name ?? p.name ?? p.NAME ?? null;
  }

  // ---------- utils ----------
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  bootstrapGate();
})();
