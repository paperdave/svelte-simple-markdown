# svelte-simple-markdown

This is a fork of [Simple-Markdown](https://github.com/Khan/perseus/tree/main/packages/simple-markdown/src),
modified to target Svelte, however due to separating the parsing and outputting steps, it can be
used to target any web framework.

## Philosophy

Most markdown-like parsers aim for speed or edge case handling. simple-markdown aims for
extensibility and simplicity.

What does this mean? Many websites using markdown-like languages have custom extensions, such as
`@`mentions or issue number linking. Unfortunately, most markdown-like parsers don't allow extension
without forking, and can be difficult to modify even when forked. `svelte-simple-markdown` is
designed to allow simple addition of custom extensions without needing to be forked.

At Khan Academy, the original `simple-markdown` is used to format over half of their math exercises,
because markdown extensions for math text and interactive widgets are necessary.

On davecode.net, I use the svelte version to format custom content within my
[Q&A system](https://davecode.net/q+a).

## Getting started

This module is only distributed as ES Modules, so you'll want to be using SvelteKit or Vite for your
codebase.

The first step is to create a parser and config object. You should do this in a file outside your
svelte components, so the markdown configuration is only created once, and can be reused around
your codebase.

```ts
import { createParser, defaultRules } from 'svelte-simple-markdown';

const parser = createParser(defaultRules);

export const markdownConfig = {
	parser
};
```

To add your own extensions, you just have to `clone()` the default rule list and add your own.
You'll find that `defaultRules` is a custom `RuleList` class which has some helper methods. In this
example, we add a basic issue number type.

```ts
import { createParser, defaultRules } from 'svelte-simple-markdown';
import IssueLink from '$lib/components/IssueLink.svelte';

const customRules = defaultRules.clone();

customRules.insertBefore('em', {
	name: 'issue',
	match: inlineRegex(/^#(\d+)/),
	parse(capture) {
		return {
			number: capture[1]
		};
	}
});

const parser = createParser(defaultRules);

export const markdownConfig = {
	parser,
	renderers: {
		issue: IssueLink
	}
};
```

The "before" of `insertBefore` refers to the parsing priority.

Custom Renderers are simply Svelte components given a `node` prop of the ast node. If your node has a `content` property, it is rendered into your renderer's `<slot />`.

```svelte
<script lang="ts">
	import type { ASTNode } from '$lib/core';

	export let node: ASTNode;
</script>

<a sveltekit:prefetch href="/issues/{node.id}">
	#{node.id}
</a>
```

The `Markdown` svelte component can now display any markdown string.

```svelte
<script lang="ts">
	import { Markdown } from 'svelte-simple-markdown';
	import { markdownConfig } from '$lib/markdown';
</script>

<Markdown config={markdownConfig} value="Hello **World**, see #54!" />
```

## Other Frameworks

You'll find non-svelte related code (all parsing and default rules) in
`svelte-simple-markdown/core`. To use this with other frameworks, you'll have to write your own
renderer. If you do that, please get in touch with an issue and we could try and organise this as
a multi-framework markdown project.

## Extension Overview

Elements in simple-markdown are generally created from rules.
For parsing, rules must specify `match` and `parse` methods.
For output, rules must specify a `react` or `html` method
(or both), depending on which outputter you create afterwards.

Here is an example rule, a slightly modified version of what
simple-markdown uses for parsing **strong** (**bold**) text:

```javascript
rules.add({
	name: 'strong',
	match(source, state, lookbehind) {
		return /^\*\*([\s\S]+?)\*\*(?!\*)/.exec(source);
	},
	parse(capture, recurseParse, state) {
		return {
			content: recurseParse(capture[1], state)
		};
	}
});
```

Let's look at those methods in more detail.

### `match(source: string, state: ParserState)`

simple-markdown calls your `match` function to determine whether the
upcoming markdown source matches this rule or not.

`source` is the upcoming source, beginning at the current position of
parsing (source[0] is the next character).

`state` is a mutable state object to allow for more complicated matching
and parsing. The most common field on `state` is `inline`, which all of
the default rules set to true when we are in an inline scope, and false
or undefined when we are in a block scope.

`state.lookbehind` is the string previously captured at this parsing level, to
allow for lookbehind. For example, lists check that lookbehind ends with
`/^$|\n *$/` to ensure that lists only match at the beginning of a new
line.

If this rule matches, `match` should return an object, array, or
array-like object, which we'll call `capture`, where `capture[0]`
is the full matched source, and any other fields can be used in the
rule's `parse` function. The return value from `Regexp.prototype.exec`
fits this requirement, and the common use case is to return the result
of `someRegex.exec(source)`.

If this rule does not match, `match` should return null.

NOTE: If you are using regexes in your match function, your regex
should always begin with `^`. Regexes without leading `^`s can
cause unexpected output or infinite loops.

### `parse(capture: Capture, recurseParse: Parser, state: ParserState)`

`parse` takes the output of `match` and transforms it into a syntax
tree node object, which we'll call `node` here.

`capture` is the non-null result returned from match.

`recurseParse` is a function that can be called on sub-content and
state to recursively parse the sub-content. This always returns an array.

`state` is the mutable state threading object, which can be examined
or modified, and should be passed as the second argument to any
`recurseParse` calls.

For example, to parse inline sub-content, you can add `inline: true`
to state, or `inline: false` to force block parsing (to leave the
parsing scope alone, you can just pass `state` with no modifications).
For example:

```javascript
const innerText = capture[1];
recurseParse(
	innerText,
	_.defaults(
		{
			inline: true
		},
		state
	)
);
```

`parse` should return a `node` object, which can have custom fields
that will be passed to `output`, below. The one reserved field is
`type`, which designates the type of the node, which will be used
for output. If no type is specified, simple-markdown will use the
current rule's type (the common case). If you have multiple ways
to parse a single element, it can be useful to have multiple rules
that all return nodes of the same type.
