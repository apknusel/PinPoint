postPage = {
  map: null,
  overlay: null,
  toggleBtn: null,
  marker: null,
  isExpanded: false,
  initialCenter: null,
  styleLoaded: false,
  interactionsRegistered: false,
}

function initPostMap() {
  const div = document.getElementById('postMap');
  const overlay = document.getElementById('mapOverlay');
  const toggleBtn = document.getElementById('mapToggle');
  const resetBtn = document.getElementById('mapReset');

  postPage.overlay = overlay;
  postPage.toggleBtn= toggleBtn;
  const lat = parseFloat(div.dataset.lat);
  const lng = parseFloat(div.dataset.lng);

  mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;

  // Shift map center slightly north to better center the marker visually
  const centerLat = lat + 0.003; // Adjust this value to fine-tune
  postPage.initialCenter = [lng, centerLat];
  const initialZoom = 11;

  const map = new mapboxgl.Map({
    container: div,
    style: 'mapbox://styles/mapbox/standard',
    center: postPage.initialCenter,
    zoom: initialZoom,
    interactive: true,
    attributionControl: false
  });
  postPage.map = map;

  const marker = new mapboxgl.Marker()
    .setLngLat([lng, lat])
    .addTo(map);
  postPage.marker = marker;

  // Functions to register/unregister interactions identical to create-post
  let selectedPlace = null;
  let selectedPoi = null;
  let hoveredPlace = null;

  function registerEditInteractions() {
    if (postPage.interactionsRegistered) return;
    const m = postPage.map;
    // POIs
    m.addInteraction('poi-click-edit', {
      type: 'click',
      target: { featuresetId: 'poi', importId: 'basemap' },
      handler: (e) => {
        if (selectedPoi) m.setFeatureState(selectedPoi, { hide: false });
        if (selectedPlace) { m.setFeatureState(selectedPlace, { select: false }); selectedPlace = null; }
        selectedPoi = e.feature;
        m.setFeatureState(e.feature, { hide: true });
        const [flng, flat] = e.feature.geometry.coordinates;
        postPage.marker.setLngLat([flng, flat]);
        // Center view on the new marker position
        try { m.easeTo({ center: [flng, flat], essential: true }); } catch (err) {}
      }
    });
    // Places
    m.addInteraction('place-click-edit', {
      type: 'click',
      target: { featuresetId: 'place-labels', importId: 'basemap' },
      handler: (e) => {
        if (selectedPlace) m.setFeatureState(selectedPlace, { select: false });
        if (selectedPoi) { m.setFeatureState(selectedPoi, { hide: false }); selectedPoi = null; }
        selectedPlace = e.feature;
        m.setFeatureState(e.feature, { select: true });
        const [flng, flat] = e.feature.geometry.coordinates;
        postPage.marker.setLngLat([flng, flat]);
        try { m.easeTo({ center: [flng, flat], essential: true }); } catch (err) {}
      }
    });
    // Map click
    m.addInteraction('map-click-edit', {
      type: 'click',
      handler: (e) => {
        if (selectedPlace) { m.setFeatureState(selectedPlace, { select: false }); selectedPlace = null; }
        if (selectedPoi) { m.setFeatureState(selectedPoi, { hide: false }); selectedPoi = null; }
        postPage.marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
        try { m.easeTo({ center: [e.lngLat.lng, e.lngLat.lat], essential: true }); } catch (err) {}
        return false;
      }
    });
    // Hover (optional, same as create-post)
    m.addInteraction('place-hover-edit', {
      type: 'mousemove',
      target: { featuresetId: 'place-labels', importId: 'basemap' },
      handler: (e) => {
        if (hoveredPlace) {
          if (hoveredPlace.id === e.feature.id && hoveredPlace.namespace === e.feature.namespace) return;
          m.setFeatureState(hoveredPlace, { highlight: false });
        }
        hoveredPlace = e.feature;
        m.setFeatureState(e.feature, { highlight: true });
        m.getCanvas().style.cursor = 'pointer';
      }
    });
    m.addInteraction('map-mousemove-edit', {
      type: 'mousemove',
      handler: () => {
        if (hoveredPlace) { m.setFeatureState(hoveredPlace, { highlight: false }); hoveredPlace = null; }
        m.getCanvas().style.cursor = '';
        return false;
      }
    });

    postPage.interactionsRegistered = true;
  }

  function unregisterEditInteractions() {
    if (!postPage.interactionsRegistered) return;
    const m = postPage.map;
    try { m.removeInteraction('poi-click-edit'); } catch (e) {}
    try { m.removeInteraction('place-click-edit'); } catch (e) {}
    try { m.removeInteraction('map-click-edit'); } catch (e) {}
    try { m.removeInteraction('place-hover-edit'); } catch (e) {}
    try { m.removeInteraction('map-mousemove-edit'); } catch (e) {}
    if (selectedPlace) { try { m.setFeatureState(selectedPlace, { select: false }); } catch (e) {} selectedPlace = null; }
    if (selectedPoi) { try { m.setFeatureState(selectedPoi, { hide: false }); } catch (e) {} selectedPoi = null; }
    m.getCanvas().style.cursor = '';
    postPage.interactionsRegistered = false;
  }

  // Expose helpers for modify_post.js
  postPage.enableEditingInteractions = () => { if (postPage.styleLoaded) registerEditInteractions(); };
  postPage.disableEditingInteractions = () => { unregisterEditInteractions(); };

  // Register after style loads (or later when modify toggled)
  postPage.map.on('style.load', () => {
    postPage.styleLoaded = true;
    if (window.is_editing) registerEditInteractions();
  });

  // Smooth resize using ResizeObserver with requestAnimationFrame throttling
  let resizeScheduled = false;
  const resizeObserver = new ResizeObserver(() => {
    if (!resizeScheduled) {
      resizeScheduled = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          map.resize();
          resizeScheduled = false;
        });
      });
    }
  });
  resizeObserver.observe(overlay);

  // Reset button functionality
  resetBtn.addEventListener('click', () => {
    map.flyTo({
      center: postPage.initialCenter,
      zoom: initialZoom,
      pitch: 0,  // Reset to birds-eye view (no tilt)
      bearing: 0,  // Reset rotation to north-up
      essential: true
    });
  });

  // Toggle expand/collapse functionality
 postPage.isExpanded = false;

  toggleBtn.addEventListener('click', () => {
    if (postPage.isExpanded) {
      // Collapse to 15%
      overlay.style.width = '15%';
      overlay.style.height = '15%';
      toggleBtn.innerHTML = '<i data-lucide="maximize"></i>';
      toggleBtn.setAttribute('aria-label', 'Expand map');
      postPage.isExpanded = false;
    } else {
      // Expand to 50%
      overlay.style.width = '50%';
      overlay.style.height = '50%';
      toggleBtn.innerHTML = '<i data-lucide="minimize"></i>';
      toggleBtn.setAttribute('aria-label', 'Collapse map');
      postPage.isExpanded = true;
    }

    // Re-initialize Lucide icons after changing innerHTML
    lucide.createIcons();
  });
}

// Initialize the map and Lucide icons when the page loads
window.addEventListener('load', () => {
  initPostMap();
  lucide.createIcons();
});