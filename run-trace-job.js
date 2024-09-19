const { UsetraceRunner } = require('./src/usetrace-runner')

async function main() {
  console.log('RUN TRACE JOB')
  const config = {
    envUrl: process.env.USETRACE_API_URL || 'https://api.usetrace.com',
    buildTimeoutSeconds: parseInt(process.env.INPUT_BUILD_TIMEOUT_SECONDS) || 3600,
    failOnFailedTraces: process.env.INPUT_FAIL_ON_FAILED_TRACES?.toLowerCase() === 'true',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS) || 5000,
  }

  const runner = new UsetraceRunner(config, 'trace')
  await runner.run()
}

main().catch(console.error)
