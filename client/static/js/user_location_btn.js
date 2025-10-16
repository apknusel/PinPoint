function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success, error);
    } else {
        console.error("Geolocation is not supported by this browser.");
    }
}

function success(position) {
    const newLocation = [position.coords.longitude, position.coords.latitude];
    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
        .setLngLat(newLocation)
        .setHTML(
            `<div style="max-width: 100px; padding: 4px 6px; text-align: center;">
            You are Here!
        </div>`
        )
        .addTo(map);

    map.flyTo({
        center: newLocation,
        zoom: 11,
        speed: 2,
        curve: 1.4,
        essential: true,
    });
}

function error(e) {
    console.error("Error code: "+e.code);
}
