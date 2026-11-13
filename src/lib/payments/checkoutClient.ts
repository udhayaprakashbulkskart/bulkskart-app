export interface FunctionFailure {
  message: string;
  code?: string;
  status?: number;
}

export async function readFunctionFailure(error: unknown, data: unknown): Promise<FunctionFailure> {
  const payload = data && typeof data === 'object' ? data as Record<string, unknown> : null;
  if (typeof payload?.error === 'string' && payload.error) {
    return {
      message: payload.error,
      code: typeof payload.code === 'string' ? payload.code : undefined,
    };
  }

  const err = error as { message?: string; context?: { status?: number; clone?: () => { json: () => Promise<unknown> } } };
  const status = err?.context?.status;
  if (err?.context && typeof err.context.clone === 'function') {
    try {
      const body = await err.context.clone().json() as Record<string, unknown>;
      if (typeof body?.error === 'string' && body.error) {
        return {
          message: body.error,
          code: typeof body.code === 'string' ? body.code : undefined,
          status,
        };
      }
    } catch {
      // The function response was not JSON.
    }
  }

  return {
    message: err?.message || 'Payment request failed',
    status,
  };
}

export function shouldRetryOrder(failure: FunctionFailure): boolean {
  if (failure.code === 'RAZORPAY_KEYS_MISSING') return false;
  if (!failure.status) return true;
  return failure.status === 502 || failure.status === 504;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
