const express = require('express')
const rp = require('request-promise');
const lodash = require('lodash');

// Gathering Data

var route_info_url = "http://feeds.transloc.com/3/routes?agencies=116";
var url = "http://feeds.transloc.com/3/vehicle_statuses?agencies=116";
var routes_stops_url = "http://feeds.transloc.com/3/stops?include_routes=true&agencies=116";

var ohGod = function(err) {
  console.log('We Had An Error :(  ');
  console.log(err);
  throw err;
}

var gather = function(url) {
  return rp(url).then(function(htmlString) {
    return JSON.parse(htmlString);
  }).catch(ohGod);
}


var stopInformation = null;
var routeStops = null;

var getRouteStops = async function(id) {
  if (!routeStops) {
    var a = (await gather(routes_stops_url));
    routeStops = a.routes;
    stopInformation = a.stops;
  }
  var s = lodash.find(routeStops, {id});

   var stops = [];
  
  for(var index in s.stops){
      var n = s.stops[index];
      stops.push(await getStopInfo(n));
   }
   //console.log(stops.length)

 
  return stops;
}


var getStopInfo = async function(stop_id) {
  if (!stopInformation) {
    var a = (await gather(routes_stops_url));
    routeStops = a.routes;
    stopInformation = a.stops;
  }
  return lodash.find(stopInformation, {id: stop_id})
}


var routeInformation = null;

var getRouteInfo = async function(id) {
  if (!routeInformation) {
    await gather(route_info_url).then(function(a) {
      routeInformation = a.routes
    });
  }
  var a = lodash.find(routeInformation, {
    id: id
  });
  delete a.url;
  return a;
};

var getBusesStatus = async function() {
  var busData = (await gather(url)).vehicles;
  for (var index in busData) {
    var bus = busData[index];
    var route = await getRouteInfo(bus.route_id);
    var stops = await getRouteStops(bus.route_id);
    busData[index].route = route;
    busData[index].stops = stops;
    // console.log(route)
    delete busData[index].apc_status;
    delete busData[index].num_cars;
  }
  console.log(busData);
  return busData;
};

//Server Stuff

const app = express()

app.set('view engine', 'ejs');

const port = 3000;

app.get('/', async function(req, res) {
  var busData = await getBusesStatus();

  //console.log(busData);
  busData = lodash.groupBy(busData, 'route.long_name');
  //console.log(busData);

  res.render('buses', {
    routes: busData
  });

  //console.log(busData);
});



app.listen(port, () => console.log(`Example app listening on port ${port}!`))