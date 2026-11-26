# Task 40: Migrate the relock scheduler to AWS EventBridge + Lambda

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. This is an infrastructure migration: there is no application TDD loop, but every step has a checkable command and the old scheduler must keep running until the new one is verified.

> Part of the [Smart Locker MVP implementation plan](../2026-11-01-smart-locker-mvp.md).
> Spec: [Pilot hardening and growth design](../../specs/2026-11-03-smart-locker-pilot-hardening-design.md) §24.
> Phase 3 (infrastructure follow-up). **Depends on:** Task 38.

---

**Files:**
- Create: `infra/relock-scheduler/template.yaml`
- Create: `infra/relock-scheduler/README.md` (deploy and rollback commands)
- Modify: `docs/relock-scheduler.md` (add the AWS provider and switch the deployment record)
- Modify: `README.md`, `docs/pilot-setup-guide.md` (point at the active provider)
- Modify: `.superpowers/sdd/2026-11-01-smart-locker-mvp/progress.md` (record the cutover)

**Interfaces:**
- Consumes: `GET /api/cron/relock`, `CRON_SECRET`, `APP_URL`, the existing route contract, and the Task 38 runbook.
- Produces:
  - An AWS EventBridge Scheduler schedule (`rate(1 minute)`) that invokes a Lambda once per minute.
  - A Lambda that fetches `CRON_SECRET` from SSM SecureString and calls the route with a bearer token.
  - CloudWatch error alarm and an SQS dead-letter queue.

**Non-goals:** No application code, route, token, or database changes; no other AWS
migration; no removal of the QStash schedule until the Lambda path passes the
closed-tab acceptance; no multi-region failover.

- [ ] **Step 1: Create the secret parameter**

Store the existing `CRON_SECRET` in SSM Parameter Store as a SecureString in the
chosen EU region (for example `eu-west-1`):

```bash
read -rs CRON_SECRET; export CRON_SECRET
aws ssm put-parameter \
  --name /smart-locker/pilot/cron-secret \
  --type SecureString \
  --value "$CRON_SECRET" \
  --overwrite \
  --region eu-west-1
```

Do not put the value in the CloudFormation template, repo, or shell history.

- [ ] **Step 2: Add the Lambda and Scheduler template**

Create `infra/relock-scheduler/template.yaml` with:

- Parameters: `AppUrl`, `CronSecretParameterName` (default
  `/smart-locker/pilot/cron-secret`), `ScheduleState` (`ENABLED`/`DISABLED`,
  default `DISABLED`), `AlarmEmail` (optional).
- `AWS::Lambda::Function`: Node.js 22, `arm64`, 128 MB, 15 s timeout, inline
  `index.js`, environment `APP_URL` and `CRON_SECRET_PARAMETER`.
- A basic Lambda execution role plus `ssm:GetParameter` on the parameter ARN and
  `kms:Decrypt` for the SecureString (scope the KMS resource as tightly as the
  chosen key allows).
- `AWS::Scheduler::Schedule`: `rate(1 minute)`, `FlexibleTimeWindow: OFF`,
  `State: !Ref ScheduleState`, target the Lambda, retry policy
  `MaximumRetryAttempts: 2`, `MaximumEventAgeInSeconds: 60`, and a DLQ.
- A scheduler execution role with `lambda:InvokeFunction`.
- An encrypted SQS dead-letter queue and an optional SNS alarm on Lambda
  `Errors >= 1` over 5 minutes.

Lambda handler behavior:

```js
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm")

const ssm = new SSMClient({})
let cached

async function getSecret() {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value
  const result = await ssm.send(new GetParameterCommand({
    Name: process.env.CRON_SECRET_PARAMETER,
    WithDecryption: true,
  }))
  cached = { value: result.Parameter.Value, at: Date.now() }
  return cached.value
}

exports.handler = async () => {
  const response = await fetch(`${process.env.APP_URL}/api/cron/relock`, {
    headers: { authorization: `Bearer ${await getSecret()}` },
  })
  const body = await response.text()

  if (!response.ok) {
    // Do not log the secret or the full URL.
    console.error("relock_failed", response.status)
    throw new Error(`relock_${response.status}`)
  }

  console.log("relock_ok", body)
  return { statusCode: response.status, body }
}
```

The Lambda never logs the secret or the request URL; the response contains only
counts.

- [ ] **Step 3: Deploy with the schedule disabled**

```bash
aws cloudformation deploy \
  --stack-name smart-locker-relock-scheduler \
  --template-file infra/relock-scheduler/template.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    AppUrl="$APP_URL" \
    CronSecretParameterName=/smart-locker/pilot/cron-secret \
    ScheduleState=DISABLED \
  --region eu-west-1
```

Read the stack outputs for the function name and schedule name.

- [ ] **Step 4: Invoke the Lambda manually**

```bash
aws lambda invoke \
  --function-name <function-name> \
  --payload '{}' \
  /tmp/relock-lambda-out.json \
  --region eu-west-1
cat /tmp/relock-lambda-out.json
```

Expected: the invocation succeeds and CloudWatch logs `relock_ok` with a body
such as `{"relocked":0,"failed":0}`. A `401` means the SSM value does not match
the deployment's `CRON_SECRET`; a `503` means the deployment has no secret.

- [ ] **Step 5: Enable the schedule and verify the interval**

Update the stack with `ScheduleState=ENABLED`, or update the schedule directly.
Wait for two invocations and confirm CloudWatch logs show one `relock_ok` per
minute. Confirm no secret or URL appears in the logs.

- [ ] **Step 6: Cut over from QStash**

1. Pause or delete the QStash schedule.
2. Keep its configuration available for rollback until the acceptance passes.
3. Run the closed-tab acceptance from the runbook: create a share link, unlock,
   close the tab before 30 seconds, wait at most two minutes, reload the
   dashboard, confirm **Locked**, and confirm the activity event.
4. Record the latency and the provider/schedule IDs in
   `docs/relock-scheduler.md`.

- [ ] **Step 7: Update the runbook and operator docs**

In `docs/relock-scheduler.md`, make AWS the active provider section, keep QStash
as the documented rollback/alternative, add the stack name, region, schedule
name, SSM parameter name, alarm, and the new deployment record. Update
`README.md` and `docs/pilot-setup-guide.md` to point at the AWS section.

- [ ] **Step 8: Verify the application gate**

No app code changed, but run the normal gate to catch accidental edits:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

The E2E suite does not exercise the external scheduler; the closed-tab
acceptance and CloudWatch logs are the evidence for this task.

- [ ] **Step 9: Commit**

```bash
git add infra/relock-scheduler docs/relock-scheduler.md README.md docs/pilot-setup-guide.md
git commit -m "ops: migrate the relock scheduler to AWS"
```

---

## Rollback

Re-enable the QStash schedule and set the AWS `ScheduleState` back to
`DISABLED`. Do not delete the QStash schedule until the AWS path has completed
the closed-tab acceptance and the operator has recorded it.

## Completion evidence

- The SSM parameter exists with the current `CRON_SECRET`.
- The Lambda manual invoke returns `200` and logs counts only.
- The schedule runs once per minute and the CloudWatch alarm is configured.
- The closed-tab guest relocks within two intervals with QStash paused.
- The deployment record names AWS, the region, stack/schedule IDs, the measured
  interval, and the latency.
