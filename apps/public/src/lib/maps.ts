/** Google Maps embed URL for a search query (output=embed renders without an API key). */
export function mapEmbedUrl(baseUrl: string, query: string): string {
  return `${baseUrl}?q=${encodeURIComponent(query)}&output=embed`
}

/** Link that opens the same search in Google Maps itself. */
export function mapOpenUrl(baseUrl: string, query: string): string {
  return `${baseUrl}?q=${encodeURIComponent(query)}`
}
