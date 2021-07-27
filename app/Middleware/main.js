
const WebSocket = require('ws');


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

//simulation
//const ws = new WebSocket('ws://localhost:3020');

//vs gateway
const ws = new WebSocket('wss://192.168.0.247:8889');

var clients = [];

const wss = new WebSocket.Server({port: 3040});

wss.on('connection', function connection(ws) {
  clients.push(ws);
});

ws.on('open', function open() {
  ws.send('Websocket connected.');
});

// distribution of potential labels, currently 70% chance for 
let timely = new Array(6).fill("");
let timeout= new Array(3).fill("timeout");
//let violation = new Array(1).fill("violation");
//labels = labels.concat(violation);

let constraints = ["0.99"];


let modifyValue = function(value, source){
  if (isNaN(value)){
    value = 10*Math.random();
  }
  if (source == "1010/9000|fd34::0017:0d00:0030:dfe8"){
    return [Math.random()*value, Math.random()*value, Math.random()*value] //Gyro
  }
  if (source == "1010/9000|fd34::0017:0d00:0030:e3ca"){
    return [Math.random()*value, Math.random()*value] //GPS
  }
  if (source == "1010/9000|fd34::0017:0d00:0030:e329"){
    return [Math.random()*value, Math.random()*value, Math.random()*value] //Accelero
  }
  if (source == "1010/9000|fd34::0017:0d00:0030:e727"){
    return Math.random()*value //Odom
  }
  if (source == "3302/5500|fd34::0017:0d00:0030:e329"){
    return [Math.random()*value, Math.random()*value, Math.random()*value] //Accelero
  }
  if (source == "8040/8042|fd34::0017:0d00:0030:dfe8"){
    return [Math.random()*value, Math.random()*value, Math.random()*value] //Gyro
  }
  if (source == "9803/9805|fd34::0017:0d00:0030:e727"){
    return Math.random()*value //Odom
  }

  if (source == "3302/5500|fd34::0017:0d00:0030:e3ca"){
    return [Math.random()*value, Math.random()*value] //GPS
  }


}


// {"identifier":"1010/9000","address":"fd34::0017:0d00:0030:e329","color":"#adff2f",
// "data":[{"unit":"%","datatype":"double","value":77.94,"measurement":"Battery level","timestamp":1614093902392750},
// {"unit":"mAh","datatype":"double","value":662,"measurement":"Battery used","timestamp":1614093902392750},
// {"unit":"mAh","datatype":"double","value":3000,"measurement":"Battery capacity","timestamp":1614093902392750},
// {"unit":"","datatype":"integer","value":0,"measurement":"Battery alarm","timestamp":1614093902392750}],
// "name":"thing9","icon":"fa-battery-full","location":"A","text":"battery","class":"sensor","mac":"00-17-0D-00-00-30-E3-29",
// "timestamp":1614093902432000}

timeouts = {};

ws.on('message', function incoming(data) {
  let message = JSON.parse(data);
  //console.log("Received message:", message);
  if (message.type == "sensor-data"){
    if (timeouts[message.contents.identifier + '|' + message.contents.address] == undefined){
      timeouts[message.contents.identifier + '|' + message.contents.address] = true;
    };
    let to_send = ""
    let rand = Math.random();
    //console.log("rand", rand);
    if (rand <= 0.5 && !timeouts[message.contents.identifier + '|' + message.contents.address]){
      message.type = "timeout";
      console.log("Timeout from", message.contents.identifier + '|' + message.contents.address);
      timeouts[message.contents.identifier + '|' + message.contents.address] = true;
      for (var i =0; i < constraints.length; i++){
        to_send = JSON.stringify({'data': message, 'constraint': constraints[i]});
        console.log('to send', to_send);
        //console.log('Khronos emitting', to_send);
        for (var i =0; i < clients.length; i ++){
          if (to_send != undefined){
            clients[i].send(to_send);
          }
        }
      }
    }
    else{
      console.log("Measurement from", message.contents.identifier + '|' + message.contents.address);
      timeouts[message.contents.identifier + '|' + message.contents.address] = false;
      message.contents.data[0].value = modifyValue(message.contents.data[0].value,message.contents.identifier + '|' + message.contents.address); // UC
      for (var i =0; i < constraints.length; i++){
        let to_send = JSON.stringify({'data': message, 'constraint': constraints[i]});
        console.log('to send', to_send);
        for (var i =0; i < clients.length; i ++){
          if (to_send != undefined){
            clients[i].send(to_send);
          }
        }
      } 
    }
  }
  
});

