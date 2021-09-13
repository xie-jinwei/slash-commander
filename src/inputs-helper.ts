import * as core from '@actions/core'
import {inspect} from 'util'
import YAML from 'yaml'

export interface Inputs {
  token: string
  config: string
}

export interface CommandsConfig {
  use_reaction: boolean
  commands: Command[]
}

export interface Command {
  enable: boolean
  name: string
  usage: string
  help: string
  args: number
  issue_type: 'issue' | 'pull_request' | 'both'
  permission: 'none' | 'read' | 'write' | 'admin'
  // if not null, add label to issue using this format
  label_format: string | null
  // if not null, remove label from issue with this format
  unlabel_format: string | null
  // if not null, add assignee to issue using this format
  assignee_format: string | null
  // if not null, remove assignee from issue with this format
  unassignee_format: string | null
  // if not null, request reviewer for issue using this format
  request_reviewer_format: string | null
  // if not null, unrequest reviewer for issue using this format
  unrequest_reviewer_format: string | null
  // if not null, update issue title/body with these formats
  prefix_issue_title_format: string | null
  suffix_issue_title_format: string | null
  remove_issue_title_format: string | null
  replace_issue_title_format: string | null
  prefix_issue_body_format: string | null
  suffix_issue_body_format: string | null
  remove_issue_body_format: string | null
  replace_issue_body_format: string | null
  // if not null, run workflow with this naming format
  workflow_name_format: string | null
}

export function getInputs(): Inputs {
  return {
    token: core.getInput('token', {required: true}),
    config: core.getInput('config', {required: true})
  }
}

export function getCommandsConfig(inputs: Inputs): CommandsConfig {
  const yamlConfig = YAML.parse(inputs.config)
  core.debug(`YAML config: ${inspect(yamlConfig)}`)
  const commandsConfig: CommandsConfig = {
    use_reaction: yamlConfig.use_reaction ?? true,
    commands: []
  }

  for (const jc of yamlConfig.commands) {
    const cmd: Command = {
      enable: jc.enable ?? true,
      name: jc.name ?? '',
      usage: jc.usage ?? '',
      help: jc.help ?? '',
      args: jc.args ?? 0,
      issue_type: jc.issue_type ?? 'issue',
      permission: jc.permission ?? 'read',
      label_format: jc.label_format ?? null,
      unlabel_format: jc.unlabel_format ?? null,
      assignee_format: jc.assignee_format ?? null,
      unassignee_format: jc.unassignee_format ?? null,
      request_reviewer_format: jc.request_reviewer_format ?? null,
      unrequest_reviewer_format: jc.unrequest_reviewer_format ?? null,
      prefix_issue_title_format: jc.prefix_issue_title_format ?? null,
      suffix_issue_title_format: jc.suffix_issue_title_format ?? null,
      remove_issue_title_format: jc.remove_issue_title_format ?? null,
      replace_issue_title_format: jc.replace_issue_title_format ?? null,
      prefix_issue_body_format: jc.prefix_issue_body_format ?? null,
      suffix_issue_body_format: jc.suffix_issue_body_format ?? null,
      remove_issue_body_format: jc.remove_issue_body_format ?? null,
      replace_issue_body_format: jc.replace_issue_body_format ?? null,
      workflow_name_format: jc.workflow_name_format ?? null
    }
    commandsConfig.commands.push(cmd)
  }
  return commandsConfig
}

export function configIsValid(config: CommandsConfig): boolean {
  for (const cmd of config.commands) {
    if (cmd.name === '') {
      core.setFailed(`command name is empty`)
      return false
    }
    if (cmd.usage === null) {
      core.setFailed(`command usage is empty`)
      return false
    }
    if (cmd.help === '') {
      core.setFailed(`command help message is empty`)
      return false
    }
    if (cmd.issue_type === 'issue' && cmd.workflow_name_format !== null) {
      core.setFailed(
        `command enabled on issues but have a workflow dispatch format`
      )
      return false
    }
    if (cmd.issue_type === 'issue' && cmd.request_reviewer_format !== null) {
      core.setFailed(
        `command enabled on issues but have a request reviewer format`
      )
      return false
    }
    if (cmd.issue_type === 'issue' && cmd.unrequest_reviewer_format !== null) {
      core.setFailed(
        `command enabled on issues but have a unrequest reviewer format`
      )
      return false
    }
    if (
      !['none', 'read', 'triage', 'write', 'maintain', 'admin'].includes(
        cmd.permission
      )
    ) {
      core.setFailed(`'${cmd.permission}' is not a valid 'permission'.`)
      return false
    }
    if (!['issue', 'pull_request', 'both'].includes(cmd.issue_type)) {
      core.setFailed(`'${cmd.issue_type}' is not a valid 'issue-type'.`)
      return false
    }
    if (cmd.args > 9) {
      core.setFailed(`The maximum number of arguments is 9`)
      return false
    }
  }
  return true
}
