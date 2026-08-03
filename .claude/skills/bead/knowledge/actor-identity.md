Reference for `/bead`: the durable-identity convention for the `actor` frontmatter field.

## A note on identity

The `actor` field in bead frontmatter is the addressable identity. Sessions are ephemeral; actors are durable. Use stable names: `chat-claude`, `code-claude`, `<human-username>`, or named agents from your wider system. This identity convention is what makes "the next session of code-claude" coherent across time.
