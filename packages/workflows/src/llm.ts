import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_MAX_TOKENS = 8192;

let _client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. " +
          "Copy .env.example to .env and add your key."
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function callClaude(
  system: string,
  user: string,
  opts: { maxTokens?: number; model?: string } = {}
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Unexpected response shape from Claude API");
  }
  return block.text;
}
