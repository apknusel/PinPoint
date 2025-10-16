
const btn = document.getElementById("userLocationBtn");
const message = document.getElementById('message');

btn.addEventListener('click', getLocation);
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success, error);
    } else {
        console.error("Geolocation is not supported by this browser.");
    }
}

function success(position) {
    const newLocation = { lat: position.coords.latitude, lng: position.coords.longitude };

    map.setCenter(newLocation);
    map.setZoom(12);
    const user_location = new google.maps.InfoWindow({
        content:
            `<div style= "max-width: 50px; max-height: 20px padding: 4px 6px;  font-size: 15px; text-align: center;">
                         You are Here!
                    </div>`
    });

    user_location.setPosition(newLocation);
    user_location.open(map);
}

function error() {
    console.error("Location not found");
}
