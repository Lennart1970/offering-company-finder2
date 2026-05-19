# LeadTrigger Cloud Computer Reference

This document describes the persistent Cloud Computer VM used to run the Python pipeline (`process_campaign.py`) for batch scoring of companies.

## VM Identity

| Field | Value |
|-------|-------|
| Manus Cloud Computer ID | `9jghb30rxy0a9a19pxurunzb8` |
| Manus URL | https://manus.im/cloud-computer/9jghb30rxy0a9a19pxurunzb8 |
| External IP | `104.155.66.149` |
| SSH user | `ubuntu` |
| OS | Ubuntu 24.04 LTS |

> **Note:** SSH password and API keys are stored in `~/leadtrigger/config.py` on the VM. Do not commit secrets to this repo.

## Reconnecting SSH from Manus Sandbox

The sandbox generates a new SSH key each session. Use the Python paramiko bootstrap to add it to the VM's `authorized_keys` at the start of each session:

```python
# Run once per session if SSH key auth fails
import paramiko
pub_key = open("/home/ubuntu/.ssh/vm_key.pub").read().strip()
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect("104.155.66.149", username="ubuntu", password="<VM_PASSWORD>", timeout=15)
cmd = f"grep -qF '{pub_key}' ~/.ssh/authorized_keys 2>/dev/null || echo '{pub_key}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo KEY_ADDED"
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode())
client.close()
```

Then use: `ssh -i ~/.ssh/vm_key -o StrictHostKeyChecking=no ubuntu@104.155.66.149 "..."`

## Pipeline

- **Directory:** `~/leadtrigger/`
- **Main script:** `process_campaign.py`
- **Config:** `config.py` (DATABASE_URL, XAI_API_KEY, SERPER_API_KEY, SUPABASE credentials)

### Launching Workers

```bash
# 10 workers × 20 companies each for search 1920001
for i in $(seq 1 10); do
  OFFSET=$(( (i-1) * 20 ))
  nohup python3 -u ~/leadtrigger/process_campaign.py \
    --search-id 1920001 \
    --offset $OFFSET --limit 20 \
    --force \
    > ~/leadtrigger/run_1920001_w$(printf '%02d' $i).log 2>&1 &
done
```

### Key Flags

| Flag | Description |
|------|-------------|
| `--force` | Re-run all 3 steps even if already scored |
| `--offset N` | Skip first N companies |
| `--limit N` | Process at most N companies |

### Fail-Loud Guard

The pipeline exits with code 2 if the search has `brainId IS NULL`. Always assign a Business Unit to the search before running.

### Checking Progress

```bash
# Count completed companies
grep -h "✓ Done" ~/leadtrigger/run_1920001_*.log 2>/dev/null | wc -l

# Check for errors
grep -h "ERROR\|Exception" ~/leadtrigger/run_1920001_*.log 2>/dev/null | tail -20
```

## Campaign Run History

| Search ID | Campaign Name | Brain ID | Brain Name | Workers | Status |
|-----------|--------------|----------|------------|---------|--------|
| 1830001 | Healthcare MedTech | 210013 | Connect Group Healthcare & MedTech ICP | 4 | ✅ Complete |
| 1860001 | Leadinfo Mai 11th | 210002 | Connect Group EMS Intelligence - General | 12 | ✅ Complete (re-run with correct brain after silent null-brain bug fix) |
| 1920001 | apollo-accounts-export | TBD | TBD | 10 | 🔄 Pilot |

## Known Issues & Fixes (May 2026)

1. **Silent null-brain scoring bug** — Pipeline previously ran fit scoring with empty ICP when `brainId IS NULL`. Fixed with fail-loud guard (exit code 2) and `--force` re-score.
2. **Plain-text `icpIndustries` field** — Brain 210002 stores `icpIndustries` as comma-separated text, not JSON array. Fixed with `safe_parse_list()` helper in `process_campaign.py`.
3. **Python output buffering** — Use `-u` flag (`python3 -u`) with nohup to get real-time log output.
