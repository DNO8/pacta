import { privatePaymentConfig } from '@/lib/private-payment/config';

export function GET() {
  return Response.json(privatePaymentConfig(), { headers: { 'Cache-Control': 'no-store' } });
}
