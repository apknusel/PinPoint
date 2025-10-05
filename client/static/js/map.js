let map;

function generateRandomLatLng() {
    const randomLat = (Math.random() * 180) - 90; // -90 to 90
    const randomLng = (Math.random() * 360) - 180; // -180 to 180
    return { lat: randomLat, lng: randomLng };
  }


function initMap() {
    const randomLocation = generateRandomLatLng();

    map = new google.maps.Map(document.getElementById('map'), {
        center: randomLocation,
        zoom: 8 // Adjust zoom level as needed
    });
}
  
// Initialize the map when the page loads
window.onload = initMap;