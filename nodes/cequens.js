module.exports = function (RED) {
    "use strict";

    const request = require('request-promise');

    function cequensNode(n) {
        RED.nodes.createNode(this, n);

        this.topic = n.topic;
        this.cred = RED.nodes.getNode(n.cred);
        this.auth = this.auth = RED.nodes.getNode(n.auth)

        let node = this;

        this.on('input', function (msg) {
            request({
                method: 'GET',
                uri: 'http://ht.cequens.com/send.aspx',
                header: {"Content-Type":"application/x-www-form-urlencoded"},
                body: {
                    'UserName': this.auth.credentials.http_username,
                    'Password': this.auth.credentials.http_password,
                    'Recipients': this.cred.number,
                    'SenderName': this.cred.from,
                    'MessageText': msg.payload,
                    'MessageType': "text",
                    'dlrurl': "http://34.193.214.175:1880/dlr?nodeid="+msg._msgid
                },
                json: false // Automatically stringifies the body to JSON 
            }).then(function (parsedBody) {
                node.send({ topic: node.topic, payload: parsedBody.messages[0] });
            }).catch(function (err) {
                node.error(err);
            })
        });
    }

    RED.nodes.registerType("cequens", cequensNode);

}
