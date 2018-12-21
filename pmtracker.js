'use strict';

let DEFAULT_LOCALE = 'en-IN';
let DEFAULT_TIMEZONE = 'Asia/Kolkata';

let API_KEY = 'AIzaSyAxxmf1EGaVzxC_AZPkN0Mg_2vWRyJybtM';

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
        key: API_KEY
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

let humanizeDate = function (date, today, expandToday) {
    let locale = resolveLocale();
    let dateOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: DEFAULT_TIMEZONE
    };
    if (today === date) {
        if (expandToday) {
            return 'Today (' + (new Date(date)).toLocaleString(locale, dateOptions) + ')';
        } else {
            return 'Today';
        }
    } else {
        return (new Date(date)).toLocaleString(locale, dateOptions);
    }
};

let humanizeDateRange = function (range, today) {
    if (range.start === range.end) {
        return [humanizeDate(range.start, today, true)];
    } else {
        return [humanizeDate(range.start, today, false), humanizeDate(range.end, today, false)];
    }
};

// places

let resolvePlace = function (locationName, callback) {
    setTimeout(function () {
        let place = allPlaces[locationName];
        if (place) {
            callback(null, place);
        } else {
            callback(new Error("Couldn't find place: " + locationName));
        }
    });
};

const PHOTOS_API_URL = 'https://maps.googleapis.com/maps/api/place/photo';

let getPhotoUrl = function (photo, maxWidth, maxHeight) {
    return PHOTOS_API_URL + '?' + QS.stringify({
        key: API_KEY,
        photoreference: photo.photo_reference,
        maxwidth: maxWidth,
        maxheight: maxHeight
    });
};

let fillInfoContainer = function (container, activity, place) {
    let today = ISODateString(new Date());
    // headline
    let todayRange = makerange(today, today);
    if (activity.range.contains(today)) {
        container.querySelector('.info-headline.today').hidden = false;
    } else if (activity.range.lessThan(todayRange)) {
        container.querySelector('.info-headline.past').hidden = false;
    } else if (activity.range.greaterThan(todayRange)) {
        container.querySelector('.info-headline.future').hidden = false;
    }
    // image
    if (place.photos && place.photos.length > 0) {
        container.querySelector('.info-photo-container').hidden = false;
        let img = container.querySelector('.info-photo');
        let photo = place.photos[getRandomInt(place.photos.length)];
        img.src = getPhotoUrl(photo, 80, 80);
    }
    // date
    let humanizedDateRange = humanizeDateRange(activity.range, today);
    if (humanizedDateRange.length == 2) {
        container.querySelector('.info-date-range').hidden = false;
        container.querySelector('.info-date-start').textContent = humanizedDateRange[0];
        container.querySelector('.info-date-end').textContent = humanizedDateRange[1];
    } else {
        container.querySelector('.info-date-single').hidden = false;
        container.querySelector('.info-date').textContent = humanizedDateRange[0];
    }
    // location name
    container.querySelector('.info-location-name').textContent = activity.location;
    // events
    if (activity.events) {
        let eventElement = container.querySelector('.info-event');
        activity.events.forEach(function (event) {
            let element = eventElement.cloneNode(true);
            element.querySelector('.info-event-description').textContent = event.description;
            let anchor = element.querySelector('.info-event-source');
            anchor.title = event.source;
            anchor.href = event.url;
            eventElement.parentNode.appendChild(element);
        });
        eventElement.remove();
    } else {
        container.querySelector('.info-events').hidden = true;
        if (activity.location === capital) {
            container.querySelector('.info-no-events.capital').hidden = false;
        } else {
            container.querySelector('.info-no-events.non-capital').hidden = false;
        }
    }
};

let makerange = function (start, end) {
    if (end < start) {
        throw new Error('End of range cannot be less than start', start, end);
    }
    return { 
        start: start,
        end: end,
        equal: function (that) {
            return this.start === that.start && this.end === that.end;            
        },
        lessThan: function (that) {
            return this.end < that.start;
        },
        greaterThan: function (that) {
            return this.start > that.end;
        },
        overlaps: function (that) {
            return this.start <= that.end && this.end >= that.start;
        },
        contains: function (value) {
            return this.start <= value && this.end >= value;
        }
    };
};

