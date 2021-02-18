const axios = require("axios")

require('dotenv').config();
const clientRegistry = require("./clientRegistry");
const NodeClient = require('nclient-lib');
const ss = require('socket.io-stream');

global.getDeviceId = (params, ack) => {
    ack(NodeClient.deviceId)
}

module.exports =  {
    // eslint-disable-next-line no-unused-vars
    processSocket(client) {

        client.on("disconnect", function () {
            // eslint-disable-next-line no-undef
            clientRegistry.remove(client);
            //eslint-disable-next-line no-console
            console.log('disconnected client');
        });

        client.on('execNodeMethod', (payload, cb) => {
            let method = payload.method
            let deviceId = payload.to
            let params = payload.params
            console.log(`Received execNodeMethod method: ${method} to deviceId=${deviceId} `);
            NodeClient.execNodeMethod(deviceId, method, params,cb ? function(data){
                cb(data)
            } :  null)
        });

        client.on('setConnection',(conn, ack)=>{
            console.log(`Received set connection ${conn}`);
            NodeClient.socket.close();
            NodeClient.connect(conn);
            ack(conn);
        });

        client.on('readConfig',(params, ack)=>{
            let module = params.module
            let file = params.file
            let res = NodeClient.readConfig(module, file)
            ack(res);
        });

        ss(client).on('streamMessage', function(stream, data, ack) {
            console.log(`Stream request`);
            let clientStream = ss.createStream({objectMode:true});
            clientStream.pipe(stream);
            data.from = NodeClient.deviceId;
            ss(NodeClient.socket).emit('streamMessage', clientStream, data, typeof ack === "function" ? function(res){
                ack(res);
            } : null);
            clientStream.on('data', function(data){
                //console.log(`Transfered: ${data.toString()} connected=${stream.socket.sio.connected}`);
            });
            stream.on('unpipe', function() {
                console.log('unpipe');
                clientStream.end();
            });
        });

        ss(client).on('execNodeStream',(method, stream, deviceId, params, ack)=>{
            if(deviceId == NodeClient.deviceId) {
                try {
                    console.log(`Received execNodeStream ${method}`)
                    let fn = global[method]
                    if(!fn) {
                        fn = NodeClient.methods[method]
                    }
                    if(typeof fn !== 'function') {
                        console.log(`Method ${method} not found`);
                        ack({error:{message:`Method ${method} not found`, code:'DEVICE_METHOD_NOT_FOUND'}});
                        return;
                    }
                    ack(fn(stream, params, ack));
                } catch(e) {
                    let res = {error:{message:e.message, stack:e.stack, code:'DEVICE_METHOD_ERROR'}};
                    ack(res);
                }
            } else {
                //send to remote device
                NodeClient.execNodeStream(stream, method, deviceId, params, ack);
            }
        });

        ss(client).on('requestClientStream',(method, stream, params, ack)=>{
            NodeClient.execNodeStream(stream, method, params, ack)
        });

        this.execNodeStream(client, 'listClients');
        this.execNodeStream(client, 'getWorkers');

        client.on('getUrl', (url, ack)=> {
            console.log('call getUrl', url)
            axios.get(url).then((res) => {
                ack(res.data)
            });
        });

        client.on('execClientMethod', (payload, ack)=> {
            let method = payload.method
            let params = payload.params
            let fn = global[method]
            if(typeof fn !== "undefined") {
                const isAsync = (fn.constructor.name === "AsyncFunction");
                if(isAsync) {
                    new Promise(async resolve => {
                    let res = global[method](params)
                        resolve(res)
                    }).then(res=>{
                    ack(res)
                    })
                } else {
                    global[method](params, ack)
                }
            } else {
                ack({error:{message: `Client method ${method} not found`, status: 'CLIENT_METHOD_NOT_FOUND'}})
            }
        });

        client.on('socketEmit', (params, ack)=> {
            console.log('socketEmit', params)
            NodeClient.emit('execNodeMethod', params, ack)
        })
    },



    execNodeStream(client, method) {
        ss(client).on(method,(stream, deviceId, params, ack)=>{
            NodeClient.execNodeStream(stream, method, deviceId, params, ack);
        });
    }
}
