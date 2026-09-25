import type { INodeProperties } from 'n8n-workflow';

import { SETTINGS_DESCRIPTION } from './createHook.operation';

export const updateHookOperation: INodeProperties[] = [
  {
    // Obsolete: hooks are identified by their ID and Chatwoot never changes a hook's app, so this
    // value was never sent. Always hidden, kept so saved workflows keep their parameters.
    displayName: 'App ID',
    name: 'appId',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['integration'],
        operation: ['updateHook'],
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
        operation: ['updateHook'],
      },
    },
    description: 'ID of the hook to update (see the hooks array of Integration > Get Many)',
  },
  {
    displayName: 'Settings',
    name: 'settings',
    type: 'json',
    default: '{}',
    displayOptions: {
      show: {
        resource: ['integration'],
        operation: ['updateHook'],
      },
    },
    description: `New settings (replace the stored ones). Leave {} to keep the current settings, e.g. when only changing the status. ${SETTINGS_DESCRIPTION}`,
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['integration'],
        operation: ['updateHook'],
      },
    },
    options: [
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
          { name: 'Enabled', value: 'enabled' },
          { name: 'Disabled', value: 'disabled' },
        ],
        default: 'enabled',
        description: 'Enable or disable the hook without deleting it',
      },
    ],
  },
];
