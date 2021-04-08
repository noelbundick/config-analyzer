import {ScanResult} from '../scanner';
import {ARMTarget, ARMTemplateRule} from './armTemplate';
import {ResourceGraphRule, ResourceGraphTarget} from './azureResourceGraph';

export enum RuleType {
  ResourceGraph = 'ResourceGraph',
  ARM = 'ARM',
}

export interface BaseRule<T> {
  name: string;
  description: string;
  type: RuleType;
  execute?: (target: T) => Promise<ScanResult>;
}

export type Rule = ResourceGraphRule | ARMTemplateRule;
export type Target = ResourceGraphTarget | ARMTarget;

export * from './armTemplate';
export * from './azureResourceGraph';
