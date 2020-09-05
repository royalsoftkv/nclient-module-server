const axios = require("axios")

require('dotenv').config();
const clientRegistry = require("./clientRegistry");
const NodeClient = require('nclient-lib');
const ss = require('socket.io-stream');

module.exports =  {
    // eslint-disable-next-line no-unused-vars
    processSocket(client) {

        client.on("disconnect", function () {
            // eslint-disable-next-line no-undef
            clientRegistry.remove(client);
            //eslint-disable-next-line no-console
            console.log('disconnected client');
            //NodeClient.sendRequest({to:CONNECT_NODE,message:'disconnectedClient',params:client.id});
        });

        client.on('requestDeviceMethod', (method, deviceId,...params) => {
            console.log(`Received requestDeviceMethod method: ${method} to deviceId=${deviceId} `);
            let ack;
            if(typeof params[params.length-1] === 'function') {
                ack = params.pop();
                if(params.length === 1) {
                    params =params[0];
                }
            }
            NodeClient.sendRequest({method: method, to: deviceId, payload: params}, ack ? function(data){
                ack(data);
            } :  null);
        });

        client.on('setConnection',(conn, ack)=>{
            console.log(`Received set connection ${conn}`);
            NodeClient.socket.close();
            NodeClient.connect(conn);
            ack(conn);
        });

        client.on('readConfig',(module, file, ack)=>{
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

        ss(client).on('requestDeviceStream',(method, stream, deviceId, params, ack)=>{
            NodeClient.sendStreamRequest(stream, method, deviceId, params, ack);
        });

        this.requestDeviceStream(client, 'listClients');
        this.requestDeviceStream(client, 'getWorkers');

        client.on('getUrl', (url, ack)=> {
            console.log('call getUrl', url)
            axios.get(url).then((res) => {
                ack(res.data)
            });
        });

        client.on('execClientMethod', (method, params, ack)=> {
            if(typeof global[method] !== "undefined") {
                let res = global[method](params)
                ack(res)
            }
        })
    },



    requestDeviceStream(client, method) {
        ss(client).on(method,(stream, deviceId, params, ack)=>{
            NodeClient.sendStreamRequest(stream, method, deviceId, params, ack);
        });
    }
}
