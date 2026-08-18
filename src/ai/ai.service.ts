import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly llm: ChatOllama;

  constructor() {
    // Connect to local Ollama
    this.llm = new ChatOllama({
      model: 'llama3.1', // Ensure this matches the model name in Ollama
      temperature: 0, // 0 for maximum predictability (important for agents)
      maxRetries: 2,
    });
  }

  // This hook will be called by NestJS automatically after module initialization
  async onModuleInit() {
    this.logger.log('🚀 Initializing AI Incident Orchestrator...');
    await this.testAiConnection();
  }

  private async testAiConnection() {
    this.logger.log('Sending test request to local Llama...');

    try {
      const response = await this.llm.invoke([
        {
          role: 'system',
          content:
            'You are an AI Incident Orchestrator. Your task is to assist engineers. Answer very briefly, maximum in one sentence.',
        },
        {
          role: 'user',
          content: 'Hi! Which database is best for vector search?',
        },
      ]);

      this.logger.log(`🤖 Llama response: ${response.content}`);
    } catch (error) {
      this.logger.error(
        '❌ Error connecting to LLM (check if Ollama is running)',
        error,
      );
    }
  }
}
