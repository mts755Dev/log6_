export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type AssistantLane = 'design' | 'compliance' | 'quote' | 'certification';
export type AssistantPlan = 'free' | 'pro';
export type CoachingLevel = 'concise' | 'balanced' | 'detailed';
export type CompetenceLevel = 'beginner' | 'intermediate' | 'expert';
export type AssistantStage = 'pre_sale' | 'install' | 'commissioning' | 'certification' | 'general';

export interface AssistantAction {
  type: 'navigate' | 'draft_proposal' | 'switch_lane';
  label: string;
  path?: string;
  lane?: AssistantLane;
  quoteId?: string;
}

export interface CompanyRow {
  id: string;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  mcs_number?: string | null;
  consumer_code?: string | null;
  name?: string | null;
  is_umbrella_scheme?: boolean | null;
}

export interface AccountContext {
  companyName?: string;
  mcsNumber?: string;
  consumerCode?: string;
  isUmbrellaScheme?: boolean;
  quoteSummary?: string;
  jobsSummary?: string;
  designCatalogue?: string;
  roiDetail?: string;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Edge Functions read Supabase secrets — supports LLM_API_KEY, HELIOS_LLM_API_KEY, HELLIOS_LLM_API_KEY (.env typo). */
export function getLlmApiKey(): string | undefined {
  return (
    Deno.env.get('LLM_API_KEY') ??
    Deno.env.get('OPENROUTER_API_KEY') ??
    Deno.env.get('HELIOS_LLM_API_KEY') ??
    Deno.env.get('HELLIOS_LLM_API_KEY') ??
    undefined
  );
}

export function isOpenRouterProvider(): boolean {
  const provider = (Deno.env.get('LLM_PROVIDER') ?? '').toLowerCase();
  if (provider === 'openrouter') return true;
  const chatUrl = Deno.env.get('LLM_API_URL') ?? '';
  const embedUrl = Deno.env.get('LLM_EMBEDDING_URL') ?? '';
  return chatUrl.includes('openrouter.ai') || embedUrl.includes('openrouter.ai');
}

export function getLlmChatUrl(): string {
  if (Deno.env.get('LLM_API_URL')) return Deno.env.get('LLM_API_URL')!;
  if (isOpenRouterProvider()) return 'https://openrouter.ai/api/v1/chat/completions';
  return 'https://api.openai.com/v1/chat/completions';
}

export function getLlmEmbeddingUrl(): string {
  if (Deno.env.get('LLM_EMBEDDING_URL')) return Deno.env.get('LLM_EMBEDDING_URL')!;
  if (isOpenRouterProvider()) return 'https://openrouter.ai/api/v1/embeddings';
  return 'https://api.openai.com/v1/embeddings';
}

export function getLlmEmbeddingModel(): string {
  if (Deno.env.get('AI_EMBEDDING_MODEL')) return Deno.env.get('AI_EMBEDDING_MODEL')!;
  if (isOpenRouterProvider()) return 'openai/text-embedding-3-small';
  return 'text-embedding-3-small';
}

export function buildLlmHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (isOpenRouterProvider()) {
    headers['HTTP-Referer'] = Deno.env.get('OPENROUTER_HTTP_REFERER') ?? 'https://helios.local';
    headers['X-Title'] = Deno.env.get('OPENROUTER_APP_TITLE') ?? 'heliOS Assistant';
  }
  return headers;
}

export function resolveAssistantPlan(company: CompanyRow | null): AssistantPlan {
  if (!company) return 'free';
  const tier = company.subscription_tier ?? 'starter';
  const status = company.subscription_status ?? 'trial';
  if ((tier === 'professional' || tier === 'enterprise') && (status === 'active' || status === 'trial')) {
    return 'pro';
  }
  return 'free';
}

