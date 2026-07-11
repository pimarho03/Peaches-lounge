<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:fable-foreman-rules -->
# Orchestration

For any multi-file or multi-stage task, use the fable-foreman skill.

## Seat routing policy

- **LEAD (the brain — planning, routing, verification):** Fable. This is the orchestrator seat that plans and reviews rather than swinging the hammer.
- **WORKHORSE (subagents — well-specified implementation, tests, refactors):** Sonnet.
- **More complex delegated tasks (ambiguous debugging, architecture-sensitive implementation):** route up to Opus instead of Sonnet.
- **Quota fallback:** when Fable is no longer on paid-plan access and has crossed into the token-usage (overage) section, switch the LEAD seat to Opus.
<!-- END:fable-foreman-rules -->
