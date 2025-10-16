let map;

async function initProfileMap() {
    const profileMapElement = document.getElementById('profileMap');
    
    if (!profileMapElement) {
        return;
    }

    const profileUsername = profileMapElement.dataset.username;
    const mapboxToken = profileMapElement.dataset.mapboxToken;

    // Default center (Minneapolis)
    const defaultCenter = [-93.2650, 44.9778];
    
    mapboxgl.accessToken = mapboxToken;
    
    map = new mapboxgl.Map({
        container: 'profileMap',
        style: 'mapbox://styles/mapbox/standard',
        center: defaultCenter,
        zoom: 11,
        interactive: true,
        attributionControl: false
    });

    // Fetch and display posts for the specific user
    await loadPosts(profileUsername);
}

async function loadPosts(profileUsername) {
    try {
        // Fetch posts for the specific user using the profileUsername parameter
        const response = await fetch(`/api/posts/${profileUsername}`);
        if (!response.ok) {
            console.error('Failed to fetch posts');
            return;
        }

        const posts = await response.json();
        
        // If there are posts, fit the map to show all markers
        if (posts.length > 0) {
            // Create a bounds object
            const bounds = new mapboxgl.LngLatBounds();
            
            // Create markers for each post and extend bounds
            posts.forEach(post => {
                const marker = new mapboxgl.Marker()
                    .setLngLat([post.longitude, post.latitude])
                    .setPopup(
                        new mapboxgl.Popup({ offset: 25 })
                            .setHTML(`
                                <div class="map-popup-content">
                                    <h3 class="map-popup-title">${escapeHtml(post.display_name)}</h3>
                                    <p class="map-popup-caption">${escapeHtml(post.caption)}</p>
                                    <a href="/post/${post.post_id}" class="map-popup-link">View Post</a>
                                </div>
                            `)
                    )
                    .addTo(map);
                
                // Extend bounds to include this marker
                bounds.extend([post.longitude, post.latitude]);
            });
            
            // Fit map to bounds with padding
            map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 12
            });
        }
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
window.addEventListener('load', initProfileMap);

