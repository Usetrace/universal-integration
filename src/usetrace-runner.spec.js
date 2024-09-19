const { UsetraceRunner } = require('./usetrace-runner')
const axios = require('axios')
const fs = require('fs').promises

const utils = require('./utils')

jest.mock('axios')
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
  },
}))
jest.mock('./utils')

describe('UsetraceRunner', () => {
  let usetraceRunner

  beforeEach(() => {
    jest.clearAllMocks()

    // Set up environment variables
    process.env.INPUT_TRACE_ID = 'trace123'
    process.env.INPUT_PROJECT_ID = 'project123'
    process.env.INPUT_BUILD_TIMEOUT_SECONDS = '120'
    process.env.INPUT_FAIL_ON_FAILED_TRACES = 'true'
    process.env.INPUT_BROWSERS = 'chrome'
    process.env.INPUT_BASE_URL = 'https://example.com'
    process.env.INPUT_PARAMETERS = '{"key": "value"}'
    process.env.INPUT_TAGS = 'tag1,tag2'
    process.env.INPUT_COMMIT = 'abc123'
    process.env.INPUT_COMMIT_LINK = 'https://github.com/repo/commit/abc123'
    process.env.INPUT_USETRACE_API_KEY = 'api-key-123'
    process.env.INPUT_WEBHOOK_URL = 'https://webhook.example.com'
    process.env.INPUT_WEBHOOK_WHEN = 'always'
    process.env.INPUT_WEBHOOK_SECRETKEY = 'secret123'
    process.env.INPUT_WEBHOOK_USERNAME = 'username'
    process.env.INPUT_WEBHOOK_PASSWORD = 'password'
    process.env.USETRACE_API_URL = 'https://api.usetrace.com'
    process.env.POLL_INTERVAL_MS = '5000'

    // Mock getContext to return a context object
    utils.getContext.mockReturnValue({
      traceId: 'trace123',
      projectId: 'project123',
      buildTimeoutSeconds: '120',
      failOnFailedTraces: 'true',
      browsers: 'chrome',
      baseUrl: 'https://example.com',
      parameters: '{"key": "value"}',
      tags: 'tag1,tag2',
      commit: 'abc123',
      commitLink: 'https://github.com/repo/commit/abc123',
      usetraceApiKey: 'api-key-123',
      webhookUrl: 'https://webhook.example.com',
      webhookWhen: 'always',
      webhookSecretKey: 'secret123',
      webhookUsername: 'username',
      webhookPassword: 'password',
    })

    // Mock createPayloadFromContext to return a payload object
    utils.createPayloadFromContext.mockReturnValue({
      requiredCapabilities: [{ browserName: 'chrome' }],
      baseUrl: 'https://example.com',
      parameters: { key: 'value' },
      tags: ['tag1', 'tag2'],
      commit: 'abc123',
      commitLink: 'https://github.com/repo/commit/abc123',
      reporters: [
        {
          webhook: {
            url: 'https://webhook.example.com',
            when: 'always',
            secretKey: 'secret123',
            username: 'username',
            password: 'password',
          },
        },
      ],
    })

    // Mock throwError to avoid process.exit
    utils.throwError.mockImplementation((errorMessage) => {
      throw new Error(errorMessage)
    })
  })

  afterEach(() => {
    // Clear environment variables after each test
    Object.keys(process.env).forEach((key) => {
      if (
        key.startsWith('INPUT_') ||
        key === 'USETRACE_API_URL' ||
        key === 'POLL_INTERVAL_MS'
      ) {
        delete process.env[key]
      }
    })
  })

  describe('constructor', () => {
    it('should initialize with correct config and project trigger type', () => {
      const config = {
        envUrl: process.env.USETRACE_API_URL,
        buildTimeoutSeconds: parseInt(process.env.INPUT_BUILD_TIMEOUT_SECONDS),
        failOnFailedTraces: process.env.INPUT_FAIL_ON_FAILED_TRACES?.toLowerCase() === 'true',
        pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS),
      }
      usetraceRunner = new UsetraceRunner(config, 'project')

      expect(usetraceRunner.config).toEqual({
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: true,
        pollIntervalMs: 5000,
        triggerType: 'project',
      })
      expect(usetraceRunner.context.triggerId).toBe('project123')
    })

    it('should use default values when environment variables are not set', () => {
      delete process.env.USETRACE_API_URL
      delete process.env.INPUT_BUILD_TIMEOUT_SECONDS
      delete process.env.INPUT_FAIL_ON_FAILED_TRACES
      delete process.env.POLL_INTERVAL_MS

      const config = {
        envUrl: process.env.USETRACE_API_URL || 'https://api.usetrace.com',
        buildTimeoutSeconds: parseInt(process.env.INPUT_BUILD_TIMEOUT_SECONDS) || 3600,
        failOnFailedTraces: process.env.INPUT_FAIL_ON_FAILED_TRACES?.toLowerCase() === 'true',
        pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS) || 5000,
      }
      usetraceRunner = new UsetraceRunner(config, 'project')

      expect(usetraceRunner.config).toEqual({
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 3600,
        failOnFailedTraces: false,
        pollIntervalMs: 5000,
        triggerType: 'project',
      })
    })
  })

  describe('runUsetrace', () => {
    it('should trigger a build and wait for it to finish', async () => {
      const config = {
        envUrl: process.env.USETRACE_API_URL,
        buildTimeoutSeconds: parseInt(process.env.INPUT_BUILD_TIMEOUT_SECONDS),
        failOnFailedTraces: process.env.INPUT_FAIL_ON_FAILED_TRACES?.toLowerCase() === 'true',
        pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS),
      }
      usetraceRunner = new UsetraceRunner(config, 'project')

      const mockBuildId = 'build123'
      const mockBuildResult = { status: 'FINISHED' }

      axios.post.mockResolvedValue({ status: 200, data: mockBuildId })
      usetraceRunner.waitForBuildToFinish = jest.fn().mockResolvedValue(mockBuildResult)

      const result = await usetraceRunner.runUsetrace()

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/project/project123/execute-all'),
        expect.any(Object),
        { headers: { Authorization: 'Bearer api-key-123' } }
      )
      expect(usetraceRunner.context.buildId).toBe(mockBuildId)
      expect(usetraceRunner.waitForBuildToFinish).toHaveBeenCalled()
      expect(result).toEqual(mockBuildResult)
    })

    it('should throw an error if the API response is invalid', async () => {
      const config = {
        envUrl: process.env.USETRACE_API_URL,
        buildTimeoutSeconds: parseInt(process.env.INPUT_BUILD_TIMEOUT_SECONDS),
        failOnFailedTraces: process.env.INPUT_FAIL_ON_FAILED_TRACES?.toLowerCase() === 'true',
        pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS),
      }
      usetraceRunner = new UsetraceRunner(config, 'project')

      axios.post.mockResolvedValue({ status: 400, data: null })

      await expect(usetraceRunner.runUsetrace()).rejects.toThrow(
        'No build ID returned from execute command'
      )
    })
  })

  describe('waitForBuildToFinish', () => {
    it('should resolve when build status is FINISHED', async () => {
      const config = {
        envUrl: process.env.USETRACE_API_URL,
        buildTimeoutSeconds: parseInt(process.env.INPUT_BUILD_TIMEOUT_SECONDS),
        failOnFailedTraces: process.env.INPUT_FAIL_ON_FAILED_TRACES?.toLowerCase() === 'true',
        pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS),
      }
      usetraceRunner = new UsetraceRunner(config, 'project')
      usetraceRunner.context.buildId = 'build123'

      const mockStatus = { status: 'FINISHED', summary: { fail: 0, request: 1 } }
      usetraceRunner.checkBuildStatus = jest.fn().mockResolvedValue(mockStatus)

      const result = await usetraceRunner.waitForBuildToFinish()

      expect(result).toEqual(mockStatus)
      expect(usetraceRunner.checkBuildStatus).toHaveBeenCalledTimes(1)
    })

    it('should poll until build is finished', async () => {
      const config = {
        envUrl: process.env.USETRACE_API_URL,
        buildTimeoutSeconds: parseInt(process.env.INPUT_BUILD_TIMEOUT_SECONDS),
        failOnFailedTraces: process.env.INPUT_FAIL_ON_FAILED_TRACES?.toLowerCase() === 'true',
        pollIntervalMs: 100, // Faster polling for test
      }
      usetraceRunner = new UsetraceRunner(config, 'project')
      usetraceRunner.context.buildId = 'build123'

      const mockRunningStatus = { status: 'RUNNING' }
      const mockFinishedStatus = { status: 'FINISHED', summary: { fail: 0, request: 1 } }
      usetraceRunner.checkBuildStatus = jest
        .fn()
        .mockResolvedValueOnce(mockRunningStatus)
        .mockResolvedValueOnce(mockRunningStatus)
        .mockResolvedValueOnce(mockFinishedStatus)

      const result = await usetraceRunner.waitForBuildToFinish()

      expect(result).toEqual(mockFinishedStatus)
      expect(usetraceRunner.checkBuildStatus).toHaveBeenCalledTimes(3)
    })

    it('should throw an error if polling times out', async () => {
      const config = {
        envUrl: process.env.USETRACE_API_URL,
        buildTimeoutSeconds: 1,
        failOnFailedTraces: process.env.INPUT_FAIL_ON_FAILED_TRACES?.toLowerCase() === 'true',
        pollIntervalMs: 100, // Faster polling for test
      }
      usetraceRunner = new UsetraceRunner(config, 'project')
      usetraceRunner.context.buildId = 'build123'

      const mockRunningStatus = { status: 'RUNNING' }
      usetraceRunner.checkBuildStatus = jest.fn().mockResolvedValue(mockRunningStatus)

      await expect(usetraceRunner.waitForBuildToFinish()).rejects.toThrow(
        'Polling timed out after 1 seconds'
      )
    })
  })

  describe('processResult', () => {
    it('should save output and not throw error when no traces fail', async () => {
      const config = {
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: true,
        pollIntervalMs: 5000,
      }
      usetraceRunner = new UsetraceRunner(config, 'project')
      usetraceRunner.saveOutput = jest.fn()

      const result = { summary: { fail: 0, pass: 5, request: 5 } }

      await usetraceRunner.processResult(result)

      expect(usetraceRunner.saveOutput).toHaveBeenCalled()
    })

    it('should throw error when traces fail and failOnFailedTraces is true', async () => {
      const config = {
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: true,
        pollIntervalMs: 5000,
      }
      usetraceRunner = new UsetraceRunner(config, 'project')
      usetraceRunner.saveOutput = jest.fn()

      const result = { summary: { fail: 2, pass: 3, request: 5 } }

      await expect(usetraceRunner.processResult(result)).rejects.toThrow(
        '2 Traces failed out of 5'
      )
      expect(usetraceRunner.saveOutput).toHaveBeenCalled()
    })

    it('should not throw error when traces fail and failOnFailedTraces is false', async () => {
      const config = {
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: false,
        pollIntervalMs: 5000,
      }
      usetraceRunner = new UsetraceRunner(config, 'project')
      usetraceRunner.saveOutput = jest.fn()

      const result = { summary: { fail: 2, pass: 3, request: 5 } }

      await usetraceRunner.processResult(result)

      expect(usetraceRunner.saveOutput).toHaveBeenCalled()
    })
  })

  describe('generateFlatSummary', () => {
    it('should generate a flat summary from the result', () => {
      const config = {
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: true,
        pollIntervalMs: 5000,
      }
      usetraceRunner = new UsetraceRunner(config, 'project')

      const result = {
        status: 'FINISHED',
        summary: { fail: 1, pass: 4, request: 5 },
        otherProperty: 'value',
      }

      const flatSummary = usetraceRunner.generateFlatSummary(result)

      expect(flatSummary).toEqual({
        status: 'FINISHED',
        fail: 1,
        pass: 4,
        request: 5,
        otherProperty: 'value',
      })
    })
  })

  describe('saveOutput', () => {
    it('should save the output to a file', async () => {
      const config = {
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: true,
        pollIntervalMs: 5000,
      }
      usetraceRunner = new UsetraceRunner(config, 'project')
      usetraceRunner.output = { status: 'FINISHED', fail: 0, pass: 5, request: 5 }

      await usetraceRunner.saveOutput()

      expect(fs.writeFile).toHaveBeenCalledWith(
        '../output.json',
        JSON.stringify(usetraceRunner.output, null, 2)
      )
    })
  })
})
