<script lang="ts">
	import { sanitizeUrl, type ASTNode } from '$lib/core';

	export let node: ASTNode;
</script>

<img src={sanitizeUrl(node.src)} alt={node.alt} title={node.title} />
