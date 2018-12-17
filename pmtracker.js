'use strict';

let DEFAULT_LOCALE = 'en-IN';
let DEFAULT_TIMEZONE = 'Asia/Kolkata';

let apiKey = 'AIzaSyAxxmf1EGaVzxC_AZPkN0Mg_2vWRyJybtM';

let getRandomInt = function (max) {
  return Math.floor(Math.random() * Math.floor(max));
}

let QS = {
    stringify: function (o) {
        let result = '';
        let first = true;
        Object.keys(o).forEach(function (key) {
            let value = o[key];
            if (!first) {
                result += '&';
            } else {
                first = false;
            }
            result += encodeURIComponent(key) + '=' + encodeURIComponent(value);
        });
        return result;
    },
    parse: function (string) {
        if (string[0] === '?') {
            string = string.slice(1);
        }
        let pairs = string.split('&');
        let o = {};
        pairs.forEach(function (pairstr) {
            let pair = pairstr.split('=');
            if (pair[0]) {
                o[pair[0]] = pair[1] || null;
            }
        });
        return o;
    }
};

let geocode = function (address, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://maps.googleapis.com/maps/api/geocode/json?' + QS.stringify({
        address: address,
        key: apiKey
    }));
    xhr.addEventListener('load', function () {
        if (xhr.status === 200) {
            callback(null, JSON.parse(xhr.responseText));
        } else {
            callback(new Error('Unexpected status code: ' + xhr.status));
        }
    });
    xhr.addEventListener('error', function (event) {
        callback(event.error);
    });
    xhr.send();
};

let resolveLocale = function () {
    let dtf = Intl && Intl.DateTimeFormat();
    if (dtf) {
        let options = dtf.resolvedOptions();
        if (options.locale) {
            return options.locale;
        }
    }
    // Return English (India) by default
    return DEFAULT_LOCALE;
};

let fillInfoContainer = function (container, locationInfo, place) {
    let locale = resolveLocale();
    // image
    if (place.photos && place.photos.length > 0) {
        container.querySelector('.info-photo-container').hidden = false;
        let img = container.querySelector('.info-photo');
        let photo = place.photos[getRandomInt(place.photos.length)];
        img.src = photo.getUrl({ maxWidth: 100, maxHeight: 100 });
    }
    // date
    let date = new Date(locationInfo.date);
    let dateElement = container.querySelector('.info-date');
    dateElement.dateTime = locationInfo.date;
    dateElement.textContent = date.toLocaleString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: DEFAULT_TIMEZONE
    });
    // location name
    container.querySelector('.info-location-name').textContent = locationInfo.name;
    // activity
    container.querySelector('.info-activity').textContent = locationInfo.activity;
    // ref
    let ref = locationInfo.ref;
    let refAnchor = container.querySelector('.info-ref');
    refAnchor.href = ref.url;
    refAnchor.textContent = ref.source;
};

let resolvePlace = function (service, locationName, callback) {
    let request = {
        query: locationName,
        fields: ['photos', 'name', 'geometry']
    }
    service.findPlaceFromQuery(request, function (results, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
            if (results.length > 0) {
                let place = results[0];
                callback(null, place);
            } else {
                console.warn('Got zero results back');
            }
        } else {
            console.warn('find place from query status not ok', status);
        }
    });
};

var initmap = function () {
    if (typeof google === 'undefined' || !google.maps) {
        console.warn('No google');
        return;
    }
    let mapElement = document.getElementById('map');
    let ps = new google.maps.places.PlacesService(mapElement);
    resolvePlace(ps, locationInfo.name, function (error, place) {
        let map = new google.maps.Map(mapElement, {
            center: place.geometry.location,
            zoom: 8
        });
        let marker = new google.maps.Marker({
            position: place.geometry.location,
            map: map
        });
        let infoContainer = document.getElementById('info-content');
        fillInfoContainer(infoContainer, locationInfo, place);
        infoContainer.hidden = false;
        let infoWindow = new google.maps.InfoWindow({
            content: infoContainer
        });
        infoWindow.open(map, marker);
        let footerDiv = document.getElementById('footer');
        footerDiv.hidden = false;
        footerDiv.index = 1;
        map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(footerDiv);
    });
};
