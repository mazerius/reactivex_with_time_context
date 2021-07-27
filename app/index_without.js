const { Subject } = require('myrxjs');
import {filter,map, mergeWith} from "myrxjs";
const {KalmanFilter} = require('kalman-filter');

/**
* Implementation of Swarm Robotics use case WITHOUT our reactive extensions.
*/

let multiplyArray = function(alpha, array, skip){
for (var i = skip; i < array.length; i++){
  array[i] = alpha*array[i];
}
return array;
}

let preprocess = function(x, type, source){
console.log("[MEASUREMENT] | " + type + " " + source + " | Pre-processing: ", x); 
//insert pre-processing logic for GPS sensor data.
return x;
}

let log = function(x, type, source,){
console.log("[TIMEOUT] | " + type + " " + source + " | Logging ", x); 
return x;
}

let coordinateSwarm = function(x){
console.log("[APPLICATION] | Updating Truck Coordination | New estimate: ", x);
}

const alpha = 0.5;


// const connector = new Connector("0.0.0.0", "3040", "ws", '/khronos');
// const adapter = new AdapterSMIP();
// connector.subscribe(adapter);


function prepareConnection(client, adapter){
    client.on('connect', function(connection) {
        connection.on('error', function(error) {
            console.log("Connection Error: " + error.toString());
        });
        connection.on('close', function() {
            console.log('echo-protocol Connection Closed');
        });
        connection.on('message', function(message) {
            message = parseMessage(message);
            adapter.next(message);
        });      
    });
    client.on('connectFailed', function(error) {
        console.log('Connect Error: ' + error.toString());
    });
}

function parseMessage(message){
    let msg= JSON.parse(message.utf8Data);
    var source = msg.data.contents.identifier + '|' + msg.data.contents.address;
    var timestamp = new Date(message.data.contents.timestamp/1000).toISOString()
    if (msg.data.type == "timeout"){
        let value = null;
        return {value: value, context: {source: source, timestamp: timestamp, type: 'timeout'}}
    }
    else{
        let value = msg.data.contents.data[0].value;
        return {value: value, context: {source: source, timestamp: timestamp, type: 'measurement'}}
    }
  }

  var WebSocketClient = require('websocket').client;
  var client = new WebSocketClient();
  var adapter = new Subject();
  client.connect("ws" + '://' + "0.0.0.0" + ':' + "3040" + "/khronos");                 
  prepareConnection(client, adapter);;

function addQueue(element, queue){
    queue.push(element);
    return queue;
}

function cartesian(args) {
    var r = [], max = args.length-1;
    function helper(arr, i) {
        for (var j=0, l=args[i].length; j<l; j++) {
            var a = arr.slice(0); // clone arr
            a.push(args[i][j]);
            if (i==max)
                r.push(a);
            else
                helper(a, i+1);
        }
    }
    helper([], 0);
    return r;
}

function findValidCombination(combinations, timeWindow){
    let result = []
    for (var i = 0; i < combinations.length; i++){
        if (isValidCombination(combinations[i], timeWindow)){
            result.push(combinations[i]);
            break;
        }
    }
    return result;
}

function isValidCombination(combination, timeWindow){
    let timestamps = []
    for (var j = 0; j<combination.length; j++){
        if (combination[j].context.type == "measurement"){
            timestamps.push(Math.floor(new Date(combination[j].context.timestamp).getTime()/1000));
        }
    }
    timestamps = timestamps.sort();
    if(Math.abs(timestamps[0] - timestamps[timestamps.length-1]) <= timeWindow){
        return true;
    }
    return false;
}

function removeElementFromQueue(element, queue){
    let result = []
    for (var i = 0; i<queue.length; i++){
        if (!elementsEqual(element, queue[i])){
            result.push(queue[i]);
        }
    }
    return result;
}

function elementsEqual(el1, el2){
    if (el1.context.type == el2.context.type && el1.value == el2.value && el1.context.source == el2.context.source && el1.context.timestamp == el2.context.timestamp){
        return true
    }
    return false;
}

