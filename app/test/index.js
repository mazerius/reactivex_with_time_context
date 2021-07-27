/* test/index.js */

const { Subject, map, predict, AdapterSMIP, pipeWithContext, fuse, DummyKalmanFilterCombinator, zipWithTime, Timeout, Measurement, Prediction, filter, KalmanFilterPredictor, sumArrays } = require('myrxjs');
var expect = require('chai').expect;
var data = require('./input.json')
const alpha = 0.5;

let preprocess = function(x, type, source){
    //console.log("[MEASUREMENT] | " + type + " " + source + " | Pre-processing: ", x); 
    return x;
}
  
let log = function(x, type, source){
    //console.log("[TIMEOUT] | " + type + " " + source + " | Logging ", x); 
    return x;
}

let multiplyArray = function(alpha, array, skip){
    for (var i = skip; i < array.length; i++){
      array[i] = alpha*array[i];
    }
    return array;
  }
  
describe('#Test1 (Extensions): Contextual Operators', function() {

    context('with measurement samples', function() {
        let input = data["test#1a"];
        let output = [];
        let connector;
        let adapter; 
        let context_measurement = 0;
        let context_timeout = 0;

        connector = new Subject();
        adapter = new AdapterSMIP();
        connector.subscribe(adapter);
        let accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e3ca"))
        .pipeWithContext(Measurement, map(x => {context_measurement+=1; return x}), map(x => preprocess(x, "GPS", "Robot#1")))
        .pipeWithContext(Timeout, map(x => {context_timeout+=1; return x}), map(x => log(x, "GPS", "Robot#1")))
        .pipe(estimate(new KalmanFilterEstimator(10, 2)));
        accelerometerRobot1.subscribe(x => output.push(x));

        beforeEach(function() {
            context_measurement = 0;
            context_timeout = 0;
            output = [];
        })

        it('should execute operators with measurement context', function() {
            for (var i = 0; i < input.length; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(context_measurement).to.be.equal(2);
        })

        it('should not execute operators with timeout context', function() {
            for (var i = 0; i < input.length; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(context_timeout).to.be.equal(0);
        })
    })

    context('with timeout samples', function() {
        let input = data["test#1b"];
        let output = [];
        let connector;
        let adapter; 
        let context_measurement = 0;
        let context_timeout = 0;

        connector = new Subject();
        adapter = new AdapterSMIP();
        connector.subscribe(adapter);
        let accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e3ca"))
        .pipeWithContext(Measurement, map(x => {context_measurement+=1; return x}), map(x => preprocess(x, "GPS", "Robot#1")))
        .pipeWithContext(Timeout, map(x => {context_timeout+=1; return x}), map(x => log(x, "GPS", "Robot#1")))
        .pipe(estimate(new KalmanFilterEstimator(10, 2)));
        accelerometerRobot1.subscribe(x => output.push(x));

        beforeEach(function() {
            context_measurement = 0;
            context_timeout = 0;
            output = [];
        })

        it('should execute operators with timeout context', function() {
            for (var i = 0; i < input.length; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(context_timeout).to.be.equal(2);
        })

        it('should not execute operators with measurement context', function() {
            for (var i = 0; i < input.length; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(context_measurement).to.be.equal(0);
        })
    })
})

// Tests if the estimate operator correctly converts timeout events to estimate events.
describe('#Test2 (Extensions): Estimate ', function() {

  // input --> filter --> log_timeout --> preprocess_measurement --> estimate --> output.

  context('with measurement samples', function() {
    let input = data["test#2a"];
    let output = [];
    let connector;
    let adapter; 
    let accelerometerRobot1;
    beforeEach(function() {
        output = [];
        connector = new Subject();
        adapter = new AdapterSMIP();
        connector.subscribe(adapter);
         accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e3ca"))
        .pipeWithContext(Measurement, map(x => preprocess(x, "GPS", "Robot#1")))
        .pipeWithContext(Timeout, map(x => log(x, "GPS", "Robot#1")))
        .pipe(estimate(new KalmanFilterEstimator(10, 2)));
        accelerometerRobot1.subscribe(x => output.push(x));
    })

    it('should process measurements', function() {
        for (var i = 0; i < input.length; i++){
            connector.next(JSON.stringify(input[i]));
        }
        expect(output).to.have.lengthOf(2);
    })
  })

  context('with timeout samples', function() {
    let input = data["test#2b"];
    let output = [];
    let connector;
    let adapter; 
    let accelerometerRobot1;
    beforeEach(function() {
        output = [];
        connector = new Subject();
        adapter = new AdapterSMIP();
        connector.subscribe(adapter);
         accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e3ca"))
        .pipeWithContext(Measurement, map(x => preprocess(x, "GPS", "Robot#1")))
        .pipeWithContext(Timeout, map(x => log(x, "GPS", "Robot#1")))
        .pipe(estimate(new KalmanFilterEstimator(10, 2)));
        accelerometerRobot1.subscribe(x => output.push(x));
    })

    it('should estimate missing value', function() {
        for (var i = 0; i < input.length; i++){
            connector.next(JSON.stringify(input[i]));
        }
        expect(output).to.have.lengthOf(2);
        expect(output[1].value).to.not.equal(null);
        expect(output[1].value).to.have.lengthOf(2);
        expect(output[1].value[0]).to.be.a('number');
        expect(output[1].value[1]).to.be.a('number');
    })

    it('should convert timeout context to estimate', function() {
        for (var i = 0; i < input.length; i++){
            connector.next(JSON.stringify(input[i]));
        }
        expect(output).to.have.lengthOf(2);
        expect(output[1].context).to.be.an.instanceof(Estimate);
    })
  })
}) 

// Tests if the estimate operator correctly converts timeout events to estimate events.
describe('#Test3 (Extensions): ZipWithTime', function() {

    context('with insufficient samples', function() {
        let output = [];
        let connector;
        let adapter; 
        beforeEach(function() {
          output = [];
          connector = new Subject();
          adapter = new AdapterSMIP();
          connector.subscribe(adapter);
         //Wheel encoder sensor data.
          let wheelEncoderRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e727"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Encoder", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Encoder", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10)));
  
          // Accelerometer sensor data.
          let accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e329"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Accelerometer", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Accelerometer", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10, 3)));
  
          // Gyroscope sensor data.
          let gyroscopeRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:dfe8"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Gyroscope", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Gyroscope", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10, 3)));
  
          // Correctly associate in time sensor data 
          // from Wheel Encoder, Accelerometer, and Gyroscope. 
          let zippedEncoderINSRobot1 = wheelEncoderRobot1.pipe(zipWithTime(10, accelerometerRobot1, gyroscopeRobot1));
          zippedEncoderINSRobot1.subscribe(x => output.push(x));
        })
  
        it('should not combine any events', function() {
            let input = data["test#3a"];
            for (var i = 0; i < input.length; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(output).to.have.lengthOf(0);
        })
    })

    context('with measurement samples', function() {
        let output = [];
        let connector;
        let adapter; 
        beforeEach(function() {
          output = [];
          connector = new Subject();
          adapter = new AdapterSMIP();
          connector.subscribe(adapter);
         //Wheel encoder sensor data.
          let wheelEncoderRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e727"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Encoder", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Encoder", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10)));
  
          // Accelerometer sensor data.
          let accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e329"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Accelerometer", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Accelerometer", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10, 3)));
  
          // Gyroscope sensor data.
          let gyroscopeRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:dfe8"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Gyroscope", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Gyroscope", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10, 3)));
  
          // Correctly associate in time sensor data 
          // from Wheel Encoder, Accelerometer, and Gyroscope. 
          let zippedEncoderINSRobot1 = wheelEncoderRobot1.pipe(zipWithTime(10, accelerometerRobot1, gyroscopeRobot1));
          zippedEncoderINSRobot1.subscribe(x => output.push(x));
        })
  
        it('should combine events within the time window', function() {
            let input = data["test#3b"];
            for (var i = 0; i < input.length; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(output).to.have.lengthOf(1);
        })
        it('should not combine events outisde the time window', function() {
            let input = data["test#3c"];
            for (var i = 0; i < input.length; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(output).to.have.lengthOf(0);
        })
      })

      context('with estimate samples', function() {
        let output = [];
        let connector;
        let adapter; 
        before(function() {
          output = [];
          connector = new Subject();
          adapter = new AdapterSMIP();
          connector.subscribe(adapter);
         //Wheel encoder sensor data.
          let wheelEncoderRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e727"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Encoder", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Encoder", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10)));
  
          // Accelerometer sensor data.
          let accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e329"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Accelerometer", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Accelerometer", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10, 3)));
  
          // Gyroscope sensor data.
          let gyroscopeRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:dfe8"))
          .pipeWithContext(Measurement, map(x => preprocess(x, "Gyroscope", "Robot#1")))
          .pipeWithContext(Timeout, map(x => log(x, "Gyroscope", "Robot#1")))
          .pipe(estimate(new KalmanFilterEstimator(10, 3)));
  
          // Correctly associate in time sensor data 
          // from Wheel Encoder, Accelerometer, and Gyroscope. 
          let zippedEncoderINSRobot1 = wheelEncoderRobot1.pipe(zipWithTime(10, accelerometerRobot1, gyroscopeRobot1));
          zippedEncoderINSRobot1.subscribe(x => output.push(x));
        })
  
        it('should combine events within the time window', function() {
            let input = data["test#3d"];
            for (var i = 0; i < input.length-1; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(output).to.have.lengthOf(1);
            expect(output[0].sequence).to.be.equal(0);
        })

        it('should recompute stored output after late measurement', function() {
            let input = data["test#3d"];
            connector.next(JSON.stringify(input[4]));
            expect(output).to.have.lengthOf(2);
            expect(output[1].sequence).to.be.equal(0);
        })
      })  
      
      context('with aggregate values', function() {
        let output = [];
        let connector;
        let adapter; 
        before(function() {
            output = [];
            connector = new Subject();
            adapter = new AdapterSMIP();
            connector.subscribe(adapter);
           //Wheel encoder sensor data.
            let wheelEncoderRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e727"))
            .pipeWithContext(Measurement, map(x => preprocess(x, "Encoder", "Robot#1")))
            .pipeWithContext(Timeout, map(x => log(x, "Encoder", "Robot#1")))
            .pipe(estimate(new KalmanFilterEstimator(10)));
    
            // Accelerometer sensor data.
            let accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e329"))
            .pipeWithContext(Measurement, map(x => preprocess(x, "Accelerometer", "Robot#1")))
            .pipeWithContext(Timeout, map(x => log(x, "Accelerometer", "Robot#1")))
            .pipe(estimate(new KalmanFilterEstimator(10, 3)));
    
            // Gyroscope sensor data.
            let gyroscopeRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:dfe8"))
            .pipeWithContext(Measurement, map(x => preprocess(x, "Gyroscope", "Robot#1")))
            .pipeWithContext(Timeout, map(x => log(x, "Gyroscope", "Robot#1")))
            .pipe(estimate(new KalmanFilterEstimator(10, 3)));
    
            // Correctly associate in time sensor data 
            // from Wheel Encoder, Accelerometer, and Gyroscope. 
            let zippedEncoderINSRobot1 = wheelEncoderRobot1.pipe(zipWithTime(10, accelerometerRobot1, gyroscopeRobot1));


            let gpsRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e3ca"))
            .pipeWithContext(Measurement, map(x => preprocess(x, "GPS", "Robot#1")))
            .pipeWithContext(Timeout, map(x => log(x, "GPS", "Robot#1")))
            .pipe(estimate(new KalmanFilterEstimator(10, 2)), 
                map(x => {x.value = multiplyArray(1-alpha, x.value, 0); return x}));

            let fusedEncoderINS1 = zippedEncoderINSRobot1.pipe(fuse(new DummyKalmanFilterCombinator()),
            map(x => {x.value = multiplyArray(alpha, x.value, 4); return x}));
            // Correctly associate previously fused sensor data with GPS sensor data, 
            // and compute weighted sum as final optimal position estimate.
            let optimalPositionRobot1 = fusedEncoderINS1.pipe(zipWithTime(10, gpsRobot1), sumArrays())
            optimalPositionRobot1.subscribe(x => output.push(x));
          })

          it('should combine with measurement when associated in time', function(){
            let input = data["test#3e"];
            for (var i = 0; i < input.length-1; i++){
                connector.next(JSON.stringify(input[i]));
            }
            expect(output).to.have.lengthOf(1);
          })

          it('should recompute output when stored aggregate is recomputed', function(){
            let input = data["test#3e"];
            connector.next(JSON.stringify(input[input.length-1]));
            expect(output).to.have.lengthOf(2);
            expect(output[0].sequence).to.be.equal(output[1].sequence);
          })
      })
    })

      describe('#Test4 (Extensions): Value Arithmetic', function() {
        context('with measurement samples', function() {
            let output = [];
            let connector;
            let adapter; 
            let gps = [];
            let fusion = [];
            let sum = [];
            before(function() {
              output = [];
              connector = new Subject();
              adapter = new AdapterSMIP();
              connector.subscribe(adapter);
             //Wheel encoder sensor data.
              let wheelEncoderRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e727"))
              .pipeWithContext(Measurement, map(x => preprocess(x, "Encoder", "Robot#1")))
              .pipeWithContext(Timeout, map(x => log(x, "Encoder", "Robot#1")))
              .pipe(estimate(new KalmanFilterEstimator(10)));
      
              // Accelerometer sensor data.
              let accelerometerRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e329"))
              .pipeWithContext(Measurement, map(x => preprocess(x, "Accelerometer", "Robot#1")))
              .pipeWithContext(Timeout, map(x => log(x, "Accelerometer", "Robot#1")))
              .pipe(estimate(new KalmanFilterEstimator(10, 3)));
      
              // Gyroscope sensor data.
              let gyroscopeRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:dfe8"))
              .pipeWithContext(Measurement, map(x => preprocess(x, "Gyroscope", "Robot#1")))
              .pipeWithContext(Timeout, map(x => log(x, "Gyroscope", "Robot#1")))
              .pipe(estimate(new KalmanFilterEstimator(10, 3)));
      
              // Correctly associate in time sensor data 
              // from Wheel Encoder, Accelerometer, and Gyroscope. 
              let zippedEncoderINSRobot1 = wheelEncoderRobot1.pipe(zipWithTime(10, accelerometerRobot1, gyroscopeRobot1));

              let gpsRobot1 = adapter.pipe(filter(x => x.getContext().source == "1010/9000|fd34::0017:0d00:0030:e3ca"))
              .pipeWithContext(Measurement, map(x => preprocess(x, "GPS", "Robot#1")))
              .pipeWithContext(Timeout, map(x => log(x, "GPS", "Robot#1")))
              .pipe(estimate(new KalmanFilterEstimator(10, 2)), 
                  map(x => {gps.push(x.value.slice()); x.value = multiplyArray(1-alpha, x.value, 0); gps.push(x.value); return x}));
  
              let fusedEncoderINS1 = zippedEncoderINSRobot1.pipe(fuse(new DummyKalmanFilterCombinator()),
              map(x => {fusion.push(x.value.slice()); x.value = multiplyArray(alpha, x.value, 4); fusion.push(x.value); return x}));
              // Correctly associate previously fused sensor data with GPS sensor data, 
              // and compute weighted sum as final optimal position estimate.
              let optimalPositionRobot1 = fusedEncoderINS1.pipe(zipWithTime(10, gpsRobot1), sumArrays(), map(x=>sum.push(x.value)))
              optimalPositionRobot1.subscribe(x => output.push(x));
            })
      
            it('should multiply GPS output with weight', function() {
                let input = data["test#4"];
                for (var i = 0; i < input.length; i++){
                    connector.next(JSON.stringify(input[i]));
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
