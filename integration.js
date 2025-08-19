const { UsetraceRunner } = require('./src/usetrace-runner')
const { Command } = require('commander')

const program = new Command()

program
  // Needed parameters
  .option('--traceId <id>', 'Trace ID for triggering a trace')
  .option('--projectId <id>', 'Project ID for triggering a project')
  // Optional parameters
  .option(
    '--browsers <list>',
    'Comma-separated list of browsers. Ex: "chrome,firefox" (default: chrome)'
  )
  .option('--baseUrl <url>', 'Base URL to execute against (default: Project base URL)')
  .option('--parameters <json>', 'JSON formatted string of trace parameters')
  .option('--usetraceApiKey <key>', 'Usetrace API Key for authentication')
  .option('--webhookUrl <url>', 'URL of the POST callback to send the result')
  .option('--webhookWhen <when>', "When to trigger webhook: 'always', 'fails', 'changes'")
  .option('--webhookSecretkey <key>', 'Webhook HMAC secret key')
  .option('--webhookUsername <username>', 'Username for webhook basic auth')
  .option('--webhookPassword <password>', 'Password for webhook basic auth')
  .option('--tags <tags>', 'Comma-separated list of tags')
  .option('--commit <commit>', 'Commit hash for the build')
  .option('--commitLink <link>', 'Link to the commit')
  // Configuration
  .option('--buildTimeoutSeconds <seconds>', 'Maximum time to wait for the build')
  .option('--failOnFailedTraces', 'Fail workflow if any traces fail')
  .option('--pollIntervalMs <ms>', 'Polling interval in milliseconds')
  .option(
    '--waitForResult',
    'Wait for the trace to finish before completing (default: true). Set to false to trigger and exit immediately.'
  )

// Parse command-line arguments
program.parse(process.argv)

const options = program.opts()

async function main() {
  const context = {
    // Needed parameters:
    traceId: options.traceId,
    projectId: options.projectId,

    // Optional parameters:
    browsers: options.browsers ? options.browsers : undefined, // If its an empty string
    baseUrl: options.baseUrl,
    parameters: options.parameters,
    usetraceApiKey: options.usetraceApiKey,
    // Reporter Webhook invoke:
    webhookUrl: options.webhookUrl,
    webhookWhen: options.webhookWhen,
    webhookSecretkey: options.webhookSecretkey,
    webhookUsername: options.webhookUsername,
    webhookPassword: options.webhookPassword,
    tags: options.tags ? options.tags : undefined,
    commit: options.commit,
    commitLink: options.commitLink,
    // Configuration:
    buildTimeoutSeconds: options.buildTimeoutSeconds
      ? parseInt(options.buildTimeoutSeconds)
      : undefined,
    // Workflow Control:
    failOnFailedTraces: options.failOnFailedTraces ? options.failOnFailedTraces : undefined,
    pollIntervalMs: options.pollIntervalMs ? parseInt(options.pollIntervalMs) : undefined,
    waitForResult: options.waitForResult !== undefined ? options.waitForResult : undefined,
  }

  // Remove undefined values
  Object.keys(context).forEach((key) => context[key] === undefined && delete context[key])

  const runner = new UsetraceRunner(context)
  await runner.run()
}

main().catch(console.error)
