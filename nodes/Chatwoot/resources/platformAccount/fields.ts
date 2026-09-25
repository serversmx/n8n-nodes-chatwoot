import type { INodeProperties } from 'n8n-workflow';

// Account attributes accepted by Platform::Api::V1::AccountsController (create and update)
export const accountStatusField: INodeProperties = {
  displayName: 'Status',
  name: 'status',
  type: 'options',
  options: [
    { name: 'Active', value: 'active' },
    { name: 'Suspended', value: 'suspended' },
  ],
  default: 'active',
  description:
    'Suspending blocks the account: every Application API call of its users and bots answers 401 "Account is suspended" until it is active again',
};

export const accountCustomAttributesField: INodeProperties = {
  displayName: 'Custom Attributes',
  name: 'custom_attributes',
  type: 'json',
  default: '{}',
  description:
    'Custom attributes of the account as a JSON object. Replaces the whole object stored in Chatwoot.',
};

export const accountFeaturesField: INodeProperties = {
  displayName: 'Features',
  name: 'features',
  type: 'json',
  default: '{}',
  description:
    'Features to switch on or off as a JSON object of booleans, e.g. {"help_center": true, "campaigns": false}. Features not listed keep their current state. Names come from Chatwoot config/features.yml and vary by version: an unknown name makes Chatwoot answer 500. On Create the features are applied by a second request, after the account exists.',
};

export const accountLimitsField: INodeProperties = {
  displayName: 'Limits',
  name: 'limits',
  type: 'json',
  default: '{}',
  description:
    'Plan limits as a JSON object, e.g. {"agents": 5, "inboxes": 3}. Enterprise editions validate the keys (agents, inboxes, emails, captain_responses, captain_documents). Replaces the whole object stored in Chatwoot.',
};
