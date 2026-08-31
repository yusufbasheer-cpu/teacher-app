# PPT Service Ownership

Date: 2026-08-31

`python-ppt-api` is a document-generation service, not an AI provider.

## Current Ownership Signals

- It renders PPT output.
- It has its own deployment config.
- It is separate from the Next.js app.

## Migration Implication

- Treat it as a backend/document-service boundary, not part of the AI facade.
- The AI facade should wrap DeepSeek, fal, and Pexels first; PPT rendering can remain a downstream document concern.

