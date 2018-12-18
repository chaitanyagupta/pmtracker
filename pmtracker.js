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

let ISODateString = function (date) {
    let USDateString = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: DEFAULT_TIMEZONE
    });
    let parts = USDateString.split('/');
    return [parts[2], parts[0], parts[1]].join('-');
};

let fillInfoContainer = function (container, activity, place) {
    let locale = resolveLocale();
    let today = ISODateString(new Date());
    // headline
    container.querySelector('.info-headline.today').hidden = (today !== activity.date);
    container.querySelector('.info-headline.past').hidden = (today === activity.date);
    // image
    if (place.photos && place.photos.length > 0) {
        container.querySelector('.info-photo-container').hidden = false;
        let img = container.querySelector('.info-photo');
        let photo = place.photos[getRandomInt(place.photos.length)];
        img.src = photo.getUrl({ maxWidth: 100, maxHeight: 100 });
    }
    // date
    let dateElement = container.querySelector('.info-date');
    dateElement.dateTime = activity.date;
    let dateOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: DEFAULT_TIMEZONE
    };
    if (today === activity.date) {
        dateElement.textContent = 'Today (' + (new Date(activity.date)).toLocaleString(locale, dateOptions) + ')';
    } else {
        dateOptions.weekday = 'long';
        dateElement.textContent = (new Date(activity.date)).toLocaleString(locale, dateOptions);
    }
    // location name
    container.querySelector('.info-location-name').textContent = activity.location;
    // activity
    container.querySelector('.info-activity').textContent = activity.description;
    // ref
    let ref = activity.ref;
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

let bounds = function (start, end) {
    return [start, end];
};

let startBounds = function (bounds) { return bounds[0]; };
let endBounds = function (bounds) { return bounds[1]; };

let equalBounds = function (b1, b2) {
    return startBounds(b1) === startBounds(b2) && endBounds(b1) === endBounds(b2);
};

let parseDateBounds = function (query) {
    query = query || QS.parse(window.location.search);
    let now = new Date();
    let today = ISODateString(now);
    if (query.start) {
        if (query.start.match(/^[0-9]+d/)) {
            let days = parseInt(query.start.match(/^[0-9]+/));
            let start = ISODateString(new Date(now - ((days - 1) * MSEC_PER_DAY)));
            return bounds(start, today);
        } else if (query.start === 'today') {
            return bounds(today, today);
        }
    } else {
        // Return today for unrecognized strings
        return bounds(today, today);
    }
};

let MSEC_PER_DAY = 86400000;

let filterActivities = function (bounds) {
    return allActivities.filter(function (activity) {
        return activity.date >= startBounds(bounds) && activity.date <= endBounds(bounds);
    });
};

let selectedActivities = function () {
    let activities = filterActivities(parseDateBounds());
    if (activities.length > 0) {
        return activities;
    } else {
        return [allActivities[allActivities.length - 1]];
    }
};

let closeInfoWindow = function (infoWindow) {
    infoWindow.close();
    infoWindow.content.hidden = true;
    document.body.appendChild(infoWindow.content);
};

let displayInfo = function (map, activity, place, marker, current) {
    if (current) { 
        closeInfoWindow(current);
    }
    let infoContainer = document.getElementById('info-content');
    fillInfoContainer(infoContainer, activity, place);
    infoContainer.hidden = false;
    let infoWindow = new google.maps.InfoWindow({
        content: infoContainer
    });
    infoWindow.open(map, marker);
    return infoWindow;
};

let displayActivities = function (context) {
    let activities = selectedActivities();
    let lastActivity = activities[activities.length - 1];
    let today = ISODateString(new Date());
    activities.forEach(function (activity) {
        resolvePlace(context.ps, activity.location, function (error, place) {
            let marker = new google.maps.Marker({
                position: place.geometry.location,
                map: context.map,
                title: activity.location,
                opacity: (activity.date === today ? 1.0 : 0.5)
            });
            marker.addListener('click', function () {
                context.infoWindow = displayInfo(context.map, activity, place, marker, context.infoWindow);
            });
            if (activity === lastActivity) {
                context.infoWindow = displayInfo(context.map, activity, place, marker, context.infoWindow);
            }
        });
    });
};

var initmap = function () {
    if (typeof google === 'undefined' || !google.maps) {
        console.warn('No google');
        return;
    }
    let mapElement = document.getElementById('map');
    let map = new google.maps.Map(mapElement, {
        center: { lat: 28.61, lng: 77.20 },
        zoom: 5,
        fullscreenControl: false
    });
    let ps = new google.maps.places.PlacesService(map);
    let context = { map: map, ps: ps, infoWindow: null };
    displayActivities(context);
    let tpControlsDiv = document.getElementById('time-period-controls');
    tpControlsDiv.hidden = false;
    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(tpControlsDiv);
    let footerDiv = document.getElementById('footer');
    footerDiv.hidden = false;
    map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(footerDiv);
    map.addListener('click', function () {
        if (context.infoWindow) {
            closeInfoWindow(context.infoWindow);
        }
    });
};

document.querySelectorAll('input[name=start]').forEach(function (input) {
    let pageBounds = parseDateBounds();
    let inputBounds = parseDateBounds({ start: input.value });
    if (equalBounds(inputBounds, pageBounds)) {
        input.checked = true;
    }
    input.addEventListener('change', function () {
        input.form.submit();
    });
});
