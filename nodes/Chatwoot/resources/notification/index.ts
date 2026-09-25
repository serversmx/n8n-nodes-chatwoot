import type { INodeProperties } from 'n8n-workflow';
import { getAllOperation } from './getAll.operation';
import { markReadOperation } from './markRead.operation';
import { deleteOperation } from './delete.operation';
import { deleteAllOperation } from './deleteAll.operation';
import { readAllOperation } from './readAll.operation';
import { unreadCountOperation } from './unreadCount.operation';
import { markUnreadOperation } from './markUnread.operation';
import { snoozeOperation } from './snooze.operation';
import { getSettingsOperation } from './getSettings.operation';
import { updateSettingsOperation } from './updateSettings.operation';

export const notificationOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['notification'],
    },
  },
  options: [
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a notification of the token user',
      action: 'Delete a notification',
    },
    {
      name: 'Delete All',
      value: 'deleteAll',
      description:
        'Delete all notifications of the token user in this account, or only the read ones. Chatwoot deletes them in a background job.',
      action: 'Delete all notifications',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description:
        'Get the notifications of the token user (the user who owns the API access token), newest activity first. Read and snoozed notifications are excluded unless included in Options.',
      action: 'Get many notifications',
    },
    {
      name: 'Get Settings',
      value: 'getSettings',
      description:
        'Get the email and push notification preferences of the token user in this account',
      action: 'Get notification settings',
    },
    {
      name: 'Mark All Read',
      value: 'readAll',
      description: 'Mark all notifications of the token user in this account as read',
      action: 'Mark all notifications read',
    },
    {
      name: 'Mark Read',
      value: 'markRead',
      description: 'Mark a notification as read',
      action: 'Mark notification read',
    },
    {
      name: 'Mark Unread',
      value: 'markUnread',
      description: 'Mark a notification as unread',
      action: 'Mark notification unread',
    },
    {
      name: 'Snooze',
      value: 'snooze',
      description: 'Hide a notification until a given date and time',
      action: 'Snooze a notification',
    },
    {
      name: 'Unread Count',
      value: 'unreadCount',
      description:
        'Get the number of unread, non-snoozed notifications of the token user, as { unread_count }',
      action: 'Get unread notification count',
    },
    {
      name: 'Update Settings',
      value: 'updateSettings',
      description:
        'Choose which events send email and push notifications to the token user. A list you leave out keeps its current value.',
      action: 'Update notification settings',
    },
  ],
  default: 'getAll',
};

export const notificationFields: INodeProperties[] = [
  ...getAllOperation,
  ...markReadOperation,
  ...deleteOperation,
  ...deleteAllOperation,
  ...readAllOperation,
  ...unreadCountOperation,
  ...markUnreadOperation,
  ...snoozeOperation,
  ...getSettingsOperation,
  ...updateSettingsOperation,
];
