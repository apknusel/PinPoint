
class ResetControl {
     constructor(center, zoom = 2, duration = null, bounds = null) {
        this.center = center; 
        this.zoom = zoom;
        this.duration = duration;
        this.bounds = bounds; // optional: if provided, use fitBounds instead of flyTo
    }

    onAdd(map) {
        this._map = map;
        const container = document.createElement("div");
        container.className = "mapboxgl-ctrl-group mapboxgl-ctrl";
        this._container = container;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "mapboxgl-ctrl-icon mapboxgl-ctrl-reset";
        button.innerHTML = `<i data-lucide="rotate-ccw"></i>`;

        button.onclick = () => {
            // Close any open popups
            const popups = document.getElementsByClassName('mapboxgl-popup');
            if (popups.length) {
                for (let popup of popups) {
                    popup.remove();
                }
            }

            // Reset map view
            if (this.bounds) {
                const fitOptions = {
                    padding: 50,
                    maxZoom: typeof this.zoom === 'number' ? this.zoom : 12,
                    essential: true
                };
                if (this.duration !== null) fitOptions.duration = this.duration;
                map.fitBounds(this.bounds, fitOptions);
            } else {
                const flyToOptions = {
                    center: [this.center.lng, this.center.lat],
                    zoom: this.zoom,
                    pitch: 0,
                    bearing: 0,
                    essential: true
                };
                if (this.duration !== null) flyToOptions.duration = this.duration;
                map.flyTo(flyToOptions);
            }
        };
        container.appendChild(button);
        
        // Initialize Lucide icons after button is added to DOM
        setTimeout(() => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }, 100);
        
        return container;
    }
    
    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}