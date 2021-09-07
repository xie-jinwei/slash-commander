import * as core from '@actions/core'
import * as github from '@actions/github'
import {inspect} from 'util'
import micromatch from 'micromatch'

interface Label {
  name: string
  if_include: string[]
  if_not_include: string[]
}

async function run() {
  try {
    const labels: Label[] = []
    const name = core.getInput('name') ?? ''
    const if_include = core.getMultilineInput('if_include') ?? []
    const if_not_include = core.getMultilineInput('if_not_include') ?? []
    labels.push({
      name: name,
      if_include: if_include,
      if_not_include: if_not_include
    })
    const jsonConfig = core.getInput('config') ?? []
    const jsonLabels = JSON.parse(jsonConfig)
    core.debug(`JSON Labels: ${inspect(jsonLabels)}`)
    for (const jl of jsonLabels) {
      if (!jl.name || jl.name === '') {
        core.error('empty label name')
      }
      const label: Label = {
        name: jl.name,
        if_include: jl.if_include ?? if_include,
        if_not_include: jl.if_not_include ?? if_not_include
      }
      labels.push(label)
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
      labels: labels
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

    const addLabels: string[] = []
    for (const label of inputs.labels) {
      // automatically grant label if neither of if_include nor if_not_include are specified
      let match =
        label.if_include.length === 0 && label.if_not_include.length === 0
          ? true
          : false
      // if if_include is specified and some of changed files are in this list, grant status
      if (label.if_include.length !== 0) {
        const include_matches = micromatch(changedFiles, label.if_include)
        match = include_matches.length !== 0 ? true : match
        core.debug(
          `label ${label.name} if_include matched ${inspect(include_matches)}`
        )
      }
      // if if_not_include is specified and none of the changed files are in this list, grant status
      if (label.if_not_include.length !== 0) {
        const not_include_matches = micromatch(
          changedFiles,
          label.if_not_include
        )
        match = not_include_matches.length === 0 ? true : match
        core.debug(
          `label ${label.name}  if_not_include matched ${inspect(
            not_include_matches
          )}`
        )
      }
      if (match) {
        addLabels.push(label.name)
      }
    }
    core.info(`trying to add labels ${inspect(addLabels)}`)
    const addLabelsResp = await octokit.rest.issues.addLabels({
      owner: inputs.owner,
      repo: inputs.repo,
      issue_number: inputs.number,
      labels: addLabels
    })
    if (addLabelsResp.status !== 200) {
      core.error(`failed to add labels: ${addLabelsResp.status}`)
    }
    core.debug(`add labels result: ${addLabelsResp.data}`)
  } catch (e) {
    core.debug(inspect(e))
    if (e instanceof Error) {
      core.setFailed(e.message)
    }
  }
}

run()
