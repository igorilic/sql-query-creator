# SQL Query Creator — Specification

## Overview

A web-based UI that helps developers generate SQL queries using a local LLM (via LM Studio). Users describe what they need in plain English, and the app generates syntactically correct SQL for their target database. The app connects to a live database to introspect schema, providing the LLM with full context for accurate query generation.

## Target Users

- Developers who know SQL but want to speed up query writing
- Primary use case: rapid query prototyping and generation

## Tech Stack

- **Frontend:** Next.js (React) with TypeScript
- **UI Components:** Catalyst UI Kit (Tailwind CSS) — used as a shared UI library (monorepo structure)
- **LLM Backend:** LM Studio (local, OpenAI-compatible API)
- **Supported Databases:** PostgreSQL, SQLite

## Architecture

### Monorepo Structure

```
sql-query-creator/
├── apps/
│   └── web/                  # Next.js application
├── packages/
│   └── ui/                   # Catalyst UI Kit (shared component library)
├── package.json              # Root workspace config
└── spec.md
```

### Key Components

1. **Connection Manager** — single active connection at a time
2. **Schema Browser** — sidebar/panel displaying tables, columns, and types
3. **Chat Interface** — natural language input with conversational follow-ups
4. **Query Editor** — editable SQL output with syntax highlighting
5. **LM Studio Integration** — communicates with the local LM Studio API

## Features

### 1. Database Connection

- User explicitly selects database type (PostgreSQL or SQLite) first
- Then provides connection credentials/path based on selected type
- One active connection at a time
- App introspects schema on successful connection (tables, columns, types, relationships)

### 2. Schema Browser

- Displayed in a sidebar or collapsible panel
- Shows all tables with their columns and data types
- Provides visual overview of the connected database
- Schema is sent as context to the LLM for accurate query generation

### 3. Natural Language Chat

- Primary input: plain English text field (e.g., "get all users who signed up last month")
- Conversational follow-ups supported (e.g., "now add a JOIN to the orders table")
- LLM refines the query based on conversation history
- Works without a database connection for generic SQL questions (e.g., "how do I query date ranges?")

### 4. Query Output

- Generated SQL displayed in an editable code editor with syntax highlighting
- Copy-to-clipboard functionality
- User can manually edit the generated query
- **Future scope:** direct query execution with results displayed in a table (design should accommodate this extension)

### 5. LM Studio Integration

- Connects to LM Studio's local OpenAI-compatible API (default: `http://localhost:1234/v1`)
- Uses whichever model is currently loaded in LM Studio
- No model selection in the app UI

### 6. Offline / No-Connection Mode

- App is usable without an active database connection
- Users can ask generic SQL questions and get example queries
- Schema context is simply omitted from LLM prompts in this mode

## UI Layout (High-Level)

```
┌─────────────────────────────────────────────────────┐
│  Header: Connection status, DB type, settings       │
├────────────┬────────────────────────────────────────-┤
│            │                                         │
│  Schema    │   Chat / Conversation Panel             │
│  Browser   │                                         │
│  (sidebar) │   - Message history                     │
│            │   - Natural language input               │
│            │                                         │
│  - Tables  ├─────────────────────────────────────────┤
│  - Columns │                                         │
│  - Types   │   Query Editor (editable, highlighted)  │
│            │   [Copy] button                         │
│            │                                         │
└────────────┴─────────────────────────────────────────┘
```

## Non-Goals (Current Scope)

- Query execution and result display (future extension)
- Query history / saved queries
- Multiple simultaneous database connections
- Model selection (delegated to LM Studio)
- Support for databases other than PostgreSQL and SQLite

## Future Considerations

- Query execution with tabular result display
- Query history and saved queries
- Additional database support (MySQL, MariaDB, etc.)
- Schema diff / migration suggestions
