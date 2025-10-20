let map;
let resetControl = null;

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

    // Add initial reset control to default city view (will be updated to bounds after posts load)
    if (typeof ResetControl !== 'undefined') {
        resetControl = new ResetControl({ lat: 44.9778, lng: -93.2650 }, 11);
        map.addControl(resetControl);
    }

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

            // Group posts by stable key when present; fallback to exact lat/lng
            const coordToPosts = {};
            posts.forEach((post) => {
                const key = post.location_key || `${post.latitude},${post.longitude}`;
                if (!coordToPosts[key]) coordToPosts[key] = [];
                coordToPosts[key].push(post);
            });

            // Helpers to filter grid to a set of post ids and reset back
            const postsGrid = document.querySelector('.profile-posts');

            function filterGridToPostIds(postIds) {
                if (!postsGrid) return;
                const idSet = new Set(postIds);
                document.querySelectorAll('.profile-posts .pure-u-1-3').forEach((col) => {
                    const postCard = col.querySelector('.post');
                    const postId = postCard && postCard.getAttribute('data-post-id');
                    if (postId && idSet.has(postId)) {
                        col.classList.add('is-selected');
                    } else {
                        col.classList.remove('is-selected');
                    }
                });
                // Scroll first selected into view, if any
                const firstSelected = document.querySelector('.profile-posts .pure-u-1-3.is-selected');
                if (firstSelected) {
                    firstSelected.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
            }

            // Create one marker per coord group
            Object.keys(coordToPosts).forEach((key) => {
                const group = coordToPosts[key];
                const { longitude, latitude } = group[0];

                const marker = new mapboxgl.Marker()
                    .setLngLat([longitude, latitude])
                    .addTo(map);

                marker.getElement().addEventListener('click', (ev) => {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    // Filter grid to these posts and center first
                    const ids = group.map((p) => String(p.post_id));
                    filterGridToPostIds(ids);
                });

                bounds.extend([longitude, latitude]);
            });

            const fitOptions = {
                padding: 50,
                maxZoom: 12
            };
            map.fitBounds(bounds, fitOptions);
        }
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

window.addEventListener('load', initProfileMap);

