import {AggregateData, MultiaryContext} from '../../types';

export class AggregateValue<T> implements AggregateData<T>{
    context: MultiaryContext;
    value: T;
    sequence: number;
    constructor(value: T, context: MultiaryContext, sequence:number){
        this.value = value;
        this.context = context;
        this.sequence = sequence;
    }

    getValue(){
        return this.value;
    }

    getContext(){
        return this.context;
    }

    getSequence(){
        return this.sequence
    }
}