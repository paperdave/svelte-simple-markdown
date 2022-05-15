import type { ASTNode, Parser } from '$lib/core';
import type { SvelteComponentTyped } from 'svelte';

type Class<T> = { new (...args: any[]): T };

export type SvelteRenderers = Record<string, Class<SvelteComponentTyped>>;

export interface SvelteRendererProps {
	node: ASTNode;
}

export interface MarkdownConfig {
	parser: Parser;
	renderers?: SvelteRenderers;
}
