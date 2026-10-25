import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';

export async function POST(req:Request){
  if(!readSession(cookies().get('fixnow_admin')?.value))return NextResponse.json({error:'Unauthorized.'},{status:401});
  let form:FormData;try{form=await req.formData()}catch{return NextResponse.json({error:'Invalid form.'},{status:400})}
  const parsed=z.object({name:z.string().trim().min(2).max(100)}).safeParse({name:form.get('name')});
  if(!parsed.success)return NextResponse.json({error:'Enter a valid worker name.'},{status:400});
  await db.worker.create({data:{name:parsed.data.name}});
  return NextResponse.redirect(new URL('/admin/workers?created=1',req.url),303);
}
