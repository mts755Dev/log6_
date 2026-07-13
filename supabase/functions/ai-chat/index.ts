import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { qmsNamespace } from '../_shared/documentIndexing.ts';
import { formatQuoteRoiContext, estimateBatteryCapacityKwh } from '../_shared/roiContext.ts';
import {
  AccountContext,
  AssistantLane,
  CoachingLevel,
  CompetenceLevel,
  buildSystemPrompt,
  callLlm,
  classifyLane,
  classifyStage,
  classifyTopic,
  corsHeaders,
  detectActions,
  formatAccountContext,
  getDailyLimit,
  indexChatInteraction,
  isLaneGated,
  jsonResponse,
  queryChatMemory,
  queryPineconeMulti,
  resolveAssistantPlan,
  suggestCrossLane,
} from '../_shared/assistant.ts';

interface ChatPayload {
  message?: string;
  sessionId?: string;
  lane?: AssistantLane;
  quoteId?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization token' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const payload = (await req.json().catch(() => ({}))) as ChatPayload;
    const message = payload.message?.trim();
    if (!message) {
      return jsonResponse({ error: 'Message is required' }, 400);
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse({ error: 'Profile not found' }, 403);
    }

    let company = null;
    if (profile.company_id) {
      const { data } = await supabase
        .from('companies')
        .select('id, subscription_tier, subscription_status, mcs_number, consumer_code, name, is_umbrella_scheme')
        .eq('id', profile.company_id)
        .single();
      company = data;
    }

    const { data: assistantProfile } = await supabase
      .from('assistant_profiles')
      .select('coaching_level, competence_level, consent_logging')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    const coachingLevel = (assistantProfile?.coaching_level as CoachingLevel) ?? 'balanced';
    const competenceLevel = (assistantProfile?.competence_level as CompetenceLevel) ?? 'intermediate';
    const consentLogging = assistantProfile?.consent_logging !== false;
    const plan = resolveAssistantPlan(company);
    const lane = classifyLane(message, payload.lane);
    const gated = isLaneGated(lane, plan);
    const hasImage = Boolean(payload.imageBase64);
    const crossLaneSuggestion = suggestCrossLane(lane, message);
    const topic = classifyTopic(message, lane);
    const today = new Date().toISOString().slice(0, 10);

    if (hasImage && plan !== 'pro') {
      return jsonResponse({
        answer: 'Photo checks are a Pro feature. Upgrade to upload install photos for indicative checklist coaching.',
        lane,
        subscriptionPlan: plan,
        gated: true,
        upgradeRequired: true,
        citations: [],
        actions: [],
      });
    }

    let sessionId = payload.sessionId ?? null;
    let dailyCount = 0;

    const { data: existingSessions } = await supabase
      .from('assistant_sessions')
      .select('id, daily_message_count, reset_at')
      .eq('user_id', authData.user.id)
      .eq('reset_at', today)
      .limit(1);

