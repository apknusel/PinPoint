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
        const response = await fetch(`/api/posts/by-user/${encodeURIComponent(profileUserId)}`);
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

            // Helper to flash only the image element inside a post card
            function flashImageByPostId(postId) {
                const postEl = document.querySelector(`.post[data-post-id="${CSS.escape(postId)}"]`);
                if (!postEl) return;
                const img = postEl.querySelector('img');
                if (!img) return;

                const anchor = postEl.querySelector('a');
                if (!anchor) return;

                // Compute overlay size/position to match image's rendered box
                const rect = img.getBoundingClientRect();
                const parentRect = anchor.getBoundingClientRect();

                // If image not yet laid out (e.g., hidden), retry after layout
                if (rect.width === 0 || rect.height === 0) {
                    setTimeout(() => flashImageByPostId(postId), 0);
                    return;
                }

                const overlay = document.createElement('div');
                overlay.className = 'img-flash-overlay';
                overlay.style.left = `${rect.left - parentRect.left}px`;
                overlay.style.top = `${rect.top - parentRect.top}px`;
                overlay.style.width = `${rect.width}px`;
                overlay.style.height = `${rect.height}px`;

                anchor.appendChild(overlay);
                // Remove after animation completes
                setTimeout(() => overlay.remove(), 3100);
            }

            // Helpers to filter grid to a set of post ids and reset back
            const postsGrid = document.querySelector('.profile-posts');
            function resetGridFilter() {
                if (!postsGrid) return;
                postsGrid.classList.remove('filtering');
                document.querySelectorAll('.pure-u-1-3.is-selected').forEach((col) => {
                    col.classList.remove('is-selected');
                });
            }

            function filterGridToPostIds(postIds) {
                if (!postsGrid) return;
                const idSet = new Set(postIds);
                postsGrid.classList.add('filtering');
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
                    // After layout updates, flash images for all posts in this group
                    requestAnimationFrame(() => {
                        ids.forEach((id) => flashImageByPostId(id));
                    });
                });

                bounds.extend([longitude, latitude]);
            });

            const fitOptions = {
                padding: 50,
                maxZoom: 12
            };
            map.fitBounds(bounds, fitOptions);

            // Update reset control to return to the fitted bounds view
            if (typeof ResetControl !== 'undefined') {
                if (resetControl) {
                    try { map.removeControl(resetControl); } catch (_) {}
                }
                resetControl = new ResetControl({ lat: 44.9778, lng: -93.2650 }, 12, null, bounds);
                map.addControl(resetControl);
            }

            // Clicking on map background resets the grid
            map.on('click', (e) => {
                const t = e && e.originalEvent && e.originalEvent.target;
                if (t && t.closest && t.closest('.mapboxgl-marker')) return;
                resetGridFilter();
            });

            // Clicking page whitespace resets the grid as well
            document.addEventListener('click', (e) => {
                if (e.target && e.target.closest && e.target.closest('.mapboxgl-marker')) return;
                if (e.target && e.target.closest && e.target.closest('.profile-posts')) return; // allow clicks inside grid without reset
                resetGridFilter();
            });
        }
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

window.addEventListener('load', initProfileMap);

