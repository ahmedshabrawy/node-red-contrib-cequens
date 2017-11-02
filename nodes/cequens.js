module.exports = function (RED) {
    "use strict";

    const request = require('request-promise');

    function cequensNode(n) {
        RED.nodes.createNode(this, n);

        this.topic = n.topic;
        //this.cred = RED.nodes.getNode(n.cred);
        this.auth = this.auth = RED.nodes.getNode(n.auth)
        this.from = n.from;

        let node = this;

        this.on('input', function (msg) {
            
            console.log("from:"+this.from);
            request({
                method: 'GET',
                uri: 'http://ht.cequens.com/send.aspx',
                
                qs: {
                    'UserName': this.auth.credentials.http_username,
                    'Password': this.auth.credentials.http_password,
                    'Recipients': msg.to,
                    'SenderName': msg.from || this.from,
                    'MessageText': msg.payload,
                    'MessageType': "text" || msg.type,
                   
                },
                json: true // Automatically stringifies the body to JSON 
            }).then(function (parsedBody) {
                console.log(parsedBody);
                node.send({ topic: node.topic, payload: parsedBody });
            }).catch(function (err) {
                node.error(err);
            })
        });
    }

    RED.nodes.registerType("cequens", cequensNode);

}
