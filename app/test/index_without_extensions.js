
const { Subject, filter, map, mergeWith } = require('myrxjs');
var expect = require('chai').expect;
var data = require('./input.json')
const {KalmanFilter} = require('kalman-filter');

/**
 * Test suite for swarm robotics use case implementation without our extensions.
 */

let multiplyArray = function(alpha, array, skip){
for (var i = skip; i < array.length; i++){
  array[i] = alpha*array[i];
}
return array;
}

let preprocess = function(x, type, source){
    //console.log("[MEASUREMENT] | " + type + " " + source + " | Pre-processing: ", x); 
    return x;
}

let log = function(x, type, source,){
    //console.log("[TIMEOUT] | " + type + " " + source + " | Logging ", x); 
    return x;
}

let coordinateSwarm = function(x){
console.log("[APPLICATION] | Updating Truck Coordination | New estimate: ", x);
}

const alpha = 0.5;


// const connector = new Connector("0.0.0.0", "3040", "ws", '/khronos');
// const adapter = new AdapterSMIP();
// connector.subscribe(adapter);


function parseMessage(message){
    let msg= JSON.parse(message);
    var source = msg.data.contents.identifier + '|' + msg.data.contents.address;
    var timestamp = new Date(msg.data.contents.timestamp/1000).toISOString()
    if (msg.data.type == "timeout"){
        let value = null;
        return {value: value, context: {source: source, timestamp: timestamp, type: 'timeout'}}
    }
    else{
        let value = msg.data.contents.data[0].value;
        return {value: value, context: {source: source, timestamp: timestamp, type: 'measurement'}}
    }
  }


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
  

describe('#Test1 (No Extensions): Contextual Operators', function() {

    context('with measurement samples', function() {
        let input = data["test#1a"];
        let output = [];
        let adapter; 
        let context_measurement = 0;
        let context_timeout = 0;
        let estimateGPSRobot1 = [];

        adapter = new Subject();
        
        let gpsRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e3ca"));
        let gpsRobot1Measurement = gpsRobot1Basic.pipe(filter(x => x.context.type == "measurement"), map(x => {context_measurement+=1; return x}),
        map(x => preprocess(x, "GPS", "Robot#1")));
        let gpsRobot1Timeout = gpsRobot1Basic.pipe(filter(x => x.context.type == "timeout"), map(x => {context_timeout+=1; return x}),
        map(x => log(x, "GPS", "Robot#1")));
        let gpsRobot1 = gpsRobot1Measurement.pipe(mergeWith(gpsRobot1Timeout), map(x => estimate(x, estimateGPSRobot1, 10, 2)));
        gpsRobot1.subscribe(x=>output.push(x));

        beforeEach(function() {
            context_measurement = 0;
            context_timeout = 0;
            output = [];
        })

        it('should execute operators with measurement context', function() {
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(context_measurement).to.be.equal(2);
        })

        it('should not execute operators with timeout context', function() {
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(context_timeout).to.be.equal(0);
        })
    })

    context('with timeout samples', function() {
        let input = data["test#1b"];
        let output = [];
        let adapter; 
        let context_measurement = 0;
        let context_timeout = 0;
        let estimateGPSRobot1 = [];

        adapter = new Subject();
        
        let gpsRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e3ca"));
        let gpsRobot1Measurement = gpsRobot1Basic.pipe(filter(x => x.context.type == "measurement"), map(x => {context_measurement+=1; return x}),
        map(x => preprocess(x, "GPS", "Robot#1")));
        let gpsRobot1Timeout = gpsRobot1Basic.pipe(filter(x => x.context.type == "timeout"), map(x => {context_timeout+=1; return x}),
        map(x => log(x, "GPS", "Robot#1")));
        let gpsRobot1 = gpsRobot1Measurement.pipe(mergeWith(gpsRobot1Timeout), map(x => estimate(x, estimateGPSRobot1, 10, 2)));
        gpsRobot1.subscribe(x=>output.push(x));

        beforeEach(function() {
            context_measurement = 0;
            context_timeout = 0;
            output = [];
        })

        it('should execute operators with timeout context', function() {
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(context_timeout).to.be.equal(2);
        })

        it('should not execute operators with measurement context', function() {
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(context_measurement).to.be.equal(0);
        })
    })
})

