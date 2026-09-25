import type { INodeProperties } from 'n8n-workflow';
import { createPortalOperation } from './createPortal.operation';
import { getPortalOperation } from './getPortal.operation';
import { updatePortalOperation } from './updatePortal.operation';
import { createCategoryOperation } from './createCategory.operation';
import { createArticleOperation } from './createArticle.operation';
import { listPortalsOperation } from './listPortals.operation';
import { listCategoriesOperation } from './listCategories.operation';
import { listArticlesOperation } from './listArticles.operation';
import { articleOperation } from './article.operation';
import { categoryOperation } from './category.operation';
import { portalOperation } from './portal.operation';
import { bulkOperation } from './bulk.operation';

// Portals are addressed by slug (find_by!(slug:)): a numeric ID returns 404. Creating, updating and
// deleting requires an administrator (or the knowledge_base_manage custom role on Enterprise).
export const helpCenterOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['helpCenter'],
    },
  },
  options: [
    {
      name: 'Bulk Delete Articles',
      value: 'bulkDeleteArticles',
      description: 'Delete several articles of a portal at once. Requires Chatwoot 4.14+.',
      action: 'Bulk delete articles',
    },
    {
      name: 'Bulk Update Article Category',
      value: 'bulkUpdateArticleCategory',
      description: 'Move several articles to another category. Requires Chatwoot 4.14+.',
      action: 'Bulk update article category',
    },
    {
      name: 'Bulk Update Article Status',
      value: 'bulkUpdateArticleStatus',
      description:
        'Publish, archive or move to draft several articles at once. Requires Chatwoot 4.14+.',
      action: 'Bulk update article status',
    },
    {
      name: 'Create Article',
      value: 'createArticle',
      description:
        'Create a help center article (draft by default). The author defaults to the token owner.',
      action: 'Create article',
    },
    {
      name: 'Create Category',
      value: 'createCategory',
      description: 'Create a new help center category',
      action: 'Create category',
    },
    {
      name: 'Create Portal',
      value: 'createPortal',
      description: 'Create a new help center portal (locales, layout, color, social links)',
      action: 'Create portal',
    },
    {
      name: 'Delete Article',
      value: 'deleteArticle',
      description: 'Delete a help center article',
      action: 'Delete article',
    },
    {
      name: 'Delete Category',
      value: 'deleteCategory',
      description: 'Delete a help center category',
      action: 'Delete category',
    },
    {
      name: 'Delete Portal',
      value: 'deletePortal',
      description: 'Delete a help center portal with its categories and articles',
      action: 'Delete portal',
    },
    {
      name: 'Get Article',
      value: 'getArticle',
      description: 'Get a help center article with its content, draft edits and category',
      action: 'Get article',
    },
    {
      name: 'Get Category',
      value: 'getCategory',
      description: 'Get a help center category',
      action: 'Get category',
    },
    {
      name: 'Get Portal',
      value: 'getPortal',
      description: 'Get a help center portal with its config and article counts',
      action: 'Get portal',
    },
    {
      name: 'List Articles',
      value: 'listArticles',
      description:
        'List or search the articles of a portal (filter by locale, category, status, author)',
      action: 'List articles',
    },
    {
      name: 'List Categories',
      value: 'listCategories',
      description: 'List the categories of a portal',
      action: 'List categories',
    },
    {
      name: 'List Portals',
      value: 'listPortals',
      description: 'List all help center portals',
      action: 'List portals',
    },
    {
      name: 'Update Article',
      value: 'updateArticle',
      description:
        'Update an article, or stage a draft edit of a published article (Draft Title/Content, Chatwoot 4.16+)',
      action: 'Update article',
    },
    {
      name: 'Update Category',
      value: 'updateCategory',
      description: 'Update a help center category',
      action: 'Update category',
    },
    {
      name: 'Update Portal',
      value: 'updatePortal',
      description:
        'Update a help center portal (config changes are merged into the current config)',
      action: 'Update portal',
    },
  ],
  default: 'getPortal',
};

export const helpCenterFields: INodeProperties[] = [
  ...createPortalOperation,
  ...getPortalOperation,
  ...updatePortalOperation,
  ...createCategoryOperation,
  ...createArticleOperation,
  ...listPortalsOperation,
  ...listCategoriesOperation,
  ...listArticlesOperation,
  ...articleOperation,
  ...categoryOperation,
  ...portalOperation,
  ...bulkOperation,
];
