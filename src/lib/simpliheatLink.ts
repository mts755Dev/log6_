import { supabase } from './supabase';

export const SIMPLIHEAT_LINK_CODE_KEY = 'simpliheat_link_code';
export const SIMPLIHEAT_LINK_SUCCESS_KEY = 'simpliheat_link_success';

export function storeSimpliHeatLinkCode(linkCode: string): void {
  sessionStorage.setItem(SIMPLIHEAT_LINK_CODE_KEY, linkCode.trim());
}

export function getStoredSimpliHeatLinkCode(): string | null {
  const code = sessionStorage.getItem(SIMPLIHEAT_LINK_CODE_KEY);
  return code?.trim() || null;
}

export function clearStoredSimpliHeatLinkCode(): void {
  sessionStorage.removeItem(SIMPLIHEAT_LINK_CODE_KEY);
}

export function markSimpliHeatLinkSuccess(): void {
  sessionStorage.setItem(SIMPLIHEAT_LINK_SUCCESS_KEY, '1');
}

export function hasPendingSimpliHeatLinkSuccess(): boolean {
  return sessionStorage.getItem(SIMPLIHEAT_LINK_SUCCESS_KEY) === '1';
}

export function consumeSimpliHeatLinkSuccess(): boolean {
  const linked = hasPendingSimpliHeatLinkSuccess();
  sessionStorage.removeItem(SIMPLIHEAT_LINK_SUCCESS_KEY);
  return linked;
}

type CompleteLinkResult = {
  linked: boolean;
  error?: string;
};

async function completeViaEdgeFunction(linkCode: string): Promise<CompleteLinkResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { linked: false, error: 'not_authenticated' };
  }

  const { data, error } = await supabase.functions.invoke('complete-simpliheat-link', {
    body: { linkCode },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { linked: false, error: error.message };
  }

  const payload = data as { linked?: boolean; error?: string } | null;
  if (payload?.error) {
    return { linked: false, error: payload.error };
  }

  return { linked: Boolean(payload?.linked) };
}

async function completeViaRpc(linkCode: string): Promise<CompleteLinkResult> {
  const { data, error } = await supabase.rpc('complete_simpliheat_helios_link', {
    p_link_code: linkCode,
  });

  if (error) {
    return { linked: false, error: error.message };
  }

  return { linked: Boolean((data as { linked?: boolean } | null)?.linked) };
}

export async function completeSimpliHeatHeliosLink(linkCode: string): Promise<CompleteLinkResult> {
  const edgeResult = await completeViaEdgeFunction(linkCode);
  if (edgeResult.linked) return edgeResult;

  const rpcResult = await completeViaRpc(linkCode);
  if (rpcResult.linked) return rpcResult;

  return {
    linked: false,
    error: edgeResult.error || rpcResult.error || 'link_failed',
  };
}

export async function tryCompleteStoredSimpliHeatLink(): Promise<boolean> {
  return tryCompleteStoredSimpliHeatLinkWithRetry();
}

export async function tryCompleteStoredSimpliHeatLinkWithRetry(
  maxAttempts = 5,
  delayMs = 700,
): Promise<boolean> {
  const linkCode = getStoredSimpliHeatLinkCode();
  if (!linkCode) return false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      return false;
    }

    const result = await completeSimpliHeatHeliosLink(linkCode);
    if (result.linked) {
      clearStoredSimpliHeatLinkCode();
      markSimpliHeatLinkSuccess();
      return true;
    }

    const retryable =
      result.error === 'installer_required' ||
      result.error === 'not_authenticated' ||
      result.error === 'invalid_or_expired_link' ||
      result.error?.includes('JWT') ||
      result.error?.includes('FunctionsFetchError') ||
      result.error?.includes('Failed to send');

    if (!retryable) {
      console.error('SimpliHeat link failed:', result.error);
      return false;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error('SimpliHeat link failed after retries');
  return false;
}
