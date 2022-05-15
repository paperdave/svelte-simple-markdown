<script lang="ts">
	import { sanitizeUrl, type ASTNode } from '$lib/core';

	export let node: ASTNode;
</script>

<a sveltekit:prefetch href={sanitizeUrl(node.target)} title={node.title}>
	<slot />
</a>