export function getDailyLimit(plan: AssistantPlan): number {
  const freeLimit = Number(Deno.env.get('AI_FREE_DAILY_LIMIT') ?? '15');
  const proLimit = Number(Deno.env.get('AI_PRO_DAILY_LIMIT') ?? '200');
  return plan === 'pro' ? proLimit : freeLimit;
}

export function getChatModel(plan: AssistantPlan, hasImage: boolean): string {
  if (hasImage) {
    return (
      Deno.env.get('AI_CHAT_MODEL_VISION') ??
      Deno.env.get('AI_CHAT_MODEL_PRO') ??
      Deno.env.get('AI_CHAT_MODEL_DEFAULT') ??
      'gpt-4o-mini'
    );
  }
  if (plan === 'pro') {
    return Deno.env.get('AI_CHAT_MODEL_PRO') ?? Deno.env.get('AI_CHAT_MODEL_DEFAULT') ?? 'gpt-4o';
  }
  return Deno.env.get('AI_CHAT_MODEL_FREE') ?? Deno.env.get('AI_CHAT_MODEL_DEFAULT') ?? 'gpt-4o-mini';
}

export function classifyLane(message: string, preferredLane?: string): AssistantLane {
  const allowed: AssistantLane[] = ['design', 'compliance', 'quote', 'certification'];
  if (preferredLane && allowed.includes(preferredLane as AssistantLane)) {
    return preferredLane as AssistantLane;
  }

  const text = message.toLowerCase();
  const scores: Record<AssistantLane, number> = { design: 0, compliance: 0, quote: 0, certification: 0 };
  const rules: Record<AssistantLane, string[]> = {
    design: ['size', 'sizing', 'battery', 'kwh', 'roi', 'solar', 'inverter', 'capacity', 'tariff', 'array', 'loft'],
    compliance: ['mcs', 'compliant', 'compliance', 'standard', 'record', 'mis', 'commissioning', 'checklist', 'cc18'],
    quote: ['quote', 'proposal', 'customer', 'sell', 'payback', 'price', 'margin', 'lead', 'draft'],
    certification: ['certified', 'certification', 'umbrella', 'qms', 'register', 'accreditation', 'mcs registered'],
  };

  for (const lane of allowed) {
    for (const keyword of rules[lane]) {
      if (text.includes(keyword)) scores[lane] += 1;
    }
  }

  const best = allowed.reduce((winner, lane) => (scores[lane] > scores[winner] ? lane : winner), 'design');
  return scores[best] > 0 ? best : 'design';
}

export function suggestCrossLane(lane: AssistantLane, message: string): AssistantLane | null {
  const text = message.toLowerCase();
  if (lane === 'design' && (text.includes('mcs') || text.includes('compliant') || text.includes('mis'))) {
    return 'compliance';
  }
  if (lane === 'quote' && (text.includes('size') || text.includes('battery') || text.includes('kwh'))) {
    return 'design';
  }
  if (lane === 'compliance' && (text.includes('certif') || text.includes('umbrella') || text.includes('qms'))) {
    return 'certification';
  }
  if (lane === 'certification' && (text.includes('commission') || text.includes('record'))) {
    return 'compliance';
  }
  if (lane === 'design' && (text.includes('proposal') || text.includes('sell'))) {
    return 'quote';
  }
  return null;
}

export function classifyTopic(message: string, lane: AssistantLane): string {
  const text = message.toLowerCase();
  const rules: [string, string[]][] = [
    ['sizing', ['size', 'sizing', 'kwh', 'capacity', 'array']],
    ['pricing', ['price', 'margin', 'cost', 'payback']],
    ['mcs', ['mcs', 'mis', 'cc18']],
    ['commissioning', ['commission', 'handover', 'test']],
    ['certification', ['certif', 'umbrella', 'qms', 'accreditation']],
    ['proposal', ['proposal', 'draft', 'headline']],
  ];
  for (const [topic, keywords] of rules) {
    if (keywords.some((k) => text.includes(k))) return topic;
  }
  return lane;
}

