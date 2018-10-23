var geolib = require('geolib');

var calculateDistance = function(lat1, lon1, lat2, lon2) {

  return geolib.getDistance({
    latitude: lat1,
    longitude: lon1
  }, {
    latitude: lat2,
    longitude: lon2
  }, 3);


}


module.exports = {
  calculateDistance
}