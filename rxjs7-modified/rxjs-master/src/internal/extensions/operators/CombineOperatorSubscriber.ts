import {Subscriber} from '../../Subscriber';
import {Data, Combinator} from '../../types';
import { ZippedValue } from '../value/ZippedValue'; 


/**
 * A generic helper for allowing operators to be created with a Subscriber and
 * use closures to capture neceessary state from the operator function itself.
 * This helper utilizes an combinator, which it uses to combine received input.
 */
export class CombineOperatorSubscriber<T> extends Subscriber<Data<T>> {
  /**
   * Creates an instance of an `OperatorSubscriber`.
   * @param combinator: An combinator that combines input events together into a single output.
   * @param destination The downstream subscriber.
   * @param onNext Handles next values, only called if this subscriber is not stopped or closed. Any
   * error that occurs in this function is caught and sent to the `error` method of this subscriber.
   * @param onError Handles errors from the subscription, any errors that occur in this handler are caught
   * and send to the `destination` error handler.
   * @param onComplete Handles completion notification from the subscription. Any errors that occur in
   * this handler are sent to the `destination` error handler.
   * @param onFinalize Additional teardown logic here. This will only be called on teardown if the
   * subscriber itself is not already closed. This is called after all other teardown logic is executed.
   */

  combinator: Combinator<T>;
  

  constructor(
    combinator: Combinator<T>,
    destination: Subscriber<any>,
    onNext?: (value: Data<any>) => void,
    onError?: (err: any) => void,
    onComplete?: () => void,
    private onFinalize?: () => void,
    context?: any,
  ){
    super(destination, context);
    this.combinator = combinator;
    if (onNext) {
      if (this.context == undefined){
        this._next = function (value: Data<any>) {
          try {
            if (value instanceof ZippedValue){
                let newValue = this.combinator.combine(value);
                onNext(newValue);
            }
          } catch (err) {
            this.destination.error(err);
          }
        };
      }
      else{
        // if context exists, then only perform operation if it matches this operators context.
        this._next = function (value: any) {
          try {
            if (value.getContext() instanceof context){
              onNext(value);
            }
            else{
              this.destination.next(value);
            }
          } catch (err) {
            this.destination.error(err);
          }
        };
      }
    }
    if (onError) {
      this._error = function (err) {
        try {
          onError(err);
        } catch (err) {
          // Send any errors that occur down stream.
          this.destination.error(err);
        }
        // Ensure teardown.
        this.unsubscribe();
      };
    }
    if (onComplete) {
      this._complete = function () {
        try {
          onComplete();
        } catch (err) {
          // Send any errors that occur down stream.
          this.destination.error(err);
        }
        // Ensure teardown.
        this.unsubscribe();
      };
    }
  }

  unsubscribe() {
    const { closed } = this;
    super.unsubscribe();
    // Execute additional teardown if we have any and we didn't already do so.
    !closed && this.onFinalize?.();
  }
}

