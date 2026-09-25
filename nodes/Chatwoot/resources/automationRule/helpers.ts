import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

/** Chatwoot AutomationRule::EXECUTION_DELAY_RANGE (minutes). */
export const EXECUTION_DELAY_MIN = 10;
export const EXECUTION_DELAY_MAX = 43200;

export const LEGACY_COMPANY_HINT =
  'Automation rule condition "company" was sent as "company_name" (renamed in Chatwoot 4.14). Update the Conditions JSON to remove this hint.';

/**
 * Same predicate as Chatwoot's migration 20260427094500 (standard_company_condition?): only the
 * standard key is renamed. A custom attribute named 'company' carries a custom_attribute_type or
 * a non-standard attribute_model and is left alone.
 */
function isStandardCompanyCondition(entry: IDataObject): boolean {
  const customType = entry.custom_attribute_type;
  const model = entry.attribute_model;
  return (
    entry.attribute_key === 'company' &&
    (customType === undefined || customType === null || customType === '') &&
    (model === undefined || model === null || model === '' || model === 'standard')
  );
}

/**
 * Chatwoot 4.14 renamed the standard condition key 'company' to 'company_name' (migration
 * 20260427094500) and rejects the old key with 422 "Automation conditions company not supported".
 * Rewrites standard 'company' conditions and returns how many were rewritten.
 */
export function renameLegacyConditionKeys(conditions: unknown): {
  conditions: unknown;
  renamed: number;
} {
  if (!Array.isArray(conditions)) return { conditions, renamed: 0 };

  let renamed = 0;
  const mapped = conditions.map((condition: unknown) => {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return condition;
    const entry = condition as IDataObject;
    if (!isStandardCompanyCondition(entry)) return condition;
    renamed++;
    return { ...entry, attribute_key: 'company_name' };
  });
  return { conditions: mapped, renamed };
}

// Execute contexts that already got the hint: one warning per execution, not one per item
const hintedExecutions = new WeakSet<object>();

/** Tells the user (once per execution) that a legacy 'company' condition was rewritten. */
export function addLegacyConditionHint(context: IExecuteFunctions): void {
  if (typeof context.addExecutionHints !== 'function' || hintedExecutions.has(context)) return;
  hintedExecutions.add(context);
  context.addExecutionHints({
    message: LEGACY_COMPANY_HINT,
    type: 'warning',
    location: 'outputPane',
  });
}

/**
 * Validates the execution delay (minutes). 0 or empty means "no delay": undefined on Create (the
 * field is not sent) and null on Update (Chatwoot clears the delay). Throws a plain Error (the
 * execute catch wraps it with the item index) for values outside 10..43200.
 */
export function resolveExecutionDelay(
  value: unknown,
  mode: 'create' | 'update',
): number | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;

  const minutes = Number(value);
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
    throw new Error(`Execution Delay must be a whole number of minutes, got "${String(value)}"`);
  }
  if (minutes === 0) return mode === 'update' ? null : undefined;
  if (minutes < EXECUTION_DELAY_MIN || minutes > EXECUTION_DELAY_MAX) {
    throw new Error(
      `Execution Delay must be between ${EXECUTION_DELAY_MIN} and ${EXECUTION_DELAY_MAX} minutes (30 days), got ${minutes}`,
    );
  }
  return minutes;
}
