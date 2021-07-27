import {Subscriber} from '../../Subscriber';
import {Data, Predictor} from '../../types';
import { UnaryValue } from '../value/UnaryValue';
import { NilValue } from '../value/NilValue';
import { Prediction } from '../context/Prediction';


/**
 * A generic helper for allowing operators to be created with a Subscriber and
 * use closures to capture neceessary state from the operator function itself.
 * This helper utilizes an predictor, which it uses to generate predictions when receiving a NilValue.
 */
export class PredictOperatorSubscriber<T> extends Subscriber<Data<T>> {
  /**
   * Creates an instance of an `OperatorSubscriber`.
   * @param predictor: A predictor that maintains state and computes predictions at command.
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

  estimator: Predictor<T>;
  

  constructor(
    predictor: Predictor<T>,
    destination: Subscriber<any>,
    onNext?: (value: Data<any>) => void,
    onError?: (err: any) => void,
    onComplete?: () => void,
    private onFinalize?: () => void,
    context?: any,
  ){
    super(destination, context);
    this.estimator = predictor;
    if (onNext) {
      if (this.context == undefined){
        this._next = function (value: Data<any>) {
          try {
            // if value not absent, i.e. not a timeout, add value to state of predictor and forward.
            if (value instanceof UnaryValue){
                this.estimator.addObservation(value.getValue());
                onNext(value);
            }
            // else predict and replace missing value using the predictor, then forward.
            else{
                let v = this.estimator.computeEstimate();
                if (v != null){
                  onNext(new UnaryValue(v, new Prediction((value as NilValue).getContext().getSource(), (value as NilValue).getContext().getTimestamp())));
                }
            }
          } catch (err) {
            this.destination.error(err);
          }
        };
      }
      else{
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

