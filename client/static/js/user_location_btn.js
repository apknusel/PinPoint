let getLocationPromise = () => {
    return new Promise(function (resolve, reject) {
        // Promisifying the geolocation API
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => reject(error)
        );
    });
};

async function getLocation() {
    try {
        const response = await getLocationPromise();
        const newLocation = [response.coords.longitude, response.coords.latitude];

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

        console.log(response);
    } catch (e) {
        console.error(e);
    }
}

