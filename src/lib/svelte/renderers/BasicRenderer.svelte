<script context="module" lang="ts">
	const tagNames: Record<string, string> = {
		paragraph: 'p',
		hr: 'hr',
		blockQuote: 'blockquote',
		em: 'em',
		strong: 'strong',
		u: 'u',
		del: 'del',
		inlineCode: 'code',
		br: 'br'
	};
</script>

<script lang="ts">
	import type { ASTNode } from '$lib/core';

	export let node: ASTNode;
</script>

<svelte:element this={tagNames[node.type]}><slot /></svelte:element>
