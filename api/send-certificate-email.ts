import tls from 'node:tls';

type Request = { method?: string; body?: unknown };
type Response = { status: (code: number) => Response; json: (body: unknown) => void };

const clean = (value: unknown, max = 240) => String(value ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, max);

function readResponse(socket: tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\r\n');
      if (lines.length < 2) return;
      const last = lines[lines.length - 2];
      if (/^\d{3} /.test(last)) {
        socket.off('data', onData);
        resolve(last);
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

async function command(socket: tls.TLSSocket, value: string, expected: RegExp) {
  socket.write(`${value}\r\n`);
  const result = await readResponse(socket);
  if (!expected.test(result)) throw new Error(`SMTP rejected ${value.split(' ')[0]}.`);
}

async function sendMail(to: string, subject: string, text: string) {
  const user = process.env.HOSTINGER_SMTP_USER;
  const password = process.env.HOSTINGER_SMTP_PASSWORD;
  const from = process.env.HOSTINGER_SMTP_FROM || user;
  if (!user || !password || !from) throw new Error('Hostinger SMTP is not configured on the server.');

  const socket = tls.connect({ host: 'smtp.hostinger.com', port: 465, servername: 'smtp.hostinger.com' });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });
    await readResponse(socket);
    await command(socket, 'EHLO lihatech.com', /^250/);
    await command(socket, 'AUTH LOGIN', /^334/);
    await command(socket, Buffer.from(user).toString('base64'), /^334/);
    await command(socket, Buffer.from(password).toString('base64'), /^235/);
    await command(socket, `MAIL FROM:<${clean(from, 180)}>`, /^250/);
    await command(socket, `RCPT TO:<${clean(to, 180)}>`, /^250|^251/);
    await command(socket, 'DATA', /^354/);
    const message = [
      `From: LihaTech <${clean(from, 180)}>`,
      `To: ${clean(to, 180)}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text,
      '.',
    ].join('\r\n');
    socket.write(`${message}\r\n`);
    await readResponse(socket);
    await command(socket, 'QUIT', /^221/);
  } finally {
    socket.end();
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const input = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const to = clean(input.to, 180);
  const studentName = clean(input.studentName, 120);
  const courseName = clean(input.courseName, 180);
  const studentId = clean(input.studentId, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !studentName || !courseName) {
    return res.status(400).json({ error: 'A valid student email, name, and course are required.' });
  }
  try {
    await sendMail(to, 'Your LihaTech certificate is ready', [
      `Hello ${studentName},`,
      '',
      `Your certificate request for ${courseName} has been approved.`,
      studentId ? `Student ID: ${studentId}` : '',
      '',
      'Please sign in to LihaTech Learn to preview and download your certificate.',
      '',
      'Regards,',
      'LihaTech',
    ].filter(Boolean).join('\n'));
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Certificate email failed', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Email delivery failed.' });
  }
}