describe('#Test2 (No Extensions): Estimate', function() {
    context('with measurement samples',function(){
        let input = data["test#2a"];
        let output = [];
        let adapter; 
        

        beforeEach(function(){
            output = [];
            let estimateGPSRobot1 = [];

            adapter = new Subject();
            
            let gpsRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e3ca"));
            let gpsRobot1Measurement = gpsRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let gpsRobot1Timeout = gpsRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            let gpsRobot1 = gpsRobot1Measurement.pipe(mergeWith(gpsRobot1Timeout), map(x => estimate(x, estimateGPSRobot1, 10, 2)));
            gpsRobot1.subscribe(x=>output.push(x));
        })
    
        it('should process measurements', function() {
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(output).to.have.lengthOf(2);
        })
      })
    
      context('with timeout samples', function() {
        let input = data["test#2b"];
        let output = [];
        let adapter; 
        beforeEach(function() {
            output = [];
            let estimateGPSRobot1 = [];

            adapter = new Subject();
            
            let gpsRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e3ca"));
            let gpsRobot1Measurement = gpsRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let gpsRobot1Timeout = gpsRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            let gpsRobot1 = gpsRobot1Measurement.pipe(mergeWith(gpsRobot1Timeout), map(x => estimate(x, estimateGPSRobot1, 10, 2)));
            gpsRobot1.subscribe(x=>output.push(x));
        })
    
        it('should estimate missing value', function() {
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(output).to.have.lengthOf(2);
            expect(output[1].value).to.not.equal(null);
            expect(output[1].value).to.have.lengthOf(2);
            expect(output[1].value[0]).to.be.a('number');
            expect(output[1].value[1]).to.be.a('number');
        })
    
        it('should convert timeout context to estimate', function() {
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(output).to.have.lengthOf(2);
            expect(output[1].context.type).to.be.equal('estimate');
        })
      })
})

