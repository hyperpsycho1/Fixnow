import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';
import {parseSriLankaDateTime} from '@/lib/money';

export async function POST(req:Request) {
  if(!readSession(cookies().get('fixnow_admin')?.value)) return NextResponse.json({error:'Unauthorized.'},{status:401});
  let form:FormData;
  try{form=await req.formData()}catch{return NextResponse.json({error:'Invalid form.'},{status:400})}
  const parsed=z.object({requestId:z.string().min(1),scheduledAt:z.string().min(1),workerIds:z.array(z.string().min(1)).min(1)}).safeParse({requestId:form.get('requestId'),scheduledAt:form.get('scheduledAt'),workerIds:form.getAll('workerIds')});
  if(!parsed.success)return NextResponse.json({error:'Choose an approved request, date, time, and at least one worker.'},{status:400});
  const scheduledAt=parseSriLankaDateTime(parsed.data.scheduledAt);
  if(!scheduledAt||scheduledAt<new Date())return NextResponse.json({error:'Choose a future Sri Lankan date and time.'},{status:400});
  const workerIds=Array.from(new Set(parsed.data.workerIds));
  try{
    const [request,workers,conflicts]=await Promise.all([
      db.serviceRequest.findUnique({where:{id:parsed.data.requestId},include:{quotations:{where:{status:'APPROVED'},orderBy:{createdAt:'desc'},take:1},job:true}}),
      db.worker.findMany({where:{id:{in:workerIds},active:true}}),
      db.jobAssignment.findMany({where:{workerId:{in:workerIds},job:{scheduledAt:{equals:scheduledAt},status:{not:'CANCELLED'}}},include:{worker:true,job:{include:{request:true}}}}),
    ]);
    if(!request||!request.quotations.length||request.job)return NextResponse.json({error:'Only requests with an approved quotation and no existing job can be scheduled.'},{status:409});
    if(workers.length!==workerIds.length)return NextResponse.json({error:'One or more selected workers are unavailable.'},{status:400});
    if(conflicts.length)return NextResponse.json({error:`Scheduling conflict: ${conflicts[0].worker.name} is already assigned at this time.`},{status:409});
    const quote=request.quotations[0];
    await db.$transaction(async tx=>{
      const job=await tx.job.create({data:{requestId:request.id,scheduledAt,finalChargeCents:quote.labourCents+quote.materialCents+quote.transportCents+quote.otherCents-quote.discountCents}});
      await tx.jobAssignment.createMany({data:workerIds.map(workerId=>({jobId:job.id,workerId}))});
      await tx.serviceRequest.update({where:{id:request.id},data:{status:'SCHEDULED'}});
    });
    return NextResponse.redirect(new URL('/admin/jobs?created=1',req.url),303);
  }catch{return NextResponse.json({error:'Could not create the job. Check for a duplicate or scheduling conflict.'},{status:409});}
}
