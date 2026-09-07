# Building the Celix slice locally

This slice is deliberately separate from the repository's Node/TypeScript checks.

Prerequisite: an Apache Celix development installation discoverable by CMake.

```sh
cmake -S runtime/celix -B runtime/celix/build
cmake --build runtime/celix/build
./runtime/celix/build/deploy/HornRulesContainer/HornRulesContainer
```

Inside the Celix shell:

```text
horn::rules
```

The expected inventory contains the four rule IDs declared in `STATUS.md`.

No GitHub Actions workflow is added for this runtime. Build/test automation belongs in the project's external CI path when the slice is ready for it.
