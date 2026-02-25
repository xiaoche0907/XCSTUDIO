import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, X, Check, Eye, EyeOff, Loader2, Link as LinkIcon } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

import { createPortal } from 'react-dom';

type ApiProvider = 'gemini' | 'yunwu' | 'custom';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [yunwuApiKey, setYunwuApiKey] = useState('');
    const [customApiKey, setCustomApiKey] = useState('');
    const [apiUrl, setApiUrl] = useState('');
    const [apiProvider, setApiProvider] = useState<ApiProvider>('gemini');
    const [replicateKey, setReplicateKey] = useState('');
    const [klingKey, setKlingKey] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

    useEffect(() => {
        if (isOpen) {
            const currentGeminiKey = localStorage.getItem('gemini_api_key') || localStorage.getItem('custom_api_key') || '';
            const currentYunwuKey = localStorage.getItem('yunwu_api_key') || localStorage.getItem('custom_api_key') || '';
            const currentCustomKey = localStorage.getItem('custom_api_key') || '';
            const currentUrl = localStorage.getItem('custom_api_url') || '';
            const currentProvider = (localStorage.getItem('api_provider') as ApiProvider) || 'gemini';
            setGeminiApiKey(currentGeminiKey);
            setYunwuApiKey(currentYunwuKey);
            setCustomApiKey(currentCustomKey);
            setApiUrl(currentUrl);
            setApiProvider(currentProvider);
            setReplicateKey(localStorage.getItem('replicate_api_key') || '');
            setKlingKey(localStorage.getItem('kling_api_key') || '');
            setSaveStatus('idle');
        }
    }, [isOpen]);

    const handleProviderChange = (provider: ApiProvider) => {
        setApiProvider(provider);
        // 自动设置对应的API URL
        if (provider === 'yunwu') {
            setApiUrl('https://yunwu.ai');
        } else if (provider === 'gemini') {
            setApiUrl('');
        }
        // custom 保持用户输入的URL
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            localStorage.setItem('gemini_api_key', geminiApiKey);
            localStorage.setItem('yunwu_api_key', yunwuApiKey);
            localStorage.setItem('custom_api_key', customApiKey);
            localStorage.setItem('api_provider', apiProvider);

            if (apiProvider === 'yunwu') {
                localStorage.setItem('custom_api_url', 'https://yunwu.ai');
            } else if (apiProvider === 'custom' && apiUrl.trim()) {
                localStorage.setItem('custom_api_url', apiUrl.trim());
            } else {
                localStorage.removeItem('custom_api_url');
            }

            // Save additional provider keys
            if (replicateKey.trim()) {
                localStorage.setItem('replicate_api_key', replicateKey.trim());
            } else {
                localStorage.removeItem('replicate_api_key');
            }
            if (klingKey.trim()) {
                localStorage.setItem('kling_api_key', klingKey.trim());
            } else {
                localStorage.removeItem('kling_api_key');
            }

            setIsSaving(false);
            setSaveStatus('success');
            setTimeout(() => {
                onClose();
            }, 800);
        }, 600);
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white pointer-events-auto w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                                        <Key size={20} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">API 配置</h2>
                                        <p className="text-xs text-gray-400">设置您的 Google Gemini API Key</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-4">
                                {/* API Provider Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 block">API 提供商</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleProviderChange('gemini')}
                                            className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${apiProvider === 'gemini'
                                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            Gemini 原生
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleProviderChange('yunwu')}
                                            className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${apiProvider === 'yunwu'
                                                ? 'bg-purple-50 border-purple-500 text-purple-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            云雾 API
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleProviderChange('custom')}
                                            className={`px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${apiProvider === 'custom'
                                                ? 'bg-green-50 border-green-500 text-green-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            自定义
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {apiProvider === 'gemini' && '使用 Google 官方 Gemini API（需要科学上网）'}
                                        {apiProvider === 'yunwu' && '使用云雾 API 服务（国内可直接访问）'}
                                        {apiProvider === 'custom' && '使用自定义代理服务器'}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 block">API Key</label>
                                    <div className="relative group">
                                        <input
                                            type={isVisible ? "text" : "password"}
                                            value={apiProvider === 'gemini' ? geminiApiKey : apiProvider === 'yunwu' ? yunwuApiKey : customApiKey}
                                            onChange={(e) => {
                                                if (apiProvider === 'gemini') setGeminiApiKey(e.target.value);
                                                else if (apiProvider === 'yunwu') setYunwuApiKey(e.target.value);
                                                else setCustomApiKey(e.target.value);
                                            }}
                                            placeholder="sk-..."
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all font-mono text-sm pr-10 hover:border-gray-300"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => setIsVisible(!isVisible)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition p-1"
                                        >
                                            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        我们需要这个密钥来调用 Gemini 模型。它将仅存储在您的本地浏览器中，绝不会发送到我们的服务器。
                                    </p>
                                </div>

                                {/* Only show URL input for custom provider */}
                                {apiProvider === 'custom' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 block flex items-center gap-2">
                                            自定义 API URL
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={apiUrl}
                                                onChange={(e) => setApiUrl(e.target.value)}
                                                placeholder="https://your-proxy.com"
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all font-mono text-sm pr-10 hover:border-gray-300"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">
                                                <LinkIcon size={16} />
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            请输入完整的基础 URL（例如：https://api.openai-proxy.com/google）。
                                        </p>
                                    </div>
                                )}

                                {/* Show provider info for yunwu */}
                                {apiProvider === 'yunwu' && (
                                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 bg-purple-500 text-white rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <LinkIcon size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-purple-900 mb-1">云雾 API 主站</h4>
                                                <p className="text-xs text-purple-700 font-mono mb-2 break-all">https://yunwu.ai</p>
                                                <p className="text-xs text-purple-600 leading-relaxed">
                                                    美国高防免费均衡选择，国内可直接访问
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Divider */}
                                <div className="border-t border-gray-100 pt-4">
                                    <h3 className="text-sm font-bold text-gray-700 mb-3">扩展模型（可选）</h3>
                                </div>

                                {/* Replicate API Key */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 block">Replicate API Key</label>
                                    <input
                                        type="password"
                                        value={replicateKey}
                                        onChange={(e) => setReplicateKey(e.target.value)}
                                        placeholder="r8_..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all font-mono text-sm hover:border-gray-300"
                                    />
                                    <p className="text-xs text-gray-400">用于 Flux Schnell、SDXL 等图像模型</p>
                                </div>

                                {/* Kling API Key */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 block">可灵 API Key</label>
                                    <input
                                        type="password"
                                        value={klingKey}
                                        onChange={(e) => setKlingKey(e.target.value)}
                                        placeholder="kling-..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all font-mono text-sm hover:border-gray-300"
                                    />
                                    <p className="text-xs text-gray-400">用于可灵 AI 视频生成</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={(apiProvider === 'gemini' && !geminiApiKey.trim()) || (apiProvider === 'yunwu' && !yunwuApiKey.trim()) || (apiProvider === 'custom' && !customApiKey.trim()) || isSaving}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all active:scale-95 ${saveStatus === 'success' ? 'bg-green-500 border-green-500' : 'bg-black hover:bg-gray-900 border-transparent'
                                        }`}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            <span>验证中...</span>
                                        </>
                                    ) : saveStatus === 'success' ? (
                                        <>
                                            <Check size={16} />
                                            <span>已保存</span>
                                        </>
                                    ) : (
                                        <span>保存配置</span>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
};