export function classifyStage(message: string, quoteStatus?: string | null): AssistantStage {
  const text = message.toLowerCase();
  if (text.includes('commission') || quoteStatus === 'commissioning') return 'commissioning';
  if (
    text.includes('install') ||
    quoteStatus === 'in_progress' ||
    quoteStatus === 'scheduled'
  )
    return 'install';
  if (text.includes('certif') || quoteStatus === 'mcs_certified') return 'certification';
  if (text.includes('quote') || text.includes('proposal') || quoteStatus === 'draft' || quoteStatus === 'sent') {
    return 'pre_sale';
  }
  return 'general';
}

export function isLaneGated(lane: AssistantLane, plan: AssistantPlan): boolean {
  if (plan === 'pro') return false;
  return lane === 'certification';
}

export function detectActions(
  message: string,
  lane: AssistantLane,
  plan: AssistantPlan,
  quoteId?: string
): AssistantAction[] {
  const text = message.toLowerCase();
  const actions: AssistantAction[] = [];

  if (lane === 'quote' && plan === 'pro' && (text.includes('draft') || text.includes('proposal') || text.includes('headline'))) {
    actions.push({
      type: 'draft_proposal',
      label: quoteId ? 'Open quote to edit proposal' : 'Start new quote',
      path: quoteId ? `/installer/quotes/${quoteId}/edit` : '/installer/quotes/new',
      quoteId,
    });
  }

  if (text.includes('new quote') || text.includes('create quote')) {
    actions.push({ type: 'navigate', label: 'Create new quote', path: '/installer/quotes/new' });
  }

  if (text.includes('commission') || text.includes('checklist') || text.includes('upload')) {
    actions.push({
      type: 'navigate',
      label: quoteId ? 'Open job commissioning' : 'View commissions',
      path: quoteId ? `/installer/quotes/${quoteId}` : '/installer/commissions',
      quoteId,
    });
  }

  if (text.includes('roi') || text.includes('calculator')) {
    actions.push({ type: 'navigate', label: 'New quote (ROI)', path: '/installer/quotes/new' });
  }

  if (text.includes('product') || text.includes('catalogue') || text.includes('battery list')) {
    actions.push({ type: 'navigate', label: 'Browse products', path: '/installer/products' });
  }

  const crossLane = suggestCrossLane(lane, message);
  if (crossLane) {
    actions.push({
      type: 'switch_lane',
      label: `Switch to ${crossLane} lane`,
      lane: crossLane,
    });
  }

  return actions;
}

export function formatAccountContext(ctx: AccountContext): string {
  const lines: string[] = [];
  if (ctx.companyName) lines.push(`Company: ${ctx.companyName}`);
  if (ctx.mcsNumber) lines.push(`MCS number: ${ctx.mcsNumber}`);
  if (ctx.consumerCode) lines.push(`Consumer code: ${ctx.consumerCode}`);
  if (ctx.isUmbrellaScheme) lines.push('Umbrella scheme: enabled');
  if (ctx.quoteSummary) lines.push(`Active quote:\n${ctx.quoteSummary}`);
  if (ctx.jobsSummary) lines.push(`Active jobs:\n${ctx.jobsSummary}`);
  if (ctx.designCatalogue) lines.push(`Product catalogue:\n${ctx.designCatalogue}`);
  if (ctx.roiDetail) lines.push(`ROI calculator data:\n${ctx.roiDetail}`);
  return lines.length ? lines.join('\n') : '(none)';
}

