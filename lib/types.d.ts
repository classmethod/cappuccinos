export interface AwsConfig {
  aws_profile?: string;
  account_id: string;
  region: string;
}

export interface ProjectConfig {
  name: string;
  functions: FunctionsConfig;
  layers: LayersConfig[];
  shared: SharedConfig[];
  apis: ApiConfig[];
  websockets?: string[];
  state_machines: string[];
}

export interface FunctionsConfig {
  paths: string[];
  build: string[];
  rebuild: string[];
  files: IFile[];
  configuration: LambdaConfig;
}

export interface LambdaConfig {
  description?: string;
  runtime: string;
  timeout: number;
  role: string;
  handler: string;
  memory: number;
  environment: { [key: string]: string; };
  layers: string[];
  permissions?: LambdaPermission[];
  log_retention_in_days?: 1 | 3 | 5 | 7 | 14 | 30 | 60 | 90 | 120 | 150 | 180 | 365 | 400 | 545 | 731 | 1827 | 3653;
  subscription_filter?: SubscriptionFilter;
}

export interface LambdaPermission {
  statement_id: string;
  action: string;
  principal: string;
  source_arn?: string;
  source_account?: string;
}

export interface SubscriptionFilter {
  name: string;
  pattern: string;
  destination_arn: string;
}

export interface SharedConfig {
  name: string;
  build: string[];
  rebuild: string[];
  files: IFile[];
}

export interface ApiConfig {
  name: string;
  environment?: { [key: string]: string; };
}

export interface LayersConfig {
  name: string;
  runtimes: string[];
  build: string[];
  files: IFile[];
}

export interface IFile {
  base_dir: string;
  source: string;
  destination: string;
}

export interface StateMachineConfig {
  role: string;
}