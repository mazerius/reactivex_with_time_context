import {UnaryContext} from '../../types';

/**
 * A variant of UnaryContext that corresponds to a timeout, occuring when a sensor message does not arrive on time.
 * Requires a source (sensor identifier) and generation timestamp. 
 * 
 * @class Timeout
 */
export class Timeout implements UnaryContext{

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

    getUnixTimestamp(){
        return Math.floor(new Date(this.getTimestamp()).getTime()/1000);
    }
}
