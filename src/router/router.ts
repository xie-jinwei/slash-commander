import {WebhookPayload} from '@actions/github/lib/interfaces'
import {inspect} from 'util'
import {Context, Handler} from '../utils/context'
import {CheckPushOrPullFileMatch} from '../utils/files'
import {Match} from '../utils/match'
import {routerList} from './list'

export type routerEntry<T extends WebhookPayload> = {eventName: string} & {
  types: string[] | null
} & {
  branches: string[] | null
  branchIgnores: string[] | null
  tags: string[] | null
  tagIgnores: string[] | null
  paths: string[] | null
  pathIgnores: string[] | null
} & {handlerEntries: HandlerEntry<T>[]}

interface handlerMatchResult<T extends WebhookPayload> {
  handlerEntry: HandlerEntry<T>
  eventName: string
  typeMatched: string | null
  mustMatchTypes: boolean
  typesToMatch: string[] | null
  mustMatchBranch: boolean
  branchMatched: string | null
  branchesToMatchIsIgnore: boolean | null
  branchesToMatch: string[] | null
  mustMatchTag: boolean
  tagMatched: string | null
  tagsToMatchIsIgnore: boolean | null
  tagsToMatch: string[] | null
  mustMatchPath: boolean
  pathsMatched: string[] | null
  pathsToMatchIsIgnore: boolean | null
  pathsToMatch: string[] | null
}

interface HandlerEntry<T extends WebhookPayload> {
  name: string
  handler: Handler<T>
}

