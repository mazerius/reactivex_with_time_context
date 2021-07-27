import { OperatorFunction, Data } from '../../types';
import { operate } from '../../util/lift';
import { PredictOperatorSubscriber } from './PredictOperatorSubscriber';
import { Predictor } from '../../types';


/**
 * An operator that predicts an event using a predictor.
 * @param {Predictor} predictor a Predictor object that contains the logic to predict events.
 */
export function predict<T>(predictor: Predictor<T>): OperatorFunction<Data<T>,Data<T>> {
  return operate((source, subscriber, context?:any) => {
    source.subscribe(
      new PredictOperatorSubscriber(predictor, subscriber, (value: Data<T>) => {
        subscriber.next(value);
      }, undefined, undefined, undefined, context)
    );
  });
}
