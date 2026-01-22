---
title: "Contribution Guide"
doc_id: "CONTRIB-001"
version: "1.0"
last_updated: "2026-01-22"
owner: "@dev-lead"
tags: ["contribution", "git", "workflow", "coding-standards", "pr"]
audience: ["new-developer", "contributor"]
purpose: "Guidelines for contributing code to the project, including Git workflow, coding standards, and PR process."
---

# Contribution Guide

## Getting Started

Before contributing, ensure:

1. [x] Local development environment is set up
2. [x] You've read the project architecture overview
3. [x] You understand the technology stack

## Git Workflow

### Branching Strategy

```
main (production)
  │
  ├── feature/description
  ├── fix/issue-number-description
  ├── hotfix/critical-fix
  └── docs/documentation-update
```

### Branch Naming Convention

| Type     | Pattern                     | Example                       |
| -------- | --------------------------- | ----------------------------- |
| Feature  | `feature/short-description` | `feature/add-claude-provider` |
| Bug Fix  | `fix/issue-description`     | `fix/123-chat-scroll-issue`   |
| Hotfix   | `hotfix/critical-fix`       | `hotfix/api-key-exposure`     |
| Docs     | `docs/what-updated`         | `docs/update-readme`          |
| Refactor | `refactor/area`             | `refactor/chat-component`     |

### Workflow Steps

```bash
# 1. Sync with upstream
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/your-feature

# 3. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 4. Push branch
git push origin feature/your-feature

# 5. Create Pull Request on GitHub
```

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | Description                         |
| ---------- | ----------------------------------- |
| `feat`     | New feature                         |
| `fix`      | Bug fix                             |
| `docs`     | Documentation only                  |
| `style`    | Code style (formatting, semicolons) |
| `refactor` | Code change without feature/fix     |
| `perf`     | Performance improvement             |
| `test`     | Adding tests                        |
| `chore`    | Build process, dependencies         |

### Examples

```bash
# Feature
feat(chat): add message reactions support

# Bug fix
fix(api): resolve rate limiting issue #123

# Documentation
docs(readme): update deployment instructions

# Multiple scopes
feat(chat,store): implement message threading
```

## Code Standards

### TypeScript Guidelines

```typescript
// ✅ Use explicit types
interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

// ✅ Use functional components
const ChatBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  return <div>{message.content}</div>;
};

// ✅ Prefer const assertions
const ROLES = ['user', 'assistant'] as const;

// ❌ Avoid any
function process(data: any) {} // Bad
function process(data: unknown) {} // Better
```

### React Best Practices

```typescript
// ✅ Use hooks appropriately
const [state, setState] = useState<State>(initialState);

// ✅ Memoize expensive computations
const processed = useMemo(() => expensiveOp(data), [data]);

// ✅ Use callbacks to prevent re-renders
const handleClick = useCallback(() => {
  // handler logic
}, [dependencies]);

// ✅ Extract components when JSX gets complex
// ❌ Don't nest component definitions
```

### File Organization

```
component/
├── ComponentName.tsx      # Main component
├── ComponentName.module.scss  # Styles
├── ComponentName.test.tsx # Tests (if applicable)
└── index.ts               # Exports
```

### Import Order

```typescript
// 1. React/Next
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/router';

// 2. Third-party libraries
import { useStore } from 'zustand';
import clsx from 'clsx';

// 3. Internal modules
import { useChatStore } from '@/store';
import { formatDate } from '@/utils';

// 4. Components
import { Button } from '@/components/button';

// 5. Types
import type { Message } from '@/types';

// 6. Styles
import styles from './Component.module.scss';
```

## Pull Request Process

### Before Creating PR

- [ ] Code follows style guidelines
- [ ] `yarn lint` passes
- [ ] `yarn build` succeeds
- [ ] Tests pass (if applicable)
- [ ] No console.log or debug code
- [ ] Sensitive data is not exposed

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing Done
- [ ] Unit tests
- [ ] Manual testing
- [ ] Tested on mobile

## Screenshots (if UI change)
[Add screenshots]

## Checklist
- [ ] Code follows project style
- [ ] Self-reviewed changes
- [ ] Added comments for complex code
- [ ] Updated documentation
```

### Review Process

1. Create PR with descriptive title
2. Fill out PR template completely
3. Request review from maintainers
4. Address feedback
5. Squash and merge after approval

### PR Title Format

```
<type>(<scope>): <description>

Examples:
feat(chat): add image upload support
fix(api): handle rate limit errors gracefully
docs: update contribution guide
```

## Testing

### Running Tests

```bash
# Run all tests
yarn test

# Run specific test file
yarn test chat.test.ts

# Watch mode
yarn test --watch

# Coverage report
yarn test --coverage
```

### Writing Tests

```typescript
import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';

describe('ChatMessage', () => {
  it('renders message content', () => {
    render(<ChatMessage content="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles user role correctly', () => {
    render(<ChatMessage role="user" content="Hi" />);
    expect(screen.getByTestId('user-message')).toBeInTheDocument();
  });
});
```

## Adding New AI Providers

### Step-by-Step Guide

1. **Create API Handler**
   ```typescript
   // app/api/[provider].ts
   export async function POST(req: Request) {
     // Implementation
   }
   ```

2. **Create Client Adapter**
   ```typescript
   // app/client/platforms/[provider].ts
   export class ProviderApi implements LLMApi {
     // Implementation
   }
   ```

3. **Update Constants**
   ```typescript
   // app/constant.ts
   export const ProviderModels = {
     // Model definitions
   };
   ```

4. **Add Configuration**
   ```typescript
   // app/store/access.ts
   // Add provider configuration
   ```

5. **Update Types**
   ```typescript
   // app/typing.ts
   // Add provider-specific types
   ```

## Common Contribution Areas

### Good First Issues

Look for issues labeled:
- `good-first-issue`
- `help-wanted`
- `documentation`

### Popular Contribution Types

| Area        | Description              |
| ----------- | ------------------------ |
| i18n        | Add/improve translations |
| Providers   | Add new AI providers     |
| UI/UX       | Improve interface        |
| Docs        | Update documentation     |
| Tests       | Add test coverage        |
| Performance | Optimize performance     |

## Communication

### Where to Ask Questions

| Channel            | Purpose                       |
| ------------------ | ----------------------------- |
| GitHub Issues      | Bug reports, feature requests |
| GitHub Discussions | General questions             |
| Discord            | Community chat                |
| PR Comments        | Code-specific questions       |

### Response Expectations

- Issues: 1-3 business days
- PRs: 3-5 business days
- Urgent fixes: Same day (tag maintainers)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help newcomers
- Follow project guidelines

See [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) for full details.

## Recognition

Contributors are recognized in:
- GitHub Contributors list
- Release notes for significant contributions
- README acknowledgments for major features