export function buildSystemPrompt(args: {
  plan: AssistantPlan;
  lane: AssistantLane;
  retrievedSources: string;
  accountContext: string;
  chatMemory: string;
  hasImage: boolean;
  coachingLevel: CoachingLevel;
  competenceLevel: CompetenceLevel;
  crossLaneSuggestion: AssistantLane | null;
}) {
  const coachingGuide: Record<CoachingLevel, string> = {
    concise: 'Keep answers very short — bullet points, max 3 sentences unless asked for detail.',
    balanced: 'Be practical and concise — 2-4 sentences first, then optional detail.',
    detailed: 'Give thorough step-by-step coaching with examples where helpful.',
  };

  const competenceGuide: Record<CompetenceLevel, string> = {
    beginner: 'User is newer to installs — explain terms, avoid jargon, give safe defaults.',
    intermediate: 'User knows basics — balance clarity with efficiency.',
    expert: 'User is experienced — be direct, technical, skip basics unless asked.',
  };

  const laneGuide: Record<AssistantLane, string> = {
    design: 'Use product catalogue and ROI thinking. Flag if sizing may affect MCS compliance.',
    compliance: 'Only cite retrieved sources for standards. Defer when sources are empty.',
    quote: 'Coach on payback, savings narrative, and customer objections. Offer proposal headline help.',
    certification: 'Route umbrella vs own MCS based on account context. No certification guarantees.',
  };

  const crossLaneNote = args.crossLaneSuggestion
    ? `Also suggest the user may want the ${args.crossLaneSuggestion} lane for related questions.`
    : '';

  return `You are the heliOS Assistant for UK solar and battery installers.
Current lane: ${args.lane}
Subscription plan: ${args.plan}
Coaching style: ${args.coachingLevel}
Installer competence: ${args.competenceLevel}
Image attached: ${args.hasImage ? 'yes — indicative checklist only, never sign off' : 'no'}

Lane focus: ${laneGuide[args.lane]}
${crossLaneNote}

Rules (non-negotiable):
- Never claim an install is compliant, will pass, or is certified.
- Never sign off work from a photo or description.
- Never give legal advice. Responsibility stays with the installer.
- For compliance standards claims, only use retrieved sources when provided.
- If retrieved sources are empty on compliance questions, say you cannot confirm from documentation.
- On Free plan, keep answers generic. On Pro, use account context below.
- ${coachingGuide[args.coachingLevel]}
- ${competenceGuide[args.competenceLevel]}

Account context (Pro only):
${args.accountContext || '(none)'}

Past conversation memory (semantic retrieval from this user's prior chats):
${args.chatMemory || '(none)'}
Use memory only for continuity (sizes, customer details, prior decisions). It is not compliance evidence.

Retrieved sources (compliance / QMS):
${args.retrievedSources || '(none)'}`;
}

export function chunkText(text: string, chunkSize = 900, overlap = 150): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const chunks: string[] = [];
  let index = 0;
  while (index < cleaned.length) {
    chunks.push(cleaned.slice(index, index + chunkSize));
    index += chunkSize - overlap;
  }
  return chunks;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = getLlmApiKey();
  const embeddingUrl = getLlmEmbeddingUrl();
  const embeddingModel = getLlmEmbeddingModel();
  if (!apiKey || texts.length === 0) return [];

  const response = await fetch(embeddingUrl, {
    method: 'POST',
    headers: buildLlmHeaders(apiKey),
    body: JSON.stringify({ model: embeddingModel, input: texts }),
  });

  if (!response.ok) return [];
  const data = await response.json();
  return (data?.data ?? []).map((item: { embedding: number[] }) => item.embedding);
}

export async function upsertPineconeVectors(
  namespace: string,
  vectors: { id: string; values: number[]; metadata: Record<string, unknown> }[]
): Promise<boolean> {
  const apiKey = Deno.env.get('PINECONE_API_KEY');
  const host = Deno.env.get('PINECONE_HOST');
  if (!apiKey || !host || vectors.length === 0) return false;

  const response = await fetch(`https://${host}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ namespace, vectors }),
  });

  return response.ok;
}

export async function deletePineconeByDocument(documentId: string, namespace: string): Promise<void> {
  const apiKey = Deno.env.get('PINECONE_API_KEY');
  const host = Deno.env.get('PINECONE_HOST');
  if (!apiKey || !host) return;

  await fetch(`https://${host}/vectors/delete`, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      namespace,
      filter: { document_id: { $eq: documentId } },
    }),
  });
}

