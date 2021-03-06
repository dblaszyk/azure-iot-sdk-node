# azure-iot-common.MqttBase Requirements

## Overview
MqttBase provides generalized MQTT support for higher-level libraries that will be communicating with Azure IoT Hub. It exposes functions for Connect, Publish, Subscribe and Receive operations.

## Example usage

```js
'use strict';
var MqttBase = require('azure-iot-device-mqtt').MqttBase;
var config = {
  host: [Host name goes here],
  deviceId: [Device ID goes here],
  sharedAccessSignature: [SAS token goes here],
  gatewayHostName: [Gateway host address goes here]
};

var base = new MqttBase(config));
base.connect();
base.publish(message);
base.subscribe();

base.receive(function (topic, msg) {
  console.log('Topic: ' + topic.toString());
  console.log('Received data: ' + msg.toString());
  }
};
```

## Public Interface

### MqttBase(config)
The `Mqtt` constructor receives the configuration parameters to configure the MQTT.JS library to connect to an IoT hub.

**SRS_NODE_COMMON_MQTT_BASE_16_004: [** The `Mqtt` constructor shall instanciate the default MQTT.JS library if no argument is passed to it. **]**
**SRS_NODE_COMMON_MQTT_BASE_16_005: [** The `Mqtt` constructor shall use the object passed as argument instead of the default MQTT.JS library if it's not falsy. **]**

### MqttBase.connect(config, done)
The `connect` method establishes a connection with the server using the config object passed in the arguments.
**SRS_NODE_COMMON_MQTT_BASE_16_006: [** The `connect` method shall throw a ReferenceError if the config argument is falsy, or if one of the following properties of the config argument is falsy: deviceId, host, and one of sharedAccessSignature or x509.cert and x509.key. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_002: [** The `connect` method shall use the authentication parameters contained in the `config` argument to connect to the server. **]**

**SRS_NODE_COMMON_MQTT_BASE_12_005: [** The `connect` method shall call connect on MQTT.JS  library and call the `done` callback with a `null` error object and the result as a second argument. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_003: [** The `connect` method shall call the `done` callback with a standard javascript `Error` object if the connection failed. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_007: [** The `connect` method shall not throw if the `done` argument has not been passed. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_016: [** The `connect` method shall configure the `keepalive` ping interval to 3 minutes by default since the Azure Load Balancer TCP Idle timeout default is 4 minutes. (https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-tcp-idle-timeout) **]**

### MqttBase.disconnect(done)
The `disconnect` method closes the connection to the server.

**SRS_NODE_COMMON_MQTT_BASE_16_001: [** The `disconnect` method shall call the done callback when the connection to the server has been closed. **]**

### Mqtt.publish(message)
The `publish` method publishes the message passed as argument.

**SRS_NODE_COMMON_MQTT_BASE_12_006: [** The `publish` method shall throw `ReferenceError` “Invalid message” if the message is falsy. **]**

**SRS_NODE_COMMON_MQTT_BASE_12_007: [** The `publish` method shall call `publish`  on MQTT.JS  library with the given message. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_008: [** The `publish` method shall use a topic formatted using the following convention: `devices/<deviceId>/messages/events/`. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_009: [** If the message has properties, the property keys and values shall be uri-encoded, then serialized and appended at the end of the topic with the following convention: `<key>=<value>&<key2>=<value2>&<key3>=<value3>(...)`. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_010: [** The `publish` method shall use QoS level of 1. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_011: [** The `publish` method shall serialize the `messageId` property of the message as a key-value pair on the topic with the key `$.mid`. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_012: [** The `publish` method shall serialize the `correlationId` property of the message as a key-value pair on the topic with the key `$.cid`. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_013: [** The `publish` method shall serialize the `userId` property of the message as a key-value pair on the topic with the key `$.uid`. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_014: [** The `publish` method shall serialize the `to` property of the message as a key-value pair on the topic with the key `$.to`. **]**

**SRS_NODE_COMMON_MQTT_BASE_16_015: [** The `publish` method shall serialize the `expiryTimeUtc` property of the message as a key-value pair on the topic with the key `$.exp`. **]**

### MqttBase.subscribe()
**SRS_NODE_COMMON_MQTT_BASE_12_008: [** The `subscribe` method shall call `subscribe`  on MQTT.JS  library with the given message and with the hardcoded topic path. **]**

### MqttBase.receive()
**SRS_NODE_COMMON_MQTT_BASE_12_010: [** The `receive` method shall implement the MQTT.JS library callback event and calls back to the caller with the given callback. **]**