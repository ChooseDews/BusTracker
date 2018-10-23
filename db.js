const mongoose = require('mongoose');
var moment = require('moment');
const Json2csvParser = require('json2csv').Parser;
var fs = require('fs');

var f = ["created", "busId","callName","currentStop",	"currentStopId",	"distance",	"heading",	"load",	"nextStop",	"nextStopId",	"routeId",	"routeName",	"speed",	"stopId",	"stopName",	"stopped",	"updateId"]

mongoose.connect('mongodb://localhost/buses');

const Status = mongoose.model('Status', {
  updateId: Number,
  busId: Number,
  callName: String,
  routeId: Number,
  routeName: String,
  coords: [Number, Number],
  load: Number,
  currentStop: String,
  currentStopId: Number,
  nextStop: String,
  nextStopId: Number,
  speed: Number,
  heading: Number,
  stopped: Boolean,
  stopId: String,
  stopName: String,
  distance: Number,
  date: Date
});


var count = async function(){
  var c = await Status.count({});
  return c;
}


var exportData = async function(callName){
  if(!callName) callName = '554';
  var status = (await Status.find({callName: String(callName)})).map(function(u) {
   // console.log(u)
  var time = u._id.getTimestamp();
    u.created = moment(time).subtract(4, 'hours').format('YYYY-MM-DD HH:mm:ss');
    u.day = moment(time).subtract(4, 'hours').format('YYYY-MM-DD');
    
    return u
  });
  
  var fields =  ['created', 'day', 'updateId', 'callName', 'routeName', 'load', 'speed', 'distance','stopped','stopName','distance']; 
  const json2csvParser = new Json2csvParser({ fields: f});
  const csv = json2csvParser.parse(status);
  //console.log(csv);
  
  return csv;

  
}


var analyzePeriod = async function(callName){
  
  var status = (await Status.find({callName: String(callName)})).map(function(u) {
   // console.log(u)
    
    var time = u._id.getTimestamp();
    u.created = moment(time).subtract(4, 'hours');

   
    return u
  });
  
  
  var stops = [];
  var stopped = false;
  for(var s of status){
    if(s.stopped != stopped){
      
      if(s.stopped == true){
        s.time = moment(s.created).format('MMMM Do YYYY, h:mm:ss a');
        delete s.coords;
        stops.push(s);
      }
      
      
      stopped = s.stopped;
    }
  }
  
  return stops;
  
  
}


var storeData = async function(buses) {
  
  
  var n = 0;
  
  var ref = await Status.findOne().sort({ field: 'asc', _id: -1 }).limit(1);
  if(ref) n = ref.updateId+1;
  
  for (var bus of buses) {
    
    
  
    var doc = new Status({
      updateId: n,
      busId: bus.id,
      callName: bus.call_name,
      routeId: bus.route.id,
      routeName: bus.route.short_name,
      coords: bus.position,
      load: bus.load,
      speed: bus.speed,
      heading: bus.heading,
      date: new Date()
    });
    
    
    if(bus.current_stop){
      doc.currentStop = bus.current_stop.name
      doc.currentStopId = bus.current_stop.id
    }
    
    if(bus.next_stop){
      doc.nextStop = bus.next_stop.name
      doc.nextStopId = bus.next_stop.id
    }
    
    if(bus.finalPrediction){
      doc.stopped = true;
      doc.stopId = bus.finalPrediction.id;
      doc.stopName = bus.finalPrediction.name;  
      doc.distance = bus.finalPrediction.distance;
    }
    
    await doc.save();
    console.log('Saved Entry!');
    
  }
  
  
      n++;

}


module.exports = {
  Status,
  storeData,
  exportData,
  analyzePeriod,
  count
}