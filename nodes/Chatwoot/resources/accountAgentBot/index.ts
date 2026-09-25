import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { getOperation } from './get.operation';
import { createOperation } from './create.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';
import { deleteAvatarOperation } from './deleteAvatar.operation';

// Platform API agent bots live at /platform/api/v1/agent_bots (never nested under an account).
// A Platform App only sees the bots it created itself; other bots answer 401 "Non permissible resource".
export const accountAgentBotOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['accountAgentBot'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description:
        'Create an agent bot through the Platform API, either for one account or as a global bot. The response includes the bot access token.',
      action: 'Create platform agent bot',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete an agent bot created by this Platform App',
      action: 'Delete platform agent bot',
    },
    {
      name: 'Delete Avatar',
      value: 'deleteAvatar',
      description: 'Remove the avatar image of an agent bot created by this Platform App',
      action: 'Delete platform agent bot avatar',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get an agent bot created by this Platform App, including its access token',
      action: 'Get platform agent bot',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'List the agent bots created by this Platform App, optionally only those of one account',
      action: 'Get platform agent bots',
    },
    {
      name: 'Update',
      value: 'update',
      description:
        'Update the name, description, webhook URL, avatar or account of an agent bot created by this Platform App',
      action: 'Update platform agent bot',
    },
  ],
  default: 'getAll',
};

export const accountAgentBotFields: INodeProperties[] = [
  ...getAllOperation,
  ...getOperation,
  ...createOperation,
  ...updateOperation,
  ...deleteOperation,
  ...deleteAvatarOperation,
];
