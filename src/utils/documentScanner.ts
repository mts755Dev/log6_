import { createWorker, Worker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── Public types ────────────────────────────────────────────

export interface ScannedData {
  holderName?: string;
  issuedDate?: string;
  expiryDate?: string;
  referenceNumber?: string;
  providerName?: string;
  cardNumber?: string;
  qualificationType?: string;
  organizationName?: string;
  policyNumber?: string;
  membershipId?: string;
  rawText: string;
  confidence: number;
}

// ─── Known providers / bodies ────────────────────────────────

const KNOWN_PROVIDERS: { name: string; aliases: string[] }[] = [
  { name: 'NICEIC', aliases: ['NICEIC', 'N.I.C.E.I.C'] },
  { name: 'NAPIT', aliases: ['NAPIT', 'N.A.P.I.T'] },
  { name: 'MCS', aliases: ['MCS', 'MICROGENERATION CERTIFICATION', 'MICROGENERATION CERTIFICATION SCHEME'] },
  { name: 'ELECSA', aliases: ['ELECSA'] },
  { name: 'OFTEC', aliases: ['OFTEC', 'O.F.T.E.C'] },
  { name: 'HETAS', aliases: ['HETAS'] },
  { name: 'BPEC', aliases: ['BPEC'] },
  { name: 'LOGIC', aliases: ['LOGIC CERTIFICATION', 'LOGIC'] },
  { name: 'Gas Safe', aliases: ['GAS SAFE', 'GAS SAFE REGISTER'] },
  { name: 'RECC', aliases: ['RECC', 'RENEWABLE ENERGY CONSUMER CODE'] },
  { name: 'REAL', aliases: ['REAL ASSURANCE', 'REAL'] },
  { name: 'HIES', aliases: ['HIES', 'HOME INSULATION & ENERGY SYSTEMS'] },
  { name: 'QANW', aliases: ['QANW'] },
  { name: 'HICE', aliases: ['HICE'] },
  { name: 'REC', aliases: ['REC '] },
  { name: 'City & Guilds', aliases: ['CITY & GUILDS', 'CITY AND GUILDS', 'C&G', 'C & G'] },
  { name: 'EAL', aliases: ['EAL', 'EMTA AWARDS'] },
  { name: 'LCL Awards', aliases: ['LCL AWARDS', 'LCL'] },
  { name: 'BESCA', aliases: ['BESCA'] },
  { name: 'CHAS', aliases: ['CHAS', 'CONTRACTORS HEALTH AND SAFETY'] },
  { name: 'SSIP', aliases: ['SSIP'] },
  { name: 'Constructionline', aliases: ['CONSTRUCTIONLINE'] },
  { name: 'TrustMark', aliases: ['TRUSTMARK', 'TRUST MARK'] },
  { name: 'CSCS', aliases: ['CSCS', 'CONSTRUCTION SKILLS CERTIFICATION'] },
  { name: 'JIB', aliases: ['JIB', 'JOINT INDUSTRY BOARD'] },
  { name: 'ECS', aliases: ['ECS', 'ELECTROTECHNICAL CERTIFICATION'] },
  { name: 'IPAF', aliases: ['IPAF'] },
  { name: 'PASMA', aliases: ['PASMA'] },
  { name: 'CITB', aliases: ['CITB'] },
  { name: 'NVQ', aliases: ['NVQ', 'NATIONAL VOCATIONAL QUALIFICATION'] },
  { name: 'Zurich', aliases: ['ZURICH', 'ZURICH INSURANCE'] },
  { name: 'Aviva', aliases: ['AVIVA'] },
  { name: 'AXA', aliases: ['AXA'] },
  { name: 'Allianz', aliases: ['ALLIANZ'] },
  { name: 'Markel', aliases: ['MARKEL'] },
];

const QUALIFICATION_TYPES = [
  'NVQ Level 2', 'NVQ Level 3', 'NVQ Level 4',
  'Level 2 Diploma', 'Level 3 Diploma', 'Level 4 Diploma',
  'City & Guilds 2330', 'City & Guilds 2365', 'City & Guilds 2357', 'City & Guilds 2391',
  'C&G 2330', 'C&G 2365', 'C&G 2357', 'C&G 2391',
  '17th Edition', '18th Edition', 'BS 7671',
  'Unvented Hot Water', 'Part P', 'Part L',
  'Solar PV', 'Solar Thermal', 'Heat Pump',
  'Battery Storage', 'EV Charging', 'EVCP',
  'Inspection and Testing', 'Design and Verification',
  'PAT Testing', 'Portable Appliance Testing',
  'SMSTS', 'SSSTS', 'CSCS',
  'First Aid', 'Asbestos Awareness',
  'MCS Heat Pump', 'MCS Solar',
  'G3 Unvented', 'Water Regulations',
];

// ─── Singleton worker ────────────────────────────────────────

let workerInstance: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerInstance) {
    workerInstance = await createWorker('eng');
  }
  return workerInstance;
}

