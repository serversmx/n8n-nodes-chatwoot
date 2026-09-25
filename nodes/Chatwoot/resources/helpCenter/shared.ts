import type { INodeProperties } from 'n8n-workflow';

/** Portal fields accepted by PortalsController#portal_params (+ config and the top-level inbox_id). */
export const portalFieldOptions: INodeProperties[] = [
  {
    displayName: 'Allowed Locales',
    name: 'allowed_locales',
    type: 'string',
    default: '',
    placeholder: 'es, en',
    description:
      'Comma-separated locale codes the portal publishes (config.allowed_locales), e.g. "es, en". Replaces the current list.',
  },
  {
    displayName: 'Analytics (JSON)',
    name: 'analytics',
    type: 'json',
    default: '{}',
    description:
      'Tracking IDs injected into the public portal, e.g. {"ga4_measurement_id": "G-ABC123"}. Keys: gtm_container_id, ga4_measurement_id, hotjar_site_id, plausible_domain, amplitude_api_key, clarity_project_id, meta_pixel_id. Administrators only. Requires Chatwoot 4.17+.',
  },
  {
    displayName: 'Archived',
    name: 'archived',
    type: 'boolean',
    default: false,
    description: 'Whether the portal is archived (hidden)',
  },
  {
    displayName: 'Color',
    name: 'color',
    type: 'color',
    default: '#1f93ff',
    description: 'Brand color of the portal (hex, e.g. #1f93ff)',
  },
  {
    displayName: 'Custom Domain',
    name: 'custom_domain',
    type: 'string',
    default: '',
    description: 'Custom domain for the portal',
  },
  {
    displayName: 'Default Locale',
    name: 'default_locale',
    type: 'string',
    default: '',
    placeholder: 'es',
    description:
      'Default locale of the portal (config.default_locale), e.g. "es". Chatwoot uses "en" when unset.',
  },
  {
    displayName: 'Draft Locales',
    name: 'draft_locales',
    type: 'string',
    default: '',
    description:
      'Comma-separated allowed locales that are hidden from the public portal while being prepared. Empty clears the list. The default locale cannot be a draft.',
  },
  {
    displayName: 'Header Text',
    name: 'header_text',
    type: 'string',
    default: '',
    description: 'Header text displayed on the portal',
  },
  {
    displayName: 'Homepage Link',
    name: 'homepage_link',
    type: 'string',
    default: '',
    description: 'Link to the homepage',
  },
  {
    displayName: 'Layout',
    name: 'layout',
    type: 'options',
    options: [
      { name: 'Classic', value: 'classic' },
      { name: 'Documentation', value: 'documentation' },
    ],
    default: 'classic',
    description: 'Public portal layout (config.layout). Requires Chatwoot 4.14+.',
  },
  {
    displayName: 'Live Chat Inbox ID',
    name: 'inbox_id',
    type: 'number',
    default: 0,
    description: 'ID of a website (live chat) inbox whose widget is shown on the portal',
  },
  {
    displayName: 'Page Title',
    name: 'page_title',
    type: 'string',
    default: '',
    description: 'Title of the portal page',
  },
  {
    displayName: 'Social Profiles (JSON)',
    name: 'social_profiles',
    type: 'json',
    default: '{}',
    description:
      'Social links shown on the portal, e.g. {"facebook": "https://facebook.com/acme", "whatsapp": "https://wa.me/5215512345678"}. Keys: facebook, x, instagram, linkedin, youtube, tiktok, github, whatsapp. Replaces the current links. Ignored by Chatwoot 4.13 and older.',
  },
];