export async function route<T extends WebhookPayload>(
  context: Context<T>
): Promise<handlerMatchResult<T>[]> {
  const handlerMatchResults: handlerMatchResult<T>[] = []
  for (const routerEntry of routerList) {
    let eventNameMatch = false
    let typeMatch = false
    let branchMatch = false
    let tagMatch = false
    let pathMatch = false
    if (routerEntry.eventName === context.eventName) {
      eventNameMatch = true
    }
    if (routerEntry.types && !context.action) {
      throw new Error(
        `event have action ${
          context.action
        }, but types to match is not empty (${inspect(routerEntry.types)})`
      )
    } else if (
      !routerEntry.types ||
      (context.action && routerEntry.types.indexOf(context.action) !== -1)
    ) {
      typeMatch = true
    }
    if (
      routerEntry.eventName === 'push' ||
      routerEntry.eventName === 'pull_request'
    ) {
      const branch: string | null =
        routerEntry.eventName === 'push'
          ? (context.payload.ref as string).replace('refs/heads/', '')
          : context.payload?.pull_request?.head.ref
      const tag: string | null =
        routerEntry.eventName === 'push'
          ? (context.payload.ref as string).replace('refs/tags/', '')
          : null
      const sha: string | null =
        routerEntry.eventName === 'push'
          ? context.payload.after
          : context.payload?.pull_request?.sha
      if ((!branch && !tag) || !sha) {
        throw new Error(`branch/tag and sha cannot both be null`)
      }
      const branchMatchResult = Match(
        branch ? [branch] : null,
        routerEntry.branches,
        routerEntry.branchIgnores
      )
      branchMatch = branchMatchResult.matched
      const tagMatchResult = Match(
        tag ? [tag] : null,
        routerEntry.tags,
        routerEntry.tagIgnores
      )
      tagMatch = tagMatchResult.matched
      const fileMatchResult = await CheckPushOrPullFileMatch(
        context,
        routerEntry.paths,
        routerEntry.pathIgnores
      )
      pathMatch = fileMatchResult.matched
      if (eventNameMatch && tagMatch && branchMatch && tagMatch && pathMatch) {
        handlerMatchResults.concat(
          routerEntry.handlerEntries.map(handlerEntry => {
            const mustMatchBranch: boolean =
              (routerEntry.branchIgnores !== null &&
                routerEntry.branchIgnores?.length !== 0) ||
              (routerEntry.branches !== null &&
                routerEntry.branches?.length !== 0)
            const branchesToMatchIsIgnore =
              routerEntry.branchIgnores !== null &&
              routerEntry.branchIgnores.length !== 0
            const branchesToMatch = mustMatchBranch
              ? branchesToMatchIsIgnore
                ? routerEntry.branchIgnores
                : routerEntry.branches
              : null
            const mustMatchTag =
              (routerEntry.tagIgnores !== null &&
                routerEntry.tagIgnores?.length !== 0) ||
              (routerEntry.tags !== null && routerEntry.tags?.length !== 0)
            const tagsToMatchIsIgnore =
              routerEntry.tagIgnores !== null &&
              routerEntry.tagIgnores?.length !== 0
            const tagsToMatch = mustMatchTag
              ? tagsToMatchIsIgnore
                ? routerEntry.tagIgnores
                : routerEntry.tags
              : null
            const mustMatchPath =
              (routerEntry.pathIgnores !== null &&
                routerEntry.pathIgnores?.length !== 0) ||
              (routerEntry.paths !== null && routerEntry.paths?.length !== 0)
            const pathsToMatchIsIgnore =
              routerEntry.pathIgnores !== null &&
              routerEntry.pathIgnores?.length !== 0
            const pathsToMatch = mustMatchPath
              ? pathsToMatchIsIgnore
                ? routerEntry.pathIgnores
                : routerEntry.paths
              : null
            return {
              handlerEntry: handlerEntry,
              eventName: context.eventName,
              typeMatched: context.action,
              mustMatchTypes: routerEntry.types
                ? routerEntry.types.length !== 0
                : false,
              typesToMatch: routerEntry.types,
              branchMatched: branch,
              mustMatchBranch: mustMatchBranch,
              branchesToMatchIsIgnore: branchesToMatchIsIgnore,
              branchesToMatch: branchesToMatch,
              tagMatched: tag,
              mustMatchTag: mustMatchTag,
              tagsToMatchIsIgnore: tagsToMatchIsIgnore,
              tagsToMatch: tagsToMatch,
              pathsMatched: fileMatchResult.matches,
              mustMatchPath: mustMatchPath,
              pathsToMatchIsIgnore: pathsToMatchIsIgnore,
              pathsToMatch: pathsToMatch
            }
          })
        )
      }
    } else if (
      routerEntry.branches !== null ||
      routerEntry.branchIgnores !== null ||
      routerEntry.tags !== null ||
      routerEntry.tagIgnores !== null ||
      routerEntry.paths !== null ||
      routerEntry.pathIgnores !== null
    ) {
      throw new Error(
        `event name is ${routerEntry.eventName}, but branch/tag/path matches are only for "push" and "pull_request" event`
      )
    } else if (eventNameMatch && typeMatch) {
      handlerMatchResults.concat(
        routerEntry.handlerEntries.map(handlerEntry => {
          return {
            handlerEntry: handlerEntry,
            eventName: context.eventName,
            typeMatched: context.action,
            mustMatchTypes: routerEntry.types
              ? routerEntry.types.length !== 0
              : false,
            typesToMatch: routerEntry.types,
            branchMatched: null,
            mustMatchBranch: false,
            branchesToMatchIsIgnore: null,
            branchesToMatch: null,
            tagMatched: null,
            mustMatchTag: false,
            tagsToMatchIsIgnore: null,
            tagsToMatch: null,
            pathsMatched: null,
            mustMatchPath: false,
            pathsToMatchIsIgnore: null,
            pathsToMatch: null
          }
        })
      )
    }
  }
  for (const handlerMatchResult of handlerMatchResults) {
    Context.info(`
      Handler ${handlerMatchResult.handlerEntry.name} matched: 
        event name matched = ${handlerMatchResult.eventName}, 
        type matched = ${handlerMatchResult.typeMatched},
        must match type = ${handlerMatchResult.mustMatchTypes},
        types to match = ${handlerMatchResult.typesToMatch},
        branch matched = ${handlerMatchResult.branchMatched},
        must match branched = ${handlerMatchResult.mustMatchBranch},
        branches to match pattern is ignore = ${handlerMatchResult.branchesToMatchIsIgnore},
        branches to match = ${handlerMatchResult.branchesToMatch},
        tag matched = ${handlerMatchResult.tagMatched},
        must match tag = ${handlerMatchResult.mustMatchTag},
        tags to match pattern is ignore = ${handlerMatchResult.pathsToMatchIsIgnore},
        tags to match = ${handlerMatchResult.tagsToMatch},
        paths matched = ${handlerMatchResult.pathsMatched},
        must match paths = ${handlerMatchResult.mustMatchPath},
        paths to match is ignore = ${handlerMatchResult.pathsToMatchIsIgnore},
        paths to match = ${handlerMatchResult.pathsToMatch}
      `)
  }
  return handlerMatchResults
}
