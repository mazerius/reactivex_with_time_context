import { Observable } from '../../Observable';
import { Data} from '../../types';
import { innerFrom } from '../../observable/from';
import { argsOrArgArray } from '../../util/argsOrArgArray';
import { EMPTY } from '../../observable/empty';
import { OperatorSubscriber } from '../../operators/OperatorSubscriber';
import { popResultSelector } from '../../util/args';
import { UnaryValue} from '../value/UnaryValue';
import { Measurement} from '../context/Measurement';
import { Prediction} from '../context/Prediction';
import { ZippedValue } from '../value/ZippedValue';
import { AggregateValue } from '../value/AggregateValue';


/**
 * Combines multiple Observables to create an Observable whose values are calculated from the values, in order, of each
 * of its input Observables based on their time context. 
 * zipWithTime utilizes backtracking to find safe combinations of events from multiple input observables, i.e. events that are generated 
 * within the specified timeWindow.
 * 
 * @param {number} timeWindow The time window within which events from input observables are safe to combine. 
 * @param {unknown[]} args A sequence of input observables.
 * 
 * @return {Observable<R>}
 */
export function zipTime<T>(timeWindow: number, ...args: unknown[]): Observable<unknown> {
  const resultSelector = popResultSelector(args);


  let flatten = function(array: any[]){
    let depth = 1;
    let isFlattened = false;
    while(!isFlattened){
      array = array.flat(depth);
      let depthBefore = depth;
      for (var i = 0; i < array.length; i++){
        if (Array.isArray(array[i])){
          depth+=1;
          break
        }
      if (depthBefore == depth){
        isFlattened = true;
      }
    }
  }
  return array;
  }

  // A utility function to check if an element can be safely combined (correctly associated) with elements from other sources.
  let isSafe = function(element: Data<any>, elements: Data<any>[], timeWindow:number){
    if (element instanceof UnaryValue){
      for (var i = 0; i < elements.length; i++){
        // we only care for measurements, predictions are assumed to be generated within timeWindow.
        if (elements[i] instanceof UnaryValue){
          // safe to combine with UnaryValue if Prediction or Measurement whose generation timestamp is within time window.
          if (elements[i].getContext() instanceof Measurement){
            if (Math.abs((element as UnaryValue<any>).getContext().getUnixTimestamp() - (elements[i] as UnaryValue<any>).getContext().getUnixTimestamp()) > timeWindow){
              return false;
            }
          }
        }
        if (elements[i] instanceof AggregateValue){          
          // safe to combine with AggregateValue if all generation timestamps within time window.
          let contexts = flatten((elements[i] as AggregateValue<any>).getContext()); 
          for (var j = 0; j < contexts.length; j++){
            if (Math.abs((element as UnaryValue<any>).getContext().getUnixTimestamp() - contexts[j].getUnixTimestamp()) > timeWindow){
              return false;
            }
          }
        }    
      }
    }
    if (element instanceof AggregateValue){
      let contexts = flatten((element as AggregateValue<any>).getContext());
      for (var c = 0; c < contexts.length; c++){
        let timestamp = contexts[c].getUnixTimestamp();
        for (var i = 0; i < elements.length; i++){
          // we only care for measurements, predictions are assumed to be generated within timeWindow.
          if (elements[i] instanceof UnaryValue){
            if (elements[i].getContext() instanceof Measurement){
              if (Math.abs(timestamp - (elements[i] as UnaryValue<any>).getContext().getUnixTimestamp()) > timeWindow){
                return false;
              }
            }
          }
          if (elements[i] instanceof AggregateValue){ 
            let contexts = flatten((elements[i] as AggregateValue<any>).getContext());
            for (var j = 0; j < contexts.length; j++){
              if (Math.abs(timestamp - contexts[j].getUnixTimestamp()) > timeWindow){
                return false;
              }
            }
          }    
        }
      }
    }
    return true;
  }

  // # This function solves the problem of correctly associating elements from different sources.
  
  let solve = function(buffers: Data<any>[][]){
    let result: Data<any>[] = [];
    let indices: number[] = [];
    let N = buffers.length;
    if (solveUtil(N, buffers, result, indices) == false){
      return [false, result, indices];
    }
    return [true, result, indices] 
  }

  let solveUtil = function(N: number, buffers: Data<any>[][], result: Data<any>[], indices: number[]){
    // base case
    if (result.length == N){
      return true
    }
    let buffer = buffers[0];
    for (var i = 0; i < buffer.length; i++){
      if (isSafe(buffer[i], result, timeWindow)){
        result.push(buffer[i]);
        indices.push(i);
        if (solveUtil(N, buffers.slice(1, buffers.length), result, indices)){
          return true;
        }
        result.pop();
        indices.pop();
      }
    }
    return false;
  }

  // checks if there is a value with context Prediction in given array of unary values
  let estimateIn = function(values:Data<T>[]): boolean{
    for (var i = 0; i<values.length; i++){
      if (values[i] instanceof AggregateValue){
        let contexts = flatten((values[i] as AggregateValue<any>).getContext()); 
        for (var j = 0; j < contexts.length; j++){
          if (contexts[j] instanceof Prediction){
            return true;
          }
        }
      }
      if (values[i] instanceof UnaryValue){
        if (values[i].getContext() instanceof Prediction){
          return true;
        }
      }
    }
    return false;
  }


  const sources = argsOrArgArray(args) as Observable<unknown>[];
  let cnter = 0;
  let store: ZippedValue<T>[] = [];

  return sources.length
    ? new Observable<ZippedValue<T>>((subscriber) => {
        // A collection of buffers of values from each source.
        // Keyed by the same index with which the sources were passed in.
        let buffers: unknown[][] = sources.map(() => []);

        // An array of flags of whether or not the sources have completed.
        // This is used to check to see if we should complete the result.
        // Keyed by the same index with which the sources were passed in.
        let completed = sources.map(() => false);

        // When everything is done, release the arrays above.
        subscriber.add(() => {
          buffers = completed = null!;
        });
        // Loop over our sources and subscribe to each one. The index `i` is
        // especially important here, because we use it in closures below to
        // access the related buffers and completion properties
        for (let sourceIndex = 0; !subscriber.closed && sourceIndex < sources.length; sourceIndex++) {
          innerFrom(sources[sourceIndex]).subscribe(
            new OperatorSubscriber(
              subscriber,
              (value) => {
                // check if new value is late, by comparing its timestamp 
                // against the timestamps of measurements stored in store.
                // if late, then replace prediction with measurement in store
                // and emit new output to subscriber, using old sequence number.
                let late = false;
                if ((value as UnaryValue<T>).getContext() instanceof Measurement){
                  for (var i = 0; i<store.length; i++){
                    let stored = store[i];
                    if (stored.getContents()[sourceIndex].getContext() instanceof Prediction){
                      let temp = stored.getContents().slice()
                      temp.splice(sourceIndex);
                      if (isSafe(value as UnaryValue<T>, temp as UnaryValue<T>[], timeWindow)){
                        late = true;
                        stored.getContents()[sourceIndex] = value as UnaryValue<T>;
                        subscriber.next(stored);
                        if (!estimateIn(stored.getContents() as UnaryValue<T>[])){
                          store.splice(i);
                        }
                      }
                    }
                  }
                }
                // if multiary context
                if ((value as AggregateValue<T>).getContext().length != undefined){
                  for (var i = 0; i<store.length; i++){
                    let stored = store[i];
                    if ((stored.getContents()[sourceIndex] as AggregateValue<T>).getSequence() == (value as AggregateValue<T>).getSequence()){
                      let temp = stored.getContents().slice()
                      temp.splice(sourceIndex);
                      if (isSafe(value as UnaryValue<T>, temp as UnaryValue<T>[], timeWindow)){
                        late = true;
                        stored.getContents()[sourceIndex] = value as AggregateValue<T>;
                        subscriber.next(stored);
                        if (!estimateIn(stored.getContents() as AggregateValue<T>[])){
                          store.splice(i);
                        }
                      }
                    }
                  }
                }
                if (!late){
                  buffers[sourceIndex].push(value);
                  // if every buffer has at least one value in it, then we
                  // can shift out the oldest value from each buffer and emit
                  // them as an array.
                  if (buffers.every((buffer) => buffer.length)) {
                    let toCombine = solve(buffers as Data<T>[][]);
                    let solutionExists = toCombine[0];
                    let values = toCombine[1];
                    let indices = toCombine[2];
                    if (solutionExists){
                      // remove combined elements from corresponding buffers.
                      for ( var k = 0; k < buffers.length; k++){
                        buffers[k].splice((indices as number[])[k]);
                      }
                      let result = new ZippedValue(values as Data<T>[], cnter);
                      if (estimateIn(values as Data<T>[])){
                        store.push(result);
                      }
                      subscriber.next(result);
                      cnter+=1;
                      if (buffers.some((buffer, i) => !buffer.length && completed[i])) {
                        subscriber.complete();
                      }
                    }
                  }
                }          
              },
              // Any error is passed through the result.
              undefined,
              () => {
                // This source completed. Mark it as complete so we can check it later
                // if we have to.
                completed[sourceIndex] = true;
                // But, if this complete source has nothing in its buffer, then we
                // can complete the result, because we can't possibly have any more
                // values from this to zip together with the other values.
                !buffers[sourceIndex].length && subscriber.complete();
              }
            )
          );
        }

        // When everything is done, release the arrays above.
        return () => {
          buffers = completed = null!;
        };
      })
    : EMPTY;
}
