import {Zipped, Data} from '../../types';

export class ZippedValue<T> implements Zipped<T>{
    contents: Data<T>[];
    sequence: number;

    constructor(contents: Data<T>[], sequence: number){
        this.contents = contents;
        this.sequence = sequence;
    }

    getContents(): Data<T>[]{
        return this.contents;
    }

    getSequence(): number{
        return this.sequence;
    }

}