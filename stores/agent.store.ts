import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { AgentTask, AgentType } from '../types/agent.types';
import { ChatMessage, InputBlock } from '../types';

interface AgentState {
  // 智能体模式
  isAgentMode: boolean;
  
  // 当前任务
  currentTask: AgentTask | null;
  
  // 消息和输入
  messages: ChatMessage[];
  inputBlocks: InputBlock[];
  activeBlockId: string;
  selectionIndex: number | null;
  
  // 聊天状态
  isTyping: boolean;
  
  // 模型配置
  modelMode: 'thinking' | 'fast';
  webEnabled: boolean;
  imageModelEnabled: boolean;
  
  // 图像生成器配置
  imageGenRatio: string;
  imageGenRes: string;
  imageGenUpload: File | null;
  
  // 视频生成器配置
  videoGenRatio: string;
  videoGenDuration: string;
  videoStartFrame: File | null;
  videoEndFrame: File | null;
  
  // 文本编辑
  detectedTexts: string[];
  editedTexts: string[];
  isExtractingText: boolean;
  
  // 快捷编辑
  fastEditPrompt: string;
  
  // 擦除工具
  brushSize: number;
  upscaleMenuOpen: boolean;
  
  // Actions
  actions: {
    setIsAgentMode: (mode: boolean) => void;
    setAgentMode: (mode: boolean) => void;
    
    setCurrentTask: (task: AgentTask | null) => void;
    
    addMessage: (message: ChatMessage) => void;
    setMessages: (messages: ChatMessage[]) => void;
    clearMessages: () => void;
    
    setInputBlocks: (blocks: InputBlock[]) => void;
    addInputBlock: (block: InputBlock) => void;
    removeInputBlock: (id: string) => void;
    updateInputBlock: (id: string, updates: Partial<InputBlock>) => void;
    setActiveBlockId: (id: string) => void;
    setSelectionIndex: (index: number | null) => void;
    
    setIsTyping: (typing: boolean) => void;
    
    setModelMode: (mode: 'thinking' | 'fast') => void;
    setWebEnabled: (enabled: boolean) => void;
    setImageModelEnabled: (enabled: boolean) => void;
    
    setImageGenRatio: (ratio: string) => void;
    setImageGenRes: (res: string) => void;
    setImageGenUpload: (file: File | null) => void;
    
    setVideoGenRatio: (ratio: string) => void;
    setVideoGenDuration: (duration: string) => void;
    setVideoStartFrame: (file: File | null) => void;
    setVideoEndFrame: (file: File | null) => void;
    
    setDetectedTexts: (texts: string[]) => void;
    setEditedTexts: (texts: string[]) => void;
    setIsExtractingText: (extracting: boolean) => void;
    
    setFastEditPrompt: (prompt: string) => void;
    
    setBrushSize: (size: number) => void;
    setUpscaleMenuOpen: (open: boolean) => void;
    
    reset: () => void;
  };
}

const initialState = {
  isAgentMode: false,
  
  currentTask: null,
  
  messages: [],
  inputBlocks: [{ id: 'init', type: 'text' as const, text: '' }],
  activeBlockId: 'init',
  selectionIndex: null,
  
  isTyping: false,
  
  modelMode: 'fast' as const,
  webEnabled: true,
  imageModelEnabled: false,
  
  imageGenRatio: '1:1',
  imageGenRes: '1K',
  imageGenUpload: null,
  
  videoGenRatio: '16:9',
  videoGenDuration: '5s',
  videoStartFrame: null,
  videoEndFrame: null,
  
  detectedTexts: [],
  editedTexts: [],
  isExtractingText: false,
  
  fastEditPrompt: '',
  
  brushSize: 30,
  upscaleMenuOpen: false,
};

export const useAgentStore = create<AgentState>()(
  immer((set) => ({
    ...initialState,
    
    actions: {
      setIsAgentMode: (mode) => set({ isAgentMode: mode }),
      setAgentMode: (mode) => set({ isAgentMode: mode }),
      
      setCurrentTask: (task) => set({ currentTask: task }),
      
      addMessage: (message) => set((state) => {
        state.messages.push(message);
      }),
      
      setMessages: (messages) => set({ messages }),
      
      clearMessages: () => set({ messages: [], inputBlocks: [{ id: 'init', type: 'text', text: '' }] }),
      
      setInputBlocks: (blocks) => set({ inputBlocks: blocks }),
      
      addInputBlock: (block) => set((state) => {
        state.inputBlocks.push(block);
      }),
      
      removeInputBlock: (id) => set((state) => {
        const idx = state.inputBlocks.findIndex(b => b.id === id);
        if (idx === -1) return;
        
        const left = state.inputBlocks[idx - 1];
        const right = state.inputBlocks[idx + 1];
        
        if (left?.type === 'text' && right?.type === 'text') {
          left.text = (left.text || '') + (right.text || '');
          state.inputBlocks.splice(idx, 2);
        } else {
          state.inputBlocks.splice(idx, 1);
          if (state.inputBlocks.length === 0) {
            state.inputBlocks.push({ id: `text-${Date.now()}`, type: 'text', text: '' });
          }
        }
      }),
      
      updateInputBlock: (id, updates) => set((state) => {
        const block = state.inputBlocks.find(b => b.id === id);
        if (block) {
          Object.assign(block, updates);
        }
      }),
      
      setActiveBlockId: (id) => set({ activeBlockId: id }),
      setSelectionIndex: (index) => set({ selectionIndex: index }),
      
      setIsTyping: (typing) => set({ isTyping: typing }),
      
      setModelMode: (mode) => set({ modelMode: mode }),
      setWebEnabled: (enabled) => set({ webEnabled: enabled }),
      setImageModelEnabled: (enabled) => set({ imageModelEnabled: enabled }),
      
      setImageGenRatio: (ratio) => set({ imageGenRatio: ratio }),
      setImageGenRes: (res) => set({ imageGenRes: res }),
      setImageGenUpload: (file) => set({ imageGenUpload: file }),
      
      setVideoGenRatio: (ratio) => set({ videoGenRatio: ratio }),
      setVideoGenDuration: (duration) => set({ videoGenDuration: duration }),
      setVideoStartFrame: (file) => set({ videoStartFrame: file }),
      setVideoEndFrame: (file) => set({ videoEndFrame: file }),
      
      setDetectedTexts: (texts) => set({ detectedTexts: texts }),
      setEditedTexts: (texts) => set({ editedTexts: texts }),
      setIsExtractingText: (extracting) => set({ isExtractingText: extracting }),
      
      setFastEditPrompt: (prompt) => set({ fastEditPrompt: prompt }),
      
      setBrushSize: (size) => set({ brushSize: size }),
      setUpscaleMenuOpen: (open) => set({ upscaleMenuOpen: open }),
      
      reset: () => set(initialState),
    }
  }))
);
