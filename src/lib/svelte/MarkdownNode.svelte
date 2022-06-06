<script lang="ts">
	import type { ASTNode } from '$lib/core';
	import { getContext } from 'svelte';
	import { RENDERER_CONTEXT } from './Markdown.svelte';
	import type { SvelteRenderers } from './types';

	export let node: ASTNode | ASTNode[];

	const renderers: SvelteRenderers = getContext(RENDERER_CONTEXT);
</script>

{#if Array.isArray(node)}
	{#each node as child}
		<svelte:self node={child} />
	{/each}
{:else if node.type === 'text'}
	{node.content}
{:else if renderers[node.type]}
	<svelte:component this={renderers[node.type]} {node}>
		{#if typeof node.content === 'string'}
			{node.content}
		{:else if node.content}
			<svelte:self node={node.content} />
		{/if}
	</svelte:component>
{/if}
