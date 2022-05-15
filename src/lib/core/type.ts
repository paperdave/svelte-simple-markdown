/* eslint-disable @typescript-eslint/no-explicit-any */

type Multiple<T> = T | T[];
type Nullable<T> = T | null | undefined;

export type MatchFunction = (source: string, state: ParserState) => Nullable<RegExpMatchArray>;

export type Parser = (source: string, state?: ParserState) => ASTNode[];

export type ParseFunction = (
	source: RegExpMatchArray,
	nestedParse: Parser,
	state: ParserState
) => TypeOptionalASTNode;

export type QualityFunction = (capture: RegExpMatchArray, state: ParserState) => number;

export interface ParserState {
	inline: boolean;
	prevCapture?: RegExpMatchArray;
	[key: string]: any;
}

export interface ParserRule {
	name: string;
	match: MatchFunction;
	parse: ParseFunction;
	quality?: QualityFunction;
	svelte?: Svelte2TsxComponent;
}

export interface ASTNode {
	type: string;
	content?: ASTNode[] | string;
	[key: string]: any;
}

export type TypeOptionalASTNode = Omit<ASTNode, 'type'> & { type?: string };

export type Rules = Record<string, ParserRule>;

export interface RefNode {
	type: string;
	content?: Multiple<ASTNode>;
	target?: string;
	title?: string;
	alt?: string;
}