function zipWithTime(x, index, subject, queues, timeWindow, store, counter){
    if (x == undefined){
        return;
    }
    if (x.context.type == "measurement" || x.context.length != undefined){
        for (var i = 0; i < store.length; i++){
            let stored = store[i].contents;
            for(var j = 0; j < stored.length; j++){
                if (x.context.length != undefined && stored[j].context.length != undefined){
                    if (x.sequence == stored[j].sequence){
                        store[i].contents[j] = x;
                        let toSend = store[i];
                        if (!estimateIn(store[i].contents)){
                            store.splice(i);
                        }
                        subject.next(toSend);
                        return;
                    }
                }
                if (stored[j].context.source == x.context.source & stored[j].context.type == "estimate"){
                    // check if previous value can be improved
                    let clone = stored.slice();
                    clone[j] = x;
                    if (isValidCombination(clone, timeWindow)){
                        store[i].contents[j] = x;
                        let mySequence = store[i].sequence;
                        if (!estimateIn(clone)){
                            store.splice(i);
                        }
                        subject.next({contents: clone, sequence: mySequence});
                        return;
                    }
                }
            }
        }
    }
    //console.log('Adding ', x, 'to queue', queues[i]);
    queues[index] = addQueue(x, queues[index])
    for (var i = 0; i<queues.length; i++){
        if (queues[i].length == 0){
            return;
        }
    }
    var allCombinations = cartesian(queues);
    var validCombination = findValidCombination(allCombinations, timeWindow);
    if (validCombination.length > 0){
        validCombination = validCombination[0];
        for (i = 0; i< validCombination.length; i++){
            let q = removeElementFromQueue(validCombination[i], queues[i]);
            queues[i] = q;
        }
        counter.value+=1;
        if (estimateIn(validCombination)){
            addQueue({contents: validCombination, sequence: counter.value-1}, store);
        }
        subject.next({contents: validCombination, sequence: counter.value-1});
        return;
    }
}

function estimate(x, buffer, length, dimension){
    let kf = null;
    if (x.context.type == "timeout"){
        if (dimension > 1){
            kf = new KalmanFilter({observation:dimension});
        }
        else{
            kf = new KalmanFilter();
        }
        if (buffer.length > 0){
            let value = kf.filterAll(buffer).pop();
            if (value.length == 1){
                value = value[0];
            }
            x.value = value;
            x.context.type = "estimate";
            return x;
        }
    }
    if (x.context.type == "measurement"){
        if (buffer.length >= length){
            buffer = buffer.slice(1,length);
        }
        buffer.push(x.value);
        return x;
    }
}

function flatten(array){
    let depth = 1;
    let isFlattened = false;
    while(!isFlattened){
      array = array.flat(depth);
      let depthBefore = depth;
      for (var i = 0; i < array.length; i++){
        if (Array.isArray(array[i])){
          depth+=1;
          break
        }
      if (depthBefore == depth){
        isFlattened = true;
      }
    }
  }
  return array;
}

let estimateIn = function(values){
    for (var i = 0; i<values.length; i++){
      if (values[i].context.length){
        let contexts = flatten((values[i]).context); 
        for (var j = 0; j < contexts.length; j++){
          if (contexts[j].type == "estimate"){
            return true;
          }
        }
      }
      if (values[i].context){
        if (values[i].context.type == "estimate"){
          return true;
        }
      }
    }
    return false;
  }


function extractContext(data){
    let result = []
    for (var i = 0; i < data.length; i++){
        result.push({source: data[i].context.source, timestamp: data[i].context.timestamp, type: data[i].context.type});
    }
    return result;
}



function sumArrays(value){
    let maxLength = 0;
    let arrays = [];
    let contexts = []
    for (var i = 0; i < value.contents.length; i++){
        contexts.push(value.contents[i].context);
        if (value.contents[i].value.length > maxLength){
            maxLength = value.contents[i].value.length;
        }
    }
    for (var j = 0; j < value.contents.length; j++){
        if (value.contents[j].value.length < maxLength){
            arrays.push(new Array(maxLength - value.contents[j].value.length).fill(0).concat(value.contents[j].value));
        }
        else{
            arrays.push(value.contents[j].value);
        }      
    }
    let result = new Array(maxLength).fill(0);
    for (var i =0; i< maxLength; i++){
        for (var j = 0; j<arrays.length; j++){
            result[i] += arrays[j][i];
        }
    }
   return {value:result, context: contexts, sequence: value.sequence};
}
// implementation out of scope, see reference paper. 
function combine(value){
    let context = extractContext(value.contents);
    let output = [Math.random()*10, Math.random()*10, Math.random()*10, Math.random()*10, Math.random()*10, Math.random()*10]
    let result = {value: output, context: context, sequence: value.sequence}
    return result;
}


// Robot#1

let counterZipRobot11={
    value: 0
};



