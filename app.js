const bodyParser = require('body-parser')
const express = require('express');
const fs = require('fs');
const gm = require('gm');
const opn = require('opn');
const path = require('path');
const { ExifTool } = require("exiftool-vendored");

const exiftool = new ExifTool();
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('views', './views');
app.set('view engine', 'pug');

app.get('/', function (req, res) {
  res.render('index', {GOOGLE_API_KEY: require('./config.json').GOOGLE_API_KEY});
})

app.get('/convert/:filename', function(req, res) {
  var width = 512;
  if (req.query.width > 0) {
    width = req.query.width;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  gm(path.join(require('./config.json').IMAGES_PATH, req.params.filename))
    .resize(width)
    .stream('jpeg')
    .pipe(res);
});

app.post('/setexif/:filename', function(req, res) {
  if (req.body) {
    setLatLngFile(req.params.filename, req.body.lat, req.body.lng);
  }
});

app.listen(8080);

opn('http://localhost:8080');

function setLatLngFile(filename, lat, lng) {
  var imagePath = path.join(require('./config.json').IMAGES_PATH, filename);
  var latRef = 'North';
  if (lat < 0) {
    lat = Math.abs(lat);
    latRef = 'South';
  }
  var lngRef = 'East';
  if (lng < 0) {
    lng = Math.abs(lng);
    lngRef = 'West';
  }
  exiftool.write(
    imagePath,
    {
      GPSLatitude: lat,
      GPSLatitudeRef: latRef,
      GPSLongitude: lng,
      GPSLongitudeRef: lngRef
    }
  );
}
