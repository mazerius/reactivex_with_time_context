const {KalmanFilter} = require('kalman-filter');
import {ZippedValue} from "../value/ZippedValue"
import {AggregateValue} from "../value/AggregateValue"
import {KalmanFilterCombinator} from './KalmanFilterCombinator';

/**
 * A variant of the KalmanFiltercombinator class that combines input from multiple sensors into output of the correct format.
 * The concrete implementation of a Kalman Filter for the swarm robotics use case described in the paper is out of scope.
 * Thus, this class combines the input in a trivial way, as the focus is on generating output of the correct format to evaluate the
 * semantics of our extensions.
 * 
 * for UC, the KF should have the following properties: 
 * input: [o, [g_x, g_y, g_z], [a_x, a_y, a_z]]
 *   where o the wheel encoder reading (unit: meters),
 *        g_x the gyroscope reading on the x-axis (unit: deg/s)
 *        a_x the accelerometer reading on the x-axis (unit: milliG)
 *        output: [ax ay vx vy x y]
 *   where ax the acceleration on the x-axis (units: m/s^2)
 *          ay the acceleration on the y-axis (units: m/s^2)
 *          vx the velocity on the x-axis (units: m/s)
 *          vy the velocity on the y-axis (units: m/s)
 *         x the x coordinates
 *         y the y coordinates
 */
export class DummyKalmanFilterCombinator<T> extends KalmanFilterCombinator<T>{
    

    

    constructor(filter: any){
       super(filter);
    }

    combine(value: ZippedValue<T>): AggregateValue<any>{
        this.observations.push(this.extractValues(value.getContents()));
        let context = this.extractContext(value.getContents());
        let output = [Math.random()*10, Math.random()*10, Math.random()*10, Math.random()*10, Math.random()*10, Math.random()*10]
        let result = new AggregateValue(output, context, value.getSequence());
        return result;
    }
}

