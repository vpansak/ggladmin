export const PERFORMER_CATEGORIES = ['Comedy', 'Mimicry', 'Magic', 'Unusual Talent', 'Music (Unique / Original)', 'Poetry / Shayari', 'Beatboxing / Rap', 'Other Unique Talent'] as const;
export const PERFORMANCE_DURATIONS = ['1.5 minutes', 'Below 1 minute'] as const;

export function combinedStageIntroduction(answers: Record<string, any> = {}) {
  return [...new Set([answers.stageName, answers.introduction].filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))].join(' — ');
}

export function normalizePerformerCategory(value: string) {
  const text = String(value || '').trim();
  if ((PERFORMER_CATEGORIES as readonly string[]).includes(text)) return text;
  if (/dance|dancing/i.test(text)) return '';
  if (/sing|music/i.test(text)) return 'Music (Unique / Original)';
  if (/comed/i.test(text)) return 'Comedy';
  if (/mimic/i.test(text)) return 'Mimicry';
  if (/magic/i.test(text)) return 'Magic';
  if (/poet|shayari/i.test(text)) return 'Poetry / Shayari';
  if (/beatbox|rap/i.test(text)) return 'Beatboxing / Rap';
  if (/unique|unusual/i.test(text)) return 'Unusual Talent';
  return (PERFORMER_CATEGORIES as readonly string[]).includes(text) ? text : text ? 'Other Unique Talent' : '';
}

export const performerDetailFields = [
  { key: 'mobile', label: 'Mobile Number — Same as Provided Earlier', required: true, type: 'tel' },
  { key: 'fullName', label: 'Full name', required: true },
  { key: 'instagram', label: 'Instagram ID' },
  { key: 'category', label: 'Aap kis category ka act perform karenge?', required: true, options: PERFORMER_CATEGORIES },
  { key: 'description', label: 'Apne act ko simple words mein samjhaiye', required: true, multiline: true },
  { key: 'actDetails', label: 'Aap jo karne wale ho detail mein batao', multiline: true },
  { key: 'duration', label: 'Expected performance duration', required: true, options: PERFORMANCE_DURATIONS },
  { key: 'funnyFacts', label: 'Apne baare mein do funny facts, jokes ya strange habits batayein jinpar host halka-phulka fun kar sakta hai', required: true, multiline: true },
  { key: 'hostTopics', label: 'Host aapke saath kis cheez ko lekar fun ya conversation kar sakta hai? Aisa sujhav dein ki maza aa jaye!', multiline: true },
  { key: 'stageExperience', label: 'Kya aapne pehle stage par perform kiya hai? Agar haan, kahan aur kaisa experience tha?', multiline: true },
  { key: 'offLimitTopics', label: 'Kaunse topics, personal details ya jokes stage par bilkul mention nahi hone chahiye?', multiline: true },
  { key: 'technicalRequirements', label: 'Props, mic, instrument, chair, table, screen ya kisi technical setup ki requirement', multiline: true },
  { key: 'meaningfulStory', label: 'Aapki life ki ek emotional ya meaningful baat jo aap comfortable hokar production team ke saath share kar sakte hain', multiline: true },
  { key: 'funnyIncident', label: 'Aapke saath hua koi funny, embarrassing ya completely unexpected incident', required: true, multiline: true },
  { key: 'audienceMemory', label: 'Aapko kya lagta hai audience aapko performance ke baad kyun yaad rakhegi?', multiline: true },
  { key: 'interestedInTalentTrip', label: 'Kya aap Gorakhpur’s Got Latent Talent Trip ke liye ready hain?', required: true, options: ['Yes', 'No'] },
  { key: 'reportedPaymentStatus', label: 'Payment Status', required: true, options: ['Paid', 'Unpaid', 'Paid via QR'] },
  { key: 'stageName', label: 'Stage name / naam jisse host aapko introduce kare, aur woh one-line introduction likhein jiske saath aap stage par bulaye jaana chahte hain', multiline: true },
] as const;

export function validatePerformerDetails(input: Record<string, unknown>) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid form');
  const data: Record<string, string> = {};
  for (const field of performerDetailFields) {
    const raw = input[field.key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if ('required' in field && field.required && !value) throw new Error(`${field.label} is required`);
    if (value.length > 6000) throw new Error(`${field.label} is too long`);
    if ('options' in field && value && !(field.options as readonly string[]).includes(value)) throw new Error(`Invalid ${field.label}`);
    data[field.key] = value;
  }
  if (!/^\+?[\d\s()-]{10,20}$/.test(data.mobile)) throw new Error('Please enter a valid mobile number');
  return data;
}

export function hasVerifiedPerformerPayment(item: Record<string, any>) {
  return ['PAID', 'PAYMENT_VERIFIED'].includes(item.payment_status) && (Boolean(item.verified_payment_id) || (Boolean(item.manual_payment_reference) && Boolean(item.manual_payment_recorded_by) && Boolean(item.manual_payment_recorded_at) && Number(item.payment_amount) > 0)) && !['REFUNDED', 'REJECTED_REFUND'].includes(item.status);
}

export function canEditManualPerformerPayment(item: Record<string, any>) {
  return hasVerifiedPerformerPayment(item) && Boolean(item.manual_payment_reference)
    && !item.verified_payment_id && !item.payment_id && !item.order_id;
}
