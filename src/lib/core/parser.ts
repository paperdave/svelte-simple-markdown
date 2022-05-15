/* eslint-disable prefer-spread, no-regex-spaces, no-unused-vars, guard-for-in, no-console, prefer-const, @typescript-eslint/no-non-null-assertion */
import type { RuleList } from './rule-list';
import type { ASTNode, ParserState } from './type';

const CR_NEWLINE_R = /\r\n?/g;
const TAB_R = /\t/g;
const FORMFEED_R = /\f/g;

/**
 * Turn various whitespace into easy-to-process whitespace
 */
function preprocess(source: string) {
	return source.replace(CR_NEWLINE_R, '\n').replace(FORMFEED_R, '').replace(TAB_R, '    ');
}

function populateInitialState(
	givenState: Partial<ParserState>,
	defaultState: Partial<ParserState>
) {
	let state = givenState || {};

	for (let prop in defaultState) {
		if (Object.prototype.hasOwnProperty.call(defaultState, prop)) {
			state[prop] = defaultState[prop];
		}
	}

	return state as ParserState;
}

/**
 * Creates a parser for a given set of rules, with the precedence
 * specified as a list of rules.
 *
 * @param rules
 *     an object containing
 *     rule type -> {match, order, parse} objects
 *     (lower order is higher precedence)
 * @param [defaultState]
 *
 * @returns
 *     The resulting parse function, with the following parameters:
 *     @source: the input source string to be parsed
 *     @state: an optional object to be threaded through parse
 *         calls. Allows clients to add stateful operations to
 *         parsing, such as keeping track of how many levels deep
 *         some nesting is. For an example use-case, see passage-ref
 *         parsing in src/widgets/passage/passage-markdown.jsx
 */
export function createParser(ruleListInput: RuleList, defaultState: Partial<ParserState> = {}) {
	let rules = ruleListInput.toRuleObject();
	let ruleList = Object.keys(rules);

	let latestState: ParserState;

	let nestedParse = function (source: string, state?: ParserState) {
		let result: ASTNode[] = [];
		state = state || latestState;
		latestState = state;

		while (source) {
			// store the best match, it's rule, and quality:
			let ruleType = null;
			let rule = null;
			let capture = null;
			let quality = NaN; // loop control variables:

			let i = 0;
			let currRuleType = ruleList[0];

			let currRule = rules[currRuleType];

			do {
				let currCapture = currRule.match(source, state);

				if (currCapture) {
					let currQuality = currRule.quality ? currRule.quality(currCapture, state) : 0;

					// This should always be true the first time because
					// the initial quality is NaN (that's why there's the
					// condition negation).
					if (!(currQuality <= quality)) {
						ruleType = currRuleType;
						rule = currRule;
						capture = currCapture;
						quality = currQuality;
					}
				}

				// Move on to the next item.
				// Note that this makes `currRule` be the next item
				i++;
				currRuleType = ruleList[i];
				currRule = rules[currRuleType];
			} while (
				// keep looping while we're still within the ruleList
				currRule &&
				// if we don't have a match yet, continue
				(!capture ||
					// or if we have a match, but the next rule is
					// at the same order, and has a quality measurement
					// functions, then this rule must have a quality
					// measurement function (since they are sorted before
					// those without), and we need to check if there is
					// a better quality match
					currRule.quality)
			);

			// TODO(aria): Write tests for these
			if (!rule || !capture || !ruleType) {
				throw new Error(
					'Could not find a matching rule for the below ' +
						'content. The rule with highest `order` should ' +
						'always match content provided to it. Check ' +
						"the definition of `match` for '" +
						ruleList[ruleList.length - 1] +
						"'. It seems to not match the following source:\n" +
						source
				);
			}

			if (capture.index) {
				// If present and non-zero, i.e. a non-^ regexp result:
				throw new Error(
					'`match` must return a capture starting at index 0 ' +
						'(the current parse index). Did you forget a ^ at the ' +
						'start of the RegExp?'
				);
			}

			let parsed = rule.parse(capture, nestedParse, state);

			// We maintain the same object here so that rules can
			// store references to the objects they return and
			// modify them later. (oops sorry! but this adds a lot
			// of power--see reflinks.)

			// We also let rules override the default type of
			// their parsed node if they would like to, so that
			// there can be a single output function for all links,
			// even if there are several rules to parse them.
			if (!parsed.type) {
				parsed.type = ruleType;
			}

			// Collapse text nodes
			if (parsed.type === 'text' && result[result.length - 1]?.type === 'text') {
				result[result.length - 1].content += parsed.content;
			} else {
				result.push(parsed as ASTNode);
			}

			state.prevCapture = capture;
			source = source.substring(state.prevCapture[0].length);
		}

		return result;
	};

	let outerParse = function (source: string, state: ParserState = { inline: false }) {
		latestState = populateInitialState(state, defaultState);

		if (!latestState.inline && !latestState.disableAutoBlockNewlines) {
			source = source + '\n\n';
		}

		// We store the previous capture so that match functions can
		// use some limited amount of lookbehind. Lists use this to
		// ensure they don't match arbitrary '- ' or '* ' in inline
		// text (see the list rule for more information). This stores
		// the full regex capture object, if there is one.
		latestState.prevCapture = undefined;
		return nestedParse(preprocess(source), latestState);
	};

	return outerParse;
}
