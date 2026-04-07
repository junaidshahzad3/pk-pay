/**
 * Formats a Date object into a string using the Pakistan Standard Time (PKT) 
 * timezone (UTC+5), as required by JazzCash and EasyPaisa gateways.
 * 
 * @param date - The date to format
 * @param format - The target format (e.g., 'YYYYMMDDHHmmss' or 'YYYYMMDD HHmmss')
 */
export function formatToPKT(date: Date, format: string): string {
  // PKT is UTC+5
  const pktDate = new Date(date.getTime() + 5 * 60 * 60 * 1000);

  const pad = (n: number) => String(n).padStart(2, '0');

  const replacements: Record<string, string> = {
    YYYY: String(pktDate.getUTCFullYear()),
    MM: pad(pktDate.getUTCMonth() + 1),
    DD: pad(pktDate.getUTCDate()),
    HH: pad(pktDate.getUTCHours()),
    mm: pad(pktDate.getUTCMinutes()),
    ss: pad(pktDate.getUTCSeconds()),
  };

  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => {
    const val = replacements[match];
    return val ?? match;
  });
}
