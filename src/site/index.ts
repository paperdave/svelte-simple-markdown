import {
	defaultRules,
	createParser,
	blockRegex,
	parseCaptureInline,
	parseInline,
	inlineRegex
} from '$lib/core';
import type { MarkdownConfig } from '$lib/svelte/types';
import MentionArtifact from './MentionArtifact.svelte';
import MentionQuestionSvelte from './MentionQuestion.svelte';
import QuestionParagraph from './QuestionPara.svelte';

const customRules = defaultRules.clone();

customRules.insertBefore('paragraph', {
	name: 'question',
	match: blockRegex(/^q: ((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
	parse: parseCaptureInline
});

customRules.insertBefore('question', {
	name: 'escape-question',
	match: blockRegex(/^\\q: ((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
	parse(capture, parse, state) {
		return {
			type: 'paragraph',
			content: [
				{
					type: 'text',
					content: 'q: '
				},
				...parseInline(parse, capture[1], state)
			]
		};
	}
});

customRules.insertBefore('em', {
	name: 'mentionArtifact',
	match: inlineRegex(/^@([-a-z0-9]+)/),
	parse(capture) {
		return {
			id: capture[1]
		};
	}
});

customRules.insertBefore('em', {
	name: 'mentionQuestion',
	match: inlineRegex(/^#([0-9]{12})/),
	parse(capture) {
		return {
			id: capture[1]
		};
	}
});

const parser = createParser(customRules);

export const davecodeQAMarkdown: MarkdownConfig = {
	parser,
	renderers: {
		question: QuestionParagraph,
		mentionQuestion: MentionQuestionSvelte,
		mentionArtifact: MentionArtifact
	}
};
