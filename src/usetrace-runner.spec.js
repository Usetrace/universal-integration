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

    // Default: mock no env-derived context; tests will pass explicit context to constructor
    utils.getContextFromEnvVars.mockReturnValue({})
    utils.castContextParametersType.mockImplementation((ctx) => ctx)

    // Mock createPayloadFromContext to return a payload object
    utils.createPayloadFromContext.mockReturnValue({
      requiredCapabilities: [{ browserName: 'chrome' }],
      baseUrl: 'https://example.com',
      parameters: { key: 'value' },
      tags: ['tag1', 'tag2'],
      commit: 'abc123',
      commitLink: 'commit-abc123',
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

  describe('constructor', () => {
    it('should initialize with correct config and project trigger type', () => {
      const inputContext = {
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: true,
        pollIntervalMs: 5000,
        projectId: 'project123',
        usetraceApiKey: 'api-key-123',
      }
      usetraceRunner = new UsetraceRunner(inputContext)

      expect(usetraceRunner.context.envUrl).toBe('https://api.usetrace.com')
      expect(usetraceRunner.context.buildTimeoutSeconds).toBe(120)
      expect(usetraceRunner.context.failOnFailedTraces).toBe(true)
      expect(usetraceRunner.context.pollIntervalMs).toBe(5000)
      expect(usetraceRunner.context.triggerType).toBe('project')
      expect(usetraceRunner.context.triggerId).toBe('project123')
    })

    it('should use default values when environment variables are not set', () => {
      const inputContext = {
        projectId: 'project123',
      }
      usetraceRunner = new UsetraceRunner(inputContext)

      expect(usetraceRunner.context.envUrl).toBe('https://api.usetrace.com')
      expect(usetraceRunner.context.buildTimeoutSeconds).toBe(3600)
      expect(usetraceRunner.context.failOnFailedTraces).toBe(true)
      expect(usetraceRunner.context.pollIntervalMs).toBe(5000)
      expect(usetraceRunner.context.triggerType).toBe('project')
    })
  })

  describe('runUsetrace', () => {
    it('should trigger a build and wait for it to finish', async () => {
      const inputContext = {
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: true,
        pollIntervalMs: 5000,
        projectId: 'project123',
        usetraceApiKey: 'api-key-123',
        waitForResult: true,
      }
      usetraceRunner = new UsetraceRunner(inputContext)

      const mockBuildId = 'build123'
      const mockBuildResult = { status: 'FINISHED' }

      axios.post.mockResolvedValue({ status: 200, data: mockBuildId })
      usetraceRunner.waitForBuildToFinish = jest.fn().mockResolvedValue(mockBuildResult)

      const result = await usetraceRunner.runUsetrace()

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/project/project123/execute-all?key=api-key-123'),
        expect.any(Object)
      )
      expect(usetraceRunner.context.buildId).toBe(mockBuildId)
      expect(usetraceRunner.waitForBuildToFinish).toHaveBeenCalled()
      expect(result).toEqual(mockBuildResult)
    })

    it('should throw an error if the API response is invalid', async () => {
      const inputContext = {
        envUrl: 'https://api.usetrace.com',
        buildTimeoutSeconds: 120,
        failOnFailedTraces: true,
        pollIntervalMs: 5000,
        projectId: 'project123',
        usetraceApiKey: 'api-key-123',
      }
      usetraceRunner = new UsetraceRunner(inputContext)

      axios.post.mockResolvedValue({ status: 400, data: null })

      await expect(usetraceRunner.runUsetrace()).rejects.toThrow(
        'No build ID returned from execute command'
      )
    })

    it('should trigger and return immediately when waitForResult is false', async () => {
      const inputContext = {
        projectId: 'project123',
        usetraceApiKey: 'api-key-123',
        waitForResult: false,
      }
      usetraceRunner = new UsetraceRunner(inputContext)

      const mockBuildId = 'buildXYZ'
      axios.post.mockResolvedValue({ status: 200, data: mockBuildId })

      const result = await usetraceRunner.runUsetrace()

      expect(result).toEqual({
        id: mockBuildId,
        status: 'TRIGGERED',
        summary: { request: 0, finish: 0, pass: 0, fail: 0 },
      })
    })
  })

  describe('waitForBuildToFinish', () => {
    it('should resolve when build status is FINISHED', async () => {
      const inputContext = { projectId: 'project123' }
      usetraceRunner = new UsetraceRunner(inputContext)
      usetraceRunner.context.buildId = 'build123'

      const mockStatus = { status: 'FINISHED', summary: { fail: 0, request: 1 } }
      usetraceRunner.checkBuildStatus = jest.fn().mockResolvedValue(mockStatus)

      const result = await usetraceRunner.waitForBuildToFinish()

      expect(result).toEqual(mockStatus)
      expect(usetraceRunner.checkBuildStatus).toHaveBeenCalledTimes(1)
    })

    it('should poll until build is finished', async () => {
      const inputContext = { projectId: 'project123', pollIntervalMs: 100 }
      usetraceRunner = new UsetraceRunner(inputContext)
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
      const inputContext = {
        projectId: 'project123',
        buildTimeoutSeconds: 1,
        pollIntervalMs: 100,
      }
      usetraceRunner = new UsetraceRunner(inputContext)
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
      const inputContext = { projectId: 'project123' }
      usetraceRunner = new UsetraceRunner(inputContext)
      usetraceRunner.saveOutput = jest.fn()

      const result = { summary: { fail: 0, pass: 5, request: 5 } }

      await usetraceRunner.processResult(result)

      expect(usetraceRunner.saveOutput).toHaveBeenCalled()
    })

    it('should throw error when traces fail and failOnFailedTraces is true', async () => {
      const inputContext = { projectId: 'project123', failOnFailedTraces: true }
      usetraceRunner = new UsetraceRunner(inputContext)
      usetraceRunner.saveOutput = jest.fn()

      const result = { summary: { fail: 2, pass: 3, request: 5 } }

      await expect(usetraceRunner.processResult(result)).rejects.toThrow(
        "The execution failed because 2 Traces failed out of 5. If you don't want the execution to fail when a Trace fails, you can set 'failOnFailedTraces' to false."
      )
      expect(usetraceRunner.saveOutput).toHaveBeenCalled()
    })

    it('should not throw error when traces fail and failOnFailedTraces is false', async () => {
      const inputContext = { projectId: 'project123', failOnFailedTraces: false }
      usetraceRunner = new UsetraceRunner(inputContext)
      usetraceRunner.saveOutput = jest.fn()

      const result = { summary: { fail: 2, pass: 3, request: 5 } }

      await usetraceRunner.processResult(result)

      expect(usetraceRunner.saveOutput).toHaveBeenCalled()
    })
  })

  describe('generateFlatSummary', () => {
    it('should generate a flat summary from the result', () => {
      const inputContext = { projectId: 'project123' }
      usetraceRunner = new UsetraceRunner(inputContext)

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
      const inputContext = { projectId: 'project123' }
      usetraceRunner = new UsetraceRunner(inputContext)
      usetraceRunner.output = { status: 'FINISHED', fail: 0, pass: 5, request: 5 }

      await usetraceRunner.saveOutput()

      expect(fs.writeFile).toHaveBeenCalledWith(
        '../output.json',
        JSON.stringify(usetraceRunner.output, null, 2)
      )
    })
  })
})
