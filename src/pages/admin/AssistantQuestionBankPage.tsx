import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Filter, Search } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { fetchQuestionBank } from '../../services/assistant';
import type { QuestionBankEntry } from '../../types/assistant';
import { LANE_COLORS, LANE_LABELS, type AssistantLane, type AssistantPlan } from '../../types/assistant';

export function AssistantQuestionBankPage() {
  const [entries, setEntries] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lane, setLane] = useState<AssistantLane | 'all'>('all');
  const [plan, setPlan] = useState<AssistantPlan | 'all'>('all');
  const [topic, setTopic] = useState('');
  const [stage, setStage] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchQuestionBank({
        lane,
        plan,
        topic: topic || undefined,
        stage: stage || undefined,
        search: search || undefined,
        limit: 300,
      });
      setEntries(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [lane, plan, topic, stage]);

  const topics = useMemo(() => {
    const set = new Set(entries.map((e) => e.topic).filter(Boolean) as string[]);
    return [...set].sort();
  }, [entries]);

  const stages = useMemo(() => {
    const set = new Set(entries.map((e) => e.stage).filter(Boolean) as string[]);
    return [...set].sort();
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="page-header mb-0">
        <BookOpen className="w-8 h-8 text-primary-400" />
        <div>
          <h1>Question Bank</h1>
          <p className="text-slate-400">Tagged assistant interactions — lane, topic, plan, and stage</p>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search questions or answers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void load()}
            />
          </div>
          <select className="input" value={lane} onChange={(e) => setLane(e.target.value as AssistantLane | 'all')}>
            <option value="all">All lanes</option>
            {(Object.keys(LANE_LABELS) as AssistantLane[]).map((l) => (
              <option key={l} value={l}>{LANE_LABELS[l]}</option>
            ))}
          </select>
          <select className="input" value={plan} onChange={(e) => setPlan(e.target.value as AssistantPlan | 'all')}>
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="input flex items-center justify-center gap-2 hover:bg-slate-800 cursor-pointer"
          >
            <Filter className="w-4 h-4" /> Apply
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </Card>

      {loading ? (
        <Card><p className="text-slate-400 text-center py-8">Loading question bank...</p></Card>
      ) : entries.length === 0 ? (
        <Card><p className="text-slate-400 text-center py-8">No interactions match your filters.</p></Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-slate-700/80">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className={LANE_COLORS[entry.lane]}>{LANE_LABELS[entry.lane]}</Badge>
                <Badge className="bg-slate-700 text-slate-300 capitalize">{entry.subscriptionPlan}</Badge>
                {entry.topic && <Badge className="bg-slate-800 text-slate-400">{entry.topic}</Badge>}
                {entry.stage && <Badge className="bg-slate-800 text-slate-400">{entry.stage}</Badge>}
                {entry.gated && <Badge className="bg-amber-500/20 text-amber-300">gated</Badge>}
                {entry.feedback === 'up' && <Badge className="bg-emerald-500/20 text-emerald-300">helpful</Badge>}
                {entry.feedback === 'down' && <Badge className="bg-red-500/20 text-red-300">not helpful</Badge>}
                <span className="text-xs text-slate-500 ml-auto">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-medium text-white mb-1">Q: {entry.question}</p>
              <p className="text-sm text-slate-400 line-clamp-3">A: {entry.answer}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
