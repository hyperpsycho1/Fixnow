import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {getAdminEmail} from '@/lib/admin-auth';
import {centsToLkr} from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const email = getAdminEmail();
  if (!email) redirect('/admin/login');
  const [newRequests, openQuotes, activeJobs, payments, outstanding] = await Promise.all([
    db.serviceRequest.count({where: {status: 'NEW'}}),
    db.quotation.count({where: {status: 'SENT'}}),
    db.job.count({where: {status: {in: ['SCHEDULED', 'IN_PROGRESS']}}}),
    db.payment.aggregate({ _sum: {amountCents: true} }),
    db.job.findMany({select: {finalChargeCents: true, payments: {select: {amountCents: true}}}}),
  ]);
  const due = outstanding.reduce((sum, job) => sum + job.finalChargeCents - job.payments.reduce((paid, item) => paid + item.amountCents, 0), 0);
  const cards = [
    ['New requests', String(newRequests), '/admin/requests'],
    ['Quotes awaiting customer', String(openQuotes), '/admin/quotations'],
    ['Active jobs', String(activeJobs), '/admin/jobs'],
    ['Payments recorded', centsToLkr(payments._sum.amountCents || 0), '/admin/payments'],
    ['Outstanding balance', centsToLkr(due), '/admin/payments'],
  ];
  return <><section className="page-hero"><div className="wrap"><span className="eyebrow">FIXNOW OPERATIONS · {email}</span><h1>Admin dashboard</h1><p>Current business activity from FixNow’s stored requests, quotations, jobs, and payments.</p></div></section><section className="page-content wrap"><div className="admin-stat-grid">{cards.map(([label,value,href])=><Link className="admin-stat" href={href} key={label}><span>{label}</span><b>{value}</b></Link>)}</div><div className="admin-nav-grid">{[['Service requests','/admin/requests'],['Quotations','/admin/quotations'],['Jobs & schedule','/admin/jobs'],['Internal workers','/admin/workers'],['Payments','/admin/payments']].map(([label,href])=><Link className="button button-muted" href={href} key={href}>{label}</Link>)}</div><form action="/api/admin/logout" method="post" style={{marginTop:28}}><button className="button">Sign out</button></form></section></>;
}
