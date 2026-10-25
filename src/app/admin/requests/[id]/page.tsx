import {cookies} from 'next/headers';
import {notFound, redirect} from 'next/navigation';
import Link from 'next/link';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';
import {services} from '@/lib/services';

export const dynamic = 'force-dynamic';

export default async function RequestDetails({params}:{params:{id:string}}) {
  if (!readSession(cookies().get('fixnow_admin')?.value)) redirect('/admin/login');
  const request = await db.serviceRequest.findUnique({where:{id:params.id},include:{quotations:{orderBy:{createdAt:'desc'}}}});
  if (!request) notFound();
  const service = services.find((item)=>item.slug===request.serviceSlug)?.name || request.serviceSlug;
  return <><section className="page-hero"><div className="wrap"><span className="eyebrow"><Link href="/admin/requests">SERVICE REQUESTS</Link> / {request.reference}</span><h1>{request.fullName}</h1><p>{service} · {request.city}, {request.district} · {request.status}</p></div></section><section className="page-content wrap"><div className="content-card"><h2>Request details</h2><p><b>Phone:</b> {request.phone}</p><p><b>Email:</b> {request.email || 'Not provided'}</p><p><b>Address:</b> {request.address}</p><p><b>Job:</b> {request.description}</p><h2>Create a quotation</h2><p>Enter amounts in LKR. Creating the quotation generates a private customer approval link. Share it with the customer; creating a job requires their approval.</p><form action={`/api/admin/requests/${request.id}/quotation`} method="post" className="form-grid"><MoneyField label="Labour (Rs.)" name="labour"/><MoneyField label="Materials (Rs.)" name="materials"/><MoneyField label="Transport (Rs.)" name="transport"/><MoneyField label="Other charges (Rs.)" name="other"/><MoneyField label="Discount (Rs.)" name="discount"/><div className="field"><label htmlFor="validUntil">Valid until (optional)</label><input id="validUntil" name="validUntil" type="date"/></div><button className="button">Create quotation and approval link</button></form></div>{request.quotations.length>0&&<div className="content-card"><h2>Quotation history</h2>{request.quotations.map((quote)=><p key={quote.id}>Rs. {((quote.labourCents+quote.materialCents+quote.transportCents+quote.otherCents-quote.discountCents)/100).toFixed(2)} · {quote.status} · {quote.createdAt.toLocaleDateString('en-LK')}</p>)}<Link className="text-link" href="/admin/quotations">View quotations</Link></div>}</section></>;
}

function MoneyField({label,name}:{label:string;name:string}) {return <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} inputMode="decimal" pattern="\d+(\.\d{1,2})?" defaultValue="0.00" required/></div>}
