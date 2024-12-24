import { SourceOptions } from './types';
import { QueryResult } from '@tooljet-plugins/common';
import { WebSocket } from 'ws';

const tagValues = {};

let socket: WebSocket;
const reconnectInterval = 2000;
const maxRetries = 10;
let retryCount = 0;
let _sourceOptions: SourceOptions;
let pingInterval: NodeJS.Timeout | undefined;
let pingTimeout: NodeJS.Timeout | undefined;
let pongReceived = false;

export function getTagValue(tagIds: string[]): any {
  if (tagIds == undefined || tagIds.some((tag) => tag === '#')) {
    return Object.entries(tagValues).map(([key, value]) => ({
      name: key,
      value,
    }));
  }

  return tagIds.map((tag) => {
    return {
      name: tag,
      value: tagValues[tag],
    };
  });
}

export function setTagValue(tagId: string, value: any): QueryResult {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        event: 'set',
        tags: [
          {
            key: tagId,
            value: value,
          },
        ],
      })
    );
    return {
      status: 'ok',
      errorMessage: 'Tag value set successfully',
      data: {
        name: tagId,
        value,
        value_type: typeof value,
      },
    };
  } else {
    return {
      status: 'failed',
      errorMessage: 'WebSocket is not connected',
      data: [],
    };
  }
}

export function subscribeTags(tagIds: string[]): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        event: 'sub',
        tagIds,
      })
    );
  }
}

export function connectWebSocket(sourceOptions: SourceOptions): void {
  if (socket && socket.readyState === WebSocket.OPEN && _sourceOptions.url === sourceOptions.url) return;
  _sourceOptions = sourceOptions;
  socket = new WebSocket(sourceOptions.url);

  // Event: Connection established
  socket.on('open', () => {
    console.log('WebSocket is connected');
    retryCount = 0;

    // Ping the server every 10 seconds to keep the connection alive
    pingInterval = setInterval(() => {
      pongReceived = false;
      socket.ping();
      console.log('Ping sent');

      // Set timeout to check for pong response
      pingTimeout = setTimeout(() => {
        if (!pongReceived) {
          console.log('No pong received - connection is dead');
          socket.terminate(); // Force close the connection
        }
      }, 5000); // Wait 5 seconds for pong
    }, 10 * 1000);
  });

  socket.on('pong', () => {
    console.log('Pong received');
    pongReceived = true;
    if (pingTimeout) {
      clearTimeout(pingTimeout);
      pingTimeout = undefined;
    }
  });

  // Event: Message received from the server
  socket.on('message', (data: any) => {
    console.log('Message from server:', data.toString());

    const json = JSON.parse(data.toString());
    if (json.event === 'tag-values') {
      console.log(json);
      for (const tag of json.data) {
        tagValues[tag.path + '/' + tag.name] = tag.value;
      }
    }
  });

  // Event: Connection closed
  socket.on('close', () => {
    console.log('WebSocket is closed. Attempting to reconnect...');

    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = undefined;
    }

    attemptReconnect();
  });

  // Event: Error occurred
  socket.on('error', (error) => {
    console.error('WebSocket error observed:', error);
    // Close the socket if it's in an error state
    if (socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
  });
}

function attemptReconnect(): void {
  if (retryCount >= maxRetries) {
    console.error('Max retries reached. Unable to reconnect to the server.');
    return;
  }
  retryCount++;
  setTimeout(() => connectWebSocket(_sourceOptions), reconnectInterval);
}
