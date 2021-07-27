Reactive Programming Extensions for Time-Sensitive IoT Applications
Source code corresponding to my research paper "Reactive Programming Extensions for Time-Sensitive IoT Applications", accepted at IoTI4, the 3rd International Workshop on IoT Applications and Industry 4.0.
The source code consists of two folders: rxjs7_modified and app.
The first folder contains the extended RxJS library, and the second folder contains the application files that utilize the library to implement the swarm robotics use case that is described in the paper. An overview of the file structure can be found in the paper. For modified files of the original library, we have indicated the modification with the following comment: "//++".
To set it all up, you first need to download the modified library, and run the command "npm install" within the rxjs-master subfolder, and then run "npm run compile".
Next, you need to download the "app" folder. The "test" subfolder contains the test suites for use case implementations, which were used to verify that both implementations produce the same output for the same input, i.e. that they are functionally equivalent.
The "index.js" and "index_without_extensions.js" files correspond to the implementation of the use with and without our extensions.
The "Middleware" subfolder contains a simple script that mimics the behavior of a time management middleware, automatically determining timeouts for sensor messages. Note that this is a dummy implementation for the purpose of demonstrating the reactive extensions. A real implementation of this middleware, along with deployment instructions, can be found in the repository corresponding to my past research paper: "Khronos: middleware for simplified time management in Cyber Phyiscal Systems". Link: https://github.com/mazerius/khronos.
To execute the application, simply run the command "npm start" after starting up the middleware. Make sure that the address and port of the middleware correspond to those specified in the "index.js" and "index_without_extensions.js" scripts.


