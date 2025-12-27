# Debug Fix Loop

Deploy, test, and verify fixes in a loop until the issue is resolved.

## Pattern

This command is based on your successful debug iteration sessions:
- Identify the issue (debug footer missing, broken feature)
- Deploy the fix
- Test via webhook or direct interaction
- Verify the fix worked
- Loop if still broken

## Usage

/debug-fix <app>

/debug-fix telegram

/debug-fix github

/debug-fix web

## What This Does

1. **Deploys** the target app:
   ```bash
   bun run deploy:<app>
   ```

2. **Tails logs** to see runtime errors:
   ```bash
   wrangler tail <app-name> --format pretty
   ```

3. **Prompts you** to test the feature:
   - For telegram: Send a test message
   - For github: Create a test mention/issue
   - For web: Open the URL and test

4. **Verifies** the fix based on your feedback

5. **Loops** if still broken:
   - Analyzes what went wrong
   - Proposes a fix
   - Deploys again
   - Repeats until fixed

## Examples from Your History

### December 14 (Debug Footer - 5 iterations)
```
where is my debug footer missing telegram?

lost the debug footer in telegram:

POST https://duyetbot-telegram.duyet.workers.dev/api/webhook
```
→ Deployed → Tested → Still broken → Loop → Fixed

```
why still showing old debug footer?

POST https://duyetbot-telegram.duyet.workers.dev/api/webhook
```
→ Analyzed → Found issue → Deployed → Verified → Fixed

### December 14 (Telegram stopped working)
```
stop response again:

POST https://duyetbot-telegram.duyet.workers.dev/api/webhook

/fix-and-push

telegram stopped working again
```
→ Multiple iterations of deploy-test-verify → Fixed

## Verification Methods

The command uses the verification method you prefer:

- **Webhook test**: POST to the webhook endpoint
- **Direct test**: Send actual message to bot
- **Log analysis**: Check wrangler tail output
- **URL test**: Open web URL and verify

## Loop Exit Conditions

The loop continues until:
- ✅ You confirm the fix works
- ✅ Automated tests pass
- ✅ Log output shows no errors
- ✅ Manual verification succeeds

## Success Indicators

Based on your successful sessions:
- Rapid iteration (deploy → test → deploy)
- Real-world verification (not just tests)
- Log analysis for runtime errors
- Clear confirmation when fixed
