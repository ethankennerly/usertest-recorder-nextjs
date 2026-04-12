# Instructions for GitHub Copilot

## Test Driven Development (TDD) Steps

Always proceed in strict order:

- Always research a pro solution
- Always cite missing QA steps to reproduce that would isolate the trigger
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

- Always prepend 'TDD1:' to every chat response
- Always limit chat response to <512 characters