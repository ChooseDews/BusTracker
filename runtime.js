const express = require('express')
const rp = require('request-promise');
const lodash = require('lodash');
const util = require('./util');
const db = require('./db');

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
  var s = lodash.clone(lodash.find(routeStops, {
    id
  }));

  var stops = [];

  for (var index in s.stops) {
    var n = s.stops[index];
    stops.push(await getStopInfo(n));
  }
  //console.log(stops.length)


  return lodash.clone(stops);
}


var getStopInfo = async function(stop_id) {
  if (!stopInformation) {
    var a = (await gather(routes_stops_url));
    routeStops = a.routes;
    stopInformation = a.stops;
  }
  return lodash.clone(lodash.find(stopInformation, {
    id: stop_id
  }))
}


var routeInformation = null;

var getRouteInfo = async function(id) {
  if (!routeInformation) {
    await gather(route_info_url).then(function(a) {
      routeInformation = a.routes
    });
  }
  var a = lodash.clone(lodash.find(routeInformation, {
    id: id
  }));
  delete a.url;
  return a;
};

var getBusesStatus = async function(save) {
  var busData = (await gather(url)).vehicles;


  for (var index in busData) {
    var bus = busData[index];

    if (bus.current_stop_id) {
      bus.current_stop = await getStopInfo(bus.current_stop_id);
    }

    if (bus.next_stop) {
      bus.next_stop = await getStopInfo(bus.next_stop);
    }

    //console.log(bus);

    var route = await getRouteInfo(bus.route_id);
    var stops = await getRouteStops(bus.route_id);
    busData[index].route = route;
    busData[index].stops = stops;
    // console.log(route)
    delete busData[index].apc_status;
    delete busData[index].num_cars;
  }


  busData = lodash.filter(busData, function(a) {

    var allowedLines = [1, 16, 33, 34, 121];
    var route_num = Number(a.route.short_name)
    return allowedLines.includes(route_num);

  })



  for (var index in busData) {
    var bus = busData[index];
    busData[index] = calculateStopDistances(bus);
  }

  for (var index2 in busData) {
    var bus = busData[index2];
    busData[index2] = analyzeStatus(bus);
  }

  
  if(save){
      db.storeData(busData);

  }


  //console.log(busData);
  return busData;
};


var calculateStopDistances = function(bus) {
  var predications = [];
  for (var index in bus.stops) {
    var stop = bus.stops[index];
    var distance = util.calculateDistance(Number(bus.position[0]), Number(bus.position[1]), Number(stop.position[0]), Number(stop.position[1]));
    bus.stops[index].distance = distance;
    if (distance < 30) predications.push(bus.stops[index]);
  }
  bus.predictions = predications;

  return bus;
}


var analyzeStatus = function(bus) {


  var proximityPredictions = bus.predictions;

  if (bus.current_stop) {
    for (var stop of proximityPredictions) {
      if (stop.id == bus.current_stop.id) bus.finalPrediction = stop;
    }
  } else if (bus.next_stop && bus.distance < 15) {
    for (var stop of proximityPredictions) {
      if (stop.id == bus.current_stop.id) bus.finalPrediction = stop;
    }
  } else {
    bus.finalPrediction = null;
    bus.textPrediction = "In Route To Station Station!";
  }


  if (bus.finalPrediction) {
    console.log('WE HAVE A PREDICTION! Distance: ', bus.finalPrediction.distance);
    //  console.log(bus.call_name);
    // console.log(bus.finalPrediction)
    bus.textPrediction = "We Are Currently At " + bus.finalPrediction.name;

  }




  return bus;
}



//recurring Stuff



setInterval(function() {

  console.log('Getting Status!')
  getBusesStatus(true);


}, 3000);



//Server Stuff


