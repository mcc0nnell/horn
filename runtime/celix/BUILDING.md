# Building the Celix slice locally

This slice is deliberately separate from the repository's Node/TypeScript checks.

Prerequisites:

- Apache Celix development installation discoverable by CMake
- RapidJSON headers discoverable by CMake

```sh
cmake -S runtime/celix -B runtime/celix/build
cmake --build runtime/celix/build
./runtime/celix/build/deploy/HornRulesContainer/HornRulesContainer
```

Inside the Celix shell:

```text
horn::rules
horn::analyze ../../../../maps/chinese-room-slice.horn.json --profile horn-1998
horn::analyze ../../../../maps/chinese-room-slice.horn.json --profile horn-2003
```

Adjust the map path if the container is launched from a different working directory.

The rule inventory should contain the four rule IDs declared in `STATUS.md`. Analysis must not change the input file.

No GitHub Actions workflow is added for this runtime. Build/test automation belongs in the project's external CI path when the slice is ready for it.
