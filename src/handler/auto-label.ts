import {
  PullRequestOpenedEvent,
  PullRequestEditedEvent,
  PullRequestSynchronizeEvent
} from '@octokit/webhooks-types/schema'
import {Context} from '../utils/context'

export function autoLabel(
  context: Context<
    | PullRequestOpenedEvent
    | PullRequestEditedEvent
    | PullRequestSynchronizeEvent
  >
): void {
  context.config.label
}
