function initCreatePostMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    const center = { lat: 44.9778, lng: -93.2650 };
    const map = new google.maps.Map(mapEl, {
        center: center,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
    });

    let marker = null;
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const submitBtn = document.getElementById('submitBtn');

    function setPosition(latLng) {
        if (!marker) {
            marker = new google.maps.Marker({ position: latLng, map });
        } else {
            marker.setPosition(latLng);
        }
        const lat = latLng.lat();
        const lng = latLng.lng();
        latInput.value = lat;
        lngInput.value = lng;
        submitBtn.disabled = false;
    }

    map.addListener('click', (e) => {
        setPosition(e.latLng);
    });
}

// Expose callback
window.initCreatePostMap = initCreatePostMap;

// Image preview
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('image');
    const preview = document.getElementById('imagePreview');
    if (!fileInput || !preview) return;

    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file || !file.type.startsWith('image/')) {
            preview.style.display = 'none';
            preview.removeAttribute('src');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
});

window.onload = initCreatePostMap;