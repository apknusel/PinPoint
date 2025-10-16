function initPostMap() {
  const div = document.getElementById('postMap');
  const overlay = document.getElementById('mapOverlay');
  const toggleBtn = document.getElementById('mapToggle');
  const resetBtn = document.getElementById('mapReset');

  const lat = parseFloat(div.dataset.lat);
  const lng = parseFloat(div.dataset.lng);

  mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
  
  // Shift map center slightly north to better center the marker visually
  const centerLat = lat + 0.003; // Adjust this value to fine-tune
  const initialCenter = [lng, centerLat];
  const initialZoom = 11;
  
  const map = new mapboxgl.Map({
    container: div,
    style: 'mapbox://styles/mapbox/standard',
    center: initialCenter,
    zoom: initialZoom,
    interactive: true,
    attributionControl: false
  });

  new mapboxgl.Marker()
    .setLngLat([lng, lat])
    .addTo(map);

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
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,  // Reset to birds-eye view (no tilt)
      bearing: 0,  // Reset rotation to north-up
      essential: true
    });
  });

  // Toggle expand/collapse functionality
  let isExpanded = false;
  
  toggleBtn.addEventListener('click', () => {
    if (isExpanded) {
      // Collapse to 15%
      overlay.style.width = '15%';
      overlay.style.height = '15%';
      toggleBtn.innerHTML = '<i data-lucide="maximize"></i>';
      toggleBtn.setAttribute('aria-label', 'Expand map');
    } else {
      // Expand to 50%
      overlay.style.width = '50%';
      overlay.style.height = '50%';
      toggleBtn.innerHTML = '<i data-lucide="minimize"></i>';
      toggleBtn.setAttribute('aria-label', 'Collapse map');
    }
    
    isExpanded = !isExpanded;
    
    // Re-initialize Lucide icons after changing innerHTML
    lucide.createIcons();
  });
}

// Initialize the map and Lucide icons when the page loads
window.addEventListener('load', () => {
  initPostMap();
  lucide.createIcons();
});