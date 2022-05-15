<script lang="ts">
	import type { ASTNode } from '$lib/core';

	export let node: ASTNode;
</script>

<span class="artifact">
	{node.id}
</span>

<style>
	.artifact {
		font-weight: bold;
		color: black;
		background-color: red;
		border-radius: 4px;
		padding: 2px 4px;
	}
</style>
