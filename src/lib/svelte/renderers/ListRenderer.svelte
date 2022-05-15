<script lang="ts">
	import type { ASTNode } from '$lib/core';

	export let node: ASTNode;
</script>

<svelte:element this={node.ordered ? 'ol' : 'ul'} start={node.start}><slot /></svelte:element>
