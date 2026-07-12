const inchToMmMap = {
  '1/2': '15',
  '3/4': '20',
  '1': '25',
  '1-1/4': '32',
  '1.1/4': '32',
  '1.25': '32',
  '1-1/2': '40',
  '1.1/2': '40',
  '1.5': '40',
  '2': '50',
  '2-1/2': '65',
  '2.1/2': '65',
  '2.5': '65',
  '3': '80',
  '4': '100',
  '5': '125',
  '6': '150',
  '8': '200',
  '10': '250',
  '12': '300',
  '14': '350',
  '16': '400',
  '18': '450',
  '20': '500',
  '24': '600',
  '26': '650',
  '28': '700',
  '30': '750',
  '32': '800',
  '36': '900',
  '40': '1000',
  '48': '1200',
  '54': '1350',
  '60': '1500'
};

/**
 * Formats a raw size value (e.g. '2"', '10', '1/2') to standard 'X mm' format.
 */
export const formatSizeToMm = (sizeStr) => {
  if (sizeStr === undefined || sizeStr === null || sizeStr === '') return '';
  const str = String(sizeStr).trim();

  // If it's a simple number or fraction with optional inch/mm symbols
  const match = str.match(/^([0-9\/\.\-]+)\s*(?:inch|inches|in|nb|dn|mm|\"|\')?$/i) || 
                str.match(/^(?:dn)\s*([0-9]+)$/i);
  
  if (match) {
    const rawVal = match[1].toLowerCase().replace(/[\"\']/g, '').trim();
    if (inchToMmMap[rawVal]) {
      return `${inchToMmMap[rawVal]} mm`;
    }
    // If it is already in mm (a large number)
    if (/^\d+$/.test(rawVal)) {
      const valNum = parseInt(rawVal, 10);
      if (valNum >= 15) {
        return `${valNum} mm`;
      }
    }
  }

  // Fallback to inline text replacement
  return formatTextToMm(str);
};

/**
 * Scans a description string and replaces all occurrences of inch sizes (e.g. 2", 10", 1/2") with their mm equivalent (50 mm, 250 mm, 15 mm).
 */
export const formatTextToMm = (text) => {
  if (!text) return '';
  let processed = String(text);

  // Replace fractional and decimal inches like 1-1/2", 1 1/2", 1/2", 2.5", 2"
  processed = processed.replace(/\b([0-9]+[\-\s][0-9]+\/[0-9]+|[0-9]+\/[0-9]+|[0-9]+(?:\.[0-9]+)?)\s*(?:inch|inches|in|\"|\'\')/gi, (m, val) => {
    const key = val.trim().replace(/\s+/g, '-');
    if (inchToMmMap[key]) {
      return `${inchToMmMap[key]} mm`;
    }
    return m;
  });

  return processed;
};
