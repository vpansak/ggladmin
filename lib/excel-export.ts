import * as XLSX from 'xlsx';

// Format date nicely for display
function formatDate(d: any): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch {
    return String(d);
  }
}

// Map performer records for Excel
export function formatPerformerRows(items: any[]) {
  return items.map((p, idx) => ({
    'S.No': idx + 1,
    'App ID': p.app_id || '',
    'Full Name': p.full_name || '',
    'Mobile Number': p.mobile_number || '',
    'WhatsApp Number': p.whatsapp_number || p.mobile_number || '',
    'Email Address': p.email || '',
    'City': p.city || '',
    'Age': p.age || '',
    'Performance Category': p.performance_category || '',
    'Performance Title': p.performance_title || '',
    'Type': p.performance_type || '',
    'Member Count': p.performer_count || 1,
    'Duration': p.performance_duration || '2 Min',
    'Language': p.performance_language || 'Hindi',
    'Description': p.performance_description || '',
    'Special Requirements': p.special_requirements || '',
    'Instagram URL': p.instagram_url || '',
    'YouTube URL': p.youtube_url || '',
    'Payment Status': p.payment_status || 'PENDING',
    'Amount Paid (INR)': p.payment_amount || 199,
    'Razorpay Payment ID': p.payment_id || p.razorpay_payment_id || '',
    'Razorpay Order ID': p.order_id || '',
    'Payment Verified At': formatDate(p.payment_verified_at),
    'Application Status': p.application_status || p.status || 'SUBMITTED',
    'Admin Notes': p.tags || '',
    'Submitted On': formatDate(p.created_at),
  }));
}

// Map sponsor records for Excel
export function formatSponsorRows(items: any[]) {
  return items.map((s, idx) => ({
    'S.No': idx + 1,
    'App ID': s.app_id || '',
    'Company / Brand Name': s.company_name || '',
    'Contact Person': s.contact_person || '',
    'Designation': s.designation || '',
    'Business Email': s.biz_email || '',
    'WhatsApp Number': s.whatsapp || '',
    'Mobile Phone': s.phone || '',
    'Website': s.website || '',
    'Instagram Handle': s.instagram_url || '',
    'Industry': s.industry || '',
    'City / Location': s.location || '',
    'Sponsorship Type': s.sponsorship_type || '',
    'Preferred Package': s.preferred_package || '',
    'Estimated Budget': s.budget_est || '',
    'Brand Deck URL': s.brand_deck_url || '',
    'Status': s.status || 'NEW_LEAD',
    'Submitted On': formatDate(s.created_at),
  }));
}

// Map team records for Excel
export function formatTeamRows(items: any[]) {
  return items.map((t, idx) => ({
    'S.No': idx + 1,
    'App ID': t.app_id || '',
    'Full Name': t.full_name || '',
    'Mobile Number': t.mobile_number || '',
    'Email Address': t.email || '',
    'Date of Birth': t.dob || '',
    'Residential Address': t.address || '',
    'Instagram URL': t.instagram_url || '',
    'About / Skills / Role': t.about || '',
    'Status': t.status || 'RECEIVED',
    'Submitted On': formatDate(t.created_at),
  }));
}

// Map judge / VIP panel records for Excel
export function formatGuestRows(items: any[]) {
  return items.map((g, idx) => ({
    'S.No': idx + 1,
    'App ID': g.app_id || '',
    'Full Name': g.full_name || '',
    'Stage / Public Name': g.stage_name || '',
    'Profession / Title': g.profession || '',
    'Category / Expertise': g.category || '',
    'Mobile Phone': g.phone || '',
    'WhatsApp Number': g.whatsapp || '',
    'Email Address': g.email || '',
    'City': g.city || '',
    'Short Intro / Bio': g.short_intro || '',
    'Why Join GGL': g.why_ggl || '',
    'Instagram Profile': g.instagram_url || '',
    'YouTube Profile': g.youtube_url || '',
    'Profile Photo URL': g.profile_photo_url || '',
    'Press Kit URL': g.press_kit_url || '',
    'Status': g.status || 'PENDING_REVIEW',
    'Submitted On': formatDate(g.created_at),
  }));
}

// Auto-adjust column widths
function autofitColumns(worksheet: XLSX.WorkSheet, json: any[]) {
  if (!json || json.length === 0) return;
  const colWidths = Object.keys(json[0]).map((key) => {
    const maxValLen = Math.max(...json.map((row) => String(row[key] ?? '').length));
    return { wch: Math.min(Math.max(key.length, maxValLen) + 3, 40) };
  });
  worksheet['!cols'] = colWidths;
}

// Map Computer Ji live scoring records for Excel
export function formatComputerJiRows(items: any[]) {
  return items.map((c, idx) => ({
    'S.No': idx + 1,
    'Contestant ID': c.contestant_id,
    'Contestant Name': c.contestant_name || '',
    'Category': c.category || '',
    'Phone': c.phone || '',
    'Individual Judge Scores': typeof c.judge_scores === 'object' && c.judge_scores ? Object.entries(c.judge_scores).map(([k, v]) => `${k}: ${v}`).join(' | ') : String(c.judge_scores || ''),
    'Average Judge Score': c.rounded_average ?? '',
    'Contestant Prediction': c.contestant_score ?? '',
    'Verdict / Result': c.result || 'PENDING',
    'Saved At': c.saved_at || '',
    'Days Remaining (10-Day TTL)': c.days_left ?? 10,
    'Recorded On': formatDate(c.created_at),
  }));
}

