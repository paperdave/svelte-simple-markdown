<script context="module" lang="ts">
	export const RENDERER_CONTEXT = Symbol.for('simple-markdown-svelte.renderers');
</script>

<script lang="ts">
	import type { Parser } from '$lib/core';
	import { setContext } from 'svelte';
	import { defaultRenderers } from './default-renderers';
	import MarkdownNode from './MarkdownNode.svelte';
	import type { MarkdownConfig } from './types';

	export let config: MarkdownConfig;
	export let value: string = '';
	export let inline = false;

	setContext(RENDERER_CONTEXT, {
		...defaultRenderers,
		...config.renderers
	});

	$: node = config.parser(value, { inline });
</script>

<MarkdownNode {node} />