// Tests if the estimate operator correctly converts timeout events to estimate events.
describe('#Test3 (No Extensions): ZipWithTime', function() {

    context('with insufficient samples', function() {
        let adapter = new Subject();
        let output;
        beforeEach(function() {
            output = []
            let counterZipRobot11={
                value: 0
            };

            let queueWheelEncoderRobot1 = [];
            let queueAccelerometerRobot1 = [];
            let queueGyroscopeRobot1 = [];
            let queuesZipRobot11 = [queueWheelEncoderRobot1, queueAccelerometerRobot1, queueGyroscopeRobot1]


            let estimateWheelEncoderRobot1 = [];
            let estimateAccelerometerRobot1 = [];
            let estimateGyroscopeRobot1 = [];

            let storeZipRobot11 = [];

            let subjectZipRobot11 = new Subject();

            //Wheel encoder sensor data.
            let wheelEncoderRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e727"));
            let wheelEncoderRobot1Measurement = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let wheelEncoderRobot1Timeout = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            wheelEncoderRobot1Measurement.pipe(mergeWith(wheelEncoderRobot1Timeout), map(x => estimate(x, estimateWheelEncoderRobot1, 10, 1)))
            .subscribe(x => zipWithTime(x, 0, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
            //.pipe(estimate(new KalmanFilterEstimator(10)));

            // Accelerometer sensor data.
            let accelerometerRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e329"));
            let accelerometerRobot1Measurement = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let accelerometerRobot1Timeout = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            accelerometerRobot1Measurement.pipe(mergeWith(accelerometerRobot1Timeout), map(x => estimate(x, estimateAccelerometerRobot1, 10, 3)))
            .subscribe(x => zipWithTime(x, 1, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
            //.pipe(estimate(new KalmanFilterEstimator(10)));

            // Gyroscope sensor data.
            let gyroscopeRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:dfe8"));
            let gyroscopeRobot1Measurement = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let gyroscopeRobot1Timeout = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            gyroscopeRobot1Measurement.pipe(mergeWith(gyroscopeRobot1Timeout), map(x => estimate(x, estimateGyroscopeRobot1, 10,3)))
            .subscribe(x => zipWithTime(x, 2, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));

          

        })
        it('should not combine any events', function() {
            let input = data["test#3a"];
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(output).to.have.lengthOf(0);
        })
    })

    context('with measurement samples', function() {
        let output = [];
        let adapter = new Subject(); 
        beforeEach(function() {
            output = []
            let counterZipRobot11={
                value: 0
            };
            let queueWheelEncoderRobot1 = [];
            let queueAccelerometerRobot1 = [];
            let queueGyroscopeRobot1 = [];
            let queuesZipRobot11 = [queueWheelEncoderRobot1, queueAccelerometerRobot1, queueGyroscopeRobot1]


            let estimateWheelEncoderRobot1 = [];
            let estimateAccelerometerRobot1 = [];
            let estimateGyroscopeRobot1 = [];

            let storeZipRobot11 = [];

            let subjectZipRobot11 = new Subject();

            //Wheel encoder sensor data.
            let wheelEncoderRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e727"));
            let wheelEncoderRobot1Measurement = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let wheelEncoderRobot1Timeout = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            wheelEncoderRobot1Measurement.pipe(mergeWith(wheelEncoderRobot1Timeout), map(x => estimate(x, estimateWheelEncoderRobot1, 10, 1)))
            .subscribe(x => zipWithTime(x, 0, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
            //.pipe(estimate(new KalmanFilterEstimator(10)));

            // Accelerometer sensor data.
            let accelerometerRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e329"));
            let accelerometerRobot1Measurement = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let accelerometerRobot1Timeout = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            accelerometerRobot1Measurement.pipe(mergeWith(accelerometerRobot1Timeout), map(x => estimate(x, estimateAccelerometerRobot1, 10, 3)))
            .subscribe(x => zipWithTime(x, 1, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
            //.pipe(estimate(new KalmanFilterEstimator(10)));

            // Gyroscope sensor data.
            let gyroscopeRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:dfe8"));
            let gyroscopeRobot1Measurement = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let gyroscopeRobot1Timeout = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            gyroscopeRobot1Measurement.pipe(mergeWith(gyroscopeRobot1Timeout), map(x => estimate(x, estimateGyroscopeRobot1, 10,3)))
            .subscribe(x => zipWithTime(x, 2, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
            subjectZipRobot11.subscribe(x => output.push(x));

        })
  
        it('should combine events within the time window', function() {
            let input = data["test#3b"];
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(output).to.have.lengthOf(1);
        })
        it('should not combine events outisde the time window', function() {
            let input = data["test#3c"];
            for (var i = 0; i < input.length; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(output).to.have.lengthOf(0);
        })
      })

      context('with estimate samples', function() {
        let output = [];
        let adapter = new Subject(); 
        before(function() {
            output = []
            let counterZipRobot11={
                value: 0
            };
            let queueWheelEncoderRobot1 = [];
            let queueAccelerometerRobot1 = [];
            let queueGyroscopeRobot1 = [];
            let queuesZipRobot11 = [queueWheelEncoderRobot1, queueAccelerometerRobot1, queueGyroscopeRobot1]


            let estimateWheelEncoderRobot1 = [];
            let estimateAccelerometerRobot1 = [];
            let estimateGyroscopeRobot1 = [];

            let storeZipRobot11 = [];

            let subjectZipRobot11 = new Subject();

            //Wheel encoder sensor data.
            let wheelEncoderRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e727"));
            let wheelEncoderRobot1Measurement = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let wheelEncoderRobot1Timeout = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            wheelEncoderRobot1Measurement.pipe(mergeWith(wheelEncoderRobot1Timeout), map(x => estimate(x, estimateWheelEncoderRobot1, 10, 1)))
            .subscribe(x => zipWithTime(x, 0, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
            //.pipe(estimate(new KalmanFilterEstimator(10)));

            // Accelerometer sensor data.
            let accelerometerRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e329"));
            let accelerometerRobot1Measurement = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let accelerometerRobot1Timeout = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            accelerometerRobot1Measurement.pipe(mergeWith(accelerometerRobot1Timeout), map(x => estimate(x, estimateAccelerometerRobot1, 10, 3)))
            .subscribe(x => zipWithTime(x, 1, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));

            // Gyroscope sensor data.
            let gyroscopeRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:dfe8"));
            let gyroscopeRobot1Measurement = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let gyroscopeRobot1Timeout = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            gyroscopeRobot1Measurement.pipe(mergeWith(gyroscopeRobot1Timeout), map(x => estimate(x, estimateGyroscopeRobot1, 10,3)))
            .subscribe(x => zipWithTime(x, 2, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
            subjectZipRobot11.subscribe(x => output.push(x));
        })
  
        it('should combine events within the time window', function() {
            let input = data["test#3d"];
            for (var i = 0; i < input.length-1; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(output).to.have.lengthOf(1);
            expect(output[0].sequence).to.be.equal(0);
        })

        it('should recompute stored output after late measurement', function() {
            let input = data["test#3d"];
            adapter.next(parseMessage(JSON.stringify(input[4])));
            expect(output).to.have.lengthOf(2);
            expect(output[1].sequence).to.be.equal(0);
        })
      })  
      
      context('with aggregate values', function() {
        let output = [];
        let adapter = new Subject();
        before(function() {
            output = []
            let counterZipRobot11={
                value: 0
            };
            
            let counterZipRobot12={
                value: 0
            };
            
            let queueGPSRobot1 = [];
            let queueWheelEncoderRobot1 = [];
            let queueAccelerometerRobot1 = [];
            let queueGyroscopeRobot1 = [];
            let queuesZipRobot11 = [queueWheelEncoderRobot1, queueAccelerometerRobot1, queueGyroscopeRobot1]
            let queueINSRobot1 = [];
            let queuesZipRobot12 = [queueINSRobot1, queueGPSRobot1]
            
            
            let estimateWheelEncoderRobot1 = [];
            let estimateAccelerometerRobot1 = [];
            let estimateGyroscopeRobot1 = [];
            let estimateGPSRobot1 = [];
            
            let storeZipRobot11 = [];
            let storeZipRobot12 = [];
            
            let subjectZipRobot11 = new Subject();
            let subjectZipRobot12 = new Subject();

            let gpsRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e3ca"));
            let gpsRobot1Measurement = gpsRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let gpsRobot1Timeout = gpsRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            let gpsRobot1 = gpsRobot1Measurement.pipe(mergeWith(gpsRobot1Timeout), map(x => estimate(x, estimateGPSRobot1, 10, 2), 
            map(x => {x.value = multiplyArray(1-alpha, x.value, 0); return x})));
            gpsRobot1.subscribe(x => zipWithTime(x, 0, subjectZipRobot12, 
                queuesZipRobot12, 10, storeZipRobot12, counterZipRobot11));

            //Wheel encoder sensor data.
            let wheelEncoderRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e727"));
            let wheelEncoderRobot1Measurement = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let wheelEncoderRobot1Timeout = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            wheelEncoderRobot1Measurement.pipe(mergeWith(wheelEncoderRobot1Timeout), map(x => estimate(x, estimateWheelEncoderRobot1, 10, 1)))
            .subscribe(x => zipWithTime(x, 0, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));

            // Accelerometer sensor data.
            let accelerometerRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e329"));
            let accelerometerRobot1Measurement = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let accelerometerRobot1Timeout = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            accelerometerRobot1Measurement.pipe(mergeWith(accelerometerRobot1Timeout), map(x => estimate(x, estimateAccelerometerRobot1, 10, 3)))
            .subscribe(x => zipWithTime(x, 1, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));

            // Gyroscope sensor data.
            let gyroscopeRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:dfe8"));
            let gyroscopeRobot1Measurement = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
            map(x => preprocess(x, "GPS", "Robot#1")));
            let gyroscopeRobot1Timeout = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
            map(x => log(x, "GPS", "Robot#1")));
            gyroscopeRobot1Measurement.pipe(mergeWith(gyroscopeRobot1Timeout), map(x => estimate(x, estimateGyroscopeRobot1, 10,3)))
            .subscribe(x => zipWithTime(x, 2, subjectZipRobot11, 
                    queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));

            let fusedEncoderINS1 = subjectZipRobot11.pipe(map(x => combine(x)), map(x => {x.value = multiplyArray(alpha, x.value, 4); return x}));
            fusedEncoderINS1.subscribe(x => zipWithTime(x, 1, subjectZipRobot12, 
            queuesZipRobot12, 100, storeZipRobot12, counterZipRobot12));
            subjectZipRobot12.subscribe(x=>output.push(x));
          })

          it('should combine with measurement when associated in time', function(){
            let input = data["test#3e"];
            for (var i = 0; i < input.length-1; i++){
                adapter.next(parseMessage(JSON.stringify(input[i])));
            }
            expect(output).to.have.lengthOf(1);
          })

          it('should recompute output when stored aggregate is recomputed', function(){
            let input = data["test#3e"];
            adapter.next(parseMessage(JSON.stringify(input[input.length-1])));
            expect(output).to.have.lengthOf(2);
            expect(output[0].sequence).to.be.equal(output[1].sequence);
          })
      })
    })

    describe('#Test4 (No Extensions): Value Arithmetic', function() {
        context('with measurement samples', function() {
            let output = [];
            let adapter = new Subject(); 
            let gps = [];
            let fusion = [];
            let sum = [];
            before(function() {
                output = []
                let counterZipRobot11={
                    value: 0
                };
                
                let counterZipRobot12={
                    value: 0
                };
                
                let queueGPSRobot1 = [];
                let queueWheelEncoderRobot1 = [];
                let queueAccelerometerRobot1 = [];
                let queueGyroscopeRobot1 = [];
                let queuesZipRobot11 = [queueWheelEncoderRobot1, queueAccelerometerRobot1, queueGyroscopeRobot1]
                let queueINSRobot1 = [];
                let queuesZipRobot12 = [queueINSRobot1, queueGPSRobot1]
                
                
                let estimateWheelEncoderRobot1 = [];
                let estimateAccelerometerRobot1 = [];
                let estimateGyroscopeRobot1 = [];
                let estimateGPSRobot1 = [];
                
                let storeZipRobot11 = [];
                let storeZipRobot12 = [];
                
                let subjectZipRobot11 = new Subject();
                let subjectZipRobot12 = new Subject();
    
                let gpsRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e3ca"));
                let gpsRobot1Measurement = gpsRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
                map(x => preprocess(x, "GPS", "Robot#1")));
                let gpsRobot1Timeout = gpsRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
                map(x => log(x, "GPS", "Robot#1")));
                let gpsRobot1 = gpsRobot1Measurement.pipe(mergeWith(gpsRobot1Timeout), map(x => estimate(x, estimateGPSRobot1, 10, 2)), 
                map(x => {gps.push(x.value.slice()); x.value = multiplyArray(1-alpha, x.value, 0); gps.push(x.value); return x}));
                gpsRobot1.subscribe(x => zipWithTime(x, 0, subjectZipRobot12, 
                    queuesZipRobot12, 10, storeZipRobot12, counterZipRobot11));
    
                //Wheel encoder sensor data.
                let wheelEncoderRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e727"));
                let wheelEncoderRobot1Measurement = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
                map(x => preprocess(x, "Wheel Encoder", "Robot#1")));
                let wheelEncoderRobot1Timeout = wheelEncoderRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
                map(x => log(x, "Wheel Encoder", "Robot#1")));
                wheelEncoderRobot1Measurement.pipe(mergeWith(wheelEncoderRobot1Timeout), map(x => estimate(x, estimateWheelEncoderRobot1, 10, 1)))
                .subscribe(x => zipWithTime(x, 0, subjectZipRobot11, 
                        queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
                //.pipe(estimate(new KalmanFilterEstimator(10)));
    
                // Accelerometer sensor data.
                let accelerometerRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:e329"));
                let accelerometerRobot1Measurement = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
                map(x => preprocess(x, "Accelerometer", "Robot#1")));
                let accelerometerRobot1Timeout = accelerometerRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
                map(x => log(x, "Accelerometer", "Robot#1")));
                accelerometerRobot1Measurement.pipe(mergeWith(accelerometerRobot1Timeout), map(x => estimate(x, estimateAccelerometerRobot1, 10, 3)))
                .subscribe(x => zipWithTime(x, 1, subjectZipRobot11, 
                        queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
    
                // Gyroscope sensor data.
                let gyroscopeRobot1Basic = adapter.pipe(filter(x => x.context.source == "1010/9000|fd34::0017:0d00:0030:dfe8"));
                let gyroscopeRobot1Measurement = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "measurement"),
                map(x => preprocess(x, "Gyroscope", "Robot#1")));
                let gyroscopeRobot1Timeout = gyroscopeRobot1Basic.pipe(filter(x => x.context.type == "timeout"),
                map(x => log(x, "Gyroscope", "Robot#1")));
                gyroscopeRobot1Measurement.pipe(mergeWith(gyroscopeRobot1Timeout), map(x => estimate(x, estimateGyroscopeRobot1, 10,3)))
                .subscribe(x => zipWithTime(x, 2, subjectZipRobot11, 
                        queuesZipRobot11, 10, storeZipRobot11, counterZipRobot11));
    
                let fusedEncoderINS1 = subjectZipRobot11.pipe(map(x => combine(x)),
                map(x => {fusion.push(x.value.slice()); x.value = multiplyArray(alpha, x.value, 4); fusion.push(x.value); return x}));
                fusedEncoderINS1.subscribe(x => zipWithTime(x, 1, subjectZipRobot12, 
                queuesZipRobot12, 10, storeZipRobot12, counterZipRobot12));
                let optimalPositionRobot1 = subjectZipRobot12.pipe(map(x => sumArrays(x)), map(x=>{sum.push(x.value)}));
                optimalPositionRobot1.subscribe(x=>output.push(x));
            })
      
            it('should multiply GPS output with weight', function() {
                let input = data["test#4"];
                for (var i = 0; i < input.length; i++){
                    adapter.next(parseMessage(JSON.stringify(input[i])));
                }
                expect(gps).to.have.lengthOf(2);
                for (var i = 0; i< gps[0].length; i++){
                    expect(gps[1][i]).to.be.equal(gps[0][i]*alpha);
                }
            })

            it('should multiply sensor fusion output with weight', function() {
                expect(fusion).to.have.lengthOf(2);
                for (var i = 0; i< fusion[0].length; i++){
                    if (i < 4){
                        expect(fusion[1][i]).to.be.equal(fusion[0][i]);
                    }
                    else{
                        expect(fusion[1][i]).to.be.equal(fusion[0][i]*alpha);
                    }
                }
            })
    
            it('should compute weighted sum of the above', function() {
                expect(sum).to.have.lengthOf(1);
                for (var i = 0; i< sum[0].length; i++){
                    if (i < 4){
                        expect(sum[0][i]).to.be.equal(fusion[1][i]);
                    }
                    else{
                        expect(sum[0][i]).to.be.equal(fusion[1][i] + gps[1][i-4]);
                    }
                }
            })
          })
  }) 


