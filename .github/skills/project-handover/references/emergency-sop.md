---
title: "Emergency Response SOP"
doc_id: "SOP-001"
version: "1.0"
last_updated: "2026-01-22"
owner: "@devops-lead"
tags: ["emergency", "sop", "incident", "rollback", "monitoring"]
audience: ["devops", "developer", "on-call"]
purpose: "Standard operating procedures for handling production incidents and emergencies."
---

# Emergency Response SOP

## Severity Levels

| Level | Description | Response Time | Examples                                   |
| ----- | ----------- | ------------- | ------------------------------------------ |
| SEV-1 | Critical    | < 15 min      | Complete outage, data breach               |
| SEV-2 | High        | < 1 hour      | Major feature broken, API failures         |
| SEV-3 | Medium      | < 4 hours     | Minor feature issues, degraded performance |
| SEV-4 | Low         | < 24 hours    | UI bugs, non-critical errors               |

## Incident Response Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. DETECT                                                   │
│     └── Monitor alerts / User reports / Error logs          │
│                           ↓                                  │
│  2. TRIAGE                                                   │
│     └── Assess severity / Assign owner / Notify stakeholders│
│                           ↓                                  │
│  3. CONTAIN                                                  │
│     └── Stop bleeding / Rollback if needed / Limit impact   │
│                           ↓                                  │
│  4. INVESTIGATE                                              │
│     └── Root cause analysis / Collect evidence / Debug      │
│                           ↓                                  │
│  5. RESOLVE                                                  │
│     └── Deploy fix / Verify resolution / Monitor stability  │
│                           ↓                                  │
│  6. POST-MORTEM                                              │
│     └── Document / Identify improvements / Update runbooks  │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Detection

### Monitoring Dashboards

| Platform     | Dashboard URL      | What to Check          |
| ------------ | ------------------ | ---------------------- |
| Containers   | Host / Prometheus  | Container status, logs |
| GitHub       | github.com/actions | CI/CD status           |
| API Provider | Provider dashboard | Usage, errors, limits  |

### Common Alerts

| Alert               | Likely Cause            | Initial Action             |
| ------------------- | ----------------------- | -------------------------- |
| 500 errors spike    | API failure, code bug   | Check logs, recent deploys |
| Slow response times | Rate limiting, overload | Check API quotas           |
| Build failures      | Dependency issue        | Review build logs          |
| Certificate errors  | SSL expiration          | Check certificates         |

## Step 2: Triage

### Quick Assessment Checklist

- [ ] What is affected? (All users, specific feature, specific provider)
- [ ] When did it start? (Correlate with deployments)
- [ ] Is it reproducible?
- [ ] What changed recently?

### Communication Template

```
🚨 INCIDENT NOTIFICATION

Status: [INVESTIGATING | IDENTIFIED | MONITORING | RESOLVED]
Severity: SEV-[1-4]
Started: [TIME]
Affected: [DESCRIPTION]
Impact: [USER IMPACT]
Current Action: [WHAT'S BEING DONE]
ETA: [ESTIMATE IF KNOWN]
```

## Step 3: Containment

### Rollback Procedures

#### Dashboard / Host Rollback

Use container rollback or start a previous image on the host. Prefer `docker-compose` for coordinated stack operations.

```bash
# Example: stop current stack and start previous image
docker-compose down
docker run -d --name aichat-rollback \
  -p 3000:3000 \
  --env-file .env \
  aichat:previous-tag

# Or redeploy with previous compose file or image tags
docker-compose pull
docker-compose up -d
```

#### Docker Rollback

```bash
# List running containers
docker ps

# Stop current container
docker stop aichat

# Start previous version
docker run -d --name aichat-rollback \
  -p 3000:3000 \
  --env-file .env \
  aichat:previous-tag

# Verify
curl http://localhost:3000
```

#### Git Revert

```bash
# Identify problematic commit
git log --oneline

# Revert last commit
git revert HEAD

# Push and deploy
git push origin main
```

### Feature Flag Disable

If issue is with specific provider:

```bash
# Temporarily disable provider
# Update environment variable
DISABLE_[PROVIDER]=1
```

## Step 4: Investigation

### Log Collection

