const { parseBrowsers, parseReporters, parseParameters } = require('./context-utils')
const parametersType = require('./parametersType.json')

/** Converts a string from snake case or kebab case to camel case */
function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/^[_-]+/, '')
    .replace(/[_-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
}

/** Finds all env vars and turns them into a context object */
function getContextFromEnvVars() {
  // Get all environment variables
  const env = process.env
  // Loop through each environment variable
  const context = {}

  Object.keys(env)
    .filter((key) => ['INPUT_'].some((prefix) => key.startsWith(prefix)))
    .forEach((key) => {
      const inputName = toCamelCase(key.slice(6)) // Convert the Kebab case into camel case
      const inputValue = env[key]
      context[inputName] = inputValue // Add the input name and value to the context object
    })
  return context
}

function castParameterType(parameterName, value) {
  const typeToCast = parametersType[parameterName]
  switch (typeToCast) {
    case 'Integer': {
      const num = parseInt(value, 10)
      if (isNaN(num)) {
        throw new Error(`${parameterName}: Value "${value}" cannot be converted to Integer`)
      }
      return num
    }
    case 'Boolean': {
      const lowerValue = value.toLowerCase()
      if (lowerValue !== 'true' && lowerValue !== 'false') {
        throw new Error(`${parameterName}: Value "${value}" cannot be converted to Boolean`)
      }
      return lowerValue === 'true'
    }
    default:
      return value
  }
}

/** Processes the context object and applies additional type casting based on parametersType */
function castContextParametersType(context) {
  // Process only the parameters that need type casting
  Object.keys(parametersType).forEach((paramName) => {
    if (paramName in context) {
      try {
        context[paramName] = castParameterType(paramName, context[paramName])
      } catch (error) {
        console.warn(`Warning: Type casting failed for ${paramName}:`, error.message)
      }
    }
  })

  return context
}

/** Generates a valid API payload from a Context object */
function createPayloadFromContext(context) {
  const parsedContext = {}

  // Parse baseUrl (optional)
  if (context.baseUrl) {
    parsedContext.baseUrl = context.baseUrl
  }

  // Parse browsers into requiredCapabilities
  parsedContext.requiredCapabilities = parseBrowsers(context.browsers)

  // Parse tags
  if (context.tags) {
    const tags = context.tags
      .replace(/['"[\]]/g, '')
      .split(',')
      .map((tag) => tag.trim())

    if (tags.length > 0) {
      parsedContext.tags = tags
    }
  }

  // Parse commit and commitLink
  if (context.commit) {
    parsedContext.commit = context.commit
  }
  if (context.commitLink) {
    parsedContext.commitLink = context.commitLink
  }

  // Parse reporters
  // TODO: FIX ISSUE IN PREVIOUS INTEGRATIONS IF PRESENT: Duplicated reporters node
  const reporters = parseReporters(context)
  if (Object.keys(reporters).length > 0) {
    parsedContext.reporters = reporters
  }

  // Parse parameters
  const parameters = parseParameters(context.parameters)
  if (Object.keys(parameters).length > 0) {
    parsedContext.parameters = parameters
  }

  return parsedContext
}

/** Finish the execution with an error message */
async function throwError(errorMessage) {
  console.error('Error: ', errorMessage)
  process.exit(1)
}

module.exports = {
  toCamelCase,
  getContextFromEnvVars,
  castContextParametersType,
  createPayloadFromContext,
  throwError,
}
