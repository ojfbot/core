# Auth Pattern Verification

Auth is the most critical class of correctness bugs. These checks go beyond the universal invariants.

## JWT / Session auth patterns

### Token validation (check for all patterns in use)

```typescript
// CORRECT: Validate token before trusting it
const payload = verifyJwt(token, process.env.JWT_SECRET)
if (!payload) return res.status(401).json({ error: 'Unauthorized' })

// WRONG: Decode without verification
const payload = jwt.decode(token)  // never verify = anyone can forge tokens
```

### Protected route guard

```typescript
// Every route that accesses user-specific data needs:
const user = await requireAuth(req)  // throws 401 if not authenticated
// not:
const user = req.user  // only safe if middleware guaranteed to have run
```

### Ownership check

```typescript
// CORRECT: Verify the authenticated user owns the resource
const resource = await db.findById(id)
if (resource.userId !== user.id) return res.status(403).json({ error: 'Forbidden' })

// WRONG: Trust the userId from the request body
const { userId } = req.body  // attacker can put any userId here
const resource = await db.findById(id)
```

## Common auth failures in this codebase

### Missing auth middleware on new routes

When adding a new route, the auth middleware must be applied explicitly or via route group:

```typescript
// Risk: forgetting to add auth to a new route
router.get('/api/new-endpoint', async (req, res) => {  // NO auth!
  const data = await getPrivateData(req.query.userId)  // exposed
})
```

### IDOR (Insecure Direct Object Reference)

Using a user-supplied ID without checking ownership:

```typescript
// Risk: user A can read user B's data by changing the ID
router.get('/api/notes/:id', requireAuth, async (req, res) => {
  const note = await db.notes.findById(req.params.id)  // missing ownership check
  return res.json(note)
})
```

### Auth in AI prompts

If the feature involves generating AI responses that include user data:
- Is the user's identity verified before fetching their data?
- Is the fetched data scoped to the authenticated user only?
- Can a user manipulate the prompt to access another user's context?

## LangGraph auth invariants

For LangGraph node graphs:
- Auth state must be in the `StateAnnotation` and propagated from the entry node
- No node should access user data without reading `state.userId` or `state.user`
- Tool-calling nodes must pass auth context to tool implementations

## Questions to answer for every auth-related change

1. Which routes/endpoints does this change affect?
2. Is each one guarded by auth middleware?
3. Does the handler verify ownership for every resource it touches?
4. Can an authenticated-but-wrong user reach data they shouldn't?
5. Is user input sanitized before it enters a query, prompt, or command?
