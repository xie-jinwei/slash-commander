import * as github from '@actions/github'
import * as core from '@actions/core'
import {inspect} from 'util'
import {
  Command,
  CommandsConfig,
  configIsValid,
  getCommandsConfig,
  getInputs,
  Inputs
} from './inputs-helper'
import {formatWithArguments, tokeniseCommand} from './commands-helper'
import {GitHubHelper, IssueData, Repository} from './github-helper'
import {WorkflowRunCompletedEvent} from '@octokit/webhooks-types/schema'

async function run() {
  try {
    const inputs: Inputs = getInputs()
    if (!inputs.token) {
      throw new Error(`Missing required input 'token'`)
    }
    if (!inputs.config) {
      throw new Error(`Missing required input 'config'`)
    }
    const commandsConfig: CommandsConfig = getCommandsConfig(inputs)
    core.debug(`Commands config: ${inspect(commandsConfig)}`)
    const isValid: boolean = configIsValid(commandsConfig)
    if (!isValid) {
      return
    }
    const eventName = github.context.eventName
    const action = github.context.payload.action
    switch (eventName) {
      case 'issue_comment':
        await handleIssueComment(inputs.token, commandsConfig)
        break
      case 'workflow_run':
        if (action !== 'completed') {
          core.setFailed(
            `This action cannot be triggered on workflow_run event with action except 'completed'`
          )
          return
        }
        await handleWorkflowRun(inputs.token)
        break
      default:
        core.error(`Unsupported event name: ${eventName}`)
    }
  } catch (e) {
    core.debug(inspect(e))
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

async function handleWorkflowRun(token: string): Promise<void> {
  const repo: Repository = github.context.repo
  const workflowRunPayload = github.context.payload as WorkflowRunCompletedEvent
  const workflowRunId: number = workflowRunPayload.workflow_run.id
  const workflowName: string = workflowRunPayload.workflow.name
  const sha: string = workflowRunPayload.workflow_run.head_sha
  const helper: GitHubHelper = new GitHubHelper(token)
  const combinedStatus = await helper.getCombinedCommitStatus(repo, sha)
  const statuses = combinedStatus.statuses.filter(
    s => s.context === workflowName
  )
  if (statuses.length === 0) {
    core.info(
      `Cannot find status with context ${workflowName} on SHA ${sha} (head SHA for workflow run ${workflowRunId})`
    )
    return
  }
  if (statuses.length > 1) {
    core.setFailed(
      `Found more than 1 (actually ${statuses.length}) with context ${workflowName} on SHA ${sha} (head SHA for workflow run ${workflowRunId})`
    )
    return
  }
  const status = statuses[0]
  const state =
    workflowRunPayload.workflow_run.conclusion === 'success'
      ? 'success'
      : 'failure'
  let description = ''
  switch (workflowRunPayload.workflow_run.conclusion) {
    case 'success':
      description = 'Workflow run have finished successfully'
      break
    case 'failure':
      description = 'Workflow run have finished with failure'
      break
    case 'cancelled':
      description = 'Workflow run have been canceled'
      break
    case 'timed_out':
      description = 'Workflow run have timed out'
      break
    case 'stale':
      description = 'Workflow run is stale'
      break
    case 'action_required':
      description = 'Workflow run have completed with action required'
      break
    default:
      description = `Workflow run have completed with unrecognized conclusion ${workflowRunPayload.workflow_run.conclusion}`
  }
  await helper.createCommitStatus(
    repo,
    sha,
    workflowName,
    state,
    description,
    status.target_url
  )
  const statusDescRegExp =
    /Workflow run was triggered by slash command in comment (\d+)/
  const matches = status.description.match(statusDescRegExp)
  if (matches === null || matches.length < 2) {
    core.info(
      `Cannot match status description for comment id, will skip updating comment`
    )
    return
  }
  const commentIdStr: string = matches[1]
  core.info(
    `Extracted comment ID string ${commentIdStr} from status description ${status.description}`
  )
  const commentId: number = parseInt(commentIdStr)
  const commentData = await helper.getComment(repo, commentId)
  await helper.suffixComment(
    repo,
    commentId,
    commentData.body,
    `>Workflow run completed: run id = ${workflowRunId}, conclusion = ${workflowRunPayload.workflow_run.conclusion}`
  )
}

async function handleIssueComment(
  token: string,
  commandsConfig: CommandsConfig
): Promise<void> {
  const repo: Repository = github.context.repo
  const issueNumber: number = github.context.payload.issue.number
  let commentBody: string = github.context.payload.comment.body
  const commentId: number = github.context.payload.comment.id
  const isPullRequest = 'pull_request' in github.context.payload.issue
  const helper: GitHubHelper = new GitHubHelper(token)
  core.debug(`Repository: ${inspect(repo)}`)
  core.debug(`Issue number: ${issueNumber}`)
  core.debug(`Comment body: ${commentBody}`)
  core.debug(`Comment id: ${commentId}`)
  core.debug(`Is pull request: ${isPullRequest}`)

  const firstLine: string = commentBody.split(/\r?\n/)[0].trim()
  if (firstLine.length < 2 || firstLine.charAt(0) != '/') {
    core.info(`The first line of the comment is not a valid slash command`)
    return
  }

  const commandTokens: string[] = tokeniseCommand(firstLine.slice(1))
  core.debug(`Command tokens: ${inspect(commandTokens)}`)

  // handle /help commands specially
  if (commandTokens[0] === 'help') {
    let helpMessage = '\n> Command | Description\n> --- | ---\n>/help | Show this help message in comment\n'
    const commandMatches = commandsConfig.commands.filter(function (
      cmd: Command
    ) {
      return (
        cmd.issue_type == 'both' ||
        (cmd.issue_type == 'issue' && !isPullRequest) ||
        (cmd.issue_type == 'pull_request' && isPullRequest)
      )
    })
    for (const cmd of commandMatches) {
      helpMessage = helpMessage + `> /${cmd.name} ${cmd.usage} | ${cmd.help}\n`
    }
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      helpMessage
    )
    return
  }

  // Check if the command is registered for dispatch
  let commandMatches = commandsConfig.commands.filter(function (cmd: Command) {
    return cmd.enable && cmd.name === commandTokens[0]
  })
  core.debug(
    `Command matches on 'enable' and 'name': ${inspect(commandMatches)}`
  )
  if (commandMatches.length === 0) {
    core.info(`Command '${commandTokens[0]}' is not registered for dispatch`)
    return
  }

  // Filter matching commands by issue type
  commandMatches = commandMatches.filter(function (cmd: Command) {
    return (
      cmd.issue_type == 'both' ||
      (cmd.issue_type == 'issue' && !isPullRequest) ||
      (cmd.issue_type == 'pull_request' && isPullRequest)
    )
  })
  core.debug(`Command matches on 'issue_type': ${inspect(commandMatches)}`)
  if (commandMatches.length === 0) {
    const issueType = isPullRequest ? 'pull request' : 'issue'
    core.info(
      `Command ${commandTokens[0]} is not configured for the issue type ${issueType}`
    )
    return
  }

  // Filter matching commands by whether or not to allow edits
  // if (github.context.payload.action === 'edited') {
  //   commandMatches = commandMatches.filter(function (cmd: Command) {
  //     return cmd.allow_edits
  //   })
  //   core.debug(`Command matches on 'allow_edits': ${inspect(commandMatches)}`)
  //   if (commandMatches.length === 0) {
  //     core.info(`Command ${commandTokens[0]} is not configured to allow edits`)
  //     return
  //   }
  // }

  // At this point we know the command is correctly registerd, add the "eyes" reaction to the comment
  if (commandsConfig.use_reaction) {
    await helper.addReaction(repo, commentId, 'eyes')
  }

  // Filter matching commands by actor's permission level
  const actorPermission = await helper.getPermission(repo, github.context.actor)
  core.debug(`Actor ${github.context.actor} permission: ${actorPermission}`)
  commandMatches = commandMatches.filter(function (cmd) {
    return helper.containPermission(actorPermission, cmd.permission)
  })
  core.debug(`Commands matches on 'permission': ${inspect(commandMatches)}`)
  if (commandMatches.length === 0) {
    core.info(
      `Command ${commandTokens[0]} is not configured for the user permission level ${actorPermission}`
    )
    return
  }

  // Assert there is only 1 commands matched in the end
  if (commandMatches.length > 1) {
    throw new Error(
      `More than 1 commands matched, maybe the configuration is wrong`
    )
  }
  const cmd: Command = commandMatches[0]
  const args: string[] = commandTokens.slice(1)

  // Check number of arguments
  if (commandTokens.length - 1 !== cmd.args) {
    throw new Error(
      `Required number of argument for command ${cmd.name} is ${
        cmd.args
      }, found ${commandTokens.length - 1}`
    )
  }

  if (cmd.label_format) {
    const label = formatWithArguments(cmd.label_format, args)
    await helper.addLabel(repo, issueNumber, label)
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      `>github-actions(bot): added label ${label}`
    )
  }

  if (cmd.unlabel_format) {
    const label = formatWithArguments(cmd.unlabel_format, args)
    await helper.removeLabel(repo, issueNumber, label)
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      `>github-actions(bot): removed label ${label}`
    )
  }

  if (cmd.assignee_format) {
    const assignee = formatWithArguments(cmd.assignee_format, args)
    await helper.addAssignee(repo, issueNumber, assignee)
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      `>github-actions(bot): added assignee ${assignee}`
    )
  }

  if (cmd.unassignee_format) {
    const assignee = formatWithArguments(cmd.unassignee_format, args)
    await helper.removeAssignee(repo, issueNumber, assignee)
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      `>github-actions(bot): removed assignee ${assignee}`
    )
  }

  if (cmd.request_reviewer_format) {
    const reviewer = formatWithArguments(cmd.request_reviewer_format, args)
    await helper.addReviewer(repo, issueNumber, reviewer)
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      `>github-actions(bot): added reviewer ${reviewer}`
    )
  }

  if (cmd.unrequest_reviewer_format) {
    const reviewer = formatWithArguments(cmd.unrequest_reviewer_format, args)
    await helper.removeReviewer(repo, issueNumber, reviewer)
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      `>github-actions(bot): removed reviewer ${reviewer}`
    )
  }

  if (
    cmd.prefix_issue_title_format ||
    cmd.suffix_issue_title_format ||
    cmd.remove_issue_title_format ||
    cmd.replace_issue_title_format ||
    cmd.prefix_issue_body_format ||
    cmd.suffix_issue_body_format ||
    cmd.remove_issue_body_format ||
    cmd.replace_issue_body_format
  ) {
    const issue: IssueData = await helper.getIssue(repo, issueNumber)
    const numberOfTitleUpdates = [
      cmd.prefix_issue_title_format,
      cmd.suffix_issue_title_format,
      cmd.remove_issue_title_format,
      cmd.replace_issue_title_format
    ].filter(v => v).length
    const numberOfBodyUpdates = [
      cmd.prefix_issue_body_format,
      cmd.suffix_issue_body_format,
      cmd.remove_issue_body_format,
      cmd.replace_issue_title_format
    ].filter(v => v).length
    if (numberOfTitleUpdates > 1) {
      core.setFailed(
        `configured more than 1 issue title updates in command ${cmd.name}`
      )
      return
    }
    if (numberOfBodyUpdates > 1) {
      core.setFailed(
        `configured more than 1 issue body updates in command ${cmd.name}`
      )
      return
    }
    let title = issue.title
    if (cmd.prefix_issue_title_format) {
      title =
        formatWithArguments(cmd.prefix_issue_title_format, args) + ' ' + title
    }
    if (cmd.suffix_issue_title_format) {
      title =
        title + ' ' + formatWithArguments(cmd.suffix_issue_title_format, args)
    }
    if (cmd.remove_issue_title_format) {
      title = title.replace(
        formatWithArguments(cmd.remove_issue_title_format, args),
        ''
      )
    }
    if (cmd.replace_issue_title_format) {
      title = formatWithArguments(cmd.replace_issue_title_format, args)
    }
    let body = issue.body
    if (cmd.prefix_issue_body_format) {
      body =
        formatWithArguments(cmd.prefix_issue_body_format, args) + '\n' + body
    }
    if (cmd.suffix_issue_body_format) {
      body =
        body + '\n' + formatWithArguments(cmd.suffix_issue_body_format, args)
    }
    if (cmd.remove_issue_body_format) {
      body = body.replace(
        formatWithArguments(cmd.remove_issue_body_format, args),
        ''
      )
    }
    if (cmd.replace_issue_body_format) {
      body = formatWithArguments(cmd.replace_issue_body_format, args)
    }
    title = title.trim()
    body = body.trim()
    await helper.updateIssue(repo, issueNumber, title, body)
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      `>github-actions(bot): updated issue ${issueNumber}`
    )
  }

  if (cmd.workflow_name_format) {
    const pullData = await helper.getPull(repo, issueNumber)
    const ref: string = pullData.head.ref
    const workflowName = formatWithArguments(cmd.workflow_name_format, args)
    const triggerDate = Date.now()
    await helper.createWorkflowDispatch(repo, workflowName, ref)
    const workflowRunId = await helper.getWorkflowRunId(
      repo,
      workflowName,
      'workflow_dispatch',
      triggerDate
    )
    const workflowRun = await helper.getWorkflowRun(repo, workflowRunId)
    commentBody = await helper.suffixComment(
      repo,
      commentId,
      commentBody,
      `>Workflow run started: name = ${workflowName}, ref = ${ref}\n>View workflow run at: ${workflowRun.html_url}`
    )
    await helper.createCommitStatus(
      repo,
      pullData.head.sha,
      workflowName,
      'pending',
      `Workflow run was triggered by slash command in comment ${commentId}`,
      workflowRun.html_url
    )
  }
}

run()
