---
name: adr
description: Create, list, search, update, or publish Architecture Decision Records. Triggers on "adr new", "adr list", "adr search", "adr accept", "adr supersede", "adr publish".
---

# /adr — Architecture Decision Records

Manage the `decisions/adr/` directory. ADRs are the written record of architectural decisions — the "why" layer that humans and commands can both reference.

Arguments: `$ARGUMENTS`

---

## Parse the arguments

Determine the subcommand from `$ARGUMENTS`:

- `new "<title>"` — create a new ADR stub
- `list` — list all ADRs with their current status
- `search <keyword>` — find ADRs matching a keyword
- `accept <XXXX>` — update ADR status to Accepted
- `supersede <XXXX> <YYYY>` — mark ADR-XXXX as superseded by ADR-YYYY
- `publish` — sync `decisions/README.md` index from ADR files on disk

If no subcommand is given, default to `list`.

---

## `list`

Read `decisions/README.md` and display the ADR index table. Then check `decisions/adr/` for any files not yet in the index and flag them as unregistered.

Output format:
```
ADR-0001  Accepted  Module Federation over iframes for shell composition
ADR-0002  Accepted  Single LLM gateway (frame-agent) for all sub-apps
...
```

---

## `new "<title>"`

1. Count existing ADR files in `decisions/adr/` to determine the next ID (zero-padded to 4 digits).
2. Generate the kebab-case filename from the title.
3. Copy `decisions/adr/template.md`, fill in the ID, title, and today's date. Set `Status: Proposed`.
4. Output the full path of the new file.
5. Remind the user to:
   - Fill in Context, Decision, Consequences, and Alternatives
   - Add the OKR reference
   - Run `/adr publish` to sync the README index when accepting

---

## `search <keyword>`

Grep `decisions/adr/` for the keyword (case-insensitive). Return matching ADR titles and the lines that matched, with file paths.

---

## `accept <XXXX>`

Read `decisions/adr/XXXX-*.md`. Change `Status: Proposed` to `Status: Accepted`. Confirm the update. Suggest running `/adr publish` to sync the README index.

---

## `supersede <XXXX> <YYYY>`

Read `decisions/adr/XXXX-*.md`. Change its status line to `Status: Superseded-by: ADR-YYYY`. Output the updated status line. Suggest running `/adr publish` to sync the README index.

---

## `publish`

Sync the `decisions/README.md` ADR index from the actual ADR files on disk.

### Step 1 — read all ADR files

Glob `decisions/adr/[0-9]*.md`. For each file, extract:
- **ID** — 4-digit number from the filename
- **Title** — from the `# ADR-XXXX: <title>` heading
- **Status** — from the `Status:` front-matter line
- **Date** — from the `Date:` front-matter line (use the year-month portion, e.g. `2026-02`)

### Step 2 — reconcile the README index table

If `decisions/README.md` does not exist, output an error and stop:
> `Error: decisions/README.md not found. Create it before running publish.`

Read `decisions/README.md`. Rebuild the `| ID | Title | Status | Date |` table rows from the ADR files:
- Add rows for any ADR not currently in the table
- Update `Status` and `Date` cells for any ADR whose values differ from the file

Write the updated `decisions/README.md` if any changes were made. Report what changed (added rows, updated statuses). If nothing changed, output: `Index is already up to date.`

---

## Always remind

After any write operation:
> Remember the 3-places rule: if this ADR captures a corrected mistake, also update the relevant `knowledge/` file and `memory/MEMORY.md`.
