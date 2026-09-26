import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { getOperation } from './get.operation';
import { updateOperation } from './update.operation';
import { createOperation } from './create.operation';
import { deleteOperation } from './delete.operation';
import { addAgentOperation } from './addAgent.operation';
import { deleteAgentOperation } from './deleteAgent.operation';
import { updateAgentsOperation } from './updateAgents.operation';
import { getMembersOperation } from './getMembers.operation';
import { getAgentBotOperation } from './getAgentBot.operation';
import { setAgentBotOperation } from './setAgentBot.operation';
import { resetSecretOperation } from './resetSecret.operation';
import { rotateHmacTokenOperation } from './rotateHmacToken.operation';
import { getMessageTemplatesOperation } from './getMessageTemplates.operation';
import { syncTemplatesOperation } from './syncTemplates.operation';

export const inboxOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['inbox'],
    },
  },
  options: [
    {
      name: 'Add Agent',
      value: 'addAgent',
      description: 'Add agents to an inbox and return the resulting member list',
      action: 'Add agents to inbox',
    },
    {
      name: 'Create',
      value: 'create',
      description:
        'Create an API, Email, LINE, SMS (Bandwidth), Telegram, Website or WhatsApp inbox',
      action: 'Create an inbox',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete an inbox with its conversations (Chatwoot deletes it in the background)',
      action: 'Delete an inbox',
    },
    {
      name: 'Delete Agent',
      value: 'deleteAgent',
      description: 'Remove agents from an inbox',
      action: 'Remove agents from inbox',
    },
    {
      name: 'Get',
      value: 'get',
      description:
        'Get an inbox by ID (API inboxes include webhook_url, inbox_identifier and, for administrators, secret and hmac_token)',
      action: 'Get an inbox',
    },
    {
      name: 'Get Agent Bot',
      value: 'getAgentBot',
      description: 'Get the agent bot assigned to an inbox',
      action: 'Get inbox agent bot',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get the inboxes of the account, one item per inbox (administrators see every inbox, agents only the inboxes they are members of)',
      action: 'Get all inboxes',
    },
    {
      name: 'Get Members',
      value: 'getMembers',
      description: 'Get the agents assigned to an inbox (one item per agent)',
      action: 'Get inbox members',
    },
    {
      name: 'Get Message Templates',
      value: 'getMessageTemplates',
      description:
        'List the synced message templates of a WhatsApp inbox (Cloud API, 360dialog or Twilio WhatsApp). Requires Chatwoot 4.17+.',
      action: 'Get inbox message templates',
    },
    {
      name: 'Reset Secret',
      value: 'resetSecret',
      description:
        'Regenerate the secret that signs the webhook deliveries of an API inbox (X-Chatwoot-Signature) and return the inbox with the new secret. API inboxes only; administrator token required.',
      action: 'Reset inbox webhook secret',
    },
    {
      name: 'Rotate HMAC Token',
      value: 'rotateHmacToken',
      description:
        'Rotate the identity verification (HMAC) token of a Website or API inbox and return the inbox with the new hmac_token. Existing identifier hashes stop working. Requires Chatwoot 4.18+.',
      action: 'Rotate inbox HMAC token',
    },
    {
      name: 'Set Agent Bot',
      value: 'setAgentBot',
      description: 'Set or remove agent bot for an inbox',
      action: 'Set inbox agent bot',
    },
    {
      name: 'Sync Templates',
      value: 'syncTemplates',
      description:
        'Ask Chatwoot to re-download the message templates of a WhatsApp inbox from the provider (runs in the background)',
      action: 'Sync inbox message templates',
    },
    {
      name: 'Update',
      value: 'update',
      description:
        'Update inbox settings and channel settings (e.g. the webhook URL of an API inbox)',
      action: 'Update an inbox',
    },
    {
      name: 'Update Agents',
      value: 'updateAgents',
      description: 'Replace the agents of an inbox with the given list',
      action: 'Update inbox agents',
    },
  ],
  default: 'getAll',
};

export const inboxFields: INodeProperties[] = [
  ...getAllOperation,
  ...getOperation,
  ...updateOperation,
  ...createOperation,
  ...deleteOperation,
  ...addAgentOperation,
  ...deleteAgentOperation,
  ...updateAgentsOperation,
  ...getMembersOperation,
  ...getAgentBotOperation,
  ...setAgentBotOperation,
  ...resetSecretOperation,
  ...rotateHmacTokenOperation,
  ...getMessageTemplatesOperation,
  ...syncTemplatesOperation,
];
