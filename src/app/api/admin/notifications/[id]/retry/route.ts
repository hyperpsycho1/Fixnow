import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {readSession} from '@/lib/auth';
import {sendRequestNotification} from '@/lib/request-email';
import {services} from '@/lib/services';

export async function POST(req: Request, {params}: {params: {id: string}}) {
  if (!readSession(cookies().get('fixnow_admin')?.value)) {
    return NextResponse.json({error: 'Unauthorized.'}, {status: 401});
  }

  try {
    const notification = await db.requestNotification.findUnique({
      where: {id: params.id},
      include: {request: true},
    });
    if (!notification || notification.channel !== 'EMAIL') {
      return NextResponse.json({error: 'Email notification not found.'}, {status: 404});
    }
    if (notification.status === 'SENT') {
      return NextResponse.redirect(new URL('/admin/requests', req.url), 303);
    }

    await db.requestNotification.update({where: {id: notification.id}, data: {status: 'PENDING', failureReason: null}});
    const request = notification.request;
    const service = services.find((item) => item.slug === request.serviceSlug);
    const result = await sendRequestNotification({
      reference: request.reference,
      fullName: request.fullName,
      phone: request.phone,
      email: request.email,
      serviceName: service?.name || request.serviceSlug,
      city: request.city,
      district: request.district,
      urgency: request.urgency,
      description: request.description,
    });
    await db.requestNotification.update({
      where: {id: notification.id},
      data: {
        status: result.ok ? 'SENT' : 'FAILED',
        recipient: process.env.FIXNOW_NOTIFICATION_EMAIL || null,
        failureReason: result.ok ? null : result.error,
        providerMessageId: result.ok ? result.id : null,
        attemptedAt: new Date(),
        sentAt: result.ok ? new Date() : null,
      },
    });
    return NextResponse.redirect(new URL('/admin/requests', req.url), 303);
  } catch {
    return NextResponse.json({error: 'Could not retry this email notification.'}, {status: 500});
  }
}
