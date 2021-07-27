import { Subject } from '../Subject';
const WebSocket = require('ws');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


/**
 * A variant of Subject that connects and listens to a websocket, calling next() on its subscribers
 * whenever a message is received.
 * @param {string} address the IP address of the host that serves the websocket. 
 * @param {string} port the port number of the websocket to connect to
 * @param {string} protocol the protocol to use to connect to the websocket
 * @param {string} path optional path to be added to the URI of the server that this is trying to connect to.
 *
 * @class WebSocketListener<T>
 */
export class WebSocketListener<T> extends Subject<T> {
 address: string;
 port: string;

    constructor(address: string, port: string, protocol: string, path? :string) {
        super();
        this.address = address;
        this.port = port;
        let input:WebSocketListener<T> = this; 
        let ws = undefined;
        let uri = protocol + '://' + address + ':' + port;
        if (path){
            uri +=path;
        }
        ws = new WebSocket(uri);
        
        ws.on('open', function open() {
            console.log('Websocket connected.');
        });

        ws.on('message', function incoming(data: T) {
            input.next(data);
        })
        ws.on('error', function open() {
            console.log('Websocket Error.');
        });        
    }
}
