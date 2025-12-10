import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { Card } from '../components/ui/Card';

export function PlaceholderPage() {
  const location = useLocation();
  const pageName = location.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Page';

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title capitalize">{pageName}</h1>
        <p className="page-subtitle">This page is under construction</p>
      </div>

      <Card className="text-center py-16">
        <Construction className="w-16 h-16 mx-auto mb-4 text-warning-500" />
        <h3 className="text-xl font-semibold text-white mb-2">Coming Soon</h3>
        <p className="text-slate-400 max-w-md mx-auto">
          This feature is currently being developed. Check back soon for updates!
        </p>
      </Card>
    </div>
  );
}

