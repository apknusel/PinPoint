function initCreatePostMap() {
    mapboxgl.accessToken = window.MAPBOX_ACCESS_TOKEN;
    const map = new mapboxgl.Map({
        container: 'map',
        center: [-93.2650, 44.9778],
        zoom: 11,
        style: 'mapbox://styles/mapbox/standard'
    });
    map.addControl(new ResetControl({ lat: 44.9778, lng: -93.2650 }, 11));

    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const submitBtn = document.getElementById('submitBtn');

    map.on('style.load', () => {
        var selectedPlace = null;
        var selectedPoi = null;
        var hoveredPlace = null;
        const marker = new mapboxgl.Marker();

        function placeMarker(lng, lat) {
            marker.setLngLat([lng, lat]).addTo(map);
            latInput.value = lat;
            lngInput.value = lng;
            submitBtn.disabled = false;
        }

        // POIs (restaurants, shops, etc.)
        map.addInteraction('poi-click', {
            type: 'click',
            target: { featuresetId: 'poi', importId: 'basemap' },
            handler: (e) => {
                if (selectedPoi) map.setFeatureState(selectedPoi, { hide: false });
                if (selectedPlace) {
                    map.setFeatureState(selectedPlace, { select: false });
                    selectedPlace = null;
                }

                selectedPoi = e.feature;
                map.setFeatureState(e.feature, { hide: true });

                const [lng, lat] = e.feature.geometry.coordinates;
                placeMarker(lng, lat);
            }
        });

        // Places (cities, neighborhoods)
        map.addInteraction('place-click', {
            type: 'click',
            target: { featuresetId: 'place-labels', importId: 'basemap' },
            handler: (e) => {
                if (selectedPlace) map.setFeatureState(selectedPlace, { select: false });
                if (selectedPoi) {
                    map.setFeatureState(selectedPoi, { hide: false });
                    selectedPoi = null;
                }

                selectedPlace = e.feature;
                map.setFeatureState(e.feature, { select: true });

                const [lng, lat] = e.feature.geometry.coordinates;
                placeMarker(lng, lat);
            }
        });

        // Click anywhere on map
        map.addInteraction('map-click', {
            type: 'click',
            handler: (e) => {
                if (selectedPlace) {
                    map.setFeatureState(selectedPlace, { select: false });
                    selectedPlace = null;
                }
                if (selectedPoi) {
                    map.setFeatureState(selectedPoi, { hide: false });
                    selectedPoi = null;
                }

                placeMarker(e.lngLat.lng, e.lngLat.lat);
                return false;
            }
        });

        // Hover effects on place labels
        map.addInteraction('place-hover', {
            type: 'mousemove',
            target: { featuresetId: 'place-labels', importId: 'basemap' },
            handler: (e) => {
                if (hoveredPlace) {
                    if (hoveredPlace.id === e.feature.id && hoveredPlace.namespace === e.feature.namespace) return;
                    map.setFeatureState(hoveredPlace, { highlight: false });
                }
                hoveredPlace = e.feature;
                map.setFeatureState(e.feature, { highlight: true });
                map.getCanvas().style.cursor = 'pointer';
            }
        });

        // Clear hover
        map.addInteraction('map-mousemove', {
            type: 'mousemove',
            handler: () => {
                if (hoveredPlace) {
                    map.setFeatureState(hoveredPlace, { highlight: false });
                    hoveredPlace = null;
                }
                map.getCanvas().style.cursor = '';
                return false;
            }
        });
    });
}

// Image preview
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('image');
    const preview = document.getElementById('imagePreview');
    const wrapper = preview ? preview.parentElement : null;
    const placeholder = wrapper ? wrapper.querySelector('.image-preview-placeholder') : null;
    const fileNameSpan = document.getElementById('fileName');
    if (!fileInput || !preview || !wrapper || !placeholder || !fileNameSpan) return;

    function resetPreview() {
        preview.removeAttribute('src');
        preview.hidden = true;
        placeholder.hidden = false;
        fileNameSpan.textContent = 'No file chosen';
    }

    resetPreview();

    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file || !file.type.startsWith('image/')) {
            resetPreview();
            return;
        }
        fileNameSpan.textContent = file.name;

        // Use Object URL for efficient preview
        const url = URL.createObjectURL(file);
        preview.onload = () => URL.revokeObjectURL(url);
        preview.src = url;

        preview.hidden = false;
        placeholder.hidden = true;
    });
});

window.onload = initCreatePostMap;