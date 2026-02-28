import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, Plus, X, ArrowUp, Paperclip, Lightbulb, Zap, Globe, Box, Sparkles,
    Image as ImageIcon, Check, Video, FileText, Banana, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAgentStore } from '../../../stores/agent.store';
import { ImageModel, VideoModel } from '../../../types';

const VIDEO_RATIOS = [
    { label: '16:9', value: '16:9', icon: 'rectangle-horizontal' },
    { label: '9:16', value: '9:16', icon: 'rectangle-vertical' },
    { label: '1:1', value: '1:1', icon: 'square' },
];

const MODEL_OPTIONS: Record<string, { id: string; name: string; desc: string; time: string }[]> = {
    image: [
        { id: 'NanoBanana2', name: 'Nano Banana 2', desc: '新款高性能图像生成模型', time: '~8s' },
        { id: 'Seedream5.0', name: 'Seedream 5.0', desc: '超强意图理解与构图', time: '~10s' },
        { id: 'Nano Banana Pro', name: 'Nano Banana Pro', desc: '高质量图像生成，细节丰富', time: '~20s' },
        { id: 'GPT Image 1.5', name: 'GPT Image 1.5', desc: '创意图像生成，风格多样', time: '~120s' },
        { id: 'Flux.2 Max', name: 'Flux.2 Max', desc: '快速图像生成，效率优先', time: '~10s' },
    ],
    video: [
        { id: 'Veo 3.1', name: 'Veo 3.1', desc: '高质量视频生成', time: '~60s' },
        { id: 'Veo 3.1 Fast', name: 'Veo 3.1 Fast', desc: '快速视频生成', time: '~30s' },
        { id: 'Kling 2.0', name: 'Kling 2.0', desc: '运动流畅的视频生成', time: '~45s' },
    ],
    '3d': [
        { id: 'Auto', name: 'Auto', desc: '自动选择最佳3D模型', time: '~30s' },
    ]
};

const getCECursorPos = (el: HTMLElement): number => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
};

