import { RuleList } from './rule-list';
import type { ASTNode, Parser, ParserState, RefNode } from './type';
import {
	anyScopeRegex,
	blockRegex,
	ignoreCapture,
	inlineRegex,
	parseCaptureInline,
	parseInline,
	unescapeUrl
} from './utilities';

// recognize a `*` `-`, `+`, `1.`, `2.`... list bullet
const LIST_BULLET = '(?:[*+-]|\\d+\\.)';

// recognize the start of a list item:
// leading space plus a bullet plus a space (`   * `)
const LIST_ITEM_PREFIX = '( *)(' + LIST_BULLET + ') +';
const LIST_ITEM_PREFIX_R = new RegExp('^' + LIST_ITEM_PREFIX);

// recognize an individual list item:
//  * hi
//    this is part of the same item
//
//    as is this, which is a new paragraph in the same item
//
//  * but this is not part of the same item
const LIST_ITEM_R = new RegExp(
	LIST_ITEM_PREFIX + '[^\\n]*(?:\\n' + '(?!\\1' + LIST_BULLET + ' )[^\\n]*)*(\n|$)',
	'gm'
);
const BLOCK_END_R = /\n{2,}$/;
const INLINE_CODE_ESCAPE_BACKTICKS_R = /^ (?= *`)|(` *) $/g;

// recognize the end of a paragraph block inside a list item:
// two or more newlines at end end of the item
const LIST_BLOCK_END_R = BLOCK_END_R;
const LIST_ITEM_END_R = / *\n+$/;

// check whether a list item has paragraphs: if it does,
// we leave the newlines at the end
const LIST_R = new RegExp(
	'^( *)(' +
		LIST_BULLET +
		') ' +
		'[\\s\\S]+?(?:\n{2,}(?! )' +
		'(?!\\1' +
		LIST_BULLET +
		' )\\n*' +
		// the \\s*$ here is so that we can parse the inside of nested
		// lists, where our content might end before we receive two `\n`s
		'|\\s*\n*$)'
);
const LIST_LOOKBEHIND_R = /(?:^|\n)( *)$/;

