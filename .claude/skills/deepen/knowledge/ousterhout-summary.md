# Ousterhout summary — depth, complexity, information hiding

One-page reminder of the model from John Ousterhout's *A Philosophy of Software Design*. The skill operates inside this model.

## The core idea: depth

A module's *depth* is the amount of functionality it provides relative to the complexity of its interface.

- **Deep module:** simple interface, rich implementation. Callers see a clean surface; the module hides hard work behind it.
- **Shallow module:** complex interface (or interface that exposes implementation details), thin implementation. Callers do most of the work themselves; the module is a passthrough.

Concrete example. Two ways to expose file reading:

```ts
// Shallow: surface mirrors implementation
export function openFile(path: string): FileHandle
export function readBytes(handle: FileHandle, n: number): Uint8Array
export function closeFile(handle: FileHandle): void
// Caller assembles: open, read, close, error-handle, retry — three exports for one task.

// Deep: surface is the task
export async function readFile(path: string): Promise<Uint8Array>
// Caller calls one function. Implementation handles open, read, close, retry, errors.
```

Same task; same underlying complexity. The deep version absorbs the complexity so callers don't have to.

## Two sources of complexity

Ousterhout names two:

1. **Dependencies.** A module's behavior depends on something elsewhere — a config, another module, a global. Callers must know about the dependency to use the module.
2. **Obscurity.** Information needed to use or understand the module isn't apparent. Magic numbers, undocumented assumptions, behavior that depends on call order.

Deep modules minimize both. They depend on as little as possible (small import surface) and they make their behavior obvious (good names, types, errors).

## Information hiding

The opposite of leaking implementation. A deep module *hides* its internals — the algorithm, the data structures, the protocol — behind an interface that only describes *what* the module does, not *how*.

- A `BeadStore` whose interface is `save(bead)`, `load(id)`, `search(query)` is deep. Callers don't see SQLite vs. file vs. Dolt.
- A `BeadStore` whose interface is `getDB()`, `getTable()`, `runQuery(sql)` is shallow. Callers see SQLite, write SQL, deal with connections.

Information hiding lets the implementation evolve without breaking callers. Shallow modules force callers to depend on the implementation.

## Strategic vs. tactical programming

Ousterhout's framing:
- **Tactical:** the work in front of you. Just make this feature work.
- **Strategic:** the long-term shape of the system. Each change leaves the codebase a bit cleaner than you found it.

Pure tactical programming is fast in the short term, accumulates entropy fast. Pure strategic programming is slow and never ships. The right ratio is roughly 80/20: 80% tactical execution, 20% strategic improvement carved out of every meaningful change.

`/deepen` is the explicit space for the 20%. Run it after a feature lands, not while one is in flight.

## The "different" test

When you read a piece of code you wrote a month ago and it surprises you, the surprise is information that was hidden from your past self. That's a shallow-design smell — the code should have been deep enough that the future-you didn't need surprise.

The same test applies to teams: when a colleague reads your code, do they need to ask you what it does, or does the code answer that question itself?

## Generality where it pays

Two flavors of generality:
- **Cheap generality:** picking names, structures, types that don't lock in current use cases. "use a string for the file path, not a hardcoded literal." Always do this.
- **Expensive generality:** designing for use cases that don't exist yet. "this could one day be polymorphic over storage backends." Almost never do this. The actual use case is rarely the speculative one.

Default to deep modules for *current* use cases. Generalize only when the second use case is concrete.

## What `/deepen` does with this

- Identifies shallow modules via metrics (depth-metrics.md)
- Proposes consolidations that increase depth without expensive generality
- States cost (test impact, blast radius, migration risk) and benefit (cognitive load delta, caller ergonomics, testability) explicitly
- Routes accepted proposals to `/scaffold` for new structure and `/tdd` for the move
- Leaves the codebase a bit deeper after each invocation — the strategic 20%

## Further reading (if Claude has time)

- Ousterhout, *A Philosophy of Software Design*, chapters 4 (Modules Should Be Deep), 5 (Information Hiding), 9 (Better Together or Better Apart), 19 (Software Trends)
- Pocock's *Software Fundamentals Matter More Than Ever* talk: the framing this skill family adopts