const setCECursorPos = (el: HTMLElement, pos: number) => {
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let cur = 0;
    let node = walker.nextNode();
    while (node) {
        const len = (node.textContent || '').length;
        if (cur + len >= pos) {
            const range = document.createRange();
            range.setStart(node, pos - cur);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }
        cur += len;
        node = walker.nextNode();
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
};

interface InputAreaProps {
    creationMode: 'agent' | 'image' | 'video';
    setCreationMode: (mode: 'agent' | 'image' | 'video') => void;
    handleSend: (overridePrompt?: string, overrideAttachments?: File[], overrideWeb?: boolean, skillData?: any) => Promise<void>;
    handleModeSwitch: (mode: 'thinking' | 'fast') => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    selectedChipId: string | null;
    setSelectedChipId: (id: string | null) => void;
    hoveredChipId: string | null;
    setHoveredChipId: (id: string | null) => void;
    // New props from Workspace
    showModeSelector: boolean;
    setShowModeSelector: (v: boolean) => void;
    showModelPreference: boolean;
    setShowModelPreference: (v: boolean) => void;
    modelPreferenceTab: 'image' | 'video' | '3d';
    setModelPreferenceTab: (tab: 'image' | 'video' | '3d') => void;
    autoModelSelect: boolean;
    setAutoModelSelect: (v: boolean) => void;
    preferredImageModel: ImageModel;
    setPreferredImageModel: (v: ImageModel) => void;
    preferredVideoModel: VideoModel;
    setPreferredVideoModel: (v: VideoModel) => void;
    preferred3DModel: string;
    setPreferred3DModel: (v: string) => void;
    showRatioPicker: boolean;
    setShowRatioPicker: (v: boolean) => void;
    showModelPicker: boolean;
    setShowModelPicker: (v: boolean) => void;
    isInputFocused: boolean;
    setIsInputFocused: (v: boolean) => void;
    isDragOver: boolean;
    setIsDragOver: (v: boolean) => void;
    isVideoPanelHovered: boolean;
    setIsVideoPanelHovered: (v: boolean) => void;
    showVideoSettingsDropdown: boolean;
    setShowVideoSettingsDropdown: (v: boolean) => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
    creationMode, setCreationMode, handleSend, handleModeSwitch, fileInputRef,
    selectedChipId, setSelectedChipId, hoveredChipId, setHoveredChipId,
    showModeSelector, setShowModeSelector,
    showModelPreference, setShowModelPreference,
    modelPreferenceTab, setModelPreferenceTab,
    autoModelSelect, setAutoModelSelect,
    preferredImageModel, setPreferredImageModel,
    preferredVideoModel, setPreferredVideoModel,
    preferred3DModel, setPreferred3DModel,
    showRatioPicker, setShowRatioPicker,
    showModelPicker, setShowModelPicker,
    isInputFocused, setIsInputFocused,
    isDragOver, setIsDragOver,
    isVideoPanelHovered, setIsVideoPanelHovered,
    showVideoSettingsDropdown, setShowVideoSettingsDropdown,
}) => {
    const inputBlocks = useAgentStore(s => s.inputBlocks);
    const activeBlockId = useAgentStore(s => s.activeBlockId);
    const videoGenRatio = useAgentStore(s => s.videoGenRatio);
    const videoGenDuration = useAgentStore(s => s.videoGenDuration);
    const videoGenModel = useAgentStore(s => s.videoGenModel);
    const videoGenMode = useAgentStore(s => s.videoGenMode);
    const videoStartFrame = useAgentStore(s => s.videoStartFrame);
    const videoEndFrame = useAgentStore(s => s.videoEndFrame);
    const videoMultiRefs = useAgentStore(s => s.videoMultiRefs);
    const showVideoModelDropdown = useAgentStore(s => s.showVideoModelDropdown);
    const modelMode = useAgentStore(s => s.modelMode);
    const webEnabled = useAgentStore(s => s.webEnabled);

    const {
        setInputBlocks, removeInputBlock, insertInputFile,
        setActiveBlockId, setSelectionIndex,
        setVideoGenRatio, setVideoGenDuration, setVideoGenModel, setVideoGenMode,
        setVideoStartFrame, setVideoEndFrame, setVideoMultiRefs,
        setShowVideoModelDropdown, setWebEnabled, setIsAgentMode,
    } = useAgentStore(s => s.actions);

    const imageGenRatio = useAgentStore(s => s.imageGenRatio);
    const imageGenRes = useAgentStore(s => s.imageGenRes);
    const { setImageGenRatio, setImageGenRes } = useAgentStore(s => s.actions);

    return (
        <div className="px-2 pb-2 pt-0.5 z-20">
            <div
                className={`bg-white rounded-2xl border shadow-sm transition-all duration-200 relative group focus-within:shadow-md focus-within:border-gray-300 flex flex-col ${isDragOver ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/30' : 'border-gray-200'}`}
                onMouseEnter={() => setIsVideoPanelHovered(true)}
                onMouseLeave={() => setIsVideoPanelHovered(false)}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(false);
                    if (e.dataTransfer.files.length > 0) {
                        Array.from(e.dataTransfer.files).forEach(f => {
                            if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
                                insertInputFile(f);
                            }
                        });
                    }
                }}
            >
                {/* Drag overlay */}
                {isDragOver && (
                    <div className="absolute inset-0 z-30 rounded-[20px] bg-blue-50/80 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center gap-2">
                            <ImageIcon size={24} className="text-blue-500" />
                            <span className="text-sm font-medium text-blue-600">将文件拖拽至此处添加到对话</span>
                        </div>
                    </div>
                )}

                {/* Image Mode: Upload Area */}
                {creationMode === 'image' && (
                    <div className={`transition-all duration-300 overflow-hidden px-4 flex flex-col justify-end`} style={{ maxHeight: isVideoPanelHovered ? '80px' : '0px', opacity: isVideoPanelHovered ? 1 : 0, paddingTop: isVideoPanelHovered ? '16px' : '0px', paddingBottom: isVideoPanelHovered ? '8px' : '0px' }}>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-14 h-14 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition group/upload"
                        >
                            <Plus size={16} className="text-gray-400 group-hover/upload:text-blue-500 transition" />
                        </div>
                    </div>
                )}

                {/* Video Mode: Hover Expandable Frame Upload Area */}
                {creationMode === 'video' && (
                    <div
                        className="px-4 transition-all duration-300 overflow-hidden flex flex-col justify-end"
                        style={{
                            maxHeight: (isVideoPanelHovered || videoStartFrame || videoEndFrame || videoMultiRefs.length > 0) ? '100px' : '0px',
                            opacity: (isVideoPanelHovered || videoStartFrame || videoEndFrame || videoMultiRefs.length > 0) ? 1 : 0,
                            paddingTop: (isVideoPanelHovered || videoStartFrame || videoEndFrame || videoMultiRefs.length > 0) ? '16px' : '0px',
                            paddingBottom: (isVideoPanelHovered || videoStartFrame || videoEndFrame || videoMultiRefs.length > 0) ? '8px' : '0px',
                        }}
                    >
                        {videoGenMode === 'startEnd' ? (
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <label className={`w-14 h-14 border rounded-xl flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group/upload ${videoStartFrame ? 'border-gray-200 border-solid shadow-sm' : 'border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'}`}>
                                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files) setVideoStartFrame(e.target.files[0]); }} />
                                        {videoStartFrame ? (
                                            <img src={URL.createObjectURL(videoStartFrame)} className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <Plus size={16} className="text-gray-400 group-hover/upload:text-blue-500 transition" />
                                                <span className="text-[10px] text-gray-400 group-hover/upload:text-blue-500 mt-0.5">首帧</span>
                                            </>
                                        )}
                                    </label>
                                    {videoStartFrame && (
                                        <button onClick={(e) => { e.preventDefault(); setVideoStartFrame(null); }} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 hover:bg-gray-800 text-white rounded-full flex items-center justify-center z-10 shadow border border-white">
                                            <X size={10} />
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <label className={`w-14 h-14 border rounded-xl flex flex-col items-center justify-center cursor-pointer transition overflow-hidden group/upload ${videoEndFrame ? 'border-gray-200 border-solid shadow-sm' : 'border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'}`}>
                                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files) setVideoEndFrame(e.target.files[0]); }} />
                                        {videoEndFrame ? (
                                            <img src={URL.createObjectURL(videoEndFrame)} className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <Plus size={16} className="text-gray-400 group-hover/upload:text-blue-500 transition" />
                                                <span className="text-[10px] text-gray-400 group-hover/upload:text-blue-500 mt-0.5">尾帧</span>
                                            </>
                                        )}
                                    </label>
                                    {videoEndFrame && (
                                        <button onClick={(e) => { e.preventDefault(); setVideoEndFrame(null); }} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 hover:bg-gray-800 text-white rounded-full flex items-center justify-center z-10 shadow border border-white">
                                            <X size={10} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 overflow-x-auto scroller-hidden">
                                {videoMultiRefs.map((file, idx) => (
                                    <div key={idx} className="relative flex-shrink-0">
                                        <div className="w-14 h-14 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                                        </div>
                                        <button onClick={() => setVideoMultiRefs(useAgentStore.getState().videoMultiRefs.filter((_, i) => i !== idx))} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 hover:bg-gray-800 text-white rounded-full flex items-center justify-center z-10 shadow border border-white">
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                <label className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition flex-shrink-0 group">
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) setVideoMultiRefs([...useAgentStore.getState().videoMultiRefs, ...Array.from(e.target.files!)]); }} />
                                    <Plus size={16} className="group-hover:text-blue-500 transition" />
                                </label>
                            </div>
                        )}
                    </div>
                )}

                {/* Text Input Area - Lovart style: inline mixed chips + text */}
                <div className={`px-3 pt-2 pb-4 cursor-text transition-all`} onClick={(e) => {
                    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.input-flow-container') === e.currentTarget.querySelector('.input-flow-container')) {
                        const lastText = inputBlocks.filter(b => b.type === 'text').pop();
                        const targetId = lastText?.id || inputBlocks[inputBlocks.length - 1].id;
                        const el = document.getElementById(`input-block-${targetId}`);
                        el?.focus();
                    }
                }}>
                    <div className="input-flow-container flex flex-wrap items-center gap-1.5" style={{ minHeight: '28px', wordBreak: 'break-word', lineHeight: '28px' }}>
                        {inputBlocks.map((block) => {
                            if (block.type === 'file' && block.file) {
                                const file = block.file!;
                                const markerId = (file as any).markerId;
                                const isSelected = selectedChipId === block.id;
                                const isHovered = hoveredChipId === block.id;
                                const markerInfo = (file as any).markerInfo;

                                if (markerId) {
                                    return (
                                        <motion.div
                                            key={block.id}
                                            id={`marker-chip-${block.id}`}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className={`inline-flex items-center gap-1.5 rounded-lg pl-1 pr-2 cursor-default relative group select-none h-7 transition-all border ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                            onClick={(e) => { e.stopPropagation(); setSelectedChipId(isSelected ? null : block.id); }}
                                            onMouseEnter={() => setHoveredChipId(block.id)}
                                            onMouseLeave={() => setHoveredChipId(null)}
                                        >
                                            <div className="flex items-center">
                                                <div className="w-[22px] h-[22px] rounded-[4px] overflow-hidden border border-gray-200 flex-shrink-0">
                                                    <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="w-[14px] h-[14px] bg-[#3B82F6] rounded-full flex items-center justify-center text-white text-[7px] font-bold shadow-sm flex-shrink-0 border border-white -ml-2 z-10">
                                                    {markerId}
                                                </div>
                                            </div>
                                            <span className="text-[12px] text-gray-700 font-medium max-w-[80px] truncate ml-0.5">{(file as any).markerName || '区域'}</span>
                                            <ChevronDown size={14} className="text-gray-400" />
                                            <button onClick={(e) => { e.stopPropagation(); removeInputBlock(block.id); setSelectedChipId(null); }} className="absolute -top-1.5 -right-1.5 bg-gray-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm z-20 hover:bg-gray-700"><X size={8} /></button>

                                            {isHovered && markerInfo && ReactDOM.createPortal(
                                                <div className="fixed z-[9999] pointer-events-none" style={{
                                                    left: (document.getElementById(`marker-chip-${block.id}`)?.getBoundingClientRect().left || 0) + (document.getElementById(`marker-chip-${block.id}`)?.getBoundingClientRect().width || 0) / 2 - 80,
                                                    top: (document.getElementById(`marker-chip-${block.id}`)?.getBoundingClientRect().top || 0) - 172,
                                                    width: 160, height: 160
                                                }}>
                                                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full h-full bg-white rounded-2xl shadow-xl overflow-hidden relative border border-gray-200">
                                                        <motion.div className="absolute inset-0" initial={{ scale: 1 }} animate={{ scale: 2.5 }} style={{ transformOrigin: `${(markerInfo.x + markerInfo.width / 2) / markerInfo.imageWidth * 100}% ${(markerInfo.y + markerInfo.height / 2) / markerInfo.imageHeight * 100}%` }}>
                                                            <img src={markerInfo.fullImageUrl || URL.createObjectURL(file)} className="w-full h-full object-cover" />
                                                        </motion.div>
                                                    </motion.div>
                                                </div>,
                                                document.body
                                            )}
                                        </motion.div>
                                    );
                                } else {
                                    const isCanvasAuto = (file as any)._canvasAutoInsert;
                                    const chipLabel = isCanvasAuto ? `图片${inputBlocks.filter(b => b.type === 'file' && (b.file as any)?._canvasAutoInsert).indexOf(block) + 1}` : file.name.replace(/\.[^/.]+$/, '');
                                    return (
                                        <div key={block.id} className={`inline-flex items-center gap-1 rounded-lg pl-1 pr-1.5 select-none relative group h-7 cursor-default transition-all border shrink-0 ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' : isInputFocused ? 'bg-gray-100 border-gray-200' : 'bg-gray-50 border-gray-100'}`} onClick={(e) => { e.stopPropagation(); setSelectedChipId(isSelected ? null : block.id); }}>
                                            <div className="w-5 h-5 rounded-sm overflow-hidden flex-shrink-0">
                                                {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" /> : <FileText size={12} className="text-gray-500" />}
                                            </div>
                                            <span className="text-[11px] text-gray-600 font-medium max-w-[100px] truncate">{chipLabel}</span>
                                            <button onClick={(e) => { e.stopPropagation(); removeInputBlock(block.id); setSelectedChipId(null); }} className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-black/10 transition opacity-0 group-hover:opacity-100"><X size={10} /></button>
                                        </div>
                                    );
                                }
                            }

                            if (block.type === 'text') {
                                const textBlocks = inputBlocks.filter(b => b.type === 'text');
                                const isLastTextBlock = textBlocks[textBlocks.length - 1]?.id === block.id;
                                const placeholder = isLastTextBlock && textBlocks.length <= 1 ? (creationMode === 'agent' ? "请输入你的设计需求" : "今天我们要创作什么") : "";

                                return (
                                    <span
                                        key={block.id}
                                        id={`input-block-${block.id}`}
                                        contentEditable
                                        suppressContentEditableWarning
                                        className="ce-placeholder outline-none text-sm text-gray-800"
                                        data-placeholder={placeholder}
                                        style={{ display: 'block', lineHeight: '28px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', caretColor: '#111827', minWidth: '2px', flex: isLastTextBlock ? '1 1 auto' : '0 1 auto' }}
                                        ref={el => { if (el && document.activeElement !== el && el.textContent !== (block.text || '')) el.textContent = block.text || ''; }}
                                        onInput={(e) => setInputBlocks(useAgentStore.getState().inputBlocks.map(b => b.id === block.id ? { ...b, text: e.currentTarget.textContent || '' } : b))}
                                        onFocus={() => { setActiveBlockId(block.id); setIsInputFocused(true); }}
                                        onBlur={() => setIsInputFocused(false)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); return; }
                                            if (selectedChipId && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); removeInputBlock(selectedChipId); setSelectedChipId(null); }
                                        }}
                                    />
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>

                {/* Bottom Toolbar */}
                <div className="px-2 pb-2.5 pt-0 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        {creationMode === 'agent' && (
                            <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                                <Paperclip size={17} strokeWidth={1.8} />
                            </button>
                        )}

                        <div className="relative">
                            <button onClick={() => setShowModeSelector(!showModeSelector)} className="h-[30px] px-3.5 rounded-full flex items-center gap-1.5 text-[13px] font-medium transition-all bg-blue-50 text-[#3B82F6]">
                                {creationMode === 'agent' && <><Sparkles size={14} /> Agent</>}
                                {creationMode === 'image' && <><ImageIcon size={14} /> 图像</>}
                                {creationMode === 'video' && <><Video size={14} /> 视频</>}
                            </button>
                            {showModeSelector && (
                                <div className="absolute bottom-full left-0 mb-2 w-36 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50">
                                    <button onClick={() => { setCreationMode('agent'); setShowModeSelector(false); setIsAgentMode(true); }} className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-gray-50 transition">Agent</button>
                                    <button onClick={() => { setCreationMode('image'); setShowModeSelector(false); setIsAgentMode(false); }} className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-gray-50 transition">图像生成器</button>
                                    <button onClick={() => { setCreationMode('video'); setShowModeSelector(false); setIsAgentMode(false); }} className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-gray-50 transition">视频生成器</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                        {creationMode === 'image' && (
                            <div className="flex items-center gap-1.5">
                                <div className="relative">
                                    <button
                                        onClick={() => { setShowRatioPicker(!showRatioPicker); setShowModelPicker(false); }}
                                        className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-full transition whitespace-nowrap"
                                    >
                                        <span className="text-gray-400 font-normal">{imageGenRes} ·</span>
                                        <span>{imageGenRatio}</span>
                                        <ChevronDown size={11} className={`text-gray-400 transition-transform ${showRatioPicker ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showRatioPicker && (
                                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="px-2 py-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">分辨率</div>
                                            <div className="flex gap-1.5 mb-2 px-1">
                                                {['1K', '2K', '4K'].map(res => (
                                                    <button key={res} onClick={() => { setImageGenRes(res); }} className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition ${imageGenRes === res ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                                                        {res}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="px-2 py-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">比例</div>
                                            <div className="grid grid-cols-2 gap-1 px-1">
                                                {['1:1', '4:3', '3:4', '16:9', '9:16'].map(ratio => (
                                                    <button key={ratio} onClick={() => { setImageGenRatio(ratio); setShowRatioPicker(false); }} className={`py-1.5 text-[11px] font-medium rounded-lg transition ${imageGenRatio === ratio ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                                                        {ratio}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => { setShowModelPicker(!showModelPicker); setShowRatioPicker(false); }}
                                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
                                    >
                                        <Banana size={16} strokeWidth={2} />
                                    </button>
                                    {showModelPicker && (
                                        <div className="absolute bottom-full right-0 mb-2 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="px-2.5 py-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest border-b border-gray-50 mb-1">模型选择</div>
                                            {MODEL_OPTIONS.image.map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => { setPreferredImageModel(m.id as ImageModel); setShowModelPicker(false); setAutoModelSelect(false); }}
                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors ${preferredImageModel === m.id && !autoModelSelect ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                                                >
                                                    <div className="text-left">
                                                        <div>{m.name}</div>
                                                        <div className="text-[9px] font-normal text-gray-400 opacity-80">{m.desc}</div>
                                                    </div>
                                                    {preferredImageModel === m.id && !autoModelSelect && <Check size={12} />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleSend()}
                                    disabled={inputBlocks.every(b => (b.type === 'text' && !b.text) || (b.type === 'file' && !b.file))}
                                    className="h-8 pl-2.5 pr-2 rounded-full flex items-center gap-1.5 text-[13px] font-bold shadow-sm transition bg-[#E2E4E9] text-[#7E8391] hover:bg-gray-300 disabled:opacity-50"
                                >
                                    <Zap size={14} fill="currentColor" strokeWidth={0} /> 10
                                </button>
                            </div>
                        )}

                        {creationMode === 'agent' && (
                            <>
                                <div className="h-8 bg-gray-100 rounded-full flex items-center p-1 gap-1">
                                    <button onClick={() => handleModeSwitch('thinking')} className={`w-6 h-6 flex items-center justify-center rounded-full ${modelMode === 'thinking' ? 'bg-white shadow-sm' : 'text-gray-400'}`}><Lightbulb size={14} /></button>
                                    <button onClick={() => handleModeSwitch('fast')} className={`w-6 h-6 flex items-center justify-center rounded-full ${modelMode === 'fast' ? 'bg-white shadow-sm' : 'text-gray-400'}`}><Zap size={14} /></button>
                                </div>
                                <button onClick={() => setWebEnabled(!webEnabled)} className={`w-8 h-8 rounded-full flex items-center justify-center ${webEnabled ? 'text-blue-500' : 'text-gray-500'}`}><Globe size={16} /></button>
                                <div className="relative">
                                    <button onClick={() => setShowModelPreference(!showModelPreference)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500"><Box size={16} /></button>
                                    {showModelPreference && (
                                        <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-semibold">模型偏好</span>
                                                <div onClick={() => setAutoModelSelect(!autoModelSelect)} className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${autoModelSelect ? 'bg-black' : 'bg-gray-300'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoModelSelect ? 'translate-x-4' : 'translate-x-0.5'}`} /></div>
                                            </div>
                                            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-3">
                                                {['image', 'video', '3d'].map(tab => <button key={tab} onClick={() => setModelPreferenceTab(tab as any)} className={`flex-1 py-1.5 text-xs rounded-md ${modelPreferenceTab === tab ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{tab.toUpperCase()}</button>)}
                                            </div>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                {MODEL_OPTIONS[modelPreferenceTab].map(m => (
                                                    <div key={m.id} onClick={() => { if (modelPreferenceTab === 'image') setPreferredImageModel(m.id as ImageModel); else if (modelPreferenceTab === 'video') setPreferredVideoModel(m.id as VideoModel); else setPreferred3DModel(m.id); setAutoModelSelect(false); }} className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer hover:bg-gray-50 ${(!autoModelSelect && ((modelPreferenceTab === 'image' && preferredImageModel === m.id) || (modelPreferenceTab === 'video' && preferredVideoModel === m.id) || (modelPreferenceTab === '3d' && preferred3DModel === m.id))) ? 'bg-blue-50' : ''}`}>
                                                        <div className="text-sm font-medium">{m.name}</div>
                                                        {(!autoModelSelect && ((modelPreferenceTab === 'image' && preferredImageModel === m.id) || (modelPreferenceTab === 'video' && preferredVideoModel === m.id) || (modelPreferenceTab === '3d' && preferred3DModel === m.id))) && <Check size={14} className="text-blue-500" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => handleSend()} className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-500 text-white"><ArrowUp size={15} /></button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden file input for selecting files */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) {
                        Array.from(e.target.files).forEach((f: File) => {
                            insertInputFile(f);
                        });
                    }
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                }}
            />
        </div>
    );
};
