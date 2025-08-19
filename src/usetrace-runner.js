const fs = require('fs').promises
const axios = require('axios')

const {
  getContextFromEnvVars,
  createPayloadFromContext,
  throwError,
  castContextParametersType,
} = require('./utils')

/**
 * Class that allows to invoke endpoints from the Usetrace API to trigger Traces and get the results
 */
class UsetraceRunner {
  /**
   * @param {} context Allow to change the behavior of the integration
   */
  constructor(context) {
    // Context precedence order is: command line arguments, environment variables (INPUT_*), defaults
    const parametersFromEnv = getContextFromEnvVars()

    this.context = castContextParametersType({
      // Default values
      envUrl: 'https://api.usetrace.com',
      buildTimeoutSeconds: 3600,
      failOnFailedTraces: true,
      pollIntervalMs: 5000,
      browsers: 'chrome',
      waitForResult: true,
      // Parameters loaded form env vars
      ...parametersFromEnv,
      // Parameters passed by command line (highest precedence)
      ...context,
    })

    if (this.context.projectId && !this.context.traceId) {
      // User attempts to trigger a Project
      this.context.triggerType = 'project'
      this.context.triggerId = this.context.projectId
    } else if (!this.context.projectId && this.context.traceId) {
      // User attempts to trigger a single Trace
      this.context.triggerType = 'trace'
      this.context.triggerId = this.context.traceId
    } else {
      // User provided wrong configuration
      throwError("A 'projectId' or a 'traceId' are required")
    }

    const endpointPath =
      this.context.triggerType === 'project'
        ? `/api/project/${this.context.triggerId}/execute-all`
        : `/api/trace/${this.context.triggerId}/execute`

    // Build the endpoint URL with API key as query parameter if provided
    const baseEndpoint = `${this.context.envUrl}${endpointPath}`
    this.context.triggerEndpoint = this.context.usetraceApiKey
      ? `${baseEndpoint}?key=${this.context.usetraceApiKey}`
      : baseEndpoint

    // No special headers needed for Usetrace API
    this.context.headers = {}

    console.log('########## this.context: ', this.context)
    this.output = {}
  }

  async run() {
    try {
      const result = await this.runUsetrace()
      await this.processResult(result)
    } catch (error) {
      throwError(error)
    }
  }

  async runUsetrace() {
    const payload = createPayloadFromContext(this.context)
    console.log('########## payload: ', payload)
    const response = await axios.post(this.context.triggerEndpoint, payload)

    if (response.status !== 200 || !response.data) {
      throw new Error('No build ID returned from execute command')
    }

    this.context.buildId = response.data

    if (this.context.waitForResult) {
      console.log('Build triggered. Waiting for it to finish...')
      return this.waitForBuildToFinish()
    } else {
      console.log('Build triggered. Not waiting for results as waitForResult is set to false.')
      return {
        id: response.data,
        status: 'TRIGGERED',
        summary: {
          request: 0,
          finish: 0,
          pass: 0,
          fail: 0,
        },
      }
    }
  }

  waitForBuildToFinish() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const timeoutMs = this.context.buildTimeoutSeconds * 1000

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
            new Error(`Polling timed out after ${this.context.buildTimeoutSeconds} seconds`)
          )
        } else {
          setTimeout(checkStatus, this.context.pollIntervalMs)
        }
      }

      checkStatus()
    })
  }

  async checkBuildStatus() {
    const statusUrl = this.context.usetraceApiKey
      ? `${this.context.envUrl}/api/build/${this.context.buildId}/status?key=${this.context.usetraceApiKey}`
      : `${this.context.envUrl}/api/build/${this.context.buildId}/status`

    const response = await axios.get(statusUrl)

    // Store the last status as current output
    this.output = this.generateFlatSummary(response.data)

    if (response.status === 200 && response.data.status === 'FINISHED') {
      const resultsUrl = this.context.usetraceApiKey
        ? `${this.context.envUrl}/api/build/${this.context.buildId}/results/json?key=${this.context.usetraceApiKey}`
        : `${this.context.envUrl}/api/build/${this.context.buildId}/results/json`

      const results = await axios.get(resultsUrl)
      console.log('Build finished with this result:', results.data)
      // Add the report to the output
      this.output.report = results.data
    }

    return response.data
  }

  async processResult(result) {
    await this.saveOutput()
    console.log('this.context.failOnFailedTraces', this.context.failOnFailedTraces)
    console.log('this.context', this.context)

    // Only check for failed traces if we waited for results
    if (
      this.context.waitForResult &&
      this.context.failOnFailedTraces &&
      result.summary?.fail > 0
    ) {
      throw new Error(
        `The execution failed because ${result.summary?.fail} Traces failed out of ${result.summary?.request}. If you don't want the execution to fail when a Trace fails, you can set 'failOnFailedTraces' to false.`
      )
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
