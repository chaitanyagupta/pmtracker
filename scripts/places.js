'use strict';

let axios = require('axios');

const API_KEY = 'AIzaSyAxxmf1EGaVzxC_AZPkN0Mg_2vWRyJybtM';
const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const LOCATION_BIAS_POINT = { lat: 21.15, lng: 79.09 }; // Nagpur
const LOCATION_BIAS_RADIUS = 2000 * 1000; // 2000 km

exports.resolvePlace = function (text, fields) {
    return axios.get(PLACES_API_URL, {
        params: {
            key: API_KEY,
            input: text,
            inputtype: 'textquery',
            fields: fields.join(','),
            locationbias: util.format('circle:%s@%s,%s', LOCATION_BIAS_RADIUS, LOCATION_BIAS_POINT.lat, LOCATION_BIAS_POINT.lng)
        }
    })
        .then(function (response) {
            return response.data;
        });
};

const PHOTOS_API_URL = 'https://maps.googleapis.com/maps/api/place/photo';

exports.resolvePhoto = function (reference, maxwidth) {
    return axios.get(PHOTOS_API_URL, {
        params: {
            key: API_KEY,
            photoreference: reference,
            maxwidth: maxwidth
        }
    }).then(function (response) {
        return response.data;
    });
};
