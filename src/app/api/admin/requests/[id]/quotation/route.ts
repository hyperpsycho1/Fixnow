import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createHash, randomBytes} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';
import {lkrToCents} from '@/lib/money';

const amount = z.string().regex(/^\d{1,9}(?:\.\d{1,2})?$/);
const schema = z.object({
  labour: amount,
  materials: amount,
  transport: amount,
  other: amount,
  discount: amount,
  validUntil: z.string().optional(),
});

export async function POST(req: Request, {params}: {params: {id: string}}) {
  if (!readSession(cookies().get('fixnow_admin')?.value)) return NextResponse.json({error: 'Unauthorized.'}, {status: 401});
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({error: 'Invalid form.'}, {status: 400}); }
  const parsed = schema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return NextResponse.json({error: 'Enter valid LKR amounts.'}, {status: 400});
  const labour = lkrToCents(parsed.data.labour)!;
  const materials = lkrToCents(parsed.data.materials)!;
  const transport = lkrToCents(parsed.data.transport)!;
  const other = lkrToCents(parsed.data.other)!;
  const discount = lkrToCents(parsed.data.discount)!;
  if (discount > labour + materials + transport + other) return NextResponse.json({error: 'Discount cannot exceed the quotation subtotal.'}, {status: 400});
  const validUntil = parsed.data.validUntil ? new Date(`${parsed.data.validUntil}T23:59:59`) : null;
  if (validUntil && (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date())) return NextResponse.json({error: 'Validity date must be in the future.'}, {status: 400});

  const token = randomBytes(32).toString('hex');
  try {
    const request = await db.serviceRequest.findUnique({where: {id: params.id}, select: {id: true}});
    if (!request) return NextResponse.json({error: 'Request not found.'}, {status: 404});
    await db.$transaction(async(tx)=>{
      await tx.quotation.create({data: {
        requestId: request.id,
        labourCents: labour,
        materialCents: materials,
        transportCents: transport,
        otherCents: other,
        discountCents: discount,
        status: 'SENT',
        validUntil,
        approvalTokenHash: createHash('sha256').update(token).digest('hex'),
      }});
      await tx.serviceRequest.update({where:{id:request.id},data:{status:'QUOTATION_SENT'}});
    });
    const link = new URL(`/quotation/${token}`, req.url).toString();
    return NextResponse.redirect(new URL(`/admin/quotations?link=${encodeURIComponent(link)}`, req.url), 303);
  } catch {
    return NextResponse.json({error: 'Could not create the quotation.'}, {status: 500});
  }
}