/** Category fields accepted by CategoriesController#category_params (+ related_category_ids). */
export const categoryFieldOptions: INodeProperties[] = [
  {
    displayName: 'Associated Category ID',
    name: 'associated_category_id',
    type: 'number',
    default: 0,
    description: 'ID of the category this one translates (links the same category across locales)',
  },
  {
    displayName: 'Description',
    name: 'description',
    type: 'string',
    default: '',
    description: 'Description of the category',
  },
  {
    displayName: 'Icon',
    name: 'icon',
    type: 'string',
    default: '',
    description: 'Icon of the category (an emoji or icon name, as chosen in the Chatwoot UI)',
  },
  {
    displayName: 'Icon Color',
    name: 'icon_color',
    type: 'string',
    default: '',
    description: 'Icon color (hex). Requires Chatwoot 4.18+ (ignored by older versions).',
  },
  {
    displayName: 'Parent Category ID',
    name: 'parent_category_id',
    type: 'number',
    default: 0,
    description: 'ID of the parent category (nested categories)',
  },
  {
    displayName: 'Position',
    name: 'position',
    type: 'number',
    default: 0,
    description: 'Position of the category in the list',
  },
  {
    displayName: 'Related Category IDs',
    name: 'related_category_ids',
    type: 'string',
    default: '',
    description: 'Comma-separated IDs of related categories of the same portal',
  },
];

/** Article fields accepted by ArticlesController#article_params (create and update). */
export function articleFieldOptions(forUpdate: boolean): INodeProperties[] {
  const fields: INodeProperties[] = [
    {
      displayName: 'Associated Article ID',
      name: 'associated_article_id',
      type: 'number',
      default: 0,
      description: 'ID of the article this one translates (links translations of the same article)',
    },
    {
      displayName: 'Author Name or ID',
      name: 'author_id',
      type: 'options',
      typeOptions: {
        loadOptionsMethod: 'getAgents',
      },
      default: '',
      description: forUpdate
        ? 'Agent shown as the author. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.'
        : 'Agent shown as the author (Chatwoot requires one). When empty, the node uses the user that owns the API access token. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },
    {
      displayName: 'Category Name or ID',
      name: 'category_id',
      type: 'options',
      typeOptions: {
        loadOptionsMethod: 'getCategories',
        loadOptionsDependsOn: ['portalSlug'],
      },
      default: '',
      description:
        'Category of the article. Requires Portal Slug to be filled first. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
    },
  ];
  if (forUpdate) {
    fields.push({
      displayName: 'Content',
      name: 'content',
      type: 'string',
      typeOptions: { rows: 10 },
      default: '',
      description: 'Content of the article (Markdown/HTML). Changes the published content.',
    });
  }
  fields.push({
    displayName: 'Description',
    name: 'description',
    type: 'string',
    default: '',
    description: 'Short description of the article',
  });
  if (forUpdate) {
    fields.push(
      {
        displayName: 'Draft Content',
        name: 'draft_content',
        type: 'string',
        typeOptions: { rows: 10 },
        default: '',
        description:
          'Staged edit of a published article: saved without changing the public content until it is published from Chatwoot. Requires Chatwoot 4.16+.',
      },
      {
        displayName: 'Draft Title',
        name: 'draft_title',
        type: 'string',
        default: '',
        description:
          'Staged edit of the title: saved without changing the public title. Requires Chatwoot 4.16+.',
      },
    );
  }
  fields.push(
    {
      displayName: 'Locale',
      name: 'locale',
      type: 'string',
      default: '',
      placeholder: 'es',
      description:
        'Locale of the article, e.g. "es". Defaults to the category\'s locale or the portal\'s default locale.',
    },
    {
      displayName: 'Meta Description',
      name: 'meta_description',
      type: 'string',
      default: '',
      description: 'SEO description (meta.description)',
    },
    {
      displayName: 'Meta Tags',
      name: 'meta_tags',
      type: 'string',
      default: '',
      description: 'Comma-separated SEO tags (meta.tags)',
    },
    {
      displayName: 'Meta Title',
      name: 'meta_title',
      type: 'string',
      default: '',
      description: 'SEO title (meta.title)',
    },
    {
      displayName: 'Position',
      name: 'position',
      type: 'number',
      default: 0,
      description: 'Position of the article inside its category',
    },
    {
      displayName: 'Slug',
      name: 'slug',
      type: 'string',
      default: '',
      description: 'Unique slug for the article (generated from the title when empty)',
    },
    {
      displayName: 'Status',
      name: 'status',
      type: 'options',
      options: [
        { name: 'Draft', value: 'draft' },
        { name: 'Published', value: 'published' },
        { name: 'Archived', value: 'archived' },
      ],
      default: 'draft',
      description: 'Status of the article (published articles need content)',
    },
  );
  if (forUpdate) {
    fields.push({
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      description: 'Title of the article. Changes the published title.',
    });
  }
  return fields;
}
