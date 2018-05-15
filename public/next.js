var files = [];
var currentFile = -1;
function readURL(input) {
  files = input.files;
  next();
}
function next() {
  var basePath = 'http://localhost:8080/convert/';
  if (currentFile < files.length - 1) {
    currentFile++;
    document.getElementById("current").src =
      basePath + files[currentFile].name + '?width=' + parseInt(screen.width/2);
    for (var i = 1; i <= 5; i++) {
      if (currentFile + i < files.length) {
        document.getElementById("next"+i).src =
          basePath + files[currentFile + i].name + '?width=' + parseInt(screen.width/2);
      } else {
        break;
      }
    }

  } else {
    alert('no more photos');
  }
}
