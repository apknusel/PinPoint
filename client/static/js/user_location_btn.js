const btn = document.getElementById("userLocationBtn");
const message = document.getElementById('message');
const map = new google.maps.Map(document.getElementById("map"));

btn.addEventListener('click', getLocation);
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success, error);
    } else {
        x.innerHTML = "Geolocation is not supported by this browser.";
    }
}

function success(position) {
    message.innerHTML = "Latitude: " + position.coords.latitude +
        "<br>Longitude: " + position.coords.longitude;
    const newLocation = { lat: position.coords.latitude, lng: position.coords.longitude }; 
    const newZoomLevel = 15; 
    map.setCenter(newLocation);
}

function error() {
    alert("Sorry, no position available.");
}