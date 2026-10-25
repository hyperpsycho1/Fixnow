import {cookies} from 'next/headers';
import {readSession} from '@/lib/auth';

export function getAdminEmail() {
  return readSession(cookies().get('fixnow_admin')?.value);
}
