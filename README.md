# PM Tracker

PM Tracker helps you keep track of what our Prime Minister has been upto in
recent times. It is available at https://pmtracker.in

## Building

PM Tracker is a static website created using [Jekyll][]. Before running `jekyll
build` though, we need to fetch the activity data from [Airtable], and generate
metadata for places (lat-long, photo, etc.) from [Google Places API][].

This requires node.js v10 or later.

First install the dependencies using `npm`.

```sh
npm install
```

To get the activity data from Airtable, use the following link to get read-only
access to the activity data (you will need to sign up):

https://airtable.com/invite/l?inviteId=invPa5ltpLBUVzPK0&inviteToken=d252e6638fcd200a2bf3324657b235f91f79e055ab9954e98e1a0e1f8dce6f34

Once you have read-only access to the PM Tracker workspace, get your Airtable
API key and set the environment variable `ACTIVITIES_API_KEY`.

```sh
export ACTIVITIES_API_KEY=<Airtable API key>
```

You also need an API key for Google Places API. Create it on [Google Cloud
Platform][] and set the environment variable `PLACES_API_KEY`.

```sh
export PLACES_API_KEY=<Places API key>
```

After this, you are ready to run the data generation script which will

1. Fetch the activity data from Airtable
2. Fetch the place data vi Google Places API
3. Fetch place photos via Google Places API

```sh
node scripts/gen
```

Once this script runs successfully, you can run Jekyll.

(Install it via bundler, if you don't have it already)

```sh
bundle install
bundle exec jekyll serve  # for local development
bundle exec jekyll build  # production build
```

[Jekyll]: https://jekyllrb.com
[Airtable]: https://airtable.com
[Google Places API]: https://developers.google.com/places/web-service/intro
[Google Cloud Platform]: https://console.cloud.google.com/apis/credentials
