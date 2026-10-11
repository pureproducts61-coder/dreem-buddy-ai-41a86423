# TIVO Blueprint Roadmap (progress notes)

Source of truth: final master blueprint (29 PARTs, 10 steps). Reuse/adapt, never rewrite.

## Done
- [x] Step 1 World Foundation — contracts, discovery, Control, world_* tables + RLS
- [x] Step 2 Controlled TDEF — tdef-execute function, server Control recheck, idempotency, interaction_executions
- [x] Step 3 foundation — Observation/Evidence contract (provenance, confidence, freshness, trust)
- [x] Step 4 foundation — Verification statuses (PASS/PARTIAL/FAILED/UNCERTAIN/BLOCKED/NOT_VERIFIABLE) + lifecycle stage
- [x] PART 14 Dynamic UI — safe declarative schema validator + DynamicUiRenderer (fail closed)

## Next
- [ ] Brain: inject 10-capability composition + `tivo-ui` schema rules into chat system prompt (server)
- [ ] Wire DynamicUiRenderer into ChatTab messages; approval events → Control/TDEF (no direct execution)
- [ ] Persist Evidence/Verification per execution (server-side) and show in chat
- [ ] Replace fake percentages with lifecycle stages
- [ ] Resources & Activity screens (listWorld), header menu unification
- [ ] Bounded recovery engine; more RuntimeProviders; authenticated E2E test of tdef-execute
