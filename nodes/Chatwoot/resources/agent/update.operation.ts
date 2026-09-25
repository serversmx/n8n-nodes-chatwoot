import type { INodeProperties } from 'n8n-workflow';

export const updateOperation: INodeProperties[] = [
  {
    displayName: 'Agent',
    name: 'agentId',
    type: 'options',
    typeOptions: {
      loadOptionsMethod: 'getAgents',
    },
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['agent'],
        operation: ['update'],
      },
    },
    description:
      'Select the agent to update. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
  },
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['agent'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Full name of the agent',
      },
      {
        displayName: 'Role',
        name: 'role',
        type: 'options',
        options: [
          { name: 'Agent', value: 'agent' },
          { name: 'Administrator', value: 'administrator' },
        ],
        default: 'agent',
        description: 'Role determines the permissions of the agent',
      },
      {
        displayName: 'Auto Offline',
        name: 'auto_offline',
        type: 'boolean',
        default: true,
        description: 'Whether to automatically set agent offline when inactive',
      },
      {
        displayName: 'Availability',
        name: 'availability',
        type: 'options',
        options: [
          { name: 'Busy', value: 'busy' },
          { name: 'Offline', value: 'offline' },
          { name: 'Online', value: 'online' },
        ],
        default: 'online',
        description: 'Availability of the agent in this account',
      },
      {
        displayName: 'Availability Status (Deprecated)',
        name: 'availability_status',
        type: 'options',
        options: [
          { name: 'Available', value: 'available' },
          { name: 'Busy', value: 'busy' },
          { name: 'Offline', value: 'offline' },
        ],
        default: 'available',
        description:
          'Deprecated: use Availability. Chatwoot ignores availability_status, so this value is sent as availability (Available = online). Ignored when Availability is set.',
      },
      {
        displayName: 'Custom Role ID',
        name: 'custom_role_id',
        type: 'number',
        default: 0,
        description:
          'Enterprise only (custom_roles feature): ID of the custom role to assign; 0 removes it. Note: Chatwoot Enterprise clears the custom role on every agent update that does not send it, so set it again when updating an agent that has one.',
      },
    ],
  },
];
