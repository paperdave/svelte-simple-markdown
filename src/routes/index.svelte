<script lang="ts">
	import Markdown from '$lib/svelte/Markdown.svelte';
	import { davecodeQAMarkdown } from '../site';

	let value = `q: in response to #220514132129, can you share any other colors?

yeah, in @mayday i used some other color.
`;
	let inline = false;
</script>

<textarea bind:value />

<Markdown config={davecodeQAMarkdown} {value} {inline} />

<hr />

<div>
	<pre><code>{JSON.stringify(davecodeQAMarkdown.parser(value, { inline }), null, 2)}</code></pre>
</div>
