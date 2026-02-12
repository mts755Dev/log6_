import { motion } from 'framer-motion';
import {
  FileText,
  Send,
  Eye,
  CheckCircle,
  CreditCard,
  Calendar,
  Wrench,
  CheckSquare,
  ClipboardCheck,
  Award,
  Receipt,
  XCircle,
} from 'lucide-react';
import type { QuoteStatus } from '../../types';
import { format } from 'date-fns';

interface JobStatusPipelineProps {
  currentStatus: QuoteStatus;
  timestamps: {
    createdAt?: string;
    sentAt?: string;
    viewedAt?: string;
    acceptedAt?: string;
    depositPaidAt?: string;
    scheduledAt?: string;
    installationStartedAt?: string;
    installationCompletedAt?: string;
    commissioningUploadedAt?: string;
    complianceReviewedAt?: string;
    mcsCertifiedAt?: string;
    finalInvoiceSentAt?: string;
    closedAt?: string;
  };
  variant?: 'full' | 'compact';
}

interface StatusStep {
  id: QuoteStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  timestampKey?: keyof JobStatusPipelineProps['timestamps'];
}

const STATUS_PIPELINE: StatusStep[] = [
  { id: 'draft', label: 'Draft', icon: FileText, color: 'slate', timestampKey: 'createdAt' },
  { id: 'sent', label: 'Sent', icon: Send, color: 'blue', timestampKey: 'sentAt' },
  { id: 'viewed', label: 'Viewed', icon: Eye, color: 'cyan', timestampKey: 'viewedAt' },
  { id: 'deposit_paid', label: 'Deposit Paid', icon: CreditCard, color: 'emerald', timestampKey: 'depositPaidAt' },
  { id: 'scheduled', label: 'Scheduled', icon: Calendar, color: 'purple', timestampKey: 'scheduledAt' },
  { id: 'in_progress', label: 'Installing', icon: Wrench, color: 'orange', timestampKey: 'installationStartedAt' },
  { id: 'completed', label: 'Completed', icon: CheckSquare, color: 'teal', timestampKey: 'installationCompletedAt' },
  { id: 'commissioning', label: 'Commissioning', icon: ClipboardCheck, color: 'indigo', timestampKey: 'commissioningUploadedAt' },
  { id: 'compliance_review', label: 'Compliance', icon: ClipboardCheck, color: 'violet', timestampKey: 'complianceReviewedAt' },
  { id: 'mcs_certified', label: 'MCS Certified', icon: Award, color: 'amber', timestampKey: 'mcsCertifiedAt' },
  { id: 'final_invoice_sent', label: 'Final Invoice', icon: Receipt, color: 'pink', timestampKey: 'finalInvoiceSentAt' },
  { id: 'closed', label: 'Closed', icon: CheckCircle, color: 'green', timestampKey: 'closedAt' },
];

const COLOR_CLASSES = {
  slate: 'bg-slate-500/20 text-slate-400 border-slate-500',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500',
  green: 'bg-green-500/20 text-green-400 border-green-500',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500',
  teal: 'bg-teal-500/20 text-teal-400 border-teal-500',
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500',
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500',
  pink: 'bg-pink-500/20 text-pink-400 border-pink-500',
  red: 'bg-red-500/20 text-red-400 border-red-500',
};

