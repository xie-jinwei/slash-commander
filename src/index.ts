import {route} from './router/router'
import {getGitHubActionsContext} from './utils/context'
import * as github from '@actions/github'
import * as core from '@actions/core'
import {inspect} from 'util'

function run() {
  try {
    const context = getGitHubActionsContext(github.context.p)
    const handler = route(context)
    handler(context)
  } catch (e) {
    core.debug(inspect(e))
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
