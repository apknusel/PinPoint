let map;

async function initMap() {
    let center = { lat: 44.9778, lng: -93.2650 };
    mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/standard',
        center: [center.lng, center.lat],
        zoom: 2
    });
    map.flyTo({
        center: center,
        zoom: 11,
        speed: 1.5,
        curve: 1.4,
        essential: true,
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.addControl(
        new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true
        })
    );

    await loadPosts();
}

async function loadPosts() {
    try {
        const response = await fetch('/api/posts');
        if (!response.ok) {
            console.error('Failed to fetch posts');
            return;
        }

        const posts = await response.json();

        // Create markers for each post
        posts.forEach(post => {
            const marker = new mapboxgl.Marker()
                .setLngLat([post.longitude, post.latitude])
                .setPopup(
                    new mapboxgl.Popup({ offset: 25 })
                        .setHTML(`
                        <div style="max-width: 200px;">
                            <h3 style="margin: 0 0 8px 0;">${escapeHtml(post.nickname)}</h3>
                            <p style="margin: 0;">${escapeHtml(post.caption)}</p>
                            <a href="/post/${post.post_id}" style="display: inline-block; margin-top: 8px;">View Post</a>
                        </div>
                    `)
                )
                .addTo(map);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

// Helper function to escape HTML and prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize the map when the page loads
window.onload = initMap;
