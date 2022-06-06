<script lang="ts">
	import type { ASTNode } from '$lib/core';
	import MarkdownNode from '../MarkdownNode.svelte';

	export let node: { ordered: boolean; content: ASTNode[][]; start: number };
</script>

<svelte:element this={node.ordered ? 'ol' : 'ul'} start={node.start}>
	{#each node.content ?? [] as child}
		<li><MarkdownNode node={child} /></li>
	{/each}
</svelte:element>
