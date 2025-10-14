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