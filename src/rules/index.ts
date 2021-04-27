import {ScanResult} from '../scanner';
import {ARMTarget, ARMTemplateRule} from './armTemplate';
import {ResourceGraphRule, ResourceGraphTarget} from './azureResourceGraph';

// needed for sendRequest method
// from @azure/core-http => https://azuresdkdocs.blob.core.windows.net/$web/javascript/azure-core-http/1.2.4/globals.html#httpmethods
export enum HttpMethods {
  POST = 'POST',
  GET = 'GET',
}

export enum RuleType {
  ResourceGraph = 'ResourceGraph',
  ARM = 'ARM',
}

export interface BaseRule<T> {
  name: string;
  description: string;
  type: RuleType;
  evaluation: Evaluation;
  recommendation: string;
  execute?: (target: T) => Promise<ScanResult>;
}

// All evaluations contain a JMESPath query that operate on ARM resources
type BaseEvaluation = {
  query: string;
};

// Some evaluations may check for additional conditions
type AndEvaluation = BaseEvaluation & {
  and: Array<Evaluation>;
};

export type RequestEvaluation = BaseEvaluation & {
  request: {
    operation: string;
    query: string;
  };
};

export function isAndEvaluation(
  evaluation: Evaluation
): evaluation is AndEvaluation {
  return (evaluation as AndEvaluation).and !== undefined;
}

export function isRequestEvaluation(
  evaluation: Evaluation
): evaluation is RequestEvaluation {
  return (evaluation as RequestEvaluation).request !== undefined;
}

export type Evaluation = BaseEvaluation | AndEvaluation | RequestEvaluation;
export type Rule = ResourceGraphRule | ARMTemplateRule;
export type Target = ResourceGraphTarget | ARMTarget;

export * from './armTemplate';
export * from './azureResourceGraph';
