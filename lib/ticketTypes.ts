export interface TicketRecord {
  id: string;
  ticket_id: string;
  booking_id: string;
  customer_name: string;
  mobile: string;
  email: string;
  instagram_id: string;
  quantity: number;
  amount: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  payment_status: string;
  ticket_status: 'VALID' | 'CANCELLED';
  qr_token: string;
  checked_in: number; // 0 or 1
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
}