let queueGPSRobot1 = [];
let queueWheelEncoderRobot1 = [];
let queueAccelerometerRobot1 = [];
let queueGyroscopeRobot1 = [];
let queuesZipRobot11 = [queueWheelEncoderRobot1, queueAccelerometerRobot1, queueGyroscopeRobot1]
let queueINSRobot1 = [];


let estimateWheelEncoderRobot1 = [];
let estimateAccelerometerRobot1 = [];
let estimateGyroscopeRobot1 = [];
let estimateGPSRobot1 = [];

let storeZipRobot11 = [];
let storeZipRobot12 = [];

let subjectZipRobot11 = new Subject();

// Necessary arguments to zip together events based on time context without our extensions.
let subjectZipRobot12 = new Subject();
let queuesZipRobot12 = [queueINSRobot1, queueGPSRobot1]
let storeZipRobot12 = [];
let counterZipRobot12={
    value: 0
};

// GPS sensor data.
let gpsRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e3ca"));
let gpsRobot1Measurement = gpsRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
map(x => preprocess(x, "GPS", "Robot#1")));
let gpsRobot1Timeout = gpsRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
map(x => log(x, "GPS", "Robot#1")));
let gpsRobot1 = gpsRobot1Measurement.pipe(mergeWith(gpsRobot1Timeout), map(x => estimate(x, estimateGPSRobot1, 10, 2), 
map(x => {x.value = multiplyArray(1-alpha, x.value, 0); return x})));
gpsRobot1.subscribe(x => zipWithTime(x, 0, subjectZipRobot12, 
    queuesZipRobot12, 100, storeZipRobot12, counterZipRobot12));


//Wheel encoder sensor data.
let wheelEncoderRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e727"));
let wheelEncoderRobot1Measurement = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
map(x => preprocess(x, "GPS", "Robot#1")));
let wheelEncoderRobot1Timeout = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
map(x => log(x, "GPS", "Robot#1")));
wheelEncoderRobot1Measurement.pipe(mergeWith(wheelEncoderRobot1Timeout), map(x => estimate(x, estimateWheelEncoderRobot1, 10, 1)))
.subscribe(x => zipWithTime(x, 0, subjectZipRobot11, 
        queuesZipRobot11, 100, storeZipRobot11, counterZipRobot11));
//.pipe(estimate(new KalmanFilterEstimator(10)));

// Accelerometer sensor data.
let accelerometerRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e329"));
let accelerometerRobot1Measurement = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
map(x => preprocess(x, "GPS", "Robot#1")));
let accelerometerRobot1Timeout = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
map(x => log(x, "GPS", "Robot#1")));
accelerometerRobot1Measurement.pipe(mergeWith(accelerometerRobot1Timeout), map(x => estimate(x, estimateAccelerometerRobot1, 10, 3)))
.subscribe(x => zipWithTime(x, 1, subjectZipRobot11, 
        queuesZipRobot11, 100, storeZipRobot11, counterZipRobot11));
//.pipe(estimate(new KalmanFilterEstimator(10)));

// Gyroscope sensor data.
let gyroscopeRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:dfe8"));
let gyroscopeRobot1Measurement = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
map(x => preprocess(x, "GPS", "Robot#1")));
let gyroscopeRobot1Timeout = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
map(x => log(x, "GPS", "Robot#1")));
gyroscopeRobot1Measurement.pipe(mergeWith(gyroscopeRobot1Timeout), map(x => estimate(x, estimateGyroscopeRobot1, 10,3)))
.subscribe(x => zipWithTime(x, 2, subjectZipRobot11, 
        queuesZipRobot11, 100, storeZipRobot11, counterZipRobot11));
//.pipe(estimate(new KalmanFilterEstimator(10)));

let fusedEncoderINS1 = subjectZipRobot11.pipe(map(x => combine(x)), map(x => {x.value = multiplyArray(alpha, x.value, 4); return x}));
fusedEncoderINS1.subscribe(x => zipWithTime(x, 1, subjectZipRobot12, 
    queuesZipRobot12, 100, storeZipRobot12, counterZipRobot12));

let optimalPositionRobot1 = subjectZipRobot12.pipe(map(x => sumArrays(x)));
optimalPositionRobot1.subscribe(x => console.log("Optimal Position Robot 1:", x));



// // Robot#2

let counterZipRobot21={
    value: 0
};

let counterZipRobot22={
    value: 0
};

let queueGPSRobot2 = [];
let queueWheelEncoderRobot2 = [];
let queueAccelerometerRobot2 = [];
let queueGyroscopeRobot2 = [];
let queuesZipRobot21 = [queueWheelEncoderRobot2, queueAccelerometerRobot2, queueGyroscopeRobot2]
let queueINSRobot2 = [];
let queuesZipRobot22 = [queueINSRobot2, queueGPSRobot2]


