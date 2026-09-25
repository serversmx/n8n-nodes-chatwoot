import type { INodeProperties } from 'n8n-workflow';

export const findByWhatsAppOperation: INodeProperties[] = [
  {
    displayName: 'WhatsApp Number or JID',
    name: 'whatsappNumber',
    type: 'string',
    required: true,
    default: '',
    placeholder: '+5215512345678',
    displayOptions: {
      show: {
        resource: ['contact'],
        operation: ['findByWhatsApp'],
      },
    },
    description:
      'Phone number in international format (spaces, dashes and "+" are ignored) or a WhatsApp JID such as 5215512345678@s.whatsapp.net, 123456789012345@lid or a group 120363000000000000@g.us. ' +
      'The node also tries the equivalent forms WhatsApp uses: Mexico +52/+521, Argentina +54/+549 and Brazil mobile numbers with and without the extra 9. ' +
      'Returns one item: found, contact (the best match, or null), matchedBy (identifier or phone_number), isLid, otherMatches and the searched variants. ' +
      'A contact whose identifier is the JID wins over a phone number match, because Evolution API delivers messages to the identifier. ' +
      'Resolve contacts this way instead of caching contact IDs: Evolution may merge duplicate contacts, which deletes one of the IDs.',
  },
];
