<script lang="ts">
	import type { ASTNode } from '$lib/core';
	import MarkdownNode from '../MarkdownNode.svelte';

	export let node: ASTNode;
</script>

<table>
	<thead>
		<tr>
			{#each node.header as headerItem, i}
				<th style:text-align={node.align[i]}><MarkdownNode node={headerItem} /></th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each node.cells as row}
			<tr>
				{#each row as cell, i}
					<td style:text-align={node.align[i]}><MarkdownNode node={cell} /></td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
