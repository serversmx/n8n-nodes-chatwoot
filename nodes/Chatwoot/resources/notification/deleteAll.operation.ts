import type { INodeProperties } from 'n8n-workflow';

export const deleteAllOperation: INodeProperties[] = [
  {
    displayName: 'Notifications to Delete',
    name: 'deleteType',
    type: 'options',
    options: [
      {
        name: 'All',
        value: 'all',
        description: 'Delete every notification, read or unread',
      },
      {
        name: 'Read Only',
        value: 'read',
        description: 'Delete only notifications already marked as read',
      },
    ],
    default: 'read',
    displayOptions: {
      show: {
        resource: ['notification'],
        operation: ['deleteAll'],
      },
    },
    description: 'Which notifications of the token user to delete',
  },
];