let estimateWheelEncoderRobot2 = [];
let estimateAccelerometerRobot2 = [];
let estimateGyroscopeRobot2 = [];
let estimateGPSRobot2 = [];

let storeZipRobot21 = [];
let storeZipRobot22 = [];

let subjectZipRobot21 = new Subject();
let subjectZipRobot22 = new Subject();

// GPS sensor data.
let gpsRobot2Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e3ca"));
let gpsRobot2Measurement = gpsRobot2Basic.pipe(filter(x => x.context.type == "measurement"),
map(x => preprocess(x, "GPS", "Robot#2")));
let gpsRobot2Timeout = gpsRobot2Basic.pipe(filter(x => x.context.type == "timeout"),
map(x => log(x, "GPS", "Robot#2")));
let gpsRobot2 = gpsRobot2Measurement.pipe(mergeWith(gpsRobot2Timeout), map(x => estimate(x, estimateGPSRobot2, 10, 2), 
map(x => {x.value = multiplyArray(1-alpha, x.value, 0); return x})));
gpsRobot2.subscribe(x => zipWithTime(x, 0, subjectZipRobot22, 
    queuesZipRobot22, 100, storeZipRobot22, counterZipRobot21));


//Wheel encoder sensor data.
let wheelEncoderRobot2Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e727"));
let wheelEncoderRobot2Measurement = wheelEncoderRobot2Basic.pipe(filter(x => x.context.type == "measurement"),
map(x => preprocess(x, "Wheel Encoder", "Robot#2")));
let wheelEncoderRobot2Timeout = wheelEncoderRobot2Basic.pipe(filter(x => x.context.type == "timeout"),
map(x => log(x, "Wheel Encoder", "Robot#2")));
wheelEncoderRobot2Measurement.pipe(mergeWith(wheelEncoderRobot2Timeout), map(x => estimate(x, estimateWheelEncoderRobot2, 10, 1)))
.subscribe(x => zipWithTime(x, 0, subjectZipRobot21, 
        queuesZipRobot21, 100, storeZipRobot21, counterZipRobot21));

// Accelerometer sensor data.
let accelerometerRobot2Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e329"));
let accelerometerRobot2Measurement = accelerometerRobot2Basic.pipe(filter(x => x.context.type == "measurement"), 
map(x => preprocess(x, "Accelerometer", "Robot#2")));
let accelerometerRobot2Timeout = accelerometerRobot2Basic.pipe(filter(x => x.context.type == "timeout"), 
map(x => log(x, "Accelerometer", "Robot#2")));
accelerometerRobot2Measurement.pipe(mergeWith(accelerometerRobot2Timeout), map(x => estimate(x, estimateAccelerometerRobot2, 10, 3)))
.subscribe(x => zipWithTime(x, 1, subjectZipRobot21, 
        queuesZipRobot21, 100, storeZipRobot21, counterZipRobot21));

// Gyroscope sensor data.
let gyroscopeRobot2Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:dfe8"));
let gyroscopeRobot2Measurement = gyroscopeRobot2Basic.pipe(filter(x => x.context.type == "measurement"), 
map(x=> preprocess(x, "Gyroscope", "Robot#2")));
let gyroscopeRobot2Timeout = gyroscopeRobot2Basic.pipe(filter(x => x.context.type == "timeout"), 
map(x => log(x, "Gyroscope", "Robot#2")));
gyroscopeRobot2Measurement.pipe(mergeWith(gyroscopeRobot2Timeout), 
    map(x => estimate(x, estimateGyroscopeRobot2, 10,3)))
    .subscribe(x => zipWithTime(x, 2, subjectZipRobot21, 
        queuesZipRobot21, 100, storeZipRobot21, counterZipRobot21));

let fusedEncoderINS2 = subjectZipRobot21.pipe(map(x => combine(x)), 
    map(x => {x.value = multiplyArray(alpha, x.value, 4); return x}));
fusedEncoderINS2.subscribe(x => zipWithTime(x, 1, subjectZipRobot22, 
    queuesZipRobot22, 100, storeZipRobot22, counterZipRobot22));

let optimalPositionRobot2 = subjectZipRobot22.pipe(map(x => sumArrays(x)));

let finalOutput = optimalPositionRobot1.pipe(mergeWith(optimalPositionRobot2));
finalOutput.subscribe(x => coordinateSwarm(x));

