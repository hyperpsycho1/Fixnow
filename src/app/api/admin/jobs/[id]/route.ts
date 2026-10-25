import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';
import {parseSriLankaDateTime} from '@/lib/money';

export async function POST(req:Request,{params}:{params:{id:string}}){
  if(!readSession(cookies().get('fixnow_admin')?.value))return NextResponse.json({error:'Unauthorized.'},{status:401});
  let form:FormData;try{form=await req.formData()}catch{return NextResponse.json({error:'Invalid form.'},{status:400})}
  const parsed=z.object({status:z.enum(['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED']),scheduledAt:z.string().min(1)}).safeParse({status:form.get('status'),scheduledAt:form.get('scheduledAt')});
  if(!parsed.success)return NextResponse.json({error:'Provide a valid job status and schedule.'},{status:400});
  const scheduledAt=parseSriLankaDateTime(parsed.data.scheduledAt);if(!scheduledAt)return NextResponse.json({error:'Invalid Sri Lankan schedule time.'},{status:400});
  try{
    const job=await db.job.findUnique({where:{id:params.id},include:{assignments:{select:{workerId:true}}}});if(!job)return NextResponse.json({error:'Job not found.'},{status:404});
    const workerIds=job.assignments.map(a=>a.workerId);
    if(parsed.data.status!=='CANCELLED'&&workerIds.length){const conflict=await db.jobAssignment.findFirst({where:{workerId:{in:workerIds},jobId:{not:job.id},job:{scheduledAt:{equals:scheduledAt},status:{not:'CANCELLED'}}},include:{worker:true}});if(conflict)return NextResponse.json({error:`Scheduling conflict for ${conflict.worker.name}.`},{status:409});}
    await db.$transaction(async tx=>{await tx.job.update({where:{id:job.id},data:{status:parsed.data.status,scheduledAt}});if(parsed.data.status==='COMPLETED')await tx.serviceRequest.update({where:{id:job.requestId},data:{status:'COMPLETED'}});else if(parsed.data.status==='IN_PROGRESS')await tx.serviceRequest.update({where:{id:job.requestId},data:{status:'IN_PROGRESS'}});else if(parsed.data.status==='CANCELLED')await tx.serviceRequest.update({where:{id:job.requestId},data:{status:'CANCELLED'}})});
    return NextResponse.redirect(new URL('/admin/jobs?updated=1',req.url),303);
  }catch{return NextResponse.json({error:'Could not update job.'},{status:500})}
}
