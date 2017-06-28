import * as machina from 'machina';
import * as amqp10 from 'amqp10';
import * as dbg from 'debug';
import { EventEmitter } from 'events';
import { Message, results } from 'azure-iot-common';
import { AmqpMessage } from './amqp_message';
import { AmqpLink } from './amqp_link_interface';

const debug = dbg('SenderLink');

interface MessageOperation {
  message: Message;
  callback: (err?: Error, result?: results.MessageEnqueued) => void;
}

export class SenderLink extends EventEmitter implements AmqpLink {
  private _linkAddress: string;
  private _linkOptions: any;
  private _linkObject: any;
  private _fsm: machina.Fsm;
  private _amqp10Client: amqp10.AmqpClient;
  private _unsentMessageQueue: MessageOperation[];
  private _pendingMessageQueue: MessageOperation[];
  private _detachHandler: (detachEvent: any) => void;
  private _errorHandler: (err: Error) => void;

  constructor(linkAddress: string, linkOptions: any, amqp10Client: amqp10.AmqpClient) {
    super();
    this._linkAddress = linkAddress;
    this._linkOptions = linkOptions;
    this._amqp10Client = amqp10Client;
    this._unsentMessageQueue = [];
    this._pendingMessageQueue = [];

    this._detachHandler = (detachEvent: any): void => {
      this._fsm.transition('detaching', detachEvent.error);
    };

    this._errorHandler = (err: Error): void => {
      this._fsm.transition('detaching', err);
    };

    const pushToQueue = (message, callback) => {
      this._unsentMessageQueue.push({
        message: message,
        callback: callback
      });
    };

    this._fsm = new machina.Fsm({
      initialState: 'detached',
      states: {
        detached: {
          _onEnter: (callback, err) => {
            if (this._unsentMessageQueue.length > 0) {
              let messageCallbackError = err || new Error('Link Detached');

              let unsent = this._unsentMessageQueue.shift();
              while (unsent) {
                unsent.callback(messageCallbackError);
                unsent = this._unsentMessageQueue.shift();
              }
            }

            if (this._pendingMessageQueue.length > 0) {
              let messageCallbackError = err || new Error('Link Detached');

              let pending = this._pendingMessageQueue.shift();
              while (pending) {
                pending.callback(messageCallbackError);
                pending = this._pendingMessageQueue.shift();
              }
            }

            if (callback) {
              callback(err);
            } else if (err) {
              this.emit('error', err);
            }
          },
          attach: (callback) => this._fsm.transition('attaching', callback),
          detach: () => { return; },
          send: (message, callback) => {
            pushToQueue(message, callback);
            this._fsm.handle('attach');
          }
        },
        attaching: {
          _onEnter: (callback) => {
            this._attachLink((err) => {
              let newState = err ? 'detached' : 'attached';
              this._fsm.transition(newState, callback, err);
            });
          },
          detach: () => this._fsm.transition('detaching'),
          send: (message, callback) => pushToQueue(message, callback)
        },
        attached: {
          _onEnter: (callback) => {
            let toSend = this._unsentMessageQueue.shift();
            while (toSend) {
              this._fsm.handle('send', toSend.message, toSend.callback);
              toSend = this._unsentMessageQueue.shift();
            }
            if (callback) callback();
          },
          _onExit: () => {
            this._linkObject.removeListener('detached', this._detachHandler);
          },
          attach: (callback) => callback(),
          detach: () => this._fsm.transition('detaching'),
          send: (message, callback) => {
            const op = {
              message: message,
              callback: callback
            };

            this._pendingMessageQueue.push(op);

            /*Codes_SRS_NODE_COMMON_AMQP_16_011: [All methods should treat the `done` callback argument as optional and not throw if it is not passed as argument.]*/
            let _processPendingMessageCallback = (error?, result?) => {
              const opIndex = this._pendingMessageQueue.indexOf(op);
              if (opIndex >= 0) {
                this._pendingMessageQueue.splice(opIndex, 1);
                if (op.callback) {
                  process.nextTick(() => callback(error, result));
                }
              }
            };

            this._linkObject.send(message)
                            .then((state) => {
                              _processPendingMessageCallback(null, new results.MessageEnqueued(state));
                              return null;
                            })
                            .catch((err) => {
                              _processPendingMessageCallback(err);
                            });
          }
        },
        detaching: {
          _onEnter: (err) => {
            if (this._linkObject) {
              this._linkObject.forceDetach();
              this._linkObject = null;
            }
            this._fsm.transition('detached', null, err);
          },
          '*': () => this._fsm.deferUntilTransition('detached')
        }
      }
    });
  }

  detach(): void {
    this._fsm.handle('detach');
  }

  attach(callback: (err?: Error) => void): void {
    this._fsm.handle('attach', callback);
  }

  send(message: AmqpMessage, callback: (err?: Error, result?: results.MessageEnqueued) => void): void {
    this._fsm.handle('send', message, callback);
  }

  private _attachLink(callback: (err?: Error) => void): void {
    /*Codes_SRS_NODE_COMMON_AMQP_16_032: [The `attachSenderLink` method shall call the `done` callback with a `NotConnectedError` object if the amqp client is not connected when the method is called.]*/
    let connectionError = null;
    let clientErrorHandler = (err) => {
      connectionError = err;
    };

    /*Codes_SRS_NODE_COMMON_AMQP_16_007: [If send encounters an error before it can send the request, it shall invoke the `done` callback function and pass the standard JavaScript Error object with a text description of the error (err.message).]*/
    this._amqp10Client.on('client:errorReceived', clientErrorHandler);

    /*Codes_SRS_NODE_COMMON_AMQP_06_003: [The `attachSenderLink` method shall create a policy object that contain link options to be merged if the linkOptions argument is not falsy.]*/
    /*Codes_SRS_NODE_COMMON_AMQP_16_013: [The `attachSenderLink` method shall call `createSender` on the `amqp10` client object.]*/
    this._amqp10Client.createSender(this._linkAddress, this._linkOptions)
      .then((amqp10link) => {
        if (!connectionError) {
          debug('Sender object created for endpoint: ' + this._linkAddress);
          this._linkObject = amqp10link;
          this._linkObject.on('detached', this._detachHandler);
          this._linkObject.on('errorReceived', this._errorHandler);
        }
        this._amqp10Client.removeListener('client:errorReceived', clientErrorHandler);

        /*Codes_SRS_NODE_COMMON_AMQP_16_015: [The `attachSenderLink` method shall call the `done` callback with a `null` error and the link object that was created if the link was attached successfully.]*/
        /*Codes_SRS_NODE_COMMON_AMQP_16_016: [The `attachSenderLink` method shall call the `done` callback with an `Error` object if the link object wasn't created successfully.]*/
        return callback(connectionError);
      })
      .catch((err) => callback(err));
  }
}
