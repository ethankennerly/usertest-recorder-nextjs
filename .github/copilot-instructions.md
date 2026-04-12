# Instructions for GitHub Copilot

- Always proceed in strict order, from first line to last line

## Research

- Always search for project that professionals agree uses a best practice
- Always cite the essential code in a pro solution
- Always cite missing QA steps to reproduce that would isolate the trigger

## Observability Driven Development (ODD) Steps

- Always use a verbose log config to enable a verbose log
- If verbose, always log to the Next.js server
- Never log or allocate garbage if not verbose
- Always log each major step of the logic with a unique message
- Always log sufficiently to reconstruct steps to reproduce a potential bug
- Never hypothesize a cause without a log that supports it
- Always add a log first, reproduce the bug, read the log
- Always disprove each hypothesis with log evidence before coding a fix
- Never skip: log first, test next, fix last

## Test Driven Development (TDD) Steps

- Always discover practical tests
- Always replace inaccurate tests
- Always test logic thoroughly
- Always minimize UI tests for simplicity
- Always output a descriptive message of a failed test first
- Always code test to pinpoint the failure cause to the exact one defective statement of code
- Always write the minimum code to pass tests
- Always repeat all of the above steps until git_hooks/pre-push has no warnings

## Model-View Controller (MVC) Architecture

- Always extract logic code to pure lib TypeScript files
- Pure lib TypeScript files have no React imports and no JSX
- Pure lib TypeScript files are easily unit-tested with Vitest
- Whenever code could go in hooks or lib, prefer lib
- Always extract minimal hooks to hooks TypeScript files
- Minimize lines of code in hooks by calling pure lib functions
- Always extract minimal UI to React components
- Never write logic in React components
- Always minimize React components to data visualization and input binding
- Never code branches or methods in React components

## Code Style

- Never write comments
- Always write lines <100 characters
- Always prefer one statement per line
- Always limit file <256 lines
- Always write Unix line endings (LF, not CRLF)

## Tech Spec Style

- Always apply code style rules to tech spec files
- Each line is a checklist item or a heading
- Checklist item is observable by a test or a user
- Blank line after heading
- Last line is blank

## Tools

- Always use MCP server and browser to verify integration
- Never use /tmp ; always use ./temp . /tmp cannot be auto-approved

## Acknowledge Instructions

- Always prepend 'ODD2:' to every chat response
- Always limit chat response to <512 characters