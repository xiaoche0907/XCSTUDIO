/**
 * 本地关键词预路由
 * 不依赖API，0延迟，作为API路由的降级方案
 * 当Gemini API不可用时，仍能将用户请求路由到正确的智能体
 */

import { AgentType } from '../../types/agent.types';
import { detectOptimizeOnlyIntent } from './prompt-optimizer/intent';

interface RouteRule {
  keywords: string[];
  agent: AgentType;
  priority: number; // 数字越小优先级越高
}

const ROUTE_RULES: RouteRule[] = [
  // 品牌VI - 最高优先级
  { keywords: ['logo', 'vi', '品牌', '标志', '商标', 'brand', '视觉识别', '品牌手册', '色彩系统'], agent: 'vireo', priority: 1 },
  // 故事板
  { keywords: ['故事板', '分镜', '九宫格', '分镜图', 'storyboard', '脚本', '剧本', '镜头', 'shot list', '场景设计'], agent: 'cameron', priority: 2 },
  // 包装设计
  { keywords: ['包装', 'package', 'packaging', '礼盒', '瓶身', '标签', '盒子', '瓶子', '罐子', 'unboxing'], agent: 'package', priority: 3 },
  // 动效设计
  { keywords: ['动画', 'motion', '动效', 'gif', 'animation', '视频', 'video', '片头', '转场', 'vfx', '3d动画'], agent: 'motion', priority: 4 },
  // 营销活动 & 电商
  { keywords: ['营销', 'campaign', '推广', '电商', '亚马逊', 'amazon', '副图', 'listing', '主图', '详情图', 'shopify', '淘宝', '天猫', '小红书', '一套', '一组', '系列', '套图'], agent: 'campaign', priority: 5 },
  // 海报设计（更广泛的关键词覆盖）
  { keywords: ['海报', 'poster', 'banner', '宣传', '广告', '传单', '社交媒体', 'instagram', '朋友圈', '封面', '邀请函', '贺卡', '名片', '证书', '节日', '春节', '新年', '圣诞', '中秋'], agent: 'poster', priority: 6 },
  // 通用设计请求 — 兜底到 poster（优先级最低）
  { keywords: ['设计', '做', '生成', '画', '制作', '创作', '帮我', '图片', '图', '海报', '卡片', '素材', '风格', '请', '一张', '一个', '几张'], agent: 'poster', priority: 99 },
];

// 修改/编辑类关键词 — 这些请求不应走本地路由，应走 API 路由以获得更精确的意图分析
const EDIT_KEYWORDS = [
  '换成', '改成', '改为', '替换', '修改', '调整', '变成', '去掉', '删除', '移除',
  '加上', '添加', '放大', '缩小', '旋转', '翻转', '裁剪', '去背景', '换背景',
  '换颜色', '改颜色', '变色', '粉色', '红色', '蓝色', '绿色', '黑色', '白色',
  '不要', '去除', '抠图', '高清', '放大画质', 'upscale', 'remove', 'replace', 'change',
  'edit', 'modify', 'recolor'
];

/**
 * 检测是否为修改/编辑类请求
 */
export function isEditRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return EDIT_KEYWORDS.some(k => lower.includes(k));
}

/**
 * 本地关键词路由
 * 注意：修改/编辑类请求不走本地路由，返回 null 让 API 路由处理
 * @returns 匹配到的智能体类型，未匹配返回 null
 */
export function localPreRoute(message: string): AgentType | null {
  if (detectOptimizeOnlyIntent(message)) {
    return 'prompt-optimizer';
  }

  // 修改/编辑类请求需要更精确的意图分析，不走本地路由
  if (isEditRequest(message)) {
    return null;
  }

  // 闲聊类消息也不走本地路由
  if (isChatMessage(message)) {
    return null;
  }

  const lower = message.toLowerCase();

  // 复合意图检测（优先于通用关键词匹配）
  const hasVideoKeyword = /视频|video|动画|animation|片头|转场/.test(lower);
  const hasStoryboardKeyword = /分镜|故事板|九宫格|storyboard|镜头|shot list/.test(lower);
  const hasEcommerceKeyword = /电商|亚马逊|amazon|listing|副图|主图|详情图|shopify|淘宝|天猫/.test(lower);

  if (hasVideoKeyword && hasStoryboardKeyword) return 'cameron';
  if (hasVideoKeyword && hasEcommerceKeyword) return 'campaign';

  let bestMatch: { agent: AgentType; priority: number; matchCount: number } | null = null;

  for (const rule of ROUTE_RULES) {
    const matchCount = rule.keywords.filter(k => lower.includes(k)).length;
    if (matchCount > 0) {
      // 优先选择优先级高的（数字越小越高），同优先级再比匹配数量
      if (!bestMatch || rule.priority < bestMatch.priority ||
        (rule.priority === bestMatch.priority && matchCount > bestMatch.matchCount)) {
        bestMatch = { agent: rule.agent, priority: rule.priority, matchCount };
      }
    }
  }

  // 未匹配到任何规则时返回 null，让消息流入 LLM 路由做语义分析
  // poster fallback 仅在 Hook 层作为最终兜底
  return bestMatch?.agent || null;
}

/**
 * 检测是否为闲聊/问候类消息（不需要路由到设计智能体）
 */
export function isChatMessage(message: string): boolean {
  const chatPatterns = [
    /^(你好|hi|hello|hey|嗨|哈喽|早上好|下午好|晚上好|早安|晚安)/i,
    /^(谢谢|感谢|thanks|thank you|thx)/i,
    /^(再见|拜拜|bye|goodbye)/i,
    /^(好的|ok|okay|嗯|明白|了解|收到)/i,
    /^(你是谁|你叫什么|介绍一下|你能做什么|帮助|help)/i,
    /^(怎么用|如何使用|教我|指导)/i,
  ];
  return chatPatterns.some(p => p.test(message.trim()));
}

/**
 * 检测是否为模糊/不明确的请求
 */
export function isVagueRequest(message: string): boolean {
  const vaguePatterns = [
    /^(帮我|帮忙|我想|我要|我需要)(做|弄|搞|整)(个|一个|点)?(东西|什么|啥)?$/,
    /^(设计|做)(一下|下|个)?$/,
    /^(有什么|能做什么|可以做什么)/,
  ];
  return vaguePatterns.some(p => p.test(message.trim()));
}
