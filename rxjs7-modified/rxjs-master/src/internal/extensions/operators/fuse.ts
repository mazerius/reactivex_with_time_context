import { OperatorFunction, Data } from '../../types';
import { operate } from '../../util/lift';
import { CombineOperatorSubscriber } from './CombineOperatorSubscriber';
import { Combinator } from '../../types';


/**
 * An operator that fuses together events using a combinator.
 * @param {any} combinator a Combinator object that contains the logic to combine events together into a single aggregate output.
 */
export function fuse<T>(combinator: Combinator<T>): OperatorFunction<Data<T>,Data<T>> {
  return operate((source, subscriber, context?:any) => {
        source.subscribe(
      new CombineOperatorSubscriber(combinator, subscriber, (value: Data<T>) => {
        subscriber.next(value);
      }, undefined, undefined, undefined, context)
    );
  });
}
