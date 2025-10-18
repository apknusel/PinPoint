
class ResetControl {
     constructor(center, zoom = 2, duration = null) {
        this.center = center; 
        this.zoom = zoom;
        this.duration = duration;
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
            const flyToOptions = {
                center: [this.center.lng, this.center.lat],
                zoom: this.zoom,
                pitch: 0,  // Reset to birds-eye view (no tilt)
                bearing: 0,  // Reset rotation to north-up
                essential: true
            };
            
            // Add duration if specified
            if (this.duration !== null) {
                flyToOptions.duration = this.duration;
            }
            
            map.flyTo(flyToOptions);
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