export function buildConsumerCodeFilter(consumerCode?: string | null): Record<string, unknown> | undefined {
  if (!consumerCode) return undefined;
  return {
    $or: [
      { consumer_code: { $eq: consumerCode } },
      { consumer_code: { $eq: '' } },
      { category: { $eq: 'template' } },
    ],
  };
}

export async function queryPinecone(
  query: string,
  namespace = 'compliance',
  topK = 5,
  filter?: Record<string, unknown>
): Promise<{ id: string; text: string; namespace: string }[]> {
  const apiKey = Deno.env.get('PINECONE_API_KEY');
  const host = Deno.env.get('PINECONE_HOST');
  if (!apiKey || !host) return [];

  const embeddings = await embedTexts([query]);
  const vector = embeddings[0];
  if (!vector) return [];

  const body: Record<string, unknown> = { namespace, topK, includeMetadata: true, vector };
  if (filter) body.filter = filter;

  const queryRes = await fetch(`https://${host}/query`, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!queryRes.ok) return [];
  const queryData = await queryRes.json();
  return (queryData?.matches ?? []).map((match: { id: string; metadata?: Record<string, string> }) => ({
    id: match.id,
    text: String(match.metadata?.text_preview ?? match.metadata?.text ?? ''),
    namespace,
  }));
}

export async function queryPineconeMulti(
  query: string,
  namespaces: string[],
  topKPerNs = 3,
  consumerCode?: string | null
): Promise<{ id: string; text: string; namespace: string }[]> {
  const complianceFilter = buildConsumerCodeFilter(consumerCode);
  const seen = new Set<string>();
  const merged: { id: string; text: string; namespace: string }[] = [];

  for (const namespace of namespaces) {
    const filter = namespace.startsWith('qms-') ? undefined : complianceFilter;
    const matches = await queryPinecone(query, namespace, topKPerNs, filter);
    for (const match of matches) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      merged.push(match);
    }
  }

  return merged.slice(0, 8);
}

/** Per-user namespace for Phase 2 conversation memory in Pinecone. */
export function chatMemoryNamespace(userId: string): string {
  return `chat-user-${userId}`;
}

export function isPineconeConfigured(): boolean {
  return Boolean(Deno.env.get('PINECONE_API_KEY') && Deno.env.get('PINECONE_HOST'));
}

/** Retrieve semantically similar past Q&A for this user. */
export async function queryChatMemory(
  userId: string,
  query: string,
  topK = 4
): Promise<string> {
  if (!isPineconeConfigured()) return '(none)';

  const namespace = chatMemoryNamespace(userId);
  const matches = await queryPinecone(query, namespace, topK);
  if (!matches.length) return '(none)';

  return matches
    .map((m) => `- ${m.text}`)
    .join('\n');
}

/** Embed and upsert a completed interaction into the user's chat memory namespace. */
export async function indexChatInteraction(args: {
  userId: string;
  companyId: string | null;
  interactionId: string;
  sessionId: string | null;
  lane: AssistantLane;
  question: string;
  answer: string;
  quoteId?: string;
}): Promise<void> {
  if (!isPineconeConfigured()) return;

  const embedText = `Question: ${args.question}\nAnswer: ${args.answer.slice(0, 1500)}`;
  const embeddings = await embedTexts([embedText]);
  const vector = embeddings[0];
  if (!vector) return;

  const preview = `Q: ${args.question.slice(0, 220)}\nA: ${args.answer.slice(0, 500)}`;
  const namespace = chatMemoryNamespace(args.userId);

  await upsertPineconeVectors(namespace, [
    {
      id: args.interactionId,
      values: vector,
      metadata: {
        user_id: args.userId,
        company_id: args.companyId ?? '',
        session_id: args.sessionId ?? '',
        lane: args.lane,
        interaction_id: args.interactionId,
        quote_id: args.quoteId ?? '',
        question: args.question.slice(0, 500),
        answer: args.answer.slice(0, 1000),
        text_preview: preview.slice(0, 280),
        text: preview.slice(0, 2000),
        created_at: new Date().toISOString(),
      },
    },
  ]);
}

