import {Connector, AdapterSMIP, Timeout, Measurement, map, predict, filter, 
  mergeWith, zipWithTime, KalmanFilterPredictor, DummyKalmanFilterCombinator, fuse, sumArrays} from "myrxjs";

// Utility functions

let multiplyArray = function(alpha, array, skip){
  for (var i = skip; i < array.length; i++){
    array[i] = alpha*array[i];
  }
  return array;
}

// Application-specific functions.

let preprocess = function(x, type, source){
  console.log("[MEASUREMENT] | " + type + " " + source + " | Pre-processing: ", x); 
  return x;
}

let log = function(x, type, source,){
  console.log("[TIMEOUT] | " + type + " " + source + " | Logging ", x); 
  return x;
}

let coordinateSwarm = function(x){
  console.log("[APPLICATION] | Updating Robot Coordination | New estimate: ", x);
}

// Initialization
const alpha = 0.5;

const connector = new Connector("0.0.0.0", "3040", "ws", '/khronos');
const adapter = new AdapterSMIP();
connector.subscribe(adapter);

// Robot#1

// GPS
let gpsRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e3ca"))
.pipeWithContext(Measurement, map(x => preprocess(x, "GPS", "Robot#1")))
.pipeWithContext(Timeout, map(x => log(x, "GPS", "Robot#1")))
.pipe(predict(new KalmanFilterPredictor(10, 2)), 
      map(x => {x.value = multiplyArray(1-alpha, x.value, 0); return x}));

//Wheel Encoder
let wheelEncoderRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e727"))
.pipeWithContext(Measurement, map(x => preprocess(x, "Encoder", "Robot#1")))
.pipeWithContext(Timeout, map(x => log(x, "Encoder", "Robot#1")))
.pipe(predict(new KalmanFilterPredictor(10)));

// Accelerometer
let accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e329"))
.pipeWithContext(Measurement, map(x => preprocess(x, "Accelerometer", "Robot#1")))
.pipeWithContext(Timeout, map(x => log(x, "Accelerometer", "Robot#1")))
.pipe(predict(new KalmanFilterPredictor(10, 3)));

// Gyroscope
let gyroscopeRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:dfe8"))
.pipeWithContext(Measurement, map(x => preprocess(x, "Gyroscope", "Robot#1")))
.pipeWithContext(Timeout, map(x => log(x, "Gyroscope", "Robot#1")))
.pipe(predict(new KalmanFilterPredictor(10, 3)));

// Zip together in time samples from Wheel Encoder, Accelerometer, and Gyroscope.
let zippedEncoderINSRobot1 = wheelEncoderRobot1.pipe(zipWithTime(100, accelerometerRobot1, gyroscopeRobot1));
// Sensor Data Fusion of the above zipped samples, where the position coordinates are multiplied by the weight. 
let fusedEncoderINS1 = zippedEncoderINSRobot1.pipe(fuse(new DummyKalmanFilterCombinator()),
map(x => {x.value = multiplyArray(alpha, x.value, 4); return x}));
// Zip together in time samples from sensor data fusion and GPS,
// and compute their weighted sum as final optimal position estimate for this robot.
let optimalPositionRobot1 = fusedEncoderINS1.pipe(zipWithTime(100, gpsRobot1), sumArrays())

// Robot #2

let gps2 = adapter.pipe(filter(x => x.getContext().source == "3302/5500|fd34::0017:0d00:0030:e3ca"))
.pipeWithContext(Measurement,  map(x => preprocess(x, "GPS", "Robot#2")))
.pipeWithContext(Timeout,  map(x => log(x, "GPS", "Robot#2")))
.pipe(predict(new KalmanFilterPredictor(10, 2)), map(x => {x.value = multiplyArray(1-alpha, x.value, 0); return x}));

let odometer2 = adapter.pipe(filter(x => x.getContext().source == "9803/9805|fd34::0017:0d00:0030:e727"))
.pipeWithContext(Measurement,  map(x => preprocess(x, "Wheel Encoder", "Robot#2")))
.pipeWithContext(Timeout, map(x => log(x, "Wheel Encoder", "Robot#2")))
.pipe(predict(new KalmanFilterPredictor(10)));

let accelerometer2 = adapter.pipe(filter(x => x.getContext().source == "3302/5500|fd34::0017:0d00:0030:e329"))
.pipeWithContext(Measurement,  map(x => preprocess(x, "Accelerometer", "Robot#2")))
.pipeWithContext(Timeout, map(x => log(x, "Accelerometer", "Robot#2")))
.pipe(predict(new KalmanFilterPredictor(10, 3)));

let gyroscope2 = adapter.pipe(filter(x => x.getContext().source == "8040/8042|fd34::0017:0d00:0030:dfe8"))
.pipeWithContext(Measurement,  map(x => preprocess(x, "Gyroscope", "Robot#2")))
.pipeWithContext(Timeout, map(x => log(x, "Gyroscope", "Robot#2")))
.pipe(predict(new KalmanFilterPredictor(10, 3)));

let zippedOdometerINS2 = odometer2.pipe(zipWithTime(100, accelerometer2, gyroscope2));
let fusedOdometerINS2 = zippedOdometerINS2.pipe(fuse(new DummyKalmanFilterCombinator()))
.pipe(map(x => {x.value = multiplyArray(alpha, x.value, 4); return x}));
let optimalPositionRobot2 = fusedOdometerINS2.pipe(zipWithTime(100, gps2), sumArrays())

// Merge individual optimal robot position estimates.
let finalOutput = optimalPositionRobot1.pipe(mergeWith(optimalPositionRobot2));
// Coordinating the robot swarm with every new optimal position estimate.
finalOutput.subscribe(x => coordinateSwarm(x));



