import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {services} from '@/lib/services';
import {sendRequestNotification} from '@/lib/request-email';

const input = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^[+\d\s()-]{7,20}$/),
  email: z.union([z.literal(''), z.string().email().max(200)]).optional(),
  serviceSlug: z.string().min(2).max(80),
  jobTitle: z.string().max(120).optional(),
  description: z.string().trim().min(10).max(5000),
  propertyType: z.enum(['Residential', 'Commercial']),
  urgency: z.enum(['Normal', 'Urgent', 'Emergency']),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(100),
  district: z.string().min(2).max(100),
  locationNotes: z.string().max(1000).optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  consent: z.literal('true'),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Request body must be valid JSON.'}, {status: 400});
  }

  const parsed = input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Please check the required fields and try again.'}, {status: 400});
  }
  const value = parsed.data;
  const service = services.find((item) => item.slug === value.serviceSlug);
  if (!service) return NextResponse.json({error: 'Select a valid service.'}, {status: 400});

  let saved;
  try {
    const year = new Date().getFullYear();
    saved = await db.$transaction(async (tx) => {
      const counter = await tx.requestCounter.upsert({
        where: {year},
        create: {year, value: 1},
        update: {value: {increment: 1}},
      });
      const reference = `FN-${year}-${String(counter.value).padStart(4, '0')}`;
      const request = await tx.serviceRequest.create({
        data: {
          ...value,
          consent: true,
          email: value.email || null,
          jobTitle: value.jobTitle || null,
          locationNotes: value.locationNotes || null,
          preferredDate: value.preferredDate ? new Date(value.preferredDate) : null,
          reference,
          notifications: {
            create: {
              channel: 'EMAIL',
              status: 'PENDING',
              recipient: process.env.FIXNOW_NOTIFICATION_EMAIL || null,
            },
          },
        },
        select: {id: true, reference: true},
      });
      return request;
    });
  } catch {
    return NextResponse.json({error: 'We could not save your request. Please try again later.'}, {status: 500});
  }

  const delivery = await sendRequestNotification({
    reference: saved.reference,
    fullName: value.fullName,
    phone: value.phone,
    email: value.email || null,
    serviceName: service.name,
    city: value.city,
    district: value.district,
    urgency: value.urgency,
    description: value.description,
  });

  try {
    await db.requestNotification.updateMany({
      where: {requestId: saved.id, channel: 'EMAIL'},
      data: {
        status: delivery.ok ? 'SENT' : 'FAILED',
        failureReason: delivery.ok ? null : delivery.error,
        providerMessageId: delivery.ok ? delivery.id : null,
        attemptedAt: new Date(),
        sentAt: delivery.ok ? new Date() : null,
      },
    });
  } catch {
    // The request remains saved. Dashboard notification state will remain PENDING if this update fails.
  }

  return NextResponse.json({
    reference: saved.reference,
    notification: delivery.ok
      ? {email: 'SENT', message: 'The request was saved and FixNow was notified by email.'}
      : {email: 'FAILED', message: 'The request was saved, but FixNow’s email notification could not be sent.'},
  }, {status: 201});
}
