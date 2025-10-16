function initPostMap() {
  const div = document.getElementById('postMap');

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
}

// Initialize the map when the page loads
window.addEventListener('load', initPostMap);