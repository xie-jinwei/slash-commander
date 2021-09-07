import {WebhookPayload} from '@actions/github/lib/interfaces'
import {Context} from '../utils/context'

export interface HandlerEntry<T extends WebhookPayload> {
  name: string
  handler: (context: Context<T>) => void
}
