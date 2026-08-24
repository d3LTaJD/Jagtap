/**
 * Deterministic Email Signature and Contact Details Extractor
 * Extracts Contact Person, Company Name, Mobile/Phone, Email, and Designation
 * from email signatures and body text.
 */

function extractContactDetails(bodyText, fromEmail = '', fromName = '') {
  const result = {
    contactPerson: null,
    companyName: null,
    mobileNumber: null,
    contactEmail: null,
    designation: null
  };

  if (!bodyText || typeof bodyText !== 'string') {
    if (fromName && fromName !== 'Email Sender' && !/@/.test(fromName)) {
      result.contactPerson = fromName.trim();
    }
    if (fromEmail) {
      result.contactEmail = fromEmail.trim();
    }
    return result;
  }

  // Clean HTML entities & tags
  const cleanBody = bodyText
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '');

  // Find signature boundary (e.g. Thanks & Regards, Best Regards, Sincerely, etc.)
  // Must match standard sign-off greetings at the bottom of the message
  const sigMatch = cleanBody.match(/(?:thanks\s*(?:&|and)\s*regards|best\s+regards|warm\s+regards|with\s+regards|kind\s+regards|regards|sincerely|yours\s+truly|cheers)\s*,?\s*([\s\S]+)$/i);
  const searchBlock = sigMatch ? sigMatch[1] : cleanBody;

  // 1. Mobile / Phone extraction
  const phoneMatch = searchBlock.match(/(?:contact|mob|mobile|tel|phone|ph|cell|m)\s*[:=–-]?\s*(\+?[\d\s-]{10,15})/i) ||
                     searchBlock.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/);
  if (phoneMatch) {
    const rawPhone = phoneMatch[1] ? phoneMatch[1].trim() : phoneMatch[0].trim();
    result.mobileNumber = rawPhone.replace(/\s+/g, ' ');
  }

  // 2. Email extraction
  const emailMatch = searchBlock.match(/(?:email|e-mail|mail)\s*[:=–-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) ||
                     searchBlock.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    const foundEmail = emailMatch[1] || emailMatch[0];
    if (!foundEmail.toLowerCase().includes('petrovalve')) {
      result.contactEmail = foundEmail.trim();
    }
  }

  // 3. Signature line-by-line parsing
  if (sigMatch) {
    const lines = sigMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('>') && !l.startsWith('--') && !l.startsWith('__') && !l.startsWith('=='));

    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      let line = lines[i];

      // Skip lines that are phone, email, website or greetings
      if (/(?:contact|mob|tel|phone|ph|email|e-mail|website|www|http)\s*[:=–-]/i.test(line)) continue;
      if (/@/.test(line)) continue;
      if (/^\+?[\d\s-]{10,}$/.test(line)) continue;
      if (/^(?:dear|to:|attn:|attention:)/i.test(line)) continue;
      if (/petro\s*valve/i.test(line)) continue; // Our own company name, skip

      // Clean prefix if any
      line = line.replace(/^(?:name|contact\s+person|person)\s*[:=–-]?\s*/i, '').trim();

      // Check for Company Name
      if (/\b(?:ltd|limited|pvt|corp|corporation|inc|incorporated|solutions|industries|enterprises|technologies|engineering|infra|projects|group|llc|co)\b/i.test(line)) {
        if (!result.companyName) {
          result.companyName = line.replace(/^(?:company|m\/s\.?|org)\s*[:=–-]?\s*/i, '').trim();
        }
        continue;
      }

      // Check for Designation (short phrase < 60 chars containing job titles)
      if (line.length <= 60 && /\b(?:engineer|manager|director|officer|executive|lead|head|procurement|purchase|commercial|consultant|president|founder|partner|vp|general\s+manager)\b/i.test(line)) {
        if (!result.designation) {
          result.designation = line;
        }
        continue;
      }

      // Check for Person Name (2-4 words, starts with uppercase letters, short < 40 chars)
      if (!result.contactPerson && line.length <= 40 && /^[A-Z][a-zA-Z'.]+(?:\s+[A-Z][a-zA-Z'.]+){1,3}$/.test(line)) {
        result.contactPerson = line;
        continue;
      }
    }
  }

  // Fallbacks if not extracted
  if (!result.contactPerson && fromName && fromName !== 'Email Sender' && !/@/.test(fromName) && !/petro\s*valve/i.test(fromName)) {
    result.contactPerson = fromName.trim();
  }
  if (!result.contactEmail && fromEmail) {
    result.contactEmail = fromEmail.trim();
  }

  return result;
}

module.exports = {
  extractContactDetails
};
