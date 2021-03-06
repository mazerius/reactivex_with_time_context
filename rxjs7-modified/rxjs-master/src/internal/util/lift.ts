import { Observable } from '../Observable';
import { Subscriber } from '../Subscriber';
import { OperatorFunction } from '../types';
import { isFunction } from './isFunction';

/**
 * Used to determine if an object is an Observable with a lift function.
 */
export function hasLift(source: any): source is { lift: InstanceType<typeof Observable>['lift'] } {
  return isFunction(source?.lift);
}

/**
 * Creates an `OperatorFunction`. Used to define operators throughout the library in a concise way.
 * @param init The logic to connect the liftedSource to the subscriber at the moment of subscription.
 */
export function operate<T, R>(
  init: (liftedSource: Observable<T>, subscriber: Subscriber<R>, label?:string) => (() => void) | void
): OperatorFunction<T, R> {
  //++
  // optional time context from pipeArray to map (or other operator)...
  return (source: Observable<T>, context?: any) => {
    if (hasLift(source)) {
      return source.lift(function (this: Subscriber<R>, liftedSource: Observable<T>) {
        try {
          return init(liftedSource, this, context);
        } catch (err) {
          this.error(err);
        }
      });
    }
    throw new TypeError('Unable to lift unknown Observable type');
  };
}
