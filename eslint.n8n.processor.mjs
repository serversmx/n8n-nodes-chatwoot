/**
 * @n8n/eslint-plugin-community-nodes ships rules that inspect `package.json`
 * (e.g. `n8n-object-validation`, `valid-peer-dependencies`, `no-runtime-dependencies`)
 * using plain ESTree node types (`ObjectExpression`, `Property`, `Literal`) via
 * `@typescript-eslint/utils`'s `AST_NODE_TYPES`. ESLint's default parser (espree)
 * cannot parse a bare JSON object as a `Program` — a leading `{` is grammatically
 * a block statement, not an object expression — so `package.json` needs a small
 * assist to be linted with those rules.
 *
 * This processor wraps the file's text in parentheses before espree sees it,
 * which turns the top-level object into `(<object>)`, a valid
 * `ExpressionStatement` containing an `ObjectExpression` — exactly the shape the
 * plugin's package.json rules expect (see their `getTopLevelObjectInJson`
 * helper, which asserts `node.parent.type === 'ExpressionStatement'`).
 *
 * Only column offsets on the first line are affected (by the single inserted
 * "(" character), so `postprocess` shifts them back for accurate reporting.
 */

/** @type {import('eslint').Linter.Processor} */
export const jsonAsJsProcessor = {
	meta: {
		name: 'n8n-package-json-processor',
	},
	preprocess(text) {
		return [`(${text}\n)`];
	},
	postprocess(messagesList) {
		const messages = messagesList[0] ?? [];
		return messages.map((message) => ({
			...message,
			column: message.line === 1 && message.column > 1 ? message.column - 1 : message.column,
			endColumn:
				message.endColumn && message.endLine === 1 && message.endColumn > 1
					? message.endColumn - 1
					: message.endColumn,
		}));
	},
	supportsAutofix: false,
};

export default jsonAsJsProcessor;
