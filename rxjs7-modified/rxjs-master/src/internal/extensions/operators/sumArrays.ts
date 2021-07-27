import { OperatorFunction, MonoTypeOperatorFunction, Data, MultiaryContext } from '../../types';
import { operate } from '../../util/lift';
import { OperatorSubscriber } from '../../operators/OperatorSubscriber';
import { ZippedValue } from '../value/ZippedValue';
import { AggregateValue } from '../value/AggregateValue';


/**
 * 
 * An operator to sum the arrays combined by zipWithTime in the UC, as shown in the OPE subgraph.
 */
export function sumArrays<T>(): OperatorFunction<ZippedValue<T[]>, AggregateValue<T[]>> {
  return operate((source, subscriber, context?:any) => {
    // The index of the value from the source. Used with projection.
    let index = 0;
    // Subscribe to the source, all errors and completions are sent along
    // to the consumer.
    source.subscribe(
      new OperatorSubscriber(subscriber, (value: ZippedValue<T[]>) => {
        // Call the projection function with the appropriate this context,
        // and send the resulting value to the consumer.
        let maxLength = 0;
        let arrays = [];
        for (var i = 0; i < value.getContents().length; i++){
            if (value.getContents()[i].getValue().length > maxLength){
                maxLength = value.getContents()[i].getValue().length;
            }
        }
        for (var j = 0; j < value.getContents().length; j++){
            if (value.getContents()[j].getValue().length < maxLength){
                arrays.push(new Array(maxLength - value.getContents()[j].getValue().length).fill(0).concat(value.getContents()[j].getValue()));
            }
            else{
                arrays.push(value.getContents()[j].getValue());
            }      
        }
        let result = new Array(maxLength).fill(0);
        for (var i =0; i< maxLength; i++){
            for (var j = 0; j<arrays.length; j++){
                result[i] += arrays[j][i];
            }
        }

        let extractContext = function(data: Data<T[]>[]): MultiaryContext{
            let result = []
            for (var i = 0; i < data.length; i++){
                result.push(data[i].getContext());
            }
            return result;
        }
        subscriber.next(new AggregateValue(result, extractContext(value.getContents()), value.getSequence()));
      }, undefined, undefined, undefined, context)
    );
  });
}
