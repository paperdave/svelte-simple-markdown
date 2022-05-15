import type { MatchFunction, Parser, ParserState } from './type';

/** Creates a match function for an inline scoped element from a regex */
export function inlineRegex(regex: RegExp): MatchFunction {
	return (source, state) => {
		if (state.inline) {
			return regex.exec(source);
		} else {
			return null;
		}
	};
}

/** Creates a match function for a block scoped element from a regex */
export function blockRegex(regex: RegExp): MatchFunction {
	return (source, state) => {
		if (state.inline) {
			return null;
		} else {
			return regex.exec(source);
		}
	};
}

/** Creates a match function from a regex, ignoring block/inline scope */
export function anyScopeRegex(regex: RegExp): MatchFunction {
	return (source) => {
		return regex.exec(source);
	};
}

const UNESCAPE_URL_R = /\\([^0-9A-Za-z\s])/g;
export function unescapeUrl(rawUrlString: string) {
	return rawUrlString.replace(UNESCAPE_URL_R, '$1');
}

/**
 * Parse some content with the parser `parse`, with state.inline
 * set to true. Useful for block elements; not generally necessary
 * to be used by inline elements (where state.inline is already true.
 */
export function parseInline(parse: Parser, content: string, state: ParserState) {
	const isCurrentlyInline = state.inline || false;
	state.inline = true;
	const result = parse(content, state);
	state.inline = isCurrentlyInline;
	return result;
}

export function parseBlock(parse: Parser, content: string, state: ParserState) {
	const isCurrentlyInline = state.inline || false;
	state.inline = false;
	const result = parse(content + '\n\n', state);
	state.inline = isCurrentlyInline;
	return result;
}

export function parseCaptureInline(capture: RegExpMatchArray, parse: Parser, state: ParserState) {
	return {
		content: parseInline(parse, capture[1], state)
	};
}

export function ignoreCapture() {
	return {};
}

export function sanitizeUrl(url?: string) {
	if (url == null) {
		return null;
	}
	try {
		const prot = new URL(url, 'https://localhost').protocol;
		if (
			prot.indexOf('javascript:') === 0 ||
			prot.indexOf('vbscript:') === 0 ||
			prot.indexOf('data:') === 0
		) {
			return null;
		}
	} catch (e) {
		// invalid URLs should throw a TypeError
		// see for instance: `new URL("");`
		return null;
	}
	return url;
}
