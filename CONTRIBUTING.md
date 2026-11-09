# Contributing to Tidy Tint

Thanks for your interest in contributing! Bug reports, ideas and pull requests are all welcome.

## Reporting bugs and suggesting features

Open an [issue](../../issues/new/choose) using one of the templates. For bugs,
the most useful thing you can include is the relevant part of your
`settings.json` before and after running the command.

## Development setup

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install`
3. Open the folder in VS Code and press **F5** to launch an Extension
   Development Host with your local version of the extension.
4. Run the tests: `npm test`

## Project layout

| File | Purpose |
| --- | --- |
| `src/extension.ts` | Commands and activation |
| `src/settingsFile.ts` | Finds the right settings file and writes edits to it |
| `src/jsonEdit.ts` | Order-preserving JSONC edits (the core of the extension) |
| `src/palette.ts` | Which color keys are set, and how they're derived |
| `src/colors.ts` | Color helpers |
| `src/test/` | Tests (run with Node's built-in test runner) |

## The one rule

**Never rewrite whole objects in the user's settings file.** Every change must
go through `applyChanges` in `src/jsonEdit.ts`, one key at a time, so that key
order, comments and formatting are preserved. That is the whole point of this
extension. If you change `jsonEdit.ts`, please add a test.

## Pull requests

1. Create a branch from `main` in your fork.
2. Keep the PR focused on one change.
3. Make sure `npm test` passes. CI runs it on Windows, macOS and Linux.
4. For user-facing changes, add a line to `CHANGELOG.md` under "Unreleased".
5. Open the PR and fill in the template.

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).

## Code of Conduct

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
