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
    'Comma-separated list of browsers. Ex: "chrome,firefox" (default: chrome)',
    'chrome'
  )
  .option('--baseUrl <url>', 'Base URL to execute against (default: Project base URL)')
  .option('--parameters <json>', 'JSON formatted string of trace parameters')
  .option('--usetraceApiKey <key>', 'Usetrace API Key for authentication')
  .option('--webhookUrl <url>', 'URL of the POST callback to send the result')
  .option(
    '--webhookWhen <when>',
    "When to trigger webhook: 'always', 'fails', 'changes'",
    'always'
  )
  .option('--webhookSecretkey <key>', 'Webhook HMAC secret key')
  .option('--webhookUsername <username>', 'Username for webhook basic auth')
  .option('--webhookPassword <password>', 'Password for webhook basic auth')
  .option('--tags <tags>', 'Comma-separated list of tags')
  .option('--commit <commit>', 'Commit hash for the build')
  .option('--commitLink <link>', 'Link to the commit')
  // Configuration
  .option('--buildTimeoutSeconds <seconds>', 'Maximum time to wait for the build', '3600')
  .option('--failOnFailedTraces', 'Fail workflow if any traces fail', true)
  .option('--pollIntervalMs <ms>', 'Polling interval in milliseconds', '5000')

// Parse command-line arguments
program.parse(process.argv)

const options = program.opts()

// Validate required parameters
if (!options.traceId && !options.projectId) {
  console.error('Either --traceId or --projectId must be provided.')
  process.exit(1)
}

async function main() {
  const context = {
    // Needed parameters
    traceId: options.traceId,
    projectId: options.projectId,

    // Optional parameters
    browsers: options.browsers ? options.browsers : 'chrome', // If its an empty string
    baseUrl: options.baseUrl,
    parameters: options.parameters,
    usetraceApiKey: options.usetraceApiKey,
    // Reporter Webhook invoke
    webhookUrl: options.webhookUrl,
    webhookWhen: options.webhookWhen,
    webhookSecretkey: options.webhookSecretkey,
    webhookUsername: options.webhookUsername,
    webhookPassword: options.webhookPassword,
    tags: options.tags ? options.tags : undefined,
    commit: options.commit,
    commitLink: options.commitLink,
    // Configuration
    buildTimeoutSeconds: parseInt(options.buildTimeoutSeconds),
    // Workflow Control:
    failOnFailedTraces: options.failOnFailedTraces === 'true',
    pollIntervalMs: parseInt(options.pollIntervalMs),
  }

  const runner = new UsetraceRunner(context)
  await runner.run()
}

main() //.catch(console.error)
