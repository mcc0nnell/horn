# Expected rule-fixture behavior

`rule-violations.horn.json` is intentionally synthetic and public-safe.

Under `horn-1998` the fixture should produce exactly one diagnostic:

- `horn.rules.1998.argument-reading-direction` warns that relation `r-evidence-focus` uses `supports` instead of the 1998 human-facing forward-reading label `supported by`.

`horn.rules.1998.focus-box` should be clean because the fixture explicitly marks node `focus` with `focus: true`.

Under `horn-2003` the fixture should produce exactly two diagnostics:

- `horn.rules.2003.claim-atomicity` warns on node `focus` because `because` marks a possible second argumentative move inside the box.
- `horn.rules.2003.focus-claim-formulation` warns on node `focus` because the focus label is question-shaped rather than a declarative answer.

The fixture is not intended to exercise the canonical Horn validator or mural geometry. It exists only to make the rule layer produce observable, deterministic output without reproducing Horn source material.
