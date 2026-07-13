import type { Company } from '../types';

export type AssistantLane = 'design' | 'compliance' | 'quote' | 'certification';
export type AssistantPlan = 'free' | 'pro';
export type CoachingLevel = 'concise' | 'balanced' | 'detailed';
export type CompetenceLevel = 'beginner' | 'intermediate' | 'expert';

export interface AssistantCitation {
  id: string;
  excerpt: string;
}

export interface AssistantAction {
  type: 'navigate' | 'draft_proposal' | 'switch_lane';
  label: string;
  path?: string;
  lane?: AssistantLane;
  quoteId?: string;
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  lane?: AssistantLane;
  citations?: AssistantCitation[];
  upgradeRequired?: boolean;
  interactionId?: string;
  feedback?: 'up' | 'down';
  imagePreview?: string;
  actions?: AssistantAction[];
  suggestedLane?: AssistantLane;
  createdAt: string;
}

export interface AssistantChatResponse {
  answer: string;
  lane: AssistantLane;
  subscriptionPlan: AssistantPlan;
  sessionId?: string;
  interactionId?: string;
  gated?: boolean;
  upgradeRequired?: boolean;
  limitReached?: boolean;
  citations?: AssistantCitation[];
  dailyRemaining?: number;
  actions?: AssistantAction[];
  suggestedLane?: AssistantLane;
  topic?: string;
  stage?: string;
  retrievalEmpty?: boolean;
  error?: string;
}

export interface AssistantProfile {
  coachingLevel: CoachingLevel;
  competenceLevel: CompetenceLevel;
  consentLogging: boolean;
}

export const LANE_LABELS: Record<AssistantLane, string> = {
  design: 'Design',
  compliance: 'Compliance',
  quote: 'Quote',
  certification: 'Certification',
};

export const LANE_COLORS: Record<AssistantLane, string> = {
  design: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  compliance: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  quote: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  certification: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

export interface QuestionBankEntry {
  id: string;
  question: string;
  answer: string;
  lane: AssistantLane;
  topic?: string;
  stage?: string;
  subscriptionPlan: AssistantPlan;
  feedback?: string;
  gated: boolean;
  createdAt: string;
}

export function resolveAssistantPlan(company: Company | null | undefined): AssistantPlan {
  if (!company) return 'free';
  const tier = company.subscriptionTier;
  const status = company.subscriptionStatus;
  if ((tier === 'professional' || tier === 'enterprise') && (status === 'active' || status === 'trial')) {
    return 'pro';
  }
  return 'free';
}
