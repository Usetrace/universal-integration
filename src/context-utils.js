const parseBrowsers = (browsers) => {
  let parsedBrowsers = []

  if (browsers) {
    parsedBrowsers = browsers
      .replace(/[^a-zA-Z, ]/g, '') // Leave only the meaningful characters
      .split(',')
      .map((browser) => {
        const [name, version] = browser.trim().split(' ')
        if (version) {
          console.debug('Specifying a browser version is not a supported feature')
        }
        return {
          browserName: name,
          // Version picking is disabled for now
          // ...(version && { version: parseInt(version) }),
        }
      })
  }

  // chrome set as default
  if (!parsedBrowsers.length) {
    parsedBrowsers.unshift({ browserName: 'chrome' })
  }

  return parsedBrowsers
}

const parseReporters = (context) => {
  let parsedReporters = {}

  // If a webhook URL was provided we must generate the webhook node
  if (context.webhookUrl) {
    let webhook = {
      url: context.webhookUrl,
      when: context.webhookWhen ? context.webhookWhen : 'always',
      ...(context.webhookSecretKey && { secretKey: context.webhookSecretKey }),
      ...(context.webhookUsername && { username: context.webhookUsername }),
      ...(context.webhookPassword && { password: context.webhookPassword }),
    }
    parsedReporters.reporters = [{ webhook }]
  }

  return parsedReporters
}

const parseParameters = (parameters) => {
  if (!parameters) {
    return {}
  }

  try {
    // Parse parameters as a json object
    const jsonStr = `{${parameters}}`
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('Error parsing parameters:', error)
    return {}
  }
}

module.exports = { parseBrowsers, parseReporters, parseParameters }
