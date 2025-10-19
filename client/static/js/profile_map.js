let map;

async function initProfileMap() {
    const profileMapElement = document.getElementById('profileMap');
    
    if (!profileMapElement) {
        return;
    }

    const profileUserId = profileMapElement.dataset.userId;
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
    await loadPosts(profileUserId);
}

async function loadPosts(profileUserId) {
    try {
        const response = await fetch(`/api/posts/${encodeURIComponent(profileUserId)}`);
        if (!response.ok) {
            console.error('Failed to fetch posts');
            return;
        }

        const posts = await response.json();
        
        if (posts.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            
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
                
                bounds.extend([post.longitude, post.latitude]);
            });
            
            map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 12
            });
        }
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.addEventListener('load', initProfileMap);

