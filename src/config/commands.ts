export interface CommandsConfig {
  enable: boolean
  use_reaction: boolean
  help_command: SlashCommandConfig
  hold_command: SlashCommandConfig
  unhold_command: SlashCommandConfig
  label_command: SlashCommandConfig
  unlabel_command: SlashCommandConfig
  cc_command: SlashCommandConfig
  uncc_command: SlashCommandConfig
  assign_command: SlashCommandConfig
  unassign_command: SlashCommandConfig
  kind_command: SlashCommandConfig
  secure_command: SlashCommandConfig
}

export interface SlashCommandConfig {
  enable: boolean
  rename: string
  max_args: number
  permission: 'read' | 'write' | 'none'
  issue_type: 'issue' | 'pull_request'
  status_args: string[]
}
