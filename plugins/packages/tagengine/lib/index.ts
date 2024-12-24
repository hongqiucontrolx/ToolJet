import { QueryResult, QueryService, ConnectionTestResult } from '@tooljet-plugins/common';
import { SourceOptions, QueryOptions, Operation } from './types';
import { connectWebSocket, getTagValue, setTagValue, subscribeTags } from './query_operations';
import { WebSocket } from 'ws';

export default class TagEngineQueryService implements QueryService {
  private static _instance: TagEngineQueryService;

  // Singleton, to avoid creating different instances of the object for different queries
  constructor() {
    if (TagEngineQueryService._instance) {
      return TagEngineQueryService._instance;
    }

    TagEngineQueryService._instance = this;
    return TagEngineQueryService._instance;
  }

  async run(sourceOptions: SourceOptions, queryOptions: QueryOptions, dataSourceId: string): Promise<QueryResult> {
    connectWebSocket(sourceOptions);

    const operation: Operation = queryOptions.operation;

    if (operation === Operation.Sub) {
      subscribeTags(queryOptions.tag_ids?.split(','));
      return {
        status: 'ok',
        data: {
          tagIds: queryOptions.tag_ids,
        },
      };
    }

    if (operation === Operation.GetValue) {
      const data = getTagValue(queryOptions.tag_ids?.split(','));
      return {
        status: 'ok',
        data,
      };
    }

    if (operation === Operation.SetValue) {
      let value = queryOptions.tag_value;
      if (queryOptions.value_type === 'number') {
        value = Number(queryOptions.tag_value);
      } else if (queryOptions.value_type === 'boolean') {
        value = Boolean(queryOptions.tag_value);
      }
      return setTagValue(queryOptions.tag_id, value);
    }
  }

  async testConnection(sourceOptions: SourceOptions): Promise<ConnectionTestResult> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(sourceOptions.url);
      ws.once('open', () => {
        ws.close();
        resolve({
          status: 'ok',
          message: 'Connection to TagEngine server successful',
        });
      });
      ws.once('error', (error) => {
        resolve({
          status: 'failed',
          message: 'Connection to TagEngine server failed',
        });
      });
      ws.on('close', () => {
        resolve({
          status: 'failed',
          message: 'Connection to TagEngine server closed',
        });
      });
    });
  }
}
