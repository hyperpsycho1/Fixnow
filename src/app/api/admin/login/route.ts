import {NextResponse} from 'next/server';
import {z} from 'zod';
// bcryptjs does not sript declarations in this project.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {compare}: {compare: (password: string, hash: string) => Promise<boolean>} = require('bcryptjs');
import {db} from '@/lib/db';
import {isAuthSecretConfigured, makeSession} from '@/lib/auth';

const credentials = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Request body must be valid JSON.'}, {status: 400});
  }

  const parsed = credentials.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Enter a valid email and password.'}, {status: 400});
  }
  if (!isAuthSecretConfigured()) {
    return NextResponse.json({error: 'Admin sign-in is not configured on this server.'}, {status: 503});
  }

  try {
    const email = parsed.data.email.toLowerCase();
    const user = await db.adminUser.findUnique({where: {email}});
    if (!user || !(await compare(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({error: 'Email or password is incorrect.'}, {status: 401});
    }

    const response = NextResponse.json({ok: true});
    response.cookies.set('fixnow_admin', makeSession(user.email), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({error: 'Sign-in is temporarily unavailable.'}, {status: 500});
  }
}