const TABLES = (function () {
	const TABLE_ROW_SEPARATOR_TRIM = /^ *\| *| *\| *$/g;
	const TABLE_CELL_END_TRIM = / *$/;
	const TABLE_RIGHT_ALIGN = /^ *-+: *$/;
	const TABLE_CENTER_ALIGN = /^ *:-+: *$/;
	const TABLE_LEFT_ALIGN = /^ *:-+ *$/; // TODO: This needs a real type

	const parseTableAlignCapture = (alignCapture: string) => {
		if (TABLE_RIGHT_ALIGN.test(alignCapture)) {
			return 'right';
		} else if (TABLE_CENTER_ALIGN.test(alignCapture)) {
			return 'center';
		} else if (TABLE_LEFT_ALIGN.test(alignCapture)) {
			return 'left';
		} else {
			return null;
		}
	};

	const parseTableAlign = (source: string, trimEndSeparators: boolean) => {
		if (trimEndSeparators) {
			source = source.replace(TABLE_ROW_SEPARATOR_TRIM, '');
		}

		const alignText = source.trim().split('|');
		return alignText.map(parseTableAlignCapture);
	};

	const parseTableRow = (
		source: string,
		parse: Parser,
		state: ParserState,
		trimEndSeparators: boolean
	) => {
		const prevInTable = state.inTable;
		state.inTable = true;
		const tableRow = parse(source.trim(), state);
		state.inTable = prevInTable;
		const cells: ASTNode[][] = [[]];
		tableRow.forEach(function (node, i) {
			if (node.type === 'tableSeparator') {
				// Filter out empty table separators at the start/end:
				if (!trimEndSeparators || (i !== 0 && i !== tableRow.length - 1)) {
					// Split the current row:
					cells.push([]);
				}
			} else {
				if (
					typeof node.content === 'string' &&
					(tableRow[i + 1] == null || tableRow[i + 1].type === 'tableSeparator')
				) {
					node.content = node.content.replace(TABLE_CELL_END_TRIM, '');
				}

				cells[cells.length - 1].push(node);
			}
		});
		return cells;
	};

	/**
	 * @param {string} source
	 * @param {SimpleMarkdown.Parser} parse
	 * @param {SimpleMarkdown.State} state
	 * @param {boolean} trimEndSeparators
	 * @returns {SimpleMarkdown.ASTNode[][]}
	 */
	const parseTableCells = function (
		source: string,
		parse: Parser,
		state: ParserState,
		trimEndSeparators: boolean
	) {
		const rowsText = source.trim().split('\n');
		return rowsText.map(function (rowText) {
			return parseTableRow(rowText, parse, state, trimEndSeparators);
		});
	};

	/**
	 * @param {boolean} trimEndSeparators
	 * @returns {SimpleMarkdown.SingleNodeParseFunction}
	 */
	const parseTable = function (trimEndSeparators: boolean) {
		return function (capture: RegExpMatchArray, parse: Parser, state: ParserState) {
			state.inline = true;
			const header = parseTableRow(capture[1], parse, state, trimEndSeparators);
			const align = parseTableAlign(capture[2], trimEndSeparators);
			const cells = parseTableCells(capture[3], parse, state, trimEndSeparators);
			state.inline = false;
			return {
				type: 'table',
				header: header,
				align: align,
				cells: cells
			};
		};
	};

	return {
		parseTable: parseTable(true),
		parseNpTable: parseTable(false),
		TABLE_REGEX: /^ *(\|.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/,
		NPTABLE_REGEX: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/
	};
})();

const LINK_INSIDE = '(?:\\[[^\\]]*\\]|[^\\[\\]]|\\](?=[^\\[]*\\]))*';
const LINK_HREF_AND_TITLE =
	'\\s*<?((?:\\([^)]*\\)|[^\\s\\\\]|\\\\.)*?)>?(?:\\s+[\'"]([\\s\\S]*?)[\'"])?\\s*';
const AUTOLINK_MAILTO_CHECK_R = /mailto:/i;

function parseRef(capture: RegExpMatchArray, state: ParserState, refNode: RefNode) {
	const ref = (capture[2] || capture[1]).replace(/\s+/g, ' ').toLowerCase();

	// We store information about previously seen defs on
	// state._defs (_ to deconflict with client-defined
	// state). If the def for this reflink/refimage has
	// already been seen, we can use its target/source
	// and title here:
	if (state._defs && state._defs[ref]) {
		const def = state._defs[ref];

		// `refNode` can be a link or an image. Both use
		// target and title properties.
		refNode.target = def.target;
		refNode.title = def.title;
	}

	// In case we haven't seen our def yet (or if someone
	// overwrites that def later on), we add this node
	// to the list of ref nodes for that def. Then, when
	// we find the def, we can modify this link/image AST
	// node :).
	// I'm sorry.
	state._refs = state._refs || {};
	state._refs[ref] = state._refs[ref] || [];

	state._refs[ref].push(refNode);

	return refNode;
}

export const defaultRules = new RuleList();

defaultRules.add({
	name: 'heading',
	match: blockRegex(/^ *(#{1,6})([^\n]+?)#* *(?:\n *)+\n/),
	parse: function (capture, parse, state) {
		return {
			level: capture[1].length,
			content: parseInline(parse, capture[2].trim(), state)
		};
	}
});

defaultRules.add({
	name: 'nptable',
	match: blockRegex(TABLES.NPTABLE_REGEX),
	parse: TABLES.parseNpTable
});

defaultRules.add({
	name: 'lheading',
	match: blockRegex(/^([^\n]+)\n *(=|-){3,} *(?:\n *)+\n/),
	parse(capture, parse, state) {
		return {
			type: 'heading',
			level: capture[2] === '=' ? 1 : 2,
			content: parseInline(parse, capture[1], state)
		};
	}
});

defaultRules.add({
	name: 'hr',
	match: blockRegex(/^( *[-*_]){3,} *(?:\n *)+\n/),
	parse: ignoreCapture
});

defaultRules.add({
	name: 'codeBlock',
	match: blockRegex(/^(?: {4}[^\n]+\n*)+(?:\n *)+\n/),
	parse(capture) {
		const content = capture[0].replace(/^ {4}/gm, '').replace(/\n+$/, '');
		return {
			lang: undefined,
			content: content
		};
	}
});

defaultRules.add({
	name: 'fence',
	match: blockRegex(/^ *(`{3,}|~{3,}) *(?:(\S+) *)?\n([\s\S]+?)\n?\1 *(?:\n *)+\n/),
	parse(capture) {
		return {
			type: 'codeBlock',
			lang: capture[2] || undefined,
			content: capture[3]
		};
	}
});

defaultRules.add({
	name: 'blockQuote',
	match: blockRegex(/^( *>[^\n]+(\n[^\n]+)*\n*)+\n{2,}/),
	parse(capture, parse, state) {
		const content = capture[0].replace(/^ *> ?/gm, '');
		return {
			content: parse(content, state)
		};
	}
});

defaultRules.add({
	name: 'list',

	match(source, state) {
		// We only want to break into a list if we are at the start of a
		// line. This is to avoid parsing "hi * there" with "* there"
		// becoming a part of a list.
		// You might wonder, "but that's inline, so of course it wouldn't
		// start a list?". You would be correct! Except that some of our
		// lists can be inline, because they might be inside another list,
		// in which case we can parse with inline scope, but need to allow
		// nested lists inside this inline scope.
		const prevCaptureStr = state.prevCapture == null ? '' : state.prevCapture[0];
		const isStartOfLineCapture = LIST_LOOKBEHIND_R.exec(prevCaptureStr);
		const isListBlock = state._list || !state.inline;

		if (isStartOfLineCapture && isListBlock) {
			source = isStartOfLineCapture[1] + source;
			return LIST_R.exec(source);
		} else {
			return null;
		}
	},
	parse(capture, parse, state) {
		const bullet = capture[2];
		const ordered = bullet.length > 1;
		const start = ordered ? +bullet : undefined;
		// We know this will match here, because of how the regexes are defined
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const items = capture[0].replace(LIST_BLOCK_END_R, '\n').match(LIST_ITEM_R)!;

		let lastItemWasAParagraph = false;
		const itemContent = items.map(function (item, i) {
			// We need to see how far indented this item is:
			const prefixCapture = LIST_ITEM_PREFIX_R.exec(item);
			const space = prefixCapture ? prefixCapture[0].length : 0; // And then we construct a regex to "unindent" the subsequent
			// lines of the items by that amount:

			const spaceRegex = new RegExp('^ {1,' + space + '}', 'gm'); // Before processing the item, we need a couple things

			const content = item // remove indents on trailing lines:
				.replace(spaceRegex, '') // remove the bullet:
				.replace(LIST_ITEM_PREFIX_R, ''); // I'm not sur4 why this is necessary again?
			// Handling "loose" lists, like:
			//
			//  * this is wrapped in a paragraph
			//
			//  * as is this
			//
			//  * as is this

			const isLastItem = i === items.length - 1;
			const containsBlocks = content.indexOf('\n\n') !== -1; // Any element in a list is a block if it contains multiple
			// newlines. The last element in the list can also be a block
			// if the previous item in the list was a block (this is
			// because non-last items in the list can end with \n\n, but
			// the last item can't, so we just "inherit" this property
			// from our previous element).

			const thisItemIsAParagraph = containsBlocks || (isLastItem && lastItemWasAParagraph);
			lastItemWasAParagraph = thisItemIsAParagraph; // backup our state for restoration afterwards. We're going to
			// want to set state._list to true, and state.inline depending
			// on our list's looseness.

			const oldStateInline = state.inline;
			const oldStateList = state._list;
			state._list = true; // Parse inline if we're in a tight list, or block if we're in
			// a loose list.

			let adjustedContent;

			if (thisItemIsAParagraph) {
				state.inline = false;
				adjustedContent = content.replace(LIST_ITEM_END_R, '\n\n');
			} else {
				state.inline = true;
				adjustedContent = content.replace(LIST_ITEM_END_R, '');
			}

			const result = parse(adjustedContent, state); // Restore our state before returning

			state.inline = oldStateInline;
			state._list = oldStateList;
			return result;
		});

		return {
			ordered: ordered,
			start: start,
			content: itemContent
		};
	}
});

defaultRules.add({
	name: 'def',
	// TODO(aria): This will match without a blank line before the next
	// block element, which is inconsistent with most of the rest of
	// simple-markdown.
	match: blockRegex(/^ *\[([^\]]+)\]: *<?([^\s>]*)>?(?: +["(]([^\n]+)[")])? *\n(?: *\n)*/),
	parse(capture, parse, state) {
		const def = capture[1].replace(/\s+/g, ' ').toLowerCase();
		const target = capture[2];
		const title = capture[3];

		// Look for previous links/images using this def
		// If any links/images using this def have already been declared,
		// they will have added themselves to the state._refs[def] list
		// (_ to deconflict with client-defined state). We look through
		// that list of reflinks for this def, and modify those AST nodes
		// with our newly found information now.
		// Sorry :(.
		if (state._refs && state._refs[def]) {
			// `refNode` can be a link or an image
			state._refs[def].forEach((refNode: RefNode) => {
				refNode.target = target;
				refNode.title = title;
			});
		}

		// Add this def to our map of defs for any future links/images
		// In case we haven't found any or all of the refs referring to
		// this def yet, we add our def to the table of known defs, so
		// that future reflinks can modify themselves appropriately with
		// this information.
		state._defs = state._defs || {};
		state._defs[def] = {
			target: target,
			title: title
		};

		// return the relevant parsed information
		// for debugging only.
		return {
			def: def,
			target: target,
			title: title
		};
	}
});

defaultRules.add({
	name: 'table',
	match: blockRegex(TABLES.TABLE_REGEX),
	parse: TABLES.parseTable
});

defaultRules.add({
	name: 'newline',
	match: blockRegex(/^(?:\n *)*\n/),
	parse: ignoreCapture
});

defaultRules.add({
	name: 'paragraph',
	match: blockRegex(/^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
	parse: parseCaptureInline
});

defaultRules.add({
	name: 'escape',
	// We don't allow escaping numbers, letters, or spaces here so that
	// backslashes used in plain text still get rendered. But allowing
	// escaping anything else provides a very flexible escape mechanism,
	// regardless of how this grammar is extended.
	match: inlineRegex(/^\\([^0-9A-Za-z\s])/),
	parse(capture) {
		return {
			type: 'text',
			content: capture[1]
		};
	}
});

defaultRules.add({
	name: 'tableSeparator',

	match(source, state) {
		if (!state.inTable) {
			return null;
		}

		return /^ *\| */.exec(source);
	},
	parse() {
		return {
			type: 'tableSeparator'
		};
	}
});

defaultRules.add({
	name: 'autolink',
	match: inlineRegex(/^<([^: >]+:\/[^ >]+)>/),
	parse(capture) {
		return {
			type: 'link',
			content: [
				{
					type: 'text',
					content: capture[1]
				}
			],
			target: capture[1]
		};
	}
});

defaultRules.add({
	name: 'mailto',
	match: inlineRegex(/^<([^ >]+@[^ >]+)>/),
	parse(capture) {
		const address = capture[1];
		let target = capture[1]; // Check for a `mailto:` already existing in the link:

		if (!AUTOLINK_MAILTO_CHECK_R.test(target)) {
			target = 'mailto:' + target;
		}

		return {
			type: 'link',
			content: [
				{
					type: 'text',
					content: address
				}
			],
			target: target
		};
	}
});

defaultRules.add({
	name: 'url',
	match: inlineRegex(/^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/),
	parse(capture) {
		return {
			type: 'link',
			content: [
				{
					type: 'text',
					content: capture[1]
				}
			],
			target: capture[1],
			title: undefined
		};
	}
});

defaultRules.add({
	name: 'link',
	match: inlineRegex(new RegExp('^\\[(' + LINK_INSIDE + ')\\]\\(' + LINK_HREF_AND_TITLE + '\\)')),
	parse(capture, parse, state) {
		const link = {
			content: parse(capture[1], state),
			target: unescapeUrl(capture[2]),
			title: capture[3]
		};
		return link;
	}
});

defaultRules.add({
	name: 'image',
	match: inlineRegex(new RegExp('^!\\[(' + LINK_INSIDE + ')\\]\\(' + LINK_HREF_AND_TITLE + '\\)')),
	parse: function (capture) {
		const image = {
			alt: capture[1],
			target: unescapeUrl(capture[2]),
			title: capture[3]
		};
		return image;
	}
});

defaultRules.add({
	name: 'reflink',
	match: inlineRegex(
		new RegExp( // The first [part] of the link
			'^\\[(' +
				LINK_INSIDE +
				')\\]' + // The [ref] target of the link
				'\\s*\\[([^\\]]*)\\]'
		)
	),
	parse(capture, parse, state) {
		return parseRef(capture, state, {
			type: 'link',
			content: parse(capture[1], state)
		});
	}
});

defaultRules.add({
	name: 'refimage',
	match: inlineRegex(
		new RegExp( // The first [part] of the link
			'^!\\[(' +
				LINK_INSIDE +
				')\\]' + // The [ref] target of the link
				'\\s*\\[([^\\]]*)\\]'
		)
	),
	parse(capture, parse, state) {
		return parseRef(capture, state, {
			type: 'image',
			alt: capture[1]
		});
	}
});

defaultRules.add({
	name: 'em',
	/* same as strong/u */
	match: inlineRegex(
		new RegExp( // only match _s surrounding words.
			'^\\b_' +
				'((?:__|\\\\[\\s\\S]|[^\\\\_])+?)_' +
				'\\b' + // Or match *s:
				'|' + // Only match *s that are followed by a non-space:
				'^\\*(?=\\S)(' + // Match at least one of:
				'(?:' + //  - `**`: so that bolds inside italics don't close the
				//          italics
				'\\*\\*|' + //  - escape sequence: so escaped *s don't close us
				'\\\\[\\s\\S]|' + //  - whitespace: followed by a non-* (we don't
				//          want ' *' to close an italics--it might
				//          start a list)
				'\\s+(?:\\\\[\\s\\S]|[^\\s\\*\\\\]|\\*\\*)|' + //  - non-whitespace, non-*, non-backslash characters
				'[^\\s\\*\\\\]' +
				')+?' + // followed by a non-space, non-* then *
				')\\*(?!\\*)'
		)
	),
	quality(capture) {
		// precedence by length, `em` wins ties:
		return capture[0].length + 0.2;
	},
	parse(capture, parse, state) {
		return {
			content: parse(capture[2] || capture[1], state)
		};
	}
});

defaultRules.add({
	name: 'strong',
	/* same as em */
	match: inlineRegex(/^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/),
	quality(capture) {
		// precedence by length, wins ties vs `u`:
		return capture[0].length + 0.1;
	},
	parse: parseCaptureInline
});

defaultRules.add({
	name: 'u',
	/* same as em&strong; increment for next rule */
	match: inlineRegex(/^__((?:\\[\s\S]|[^\\])+?)__(?!_)/),
	quality(capture) {
		// precedence by length, loses all ties
		return capture[0].length;
	},
	parse: parseCaptureInline
});

defaultRules.add({
	name: 'del',
	match: inlineRegex(/^~~(?=\S)((?:\\[\s\S]|~(?!~)|[^\s~\\]|\s(?!~~))+?)~~/),
	parse: parseCaptureInline
});

defaultRules.add({
	name: 'inlineCode',
	match: inlineRegex(/^(`+)([\s\S]*?[^`])\1(?!`)/),
	parse(capture) {
		return {
			content: capture[2].replace(INLINE_CODE_ESCAPE_BACKTICKS_R, '$1')
		};
	}
});

defaultRules.add({
	name: 'br',
	match: anyScopeRegex(/^ {2,}\n/),
	parse: ignoreCapture
});

defaultRules.add({
	name: 'text',
	// Here we look for anything followed by non-symbols,
	// double newlines, or double-space-newlines
	// We break on any symbol characters so that this grammar
	// is easy to extend without needing to modify this regex
	match: anyScopeRegex(/^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n\n| {2,}\n|\w+:\S|$)/),
	parse: function (capture) {
		return {
			content: capture[0]
		};
	}
});
