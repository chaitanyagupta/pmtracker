'use strict';

let fs = require('fs');
let util = require('util');
let activityService = require('./activities');
let placeService = require('./places');
let yaml = require('node-yaml');

// utils

let removeDuplicates = function (array) {
    let uniques = [];
    array.forEach(function (x) {
        if (uniques.indexOf(x) === -1) {
            uniques.push(x);
        }
    });
    return uniques;
};

// task queue

function TaskQueue (limit) {
    this.counter = 0;
    this.limit = limit;
    this.queued = [];
    this.active = [];
    this.tasks = {};
}

TaskQueue.prototype.add = function (fn) {
    let id = ++this.counter;
    this.tasks[id] = fn;
    this.queued.push(id);
    this.resume();
    return id;
};

let removeFromArray = function (x, array) {
    let index = array.indexOf(x);
    if (index != -1) {
        array.splice(index, 1);
    }
};

TaskQueue.prototype.remove = function (id) {
    removeFromArray(id, this.active);
    removeFromArray(id, this.queued);
    delete this.tasks[id];
    this.resume();
};

TaskQueue.prototype.resume = function () {
    while (this.active.length < this.limit && this.queued.length > 0) {
        let next = this.queued.shift();
        this.active.push(next);
        setImmediate(() => {
            this.tasks[next].call(this, next);
        });
    }
};

// activities

let setActivitiesKey = exports.setActivitiesKey = function (key) {
    activityService.setKey(key);
};

let genActivities = exports.genActivities = function (output) {
    return activityService.getActivities()
        .then(function (activities) {
            fs.writeFileSync(output, JSON.stringify(activities, null, 4));
            console.log('Wrote activities');
            return activities;
        });
};

// places

const QUEUE_LIMIT = 1;
const PLACE_FIELDS = ['photos', 'name', 'geometry'];

let getPlaces = exports.getPlaces = function (locations) {
    return new Promise(function (resolve, reject) {
        let tq = new TaskQueue(QUEUE_LIMIT);
        let result = {};
        locations = removeDuplicates(locations);
        let count = locations.length;
        // queue location lookup
        locations.forEach(function (location) {
            tq.add(function (taskId) {
                placeService.resolvePlace(location, PLACE_FIELDS)
                    .then(function (data) {
                        if (data.status === 'OK') {
                            result[location] = data.candidates[0];
                        } else {
                            throw new Error("Couldn't resolve place for location: " + location + " status: " + data.status);
                        }
                    })
                    .finally(function () {
                        --count;
                        tq.remove(taskId);
                        if (count === 0) {
                            resolve(result);
                        }
                    });
            });
        });
    });
};

const PHOTO_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png'
};

const MAX_PHOTO_WIDTH = 80;

let writePhotos = exports.writePhotos = function (places, directory) {
    return new Promise(function (resolve, reject) {
        let tq = new TaskQueue(QUEUE_LIMIT);
        let count = 0;
        places.forEach(function (place) {
            place.photos.forEach(function (photo) {
                let ref = photo.photo_reference;
                let photoPath = function (extension) {
                    return directory + ref + '.' + extension;
                }
                let photoExists = function (extension) { 
                    return fs.existsSync(photoPath(extension));
                }
                let extensions = Object.values(PHOTO_TYPES);
                if (!extensions.some(photoExists)) {
                    ++count;
                    tq.add(function (taskId) {
                        console.log('Writing photo for: ' + place.name + ' ref: ' + ref);
                        placeService.resolvePhoto(ref, MAX_PHOTO_WIDTH)
                            .then(function (response) {
                                let type = response.headers['content-type'];
                                console.log('wrote photo with type: ' + type);
                                let extension = PHOTO_TYPES[type];
                                if (extension) {
                                    fs.writeFileSync(photoPath(extension), response.data);
                                    photo.extension = extension;
                                } else {
                                    throw new Error('Unknown image type: ' + type);
                                }
                            })
                            .catch(function (error) {
                                console.warn('Error writing photo: ' + error);
                            })
                            .finally(function () {
                                tq.remove(taskId);
                                --count;
                                if (count === 0) {
                                    resolve(true);
                                }
                            });
                    });
                }
            });
        });
    });
};

let genPlaces = exports.genPlaces = function (input, output, photosDirectory) {
    let activities = null;
    if (typeof input === 'object') {
        activities = input;
    } else {
        let str = fs.readFileSync(input, {encoding: 'utf8'});
        activities = yaml.parse(str, {schema: yaml.schema.defaultSafe});
    }
    let locations = activities.map(function (activity) {
        return activity.location;
    });
    getPlaces(locations).then(function (placeDictionary) {
        console.log('Fetched all places');
        return placeDictionary
    }).then(function (placeDictionary) {
        let places = Object.values(placeDictionary);
        if (!fs.existsSync(photosDirectory)) {
            fs.mkdirSync(photosDirectory);
        }
        writePhotos(places, photosDirectory)
            .then(function (status) {
                console.log('Wrote all photos');
                fs.writeFileSync(output, JSON.stringify(placeDictionary, null, 4));
                console.log('Updated all places', output);
            });
    });
};

let setPlacesKey = exports.setPlacesKey = function (key) {
    placeService.setKey(key);
};

if (require.main === module) {
    setActivitiesKey(process.env['ACTIVITIES_API_KEY']);
    setPlacesKey(process.env['PLACES_API_KEY']);
    genActivities('./_data/activities.json')
        .then(function (activities) {
            genPlaces(activities, './_data/places.json', './place_photos/');
        });
}
