import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {getAdminEmail} from '@/lib/admin-auth';
import {centsToLkr, sriLankaDateTimeInput} from '@/lib/money';

export const dynamic='force-dynamic';

export default async function JobsPage() {
  if (!getAdminEmail()) redirect('/admin/login');
  const [approved, workers, jobs] = await Promise.all([
    db.serviceRequest.findMany({
      where: {status:'APPROVED', job:null, quotations:{some:{status:'APPROVED'}}},
      include: {quotations:{where:{status:'APPROVED'},orderBy:{createdAt:'desc'},take:1}},
      orderBy:{createdAt:'asc'},
    }),
    db.worker.findMany({where:{active:true},orderBy:{name:'asc'}}),
    db.job.findMany({include:{request:true,assignments:{include:{worker:true}},payments:true},orderBy:{scheduledAt:'asc'}}),
  ]);
  return <><section className="page-hero"><div className="wrap"><span className="eyebrow">ADMIN OPERATIONS</span><h1>Jobs &amp; schedule</h1><p>Create jobs only from customer-approved quotations, assign internal workers, and track job progress.</p></div></section><section className="page-content wrap"><div className="content-card"><h2>Schedule approved requests</h2>{approved.length===0?<p>No customer-approved requests are waiting for a job.</p>:approved.map(request=>{const quote=request.quotations[0];const total=quote.labourCents+quote.materialCents+quote.transportCents+quote.otherCents-quote.discountCents;return <form action="/api/admin/jobs" method="post" className="content-card" key={request.id}><input type="hidden" name="requestId" value={request.id}/><h3>{request.reference} · {request.fullName}</h3><p>{request.city}, {request.district} · Quote {centsToLkr(total)}</p><div className="field"><label htmlFor={`time-${request.id}`}>Schedule date and time (Sri Lanka time)</label><input id={`time-${request.id}`} name="scheduledAt" type="datetime-local" required/></div><fieldset className="worker-picker"><legend>Assign workers</legend>{workers.length===0?<p>Add internal workers before scheduling: <Link href="/admin/workers">Manage workers</Link></p>:workers.map(worker=><label key={worker.id}><input type="checkbox" name="workerIds" value={worker.id}/>{worker.name}</label>)}</fieldset><button className="button" disabled={workers.length===0}>Create scheduled job</button></form>})}</div><h2>Current jobs</h2>{jobs.length===0?<div className="empty">No jobs scheduled yet.</div>:<div className="admin-requests">{jobs.map(job=><article className="admin-request" key={job.id}><span className="eyebrow">{job.request.reference}</span><h3>{job.request.fullName} · {job.request.serviceSlug}</h3><p>{job.scheduledAt?.toLocaleString('en-LK',{timeZone:'Asia/Colombo'})||'Not scheduled'} · {job.status}</p><p>Assigned: {job.assignments.map(a=>a.worker.name).join(', ')||'No workers'}</p><p>Paid {centsToLkr(job.payments.reduce((sum,p)=>sum+p.amountCents,0))} of {centsToLkr(job.finalChargeCents)}</p><form action={`/api/admin/jobs/${job.id}`} method="post" className="inline-form"><label>Reschedule (Sri Lanka time) <input type="datetime-local" name="scheduledAt" defaultValue={sriLankaDateTimeInput(job.scheduledAt)}/></label><select name="status" defaultValue={job.status}><option>SCHEDULED</option><option>IN_PROGRESS</option><option>COMPLETED</option><option>CANCELLED</option></select><button className="button button-small">Update job</button></form></article>)}</div>}<div className="admin-nav-grid"><Link className="button button-muted" href="/admin">Dashboard</Link><Link className="button button-muted" href="/admin/workers">Manage workers</Link><Link className="button button-muted" href="/admin/payments">Payments</Link></div></section></>;
}
