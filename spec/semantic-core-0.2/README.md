# HORN 0.2 draft bundle

This bundle contains the first executable specification pass:

- `SPEC.md` — semantic-core specification and invariants
- `grammar/horn.ebnf` — draft human-authored DSL grammar
- `schema/horn.schema.json` — canonical JSON IR schema
- `examples/cloning-terminology/cloning.golden.horn` — hand-authored golden fixture
- `examples/cloning-terminology/cloning.golden.json` — canonical IR for the same fixture

The cloning fixture is a clean-room semantic encoding based on Robert E. Horn's 2003 handbook example. It preserves argument structure, not page layout.

Validation performed:
- JSON syntax: PASS
- JSON Schema self-load: PASS
- Golden JSON validates against schema: PASS
