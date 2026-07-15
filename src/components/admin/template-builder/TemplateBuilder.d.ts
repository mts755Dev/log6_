import type { TemplateBuilderSnapshot } from '../../lib/templateBuilder';

export interface TemplateBuilderPublishPayload {
  snapshot: TemplateBuilderSnapshot;
  htmlContent: string;
}

export interface TemplateBuilderProps {
  embedMode?: boolean;
  initialSnapshot?: TemplateBuilderSnapshot | null;
  onPublish?: (payload: TemplateBuilderPublishPayload) => void;
  onBack?: () => void;
}

declare const TemplateBuilder: (props: TemplateBuilderProps) => JSX.Element;
export default TemplateBuilder;
