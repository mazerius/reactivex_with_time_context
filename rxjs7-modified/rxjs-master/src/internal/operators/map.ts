import { OperatorFunction } from '../types';
import { operate } from '../util/lift';
import { OperatorSubscriber } from './OperatorSubscriber';

/**
 * Applies a given `project` function to each value emitted by the source
 * Observable, and emits the resulting values as an Observable.
 *
 * <span class="informal">Like [Array.prototype.map()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map),
 * it passes each source value through a transformation function to get
 * corresponding output values.</span>
 *
 * ![](map.png)
 *
 * Similar to the well known `Array.prototype.map` function, this operator
 * applies a projection to each value and emits that projection in the output
 * Observable.
 *
 * ## Example
 * Map every click to the clientX position of that click
 * ```ts
 * import { fromEvent } from 'rxjs';
 * import { map } from 'rxjs/operators';
 *
 * const clicks = fromEvent(document, 'click');
 * const positions = clicks.pipe(map(ev => ev.clientX));
 * positions.subscribe(x => console.log(x));
 * ```
 *
 * @see {@link mapTo}
 * @see {@link pluck}
 *
 * @param {function(value: T, index: number): R} project The function to apply
 * to each `value` emitted by the source Observable. The `index` parameter is
 * the number `i` for the i-th emission that has happened since the
 * subscription, starting from the number `0`.
 * @param {any} [thisArg] An optional argument to define what `this` is in the
 * `project` function.
 * @return {Observable<R>} An Observable that emits the values from the source
 * Observable transformed by the given `project` function.
 */
export function map<T, R>(project: (value: T, index: number) => R, thisArg?: any): OperatorFunction<T, R> {
  // optional time context to be passed along the graph.
  return operate((source, subscriber, context?:any) => {
    // The index of the value from the source. Used with projection.
    let index = 0;
    // Subscribe to the source, all errors and completions are sent along
    // to the consumer.
    source.subscribe(
      new OperatorSubscriber(subscriber, (value: T) => {
        // Call the projection function with the appropriate this context,
        // and send the resulting value to the consumer.
        //++
        // optional time context to be passed along the graph.
        subscriber.next(project.call(thisArg, value, index++));
      }, undefined, undefined, undefined, context)
    );
  });
}
