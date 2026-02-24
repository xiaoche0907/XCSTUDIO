/**
 * 增强型智能体编排器
 * 使用Skills统一处理智能体任务，降低耦合性，提高鲁棒性
 */

import { GoogleGenAI } from '@google/genai';
import { AgentRoutingDecision, ProjectContext, AgentType } from '../../types/agent.types';
import { COCO_SYSTEM_PROMPT } from './prompts/coco.prompt';
import { errorHandler, ErrorType } from '../../utils/error-handler';
import { executeSkill } from '../skills';
import { getApiKey, getClient } from '../gemini';
import { localPreRoute, isChatMessage } from './local-router';



/**
 * 路由配置
 */
interface RouteConfig {
    maxRetries: number;
    timeout: number;
    fallbackAgent: AgentType;
    confidenceThreshold: number;
}

const DEFAULT_CONFIG: RouteConfig = {
    maxRetries: 1,
    timeout: 8000,
    fallbackAgent: 'poster',
    confidenceThreshold: 0.6
};

/**
 * 增强的路由决策
 */
export interface EnhancedRoutingDecision extends AgentRoutingDecision {
    fallbackOptions?: AgentType[];
    estimatedDuration?: number;
    requiredSkills?: string[];
}

/**
 * 带完善错误处理的智能体路由
 */
export async function routeToAgent(
    message: string,
    context: ProjectContext,
    config: Partial<RouteConfig> = {}
): Promise<EnhancedRoutingDecision | null> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    try {
        // 输入验证
        if (!message || !message.trim()) {
            throw errorHandler.createError(
                ErrorType.VALIDATION,
                '消息不能为空',
                undefined,
                { message },
                false
            );
        }

        // 快速路径：本地关键词预路由（0延迟，不依赖API）
        const localAgent = localPreRoute(message);
        if (localAgent) {
            console.log('[EnhancedOrchestrator] Local pre-route hit:', localAgent);
            return {
                targetAgent: localAgent,
                taskType: 'local-routed',
                complexity: 'simple',
                handoffMessage: `用户请求: ${message}`,
                confidence: 0.75,
                fallbackOptions: [],
                estimatedDuration: 15,
                requiredSkills: ['generateImage']
            };
        }

        // 检查API密钥
        const apiKeyCheck = getApiKey();
        if (!apiKeyCheck || apiKeyCheck === 'PLACEHOLDER') {
            throw errorHandler.createError(
                ErrorType.API,
                'API密钥未配置，请在设置中配置',
                undefined,
                undefined,
                false
            );
        }

        console.log('[EnhancedOrchestrator] Routing message:', message.substring(0, 50));

        // 构建提示词
        const historyText = context.conversationHistory
            .slice(-5)
            .map(m => `${m.role}: ${m.text}`)
            .join('\n');

        const prompt = `${COCO_SYSTEM_PROMPT}

Current Project: ${context.projectTitle}
Brand Info: ${JSON.stringify(context.brandInfo || {})}
Conversation History:
${historyText}

User Message: ${message}

Analyze and route to appropriate agent. Return JSON with:
{
  "action": "route",
  "targetAgent": "<agent_id>",
  "taskType": "<task_type>",
  "complexity": "simple|complex",
  "handoffMessage": "<message>",
  "confidence": <0-1>,
  "fallbackOptions": ["<agent_id>", ...],
  "estimatedDuration": <seconds>,
  "requiredSkills": ["<skill_name>", ...]
}`;

        // 使用错误处理包装器进行API调用
        const result = await errorHandler.withRetry(
            async () => {
                const ai = getClient();
                const abortController = new AbortController();
                const timeoutId = setTimeout(() => abortController.abort(), finalConfig.timeout);

                try {
                    const response = await ai.models.generateContent({
                        model: 'gemini-3-flash-preview',
                        contents: { parts: [{ text: prompt }] },
                        config: {
                            temperature: 0.2,
                            responseMimeType: 'application/json',
                            abortSignal: abortController.signal
                        }
                    });
                    return response;
                } catch (error) {
                    if (abortController.signal.aborted) {
                        throw new Error('Request timeout');
                    }
                    throw error;
                } finally {
                    clearTimeout(timeoutId);
                }
            },
            {
                maxRetries: 1,
                delay: 1000,
                backoff: false,
                context: { message: message.substring(0, 100), function: 'routeToAgent' }
            }
        );

        console.log('[EnhancedOrchestrator] Response received');

        // 解析响应 — 安全提取 text 字段
        const responseText = result && typeof result === 'object' && 'text' in result
            ? String((result as any).text)
            : '';
        const parsed = JSON.parse(responseText || '{}');

        // 验证路由决策
        if (parsed.action !== 'route' || !parsed.targetAgent) {
            console.warn('[EnhancedOrchestrator] Invalid routing decision, using fallback');
            return createFallbackDecision(message, finalConfig.fallbackAgent);
        }

        // 检查置信度
        const confidence = parsed.confidence || 0;
        if (confidence < finalConfig.confidenceThreshold) {
            console.warn(
                `[EnhancedOrchestrator] Low confidence (${confidence}), adding fallbacks`
            );
            parsed.fallbackOptions = [finalConfig.fallbackAgent];
        }

        // 返回增强的路由决策
        return {
            targetAgent: (parsed.targetAgent || '').toLowerCase(),
            taskType: parsed.taskType || 'general',
            complexity: parsed.complexity || 'simple',
            handoffMessage: parsed.handoffMessage || '正在处理您的请求...',
            confidence: confidence,
            fallbackOptions: parsed.fallbackOptions || [],
            estimatedDuration: parsed.estimatedDuration || 30,
            requiredSkills: parsed.requiredSkills || []
        };
    } catch (error) {
        const appError = errorHandler.handleError(error, {
            function: 'routeToAgent',
            message: message.substring(0, 100)
        });

        console.error('[EnhancedOrchestrator] Routing failed:', appError.message);

        // 返回降级决策
        if (appError.retryable) {
            return createFallbackDecision(message, finalConfig.fallbackAgent);
        }

        return null;
    }
}

