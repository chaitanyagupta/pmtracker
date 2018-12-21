'use strict';

let places = require('./places');
let yaml = require('node-yaml');

let removeDuplicates = function (array) {
    let uniques = [];
    array.forEach(function (x) {
        if (uniques.indexOf(x) === -1) {
            uniques.push(x);
        }
    });
    return uniques;
};

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
        this.tasks[next].call(this, next);
    }
};

const QUEUE_LIMIT = 1;
const PLACE_FIELDS = ['photos', 'name', 'geometry'];

let getPlaces = exports.getPlaces = function (locations, callback) {
    let tq = new TaskQueue(QUEUE_LIMIT);
    let result = {};
    locations = removeDuplicates(locations);
    let count = locations.length;
    // queue location lookup
    locations.forEach(function (location) {
        tq.add(function (taskId) {
            places.resolvePlace(location, PLACE_FIELDS)
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
                        callback(result);
                    }
                });
        });
    });
};

exports.gen = function (input, output) {
    let str = fs.readFileSync(input, {encoding: 'utf8'});
    let activities = yaml.parse(str, {schema: yaml.schema.defaultSafe});
    let locations = activities.map(function (activity) {
        return activity.location;
    });
    getPlaces(locations, function (data) {
        fs.writeFileSync(output, JSON.stringify(data));
        console.log('Updated', output);
    });
};
