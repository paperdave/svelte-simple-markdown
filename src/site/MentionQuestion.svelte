<script lang="ts">
	import type { ASTNode } from '$lib/core';

	export let node: ASTNode;

	export function parseQuestionDateId(id: string) {
		const match = id.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
		if (!match) {
			return null;
		}
		const [, year, month, day, hour, minute, second] = match;
		return new Date(`${month} ${day} 20${year} ${hour}:${minute}:${second} EST`);
	}

	$: date = parseQuestionDateId(node.id);
</script>

<span class="question">
	q+a: {date?.toISOString()}
</span>

<style>
	.question {
		font-weight: bold;
		color: black;
		background-color: orange;
		border-radius: 4px;
		padding: 2px 4px;
	}
</style>
