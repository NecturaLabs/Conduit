# /conduit-setup Skill

Follow these steps when the user runs /conduit-setup:

## Step 1: Get API URL

Say: "Conduit server URL [https://conduit-api.necturalabs.com]: " and wait for input.

If the user presses Enter or provides nothing, use `https://conduit-api.necturalabs.com`.
Otherwise use whatever URL they provide (strip trailing slash).

Store as CONDUIT_API_URL.

## Step 2: Check existing credentials

Run: `cat ~/.conduit 2>/dev/null`

If the file exists and contains an apiUrl and hookToken:
- Call GET {apiUrl}/agent/prompts with Authorization: Bearer {hookToken}
- If 200: credentials are valid. Skip to Step 6 (confirm).
- If not 200: credentials are invalid or expired. Continue to Step 3.

If the file doesn't exist: continue to Step 3.

## Step 3: Start device flow

Call POST {CONDUIT_API_URL}/agent/auth/device (no auth headers needed).

Expected response:
{
  "deviceCode": "...",
  "userCode": "BCDF-GHJK",
  "verificationUrl": "...",
  "expiresIn": 600,
  "interval": 5
}

Tell the user:
"✓ Open this URL to approve the connection:

  {verificationUrl}

  Log in if prompted, then enter code: **{userCode}**

  Waiting for approval..."

## Step 4: Poll for approval

Run a single Bash command that loops until approved, expired, or timed out (120 attempts × 5s = 10 min):

```bash
DEVICE_CODE="{deviceCode}"
API_URL="{CONDUIT_API_URL}"
for i in $(seq 1 120); do
  sleep 5
  RESP=$(curl -s "$API_URL/agent/auth/poll?deviceCode=$DEVICE_CODE")
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  if [ "$STATUS" = "approved" ]; then
    echo "$RESP"
    break
  elif [ "$STATUS" = "expired" ]; then
    echo '{"status":"expired"}'
    break
  fi
  if [ "$i" = "120" ]; then
    echo '{"status":"timeout"}'
  fi
done
```

Parse the final output:
- `"status":"approved"` → extract `token` value, go to Step 5
- `"status":"expired"` → tell user "Code expired. Run /conduit-setup again." and stop
- `"status":"timeout"` → tell user "Timed out. Run /conduit-setup again." and stop

## Step 5: Store credentials

Run:
```bash
cat > ~/.conduit << 'EOF'
{
  "apiUrl": "CONDUIT_API_URL_VALUE",
  "hookToken": "TOKEN_VALUE"
}
EOF
chmod 600 ~/.conduit
```
(Replace CONDUIT_API_URL_VALUE and TOKEN_VALUE with the actual values)

## Step 6: Register this instance

Call POST {CONDUIT_API_URL}/agent/register:
- Authorization: Bearer {hookToken}
- Content-Type: application/json
- Body: { "name": "claude-code@{hostname}" }

Get hostname via: `hostname`

## Step 7: Sync models (optional)

Check: `echo $ANTHROPIC_API_KEY`

If set:
- GET https://api.anthropic.com/v1/models with x-api-key header and anthropic-version: 2023-06-01
- POST {CONDUIT_API_URL}/agent/models with the model list

## Step 8: Confirm

Say: "✓ Conduit setup complete! Your Claude Code sessions will now be tracked automatically."
