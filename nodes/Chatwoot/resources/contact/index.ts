import type { INodeProperties } from 'n8n-workflow';
import { createOperation } from './create.operation';
import { getOperation } from './get.operation';
import { getAllOperation } from './getAll.operation';
import { updateOperation } from './update.operation';
import { deleteOperation } from './delete.operation';
import { searchOperation } from './search.operation';
import { getConversationsOperation } from './getConversations.operation';
import { mergeOperation } from './merge.operation';
import { filterOperation } from './filter.operation';
import { addLabelsOperation } from './addLabels.operation';
import { listLabelsOperation } from './listLabels.operation';
import { importContactsOperation } from './importContacts.operation';
import { exportContactsOperation } from './exportContacts.operation';
import { contactableInboxesOperation } from './contactableInboxes.operation';
import { findByWhatsAppOperation } from './findByWhatsApp.operation';
import { getAttachmentsOperation } from './getAttachments.operation';
import { linkToInboxOperation } from './linkToInbox.operation';
import { deleteCustomAttributesOperation } from './deleteCustomAttributes.operation';

export const contactOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['contact'],
    },
  },
  options: [
    {
      name: 'Add Labels',
      value: 'addLabels',
      description: 'Add labels to a contact, keeping the labels it already has',
      action: 'Add labels to contact',
    },
    {
      name: 'Contactable Inboxes',
      value: 'contactableInboxes',
      description: 'Get inboxes that can be used to reach a contact',
      action: 'Get contactable inboxes',
    },
    {
      name: 'Create',
      value: 'create',
      description: 'Create a new contact, optionally linked to an inbox',
      action: 'Create a contact',
    },
    {
      name: 'Delete',
      value: 'delete',
      description: 'Delete a contact (requires an administrator token)',
      action: 'Delete a contact',
    },
    {
      name: 'Delete Custom Attributes',
      value: 'deleteCustomAttributes',
      description: 'Remove custom attribute keys from a contact, keeping the others',
      action: 'Delete contact custom attributes',
    },
    {
      name: 'Export',
      value: 'export',
      description:
        'Start a CSV export of contacts; Chatwoot emails the download link to the token owner (requires an administrator token)',
      action: 'Export contacts',
    },
    {
      name: 'Filter',
      value: 'filter',
      description:
        'Filter contacts by conditions on their attributes, labels and custom attributes',
      action: 'Filter contacts',
    },
    {
      name: 'Find by WhatsApp Number',
      value: 'findByWhatsApp',
      description:
        'Find the contact of a WhatsApp number or JID, trying the +52/+521, +54/+549 and Brazil 9-digit variants and @s.whatsapp.net/@lid identifiers',
      action: 'Find contact by WhatsApp number',
    },
    {
      name: 'Get',
      value: 'get',
      description: 'Get a contact by ID',
      action: 'Get a contact',
    },
    {
      name: 'Get Attachments',
      value: 'getAttachments',
      description: "Get the files shared in a contact's conversations (requires Chatwoot 4.14+)",
      action: 'Get contact attachments',
    },
    {
      name: 'Get Conversations',
      value: 'getConversations',
      description:
        'Get the recent conversations of a contact (at most 20, or 25 on Chatwoot 4.18+), most recently active first',
      action: 'Get contact conversations',
    },
    {
      name: 'Get Many',
      value: 'getAll',
      description: 'Get many contacts, optionally filtered by labels',
      action: 'Get many contacts',
    },
    {
      name: 'Import',
      value: 'import',
      description:
        'Import contacts from a CSV file in a binary property (requires an administrator token)',
      action: 'Import contacts',
    },
    {
      name: 'Link to Inbox',
      value: 'linkToInbox',
      description: 'Link an existing contact to an inbox (create a contact inbox with a source ID)',
      action: 'Link contact to inbox',
    },
    {
      name: 'List Labels',
      value: 'listLabels',
      description: 'Get all labels for a contact',
      action: 'List contact labels',
    },
    {
      name: 'Merge',
      value: 'merge',
      description: 'Merge two contacts into one',
      action: 'Merge contacts',
    },
    {
      name: 'Remove Labels',
      value: 'removeLabels',
      description: 'Remove labels from a contact, keeping its other labels',
      action: 'Remove labels from contact',
    },
    {
      name: 'Search',
      value: 'search',
      description: 'Search contacts by name, email, phone, or identifier',
      action: 'Search contacts',
    },
    {
      name: 'Set Labels',
      value: 'setLabels',
      description: 'Replace all labels of a contact with the given list',
      action: 'Set contact labels',
    },
    {
      name: 'Update',
      value: 'update',
      description: 'Update a contact',
      action: 'Update a contact',
    },
  ],
  default: 'getAll',
};

export const contactFields: INodeProperties[] = [
  ...createOperation,
  ...getOperation,
  ...getAllOperation,
  ...updateOperation,
  ...deleteOperation,
  ...searchOperation,
  ...getConversationsOperation,
  ...mergeOperation,
  ...filterOperation,
  ...addLabelsOperation,
  ...listLabelsOperation,
  ...importContactsOperation,
  ...exportContactsOperation,
  ...contactableInboxesOperation,
  ...findByWhatsAppOperation,
  ...getAttachmentsOperation,
  ...linkToInboxOperation,
  ...deleteCustomAttributesOperation,
];
