const { toCamelCase, getContext, createPayloadFromContext } = require('./utils')

describe('utils', () => {
  describe('toCamelCase', () => {
    test('converts kebab-case to camelCase', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld')
    })

    test('converts snake_case to camelCase', () => {
      expect(toCamelCase('hello_world')).toBe('helloWorld')
    })

    test('handles mixed kebab and snake case', () => {
      expect(toCamelCase('hello-world_example')).toBe('helloWorldExample')
    })

    test('handles uppercase letters', () => {
      expect(toCamelCase('HELLO-WORLD')).toBe('helloWorld')
    })

    test('handles empty string', () => {
      expect(toCamelCase('')).toBe('')
    })
  })

  describe('getContext', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    test('extracts INPUT_ environment variables', () => {
      process.env.INPUT_BASE_URL = 'http://example.com'
      process.env.INPUT_BROWSERS = 'chrome, firefox'
      process.env.ANOTHER_VAR = 'should not be included'

      const context = getContext()
      expect(context).toEqual({
        baseUrl: 'http://example.com',
        browsers: 'chrome, firefox',
      })
      expect(context).not.toHaveProperty('anotherVar')
    })

    test('handles empty environment', () => {
      process.env = {}

      const context = getContext()

      expect(context).toEqual({})
    })
  })

  describe('createPayloadFromContext', () => {
    test('creates payload with all properties', () => {
      const context = {
        baseUrl: 'http://example.com',
        browsers: 'chrome, firefox',
        tags: 'smoke, regression',
        commit: 'abc123',
        commitLink: 'commit-abc123',
        parameters: '"key1": "value1", "key2": "value2"',
      }

      const payload = createPayloadFromContext(context)
      expect(payload).toEqual({
        baseUrl: 'http://example.com',
        requiredCapabilities: [{ browserName: 'chrome' }, { browserName: 'firefox' }],
        tags: ['smoke', 'regression'],
        commit: 'abc123',
        commitLink: 'commit-abc123',
        parameters: {
          key1: 'value1',
          key2: 'value2',
        },
      })
    })

    test('creates payload with only tags', () => {
      const context = {
        tags: 'smoke',
      }

      const payload = createPayloadFromContext(context)
      expect(payload).toEqual({
        requiredCapabilities: [{ browserName: 'chrome' }],
        tags: ['smoke'],
      })
    })

    test('creates payload with minimal properties', () => {
      const context = {
        browsers: 'chrome',
      }

      const payload = createPayloadFromContext(context)
      expect(payload).toEqual({
        requiredCapabilities: [{ browserName: 'chrome' }],
      })
    })
  })
})
