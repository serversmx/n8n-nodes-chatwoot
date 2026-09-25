// n8n community-node package verification lint.
//
// This is a separate, ESLint 9 flat-config entry point used only by
// `npm run lint:n8n`. It runs @n8n/eslint-plugin-community-nodes' recommended
// rules against the node/credential source and package.json, matching the
// static checks n8n's own community-node verification pipeline runs before
// listing a package. It is intentionally kept apart from `.eslintrc.js`
// (ESLint 8 legacy config, used by `npm run lint`) because the plugin
// requires ESLint 9's flat config and pins an exact ESLint peer version.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import n8nNodesBasePlugin from 'eslint-plugin-n8n-nodes-base';
import n8nCommunityNodesPlugin from '@n8n/eslint-plugin-community-nodes';

import { jsonAsJsProcessor } from './eslint.n8n.processor.mjs';

export default [
	{
		// Parse TypeScript sources with the TS parser so the plugin's rules see
		// a real AST instead of a syntax error from the default parser (espree).
		// `@typescript-eslint` and `n8n-nodes-base` are registered (with no
		// rules turned on here) purely so this config recognises the existing
		// `// eslint-disable-next-line <rule>` comments written for those two
		// plugins under `.eslintrc.js` (the `npm run lint` config) — without
		// this, ESLint reports "Definition for rule '...' was not found" for
		// each of them, which isn't a real @n8n/community-nodes finding.
		files: ['**/*.ts'],
		plugins: {
			'@typescript-eslint': tsPlugin,
			'n8n-nodes-base': n8nNodesBasePlugin,
		},
		languageOptions: {
			parser: tsParser,
			sourceType: 'module',
			ecmaVersion: 2020,
		},
		// Those disable comments target rules that only `npm run lint` enables, so they
		// always look unused here.
		linterOptions: {
			reportUnusedDisableDirectives: 'off',
		},
	},
	n8nCommunityNodesPlugin.configs.recommended,
	{
		// See eslint.n8n.processor.mjs for why package.json needs this.
		files: ['package.json'],
		processor: jsonAsJsProcessor,
	},
];