// Map lead records for Excel
export function formatLeadRows(items: any[]) {
  return items.map((l, idx) => ({
    'S.No': idx + 1,
    'Lead Code': l.lead_code || l.id || '',
    'Customer Name': l.customer_name || 'Anonymous Guest',
    'Mobile Number': l.mobile || '',
    'Email Address': l.email || '',
    'Instagram Handle': l.instagram_id || '',
    'Date of Birth': l.dob || '',
    'Ticket Quantity': l.quantity || 1,
    'Source': l.source || 'book-ticket',
    'Status': l.status || 'ABANDONED',
    'Captured / Updated Time': formatDate(l.updated_at || l.created_at),
  }));
}

// Export single category to Excel (.xlsx)
export function downloadCategoryExcel(
  items: any[],
  category: 'performer' | 'sponsor' | 'team' | 'guest' | 'computerji' | 'leads',
  customTitle?: string
) {
  let mappedData: any[] = [];
  let sheetName = 'Applications';
  let filePrefix = 'Gorakhpur_Got_Latent';

  if (category === 'performer') {
    mappedData = formatPerformerRows(items);
    sheetName = 'Performers';
    filePrefix = 'GGL_Performers_Applications';
  } else if (category === 'sponsor') {
    mappedData = formatSponsorRows(items);
    sheetName = 'Sponsors';
    filePrefix = 'GGL_Sponsor_Applications';
  } else if (category === 'team') {
    mappedData = formatTeamRows(items);
    sheetName = 'Team Members';
    filePrefix = 'GGL_Team_Applications';
  } else if (category === 'guest') {
    mappedData = formatGuestRows(items);
    sheetName = 'Judges & VIPs';
    filePrefix = 'GGL_Judges_Applications';
  } else if (category === 'computerji') {
    mappedData = formatComputerJiRows(items);
    sheetName = 'Computer Ji Scores';
    filePrefix = 'GGL_ComputerJi_Scores';
  } else if (category === 'leads') {
    mappedData = formatLeadRows(items);
    sheetName = 'Abandoned Leads';
    filePrefix = 'GGL_Abandoned_Leads';
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(mappedData.length > 0 ? mappedData : [{ 'Status': 'No records found' }]);
  autofitColumns(ws, mappedData);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const timestamp = new Date().toISOString().slice(0, 10);
  const fileName = `${customTitle || filePrefix}_${timestamp}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// Map ticket records for Excel
export function formatTicketRows(items: any[]) {
  return items.map((t, idx) => ({
    'S.No': idx + 1,
    'Ticket ID': t.ticket_id || '',
    'Customer Name': t.customer_name || '',
    'Mobile Number': t.mobile || '',
    'Email Address': t.email || '',
    'Instagram ID': t.instagram_id || '',
    'Quantity': t.quantity || 1,
    'Amount (INR)': t.amount || 149,
    'Payment Status': t.payment_status || 'PAID',
    'Entry Status': t.checked_in === 1 ? 'USED / ENTERED' : 'NOT USED',
    'Entry / Check-In Time': formatDate(t.checked_in_at),
    'Razorpay Order ID': t.razorpay_order_id || '',
    'Razorpay Payment ID': t.razorpay_payment_id || '',
    'Booking Date': formatDate(t.created_at),
  }));
}

// Export master workbook with all sheets in one .xlsx file
export function downloadMasterExcel(data: {
  performers: any[];
  sponsors: any[];
  team: any[];
  guests: any[];
  tickets?: any[];
}) {
  const wb = XLSX.utils.book_new();

  // 1. Performers Sheet
  const perfData = formatPerformerRows(data.performers || []);
  const wsPerf = XLSX.utils.json_to_sheet(perfData.length > 0 ? perfData : [{ 'Status': 'No performer records' }]);
  autofitColumns(wsPerf, perfData);
  XLSX.utils.book_append_sheet(wb, wsPerf, '1. Performers');

  // 2. Sponsors Sheet
  const sponsorData = formatSponsorRows(data.sponsors || []);
  const wsSpons = XLSX.utils.json_to_sheet(sponsorData.length > 0 ? sponsorData : [{ 'Status': 'No sponsor records' }]);
  autofitColumns(wsSpons, sponsorData);
  XLSX.utils.book_append_sheet(wb, wsSpons, '2. Sponsors');

  // 3. Team Sheet
  const teamData = formatTeamRows(data.team || []);
  const wsTeam = XLSX.utils.json_to_sheet(teamData.length > 0 ? teamData : [{ 'Status': 'No team records' }]);
  autofitColumns(wsTeam, teamData);
  XLSX.utils.book_append_sheet(wb, wsTeam, '3. Team Members');

  // 4. Judges / Guests Sheet
  const guestData = formatGuestRows(data.guests || []);
  const wsGuests = XLSX.utils.json_to_sheet(guestData.length > 0 ? guestData : [{ 'Status': 'No judge records' }]);
  autofitColumns(wsGuests, guestData);
  XLSX.utils.book_append_sheet(wb, wsGuests, '4. Judges & VIPs');

  // 5. Booked Tickets Sheet
  if (data.tickets && data.tickets.length > 0) {
    const ticketData = formatTicketRows(data.tickets);
    const wsTickets = XLSX.utils.json_to_sheet(ticketData);
    autofitColumns(wsTickets, ticketData);
    XLSX.utils.book_append_sheet(wb, wsTickets, '5. Booked Tickets');
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Gorakhpur_Got_Latent_Master_Applications_${timestamp}.xlsx`);
}
