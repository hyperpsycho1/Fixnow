import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/db';

export async function POST(req: Request, {params}: {params: {token: string}}) {
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({error: 'Invalid response.'}, {status: 400}); }
  const parsed = z.enum(['APPROVED', 'DECLINED']).safeParse(form.get('decision'));
  if (!parsed.success) return NextResponse.json({error: 'Choose approve or decline.'}, {status: 400});
  const tokenHash = createHash('sha256').update(params.token).digest('hex');
  try {
    const quote=await db.quotation.findUnique({where:{approvalTokenHash:tokenHash}});
    if(!quote||quote.status!=='SENT')return NextResponse.json({error:'This quotation is no longer available for a response.'},{status:409});
    const now=new Date();
    if(quote.validUntil&&quote.validUntil<now){await db.quotation.update({where:{id:quote.id},data:{status:'EXPIRED'}});return NextResponse.json({error:'This quotation has expired.'},{status:409});}
    await db.$transaction(async(tx)=>{
      const result=await tx.quotation.updateMany({where:{id:quote.id,status:'SENT',...(quote.validUntil?{validUntil:{gte:now}}:{})},data:{status:parsed.data,respondedAt:now}});
      if(result.count!==1)throw new Error('QUOTE_UNAVAILABLE');
      if(parsed.data==='APPROVED')await tx.serviceRequest.update({where:{id:quote.requestId},data:{status:'APPROVED'}});
    });
    return NextResponse.redirect(new URL(`/quotation/${params.token}?response=${parsed.data.toLowerCase()}`, req.url), 303);
  } catch {
    return NextResponse.json({error: 'This quotation is no longer available for a response.'}, {status: 409});
  }
}
