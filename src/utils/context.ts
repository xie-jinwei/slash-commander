import * as github from '@actions/github'
import * as core from '@actions/core'
import {Config} from '../config/config'
import {Octokit} from '@octokit/core'
import {WebhookPayload} from '@actions/github/lib/interfaces'

export declare const OctokitWithRestAndPaginatePlugin: typeof Octokit &
  import('@octokit/core/dist-types/types').Constructor<
    import('@octokit/plugin-rest-endpoint-methods/dist-types/types').Api & {
      paginate: import('@octokit/plugin-paginate-rest').PaginateInterface
    }
  >

export class Context<T extends WebhookPayload> {
  owner: string
  repo: string
  eventName: string
  action: string | null
  payload: T
  config: Config
  octokit: InstanceType<typeof OctokitWithRestAndPaginatePlugin>
  constructor(
    owner: string,
    repo: string,
    eventName: string,
    action: string | null,
    payload: T,
    config: Config,
    octokit: InstanceType<typeof OctokitWithRestAndPaginatePlugin>
  ) {
    this.owner = owner
    this.repo = repo
    this.eventName = eventName
    this.action = action
    this.payload = payload
    this.config = config
    this.octokit = octokit
  }
  static debug(message: string): void {
    core.debug(message)
  }
  static info(message: string): void {
    core.info(message)
  }
  static warning(message: string): void {
    core.warning(message)
  }
  static error(message: string): void {
    core.error(message)
  }
}

export interface Handler<T extends WebhookPayload> {
  (context: Context<T>): void
}

export function getGitHubActionsContext<T extends WebhookPayload>(
  payload: T
): Context<T> {
  return new Context<T>(
    core.getInput('owner') ?? github.context.repo.owner,
    core.getInput('repo') ?? github.context.repo.repo,
    github.context.eventName ?? '',
    github.context.action,
    payload,
    JSON.parse(core.getInput('config') ?? '') as Config,
    github.getOctokit(core.getInput('token') ?? '')
  )
}
