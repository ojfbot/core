---
name: adr
description: Create, list, search, or update Architecture Decision Records. Triggers on "adr new", "adr list", "adr search", "adr accept", "adr supersede".
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
   - Update the index table in `decisions/README.md` when accepting

---

## `search <keyword>`

Grep `decisions/adr/` for the keyword (case-insensitive). Return matching ADR titles and the lines that matched, with file paths.

---

## `accept <XXXX>`

Read `decisions/adr/XXXX-*.md`. Change `Status: Proposed` to `Status: Accepted`. Confirm the update. Remind the user to update the index in `decisions/README.md`.

---

## `supersede <XXXX> <YYYY>`

Read `decisions/adr/XXXX-*.md`. Change its status line to `Status: Superseded-by: ADR-YYYY`. Output the updated status line. Remind the user to update `decisions/README.md`.

---

## Always remind

After any write operation:
> Remember the 3-places rule: if this ADR captures a corrected mistake, also update the relevant `knowledge/` file and `memory/MEMORY.md`.