export async function extractTextFromUrl(fileUrl: string, mimeType?: string | null): Promise<string> {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to download document (${response.status})`);

  const contentType = mimeType || response.headers.get('content-type') || '';
  const buffer = new Uint8Array(await response.arrayBuffer());

  if (contentType.includes('text/') || fileUrl.endsWith('.txt') || fileUrl.endsWith('.md')) {
    return new TextDecoder().decode(buffer);
  }

  if (contentType.includes('pdf') || fileUrl.toLowerCase().includes('.pdf')) {
    try {
      const pdfParse = (await import('https://esm.sh/pdf-parse@1.1.1')).default;
      const parsed = await pdfParse(buffer);
      return String(parsed.text ?? '').trim();
    } catch {
      throw new Error('PDF text extraction failed');
    }
  }

  return new TextDecoder().decode(buffer).trim();
}

export async function callLlm(
  systemPrompt: string,
  userMessage: string,
  options?: { imageBase64?: string; imageMimeType?: string; plan?: AssistantPlan }
): Promise<string> {
  const apiKey = getLlmApiKey();
  const apiUrl = getLlmChatUrl();
  const hasImage = Boolean(options?.imageBase64);
  const plan = options?.plan ?? 'free';
  const model = getChatModel(plan, hasImage);

  if (!apiKey) return fallbackAnswer(userMessage, systemPrompt);

  const userContent: unknown = hasImage
    ? [
        { type: 'text', text: userMessage },
        {
          type: 'image_url',
          image_url: { url: `data:${options?.imageMimeType ?? 'image/jpeg'};base64,${options?.imageBase64}` },
        },
      ]
    : userMessage;

  const requestBody = JSON.stringify({
    model,
    temperature: plan === 'pro' ? 0.35 : 0.25,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: buildLlmHeaders(apiKey),
      body: requestBody,
    });

    if (response.ok) {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) break;
      return String(content).trim();
    }

    const errText = await response.text();
    console.error(`LLM request failed (attempt ${attempt + 1}):`, response.status, errText);

    if (response.status === 429 && attempt === 0) {
      let retryAfterMs = 20_000;
      try {
        const parsed = JSON.parse(errText);
        const seconds = parsed?.error?.metadata?.retry_after_seconds;
        if (typeof seconds === 'number' && seconds > 0 && seconds <= 60) {
          retryAfterMs = Math.ceil(seconds * 1000) + 500;
        }
      } catch {
        // use default wait
      }
      await sleep(retryAfterMs);
      continue;
    }

    break;
  }

  return `${fallbackAnswer(userMessage, systemPrompt)}\n\n_(Live AI is temporarily unavailable — rate limit or model error. Retry in a minute, or add credits on OpenRouter.)_`;
}

function fallbackAnswer(_userMessage: string, systemPrompt: string): string {
  const laneMatch = systemPrompt.match(/Current lane: (\w+)/);
  const lane = laneMatch?.[1] ?? 'design';
  const templates: Record<string, string> = {
    design: 'On the design side — start from the customer\'s daily usage and evening load, then size the battery to cover overnight use.',
    compliance: 'For compliance, keep a record pack per job: design, commissioning results, and customer handover.',
    quote: 'Quote mode — lead with payback and long-term savings, then match the system to their budget.',
    certification: 'For certification, you can trade under the umbrella scheme per job or work toward your own MCS certification.',
  };
  return `${templates[lane] ?? templates.design}\n\n(Configure LLM_API_KEY or HELIOS_LLM_API_KEY in Supabase Edge Function secrets.)`;
}
