export type CertificateEmailPayload = {
  to: string;
  studentName: string;
  courseName: string;
  studentId?: string | null;
};

export async function sendCertificateEmail(payload: CertificateEmailPayload): Promise<void> {
  const response = await fetch('/api/send-certificate-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || 'The certificate email could not be sent.');
  }
}
