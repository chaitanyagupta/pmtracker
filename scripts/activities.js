'use strict';

let Airtable = require('airtable');

let API_KEY = null;

exports.setKey = function (key) {
    API_KEY = key;
};

exports.getActivities = function () {
    return new Promise(function (resolve, reject) {
        let base = new Airtable({apiKey: API_KEY}).base('apphjssmlhO23RQvH');
        let result = [];
        base('Activities').select({
            // TODO: future-proof this
            maxRecords: 500,
            view: 'Grid view',
            sort: [{field: 'date'}, {field: 'location'}]
        }).eachPage(function (records, fetchNextPage) {
            // This function (`page`) will get called for each page of records.

            records.forEach(function(record) {
                //console.log('Retrieved', record.get('date'), record.get('location'), record.get('event'));
                let current = {
                    date: record.get('date'),
                    location: record.get('location'),
                    events: [{
                        description: record.get('event') || null,
                        source: record.get('source') || null,
                        url: record.get('url') || null
                    }]
                };
                let last = result[result.length - 1] || null;
                if (!last || last.date !== current.date || last.location !== current.location) {
                    result.push(current);
                } else {
                    last.events = last.events.concat(current.events);
                }
            });

            // To fetch the next page of records, call `fetchNextPage`.
            // If there are more records, `page` will get called again.
            // If there are no more records, `done` will get called.
            fetchNextPage();

        }, function (err) {
            if (err) { 
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};
