/**
 * ID generator for Invoices and Certificates
 */

export function generateInvoiceNumber(existingInvoiceNumbers: string[]): string {
  const year = new Date().getFullYear();
  let sequence = 1;
  
  // Find highest sequence for current year
  const prefix = `LT-INV-${year}-`;
  const relevantInvoices = existingInvoiceNumbers.filter(num => num.startsWith(prefix));
  
  if (relevantInvoices.length > 0) {
    const sequences = relevantInvoices.map(num => {
      const parts = num.split('-');
      const seqPart = parts[parts.length - 1];
      const seq = parseInt(seqPart, 10);
      return isNaN(seq) ? 0 : seq;
    });
    const maxSeq = Math.max(...sequences, 0);
    sequence = maxSeq + 1;
  }
  
  const paddedSeq = String(sequence).padStart(3, '0');
  const result = `LT-INV-${year}-${paddedSeq}`;
  
  // Safeguard just in case
  if (existingInvoiceNumbers.includes(result)) {
    return generateInvoiceNumber([...existingInvoiceNumbers, result]);
  }
  
  return result;
}

export function generateCertificateId(existingIds: string[]): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  function makeRandomSuffix(): string {
    let text = '';
    for (let i = 0; i < 4; i++) {
      text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
  }
  
  let randomId = `LT-CERT-${year}-${makeRandomSuffix()}`;
  let attempts = 0;
  
  // Regenerate if duplicate
  while (existingIds.includes(randomId) && attempts < 100) {
    randomId = `LT-CERT-${year}-${makeRandomSuffix()}`;
    attempts++;
  }
  
  return randomId;
}
