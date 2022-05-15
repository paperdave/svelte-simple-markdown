<script lang="ts">
	import type { ASTNode } from '$lib/core';

	export let node: ASTNode;
</script>

<pre data-lang={node.lang}><code>{node.content}</code></pre>
