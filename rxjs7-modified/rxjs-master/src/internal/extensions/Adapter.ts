import {Subject} from "../Subject"

/**
 * A class responsible for mapping messages from the underlying IoT infrastructure to the data model of our extensions.
 * @param parse A method that contains the logic of parsing raw messages.
 * 
 * @class Adapter
 */
export class Adapter<T> extends Subject<T>{
    
    constructor(parse: (value:any) => any) {
        super();
        this.next = (v:any) => super.next(parse(v));
    }
}

 