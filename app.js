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

app.get('/', (req, res) => {
  res.render('index', {GOOGLE_API_KEY: require('./config.json').GOOGLE_API_KEY});
})

app.get('/convert/:filename', (req, res) => {
  let width = 512;
  if (req.query.width > 0) {
    width = req.query.width;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  const imagePath = path.join(require('./config.json').IMAGES_PATH, req.params.filename);
  const tempImagePath = path.join(__dirname, req.params.filename + '_' + Date.now() + '.jpg');
  const errorCallback = () => {
    gm(imagePath)
      .resize(width)
      .write(tempImagePath, () => {
        maybeCopyExifGPS(imagePath, tempImagePath, () => {
          const stream = fs.createReadStream(tempImagePath);
          stream.pipe(res);
          stream.on('end', () => {
            fs.unlinkSync(tempImagePath);
            if (fs.existsSync(tempImagePath + '_original')) {
              fs.unlinkSync(tempImagePath + '_original');
            }
          });
        });
      });
  };
  exiftool
    .read(imagePath)
    .then((tags) => {
      if (!tags.hasOwnProperty('PreviewImage')) {
        return errorCallback();
      }
      exiftool
        .extractPreview(imagePath, tempImagePath)
        .then(() => {
          gm(tempImagePath)
            .resize(width)
            .write(tempImagePath, () => {
              maybeCopyExifGPS(imagePath, tempImagePath, () => {
                const stream = fs.createReadStream(tempImagePath);
                stream.pipe(res);
                stream.on('end', () => {
                  fs.unlinkSync(tempImagePath);
                  if (fs.existsSync(tempImagePath + '_original')) {
                    fs.unlinkSync(tempImagePath + '_original');
                  }
                });
              });
            });
        })
        .catch(errorCallback);
    });
});

app.post('/setexif/:filename', (req, res) => {
  if (req.body) {
    setLatLngFile(req.params.filename, req.body.lat, req.body.lng);
  }
});

app.listen(8080);

opn('http://localhost:8080');

function setLatLngFile(filename, lat, lng) {
  const imagePath = path.join(require('./config.json').IMAGES_PATH, filename);
  let latRef = 'North';
  if (lat < 0) {
    lat = Math.abs(lat);
    latRef = 'South';
  }
  let lngRef = 'East';
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

function maybeCopyExifGPS(origFile, newFile, callback) {
  exiftool
    .read(origFile)
    .then((tags) => {
      if (!tags.hasOwnProperty('GPSLatitude')
        || !tags.hasOwnProperty('GPSLatitudeRef')
        || !tags.hasOwnProperty('GPSLongitude')
        || !tags.hasOwnProperty('GPSLongitudeRef')) {
        return callback();
      }
      exiftool
        .write(
          newFile,
          {
            GPSLatitude: tags.GPSLatitude,
            GPSLatitudeRef: tags.GPSLatitudeRef,
            GPSLongitude: tags.GPSLongitude,
            GPSLongitudeRef: tags.GPSLongitudeRef
          })
        .then(callback)
        .catch(callback);
    })
    .catch(callback);
}
