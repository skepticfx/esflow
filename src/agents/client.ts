import Anthropic from '@anthropic-ai/sdk';
import type { AgentConfig } from './types.js';

type ToolHandler = (input: unknown) => Promise<string> | string;

function assistantContentToMessageContent(
  content: Anthropic.Messages.ContentBlock[],
): Anthropic.Messages.ContentBlockParam[] {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      blocks.push({ type: 'text', text: block.text });
      continue;
    }

    if (block.type === 'tool_use') {
      blocks.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }

  return blocks;
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  const chunks: string[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      chunks.push(block.text);
    }
  }

  return chunks.join('\n').trim();
}

export class AgentClient {
  private readonly client: Anthropic;

  private readonly model: string;

  private readonly maxTokens: number;

  public constructor(config: AgentConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens ?? 1200;
  }

  public async chat(options: {
    system: string;
    messages: Anthropic.Messages.MessageParam[];
    tools?: Anthropic.Messages.Tool[];
    maxTokens?: number;
    toolHandlers?: Record<string, ToolHandler>;
  }): Promise<string> {
    const messages: Anthropic.Messages.MessageParam[] = [...options.messages];
    const maxTokens = options.maxTokens ?? this.maxTokens;

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system: options.system,
        messages,
        tools: options.tools,
      });

      const hasToolUse = response.content.some((block) => block.type === 'tool_use');
      if (!hasToolUse) {
        return extractText(response.content);
      }

      messages.push({
        role: 'assistant',
        content: assistantContentToMessageContent(response.content),
      });

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') {
          continue;
        }

        const handler = options.toolHandlers?.[block.name];
        if (handler === undefined) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            is_error: true,
            content: `No tool handler registered for: ${block.name}`,
          });
          continue;
        }

        try {
          const content = await Promise.resolve(handler(block.input));
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            is_error: true,
            content: message,
          });
        }
      }

      messages.push({
        role: 'user',
        content: toolResults,
      });
    }
  }
}
