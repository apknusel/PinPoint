// Google Maps Application - Minimal Version
let map;
let currentMarker = null;
let autocomplete;
let geocoder;

function initMap() {
  // Initialize the map
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 37.7749, lng: -122.4194 }, // San Francisco
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    scaleControl: false,
    rotateControl: false,
    clickableIcons: true
  });
  
  // Initialize geocoder for manual searches
  geocoder = new google.maps.Geocoder();
  
  // Set up Places API autocomplete and form handling
  setupAutocomplete();
  setupFormHandling();
}

function setupAutocomplete() {
  autocomplete = new google.maps.places.Autocomplete(document.getElementById('autocomplete'), {
    types: ['geocode'],
    fields: ["place_id", "geometry", "formatted_address"]
  });

  // Listen for place selection from dropdown
  autocomplete.addListener('place_changed', function() {
    const place = autocomplete.getPlace();
    
    if (!place.geometry || !place.geometry.location) {
      alert('No details available for input: ' + place.name);
      return;
    }

    // Center map and add marker
    centerMapAndAddMarker(place.geometry.location, place.formatted_address);
  });
}

function setupFormHandling() {
  const searchForm = document.querySelector('.search-form');
  
  // Handle form submission (Enter key)
  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const searchTerm = document.getElementById('autocomplete').value.trim();
    if (searchTerm) {
      searchLocation(searchTerm);
    }
  });
}

function searchLocation(address) {
  geocoder.geocode({ address: address }, function(results, status) {
    if (status === 'OK') {
      const location = results[0].geometry.location;
      centerMapAndAddMarker(location, results[0].formatted_address);
    } else {
      alert('Location not found: ' + status);
    }
  });
}

function centerMapAndAddMarker(location, title) {
  // Center map on location
  map.setCenter(location);
  map.setZoom(15);
  
  // Add marker
  addMarker(location, title);
}

function addMarker(location, title) {
  // Remove existing marker if there is one
  if (currentMarker) {
    currentMarker.setMap(null);
  }

  // Create a simple marker
  currentMarker = new google.maps.Marker({
    position: location,
    map: map,
    title: title,
    animation: google.maps.Animation.DROP
  });
}

// Initialize the map when the page loads
window.onload = initMap;