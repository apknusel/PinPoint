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
    map.addControl(new ResetControl(center, 2, 3000)); // 3 second animation for slower, smoother reset
    
    // Hide loading overlay once map is fully loaded
    map.on('load', () => {
        const overlay = document.getElementById('map-loading-overlay');
        if (overlay) {
            overlay.classList.add('loaded');
            // Remove the overlay from DOM after fade-out completes
            setTimeout(() => overlay.remove(), 500);
        }
    });
    
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
            const imageUrl = post.thumbnail 
                ? `data:image/jpeg;base64,${post.thumbnail}`
                : 'https://via.placeholder.com/255x180/f0f0f0/999999?text=No+Image';
            
            const popup = new mapboxgl.Popup({ 
                offset: 50,
                maxWidth: '255px',
                className: 'airbnb-popup',
                anchor: 'bottom',
                closeButton: true
            })
                .setHTML(`
                <div class="post-card">
                    <div class="post-card-image-container">
                        <img src="${imageUrl}" alt="${escapeHtml(post.caption)}" class="post-card-image" />
                    </div>
                    <div class="post-card-body">
                        <h3 class="post-card-username">${escapeHtml(post.display_name)}</h3>
                        <p class="post-card-caption">${escapeHtml(post.caption)}</p>
                        <a href="/post/${post.post_id}" class="post-card-link">View Post →</a>
                    </div>
                </div>
            `);
            
            // Replace close button with Lucide icon when popup opens
            popup.on('open', () => {
                const closeButton = document.querySelector('.mapboxgl-popup-close-button');
                if (closeButton) {
                    closeButton.innerHTML = '<i data-lucide="x"></i>';
                    lucide.createIcons();
                }
            });
            
            const marker = new mapboxgl.Marker()
                .setLngLat([post.longitude, post.latitude])
                .setPopup(popup)
                .addTo(map);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

// Helper function to escape HTML and prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize the map when the page loads
window.onload = initMap;
