/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ChatOllama } from '@langchain/ollama';
import { tool } from '@langchain/core/tools';
import * as z from 'zod';

import {
  StateGraph,
  StateSchema,
  MessagesValue,
  GraphNode,
  START,
  END,
  ConditionalEdgeRouter,
} from '@langchain/langgraph';
import { AIMessage, ToolMessage } from '@langchain/core/messages';

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

    // const result = await app.invoke({ messages: ['hello, how are you?'] });
    // await this.testAiConnection();

    const result = await app.invoke({
      messages: [
        {
          role: 'system',
          content: [
            'You are a calculator agent.',
            '',
            'Rules:',
            '1. NEVER compute arithmetic yourself.',
            '2. The addNumbers tool takes exactly two numbers.',
            '3. For expressions with more than two operands, call the tool repeatedly.',
            '4. Feed the result of each call as the first argument of the next call.',
            '5. Report only what the tool returns.',
          ].join('\n'),
        },
        { role: 'user', content: 'what is 2 plus 6 plus 10' },
      ],
    });

    // const result = await app.invoke({ messages: ['what is 2 plus 6 plus 10'] });

    for (const message of result.messages) {
      console.log(`[${message.type}]: ${message.text}`);
    }

    // this.logger.log(JSON.stringify(result, null, 2));
  }

  buildGraph() {
    const builder = new StateGraph(AgentState);

    const addNumbers = tool(({ a, b }) => a + b, {
      name: 'addNumbers',
      description: 'Add two numbers',
      schema: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
      }),
    });

    const toolsByName = {
      [addNumbers.name]: addNumbers,
    };

    const llm = this.llm.bindTools([addNumbers]);

    // console.log('🔥✅🔥');
    // console.dir(llm, { depth: null });

    const toolNode: GraphNode<typeof AgentState> = async (state) => {
      const lastMessage = state.messages.at(-1);

      // console.log('lastMessage', lastMessage);

      if (lastMessage == null || !AIMessage.isInstance(lastMessage)) {
        return { messages: [] };
      }

      const result: ToolMessage[] = [];

      for (const toolCall of lastMessage.tool_calls ?? []) {
        const tool = toolsByName[toolCall.name];

        const observation = await tool.invoke(toolCall);
        console.log('toolCall', toolCall);
        console.log('observation', observation);
        result.push(observation);
      }

      return { messages: result };
    };

    const myNode: GraphNode<typeof AgentState> = async (state, config) => {
      // console.dir(state, { depth: null });
      const response = await llm.invoke(state.messages);

      console.log('💯response in MyNode', response);

      return { messages: [response] };
    };

    const shouldContinue: ConditionalEdgeRouter<{
      InputSchema: typeof AgentState;
      Nodes: 'toolNode';
    }> = (state) => {
      const lastMessage = state.messages.at(-1);

      // Check if it's an AIMessage before accessing tool_calls
      if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
        return END;
      }

      // If the LLM makes a tool call, then perform an action
      if (lastMessage.tool_calls?.length) {
        return 'toolNode';
      }

      // Otherwise, we stop (reply to the user)
      return END;
    };

    return builder
      .addNode('myNode', myNode)
      .addNode('toolNode', toolNode)
      .addEdge(START, 'myNode')
      .addConditionalEdges('myNode', shouldContinue, ['toolNode', END])
      .addEdge('toolNode', 'myNode')
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
