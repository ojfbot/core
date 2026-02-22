/**
 * Applies a unified diff to original file content.
 * Supports standard unified diff format produced by `diff -u` or git.
 */
export function applyUnifiedDiff(original: string, unifiedDiff: string): string {
  const originalLines = original.split("\n");
  const diffLines = unifiedDiff.split("\n");

  // Parse hunks
  const hunks = parseHunks(diffLines);

  // Apply hunks in reverse order to preserve line numbers
  const result = [...originalLines];
  for (const hunk of [...hunks].reverse()) {
    applyHunk(result, hunk);
  }

  return result.join("\n");
}

type Hunk = {
  oldStart: number; // 1-based
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[]; // raw diff lines: ' ', '+', '-' prefixed
};

function parseHunks(diffLines: string[]): Hunk[] {
  const hunks: Hunk[] = [];
  let i = 0;

  // Skip file header lines (--- and +++)
  while (i < diffLines.length && !diffLines[i].startsWith("@@")) {
    i++;
  }

  while (i < diffLines.length) {
    const line = diffLines[i];
    if (!line.startsWith("@@")) {
      i++;
      continue;
    }

    // Parse @@ -oldStart,oldCount +newStart,newCount @@
    const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!match) {
      i++;
      continue;
    }

    const hunk: Hunk = {
      oldStart: parseInt(match[1], 10),
      oldCount: parseInt(match[2] ?? "1", 10),
      newStart: parseInt(match[3], 10),
      newCount: parseInt(match[4] ?? "1", 10),
      lines: [],
    };

    i++;
    while (i < diffLines.length && !diffLines[i].startsWith("@@")) {
      // Stop at next hunk header; skip "\ No newline at end of file"
      if (!diffLines[i].startsWith("\\")) {
        hunk.lines.push(diffLines[i]);
      }
      i++;
    }

    hunks.push(hunk);
  }

  return hunks;
}

function applyHunk(lines: string[], hunk: Hunk): void {
  // oldStart is 1-based; convert to 0-based index
  let pos = hunk.oldStart - 1;
  const removals: number[] = [];
  const insertions: Array<{ at: number; content: string }> = [];

  let oldOffset = 0;

  for (const line of hunk.lines) {
    const prefix = line[0];
    const content = line.slice(1);

    if (prefix === " ") {
      // Context line — advance
      oldOffset++;
    } else if (prefix === "-") {
      removals.push(pos + oldOffset);
      oldOffset++;
    } else if (prefix === "+") {
      insertions.push({ at: pos + oldOffset, content });
    }
  }

  // Remove lines (in reverse to keep indices stable)
  for (const idx of [...removals].reverse()) {
    lines.splice(idx, 1);
  }

  // Insert lines — adjust insertion points for removed lines
  let removed = 0;
  let insertIdx = 0;
  for (const removal of removals) {
    for (; insertIdx < insertions.length; insertIdx++) {
      if (insertions[insertIdx].at <= removal) {
        // insert before removal (already removed `removed` lines)
        lines.splice(insertions[insertIdx].at - removed, 0, insertions[insertIdx].content);
      } else {
        break;
      }
    }
    removed++;
  }
  // Remaining insertions after all removals
  for (; insertIdx < insertions.length; insertIdx++) {
    const adjustedAt = insertions[insertIdx].at - removals.length;
    lines.splice(Math.max(0, adjustedAt), 0, insertions[insertIdx].content);
  }
}
