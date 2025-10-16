function initPostMap() {
  const div = document.getElementById('postMap');
  const overlay = document.getElementById('mapOverlay');
  const toggleBtn = document.getElementById('mapToggle');

  const lat = parseFloat(div.dataset.lat);
  const lng = parseFloat(div.dataset.lng);

  mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
  
  const map = new mapboxgl.Map({
    container: div,
    style: 'mapbox://styles/mapbox/standard',
    center: [lng, lat],
    zoom: 11,
    interactive: true,
    attributionControl: false
  });

  new mapboxgl.Marker()
    .setLngLat([lng, lat])
    .addTo(map);

  // Watch for resize events on the overlay and update the map continuously
  let resizeTimeout;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      map.resize();
    }, 10);
  });
  resizeObserver.observe(overlay);

  // Toggle expand/collapse functionality
  let isExpanded = false;
  
  toggleBtn.addEventListener('click', () => {
    if (isExpanded) {
      // Collapse to 15%
      overlay.style.width = '15%';
      overlay.style.height = '15%';
      toggleBtn.textContent = '+';
      toggleBtn.setAttribute('aria-label', 'Expand map');
    } else {
      // Expand to 50%
      overlay.style.width = '50%';
      overlay.style.height = '50%';
      toggleBtn.textContent = '−';
      toggleBtn.setAttribute('aria-label', 'Collapse map');
    }
    
    isExpanded = !isExpanded;
  });
}

// Initialize the map when the page loads
window.addEventListener('load', initPostMap);