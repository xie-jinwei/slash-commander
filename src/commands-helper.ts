import * as core from '@actions/core'

// Tokenise command and arguments
// Support escaped quotes within quotes. https://stackoverflow.com/a/5696141/11934042
const TOKENISE_REGEX =
  /\S+="[^"\\]*(?:\\.[^"\\]*)*"|"[^"\\]*(?:\\.[^"\\]*)*"|\S+/g
// const NAMED_ARG_REGEX = /^(?<name>[a-zA-Z0-9_-]+)=(?<value>.+)$/

export function actorHasPermission(
  actorPermission: string,
  commandPermission: string
): boolean {
  const permissionLevels = Object.freeze({
    none: 1,
    read: 2,
    triage: 3,
    write: 4,
    maintain: 5,
    admin: 6
  })
  core.debug(`Actor permission level: ${permissionLevels[actorPermission]}`)
  core.debug(`Command permission level: ${permissionLevels[commandPermission]}`)
  return (
    permissionLevels[actorPermission] >= permissionLevels[commandPermission]
  )
}

export function tokeniseCommand(command: string): string[] {
  let matches
  const output: string[] = []
  while ((matches = TOKENISE_REGEX.exec(command))) {
    output.push(matches[0])
  }
  return output
}

export function formatWithArguments(format: string, args: string[]): string {
  for (let index = 0; index < args.length; index++) {
    var regexp = new RegExp(`/\\$${index + 1}/g`)
    format = format.replace(regexp, args[index])
  }
  return format
}
