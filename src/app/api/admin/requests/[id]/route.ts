import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';

const statusSchema = z.enum(['NEW', 'CONTACTED', 'INSPECTION', 'QUOTATION_SENT', 'CANCELLED']);
const contactSchema = z.object({
  method: z.enum(['PHONE', 'WHATSAPP', 'EMAIL']),
  outcome: z.enum(['REACHED', 'NO_ANSWER', 'LEFT_MESSAGE', 'FOLLOW_UP']),
});

export async function POST(req: Request, {params}: {params: {id: string}}) {
  const email = readSession(cookies().get('fixnow_admin')?.value);
  if (!email) return NextResponse.json({error: 'Unauthorized.'}, {status: 401});

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({error: 'Invalid form submission.'}, {status: 400});
  }

  const intent = form.get('intent');
  try {
    if (intent === 'status') {
      const parsed = statusSchema.safeParse(form.get('status'));
      if (!parsed.success) return NextResponse.json({error: 'Invalid request status.'}, {status: 400});
      await db.serviceRequest.update({where: {id: params.id}, data: {status: parsed.data}});
    } else if (intent === 'contact') {
      const parsed = contactSchema.safeParse({method: form.get('method'), outcome: form.get('outcome')});
      if (!parsed.success) return NextResponse.json({error: 'Invalid contact attempt details.'}, {status: 400});
      await db.contactLog.create({data: {requestId: params.id, ...parsed.data}});
    } else {
      return NextResponse.json({error: 'Unknown request action.'}, {status: 400});
    }
    return NextResponse.redirect(new URL('/admin/requests?updated=1', req.url), 303);
  } catch {
    return NextResponse.json({error: 'Could not update this request. It may no longer exist.'}, {status: 404});
  }
}