    if (existingSessions && existingSessions.length > 0) {
      sessionId = existingSessions[0].id;
      dailyCount = existingSessions[0].daily_message_count ?? 0;
    } else {
      const { data: newSession, error: sessionError } = await supabase
        .from('assistant_sessions')
        .insert({
          user_id: authData.user.id,
          company_id: profile.company_id,
          subscription_plan: plan,
          daily_message_count: 0,
          reset_at: today,
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;
      sessionId = newSession.id;
    }

    const dailyLimit = getDailyLimit(plan);
    const actions = detectActions(message, lane, plan, payload.quoteId);

    if (dailyCount >= dailyLimit) {
      return jsonResponse({
        answer: `You've used today's ${plan === 'free' ? 'free ' : ''}messages (${dailyLimit}). Upgrade to Pro to keep chatting.`,
        lane,
        subscriptionPlan: plan,
        sessionId,
        gated: true,
        upgradeRequired: true,
        limitReached: true,
        citations: [],
        dailyRemaining: 0,
        actions: [{ type: 'navigate', label: 'View plans', path: '/installer/settings' }],
      });
    }

    if (gated) {
      const upgradeAnswer =
        lane === 'certification'
          ? 'Getting MCS certified needs the Pro assistant — full MCS coaching with your QMS documents and job data. On Free I can still help with quotes and general compliance.'
          : 'That feature needs Pro. Upgrade to unlock full agent help on this topic.';

      const interactionId = await logInteraction(supabase, {
        sessionId,
        userId: authData.user.id,
        companyId: profile.company_id,
        lane,
        message,
        answer: upgradeAnswer,
        plan,
        quoteId: payload.quoteId,
        gated: true,
        citationIds: [],
        hasImage,
        topic,
        stage: 'general',
        retrievalEmpty: false,
      });

      await incrementSession(supabase, sessionId!, dailyCount, plan);

      return jsonResponse({
        answer: upgradeAnswer,
        lane,
        subscriptionPlan: plan,
        sessionId,
        interactionId,
        gated: true,
        upgradeRequired: true,
        citations: [],
        dailyRemaining: Math.max(0, dailyLimit - dailyCount - 1),
        actions,
        suggestedLane: crossLaneSuggestion,
      });
    }

    let quoteStatus: string | null = null;
    if (payload.quoteId) {
      const { data: q } = await supabase.from('quotes').select('status').eq('id', payload.quoteId).single();
      quoteStatus = q?.status ?? null;
    }
    const stage = classifyStage(message, quoteStatus);

    let retrievedSources = '';
    const citationIds: string[] = [];
    const citations: { id: string; excerpt: string }[] = [];
    const needsRetrieval = lane === 'compliance' || lane === 'certification';
    let retrievalEmpty = false;

    if (needsRetrieval && plan === 'pro') {
      const namespaces = ['compliance'];
      if (company?.id) namespaces.push(qmsNamespace(company.id));

      const matches = await queryPineconeMulti(message, namespaces, 4, company?.consumer_code);
      citationIds.push(...matches.map((m) => m.id));
      citations.push(...matches.map((m) => ({ id: m.id, excerpt: m.text.slice(0, 280) })));
      retrievedSources = matches.map((m) => `- [${m.namespace}] ${m.text}`).join('\n');
      retrievalEmpty = matches.length === 0;

      if (retrievalEmpty && !hasImage && lane === 'compliance') {
        const deferAnswer =
          'I do not have matching MCS or QMS documentation loaded for that question yet. I cannot answer from memory — please check with your Certification Body or index documents in Document Bank / Onboarding.';
        const interactionId = await logInteraction(supabase, {
          sessionId,
          userId: authData.user.id,
          companyId: profile.company_id,
          lane,
          message,
          answer: deferAnswer,
          plan,
          quoteId: payload.quoteId,
          gated: false,
          citationIds,
          hasImage,
          topic,
          stage,
          retrievalEmpty: true,
        });
        await incrementSession(supabase, sessionId!, dailyCount, plan);
        return jsonResponse({
          answer: deferAnswer,
          lane,
          subscriptionPlan: plan,
          sessionId,
          interactionId,
          gated: false,
          upgradeRequired: false,
          citations: [],
          dailyRemaining: Math.max(0, dailyLimit - dailyCount - 1),
          actions,
          suggestedLane: crossLaneSuggestion,
          retrievalEmpty: true,
        });
      }
    }

    const accountContext =
      plan === 'pro'
        ? await buildAccountContext(supabase, company, profile.company_id, payload.quoteId, lane)
        : {};

    const chatMemory =
      consentLogging ? await queryChatMemory(authData.user.id, message, 4) : '(none)';

    const systemPrompt = buildSystemPrompt({
      plan,
      lane,
      retrievedSources,
      accountContext: formatAccountContext(accountContext),
      chatMemory,
      hasImage,
      coachingLevel,
      competenceLevel,
      crossLaneSuggestion,
    });

    let answer = await callLlm(systemPrompt, message, {
      imageBase64: payload.imageBase64,
      imageMimeType: payload.imageMimeType,
      plan,
    });

    if (crossLaneSuggestion) {
      answer += `\n\nTip: This also touches ${crossLaneSuggestion} — switch lane if you want deeper help there.`;
    }

    const interactionId = await logInteraction(supabase, {
      sessionId,
      userId: authData.user.id,
      companyId: profile.company_id,
      lane,
      message,
      answer,
      plan,
      quoteId: payload.quoteId,
      gated: false,
      citationIds,
      hasImage,
      topic,
      stage,
      retrievalEmpty,
    });
    await incrementSession(supabase, sessionId!, dailyCount, plan);

    if (interactionId && consentLogging) {
      void indexChatInteraction({
        userId: authData.user.id,
        companyId: profile.company_id,
        interactionId,
        sessionId,
        lane,
        question: message,
        answer,
        quoteId: payload.quoteId,
      }).catch((err) => console.error('chat memory index failed', err));
    }

    return jsonResponse({
      answer,
      lane,
      subscriptionPlan: plan,
      sessionId,
      interactionId,
      gated: false,
      upgradeRequired: false,
      citations,
      dailyRemaining: Math.max(0, dailyLimit - dailyCount - 1),
      actions,
      suggestedLane: crossLaneSuggestion,
      topic,
      stage,
      retrievalEmpty,
    });
  } catch (error: any) {
    console.error('ai-chat error:', error);
    return jsonResponse({ error: error?.message || 'Assistant request failed' }, 400);
  }
});

