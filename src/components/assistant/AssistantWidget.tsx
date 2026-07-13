import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  Camera,
  MessageCircle,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { sendAssistantMessage, submitAssistantFeedback, fetchSessionHistory } from '../../services/assistant';
import type { AssistantAction, AssistantChatMessage, AssistantLane } from '../../types/assistant';
import {
  LANE_COLORS,
  LANE_LABELS,
  resolveAssistantPlan,
} from '../../types/assistant';
import { cn } from '../../utils/cn';

const ENTRY_LANES: AssistantLane[] = ['design', 'compliance', 'quote', 'certification'];

const GREETING: AssistantChatMessage = {
  id: 'greeting',
  role: 'assistant',
  content:
    'What do you need a hand with? Pick a lane below or just ask — I\'ll work out whether it\'s design, compliance, quote, or certification.',
  createdAt: new Date().toISOString(),
};

function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const [, base64 = ''] = result.split(',');
      resolve({ base64, mimeType: file.type || 'image/jpeg', preview: result });
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

const SESSION_STORAGE_PREFIX = 'helios-assistant-session-';

export function AssistantWidget() {
  const { user } = useAuth();
  const { getCompany } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedLane, setSelectedLane] = useState<AssistantLane | undefined>();
  const [sessionId, setSessionId] = useState<string>();
  const [messages, setMessages] = useState<AssistantChatMessage[]>([GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
  } | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const company = user?.companyId ? getCompany(user.companyId) : null;
  const plan = useMemo(() => resolveAssistantPlan(company), [company]);

  const quoteId = useMemo(() => {
    if (!location.pathname.includes('/installer/quotes/')) return undefined;
    if (!routeId || routeId === 'new') return undefined;
    return routeId;
  }, [location.pathname, routeId]);

  const sessionStorageKey = user?.id ? `${SESSION_STORAGE_PREFIX}${user.id}` : null;

  useEffect(() => {
    if (!sessionStorageKey || historyLoaded) return;
    const storedSessionId = sessionStorage.getItem(sessionStorageKey);
    if (!storedSessionId) {
      setHistoryLoaded(true);
      return;
    }
    setSessionId(storedSessionId);
    void fetchSessionHistory(storedSessionId)
      .then((history) => {
        if (history.length > 0) setMessages([GREETING, ...history]);
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, [sessionStorageKey, historyLoaded]);

  const persistSessionId = (id: string) => {
    if (sessionStorageKey) sessionStorage.setItem(sessionStorageKey, id);
  };

  const handleNewChat = () => {
    if (sessionStorageKey) sessionStorage.removeItem(sessionStorageKey);
    setSessionId(undefined);
    setMessages([GREETING]);
    setSelectedLane(undefined);
    setDailyRemaining(null);
    setError(null);
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const handleFeedback = async (messageId: string, interactionId: string, feedback: 'up' | 'down') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
    );
    try {
      await submitAssistantFeedback(interactionId, feedback);
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: undefined } : m))
      );
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (plan !== 'pro') {
      setError('Photo upload is available on Pro.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be under 4MB.');
      return;
    }
    try {
      const image = await readFileAsBase64(file);
      setPendingImage(image);
      setError(null);
    } catch {
      setError('Could not read that image.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAction = (action: AssistantAction) => {
    if (action.type === 'switch_lane' && action.lane) {
      setSelectedLane(action.lane);
      return;
    }
    if (action.path) {
      navigate(action.path);
      setOpen(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || isLoading) return;

    const displayText = text || 'Please review this install photo and give an indicative checklist only.';
    const userMessage: AssistantChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: displayText,
      lane: selectedLane,
      imagePreview: pendingImage?.preview,
      createdAt: new Date().toISOString(),
    };

    const imagePayload = pendingImage;
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setPendingImage(null);
    setError(null);
    setIsLoading(true);
    scrollToBottom();

    try {
      const response = await sendAssistantMessage({
        message: displayText,
        sessionId,
        lane: selectedLane,
        quoteId,
        imageBase64: imagePayload?.base64,
        imageMimeType: imagePayload?.mimeType,
      });

      if (response.sessionId) {
        setSessionId(response.sessionId);
        persistSessionId(response.sessionId);
      }
      if (typeof response.dailyRemaining === 'number') setDailyRemaining(response.dailyRemaining);

      const assistantMessage: AssistantChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.answer,
        lane: response.lane,
        citations: response.citations,
        upgradeRequired: response.upgradeRequired,
        interactionId: response.interactionId,
        actions: response.actions,
        suggestedLane: response.suggestedLane,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (response.lane) setSelectedLane(response.lane);
      if (response.suggestedLane && !selectedLane) setSelectedLane(response.suggestedLane);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: 'assistant',
          content: `Sorry — I couldn't reach the assistant. ${message}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  if (!user) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[min(100vw-2rem,24rem)] h-[min(70vh,32rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-925 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-primary-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">heliOS Assistant</p>
                  <p className="text-xs text-slate-400 capitalize">
                    {plan} plan
                    {dailyRemaining !== null && ` · ${dailyRemaining} left today`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="text-[10px] px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-white"
                >
                  New chat
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  aria-label="Close assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {quoteId && plan === 'pro' && (
              <div className="px-3 py-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border-b border-emerald-500/20">
                Using context from this quote
              </div>
            )}

            <div className="px-3 py-2 border-b border-slate-800 flex gap-1.5 overflow-x-auto">
              {ENTRY_LANES.map((lane) => (
                <button
                  key={lane}
                  onClick={() => setSelectedLane(lane)}
                  className={cn(
                    'shrink-0 px-2.5 py-1 rounded-full text-xs border transition-colors',
                    selectedLane === lane
                      ? LANE_COLORS[lane]
                      : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
                  )}
                >
                  {LANE_LABELS[lane]}
                </button>
              ))}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                      message.role === 'user'
                        ? 'bg-primary-600 text-white rounded-br-md'
                        : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-md'
                    )}
                  >
                    {message.lane && message.role === 'assistant' && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border mb-2',
                          LANE_COLORS[message.lane]
                        )}
                      >
                        {LANE_LABELS[message.lane]}
                      </span>
                    )}
                    {message.imagePreview && (
                      <img
                        src={message.imagePreview}
                        alt="Upload preview"
                        className="rounded-lg mb-2 max-h-28 object-cover border border-white/20"
                      />
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.citations.map((citation) => (
                          <div
                            key={citation.id}
                            className="text-[11px] text-slate-300 bg-slate-900/70 border border-slate-700 rounded px-2 py-1"
                          >
                            {citation.excerpt || citation.id}
                          </div>
                        ))}
                      </div>
                    )}
                    {message.upgradeRequired && (
                      <div className="mt-2 text-xs text-amber-300 space-y-1">
                        <div className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          Upgrade to Pro for full help on this topic.
                        </div>
                        <Link to="/installer/settings" className="underline text-amber-200">
                          View plans in Settings
                        </Link>
                      </div>
                    )}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.actions.map((action, idx) => (
                          <button
                            key={`${action.label}-${idx}`}
                            type="button"
                            onClick={() => handleAction(action)}
                            className="text-[11px] px-2 py-1 rounded-full border border-primary-500/40 bg-primary-500/10 text-primary-200 hover:bg-primary-500/20"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {message.suggestedLane && message.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => setSelectedLane(message.suggestedLane)}
                        className="mt-2 text-[11px] text-slate-400 hover:text-white underline"
                      >
                        Try {LANE_LABELS[message.suggestedLane]} lane
                      </button>
                    )}
                    {message.role === 'assistant' && message.interactionId && message.id !== 'greeting' && (
                      <div className="mt-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => void handleFeedback(message.id, message.interactionId!, 'up')}
                          className={cn(
                            'p-1 rounded hover:bg-slate-700',
                            message.feedback === 'up' ? 'text-emerald-400' : 'text-slate-400'
                          )}
                          aria-label="Helpful"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleFeedback(message.id, message.interactionId!, 'down')}
                          className={cn(
                            'p-1 rounded hover:bg-slate-700',
                            message.feedback === 'down' ? 'text-red-400' : 'text-slate-400'
                          )}
                          aria-label="Not helpful"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && <div className="text-xs text-slate-400 px-2">Thinking...</div>}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-925">
              {pendingImage && (
                <div className="mb-2 flex items-center gap-2">
                  <img src={pendingImage.preview} alt="Pending" className="h-12 w-12 rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Remove photo
                  </button>
                </div>
              )}
              {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleImageSelect(e)}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (plan !== 'pro') {
                      setError('Photo checks are Pro only.');
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  className="shrink-0 p-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                  aria-label="Upload photo"
                  title={plan === 'pro' ? 'Upload install photo' : 'Pro feature'}
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Ask the assistant..."
                  className="flex-1 input text-sm py-2.5"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => void handleSend()}
                  isLoading={isLoading}
                  disabled={!input.trim() && !pendingImage}
                  className="shrink-0 px-3"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-600/30 flex items-center justify-center transition-colors"
        aria-label={open ? 'Close heliOS Assistant' : 'Open heliOS Assistant'}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
