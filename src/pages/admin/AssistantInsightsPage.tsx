import { useEffect, useState } from 'react';
import { Bot, MessageSquare, ThumbsDown, ThumbsUp, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { fetchAssistantAnalytics } from '../../services/assistant';
import type { AssistantAnalytics } from '../../services/assistant';
import { LANE_LABELS, type AssistantLane } from '../../types/assistant';

export function AssistantInsightsPage() {
  const [analytics, setAnalytics] = useState<AssistantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const data = await fetchAssistantAnalytics();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="page-header mb-0">
        <Bot className="w-8 h-8 text-primary-400" />
        <div>
          <h1>Assistant Insights</h1>
          <p className="text-slate-400">Usage, topics, and retrieval gaps (last 500 interactions)</p>
        </div>
      </div>

      {loading && (
        <Card>
          <p className="text-slate-400 text-center py-8">Loading...</p>
        </Card>
      )}

      {error && (
        <Card>
          <p className="text-red-400 text-center py-8">{error}</p>
        </Card>
      )}

      {analytics && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
              <p className="text-3xl font-bold text-white mt-1">{analytics.totalInteractions}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Free / Pro</p>
              <p className="text-3xl font-bold text-white mt-1">
                {analytics.freeCount} / {analytics.proCount}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <ThumbsUp className="w-3.5 h-3.5" /> Helpful
              </p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{analytics.feedbackUp}</p>
            </Card>
            <Card>
              <p className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <ThumbsDown className="w-3.5 h-3.5" /> Not helpful
              </p>
              <p className="text-3xl font-bold text-red-400 mt-1">{analytics.feedbackDown}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <h2 className="text-lg font-semibold text-white mb-4">By lane</h2>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(analytics.byLane) as AssistantLane[]).map((lane) => (
                  <div key={lane} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                    <p className="text-xs text-slate-400">{LANE_LABELS[lane]}</p>
                    <p className="text-2xl font-bold text-white">{analytics.byLane[lane]}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-white mb-4">By topic</h2>
              {Object.keys(analytics.byTopic).length === 0 ? (
                <p className="text-slate-400 text-sm">No topics tagged yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(analytics.byTopic)
                    .sort((a, b) => b[1] - a[1])
                    .map(([topic, count]) => (
                      <li key={topic} className="flex justify-between text-sm">
                        <span className="text-slate-200 capitalize">{topic}</span>
                        <span className="text-slate-500">{count}</span>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Retrieval gaps
            </h2>
            <p className="text-sm text-slate-400 mb-3">
              Compliance questions where no MCS/QMS sources were found — index more documents.
            </p>
            {analytics.retrievalGaps.length === 0 ? (
              <p className="text-slate-400 text-sm">No retrieval gaps logged.</p>
            ) : (
              <ul className="space-y-2">
                {analytics.retrievalGaps.map((gap, i) => (
                  <li key={`${gap.question}-${i}`} className="text-sm border-b border-slate-800 pb-2">
                    <span className="text-slate-200">{gap.question}</span>
                    <span className="text-slate-500 ml-2">({gap.lane})</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white mb-2">Quick links</h2>
            <a href="/admin/assistant/questions" className="text-primary-400 hover:text-primary-300 text-sm">
              Open Question Bank →
            </a>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary-400" />
              Top questions
            </h2>
            {analytics.topQuestions.length === 0 ? (
              <p className="text-slate-400 text-sm">No interactions logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {analytics.topQuestions.map((item) => (
                  <li
                    key={item.question}
                    className="flex items-start justify-between gap-4 text-sm border-b border-slate-800 pb-2 last:border-0"
                  >
                    <span className="text-slate-200">{item.question}</span>
                    <span className="text-slate-500 shrink-0">{item.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
