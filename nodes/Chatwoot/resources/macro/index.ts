import type { INodeProperties } from 'n8n-workflow';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';
import { executeOperation } from './execute.operation';

export const macroOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['macro'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create a macro (a saved list of actions agents can run on a conversation). Returns it under "payload".',
      action: 'Create a macro',
    },
    {
      name: 'Delete',
      value: 'delete',
      description:
        'Delete a macro. Global macros can only be deleted by administrators, personal macros only by their author (Chatwoot 4.13 also let the author delete a global macro).',
      action: 'Delete a macro',
    },
    {
      name: 'Execute',
      value: 'execute',
      description:
        'Queue a macro to run on one or more conversations. Chatwoot runs it asynchronously and always answers 200, so success means "queued"; since 4.18 conversations the token user cannot access are skipped silently (use an administrator token).',
      action: 'Execute a macro',
    },
    {
      name: 'Get',
      value: 'get',
      description:
        'Get a macro by ID (global macros, or personal macros of the token user). Returns it under "payload".',
      action: 'Get a macro',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get the macros visible to the token user: all global macros plus their own personal macros, as a "payload" array',
      action: 'Get many macros',
    },
    {
      name: 'Update',
      value: 'update',
      description:
        'Update a macro. Global macros can only be edited by administrators, personal macros only by their author (Chatwoot 4.13 also let the author edit a global macro).',
      action: 'Update a macro',
    },
  ],
  default: 'getAll',
};

export const macroFields: INodeProperties[] = [
  ...getOperation,
  ...getAllOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
  ...executeOperation,
];
