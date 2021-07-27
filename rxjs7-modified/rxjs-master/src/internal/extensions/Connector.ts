

import {Subject} from '../Subject';
import {WebSocketListener} from './WebSocketListener';

/**
 * A variant of Subject that connects to a websocket and parses incoming events, 
 * propagating them to this object's subscribers.
 * 
 * @param {string} address the IP address of the host that serves the websocket. 
 * @param {string} port the port number of the websocket to connect to
 * @param {string} protocol the protocol to use to connect to the websocket
 * @param {string} path optional path to be added to the URI of the server that this is trying to connect to.
 *
 * @class Connector<T>
 */

export class Connector<T> extends Subject<T>{

    constructor(address:string, port:string, protocol: string, path?: string) {
        super();
        const ws_subject = new WebSocketListener(address, port, protocol, path);
        let self: Connector<T> = this;
        ws_subject.subscribe({
            next: (v?: any) => self.next(v)
        });
    } 
}


    


