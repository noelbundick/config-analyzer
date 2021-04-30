import {Scanner} from '../src/scanner';
import {Rule} from '../src/rules';

let rules: Rule[];
export async function getTestRules() {
  if (rules) return rules;
  const scanner = new Scanner();
  return await scanner.getRulesFromFile('./test/rules.json');
}
