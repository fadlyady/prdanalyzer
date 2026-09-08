# Agent Guidelines

## Code Generation & Terminal Output Rules

### 1. JSON Pretty-Printing
- When creating or modifying scripts that output JSON to the terminal (such as data decryption or callback processing scripts), always format and pretty-print the JSON output with indentation (e.g., using `json.Indent` or `json.MarshalIndent` with 2-space indentation).
- If JSON formatting fails (e.g., raw non-JSON string), gracefully fall back to displaying the raw output.

### 2. File Generation
- When adding pretty-printing or adjusting terminal output formatting, create a new separate file (e.g., `*pretty.go`) to preserve the original script and logic unless explicitly requested to overwrite.

### 3. Core Logic Integrity
- Do not alter the core cryptographic logic, algorithms, secret keys, or payload handling logic. Only adjust presentation, parsing, and console formatting.
