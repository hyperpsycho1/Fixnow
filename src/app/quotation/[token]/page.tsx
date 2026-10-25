import {notFound} from 'next/navigation';
import {createHash} from 'node:crypto';
import {db} from '@/lib/db';
import {services} from '@/lib/services';
import {centsToLkr} from '@/lib/money';

export const dynamic='force-dynamic';
export default async function CustomerQuotePage({params,searchParams}:{params:{token:string};searchParams:{response?:string}}) {
  const approvalTokenHash=createHash('sha256').update(params.token).digest('hex');
  const quote=await db.quotation.findUnique({where:{approvalTokenHash},include:{request:true}});
  if(!quote)notFound();
  const service=services.find((item)=>item.slug===quote.request.serviceSlug)?.name||quote.request.serviceSlug;
  const total=quote.labourCents+quote.materialCents+quote.transportCents+quote.otherCents-quote.discountCents;
  const responded=searchParams.response;
  return <><section className="page-hero"><div className="wrap"><span className="eyebrow">FIXNOW QUOTATION · {quote.request.reference}</span><h1>Your service quotation</h1><p>{service} · {quote.request.city}</p></div></section><section className="page-content wrap"><div className="content-card"><h2>Quotation total: {centsToLkr(total)}</h2><p>Labour: {centsToLkr(quote.labourCents)}</p><p>Materials: {centsToLkr(quote.materialCents)}</p><p>Transport: {centsToLkr(quote.transportCents)}</p><p>Other: {centsToLkr(quote.otherCents)}</p><p>Discount: −{centsToLkr(quote.discountCents)}</p>{quote.validUntil&&<p>Valid until {quote.validUntil.toLocaleDateString('en-LK')}</p>}{responded==='approved'?<div className="success">Thank you. You approved this quotation. FixNow will contact you to schedule the work.</div>:responded==='declined'?<div className="success">Your response has been recorded. FixNow will contact you if any follow-up is needed.</div>:quote.status==='APPROVED'?<div className="success">This quotation has been approved.</div>:quote.status==='DECLINED'?<div className="empty">This quotation was declined.</div>:quote.status==='EXPIRED'||(quote.validUntil&&quote.validUntil<new Date())?<div className="empty">This quotation has expired. Please contact FixNow for an updated quotation.</div>:quote.status!=='SENT'?<div className="empty">This quotation is no longer available for a response.</div>:<><p>Please review the quotation. Approving it allows FixNow to arrange a suitable team and schedule the work.</p><div className="request-actions"><form action={`/api/quotations/${params.token}/respond`} method="post"><button className="button" name="decision" value="APPROVED">Approve quotation</button></form><form action={`/api/quotations/${params.token}/respond`} method="post"><button className="button button-muted" name="decision" value="DECLINED">Decline</button></form></div></>}</div></section></>;
}
