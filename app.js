var fs = require('fs');
var gm = require('gm');
var opn = require('opn');
var express = require('express');
var app = express();
var path = require('path');

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
  gm(path.join(require('./config.json').IMAGES_PATH + req.params.filename))
    .resize(width)
    .stream('jpeg')
    .pipe(res);
});

app.listen(8080);

opn('http://localhost:8080');