export async function terminateWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}

// ─── PDF handling ────────────────────────────────────────────

async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      pages.push(pageText);
    }

    return pages.join('\n');
  } catch (err) {
    console.warn('PDF text extraction failed:', err);
    return '';
  }
}

/**
 * Render a PDF page to an image canvas for OCR.
 * Tesseract.js cannot read PDF files directly -- they must be rasterised first.
 */
async function renderPDFPageToBlob(file: File, pageNum = 1): Promise<Blob | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const page = await pdf.getPage(pageNum);

    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch (err) {
    console.warn('PDF page render failed:', err);
    return null;
  }
}

// ─── OCR ─────────────────────────────────────────────────────

async function ocrFromFile(file: File): Promise<{ text: string; confidence: number }> {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(file);
    return { text: result.data.text, confidence: result.data.confidence };
  } catch (err) {
    console.error('OCR failed:', err);
    return { text: '', confidence: 0 };
  }
}

async function ocrFromBlob(blob: Blob): Promise<{ text: string; confidence: number }> {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(blob);
    return { text: result.data.text, confidence: result.data.confidence };
  } catch (err) {
    console.error('OCR failed:', err);
    return { text: '', confidence: 0 };
  }
}

// ─── Date parsing ────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09', sept: '09',
  oct: '10', nov: '11', dec: '12',
};

