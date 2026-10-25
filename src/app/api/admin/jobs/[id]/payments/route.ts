import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';
import {lkrToCents} from '@/lib/money';

export async function POST(req:Request,{params}:{params:{id:string}}){
  if(!readSession(cookies().get('fixnow_admin')?.value))return NextResponse.json({error:'Unauthorized.'},{status:401});
  let form:FormData;try{form=await req.formData()}catch{return NextResponse.json({error:'Invalid form.'},{status:400})}
  const parsed=z.object({amount:z.string().regex(/^\d{1,9}(?:\.\d{1,2})?$/),method:z.enum(['CASH','BANK_TRANSFER','CARD','OTHER']),note:z.string().max(300)}).safeParse({amount:form.get('amount'),method:form.get('method'),note:form.get('note')||''});
  if(!parsed.success)return NextResponse.json({error:'Enter a valid payment amount and method.'},{status:400});
  const amountCents=lkrToCents(parsed.data.amount);if(!amountCents||amountCents<1)return NextResponse.json({error:'Payment must be greater than zero.'},{status:400});
  try{
    await db.$transaction(async tx=>{
      const job=await tx.job.findUnique({where:{id:params.id},include:{payments:{select:{amountCents:true}}}});if(!job)throw new Error('JOB_NOT_FOUND');
      const alreadyPaid=job.payments.reduce((sum,p)=>sum+p.amountCents,0);if(alreadyPaid+amountCents>job.finalChargeCents)throw new Error('OVERPAYMENT');
      await tx.payment.create({data:{jobId:job.id,amountCents,method:parsed.data.method,note:parsed.data.note||null}});
    });
    return NextResponse.redirect(new URL('/admin/payments?recorded=1',req.url),303);
  }catch(error){const msg=error instanceof Error&&error.message==='OVERPAYMENT'?'Payment exceeds the remaining balance.':'Could not record payment. Check the job and try again.';return NextResponse.json({error:msg},{status:409})}
}
