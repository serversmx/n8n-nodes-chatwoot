import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { chatwootApiRequest, validateId } from '../../GenericFunctions';

/**
 * Resolve the Label parameter of Label > Update/Delete to a numeric ID. The dropdown
 * (loadOptions getLabels) yields label TITLES, while /labels/:id needs the ID, so a title is
 * looked up in GET /labels (case-insensitive). A number is used as the ID directly; a numeric
 * string is first compared with the titles, then used as an ID.
 */
export async function resolveLabelId(
  this: IExecuteFunctions,
  value: unknown,
  itemIndex: number,
): Promise<number> {
  if (typeof value === 'number') return validateId(value, 'Label ID');

  const reference = String(value ?? '').trim();
  if (!reference) {
    throw new NodeOperationError(this.getNode(), 'Label is required', { itemIndex });
  }

  const response = (await chatwootApiRequest.call(
    this,
    'GET',
    '/labels',
    {},
    {},
    { itemIndex },
  )) as IDataObject | IDataObject[];
  const payload = Array.isArray(response) ? response : response.payload;
  const labels = Array.isArray(payload) ? (payload as IDataObject[]) : [];

  const byTitle = labels.find(
    (label) => String(label.title ?? '').toLowerCase() === reference.toLowerCase(),
  );
  if (byTitle) return validateId(byTitle.id, 'Label ID');
  if (/^\d+$/.test(reference)) return validateId(reference, 'Label ID');

  throw new NodeOperationError(this.getNode(), `Label "${reference}" not found`, {
    itemIndex,
    description: 'Pick the label from the list, or pass its numeric ID or its exact title.',
  });
}