function toISO(day: string, month: string, year: string): string | null {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2040) return null;
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function findAllDates(text: string): string[] {
  const dates: string[] = [];

  // dd/mm/yyyy  dd-mm-yyyy  dd.mm.yyyy
  const numericRe = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = numericRe.exec(text)) !== null) {
    const iso = toISO(m[1], m[2], m[3]);
    if (iso) dates.push(iso);
  }

  // yyyy-mm-dd
  const isoRe = /(\d{4})-(\d{2})-(\d{2})/g;
  while ((m = isoRe.exec(text)) !== null) {
    const iso = toISO(m[3], m[2], m[1]);
    if (iso) dates.push(iso);
  }

  // "12 January 2025", "January 12, 2025", "12 Jan 2025"
  const monthNames = Object.keys(MONTH_MAP).join('|');
  const namedRe = new RegExp(
    `(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})|` +
    `(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'gi'
  );
  while ((m = namedRe.exec(text)) !== null) {
    if (m[1] && m[2] && m[3]) {
      const mo = MONTH_MAP[m[2].toLowerCase()];
      if (mo) { const iso = toISO(m[1], mo, m[3]); if (iso) dates.push(iso); }
    } else if (m[4] && m[5] && m[6]) {
      const mo = MONTH_MAP[m[4].toLowerCase()];
      if (mo) { const iso = toISO(m[5], mo, m[6]); if (iso) dates.push(iso); }
    }
  }

  return [...new Set(dates)];
}

function classifyDates(text: string): { issuedDate?: string; expiryDate?: string } {
  const result: { issuedDate?: string; expiryDate?: string } = {};
  const upper = text.toUpperCase();

  // Look for contextual dates first
  const expiryKeywords = [
    /(?:expir(?:y|es|ation|ing)|valid\s*(?:until|to|through)|renew(?:al)?\s*(?:date|by|due)|end\s*date|lapse[sd]?)[:\s]*([^\n]{6,40})/gi,
    /(?:to|until|through)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
  ];

  const issuedKeywords = [
    /(?:issue[ds]?\s*(?:date)?|date\s*(?:of\s*)?issue|start\s*date|effective\s*(?:from|date)|granted|certified\s*(?:on|date)|registration\s*date|from\s*date|commencement)[:\s]*([^\n]{6,40})/gi,
    /(?:from)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/gi,
  ];

  for (const re of expiryKeywords) {
    for (const match of text.matchAll(re)) {
      const fragment = match[1].trim();
      const dates = findAllDates(fragment);
      if (dates.length > 0) { result.expiryDate = dates[0]; break; }
    }
    if (result.expiryDate) break;
  }

  for (const re of issuedKeywords) {
    for (const match of text.matchAll(re)) {
      const fragment = match[1].trim();
      const dates = findAllDates(fragment);
      if (dates.length > 0) { result.issuedDate = dates[0]; break; }
    }
    if (result.issuedDate) break;
  }

  // Fallback: all dates in text, earliest = issued, latest = expiry
  if (!result.issuedDate || !result.expiryDate) {
    const all = findAllDates(text).sort();
    if (all.length >= 2) {
      if (!result.issuedDate) result.issuedDate = all[0];
      if (!result.expiryDate) result.expiryDate = all[all.length - 1];
      if (result.issuedDate === result.expiryDate && all.length >= 2) {
        result.issuedDate = all[0];
        result.expiryDate = all[1];
      }
    } else if (all.length === 1 && !result.issuedDate && !result.expiryDate) {
      const hasExpiryContext = /EXPIR|VALID\s*UNTIL|RENEW|LAPSE/i.test(upper);
      if (hasExpiryContext) result.expiryDate = all[0];
      else result.issuedDate = all[0];
    }
  }

  return result;
}

// ─── Field extraction ────────────────────────────────────────

function extractProvider(text: string): string | undefined {
  const upper = text.toUpperCase();
  for (const p of KNOWN_PROVIDERS) {
    for (const alias of p.aliases) {
      if (upper.includes(alias)) return p.name;
    }
  }
  return undefined;
}

function extractReferenceNumber(text: string): string | undefined {
  const patterns = [
    // MCS-prefixed numbers
    /MCS[\s\-\/:]?\s*(\d{4,8}(?:[\-\/]\d+)?)/i,
    // NICEIC / NAPIT / ELECSA registration numbers
    /(?:NICEIC|NAPIT|ELECSA|OFTEC|HETAS|BPEC|GAS\s*SAFE|CSCS|ECS|JIB)[\s\-\/:#]*(\d{3,12})/i,
    // Explicit labels: "Certificate No:", "Reg No:", "Membership No:"
    /(?:certificate|cert|registration|reg|membership|policy|licence|license|accreditation|card|ref|reference|scheme)\s*(?:no\.?|number|num|#|:)\s*[:\s]*([A-Z0-9][\w\-\/]{2,20})/i,
    // Insurance policy patterns: "POL-1234567", "PLI/12345"
    /(?:POL|PLI|PII|EL|PI)[\s\-\/]*(\d{4,12})/i,
    // Generic standalone reference-like patterns (AB-12345 or ABC/12345)
    /\b([A-Z]{2,6}[\-\/]\d{3,12})\b/,
    // Pure numeric IDs near key labels
    /(?:id|no\.?|number)[:\s]+(\d{5,15})\b/i,
    // Card numbers (often on competency cards)
    /(?:card)\s*(?:no\.?|number|#)?[:\s]*([A-Z0-9][\w\-\/]{3,20})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const val = match[1].trim();
      if (val.length >= 3 && !/^0+$/.test(val)) return val;
    }
  }
  return undefined;
}

function extractCardNumber(text: string): string | undefined {
  const patterns = [
    /(?:card\s*(?:no\.?|number|#|id))[:\s]*([A-Z0-9][\w\-\/]{3,20})/i,
    /(?:cscs|ecs|jib)\s*(?:card)?[:\s]*#?\s*(\d{4,15})/i,
    /(?:registration|reg)\s*(?:no\.?|number|#)[:\s]*(\d{4,15})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractHolderName(text: string): string | undefined {
  const patterns = [
    /(?:this\s+(?:is\s+to\s+)?certif(?:y|ies)\s+(?:that)?|awarded\s+to|issued\s+to|holder|name\s+of\s+(?:card)?holder|cardholder|full\s*name|name)[:\s]+([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){1,3})/i,
    /(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+){1,3})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      const skipWords = ['THE', 'THIS', 'THAT', 'CERTIFICATE', 'CARD', 'DOCUMENT', 'SCHEME', 'ABOVE'];
      if (!skipWords.includes(name.toUpperCase()) && name.length > 3) return name;
    }
  }
  return undefined;
}

function extractQualificationType(text: string): string | undefined {
  const upper = text.toUpperCase();
  for (const qual of QUALIFICATION_TYPES) {
    if (upper.includes(qual.toUpperCase())) return qual;
  }
  return undefined;
}

function extractPolicyNumber(text: string): string | undefined {
  const patterns = [
    /(?:policy)\s*(?:no\.?|number|#|ref)[:\s]*([A-Z0-9][\w\-\/]{3,20})/i,
    /(?:indemnity|liability|insurance)\s*(?:no\.?|number|#|ref|policy)[:\s]*([A-Z0-9][\w\-\/]{3,20})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractMembershipId(text: string): string | undefined {
  const patterns = [
    /(?:membership|member)\s*(?:no\.?|number|id|#)[:\s]*([A-Z0-9][\w\-\/]{3,20})/i,
    /(?:consumer\s*code|RECC|HIES|REAL)\s*(?:membership|member|no\.?|#|id)?[:\s]*(\d{3,15})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractOrganizationName(text: string): string | undefined {
  const patterns = [
    /(?:employer|company|organisation|organization|firm|contractor|on\s+behalf\s+of)[:\s]+([A-Z][A-Za-z\s\-&'.]{2,40}?)(?:\s*[\n,.]|\s{2,})/i,
    /(?:employed\s+by|working\s+for)[:\s]+([A-Z][A-Za-z\s\-&'.]{2,40}?)(?:\s*[\n,.]|\s{2,})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      if (name.length > 2) return name;
    }
  }
  return undefined;
}

// ─── Main scan function ──────────────────────────────────────

export async function scanDocument(file: File): Promise<ScannedData> {
  let text = '';
  let confidence = 0;
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPDF) {
    // Try digital text extraction first
    text = await extractTextFromPDF(file);

    // If very little text found, render the PDF to an image and OCR it
    if (text.replace(/\s/g, '').length < 30) {
      console.log('PDF has little/no text layer, rendering to image for OCR...');
      const blob = await renderPDFPageToBlob(file, 1);
      if (blob) {
        const result = await ocrFromBlob(blob);
        text = result.text;
        confidence = result.confidence;
      }
    } else {
      confidence = 95; // Digital text is high confidence
    }
  } else {
    // Image file -- OCR directly
    const result = await ocrFromFile(file);
    text = result.text;
    confidence = result.confidence;
  }

  if (!text || text.replace(/\s/g, '').length < 10) {
    return { rawText: text || '', confidence: 0 };
  }

  // Clean up OCR artefacts
  const cleaned = text
    .replace(/[|]/g, 'I')    // common OCR confusion
    .replace(/[{}]/g, '')    // stray braces
    .replace(/\s{3,}/g, ' ') // collapse excessive whitespace
    .trim();

  const dates = classifyDates(cleaned);
  const referenceNumber = extractReferenceNumber(cleaned);
  const providerName = extractProvider(cleaned);
  const cardNumber = extractCardNumber(cleaned);
  const holderName = extractHolderName(cleaned);
  const qualificationType = extractQualificationType(cleaned);
  const policyNumber = extractPolicyNumber(cleaned);
  const membershipId = extractMembershipId(cleaned);
  const organizationName = extractOrganizationName(cleaned);

  return {
    ...dates,
    referenceNumber: referenceNumber || cardNumber || policyNumber || membershipId,
    providerName,
    cardNumber,
    holderName,
    qualificationType,
    organizationName,
    policyNumber,
    membershipId,
    rawText: cleaned.substring(0, 1500),
    confidence: Math.round(confidence),
  };
}
