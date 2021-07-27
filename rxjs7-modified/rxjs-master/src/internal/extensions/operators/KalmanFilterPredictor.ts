const {KalmanFilter} = require('kalman-filter');
import {Predictor} from "../../types";

/**
 * A Kalman Filter based predictor that predicts a value based on past observations.
 */
export class KalmanFilterPredictor<T> implements Predictor<T> {
    observations: T[];
    length?: number;
    kFilter: any;

    constructor(length?:number, dimension?:number){
        this.observations = [];
        this.length = length;
        if (dimension){
            this.kFilter = new KalmanFilter({observation:dimension});
        }
        else{
            this.kFilter = new KalmanFilter();
        }
    }

    addObservation(value: T){
        if (this.length){
            if (this.observations.length >= this.length){
                this.observations = this.observations.slice(1,this.length);
            }
        }
        this.observations.push(value);
    }

    computeEstimate(){
        if (this.observations.length >0){
            return this.kFilter.filterAll(this.observations).pop();
        }
        else{
            return null;
        }
    }

}

