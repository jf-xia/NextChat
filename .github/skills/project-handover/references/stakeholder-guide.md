---
title: "Stakeholder Guide"
doc_id: "STAKE-001"
version: "1.0"
last_updated: "2026-01-22"
owner: "@project-lead"
tags: ["stakeholder", "contacts", "team", "organization"]
audience: ["project-manager", "new-team-member"]
purpose: "Key contacts, team structure, and stakeholder information for project handover."
---

# Stakeholder Guide

## Team Structure

```
┌────────────────────────────────────────────────────────────┐
│                     Project Lead                            │
│                     @project-lead                           │
└───────────────────────────┬────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Dev Lead    │   │  DevOps Lead  │   │   Product     │
│   @dev-lead   │   │  @devops-lead │   │   @product    │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        ├── Frontend Team
        ├── Backend Team
        └── Mobile Team
```

## Key Contacts

### Core Team

| Role             | Contact       | Responsibilities                                  |
| ---------------- | ------------- | ------------------------------------------------- |
| Project Lead     | @project-lead | Overall project direction, stakeholder management |
| Development Lead | @dev-lead     | Technical decisions, code review, architecture    |
| DevOps Lead      | @devops-lead  | Deployment, infrastructure, CI/CD                 |
| Product Manager  | @product      | Requirements, roadmap, user feedback              |

### Extended Team

| Role     | Contact   | When to Engage             |
| -------- | --------- | -------------------------- |
| QA Lead  | @qa-lead  | Testing, quality assurance |
| Security | @security | Security concerns, audits  |
| Support  | @support  | User issues, escalations   |

## Communication Channels

### Primary Channels

| Channel            | Purpose                | Response Time |
| ------------------ | ---------------------- | ------------- |
| GitHub Issues      | Bug reports, features  | 1-3 days      |
| GitHub Discussions | Questions, ideas       | 1-3 days      |
| Discord            | Community chat         | Real-time     |
| Email              | Official communication | 1-2 days      |

### Emergency Channels

| Situation         | Channel                        | Escalation |
| ----------------- | ------------------------------ | ---------- |
| Production down   | @devops-lead + Discord #urgent | Immediate  |
| Security incident | @security + Email              | Immediate  |
| Critical bug      | @dev-lead + GitHub issue       | < 4 hours  |

## External Stakeholders

### Cloud / Hosting

| Provider / Hosting         | Account Owner | Support Contact  |
| -------------------------- | ------------- | ---------------- |
| Self-host (docker-compose) | @devops-lead  | Internal DevOps  |
| GitHub                     | @project-lead | GitHub Support   |
| API Providers              | @dev-lead     | Provider support |


## Decision Making

### Technical Decisions

| Decision Type        | Approver     | Process         |
| -------------------- | ------------ | --------------- |
| Architecture changes | @dev-lead    | RFC + Review    |
| New dependencies     | @dev-lead    | PR review       |
| Security changes     | @security    | Security review |
| Infrastructure       | @devops-lead | Change request  |

### Product Decisions

| Decision Type   | Approver      | Process          |
| --------------- | ------------- | ---------------- |
| New features    | @product      | PRD + Approval   |
| UI/UX changes   | @product      | Design review    |
| Roadmap updates | @project-lead | Planning meeting |

## RACI Matrix

| Activity            | Responsible  | Accountable  | Consulted    | Informed      |
| ------------------- | ------------ | ------------ | ------------ | ------------- |
| Feature development | Dev Team     | @dev-lead    | @product     | @project-lead |
| Deployment          | @devops-lead | @dev-lead    | Dev Team     | All           |
| Security patches    | @security    | @dev-lead    | @devops-lead | All           |
| Documentation       | Author       | @dev-lead    | Reviewers    | All           |
| Incident response   | On-call      | @devops-lead | @dev-lead    | @project-lead |

## Meeting Cadence

| Meeting             | Frequency | Participants     | Purpose             |
| ------------------- | --------- | ---------------- | ------------------- |
| Stand-up            | Daily     | Dev Team         | Status sync         |
| Sprint Planning     | Bi-weekly | All              | Sprint planning     |
| Architecture Review | Monthly   | Leads            | Technical decisions |
| Stakeholder Update  | Monthly   | All stakeholders | Status reporting    |

## Handover Contacts

For project handover questions:

| Topic                 | Contact       |
| --------------------- | ------------- |
| Technical questions   | @dev-lead     |
| Infrastructure/DevOps | @devops-lead  |
| Product/Requirements  | @product      |
| General handover      | @project-lead |

## Access Request Process

To request access to project resources:

1. Create access request ticket
2. Specify needed resources
3. Get manager approval
4. DevOps provisions access
5. Verify access works

### Access Levels

| Level      | Access                  | Approval     |
| ---------- | ----------------------- | ------------ |
| Read       | View code, docs         | Team lead    |
| Write      | Commit, merge           | Dev lead     |
| Admin      | Infrastructure, secrets | Project lead |
| Production | Deploy, operate         | DevOps lead  |

## Onboarding Checklist for New Members

### Day 1
- [ ] GitHub repository access
- [ ] Development environment setup
- [ ] Communication channels joined
- [ ] Meet with buddy/mentor

### Week 1
- [ ] Read project documentation
- [ ] Complete local setup
- [ ] Shadow team member
- [ ] First PR submitted

### Month 1
- [ ] Understand architecture
- [ ] Complete first feature
- [ ] Attend all regular meetings
- [ ] Meet all key stakeholders

## Offboarding Checklist

For departing team members:

- [ ] Knowledge transfer sessions
- [ ] Documentation updated
- [ ] Access revoked
- [ ] Handover documents created
- [ ] Exit interview completed
