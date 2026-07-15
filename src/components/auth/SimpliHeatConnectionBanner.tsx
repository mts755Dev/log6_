import { motion } from 'framer-motion';

const SIMPLIHEAT_LOGO_URL = `${
  import.meta.env.VITE_SIMPLIHEAT_APP_URL?.replace(/\/$/, '') || 'https://simpliheat-next.vercel.app'
}/assets/logo.svg`;

interface SimpliHeatConnectionBannerProps {
  variant?: 'login' | 'signup' | 'linked';
}

export function SimpliHeatConnectionBanner({ variant = 'login' }: SimpliHeatConnectionBannerProps) {
  const message =
    variant === 'signup'
      ? 'A SimpliHeat user authorized data sharing. Create your installer account to complete the connection and receive their heat-loss projects.'
      : variant === 'linked'
        ? 'Your installer company is connected to SimpliHeat. Sign in to access shared heat-loss projects.'
        : 'A SimpliHeat user authorized data sharing. Sign in with your installer account to complete the connection and receive their heat-loss projects.';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-xl border border-slate-700 bg-slate-900/80 p-5"
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
        <div className="rounded-xl bg-slate-100 px-4 py-3">
          <img src={SIMPLIHEAT_LOGO_URL} alt="SimpliHeat" className="h-8 w-auto object-contain" />
        </div>
        <span className="text-slate-500 text-lg font-medium">×</span>
        <div className="rounded-xl bg-slate-100 px-4 py-3">
          <img src="/assets/Main heliOS Logo.png" alt="heliOS" className="h-8 w-auto object-contain" />
        </div>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed text-center">{message}</p>
    </motion.div>
  );
}
