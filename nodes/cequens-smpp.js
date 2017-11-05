/**
 * Copyright 2017 Cequens Telecom
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *
 **/

module.exports = function (RED) {
    "use strict";

    var smpp = require('smpp');
    var moment = require('moment');


    // Encodings
    // This smpp implementation supports 3 encodings: ASCII (GSM 03.38), LATIN1, and UCS2. Respective data_coding for these encodings are 0x01, 0x03, and 0x08.
    smpp.encodings.default = 'LATIN1'

    function SmppOut(n) {
        RED.nodes.createNode(this, n);
        var connected = false;
        var status = "disconnected"
        var pdu;
        var session;
        var node = this;
        var counter = 0; // Missed enquire links counter
        var maxCount = 1; // Total missed enquire links allowed

        var username = "", password = "";
        if (this.credentials && this.credentials.hasOwnProperty("username")) {
            username = this.credentials.username;
        }
        if (this.credentials && this.credentials.hasOwnProperty("password")) {
            password = this.credentials.password;
        }

        function enquireLink() {
            if (status == "connected") {
                if (counter < maxCount) {
                    session.enquire_link();
                    counter++;
                } else {
                    node.error(` The SMPP connection is not responding counter:${counter}`)
                    session.close(function () { status = "not responding"; });


                }
            }
        }

        function connect() {
            if (status == "disconnected") {

                status = "connecting";
                node.status({ fill: "yellow", shape: "ring", text: `${status}` });
                //if (typeof session !== 'undefined') session.removeAllListeners()
                node.log(`Connecting to ${n.host}:${n.port}`);
                try {
                    session = smpp.connect(n.host, n.port || 2010);
                }
                catch (error) {
                    node.error('SMPP connection error: ' + error);
                    session.close(function () { status == "disconnected"; });
                    node.status({ fill: "red", shape: "ring", text: `${status} connection error: ${error}` });

                }

                session.on('error', function (error) {

                    node.error('SMPP connection error: ' + error);
                    session.close(function () {
                        status = "disconnected";
                        node.status({ fill: "red", shape: "ring", text: `${status} connection error: ${error}` });
                    });

                });

                session.on('close', function () {
                    node.error('SMPP connection is closed: ');
                    status = "disconnected";
                    node.status({ fill: "red", shape: "ring", text: `${status}` });

                });

                session.on('enquire_link', function (pdu) {
                    session.send(pdu.response());
                    //node.log('Responded an enquire link');
                });
                session.on('enquire_link_resp', function (pdu) {
                    counter = 0;
                    //node.log('Received a response to an enquire link');
                });
                session.on('deliver_sm', function (pdu) {


                    var msg = {};
                    msg.pdu = pdu;

                    if (pdu.esm_class == 4) {
                        msg.dlr = ParseDlr(pdu.short_message.message);
                        node.send([, msg, ,]);
                        var shortMessage = pdu.short_message;
                        node.log(`deliver_sm DLR msgID:${msg.dlr.dlrId} dlrStat:${msg.dlr.dlrStat} dlrDiffSeconds:${msg.dlr.dlrDiffSeconds}`)
                        session.send(pdu.response());
                    }
                    else {

                        node.send([, , msg,]);
                        node.log(`deliver_sm ESM_CLASS:${pdu.esm_class} msg:${pdu.short_message.message}`)
                        var shortMessage = pdu.short_message;
                        session.send(pdu.response());
                    }
                })
                session.on('enquire_link', function (pdu) {
                    session.send(pdu.response());
                });
                session.on('unbind', function (pdu) {
                    session.send(pdu.response());

                    node.info('SMPP remote server requested unbind')
                    session.close();
                    node.status({ fill: "yellow", shape: "ring", text: "unbind " + pdu.command_status });
                    status = "disconnected";
                });


                session.bind_transceiver({
                    system_id: username,
                    password: password
                }, function (pdu_) {
                    pdu = pdu_;
                    if (pdu.command_status == 0) {
                        node.log(`bound successfuly`);

                        status = "connected";
                        node.status({ fill: "green", shape: "dot", text: `${status}` });
                        counter = 0;

                    } else {
                        node.log(`bind error ${pdu.command_status}`);
                        node.status({ fill: "red", shape: "ring", text: "cmd status: " + pdu.command_status });
                        session.close();
                        status = "disconnected";
                    }
                });
            }
        }

        function ParseDlr(msg) {
            var dlrMsgRegex = /id:(.*?)(sub:(.*?))?(dlvrd:(.*?))?(submit date:(.*?))?(done date:(.*?))?(stat:(.*?))?(err:(.*?))?(text:(.*?))?$/ig;
            var dlr = {};
            var dlrMatch = dlrMsgRegex.exec(msg);
            if (dlrMatch) {
                //console.log(dlrMatch);
                if (dlrMatch[1]) dlr.dlrId = dlrMatch[1].trim();
                if (dlrMatch[3]) dlr.dlrSub = dlrMatch[3].trim();
                if (dlrMatch[5]) dlr.dlvrd = dlrMatch[5].trim();
                if (dlrMatch[7]) dlr.dlrSubmitDate = new Date(moment(dlrMatch[7], 'YYMMDDHHmmss').format("YYYY-MM-DD HH:mm:ss"));
                if (dlrMatch[9]) dlr.dlrDoneDate = new Date(moment(dlrMatch[9], 'YYMMDDHHmmss').format("YYYY-MM-DD HH:mm:ss"));
                dlr.dlrDiffSeconds = Math.abs((dlr.dlrDoneDate - dlr.dlrSubmitDate) / 1000);
                if (dlrMatch[11]) dlr.dlrStat = dlrMatch[11].trim();
                if (dlrMatch[13]) dlr.dlrErr = dlrMatch[13].trim();
                if (dlrMatch[15]) dlr.dlrText = dlrMatch[15].trim();
            } else {
                dlr.dlrStat = msg;
            }
            return dlr;
        }
        connect();
        var reconnectTimer=setInterval(connect, 6000);
        var enquireLinkTimer=setInterval(enquireLink, 5000);
        this.on('input', function (msg) {
            node.log(`submit_sm ${msg.source_addr || n.source_addr} ${msg.destination_addr} ${msg.data_coding || n.data_coding || 0x3}`)
            session.submit_sm({
                destination_addr: msg.destination_addr || n.destination_addr,
                source_addr: msg.source_addr || n.source_addr,
                data_coding: msg.data_coding || n.data_coding || 0x3,
                registered_delivery: msg.registered_delivery || n.registered_delivery || 0x00,
                //short_message: [0],
                message_payload: msg.payload
            }, function (pdu) {


                node.log(`submit_sm_resp status: ${pdu.command_status} id:${pdu.message_id}`)
                if (pdu.command_status == 0) {

                    msg.message_id = pdu.message_id;
                    node.send([msg, ,]);
                }
                else {
                    msg.message_id = pdu.message_id;
                    node.send([, , , msg]);
                }

            });

        });
        this.on('close', function () {
            node.log(`NODE CLOSE`);
            clearInterval(reconnectTimer);
            clearInterval(enquireLinkTimer);
            session.close();
            /*
            session.on('unbind', function (pdu) {
                session.send(pdu.response());
                session.close(function () { connected = false; });
            });*/
        })




    }

    RED.nodes.registerType("smpp out", SmppOut, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    });

}