/**
 * 创建降级路由决策
 */
function createFallbackDecision(
    message: string,
    fallbackAgent: AgentType
): EnhancedRoutingDecision {
    return {
        targetAgent: fallbackAgent,
        taskType: 'general',
        complexity: 'simple',
        handoffMessage: '我将协助您处理这个请求',
        confidence: 0.5,
        fallbackOptions: [],
        estimatedDuration: 30,
        requiredSkills: []
    };
}

/**
 * 使用Skills执行智能体任务
 */
export async function executeAgentTaskWithSkills(
    agentId: AgentType,
    message: string,
    skills: string[],
    context: ProjectContext
): Promise<any> {
    try {
        const results: Record<string, any> = {};

        // 并行执行所有必需的技能
        const skillPromises = skills.map(async (skillName) => {
            try {
                const result = await executeSkill(skillName, {
                    message,
                    context,
                    agentId
                });
                return { skillName, result, success: true };
            } catch (error) {
                const appError = errorHandler.handleError(error, {
                    skill: skillName,
                    agent: agentId
                });
                return { skillName, error: appError.message, success: false };
            }
        });

        const skillResults = await Promise.all(skillPromises);

        // 汇总结果
        skillResults.forEach(({ skillName, result, error, success }) => {
            results[skillName] = success ? result : { error };
        });

        return results;
    } catch (error) {
        throw errorHandler.handleError(error, {
            function: 'executeAgentTaskWithSkills',
            agentId,
            skills
        });
    }
}

/**
 * 智能体协作执行
 */
export async function collaborativeExecution(
    primaryAgent: AgentType,
    fallbackAgents: AgentType[],
    message: string,
    context: ProjectContext
): Promise<any> {
    let lastError: any;

    // 尝试主智能体
    try {
        console.log(`[Collaboration] Trying primary agent: ${primaryAgent}`);
        // 这里应该调用实际的智能体执行逻辑
        // 为简化示例，暂时返回mock数据
        return { agent: primaryAgent, status: 'success' };
    } catch (error) {
        lastError = errorHandler.handleError(error, {
            agent: primaryAgent,
            role: 'primary'
        });
        console.warn(`[Collaboration] Primary agent failed:`, lastError.message);
    }

    // 尝试降级智能体
    for (const fallbackAgent of fallbackAgents) {
        try {
            console.log(`[Collaboration] Trying fallback agent: ${fallbackAgent}`);
            return { agent: fallbackAgent, status: 'success', fallback: true };
        } catch (error) {
            lastError = errorHandler.handleError(error, {
                agent: fallbackAgent,
                role: 'fallback'
            });
            console.warn(`[Collaboration] Fallback agent failed:`, lastError.message);
        }
    }

    // 所有智能体都失败
    throw errorHandler.createError(
        ErrorType.AGENT,
        '所有智能体执行失败，请稍后重试',
        lastError?.originalError,
        { primaryAgent, fallbackAgents },
        true
    );
}
