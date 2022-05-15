import BasicRenderer from './renderers/BasicRenderer.svelte';
import ImageRenderer from './renderers/ImageRenderer.svelte';
import HeadingRenderer from './renderers/HeadingRenderer.svelte';
import CodeBlockRenderer from './renderers/CodeBlockRenderer.svelte';
import ListRenderer from './renderers/ListRenderer.svelte';
import TableRenderer from './renderers/TableRenderer.svelte';
import LinkRenderer from './renderers/LinkRenderer.svelte';
import type { SvelteRenderers } from './types';

export const defaultRenderers: SvelteRenderers = {
	heading: HeadingRenderer,
	hr: BasicRenderer,
	blockQuote: BasicRenderer,
	codeBlock: CodeBlockRenderer,
	list: ListRenderer,
	table: TableRenderer,
	paragraph: BasicRenderer,
	// tableSeparator: ???,
	link: LinkRenderer,
	image: ImageRenderer,
	em: BasicRenderer,
	strong: BasicRenderer,
	u: BasicRenderer,
	del: BasicRenderer,
	inlineCode: BasicRenderer,
	br: BasicRenderer
	// text is handled internally
};
