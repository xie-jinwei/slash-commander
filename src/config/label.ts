export interface LabelConfig {
  Unconditional: UnconditionalLabelConfig
  FileChange: FileChangeLabelConfig
  BodySlashCommand: BodySlashCommandLabelConfig
  BodyCheckList: BodyCheckListLabelConfig
}

export interface UnconditionalLabelConfig {
  labels: string[]
}

export interface FileChangeLabelConfig {
  configs: {
    label: string
    paths: string[]
    pathIgnores: string[]
  }[]
}

export interface BodySlashCommandLabelConfig {
  labelPrefix: string
  listRegExp: string
  itemRegExp: string
  labelRegExp: string
}

export interface BodyCheckListLabelConfig {
  labelPrefix: string
  listRegExp: string
  itemRegExp: string
  labelRegExp: string
}
