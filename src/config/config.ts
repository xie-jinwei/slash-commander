import {AssigneeConfig} from './assignee'
import {CommandsConfig} from './commands'
import {LabelConfig} from './label'
import {ReviewerConfig} from './reviewer'
import {StatusConfig} from './status'
import {WorkflowConfig} from './workflow'

export interface Config {
  label: LabelConfig
  assignee: AssigneeConfig
  reviewer: ReviewerConfig
  status: StatusConfig
  commands: CommandsConfig
  workflow: WorkflowConfig
}
