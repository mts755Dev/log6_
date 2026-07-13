import { supabase } from '../lib/supabase';
import type {
  AssistantChatMessage,
  AssistantChatResponse,
  AssistantLane,
  AssistantPlan,
  AssistantProfile,
  CoachingLevel,
  CompetenceLevel,
  QuestionBankEntry,
} from '../types/assistant';

export async function sendAssistantMessage(args: {
  message: string;
  sessionId?: string;
  lane?: AssistantLane;
  quoteId?: string;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<AssistantChatResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error('You must be logged in to use the assistant.');
  }

  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      message: args.message,
      sessionId: args.sessionId,
      lane: args.lane,
      quoteId: args.quoteId,
      imageBase64: args.imageBase64,
      imageMimeType: args.imageMimeType,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    const detail =
      (typeof data === 'object' && data && 'error' in data && String((data as { error?: string }).error)) ||
      error.message;
    throw new Error(detail || 'Assistant request failed');
  }
  if (data?.error) throw new Error(data.error);
  return data as AssistantChatResponse;
}

export async function submitAssistantFeedback(interactionId: string, feedback: 'up' | 'down') {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('assistant-feedback', {
    body: { interactionId, feedback },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function queueDocumentIndexing(documentId: string, namespace = 'compliance') {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('index-document', {
    body: { documentId, namespace },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function queueQmsDocumentIndexing(onboardingDocId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('index-qms-document', {
    body: { onboardingDocId },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getAssistantProfile(): Promise<AssistantProfile> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { data } = await supabase
    .from('assistant_profiles')
    .select('coaching_level, competence_level, consent_logging')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    coachingLevel: (data?.coaching_level as CoachingLevel) ?? 'balanced',
    competenceLevel: (data?.competence_level as CompetenceLevel) ?? 'intermediate',
    consentLogging: data?.consent_logging ?? true,
  };
}

export async function saveAssistantProfile(profile: Partial<AssistantProfile>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase.from('assistant_profiles').upsert(
    {
      user_id: userId,
      coaching_level: profile.coachingLevel,
      competence_level: profile.competenceLevel,
      consent_logging: profile.consentLogging ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}

export async function fetchSessionHistory(sessionId: string): Promise<AssistantChatMessage[]> {
  const { data, error } = await supabase
    .from('assistant_interactions')
    .select('id, lane, question, answer, retrieved_pinecone_ids, feedback, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const messages: AssistantChatMessage[] = [];
  for (const row of data ?? []) {
    messages.push({
      id: `hist-u-${row.id}`,
      role: 'user',
      content: row.question,
      lane: row.lane as AssistantLane,
      createdAt: row.created_at,
    });
    const citationIds = (row.retrieved_pinecone_ids as string[] | null) ?? [];
    messages.push({
      id: `hist-a-${row.id}`,
      role: 'assistant',
      content: row.answer,
      lane: row.lane as AssistantLane,
      interactionId: row.id,
      feedback: row.feedback === 'up' || row.feedback === 'down' ? row.feedback : undefined,
      citations: citationIds.map((id) => ({ id, excerpt: id })),
      createdAt: row.created_at,
    });
  }
  return messages;
}

export async function fetchQuestionBank(filters?: {
  lane?: AssistantLane | 'all';
  plan?: AssistantPlan | 'all';
  topic?: string;
  stage?: string;
  search?: string;
  limit?: number;
}): Promise<QuestionBankEntry[]> {
  let query = supabase
    .from('assistant_interactions')
    .select('id, lane, question, answer, topic, stage, subscription_plan, feedback, gated, created_at')
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 200);

  if (filters?.lane && filters.lane !== 'all') query = query.eq('lane', filters.lane);
  if (filters?.plan && filters.plan !== 'all') query = query.eq('subscription_plan', filters.plan);
  if (filters?.topic) query = query.eq('topic', filters.topic);
  if (filters?.stage) query = query.eq('stage', filters.stage);

  const { data, error } = await query;
  if (error) throw error;

  let rows = data ?? [];
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.question).toLowerCase().includes(term) ||
        String(r.answer).toLowerCase().includes(term)
    );
  }

  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    lane: row.lane as AssistantLane,
    topic: row.topic ?? undefined,
    stage: row.stage ?? undefined,
    subscriptionPlan: row.subscription_plan as AssistantPlan,
    feedback: row.feedback ?? undefined,
    gated: row.gated,
    createdAt: row.created_at,
  }));
}

export interface DocumentIndexStatus {
  documentId: string;
  status: 'pending' | 'indexed' | 'failed';
  vectorCount: number;
  lastIndexedAt?: string;
  errorMessage?: string;
  sourceType?: string;
}

export async function fetchDocumentIndexStatuses(): Promise<Record<string, DocumentIndexStatus>> {
  const { data, error } = await supabase.from('document_index_status').select('*');
  if (error) throw error;

  const map: Record<string, DocumentIndexStatus> = {};
  for (const row of data ?? []) {
    map[row.document_id] = {
      documentId: row.document_id,
      status: row.status,
      vectorCount: row.vector_count ?? 0,
      lastIndexedAt: row.last_indexed_at ?? undefined,
      errorMessage: row.error_message ?? undefined,
      sourceType: row.source_type ?? undefined,
    };
  }
  return map;
}

export interface AssistantAnalytics {
  totalInteractions: number;
  freeCount: number;
  proCount: number;
  byLane: Record<AssistantLane, number>;
  byTopic: Record<string, number>;
  topQuestions: { question: string; count: number }[];
  feedbackUp: number;
  feedbackDown: number;
  retrievalGaps: { question: string; lane: string; createdAt: string }[];
}

export async function fetchAssistantAnalytics(): Promise<AssistantAnalytics> {
  const { data, error } = await supabase
    .from('assistant_interactions')
    .select('lane, subscription_plan, question, feedback, topic, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  const byLane: Record<AssistantLane, number> = {
    design: 0,
    compliance: 0,
    quote: 0,
    certification: 0,
  };
  const byTopic: Record<string, number> = {};
  let freeCount = 0;
  let proCount = 0;
  let feedbackUp = 0;
  let feedbackDown = 0;
  const questionCounts = new Map<string, number>();
  const retrievalGaps: { question: string; lane: string; createdAt: string }[] = [];

  for (const row of data ?? []) {
    if (row.lane in byLane) byLane[row.lane as AssistantLane] += 1;
    if (row.subscription_plan === 'pro') proCount += 1;
    else freeCount += 1;
    if (row.feedback === 'up') feedbackUp += 1;
    if (row.feedback === 'down') feedbackDown += 1;
    if (row.topic) byTopic[row.topic] = (byTopic[row.topic] ?? 0) + 1;
    const q = String(row.question ?? '').trim().slice(0, 120);
    if (q) questionCounts.set(q, (questionCounts.get(q) ?? 0) + 1);
    const meta = row.metadata as { retrieval_empty?: boolean } | null;
    if (meta?.retrieval_empty) {
      retrievalGaps.push({
        question: q,
        lane: row.lane,
        createdAt: row.created_at,
      });
    }
  }

  const topQuestions = [...questionCounts.entries()]
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalInteractions: data?.length ?? 0,
    freeCount,
    proCount,
    byLane,
    byTopic,
    topQuestions,
    feedbackUp,
    feedbackDown,
    retrievalGaps: retrievalGaps.slice(0, 10),
  };
}
