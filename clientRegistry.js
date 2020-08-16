module.exports = {

    clients: {},

    add(client) {
        this.clients[client.id] = client;
    },

    remove(client) {
        delete this.clients[client.id];
    },

    get(clientid) {
        return this.clients[clientid];
    }

}
