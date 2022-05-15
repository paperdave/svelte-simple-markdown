import type { ParserRule } from './type';

export class RuleList extends Array<ParserRule> {
	constructor(input?: ArrayLike<ParserRule>) {
		super();
		if (input) {
			this.push(...Array.from(input));
		}
	}

	insertBefore(rule: string, newRule: ParserRule): void {
		const index = this.findIndex((r) => r.name === rule);
		if (index === -1) {
			throw new Error(`Rule ${rule} not found`);
		}
		this.splice(index, 0, newRule);
	}

	insertAfter(rule: string, newRule: ParserRule): void {
		const index = this.findIndex((r) => r.name === rule);
		if (index === -1) {
			throw new Error(`Rule ${rule} not found`);
		}
		this.splice(index + 1, 0, newRule);
	}

	toRuleObject(): Record<string, ParserRule> {
		const result: Record<string, ParserRule> = {};
		this.forEach((rule) => {
			result[rule.name] = rule;
		});
		return result;
	}

	add(rule: ParserRule): void {
		this.push(rule);
	}

	get(rule: string): ParserRule | undefined {
		return this.find((r) => r.name === rule);
	}

	remove(rule: string): void {
		const index = this.findIndex((r) => r.name === rule);
		if (index === -1) {
			throw new Error(`Rule ${rule} not found`);
		}
		this.splice(index, 1);
	}

	clone() {
		return new RuleList(this);
	}
}
