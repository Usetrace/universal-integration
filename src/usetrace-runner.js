const fs = require('fs').promises
const axios = require('axios')

const { getContext, createPayloadFromContext, throwError } = require('./utils')

/**
 * Class that allows to invoke endpoints from the Usetrace API to trigger Traces and get the results
 */
class UsetraceRunner {
  /**
   * @param {} config Allow to change the behavior of the integration
   * @param {} triggerType Indicates if it should trigger a 'project' or a 'trace'
   */
  constructor(config, triggerType) {
    this.config = {
      envUrl: 'https://api.usetrace.com',
      buildTimeoutSeconds: 3600,
      failOnFailedTraces: true,
      pollIntervalMs: 5000,
      triggerType,
      ...config,
    }

    this.context = getContext()

    if (this.config.triggerType === 'project') {
      // User attempts to trigger a Project
      if (!this.context.projectId) throwError("No 'projectId' parameter was provided")
      this.context.triggerId = this.context.projectId
    } else {
      // User attempts to trigger a Trace
      if (!this.context.traceId) throwError("No 'traceId' parameter was provided")
      this.context.triggerId = this.context.traceId
    }

    const endpointPath =
      this.config.triggerType === 'project'
        ? `/api/project/${this.context.triggerId}/execute-all`
        : `/api/trace/${this.context.triggerId}/execute`
    this.context.triggerEndpoint = `${this.config.envUrl}${endpointPath}`
    this.context.headers = this.context.usetraceApiKey
      ? { headers: { Authorization: `Bearer ${this.context.usetraceApiKey}` } }
      : {}

    this.output = {}
  }

  async run() {
    try {
      const result = await this.runUsetrace()
      await this.processResult(result)
    } catch (error) {
      throwError(error.message)
    }
  }

  async runUsetrace() {
    const payload = createPayloadFromContext(this.context)
    const response = await axios.post(
      this.context.triggerEndpoint,
      payload,
      this.context.headers
    )

    if (response.status !== 200 || !response.data) {
      throw new Error('No build ID returned from execute command')
    }

    console.log('Build triggered. Waiting for it to finish...')
    this.context.buildId = response.data
    return this.waitForBuildToFinish()
  }

  waitForBuildToFinish() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const timeoutMs = this.config.buildTimeoutSeconds * 1000

      const checkStatus = async () => {
        try {
          const status = await this.checkBuildStatus()
          if (status.status === 'FINISHED') {
            resolve(status)
          } else {
            console.log('Waiting... Current status:', status.status)
            scheduleNextCheck()
          }
        } catch (error) {
          reject(error)
        }
      }

      const scheduleNextCheck = () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(
            new Error(`Polling timed out after ${this.config.buildTimeoutSeconds} seconds`)
          )
        } else {
          setTimeout(checkStatus, this.config.pollIntervalMs)
        }
      }

      checkStatus()
    })
  }

  async checkBuildStatus() {
    const response = await axios.get(
      `${this.config.envUrl}/api/build/${this.context.buildId}/status`,
      this.context.headers
    )

    // Store the last status as current output
    this.output = this.generateFlatSummary(response.data)

    if (response.status === 200 && response.data.status === 'FINISHED') {
      const results = await axios.get(
        `${this.config.envUrl}/api/build/${this.context.buildId}/results/json`,
        this.context.headers
      )
      console.log('Build finished with this result:', results.data)
      // Add the report to the output
      this.output.report = results.data
    }

    return response.data
  }

  async processResult(result) {
    await this.saveOutput()

    if (this.config.failOnFailedTraces && result.summary?.fail > 0) {
      throw new Error(`${result.summary.fail} Traces failed out of ${result.summary.request}`)
    }
  }

  generateFlatSummary(result) {
    const { summary, ...properties } = result
    return {
      ...properties,
      ...summary,
    }
  }

  async saveOutput() {
    console.log('Output: ', this.output)
    await fs.writeFile('../output.json', JSON.stringify(this.output, null, 2))
  }
}

module.exports = { UsetraceRunner }
