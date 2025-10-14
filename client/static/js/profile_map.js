let map;
const profileUsername = document.getElementById('map').dataset.username;

async function initMap() {
    const center = { lat: 44.9778, lng: -93.2650 };

    map = new google.maps.Map(document.getElementById('map'), {
        center: center,
        zoom: 11,
        streetViewControl: false,
        mapTypeControl: false
    });

    // Fetch and display posts for the specific user
    await loadPosts();
}

async function loadPosts() {
    try {
        // Fetch posts for the specific user using the profileUsername variable
        const response = await fetch(`/api/posts/${profileUsername}`);
        if (!response.ok) {
            console.error('Failed to fetch posts');
            return;
        }

        const posts = await response.json();
        
        // If there are posts, center the map on the first one
        if (posts.length > 0) {
            map.setCenter({ 
                lat: posts[0].latitude, 
                lng: posts[0].longitude 
            });
            map.setZoom(4); // Adjust zoom to show multiple markers
        }
        
        // Create markers for each post
        posts.forEach(post => {
            const marker = new google.maps.Marker({
                position: { 
                    lat: post.latitude, 
                    lng: post.longitude 
                },
                map: map,
                title: post.caption
            });

            // Add info window for each marker
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="max-width: 200px;">
                        <h3 style="margin: 0 0 8px 0;">${escapeHtml(post.nickname)}</h3>
                        <p style="margin: 0;">${escapeHtml(post.caption)}</p>
                        <a href="/post/${post.post_id}" style="display: inline-block; margin-top: 8px;">View Post</a>
                    </div>
                `
            });
            
            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });
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

