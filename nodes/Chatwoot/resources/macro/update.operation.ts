import type { INodeProperties } from 'n8n-workflow';
import { MACRO_ACTIONS_DESCRIPTION, MACRO_VISIBILITY_DESCRIPTION } from './create.operation';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Macro ID',
    name: 'macroId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['macro'],
        operation: ['update'],
      },
    },
    description: 'The ID of the macro to update',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['macro'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the macro',
      },
      {
        displayName: 'Actions (JSON)',
        name: 'actions',
        type: 'json',
        default: '[]',
        description: `Replaces all actions. ${MACRO_ACTIONS_DESCRIPTION}`,
      },
      {
        displayName: 'Visibility',
        name: 'visibility',
        type: 'options',
        options: [
          { name: 'Personal', value: 'personal' },
          { name: 'Global', value: 'global' },
        ],
        default: 'personal',
        description: `${MACRO_VISIBILITY_DESCRIPTION} When not set, the node keeps the current visibility (Chatwoot would otherwise clear it).`,
      },
    ],
  },
];
