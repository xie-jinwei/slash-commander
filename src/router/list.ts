import {routerEntry} from './router'
import {autoLabel} from '../handler/auto-label'
import {WebhookPayload} from '@actions/github/lib/interfaces'

export const routerList: routerEntry<WebhookPayload>[] = [
  {
    eventName: 'pull_request',
    types: ['opened'],
    branches: null,
    branchIgnores: null,
    tags: null,
    tagIgnores: null,
    paths: null,
    pathIgnores: null,
    handlerEntries: [
      {
        name: 'auto-label',
        handler: autoLabel
      }
    ]
  },
  {}
]
