import type { INodeProperties } from 'n8n-workflow';

const ADVANCED_SEARCH_NOTE =
  'Requires the Advanced Search feature (Chatwoot Enterprise/premium plans); ignored otherwise.';

/** Time filters supported by every typed search endpoint (SearchService#apply_time_filter). */
function timeFilters(column: string): INodeProperties[] {
  return [
    {
      displayName: 'Since',
      name: 'since',
      type: 'dateTime',
      default: '',
      description: `Only return results whose ${column} is on or after this time. Chatwoot never looks back more than 90 days: an older time is moved to 90 days ago. ${ADVANCED_SEARCH_NOTE}`,
    },
    {
      displayName: 'Until',
      name: 'until',
      type: 'dateTime',
      default: '',
      description: `Only return results whose ${column} is on or before this time. ${ADVANCED_SEARCH_NOTE}`,
    },
  ];
}

/** The "Filters" collection of a typed search operation. */
export function searchFiltersCollection(
  operation: string,
  column: string,
  extra: INodeProperties[] = [],
): INodeProperties {
  return {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: { show: { resource: ['search'], operation: [operation] } },
    options: [...extra, ...timeFilters(column)].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    ),
  };
}
