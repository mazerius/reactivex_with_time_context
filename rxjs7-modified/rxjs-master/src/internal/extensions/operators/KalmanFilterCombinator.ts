const {KalmanFilter} = require('kalman-filter');
import {Combinator, Data, Context, MultiaryContext} from "../../types";
import {ZippedValue} from "../value/ZippedValue"
import {AggregateValue} from "../value/AggregateValue"

/**
 * A Kalman Filter based combinator that converts zipped values (output of zipWithTime) to aggregate. 
 */
export class KalmanFilterCombinator<T> implements Combinator<T> {
    
    kFilter: any;
    observations: T[][]

    constructor(filter: any){
       this.kFilter = filter;
       this.observations = [];
    }

    extractValues(data: Data<T>[]): T[]{
        let result = []
        for (var i = 0; i < data.length; i++){
            result.push(data[i].getValue());
        }
        return result;
    }

    extractContext(data: Data<T>[]): MultiaryContext{
        let result = []
        for (var i = 0; i < data.length; i++){
            result.push(data[i].getContext());
        }
        return result;
    }


    combine(value: ZippedValue<T>): AggregateValue<T>{
        this.observations.push(this.extractValues(value.getContents()));
        let output = this.kFilter.filterall(this.observations).pop();
        let context = this.extractContext(value.getContents());
        let result = new AggregateValue(output, context, value.getSequence());
        return result;
    }

}

