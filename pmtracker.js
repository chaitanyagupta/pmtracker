'use strict';

let apiKey = 'AIzaSyAxxmf1EGaVzxC_AZPkN0Mg_2vWRyJybtM';

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
    return "en-IN";
};

let fillInfoContainer = function (container, locationInfo) {
    let locale = resolveLocale();
    // date
    let date = new Date(locationInfo.date);
    let dateElement = container.querySelector('.info-date');
    dateElement.dateTime = locationInfo.date;
    dateElement.textContent = date.toLocaleString(locale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
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

var initmap = function () {
    if (!locationInfo.coords) {
        console.warn('No coordinates');
        return;
    }
    if (typeof google === 'undefined' || !google.maps) {
        console.warn('No google');
        return;
    }
    let map = new google.maps.Map(document.getElementById('map'), {
        center: locationInfo.coords,
        zoom: 8
    });
    let marker = new google.maps.Marker({ position: locationInfo.coords, map: map });
    let infoContainer = document.getElementById('info-content');
    fillInfoContainer(infoContainer, locationInfo);
    infoContainer.hidden = false;
    let infoWindow = new google.maps.InfoWindow({
        content: infoContainer
    });
    infoWindow.open(map, marker);
};

if (!locationInfo.coords) {
    geocode(locationInfo.name, function (error, response) {
        if (error) {
            console.warn('Couldn\'t get coords for location:', locationInfo.name);
        } else {
            locationInfo.coords = response.results[0].geometry.location;
            initmap();
        }
    });
}
