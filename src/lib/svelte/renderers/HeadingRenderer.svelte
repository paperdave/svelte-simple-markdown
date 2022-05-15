<script lang="ts">
	import type { ASTNode } from '$lib/core';

	export let node: ASTNode;
</script>

<svelte:element this={'h' + node.level}><slot /></svelte:element>
