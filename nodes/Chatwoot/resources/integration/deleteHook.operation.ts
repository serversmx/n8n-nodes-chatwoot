import type { INodeProperties } from 'n8n-workflow';

export const deleteHookOperation: INodeProperties[] = [
  {
    // Obsolete: hooks are identified by their ID, so this value was never sent. Always hidden,
    // kept so saved workflows keep their parameters.
    displayName: 'App ID',
    name: 'appId',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['integration'],
        operation: ['deleteHook'],
      },
      hide: {
        resource: ['integration'],
      },
    },
    description: 'Not used: the hook is identified by its ID',
  },
  {
    displayName: 'Hook ID',
    name: 'hookId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['integration'],
        operation: ['deleteHook'],
      },
    },
    description: 'ID of the hook to delete',
  },
];
