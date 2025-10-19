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

        // Group posts by exact DB coordinates
        const coordToPosts = {};
        posts.forEach((post) => {
            const key = `${post.latitude},${post.longitude}`;
            if (!coordToPosts[key]) coordToPosts[key] = [];
            coordToPosts[key].push(post);
        });

        function buildPopupNode(post) {
            const template = document.getElementById('map-post-card-template');
            if (!template) return null;
            const node = template.content.firstElementChild.cloneNode(true);

            const currentImgEl = node.querySelector('.post-card-image-current');
            const usernameEl = node.querySelector('.post-card-username');
            const captionEl = node.querySelector('.post-card-caption');
            const linkEl = node.querySelector('.post-card-link');

            const imageUrl = post.thumbnail
                ? `data:image/jpeg;base64,${post.thumbnail}`
                : 'https://via.placeholder.com/255x180/f0f0f0/999999?text=No+Image';
            if (currentImgEl) {
                currentImgEl.src = imageUrl;
                currentImgEl.alt = escapeHtml(post.caption);
            }
            if (usernameEl) usernameEl.textContent = escapeHtml(post.display_name);
            if (captionEl) captionEl.textContent = escapeHtml(post.caption);
            if (linkEl) linkEl.href = `/post/${post.post_id}`;

            return node;
        }

        // Distance helper not needed when grouping by exact DB coordinates

        // Create one marker per coordinate group
        Object.keys(coordToPosts).forEach((key) => {
            const group = coordToPosts[key];
            const first = group[0];
            let currentIndex = 0;

            const popup = new mapboxgl.Popup({
                offset: 50,
                maxWidth: '255px',
                className: 'airbnb-popup',
                anchor: 'bottom',
                closeButton: true
            });
            // Set content using DOM node
            const contentNode = buildPopupNode(first);
            if (contentNode) popup.setDOMContent(contentNode);

            popup.on('open', () => {
                const root = popup.getElement();
                if (!root) return;

                // Replace close button icon (scoped)
                const closeButton = root.querySelector('.mapboxgl-popup-close-button');
                if (closeButton) {
                    closeButton.innerHTML = '<i data-lucide="x"></i>';
                }

                // Center map exactly on the marker (no vertical offset)
                requestAnimationFrame(() => {
                    map.easeTo({
                        center: [first.longitude, first.latitude],
                        duration: 500,
                        essential: true
                    });
                });

                // Use pre-grouped posts at this exact coordinate
                const total = group.length;
                // Hide overlay controls if only a single post is nearby
                const overlayEl = root.querySelector('.post-card-image-overlay');
                if (overlayEl && total <= 1) {
                    overlayEl.style.display = 'none';
                }

                // If multiple, wire navigation and hover overlays
                const imageContainer = root.querySelector('.post-card-image-container');
                const stageEl = root.querySelector('.post-card-image-stage');
                const currentImgEl = root.querySelector('.post-card-image-current');
                const bufferImgEl = root.querySelector('.post-card-image-buffer');
                if (bufferImgEl) bufferImgEl.style.display = 'none'; // avoid broken image icon when idle
                const usernameEl = root.querySelector('.post-card-username');
                const captionEl = root.querySelector('.post-card-caption');
                const linkEl = root.querySelector('.post-card-link');
                // Get buttons and strip any prior listeners by cloning
                function resetButton(btn) {
                    if (!btn) return btn;
                    const clone = btn.cloneNode(true);
                    btn.replaceWith(clone);
                    return clone;
                }

                let prevBtn = root.querySelector('.post-card-prev');
                let nextBtn = root.querySelector('.post-card-next');
                // If only one post, no nav to wire; finalize icons and exit
                if (total <= 1) {
                    lucide.createIcons();
                    return;
                }
                prevBtn = resetButton(prevBtn);
                nextBtn = resetButton(nextBtn);

                function render(direction) {
                    const post = group[currentIndex];
                    const imageUrl = post.thumbnail
                        ? `data:image/jpeg;base64,${post.thumbnail}`
                        : 'https://via.placeholder.com/255x180/f0f0f0/999999?text=No+Image';
                    // Update text/link immediately
                    usernameEl.textContent = escapeHtml(post.display_name);
                    captionEl.textContent = escapeHtml(post.caption);
                    linkEl.href = `/post/${post.post_id}`;
                    
                    // If we have a stage and both images, animate slide; else simple swap
                    if (stageEl && currentImgEl && bufferImgEl && direction) {
                        const fromRight = direction === 'next';
                        bufferImgEl.src = imageUrl;
                        bufferImgEl.alt = escapeHtml(post.caption);
                        // Prepare positions without transition
                        currentImgEl.style.transition = 'none';
                        bufferImgEl.style.transition = 'none';
                        bufferImgEl.style.display = 'block';
                        bufferImgEl.style.transform = fromRight ? 'translateX(100%)' : 'translateX(-100%)';
                        currentImgEl.style.transform = 'translateX(0)';

                        // Next frame: animate to target positions
                        requestAnimationFrame(() => {
                            currentImgEl.style.transition = 'transform 250ms ease';
                            bufferImgEl.style.transition = 'transform 250ms ease';
                            currentImgEl.style.transform = fromRight ? 'translateX(-100%)' : 'translateX(100%)';
                            bufferImgEl.style.transform = 'translateX(0)';
                        });

                        const onDone = () => {
                            currentImgEl.removeEventListener('transitionend', onDone);
                            // Make buffer the current image content
                            currentImgEl.style.transition = 'none';
                            bufferImgEl.style.transition = 'none';
                            currentImgEl.src = bufferImgEl.src;
                            currentImgEl.alt = bufferImgEl.alt;
                            // Reset transforms
                            currentImgEl.style.transform = 'translateX(0)';
                            bufferImgEl.style.transform = 'translateX(0)';
                            bufferImgEl.style.display = 'none';
                        };
                        currentImgEl.addEventListener('transitionend', onDone, { once: true });
                    } else if (currentImgEl) {
                        // Fallback: no animation
                        currentImgEl.src = imageUrl;
                        currentImgEl.alt = escapeHtml(post.caption);
                    }
                    // Toggle visibility of back button based on index
                    if (imageContainer) {
                        if (currentIndex === 0) {
                            imageContainer.classList.remove('has-prev');
                        } else {
                            imageContainer.classList.add('has-prev');
                        }
                    }
                    // Toggle visibility of next button based on index
                    if (nextBtn) {
                        if (currentIndex >= total - 1) {
                            nextBtn.style.display = 'none';
                        } else {
                            nextBtn.style.display = '';
                        }
                    }
                }

                if (nextBtn && prevBtn && imageContainer) {
                    // Ensure back button hidden initially
                    imageContainer.classList.remove('has-prev');

                    nextBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (total > 1 && currentIndex < total - 1) {
                            currentIndex += 1;
                            render('next');
                        }
                    };

                    prevBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (total > 1 && currentIndex > 0) {
                            currentIndex -= 1;
                            render('prev');
                        }
                    };

                    // Initialize state on open
                    render();
                }

                // Initialize Lucide icons once content is in DOM
                lucide.createIcons();
            });

            new mapboxgl.Marker()
                .setLngLat([first.longitude, first.latitude])
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
