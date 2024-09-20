# ![](https://gitlab.com/uploads/-/system/group/avatar/93079170/usetrace-logo-2.png?width=48) gitlab-jobs

Integrate easily your Usetrace tests in your CI/CD pipelines.
You are capable of triggering Traces from Usetrace using this action. Possible use cases are for example, deploying your code to a test environment, and then running your traces, and only deploying to your real environment if the build was successful.

You can also use it to make sure all is alright after deploying to your environment, and take actions if not.

Triggering traces from your CI/CD pipelines has endless possibilities.

### Accepted Inputs

Note: Inputs can be passed by command line parameter or by environment variable.

#### Required Inputs

- `--traceId <id>`/`INPUT_TRACE_ID`: ID of a valid Usetrace Project or Trace to be triggered.

To use extend from the job `.run-project-job` (`run-project-job.yml`):

- `--projectId <id>`/`INPUT_PROJECT_ID`: ID of a valid Usetrace Project or Trace to be triggered.

#### Optional Inputs

##### General Arguments

- `--browsers <list>`/`INPUT_BROWSERS`: Comma-separated list of browsers (e.g., 'chrome, firefox') If non is specified test will run in chrome.
- `--baseUrl <url>`/`INPUT_BASE_URL`: Base URL to execute against (defaults to the project base URL).
- `--parameters <json>`/`INPUT_PARAMETERS`: Object trace parameters. You can pass them as json attributes. Ex: '"key1": "value1", "key2": "value2"'.
- `--usetraceApiKey <key>`/`INPUT_USETRACE_API_KEY`: Usetrace API Key for authentication.
- `--buildTimeoutSeconds <seconds>`/`INPUT_BUILD_TIMEOUT_SECONDS`: Maximum time to wait for the build before timing out the workflow. Default: 3600 seconds (60 minutes).

#### Workflow Control

- `--failOnFailedTraces`/`INPUT_FAIL_ON_FAILED_TRACES`: Determines whether the workflow should fail if any traces fail. Set to 'true' to fail the workflow if the count of failed traces is not zero, 'false' to always pass the workflow regardless of trace results. Default: 'true'.

##### Reporter Webhook

- `--webhookUrl <url>`/`INPUT_WEBHOOK_URL`: URL of the POST callback to send the result. If you want a webhook to be invoked when the build finishes, you must include this value.
- `--webhookWhen <option>`/`INPUT_WEBHOOK_WHEN`: Designation when the webhook should be triggered. Available values: 'always', 'fails' (on failures only), 'changes' (on result changes only). Default: 'always'.
- `--webhookSecretkey`/`INPUT_WEBHOOK_SECRETKEY`: If provided, a HMAC signature will be created and passed via a Signature header to verify the validity of the POST response payload.
- `--webhookUsername <username>`/`INPUT_WEBHOOK_USERNAME`: Username for basic auth if the callback URL is behind an auth wall.
- `--webhookPassword <password>`/`INPUT_WEBHOOK_PASSWORD`: Password for basic auth.

##### Project-Only Arguments

These arguments only works if you are triggering a project (using a `projectId` instead of a `traceId`)

- `--tags <list>`/`INPUT_TAGS`: Comma-separated list of tags. Only traces with those tags will be run (by default runs all traces).
- `--commit <commit>`/`INPUT_COMMIT`: Hash of the commit leading to this build.
- `--commitLink <link>`/`INPUT_COMMIT_LINK`: Link to the commit.

### Output artifact

The builds generate an artifact in the root folder called `output.json` with the following fields:

- `id`: Build ID executed.
- `status`: Status of the run.
- `request`: Count of requested traces.
- `finish`: Count of finished traces.
- `pass`: Count of passed traces.
- `fail`: Count of failed traces.
- `report`: Full JSON report of the build.

Here is an example report:

```json
{
  "name": "Environment: https://www.wikipedia.org/",
  "tests": 2,
  "traces": 1,
  "expectedTracesToPass": 0,
  "tracesPassed": 1,
  "errors": 0,
  "failures": 0,
  "skip": 0,
  "bugs": 0,
  "bugsPassing": 0,
  "buildStable": true,
  "testCase": [
    {
      "className": "Usetrace.trace",
      "name": "chrome: Test Wikipedia in Spanish",
      "time": 1.192,
      "error": null,
      "browserName": "chrome",
      "traceName": " Test Wikipedia in Spanish",
      "taggedBug": false,
      "taggedFlaky": true
    },
    {
      "className": "Usetrace.trace",
      "name": "firefox: Test Wikipedia in Spanish",
      "time": 1.74,
      "error": null,
      "browserName": "firefox",
      "traceName": " Test Wikipedia in Spanish",
      "taggedBug": false,
      "taggedFlaky": true
    }
  ]
}
```

You can access all values of the report in the other jobs of your pipeline using the generated report artifact.

### Usage

#### Example triggering a single Trace in AWS CodeBuild

```yaml
version: 0.2

phases:
  pre_build:
    # Logic for including templates would be implemented here
    commands:
      - echo "Setting up Usetrace integration"
      - git clone https://github.com/usetrace/universal-integration.git
      - npm install --prefix universal-integration

  build:
    commands:
      # Trigger single trace job (replace with actual commands)
      - echo "Trigger single trace job"

      - npm run trace --trace {{Trace Id}} --prefix universal-integration

      # Act upon the results
      - |
        if [ $(jq '.report.failures | length' output.json) -eq 0 ]; then
          exit 0 # All went good
        else
          exit 1 # Make fail the build if things goes wrong
        fi

  post_build:
    # Conditional actions based on exit code
    commands:
      - echo "All traces passed!" # Success message (exit code 0)
      - |
        if [ $? -eq 0 ]; then
          # Need to find equivalent output message here.
          - echo "You are lucky!"
        else
          echo "No good news... Taking appropriate actions..."
        fi
```

Replace `{{Trace Id}}` by the id the Trace you want to run.

You can learn some more about how to use it looking into our development tests repo here:
https://gitlab.com/usetrace/INSERT-HERE-DOC-PATH

## How to debug locally this jobs

- Install dotenvx globaly by using:

```shell
npm install @dotenvx/dotenvx -g
```

&emsp;&emsp; Or any other install method you prefer: https://github.com/dotenvx/dotenvx

- Copy the `.env.local.example` file and rename your copy to `.env`.
- Fill it with your trace or project data
- Now you can run your trace by doing:

```shell
npm run usetrace
```

- You can also override any env vars by passing the parameters to the command:

```shell
npm run usetrace -- --traceId yourTraceId --browsers chrome,firefox --buildTimeoutSeconds 900 --webhookUrl https://webhook-test.com/yourWebhookId --parameters '"key1":"value1", "key2":"value2"'
```

## Support

For support, feel free to contact us [Usetrace contact-us](https://usetrace.com/contact-us) or open an issue in this repository.

You may also find some responses in Usetrace documentation: [Usetrace documentation](https://docs.usetrace.com)