#### Container / Host Logs

```bash
# View container logs (last hour)
docker logs aichat --tail 1000 --since 1h

# Follow logs
docker logs -f aichat

# Export logs
docker logs aichat > incident-logs.txt 2>&1
```

#### Docker Logs

```bash
# View logs
docker logs aichat --tail 1000 --since 1h

# Follow logs
docker logs -f aichat

# Export logs
docker logs aichat > incident-logs.txt 2>&1
```

### Common Investigation Commands

```bash
# Check recent commits
git log --oneline -10

# Diff with last working version
git diff HEAD~1

# Check dependency changes
git diff HEAD~1 package.json

# Check environment
env | grep -E "(API|KEY|URL)"
```

### API Provider Status

Check provider status pages:
- OpenAI: status.openai.com
- Anthropic: status.anthropic.com
- Google: status.cloud.google.com

## Step 5: Resolution

### Hotfix Deployment

```bash
# Create hotfix branch
git checkout -b hotfix/issue-description

# Apply fix
# ... make changes ...

# Commit
git commit -m "hotfix: fix critical issue"

# Push and deploy
git push origin hotfix/issue-description

# Create PR with expedited review
# Merge after approval
```

### Verification Checklist

- [ ] Fix deployed successfully
- [ ] Error rate returned to normal
- [ ] No new errors introduced
- [ ] Performance metrics stable
- [ ] User-reported issues resolved

## Step 6: Post-Mortem

### Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

**Date**: [DATE]
**Duration**: [START] - [END]
**Severity**: SEV-[X]
**Author**: [NAME]

## Summary
Brief description of what happened.

## Impact
- Users affected: [NUMBER/DESCRIPTION]
- Duration: [TIME]
- Revenue impact: [IF APPLICABLE]

## Timeline
| Time  | Event                 |
| ----- | --------------------- |
| HH:MM | Issue first detected  |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed          |
| HH:MM | Issue resolved        |

## Root Cause
Technical explanation of why this happened.

## Resolution
What was done to fix the issue.

## Action Items
| Action     | Owner     | Deadline |
| ---------- | --------- | -------- |
| [Action 1] | [@person] | [DATE]   |
| [Action 2] | [@person] | [DATE]   |

## Lessons Learned
- What went well
- What could be improved
- What was lucky

## Prevention
How to prevent this from happening again.
```

## Emergency Contacts

| Role         | Contact       | When to Escalate      |
| ------------ | ------------- | --------------------- |
| On-Call Dev  | @dev-oncall   | First responder       |
| Dev Lead     | @dev-lead     | SEV-1/2 escalation    |
| DevOps Lead  | @devops-lead  | Infrastructure issues |
| Project Lead | @project-lead | Business impact       |

## Quick Reference Cards

### SEV-1 Response (Critical)

```
1. ALERT: Notify team immediately
2. ASSESS: Determine blast radius
3. CONTAIN: Rollback if recent deploy
4. COMMUNICATE: Update status page
5. INVESTIGATE: Parallel debugging
6. RESOLVE: Deploy fix ASAP
7. REVIEW: Mandatory post-mortem
```

### Common Quick Fixes

| Symptom               | Quick Fix                                 |
| --------------------- | ----------------------------------------- |
| API 429 (Rate Limit)  | Switch to backup key, reduce requests     |
| API 401 (Auth Failed) | Check API key, regenerate if needed       |
| 500 Internal Error    | Rollback last deployment                  |
| Slow Performance      | Check API provider status                 |
| Build Failure         | Check dependencies, rollback package.json |

### Useful Commands Cheat Sheet

```bash
# Check Docker Compose stack status
docker-compose ps

# View error logs (container)
docker logs --since 30m aichat --tail 200

# Quick rollback / redeploy with previous image
docker-compose down && docker-compose up -d

# Check Docker health
docker ps && docker stats

# Database quick check
npx prisma studio

# Validate environment
node -e "console.log(process.env.OPENAI_API_KEY ? 'Key present' : 'Key missing')"
```

## Runbook Updates

After each incident:
1. Update this SOP if gaps found
2. Add new scenarios to quick reference
3. Document new failure modes
4. Update monitoring as needed
