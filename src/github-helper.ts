import {Octokit} from '@octokit/core'
import * as github from '@actions/github'
import * as core from '@actions/core'
import {inspect} from 'util'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import { isTimeout, sleep } from './utils'

export declare const GitHub: typeof Octokit &
  import('@octokit/core/dist-types/types').Constructor<
    import('@octokit/plugin-rest-endpoint-methods/dist-types/types').Api & {
      paginate: import('@octokit/plugin-paginate-rest').PaginateInterface
    }
  >

export interface Repository {
  owner: string
  repo: string
}

export type PullData =
  RestEndpointMethodTypes['pulls']['get']['response']['data']

export type IssueData =
  RestEndpointMethodTypes['issues']['get']['response']['data']

export type CommentData =
  RestEndpointMethodTypes['issues']['getComment']['response']['data']

export type WorkflowRunData =
  RestEndpointMethodTypes['actions']['getWorkflowRun']['response']['data']

export type CombinedStatusData =
  RestEndpointMethodTypes['repos']['getCombinedStatusForRef']['response']['data']

export type WorkflowData = 
  RestEndpointMethodTypes['actions']['listRepoWorkflows']['response']['data']['workflows'][number]

export type ListWorkflowData = 
  RestEndpointMethodTypes['actions']['listRepoWorkflows']['response']['data']

export class GitHubHelper {
  private octokit: InstanceType<typeof GitHub>

  constructor(token: string) {
    this.octokit = github.getOctokit(token)
  }

  async addReaction(
    repo: Repository,
    commentId: number,
    reaction:
      | '+1'
      | '-1'
      | 'laugh'
      | 'confused'
      | 'heart'
      | 'hooray'
      | 'rocket'
      | 'eyes'
  ): Promise<void> {
    try {
      await this.octokit.rest.reactions.createForIssueComment({
        ...repo,
        comment_id: commentId,
        content: reaction
      })
    } catch (error) {
      core.debug(error)
      core.warning(`Failed to set reaction on comment ID ${commentId}.`)
      throw error
    }
  }

