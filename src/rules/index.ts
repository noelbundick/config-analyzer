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
  request: Array<RequestEvaluationObject>;
};

export type RequestEvaluationObject = {
  operation: string;
  httpMethod: HttpMethods;
  query: string | QueryOption.EXISTS;
};

export enum QueryOption {
  EXISTS = 'exists',
}

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

// returns a resolved promise so that any async calls in the callback are completed before returning
function mapAsync<T1, T2>(
  array: T1[],
  callback: (value: T1, index: number, array: T1[]) => Promise<T2>
): Promise<T2[]> {
  return Promise.all(array.map(callback));
}

// if the array is empty, it returns an empty array
export async function filterAsync<T>(
  array: T[],
  callback: (value: T, index: number, array: T[]) => Promise<boolean>
): Promise<T[]> {
  // creates boolean array and maintains the same index order as the original array
  const mappedArray = await mapAsync(array, callback);
  // filters over the original array based on the mappedArray boolean at each index
  return array.filter((_, index) => mappedArray[index]);
}

export async function everyAsync<T>(
  arr: T[],
  predicate: {(e: T): Promise<boolean>}
) {
  for (const e of arr) {
    if (!(await predicate(e))) return false;
  }
  return true;
}

export type Evaluation = BaseEvaluation | AndEvaluation | RequestEvaluation;
export type Rule = ResourceGraphRule | ARMTemplateRule;
export type Target = ResourceGraphTarget | ARMTarget;

export * from './armTemplate';
export * from './azureResourceGraph';
