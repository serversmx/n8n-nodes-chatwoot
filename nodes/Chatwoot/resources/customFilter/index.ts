import type { INodeProperties } from 'n8n-workflow';

export const customFilterOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['customFilter'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      description: 'Create a saved filter (folder or segment) for the user who owns the API token',
      action: 'Create a custom filter',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a custom filter',
      action: 'Delete a custom filter',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get a custom filter by ID',
      action: 'Get a custom filter',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get the saved filters of one type that belong to the user who owns the API token',
      action: 'Get all custom filters',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update a custom filter',
      action: 'Update a custom filter',
    },
  ],
  default: 'getAll',
};

export const customFilterFields: INodeProperties[] = [
  // Get/Update/Delete
  {
    displayName: 'Custom Filter ID',
    name: 'customFilterId',
    type: 'number',
    required: true,
    default: 0,
    displayOptions: {
      show: {
        resource: ['customFilter'],
        operation: ['get', 'update', 'delete'],
      },
    },
    description:
      'ID of the custom filter (only filters of the user who owns the API token are visible)',
  },
  // GetAll filter type
  {
    displayName: 'Filter Type',
    name: 'filterType',
    type: 'options',
    options: [
      { name: 'Conversation', value: 'conversation' },
      { name: 'Contact', value: 'contact' },
      { name: 'Report', value: 'report' },
    ],
    default: 'conversation',
    displayOptions: {
      show: {
        resource: ['customFilter'],
        operation: ['getAll', 'create'],
      },
    },
    description: 'Type of saved filter: conversation folders, contact segments or report filters',
  },
  // Create
  {
    displayName: 'Name',
    name: 'name',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        resource: ['customFilter'],
        operation: ['create'],
      },
    },
    description: 'Name of the custom filter',
  },
  {
    displayName: 'Query (JSON)',
    name: 'query',
    type: 'json',
    required: true,
    default: '{}',
    displayOptions: {
      show: {
        resource: ['customFilter'],
        operation: ['create'],
      },
    },
    description:
      'Saved conditions in the format the Chatwoot dashboard uses: {"payload": [{"attribute_key": "status", "filter_operator": "equal_to", "values": ["open"]}]}. Same conditions as Conversation > Filter or Contact > Filter; a bare array of conditions is wrapped in "payload", and the node removes the query_operator of the last condition (Chatwoot 4.17+ rejects it).',
  },
  // Update
  {
    displayName: 'Update Fields',
    name: 'updateFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['customFilter'],
        operation: ['update'],
      },
    },
    options: [
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        description: 'Name of the custom filter',
      },
      {
        displayName: 'Query (JSON)',
        name: 'query',
        type: 'json',
        default: '',
        description:
          'Saved conditions in the format the Chatwoot dashboard uses: {"payload": [...]} (a bare array of conditions is wrapped), replacing the current ones',
      },
    ],
  },
];
