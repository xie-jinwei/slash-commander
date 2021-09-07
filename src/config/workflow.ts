export interface WorkflowConfig {
  commands: [WorkflowCommandConfig]
}

export interface WorkflowCommandConfig {
  enable: boolean
  name: string
  workflow_name: string
  use_comment_pr_latest_sha: boolean
  use_predefined_ref: boolean
  predefined_ref: string
}
