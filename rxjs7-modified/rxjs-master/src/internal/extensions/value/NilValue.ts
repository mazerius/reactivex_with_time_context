
import { Timeout } from '../context/Timeout';
import {Data} from '../../types';


export class NilValue implements Data<null>{
    context: Timeout;
    value: null;
    constructor(source: string, timestamp: string){
        this.value = null;
        this.context = new Timeout(source, timestamp);
    }

    getValue(){
        return this.value;
    }

    getContext(){
        return this.context;
    }

}
