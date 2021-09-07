import {Context} from './context'
import {PullRequestEvent, PushEvent} from '@octokit/webhooks-types/schema'
import {Match} from './match'

export function ListPushFiles(context: Context<PushEvent>): string[] {
  if (context.eventName === 'push') {
    const commits = context.payload.commits
    const filesAdded: string[] = []
    const filesRemoved: string[] = []
    const filesModified: string[] = []
    for (const commit of commits) {
      filesAdded.concat(commit.added)
      filesRemoved.concat(commit.removed)
      filesModified.concat(commit.modified)
    }
    return filesAdded.concat(filesRemoved, filesModified)
  } else {
    throw new Error(`event name is ${context.eventName} not "push"`)
  }
}

export async function ListPRFiles(
  context: Context<PullRequestEvent>
): Promise<string[]> {
  if (context.eventName === 'pull_request') {
    let listFileError: Error | null = null
    const files = await context.octokit.paginate(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner: context.owner,
        repo: context.repo,
        pull_number: context.payload.number
      },
      (response, done) => {
        if (response.status !== 200) {
          listFileError = new Error(
            `failed to list files in pull ${context.payload.number}: ${response.status}`
          )
          done()
        }
        return response.data.map(file => file.filename)
      }
    )
    if (listFileError) {
      throw listFileError
    }
    return files
  } else {
    throw new Error(`event name is ${context.eventName}, not "pull_request"`)
  }
}

export async function CheckPushOrPullFileMatch(
  context: Context<PushEvent | PullRequestEvent>,
  patterns: string[] | null,
  ignorePatterns: string[] | null
): Promise<{
  matched: boolean
  matches: string[]
}> {
  if (context.eventName === 'push' || context.eventName === 'pull_request') {
    const files =
      context.eventName === 'push'
        ? ListPushFiles(context as Context<PushEvent>)
        : await ListPRFiles(context as Context<PullRequestEvent>)
    const match = Match(files, patterns, ignorePatterns)
    return match
  } else {
    throw new Error(`event name is neither "push" nor "pull_request"`)
  }
}
