import * as core from '@actions/core'
import * as github from '@actions/github'
import {inspect} from 'util'
import micromatch from 'micromatch'

interface Status {
  context: string
  description: string
  target_url: string
  state: string
  if_include: string[]
  if_not_include: string[]
}

async function run() {
  try {
    const statuses: Status[] = []
    const jsonConfig = core.getInput('config') ?? ''
    const contexts: string[] = core.getMultilineInput('contexts') ?? []
    const description = core.getInput('description') ?? ''
    const target_url = core.getInput('target_url') ?? ''
    const state = core.getInput('state') ?? ''
    const if_include = core.getMultilineInput('if_include') ?? []
    const if_not_include = core.getMultilineInput('if_not_include') ?? []
    for (const context of contexts) {
      const status: Status = {
        context: context,
        description: description,
        target_url: target_url,
        state: state,
        if_include: if_include,
        if_not_include: if_not_include
      }
      statuses.push(status)
    }
    const jsonStatuses = JSON.parse(jsonConfig)
    core.debug(`JSON statuses: ${inspect(jsonStatuses)}`)
    for (const js of jsonStatuses) {
      const status: Status = {
        context: js.context,
        description: js.description ?? description,
        target_url: js.target_url ?? target_url,
        state: js.state ?? state,
        if_include: js.if_include ?? if_include,
        if_not_include: js.if_not_include ?? if_not_include
      }
      statuses.push(status)
    }

    const inputs = {
      token: core.getInput('token', {required: true}),
      owner:
        core.getInput('repo') === ''
          ? github.context.repo.owner
          : core.getInput('repo').split('/')[0],
      repo:
        core.getInput('repo') === ''
          ? github.context.repo.repo
          : core.getInput('repo').split('/')[1],
      number:
        core.getInput('number') === ''
          ? github.context.payload.pull_request
            ? github.context.payload.pull_request.number
            : 1
          : parseInt(core.getInput('number')),
      statuses: statuses
    }
    core.debug(`inputs are ${inspect(inputs)}`)

    const octokit = github.getOctokit(inputs.token)

    const getPullResp = await octokit.rest.pulls.get({
      owner: inputs.owner,
      repo: inputs.repo,
      pull_number: inputs.number
    })
    if (getPullResp.status !== 200) {
      core.error(`failed to get pull: ${getPullResp.status}`)
    }
    core.debug(`get pull result: ${inspect(getPullResp.data)}`)

    let page = 1
    let page_count = 0
    const changedFiles: string[] = []
    if (page_count < 100) {
      const listPullFilesResp = await octokit.rest.pulls.listFiles({
        owner: inputs.owner,
        repo: inputs.repo,
        pull_number: inputs.number,
        per_page: 100,
        page: page
      })
      if (listPullFilesResp.status !== 200) {
        core.error(`failed to list pull files: ${listPullFilesResp.status}`)
      }
      core.debug(`list pull files result: ${inspect(listPullFilesResp.data)}`)
      changedFiles.concat(listPullFilesResp.data.map(f => f.filename))
      page++
      page_count = listPullFilesResp.data.length
    }
    if (changedFiles.length != getPullResp.data.changed_files) {
      core.error(
        `number of changed files is different in get pull response (${getPullResp.data.changed_files}) ` +
          `and list pull file response (${changedFiles.length})` +
          `, there might be another push between the time of the event ` +
          `that triggered this workflow run and now`
      )
    }

    for (const status of inputs.statuses) {
      // automatically grant status if neither of if_include nor if_not_include are specified
      let match =
        status.if_include.length === 0 && status.if_not_include.length === 0
          ? true
          : false
      // if if_include is specified and some of changed files are in this list, grant status
      if (status.if_include.length !== 0) {
        const include_matches = micromatch(changedFiles, status.if_include)
        match = include_matches.length !== 0 ? true : match
        core.debug(
          `status ${status.context} if_include matched ${inspect(
            include_matches
          )}`
        )
      }
      // if if_not_include is specified and none of the changed files are in this list, grant status
      if (status.if_not_include.length !== 0) {
        const not_include_matches = micromatch(
          changedFiles,
          status.if_not_include
        )
        match = not_include_matches.length === 0 ? true : match
        core.debug(
          `status ${status.context}  if_not_include matched ${inspect(
            not_include_matches
          )}`
        )
      }
      if (match) {
        core.info(
          `trying to grante status ${status.context} with state ${status.state}`
        )
        if (
          status.state === 'pending' ||
          status.state === 'success' ||
          status.state === 'failure'
        ) {
          const createCommitStatusResp =
            await octokit.rest.repos.createCommitStatus({
              owner: inputs.owner,
              repo: inputs.repo,
              sha: getPullResp.data.head.sha,
              context: status.context,
              description: status.description,
              target_url: status.target_url,
              state: status.state
            })
          if (createCommitStatusResp.status !== 201) {
            core.error(
              `failed to create commit status: ${createCommitStatusResp.status}`
            )
          }
          core.debug(
            `create commit status result: ${createCommitStatusResp.data}`
          )
        } else {
          core.error(
            `status ${status.context} have wrong state ${status.state}, valid values are 'pending' or 'success' or 'failure'`
          )
        }
      }
    }
  } catch (e) {
    core.debug(inspect(e))
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
