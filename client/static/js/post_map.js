function initPostMap() {
  const div = document.getElementById('postMap');

  const lat = parseFloat(div.dataset.lat);
  const lng = parseFloat(div.dataset.lng);

  const center = { lat, lng };

  const map = new google.maps.Map(div, {
    center: center,
    zoom: 11,
    streetViewControl: false,
    mapTypeControl: false,
    disableDefaultUI: true,
    zoomControl: false,
    fullscreenControl: false,
  });

  new google.maps.Marker({ position: center, map });
}

window.initPostMap = initPostMap;