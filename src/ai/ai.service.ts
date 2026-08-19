import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';

import {
  StateGraph,
  StateSchema,
  ReducedValue,
  MessagesValue,
  UntrackedValue,
  GraphNode,
  START,
  END,
} from '@langchain/langgraph';

const AgentState = new StateSchema({
  messages: MessagesValue,
});

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly llm: ChatOllama;
  private readonly graph: any;

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

    const app = this.buildGraph();

    const result = await app.invoke({ messages: ['hello'] });
    // await this.testAiConnection();

    this.logger.log(JSON.stringify(result, null, 2));
  }

  buildGraph() {
    const builder = new StateGraph(AgentState);

    const myNode: GraphNode<typeof AgentState> = async (state, config) => {
      // console.dir(state, { depth: null });
      const response = await this.llm.invoke(state.messages);
      return { messages: [response] };
    };

    return builder
      .addNode('myNode', myNode)
      .addEdge(START, 'myNode')
      .addEdge('myNode', END)
      .compile();
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