let MSEC_PER_DAY = 86400000;

let parseDateRange = function (query) {
    query = query || QS.parse(window.location.search);
    let now = new Date();
    let today = ISODateString(now);
    if (query.start) {
        if (query.start.match(/^[0-9]+d/)) {
            let days = parseInt(query.start.match(/^[0-9]+/));
            let start = ISODateString(new Date(now - ((days - 1) * MSEC_PER_DAY)));
            return makerange(start, today);
        } else if (query.start === 'today') {
            return makerange(today, today);
        }
    } else {
        // Default to 7 days
        return parseDateRange({ start: '7d' });
    }
};

let filterActivities = function (activities, range) {
    let today = ISODateString(new Date());
    let filtered = [];
    for (var i = activities.length - 1; i >= 0; --i) {
        let activity = activities[i];
        var datepair = activity.date.split('..');
        if (datepair.length === 1) {
            activity.range = makerange(datepair[0], datepair[0]);
        } else if (datepair.length === 2) {
            if (datepair[1] === '') {
                activity.range = makerange(datepair[0], today);
            } else {
                activity.range = makerange(datepair[0], datepair[1]);
            }
        }
        if (!activity.range) {
            throw new Error('No arange for activity', activity);
        }
        if (activity.range.greaterThan(range)) {
            continue;
        } else if (activity.range.lessThan(range)) {
            break;
        } else {
            filtered.push(activity);
        }
    }
    return filtered.reverse();
};

let selectedActivities = function () {
    return filterActivities(allActivities, parseDateRange());
};

let closeInfoWindow = function (infoWindow) {
    infoWindow.close();
};

let displayInfo = function (map, activity, place, marker, current) {
    if (current) { 
        closeInfoWindow(current);
    }
    let infoContainer = document.getElementById('info-content').cloneNode(true);
    fillInfoContainer(infoContainer, activity, place);
    infoContainer.hidden = false;
    let infoWindow = new google.maps.InfoWindow({
        content: infoContainer
    });
    infoWindow.open(map, marker);
    return infoWindow;
};

const BLUE_MARKER_ICON = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
const RED_MARKER_ICON = 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';

let displayActivities = function (context) {
    let activities = selectedActivities();
    let lastActivity = activities[activities.length - 1];
    let today = ISODateString(new Date());
    activities.forEach(function (activity) {
        resolvePlace(activity.location, function (error, place) {
            let marker = new google.maps.Marker({
                position: place.geometry.location,
                map: context.map,
                title: activity.location,
                opacity: (activity.range.contains(today) ? 1.0 : 0.5),

            });
            marker.addListener('click', function () {
                context.infoWindow = displayInfo(context.map, activity, place, marker, context.infoWindow);
            });
            if (activity === lastActivity && activity.range.contains(today)) {
                context.infoWindow = displayInfo(context.map, activity, place, marker, context.infoWindow);
            }
        });
    });
    if (!activities.some(function (activity) { return activity.range.contains(today); })) {
        let todayWarning = document.getElementById('today-warning');
        todayWarning.hidden = false;
        context.map.controls[google.maps.ControlPosition.CENTER].push(todayWarning);
    }
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
        document.querySelectorAll('.dismissable-control').forEach(function (control) {
            control.remove();
        });
    });
};

document.querySelectorAll('input[name=start]').forEach(function (input) {
    let pageRange = parseDateRange();
    let inputRange = parseDateRange({ start: input.value });
    if (inputRange.equal(pageRange)) {
        input.checked = true;
    }
    input.addEventListener('change', function () {
        input.form.submit();
    });
});

document.querySelectorAll('.closer').forEach(function (button) {
    button.addEventListener('click', function () {
        button.parentNode.remove();
    });
});
