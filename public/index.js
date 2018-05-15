var map = null;
var searchBox = null;
var markers = [];
var loading = false;

function initAutocomplete() {
  document.getElementById("current").src = 'http://via.placeholder.com/' + parseInt(window.innerWidth / 2.0) + 'x' + parseInt(window.innerWidth * 3.0 / 8.0);

  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: -33.8688, lng: 151.2195},
    zoom: 16,
    mapTypeId: 'roadmap',
    keyboardShortcuts: false
  });

  // Create the search box and link it to the UI element.
  var input = document.getElementById('search-input');
  searchBox = new google.maps.places.SearchBox(input);
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

  // Bias the SearchBox results towards current map's viewport.
  map.addListener('bounds_changed', function() {
    searchBox.setBounds(map.getBounds());
  });

  map.addListener('click', function(e) {
    document.getElementById("lat").value = e.latLng.lat();
    document.getElementById("lng").value = e.latLng.lng();
  });

  // Listen for the event fired when the user selects a prediction and retrieve
  // more details for that place.
  searchBox.addListener('places_changed', function() {
    var places = searchBox.getPlaces();

    if (places.length == 0) {
      return;
    }

    // Clear out the old markers.
    markers.forEach(function(marker) {
      marker.setMap(null);
    });
    markers = [];

    // For each place, get the icon, name and location.
    var bounds = new google.maps.LatLngBounds();
    places.forEach(function(place) {
      if (!place.geometry) {
        console.log("Returned place contains no geometry");
        return;
      }
      var icon = {
        url: place.icon,
        size: new google.maps.Size(71, 71),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(17, 34),
        scaledSize: new google.maps.Size(25, 25)
      };

      // Create a marker for each place.
      markers.push(new google.maps.Marker({
        map: map,
        icon: icon,
        title: place.name,
        position: place.geometry.location
      }));

      if (place.geometry.viewport) {
        // Only geocodes have viewport.
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });
    map.fitBounds(bounds);
  });
}

var files = [];
var currentFile = -1;
function readURL(input) {
  files = input.files;
  currentFile = -1;
  loading = false;
  next();
}

function next() {
  if (loading) {
    return;
  }
  var form = document.getElementById("exifForm");
  if (currentFile >= 0 && currentFile < files.length) {
    form.action = '/setexif/' + files[currentFile].name;
    form.submit();
  }
  if (currentFile < files.length - 1) {
    currentFile++;
    document.getElementById("current").src = getRemotePathForFile(currentFile, false);
    for (var i = 1; i <= 5; i++) {
      if (currentFile + i < files.length) {
        document.getElementById("next"+i).src = getRemotePathForFile(currentFile + i, false);
      } else {
        break;
      }
    }
    document.getElementById("progress").innerHTML = currentFile + 1 + '/' + files.length;
    updateLoadingState(true);
  } else {
    alert('no more photos');
  }
}

function prev() {
  if (loading) {
    return;
  }
  if (currentFile > 0) {
    currentFile--;
    document.getElementById("current").src = getRemotePathForFile(currentFile, true);
    for (var i = 1; i <= 5; i++) {
      if (currentFile + i < files.length) {
        document.getElementById("next"+i).src = getRemotePathForFile(currentFile + i, false);
      } else {
        break;
      }
    }
    document.getElementById("progress").innerHTML = currentFile + 1 + '/' + files.length;
    updateLoadingState(true);
  } else {
    alert('no more photos');
  }
}

function getRemotePathForFile(fileIndex, clearPrevious) {
  var basePath = 'http://localhost:8080/convert/';
  if (clearPrevious && files[fileIndex].hasOwnProperty('remotePath')) {
    delete files[fileIndex].remotePath;
  }
  if (!files[fileIndex].hasOwnProperty('remotePath')) {
    files[fileIndex].remotePath =
      basePath +
      files[fileIndex].name +
      '?width=' +
      parseInt(window.innerWidth/2) +
      '&timestamp=' +
      Date.now();
  }
  return files[fileIndex].remotePath;
}

function currentLoaded(image) {
  image.exifdata = null;
  EXIF.getData(image, function() {
    var lat = EXIF.getTag(this, "GPSLatitude");
    var latRef = EXIF.getTag(this, "GPSLatitudeRef");
    var lng = EXIF.getTag(this, "GPSLongitude");
    var lngRef = EXIF.getTag(this, "GPSLongitudeRef");

    if (lat === undefined
      || latRef === undefined
      || lng === undefined
      || lngRef === undefined) {
      updateLoadingState(false);
      return;
    }

    var latVal = dmsRationalToDeg(lat, latRef);
    var lngVal = dmsRationalToDeg(lng, lngRef);
    document.getElementById("lat").value = latVal;
    document.getElementById("lng").value = lngVal;
    if (map !== null) {
      // Clear out the old markers.
      markers.forEach(function(marker) {
        marker.setMap(null);
      });
      markers = [];

      var marker = new google.maps.Marker({
        map: map,
        position: {
          lat: latVal,
          lng: lngVal
        }
      });
      map.setCenter(marker.getPosition());
      markers.push(marker);
    }
    updateLoadingState(false);
  });
}

function updateLoadingState(loadingState) {
  loading = loadingState;
  document.getElementById("loader-container").style.visibility = loading ? "visible" : "hidden";
  if (loading) {
    document.getElementById("current").classList.add('blur-image');
  } else {
    document.getElementById("current").classList.remove('blur-image');
  }
}

function dmsRationalToDeg(dmsArray, ref) {
  var sign = (ref === 'S' || ref === 'W') ? -1.0 : 1.0;
  var deg = sign * (dmsArray[0] + dmsArray[1] / 60.0 + dmsArray[2] / 3600.0);
  return deg;
}

document.onkeydown = function(e) {
  switch (e.keyCode) {
    case 37:
      prev();
      break;
    case 39:
      next();
      break;
  }
};
