
class ResetControl {
     constructor(center, zoom = 2) {
        this.center = center; 
        this.zoom = zoom;
    }

    onAdd(map) {
        this._map = map;
        const container = document.createElement("div");
        container.className = "mapboxgl-ctrl-group mapboxgl-ctrl";
        this._container = container;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "mapboxgl-ctrl-icon";
        button.style.display = "flex";
        button.style.alignItems = "center";
        button.style.justifyContent = "center";
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="3" stroke-linecap="square" stroke-linejoin="arcs"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>`

        button.onclick = () => {
            map.flyTo({
                center: [this.center.lng, this.center.lat],
                zoom: this.zoom,
            });
        };
        container.appendChild(button);
        return container;
    }
    
    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}