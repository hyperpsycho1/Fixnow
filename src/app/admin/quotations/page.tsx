import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {getAdminEmail} from '@/lib/admin-auth';
import {centsToLkr} from '@/lib/money';

export const dynamic='force-dynamic';
export default async function QuotationsPage({searchParams}:{searchParams:{link?:string;created?:string}}) {
  if (!getAdminEmail()) redirect('/admin/login');
  const quotes=await db.quotation.findMany({include:{request:true},orderBy:{createdAt:'desc'},take:100});
  return <><section className="page-hero"><div className="wrap"><span className="eyebrow">ADMIN OPERATIONS</span><h1>Quotations</h1><p>Review quotes and customer approval status. Jobs can be created only from approved quotations.</p></div></section><section className="page-content wrap">{searchParams.link&&<div className="success"><b>Approval link created.</b><p>Share this link with the customer. No email is sent for quotations by this system.</p><a href={searchParams.link}>{searchParams.link}</a></div>}{quotes.length===0?<div className="empty">No quotations yet. Open a service request to prepare a quotation.</div>:<div className="admin-requests">{quotes.map(q=><article className="admin-request" key={q.id}><span className="eyebrow">{q.request.reference}</span><h2>{q.request.fullName}</h2><p>{q.request.serviceSlug} · {q.createdAt.toLocaleDateString('en-LK')}</p><p><b>Total:</b> {centsToLkr(q.labourCents+q.materialCents+q.transportCents+q.otherCents-q.discountCents)} · <b>Status:</b> {q.status}</p>{q.validUntil&&<p>Valid until {q.validUntil.toLocaleDateString('en-LK')}</p>}{q.status==='APPROVED'&&<Link className="button button-small" href="/admin/jobs">Create and schedule job</Link>}<Link className="text-link" href={`/admin/requests/${q.requestId}`}>Open request</Link></article>)}</div>}<div className="admin-nav-grid"><Link className="button button-muted" href="/admin">Dashboard</Link><Link className="button button-muted" href="/admin/jobs">Jobs</Link></div></section></>;
}
