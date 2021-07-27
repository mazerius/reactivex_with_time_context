import {UnaryContext} from '../../types';

/**
 * A variant of UnaryContext that corresponds to a measurement, i.e. a sensor message that arrives on time.
 * Requires a source (sensor identifier) and generation timestamp. 
 * 
 * @class Measurement
 */
export class Measurement implements UnaryContext{

    source: string;
    timestamp: string;
    constructor(source: string, timestamp: string){
        this.source = source;
        this.timestamp = timestamp;
    }
    getSource(){
        return this.source;
    }

    getTimestamp(){
        return this.timestamp;
    }

    getUnixTimestamp():number{
        return Math.floor(new Date(this.getTimestamp()).getTime()/1000);
    }
}
