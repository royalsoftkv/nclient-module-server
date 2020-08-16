const NodeClient = require('nclient-lib')
const express = require('express')
const clientRegistry  = require("./clientRegistry")
const socketHandler = require("./socketHandler")

module.exports = {
    moduleInfo: NodeClient.readModuleInfo(require('./package.json')),
    serve: (path, dir) => {
        console.log(`Serving web app path: ${path} dir=${dir}`)
        app.use(path, express.static(dir))
    }
}

const app = express()
const server = require('http').createServer(app)
const io = require('socket.io').listen(server)
server.listen(3000)

server.on('listening', () => {
    console.log(`Started server`,server.address())
})

io.on("connection", client => {
    // eslint-disable-next-line no-console
    console.log('connected client remote='+NodeClient.socket.io.uri);
    client.emit('connectionUrl',NodeClient.socket.io.uri);
    clientRegistry.add(client);
    socketHandler.processSocket(client);
});

global.io = io
global.app = app
