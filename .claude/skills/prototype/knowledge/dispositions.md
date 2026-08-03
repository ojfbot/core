Reference for `/prototype` Step 4: the two kept dispositions (deletion is the default).

- Kept in-tree as a marked reference — only on explicit user request, `// PROTOTYPE` markers intact.
- **Kept on a throwaway branch as a primary source** (`adr:pocock-lifecycle-absorption`, amending ADR-0083): when the prototype encodes a decision more precisely than prose can (a state machine, reducer, schema shape), commit it to a clearly-named branch off main (never merged) and leave a context pointer on the driving issue/ticket — this is the disposition wayfinder prototype tickets usually want, so the spec can later inline the decision-rich snippet with attribution.
