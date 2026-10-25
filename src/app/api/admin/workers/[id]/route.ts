import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';

export async function POST(req:Request,{params}:{params:{id:string}}){
  if(!readSession(cookies().get('fixnow_admin')?.value))return NextResponse.json({error:'Unauthorized.'},{status:401});
  const form=await req.formData();const active=form.get('active')==='true';
  try{await db.worker.update({where:{id:params.id},data:{active}})}catch{return NextResponse.json({error:'Worker not found.'},{status:404})}
  return NextResponse.redirect(new URL('/admin/workers?updated=1',req.url),303);
}
