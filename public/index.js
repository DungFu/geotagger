var map = null;
var searchBox = null;
var service = null;
var markers = [];
var loading = false;

function initAutocomplete() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: -33.8688, lng: 151.2195},
    zoom: 16,
    mapTypeId: 'roadmap',
    keyboardShortcuts: false
  });

  // Create the search box and link it to the UI element.
  var input = document.getElementById('search-input');
  searchBox = new google.maps.places.SearchBox(input);
  service = new google.maps.places.PlacesService(map);
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

  // Bias the SearchBox results towards current map's viewport.
  map.addListener('bounds_changed', function() {
    searchBox.setBounds(map.getBounds());
  });

  map.addListener('click', function(e) {
    if (e.placeId) {
      service.getDetails({placeId: e.placeId}, function(place, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          var lat = place.geometry.location.lat();
          var lng = place.geometry.location.lng();
          createMarker(lat, lng, true, true);
          setLatLngForm(lat, lng);
        }
      });
    } else {
      var lat = e.latLng.lat();
      var lng = e.latLng.lng();
      createMarker(lat, lng, true, true);
      setLatLngForm(lat, lng);
    }
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

      createMarker(
        place.geometry.location.lat(),
        place.geometry.location.lng(),
        false,
        false
      );

      if (place.geometry.viewport) {
        // Only geocodes have viewport.
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });
    map.fitBounds(bounds);

    if (markers.length === 1) {
      var position = markers[0].getPosition();
      setLatLngForm(position.lat(), position.lng());
    }
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
    form.action = 'http://localhost:8080/setexif?path=' + files[currentFile].path;
    form.submit();
  }
  if (currentFile < files.length - 1) {
    currentFile++;
    document.getElementById("current").style.visibility = "visible";
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
  var basePath = 'http://localhost:8080/convert';
  if (clearPrevious && files[fileIndex].hasOwnProperty('remotePath')) {
    delete files[fileIndex].remotePath;
  }
  if (!files[fileIndex].hasOwnProperty('remotePath')) {
    files[fileIndex].remotePath =
      basePath +
      '?name=' +
      files[fileIndex].name +
      '&path=' +
      files[fileIndex].path +
      '&width=' +
      parseInt(window.innerWidth/2.0) +
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
    setLatLngForm(latVal, lngVal);
    createMarker(latVal, lngVal, true, true);
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

function setLatLngForm(lat, lng) {
  document.getElementById("lat").value = lat;
  document.getElementById("lng").value = lng;
}

function createMarker(lat, lng, wipe, panTo) {
  if (map !== null) {
    if (wipe) {
      markers.forEach(function(marker) {
        marker.setMap(null);
      });
      markers = [];
    }

    var marker = new google.maps.Marker({
      map: map,
      position: {
        lat: lat,
        lng: lng
      }
    });

    marker.addListener('click', function() {
      var position = marker.getPosition();
      map.panTo(position);
      setLatLngForm(position.lat(), position.lng());
    });

    if (panTo) {
      map.panTo(marker.getPosition());
    }

    markers.push(marker);
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
