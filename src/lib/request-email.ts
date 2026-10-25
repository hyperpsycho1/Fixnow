type RequestEmail = {
  reference: string;
  fullName: string;
  phone: string;
  email: string | null;
  serviceName: string;
  city: string;
  district: string;
  urgency: string;
  description: string;
};

type EmailResult = {ok: true; id: string | null} | {ok: false; error: string};

export async function sendRequestNotification(request: RequestEmail): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.FIXNOW_NOTIFICATION_EMAIL;
  const from = process.env.FIXNOW_FROM_EMAIL;
  if (!apiKey || !recipient || !from) {
    return {ok: false, error: 'Email is not configured: set RESEND_API_KEY, FIXNOW_NOTIFICATION_EMAIL, and FIXNOW_FROM_EMAIL.'};
  }

  const message = [
    `New FixNow service request: ${request.reference}`,
    '',
    `Customer: ${request.fullName}`,
    `Phone: ${request.phone}`,
    `Email: ${request.email || 'Not provided'}`,
    `Service: ${request.serviceName}`,
    `Location: ${request.city}, ${request.district}`,
    `Urgency: ${request.urgency}`,
    '',
    'Description:',
    request.description,
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `New FixNow request ${request.reference}`,
        text: message,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string'
        ? result.message
        : `Resend returned HTTP ${response.status}.`;
      return {ok: false, error: detail.slice(0, 500)};
    }

    const id = result && typeof result === 'object' && 'id' in result && typeof result.id === 'string'
      ? result.id
      : null;
    return {ok: true, id};
  } catch (error) {
    return {ok: false, error: error instanceof Error ? error.message.slice(0, 500) : 'Could not connect to Resend.'};
  }
}