async function buildAccountContext(
  supabase: ReturnType<typeof createClient>,
  company: {
    id?: string;
    name?: string | null;
    mcs_number?: string | null;
    consumer_code?: string | null;
    is_umbrella_scheme?: boolean | null;
  } | null,
  companyId: string | null,
  quoteId?: string,
  lane?: AssistantLane
): Promise<AccountContext> {
  const ctx: AccountContext = {
    companyName: company?.name ?? undefined,
    mcsNumber: company?.mcs_number ?? undefined,
    consumerCode: company?.consumer_code ?? undefined,
    isUmbrellaScheme: company?.is_umbrella_scheme ?? undefined,
  };

  let quoteRow: Record<string, unknown> | null = null;

  if (quoteId) {
    const { data: quote } = await supabase
      .from('quotes')
      .select(
        'id, status, reference, total, subtotal, margin_percentage, annual_savings, payback_years, installation_type, customer, tariff, line_items, roi_projections'
      )
      .eq('id', quoteId)
      .single();
    quoteRow = quote;
  } else if (companyId && lane === 'design') {
    const { data: latest } = await supabase
      .from('quotes')
      .select(
        'id, status, reference, total, subtotal, margin_percentage, annual_savings, payback_years, installation_type, customer, tariff, line_items, roi_projections'
      )
      .eq('company_id', companyId)
      .in('status', ['draft', 'sent', 'viewed', 'accepted'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    quoteRow = latest;
  }

  if (quoteRow) {
    const customer = quoteRow.customer as { name?: string; address?: string; postcode?: string } | null;
    const lineItems = (quoteRow.line_items as { description?: string; quantity?: number }[] | null) ?? [];
    ctx.quoteSummary = [
      quoteRow.reference ? `Reference: ${quoteRow.reference}` : `Quote ${quoteRow.id}`,
      customer?.name ? `Customer: ${customer.name}` : null,
      quoteRow.installation_type ? `Installation: ${quoteRow.installation_type}` : null,
      quoteRow.total ? `Total: £${quoteRow.total}` : null,
      quoteRow.annual_savings ? `Annual savings: £${quoteRow.annual_savings}` : null,
      quoteRow.payback_years ? `Payback: ${quoteRow.payback_years} years` : null,
      quoteRow.status ? `Status: ${quoteRow.status}` : null,
      lineItems.length ? `Line items: ${lineItems.map((i) => i.description).filter(Boolean).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (lane === 'design' || lane === 'quote') {
      ctx.roiDetail = formatQuoteRoiContext(quoteRow as Parameters<typeof formatQuoteRoiContext>[0]);

      const lineItemsFull = (quoteRow.line_items as { type?: string; productId?: string; product_id?: string; quantity?: number }[]) ?? [];
      if (lineItemsFull.some((i) => i.type === 'battery')) {
        const { data: batteries } = await supabase.from('battery_products').select('id, capacity_kwh').eq('is_active', true);
        const capacity = estimateBatteryCapacityKwh(lineItemsFull, batteries ?? []);
        if (capacity > 0) {
          ctx.roiDetail += `\nEstimated battery capacity on quote: ${capacity} kWh`;
        }
      }
    }
  }

  if (companyId) {
    const { data: jobs } = await supabase
      .from('quotes')
      .select('reference, status, customer')
      .eq('company_id', companyId)
      .in('status', [
        'accepted',
        'deposit_paid',
        'scheduled',
        'in_progress',
        'completed',
        'commissioning',
        'compliance_review',
      ])
      .order('updated_at', { ascending: false })
      .limit(5);

    if (jobs?.length) {
      ctx.jobsSummary = jobs
        .map((j) => {
          const c = j.customer as { name?: string } | null;
          return `- ${j.reference ?? 'Job'} (${j.status})${c?.name ? ` — ${c.name}` : ''}`;
        })
        .join('\n');
    }
  }

  if (lane === 'design' || lane === 'quote') {
    const { data: batteries } = await supabase
      .from('battery_products')
      .select('model, capacity_kwh, power_kw, rrp, manufacturer:manufacturers(name)')
      .eq('is_active', true)
      .order('capacity_kwh')
      .limit(6);

    const { data: inverters } = await supabase
      .from('inverter_products')
      .select('model, power_kw, rrp, manufacturer:manufacturers(name)')
      .eq('is_active', true)
      .order('power_kw')
      .limit(6);

    const batteryLines = (batteries ?? []).map((b: any) =>
      `  ${b.manufacturer?.name ?? ''} ${b.model}: ${b.capacity_kwh}kWh, ${b.power_kw}kW, £${b.rrp}`
    );
    const inverterLines = (inverters ?? []).map((i: any) =>
      `  ${i.manufacturer?.name ?? ''} ${i.model}: ${i.power_kw}kW, £${i.rrp}`
    );

    ctx.designCatalogue = [
      'Batteries (sample):',
      ...batteryLines,
      'Inverters (sample):',
      ...inverterLines,
      'ROI tip: size battery to evening load; use payback = system cost / annual savings.',
    ].join('\n');
  }

  return ctx;
}

async function logInteraction(
  supabase: ReturnType<typeof createClient>,
  args: {
    sessionId: string | null;
    userId: string;
    companyId: string | null;
    lane: AssistantLane;
    message: string;
    answer: string;
    plan: 'free' | 'pro';
    quoteId?: string;
    gated: boolean;
    citationIds: string[];
    hasImage: boolean;
    topic: string;
    stage: string;
    retrievalEmpty: boolean;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('assistant_interactions')
    .insert({
      session_id: args.sessionId,
      user_id: args.userId,
      company_id: args.companyId,
      lane: args.lane,
      question: args.message,
      answer: args.answer,
      subscription_plan: args.plan,
      gated: args.gated,
      quote_id: args.quoteId ?? null,
      retrieved_pinecone_ids: args.citationIds.length ? args.citationIds : null,
      topic: args.topic,
      stage: args.stage,
      metadata: {
        has_image: args.hasImage,
        retrieval_empty: args.retrievalEmpty,
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('log interaction failed', error);
    return null;
  }
  return data?.id ?? null;
}

async function incrementSession(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  dailyCount: number,
  plan: 'free' | 'pro'
) {
  await supabase
    .from('assistant_sessions')
    .update({
      daily_message_count: dailyCount + 1,
      subscription_plan: plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}
