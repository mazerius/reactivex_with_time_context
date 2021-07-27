import {Data, UnaryContext} from '../../types';

export class UnaryValue<T> implements Data<T>{
    context: UnaryContext;
    value: T;
    constructor(value: T, context: UnaryContext){
        this.value = value;
        this.context = context;
    }

    getValue(){
        return this.value;
    }

    getContext(){
        return this.context;
    }
}