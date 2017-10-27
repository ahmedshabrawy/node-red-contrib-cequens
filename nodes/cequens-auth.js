module.exports = function (RED) {
    "use strict";

    function cequensAuthNode(n) {
        RED.nodes.createNode(this, n);
        this.name = n.name;
    }

    RED.nodes.registerType("cequens-auth", cequensAuthNode, {
        credentials: {
            "http_username": { type: "password" },
            "http_password": { type: "password" }
        }
    });

}
