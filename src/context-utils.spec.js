// context-utils.test.js
const { parseBrowsers, parseReporters, parseParameters } = require('./context-utils')

describe('parseBrowsers', () => {
  test('parses single browser', () => {
    expect(parseBrowsers('chrome')).toEqual([{ browserName: 'chrome' }])
  })

  test('parses multiple browsers', () => {
    expect(parseBrowsers('chrome, firefox')).toEqual([
      { browserName: 'chrome' },
      { browserName: 'firefox' },
    ])
  })

  test('returns Chrome if no browsers provided', () => {
    expect(parseBrowsers('')).toEqual([{ browserName: 'chrome' }])
    expect(parseBrowsers(undefined)).toEqual([{ browserName: 'chrome' }])
  })
})

describe('parseParameters', () => {
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  test('returns empty object for falsy input', () => {
    expect(parseParameters('')).toEqual({})
    expect(parseParameters(undefined)).toEqual({})
  })

  test("don't break for invalid object", () => {
    expect(parseParameters('Invalid')).toEqual({})
  })

  test('parses single parameter', () => {
    expect(parseParameters('"parameter1": "value of a \\"parameter\\""')).toEqual({
      parameter1: 'value of a "parameter"',
    })
  })

  test('parses multiple parameters', () => {
    expect(
      parseParameters(
        '"parameter1": "value of a \\"parameter\\"", "parameter2": "another value"'
      )
    ).toEqual({ parameter1: 'value of a "parameter"', parameter2: 'another value' })
  })

  test('invalid json parameters', () => {
    expect(parseParameters('"valid": "value", invalid, invalid2:"value2"')).toEqual({})
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error parsing parameters:',
      expect.any(Error)
    )
  })
})

describe('parseReporters', () => {
  test('returns empty object when no webhook URL is provided', () => {
    const context = {
      browsers: 'chrome, firefox',
    }
    expect(parseReporters(context)).toEqual({})
  })

  test('returns correct structure with only webhook URL', () => {
    const context = {
      webhookUrl: 'https://example.com/webhook',
      webhookWhen: 'always',
    }
    expect(parseReporters(context)).toEqual({
      reporters: [
        {
          webhook: {
            url: 'https://example.com/webhook',
            when: 'always',
          },
        },
      ],
    })
  })

  test('includes all provided webhook properties', () => {
    const context = {
      webhookUrl: 'https://example.com/webhook',
      webhookWhen: 'changes',
      webhookSecretKey: 'secret123',
      webhookUsername: 'user',
      webhookPassword: 'pass',
    }
    expect(parseReporters(context)).toEqual({
      reporters: [
        {
          webhook: {
            url: 'https://example.com/webhook',
            when: 'changes',
            secretKey: 'secret123',
            username: 'user',
            password: 'pass',
          },
        },
      ],
    })
  })

  test('handles empty string values correctly', () => {
    const context = {
      webhookUrl: 'https://example.com/webhook',
      webhookWhen: '',
      webhookSecretKey: '',
      webhookUsername: 'user',
      webhookPassword: '',
    }
    expect(parseReporters(context)).toEqual({
      reporters: [
        {
          webhook: {
            url: 'https://example.com/webhook',
            when: 'always',
            username: 'user',
          },
        },
      ],
    })
  })
})
