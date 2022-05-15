# Simple-Markdown Core

This is a fork of [Simple-Markdown](https://github.com/Khan/perseus/tree/main/packages/simple-markdown/src),
but with some modifications.

- Converted to multiple TypeScript files / ES Modules
- Instead of using an object of parser rules, a custom class `RuleList` exists to easily insert
  custom rules between existing ones. In the future I'd like to make it easy to enable/disable and
  (in the future) split the code for `default-rules.ts` up a little bit.
- Removed all rendering support from this, as I want to make this implementation
  framework-independent and adaptable to other libraries beyond Svelte. If desired, we could split
  up the code into multiple packages, but I think that would deviate from the simplicity. I'll
  consider this if anyone wants to write renderers for vue or other frameworks (need to rewrite
  react and html too).

Various minor changes have been made as well

- Removed array support, meaning a rule's parse function cannot return an array.
- Adjacent text nodes will be comebined into one.
