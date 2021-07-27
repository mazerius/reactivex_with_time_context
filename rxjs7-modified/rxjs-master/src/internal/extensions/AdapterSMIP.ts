import {Adapter} from "./Adapter"
import {UnaryValue} from "./value/UnaryValue";
import {NilValue} from "./value/NilValue";
import {Measurement} from "./context/Measurement";

//{"data":{"contents":{"identifier":"1010/9000","address":"fd34::0017:0d00:0030:e3ca","color":"#adff2f","data":[{"unit":"%","datatype":"double","value":80.88,"measurement":"Battery level","timestamp":1614158010973750},{"unit":"mAh","datatype":"double","value":574,"measurement":"Battery used","timestamp":1614158010973750},{"unit":"mAh","datatype":"double","value":3000,"measurement":"Battery capacity","timestamp":1614158010973750},{"unit":"","datatype":"integer","value":0,"measurement":"Battery alarm","timestamp":1614158010973750}],"name":"thing6","icon":"fa-battery-full","location":"-","text":"battery","class":"sensor","mac":"00-17-0D-00-00-30-E3-CA","timestamp":1614158011042000},"type":"sensor-data"},"constraint":"0.99"}

/**
 * A variant of Adapter responsible for mapping messages from the underlying IoT infrastructure to the data model of our extensions.
 * The parse method for a SmartMesh IP network is included in this implementation. 
 * 
 * @class AdapterSMIP
 */
export class AdapterSMIP<T> extends Adapter<T>{

    constructor() {
        function parse(value: string): NilValue | UnaryValue<T> {
            let message = JSON.parse(value);

            if (message.data.type == "timeout"){
                return new NilValue(message.data.contents.identifier + '|' + message.data.contents.address, new Date(message.data.contents.timestamp/1000).toISOString());
            }
            else{
                return new UnaryValue(message.data.contents.data[0].value as T, new Measurement(message.data.contents.identifier + '|' + message.data.contents.address, new Date(message.data.contents.timestamp/1000).toISOString()));
            }
        }
        super(parse);
    }
}