export function JobStatusPipeline({ currentStatus, timestamps, variant = 'full' }: JobStatusPipelineProps) {
  // Handle rejected/expired states
  if (currentStatus === 'rejected' || currentStatus === 'expired') {
    const isRejected = currentStatus === 'rejected';
    return (
      <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <XCircle className="w-6 h-6 text-red-400" />
        <div>
          <p className="font-semibold text-red-400">{isRejected ? 'Quote Rejected' : 'Quote Expired'}</p>
          <p className="text-sm text-slate-400">
            {isRejected ? 'Customer declined this quote' : 'Quote validity period has passed'}
          </p>
        </div>
      </div>
    );
  }

  // Find current step index
  const currentStepIndex = STATUS_PIPELINE.findIndex((step) => step.id === currentStatus);
  
  if (variant === 'compact') {
    const currentStep = STATUS_PIPELINE[currentStepIndex];
    if (!currentStep) return null;

    const Icon = currentStep.icon;
    const colorClass = COLOR_CLASSES[currentStep.color as keyof typeof COLOR_CLASSES];

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${colorClass}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{currentStep.label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-1 bg-slate-800 rounded-full">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
            initial={{ width: 0 }}
            animate={{
              width: `${(Math.min(currentStepIndex, 5) / 5) * 100}%`,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-6 gap-2">
          {STATUS_PIPELINE.slice(0, 6).map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const timestamp = step.timestampKey ? timestamps[step.timestampKey] : undefined;

            return (
              <div key={step.id} className="flex flex-col items-center">
                {/* Icon */}
                <motion.div
                  className={`
                    w-10 h-10 rounded-full border-2 flex items-center justify-center z-10
                    transition-all duration-300
                    ${
                      isCompleted
                        ? 'bg-primary-500 border-primary-500'
                        : 'bg-slate-800 border-slate-700'
                    }
                    ${isCurrent ? 'ring-4 ring-primary-500/30 scale-110' : ''}
                  `}
                  initial={{ scale: 0 }}
                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isCompleted ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                </motion.div>

                {/* Label */}
                <p
                  className={`
                    mt-2 text-xs font-medium text-center
                    ${isCompleted ? 'text-white' : 'text-slate-500'}
                    ${isCurrent ? 'font-bold' : ''}
                  `}
                >
                  {step.label}
                </p>

                {/* Timestamp */}
                {timestamp && isCompleted && (
                  <p className="mt-1 text-[10px] text-slate-400 text-center">
                    {format(new Date(timestamp), 'dd MMM')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Second Row (if needed) */}
      {currentStepIndex >= 6 && (
        <div className="relative">
          <div className="absolute top-5 left-0 right-0 h-1 bg-slate-800 rounded-full">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${((currentStepIndex - 6) / 5) * 100}%`,
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          <div className="relative grid grid-cols-7 gap-2">
            {STATUS_PIPELINE.slice(6).map((step, index) => {
              const actualIndex = index + 6;
              const Icon = step.icon;
              const isCompleted = actualIndex <= currentStepIndex;
              const isCurrent = actualIndex === currentStepIndex;
              const timestamp = step.timestampKey ? timestamps[step.timestampKey] : undefined;

              return (
                <div key={step.id} className="flex flex-col items-center">
                  <motion.div
                    className={`
                      w-10 h-10 rounded-full border-2 flex items-center justify-center z-10
                      transition-all duration-300
                      ${
                        isCompleted
                          ? 'bg-primary-500 border-primary-500'
                          : 'bg-slate-800 border-slate-700'
                      }
                      ${isCurrent ? 'ring-4 ring-primary-500/30 scale-110' : ''}
                    `}
                    initial={{ scale: 0 }}
                    animate={{ scale: isCurrent ? 1.1 : 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        isCompleted ? 'text-white' : 'text-slate-500'
                      }`}
                    />
                  </motion.div>

                  <p
                    className={`
                      mt-2 text-xs font-medium text-center
                      ${isCompleted ? 'text-white' : 'text-slate-500'}
                      ${isCurrent ? 'font-bold' : ''}
                    `}
                  >
                    {step.label}
                  </p>

                  {timestamp && isCompleted && (
                    <p className="mt-1 text-[10px] text-slate-400 text-center">
                      {format(new Date(timestamp), 'dd MMM')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Status Info */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Current Status</p>
            <p className="text-lg font-semibold text-white">
              {STATUS_PIPELINE[currentStepIndex]?.label || currentStatus}
            </p>
          </div>
          {currentStepIndex >= 0 && currentStepIndex < STATUS_PIPELINE.length - 1 && (
            <div className="text-right">
              <p className="text-sm text-slate-400 mb-1">Next Step</p>
              <p className="text-sm font-medium text-primary-400">
                {STATUS_PIPELINE[currentStepIndex + 1]?.label}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
