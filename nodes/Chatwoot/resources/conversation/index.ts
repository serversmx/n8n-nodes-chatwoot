import type { INodeProperties } from 'n8n-workflow';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { updateStatusOperation } from './updateStatus.operation';
import { assignOperation } from './assign.operation';
import { addLabelsOperation } from './addLabels.operation';
import { createOperation } from './create.operation';
import { togglePriorityOperation } from './togglePriority.operation';
import { updateOperation } from './update.operation';
import { filterOperation } from './filter.operation';
import { updateCustomAttributesOperation } from './updateCustomAttributes.operation';
import { deleteCustomAttributesOperation } from './deleteCustomAttributes.operation';
import { listLabelsOperation } from './listLabels.operation';
import { getMetaOperation } from './getMeta.operation';
import { deleteOperation } from './delete.operation';
import { muteOperation } from './mute.operation';
import { unmuteOperation } from './unmute.operation';
import { searchOperation } from './search.operation';
import { transcriptOperation } from './transcript.operation';
import { toggleTypingOperation } from './toggleTyping.operation';
import { getAttachmentsOperation } from './getAttachments.operation';
import { markAsReadOperation } from './markAsRead.operation';
import { markAsUnreadOperation } from './markAsUnread.operation';

export const conversationOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['conversation'],
    },
  },
  options: [
    {
      name: 'Add Labels',
      value: 'addLabels',
      description: 'Set labels on a conversation',
      action: 'Add labels to a conversation',
    },
    {
      name: 'Assign',
      value: 'assign',
      description: 'Assign a conversation to an agent, agent bot, Captain assistant or team, or remove the assignee or team',
      action: 'Assign a conversation',
    },
    {
      name: 'Create',
      value: 'create',
      description: 'Create a new conversation, optionally with an initial message',
      action: 'Create a conversation',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a conversation',
      action: 'Delete a conversation',
    },
    {
      name: 'Delete Custom Attributes',
      value: 'deleteCustomAttributes',
      description: 'Remove the given custom attribute keys from a conversation (Chatwoot 4.17+)',
      action: 'Delete conversation custom attributes',
    },
    {
      name: 'Filter',
      value: 'filter',
      description: 'Filter conversations using advanced criteria',
      action: 'Filter conversations',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get a conversation by ID',
      action: 'Get a conversation',
    },
    {
      name: 'Get Attachments',
      value: 'getAttachments',
      description: 'Get the files shared in a conversation, newest first',
      action: 'Get conversation attachments',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get many conversations with optional filters',
      action: 'Get many conversations',
    },
    {
      name: 'Get Meta',
      value: 'getMeta',
      description: 'Get conversation counts (mine, assigned, unassigned, all) for the given filters',
      action: 'Get conversation metadata',
    },
    {
      name: 'Get Unread Counts',
      value: 'getUnreadCounts',
      description:
        'Get unread conversation counts per inbox, label and team for the user that owns the API token. Requires Chatwoot 4.14.1+ and the internal conversation_unread_counts feature flag, which a super admin must enable for the account (otherwise 403).',
      action: 'Get unread conversation counts',
    },
    {
      name: 'List Labels',
      value: 'listLabels',
      description: 'Get all labels for a conversation',
      action: 'List conversation labels',
    },
    {
      name: 'Mark as Read',
      value: 'markAsRead',
      description: 'Mark a conversation as read by the user that owns the API token',
      action: 'Mark a conversation as read',
    },
    {
      name: 'Mark as Unread',
      value: 'markAsUnread',
      description: 'Mark a conversation as unread (from its last incoming message)',
      action: 'Mark a conversation as unread',
    },
    {
      name: 'Mute',
      value: 'mute',
      description: 'Mute a conversation',
      action: 'Mute a conversation',
    },
    {
      name: 'Search',
      value: 'search',
      description: 'Search conversations by message content',
      action: 'Search conversations',
    },
    {
      name: 'Toggle Priority',
      value: 'togglePriority',
      description: 'Set conversation priority (urgent, high, medium, low) or clear it (none)',
      action: 'Toggle conversation priority',
    },
    {
      name: 'Toggle Typing',
      value: 'toggleTyping',
      description: 'Show or hide the agent typing indicator in a conversation (not forwarded to WhatsApp by Evolution API inboxes)',
      action: 'Toggle typing indicator',
    },
    {
      name: 'Transcript',
      value: 'transcript',
      description: 'Send conversation transcript via email',
      action: 'Send conversation transcript',
    },
    {
      name: 'Unmute',
      value: 'unmute',
      description: 'Unmute a conversation',
      action: 'Unmute a conversation',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update the priority or SLA policy of a conversation, or snooze it',
      action: 'Update a conversation',
    },
    {
      name: 'Update Custom Attributes',
      value: 'updateCustomAttributes',
      description: 'Set conversation custom attributes (by default merged with the existing ones on Chatwoot 4.17+)',
      action: 'Update conversation custom attributes',
    },
    {
      name: 'Update Status',
      value: 'updateStatus',
      description: 'Update conversation status (open, resolved, pending, snoozed)',
      action: 'Update conversation status',
    },
  ],
  default: 'getAll',
};

export const conversationFields: INodeProperties[] = [
  ...getOperation,
  ...getAllOperation,
  ...updateStatusOperation,
  ...assignOperation,
  ...addLabelsOperation,
  ...createOperation,
  ...togglePriorityOperation,
  ...updateOperation,
  ...filterOperation,
  ...updateCustomAttributesOperation,
  ...deleteCustomAttributesOperation,
  ...listLabelsOperation,
  ...getMetaOperation,
  ...deleteOperation,
  ...muteOperation,
  ...unmuteOperation,
  ...searchOperation,
  ...transcriptOperation,
  ...toggleTypingOperation,
  ...getAttachmentsOperation,
  ...markAsReadOperation,
  ...markAsUnreadOperation,
];
