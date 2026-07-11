/**
 * Splits a large text into smaller overlapping chunks.
 * We use overlapping chunks to ensure that context isn't lost if a sentence
 * gets cut exactly at the boundary.
 * 
 * @param text The full raw text extracted from the document
 * @param chunkSize The maximum number of characters per chunk
 * @param overlap The number of characters to overlap between chunks
 * @returns An array of string chunks
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  if (!text || text.trim().length === 0) return [];
  
  // Clean up excessive whitespace
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  const chunks: string[] = [];
  let i = 0;
  
  while (i < cleanText.length) {
    const chunk = cleanText.slice(i, i + chunkSize);
    chunks.push(chunk);
    
    // If we've reached the end, break
    if (i + chunkSize >= cleanText.length) {
      break;
    }
    
    // Move the pointer forward, but step back by the overlap amount
    i += (chunkSize - overlap);
  }
  
  return chunks;
}
