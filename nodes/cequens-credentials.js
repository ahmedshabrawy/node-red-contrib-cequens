module.exports = function (RED) {
    "use strict";

    function cequensCredentialNode(n) {
        RED.nodes.createNode(this, n);
        this.name = n.name;
        this.number = n.number;
        this.from = n.from;
    }

    RED.nodes.registerType("cequens-credentials", cequensCredentialNode);

}