  async getPermission(repo: Repository, username: string): Promise<string> {
    try {
      const resp = await this.octokit.rest.repos.getCollaboratorPermissionLevel(
        {
          ...repo,
          username: username
        }
      )
      core.debug(
        `Response for getting permission of user ${username}: ${inspect(resp)}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for getting permission of user ${username}: ${resp.status}`
        )
      }
      return resp.data.permission
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for getting permission of user ${username}`)
      throw error
    }
  }

  async havePermission(
    repo: Repository,
    username: string,
    permissionRequired: string
  ): Promise<boolean> {
    const permission: string = await this.getPermission(repo, username)
    return this.containPermission(permission, permissionRequired)
  }

  containPermission(
    userPermission: string,
    requiredPermission: string
  ): boolean {
    if (userPermission === '') {
      throw new Error(`user permission is empty`)
    }
    if (requiredPermission === '') {
      throw new Error(`required permission is empty`)
    }
    const permissionLevels = Object.freeze({
      none: 1,
      read: 2,
      write: 3,
      admin: 4
    })
    core.debug(
      `User permission: ${userPermission} (${permissionLevels[userPermission]})`
    )
    core.debug(
      `Required permission: ${requiredPermission} (${permissionLevels[requiredPermission]})`
    )
    return (
      permissionLevels[userPermission] >= permissionLevels[requiredPermission]
    )
  }

  async addLabel(
    repo: Repository,
    issueNumber: number,
    label: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.issues.addLabels({
        ...repo,
        issue_number: issueNumber,
        labels: [label]
      })
      core.debug(
        `Response for adding label ${label} on issue ${issueNumber}: ${inspect(resp)}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for adding ${label} label on issue ${issueNumber}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for adding ${label} label on issue ${issueNumber}`)
      throw error
    }
  }

  async removeLabel(
    repo: Repository,
    issueNumber: number,
    label: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.issues.removeLabel({
        ...repo,
        issue_number: issueNumber,
        name: label
      })
      core.debug(
        `Response for removing ${label} label on issue ${issueNumber}: ${inspect(resp)}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for removing ${label} label on issue ${issueNumber}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for removing ${label} label on issue ${issueNumber}`)
      throw error
    }
  }

  async addAssignee(
    repo: Repository,
    issueNumber: number,
    assignee: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.issues.addAssignees({
        ...repo,
        issue_number: issueNumber,
        assignees: [assignee]
      })
      core.debug(
        `Response for adding assignee on issue ${issueNumber}: ${inspect(resp)}`
      )
      if (resp.status !== 201) {
        throw new Error(
          `Response status for adding assignee on issue ${issueNumber}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for adding assignee on issue ${issueNumber}`)
      throw error
    }
  }

  async removeAssignee(
    repo: Repository,
    issueNumber: number,
    assignee: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.issues.removeAssignees({
        ...repo,
        issue_number: issueNumber,
        assignees: [assignee]
      })
      core.debug(
        `Response for removing assignee on issue ${issueNumber}: ${inspect(
          resp
        )}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for removing assignee on issue ${issueNumber}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for removing assignee on issue ${issueNumber}`)
      throw error
    }
  }

  async addReviewer(
    repo: Repository,
    issueNumber: number,
    reviewer: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.pulls.requestReviewers({
        ...repo,
        pull_number: issueNumber,
        reviewers: [reviewer]
      })
      core.debug(
        `Response for adding reviewer on pull request ${issueNumber}: ${inspect(
          resp
        )}`
      )
      if (resp.status !== 201) {
        throw new Error(
          `Response status for adding reviewer on pull request ${issueNumber}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for adding reviewer on pull request ${issueNumber}`)
      throw error
    }
  }

  async removeReviewer(
    repo: Repository,
    issueNumber: number,
    reviewer: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.pulls.removeRequestedReviewers({
        ...repo,
        pull_number: issueNumber,
        reviewers: [reviewer]
      })
      core.debug(
        `Response for removing reviewer on pull request ${issueNumber}: ${inspect(
          resp
        )}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for removing reviewer on pull request ${issueNumber}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(
        `Failed for removing reviewer on pull request ${issueNumber}`
      )
      throw error
    }
  }

  async getIssue(repo: Repository, issueNumber: number): Promise<IssueData> {
    try {
      const resp = await this.octokit.rest.issues.get({
        ...repo,
        issue_number: issueNumber
      })
      core.debug(`Response for getting issue ${issueNumber}: ${inspect(resp)}`)
      if (resp.status !== 200) {
        throw new Error(
          `Response status for getting issue ${issueNumber}: ${resp.status}`
        )
      }
      return resp.data
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for getting issue ${issueNumber}`)
      throw error
    }
  }

  async getPull(repo: Repository, issueNumber: number): Promise<PullData> {
    try {
      const resp = await this.octokit.rest.pulls.get({
        ...repo,
        pull_number: issueNumber
      })
      core.debug(
        `Response for getting pull request ${issueNumber}: ${inspect(resp)}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for getting pull request ${issueNumber}: ${resp.status}`
        )
      }
      return resp.data
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for getting pull request ${issueNumber}`)
      throw error
    }
  }

  async updateIssue(
    repo: Repository,
    issueNumber: number,
    title: string,
    body: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.issues.update({
        ...repo,
        issue_number: issueNumber,
        title: title,
        body: body
      })
      core.debug(
        `Response for updating issue ${issueNumber}: ${inspect(resp)}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for updating issue ${issueNumber}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for updating issue ${issueNumber}`)
      throw error
    }
  }

  async getComment(repo: Repository, commentId: number): Promise<CommentData> {
    try {
      const resp = await this.octokit.rest.issues.getComment({
        ...repo,
        comment_id: commentId
      })
      core.debug(`Response for getting comment ${commentId}: ${inspect(resp)}`)
      if (resp.status !== 200) {
        throw new Error(
          `Response status for getting comment ${commentId}: ${resp.status}`
        )
      }
      return resp.data
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for getting comment ${commentId}`)
      throw error
    }
  }

  async suffixComment(
    repo: Repository,
    commentId: number,
    oldBody: string,
    suffix: string
  ): Promise<string> {
    const newBody = oldBody + '\n' + suffix
    await this.updateComment(repo, commentId, newBody)
    return newBody
  }

  async updateComment(
    repo: Repository,
    commentId: number,
    body: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.issues.updateComment({
        ...repo,
        comment_id: commentId,
        body: body
      })
      core.debug(`Response for updating comment ${commentId}: ${inspect(resp)}`)
      if (resp.status !== 200) {
        throw new Error(
          `Response status for updating comment ${commentId}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for updating comment ${commentId}`)
      throw error
    }
  }

  async createWorkflowDispatch(
    repo: Repository,
    workflowId: number,
    ref: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.actions.createWorkflowDispatch({
        ...repo,
        workflow_id: workflowId,
        ref: ref
      })
      core.debug(
        `Response for creating workflow dispatch ${workflowId} on ref ${ref}: ${inspect(
          resp
        )}`
      )
      if (resp.status !== 204) {
        throw new Error(
          `Response status for creating workflow dispatch ${workflowId} on ref ${ref}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(
        `Failed for creating workflow dispatch ${workflowId} on ref ${ref}`
      )
      throw error
    }
  }

  async getWorkflowWithName(
    repo: Repository,
    name: string
  ): Promise<WorkflowData> {
    const workflowList = await this.getWorkflows(repo)
    const workflowsFiltered = workflowList.workflows.filter(w => w.name === name)
    if (workflowsFiltered.length === 0) {
      throw new Error(`Cannot find any workflows with name '${name}'`)
    }
    if (workflowsFiltered.length > 1) {
      throw new Error(`Found more than 1 (actually ${workflowsFiltered.length}) workflows with name '${name}'`)
    }
    return workflowsFiltered[0]
  }

  async getWorkflows(
    repo: Repository
  ): Promise<ListWorkflowData> {
    try {
      const resp = await this.octokit.rest.actions.listRepoWorkflows({
        ...repo,
      })
      core.debug(`Response for listing workflows: ${inspect(resp)}`)
      if (resp.status !== 200) {
        throw new Error(
          `Response status for listing workflows: ${resp.status}`
        )
      }
      return resp.data
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for listing workflows`)
      throw error
    }
  }

  async waitUntilWorkflowRunAfterTimeFound(
    repo: Repository,
    workflowId: number,
    event: string,
    createdAt: number,
    interval: number,
    timeout: number
  ): Promise<WorkflowRunData> {
    const start = Date.now()
    let run: WorkflowRunData
    do {
      core.debug(`sleep ${interval} seconds before next workflow run search`)
      await sleep(interval)
      try {
        run = await this.getWorkflowRunAfterTime(repo, workflowId, event, createdAt)
      } catch (error) {}
    } while (!run && !isTimeout(start, timeout))
    return run
  }

  async getWorkflowRunAfterTime(
    repo: Repository,
    workflowId: number,
    event: string,
    createdAt: number
  ): Promise<WorkflowRunData> {
    try {
      core.debug('Get workflow run id')
      const resp = await this.octokit.rest.actions.listWorkflowRuns({
        ...repo,
        workflow_id: workflowId,
        event: event
      })
      core.debug(
        `Response for listing workflow run of workflow ${workflowId} event ${event}: ${inspect(
          resp
        )}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for listing workflow run of workflow ${workflowId} event ${event}: ${resp.status}`
        )
      }

      const runs = resp.data.workflow_runs.filter(
        run => new Date(run.created_at).valueOf() >= createdAt
      )
      core.debug(
        `Filtered workflow runs (after create time ${new Date(
          createdAt
        ).toISOString()}): ${runs.map(run => ({
          id: run.id,
          name: run.name,
          created_at: run.created_at
        }))}`
      )

      if (runs.length == 0) {
        throw new Error('No workflow run found')
      }

      return runs[0]
    } catch (error) {
      core.debug(error)
      core.warning(
        `Failed for getting workflow run of workflow ${workflowId} event ${event} after ${new Date(
          createdAt
        ).toISOString()}`
      )
      throw error
    }
  }

  async getWorkflowRunWithId(
    repo: Repository,
    runId: number
  ): Promise<WorkflowRunData> {
    try {
      const resp = await this.octokit.rest.actions.getWorkflowRun({
        ...repo,
        run_id: runId
      })
      core.debug(`Response for getting workflow run ${runId}: ${inspect(resp)}`)
      if (resp.status !== 200) {
        throw new Error(
          `Response status for workflow run ${runId}: ${resp.status}`
        )
      }
      return resp.data
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for workflow run ${runId}`)
      throw error
    }
  }

  async createCommitStatus(
    repo: Repository,
    sha: string,
    name: string,
    state: 'error' | 'failure' | 'pending' | 'success',
    description: string,
    target_url: string
  ): Promise<void> {
    try {
      const resp = await this.octokit.rest.repos.createCommitStatus({
        ...repo,
        sha: sha,
        context: name,
        state: state,
        description: description,
        target_url: target_url
      })
      core.debug(
        `Response for updating commit status ${name} on SHA ${sha}: ${inspect(
          resp
        )}`
      )
      if (resp.status !== 201) {
        throw new Error(
          `Response status for updating commit status ${name} on SHA ${sha}: ${resp.status}`
        )
      }
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for updating commit status ${name} on SHA ${sha}`)
      throw error
    }
  }

  async getCombinedCommitStatus(
    repo: Repository,
    ref: string
  ): Promise<CombinedStatusData> {
    try {
      const resp = await this.octokit.rest.repos.getCombinedStatusForRef({
        ...repo,
        ref: ref
      })
      core.debug(
        `Response for listing commit statuses on ref ${ref}: ${inspect(resp)}`
      )
      if (resp.status !== 200) {
        throw new Error(
          `Response status for listing commit statuses on ref ${ref}: ${resp.status}`
        )
      }
      return resp.data
    } catch (error) {
      core.debug(error)
      core.warning(`Failed for listing commit statuses on ref ${ref}`)
      throw error
    }
  }
}
