import { useState, useCallback, useRef } from 'react';
import { AgentTask, ProjectContext } from '../types/agent.types';
import { routeToAgent, executeAgentTask } from '../services/agents';
import { ChatMessage } from '../types';

export function useAgentOrchestrator(projectContext: ProjectContext) {
  const [currentTask, setCurrentTask] = useState<AgentTask | null>(null);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const conversationHistory = useRef<ChatMessage[]>([]);
  const MAX_HISTORY = 50;

  const processMessage = useCallback(async (
    message: string,
    attachments?: File[],
    metadata?: Record<string, any>
  ): Promise<AgentTask | null> => {
    if (!isAgentMode || !message.trim()) return null;

    try {
      console.log('[useAgentOrchestrator] Processing message:', message.substring(0, 50));

      // Update context with current conversation
      const updatedContext = {
        ...projectContext,
        conversationHistory: conversationHistory.current
      };

      // Route to appropriate agent
      console.log('[useAgentOrchestrator] Routing to agent...');
      const decision = await routeToAgent(message, updatedContext);

      if (!decision) {
        console.error('[useAgentOrchestrator] No routing decision returned');
        return null;
      }

      console.log('[useAgentOrchestrator] Routed to:', decision.targetAgent);

      // Create task
      const task: AgentTask = {
        id: `task-${Date.now()}`,
        agentId: decision.targetAgent,
        status: 'pending',
        input: {
          message: decision.handoffMessage ? `${message}\n\n[System Directive]: ${decision.handoffMessage}` : message,
          attachments,
          context: updatedContext,
          metadata
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      setCurrentTask({ ...task, status: 'analyzing' });

      // Execute task
      console.log('[useAgentOrchestrator] Executing task...');
      const result = await executeAgentTask(task);
      console.log('[useAgentOrchestrator] Task result:', result.status);
      console.log('[useAgentOrchestrator] Task output:', result.output);
      console.log('[useAgentOrchestrator] Has proposals:', !!result.output?.proposals);
      if (result.output?.proposals) {
        console.log('[useAgentOrchestrator] Proposals count:', result.output.proposals.length);
        console.log('[useAgentOrchestrator] Proposals data:', JSON.stringify(result.output.proposals, null, 2));
      }
      setCurrentTask(result);

      // Update conversation history
      conversationHistory.current.push({
        id: `msg-${Date.now()}`,
        role: 'user',
        text: message,
        timestamp: Date.now()
      });

      if (result.output?.message) {
        conversationHistory.current.push({
          id: `msg-${Date.now() + 1}`,
          role: 'model',
          text: result.output.message,
          timestamp: Date.now()
        });
      }

      // Sliding window: keep only the most recent messages
      if (conversationHistory.current.length > MAX_HISTORY) {
        conversationHistory.current = conversationHistory.current.slice(-MAX_HISTORY);
      }

      return result;
    } catch (error) {
      console.error('[useAgentOrchestrator] Error:', error);
      setCurrentTask(null);
      return null;
    }
  }, [isAgentMode, projectContext]);

  const resetAgent = useCallback(() => {
    setCurrentTask(null);
    conversationHistory.current = [];
  }, []);

  return {
    currentTask,
    isAgentMode,
    setIsAgentMode,
    processMessage,
    resetAgent
  };
}
