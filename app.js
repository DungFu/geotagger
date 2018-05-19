const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const uuidv4 = require('uuid/v4');
const im = require("imagemagick-darwin-binaries");
const gm = require('gm').subClass({
  imageMagick: true,
  appPath: path.join(im.path, "/")
});
const opn = require('opn');
const { ExifTool } = require('exiftool-vendored');

const Store = require('./store.js');

const store = new Store({
  // We'll call our data file 'user-preferences'
  configName: 'geotagger-user-preferences',
  defaults: {
    // 800x600 is the default size of our window
    windowBounds: { width: 800, height: 600 }
  }
});

const exiftool = new ExifTool();
const expressApp = express();

expressApp.use(bodyParser.urlencoded({ extended: true }));
expressApp.use(bodyParser.json());

const electron = require('electron');
// Module to control application life.
const app = electron.app;
const dialog = electron.dialog;

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const pug = require('yet-another-electron-pug');

pug({pretty: true}, (file, cb) => {
  if (!store.get('googleAPIKey')) {
    const userPrompt = require('electron-osx-prompt');
    const icon = __dirname + '/geotagger.png';
    userPrompt('Google API Key', 'The app needs a Google API Key to function, please type one now. You can get one at: https://cloud.google.com/console/google/maps-apis/overview', icon)
      .then(input => {
        if (input) {
          store.set('googleAPIKey', input);
          cb({GOOGLE_API_KEY: input});
        } else {
          app.quit();
        }
      })
      .catch(err => {
        app.quit();
      });
  } else {
    cb({GOOGLE_API_KEY: store.get('googleAPIKey')});
  }
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow(store.get('windowBounds'));

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/views/index.pug`);

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  mainWindow.on('resize', () => {
    // The event doesn't pass us the window size, so we call the `getBounds` method which returns an object with
    // the height, width, and x and y coordinates.
    let { width, height } = mainWindow.getBounds();
    // Now that we have them, save them using the `set` method.
    store.set('windowBounds', { width, height });
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

expressApp.get('/convert', (req, res) => {
  let width = 512;
  if (req.query.width > 0) {
    width = req.query.width;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  const imagePath = req.query.path;
  const tempFolderPath = path.join(__dirname, 'temp', uuidv4());
  fse.ensureDirSync(tempFolderPath);
  const tempImagePath = path.join(tempFolderPath, req.query.name + '.jpg');
  const errorCallback = () => {
    gm(imagePath)
      .resize(width)
      .write(tempImagePath, (err) => {
        if (err) {
          dialog.showMessageBox({type: 'error', 'message': err.toString()});
          fse.removeSync(tempFolderPath);
          return;
        }
        maybeCopyExifGPS(imagePath, tempImagePath, () => {
          const stream = fs.createReadStream(tempImagePath);
          stream.pipe(res);
          stream.on('end', () => {
            fse.removeSync(tempFolderPath);
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
            .write(tempImagePath, (err) => {
              if (err) {
                dialog.showMessageBox({type: 'error', 'message': err.toString()});
                fse.removeSync(tempFolderPath);
                return;
              }
              maybeCopyExifGPS(imagePath, tempImagePath, () => {
                const stream = fs.createReadStream(tempImagePath);
                stream.pipe(res);
                stream.on('end', () => {
                  fse.removeSync(tempFolderPath);
                });
              });
            });
        })
        .catch(errorCallback);
    });
});

expressApp.post('/setexif', (req, res) => {
  if (req.body) {
    setLatLngFile(req.query.path, req.body.lat, req.body.lng);
  }
});

expressApp.listen(8080);

function setLatLngFile(imagePath, lat, lng) {
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
