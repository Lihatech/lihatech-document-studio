/**
 * Converts a number to words in English (with support for INR/Lakh/Crore style and USD/EUR Millions style)
 */
export function amountToWords(amount: number, currency: 'INR' | 'USD' | 'EUR' = 'INR'): string {
  if (amount === 0) return 'Zero Only';
  
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertLessThanOneThousand(num: number): string {
    let str = '';
    if (num >= 100) {
      str += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 200) { // Wait, ones/tens logic:
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num > 0) {
      str += ones[num] + ' ';
    }
    return str.trim();
  }

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let wordResult = '';

  if (currency === 'INR') {
    // Indian Numbering System (Lakh, Crore)
    let temp = integerPart;
    const crore = Math.floor(temp / 10000000);
    temp %= 10000000;
    const lakh = Math.floor(temp / 100000);
    temp %= 100000;
    const thousand = Math.floor(temp / 1000);
    temp %= 1000;
    const remaining = temp;

    let chunks: string[] = [];
    if (crore > 0) chunks.push(convertLessThanOneThousand(crore) + ' Crore');
    if (lakh > 0) chunks.push(convertLessThanOneThousand(lakh) + ' Lakh');
    if (thousand > 0) chunks.push(convertLessThanOneThousand(thousand) + ' Thousand');
    if (remaining > 0) chunks.push(convertLessThanOneThousand(remaining));
    
    wordResult = chunks.join(' ');
  } else {
    // Western Numbering System (Million, Billion)
    let temp = integerPart;
    const billion = Math.floor(temp / 1000000000);
    temp %= 1000000000;
    const million = Math.floor(temp / 1000000);
    temp %= 1000000;
    const thousand = Math.floor(temp / 1000);
    temp %= 1000;
    const remaining = temp;

    let chunks: string[] = [];
    if (billion > 0) chunks.push(convertLessThanOneThousand(billion) + ' Billion');
    if (million > 0) chunks.push(convertLessThanOneThousand(million) + ' Million');
    if (thousand > 0) chunks.push(convertLessThanOneThousand(thousand) + ' Thousand');
    if (remaining > 0) chunks.push(convertLessThanOneThousand(remaining));
    
    wordResult = chunks.join(' ');
  }

  wordResult = wordResult.trim();

  // Add Currency Prefixes / Suffixes
  let currencyLabel = '';
  let subCurrencyLabel = '';
  
  if (currency === 'INR') {
    currencyLabel = 'Rupees';
    subCurrencyLabel = 'Paise';
  } else if (currency === 'USD') {
    currencyLabel = 'US Dollars';
    subCurrencyLabel = 'Cents';
  } else if (currency === 'EUR') {
    currencyLabel = 'Euros';
    subCurrencyLabel = 'Cents';
  }

  let finalWords = `${currencyLabel} ${wordResult}`;
  
  if (decimalPart > 0) {
    const decimalWords = convertLessThanOneThousand(decimalPart);
    finalWords += ` and ${decimalWords} ${subCurrencyLabel}`;
  }
  
  return `${finalWords} Only`.replace(/\s+/g, ' ');
}
