import PocketBase from 'pocketbase'

let pb = null

export function getPb() {
  if (pb) return pb
  const url =
    import.meta.env.VITE_POCKETBASE_URL ||
    localStorage.getItem('sopsug-pb-url') ||
    window.location.origin
  pb = new PocketBase(url)
  return pb
}

/**
 * Översätter vanliga PocketBase/HTTP-felmeddelanden till svensk användartext.
 * Fungerar både på `Error`-objekt och rena strängar.
 * Tekniska detaljer (originalmeddelande/status) loggas separat via console.error.
 */
export function translatePbError(err) {
  if (!err) return 'Okänt fel.'
  const raw = typeof err === 'string' ? err : (err.message || '')
  const lower = raw.toLowerCase()
  const status = typeof err === 'object' ? err.status : undefined

  // Nätverksfel / abort
  if (lower.includes('failed to fetch') || lower.includes('networkerror') ||
      lower.includes('network error') || lower.includes('load failed')) {
    return 'Servern svarade inte. Kontrollera att PocketBase är tillgänglig.'
  }
  if (lower.includes('aborted') || lower.includes('autocancelled')) {
    return 'Anropet avbröts.'
  }

  // PocketBase generiska meddelanden
  if (lower.includes('something went wrong while processing your request')) {
    if (status === 0 || status === undefined) {
      return 'Servern svarade inte. Kontrollera att PocketBase är tillgänglig.'
    }
    if (status === 401 || status === 403) {
      return 'Behörighet saknas för att hämta data.'
    }
    if (status === 404) {
      return 'Resursen hittades inte.'
    }
    if (status >= 500) {
      return 'Serverfel. Försök igen senare.'
    }
    return 'Anslutningen misslyckades.'
  }

  // Statuskodbaserade fall
  if (status === 0) return 'Servern svarade inte. Kontrollera att PocketBase är tillgänglig.'
  if (status === 401 || status === 403) return 'Behörighet saknas för att hämta data.'
  if (status === 404) return 'Resursen hittades inte.'
  if (typeof status === 'number' && status >= 500) return 'Serverfel. Försök igen senare.'

  // Returnera ursprunglig text om den redan ser svensk ut, annars en generisk svensk fallback
  if (/[åäöÅÄÖ]/.test(raw) || raw === '') {
    return raw || 'Anslutningen misslyckades.'
  }
  return 'Anslutningen misslyckades.'
}

// --- facility_uploads collection (original files + summary KPI) ---

const FACILITY_COLLECTION = 'facility_uploads'

const FACILITY_LIST_FIELDS =
  'id,created,facility_name,date_range_start,date_range_end,file_count,summary_kpi'

/**
 * Upload original files + metadata to facility_uploads.
 * @param {FormData} formData - must contain facility_name, date_range_start, date_range_end,
 *   file_count, and file fields xls_files / csv_files, plus optional summary_kpi (JSON string).
 */
export async function uploadFacility(formData) {
  const client = getPb()
  if (!client) throw new Error('PocketBase är inte konfigurerad')
  return client.collection(FACILITY_COLLECTION).create(formData)
}

/**
 * List facility uploads (metadata only, no file content).
 */
export async function listFacilities({ page = 1, perPage = 12, sort = '-created' } = {}) {
  const client = getPb()
  if (!client) throw new Error('PocketBase är inte konfigurerad')
  return client.collection(FACILITY_COLLECTION).getList(page, perPage, {
    sort,
    fields: FACILITY_LIST_FIELDS,
  })
}

/**
 * Get a single facility record (full record with file field names).
 */
export async function getFacility(id) {
  const client = getPb()
  if (!client) throw new Error('PocketBase är inte konfigurerad')
  return client.collection(FACILITY_COLLECTION).getOne(id)
}

/**
 * Download the actual files from a facility record.
 * Returns { xlsFiles: File[], csvFiles: File[] }
 */
export async function getFacilityFiles(record) {
  const client = getPb()
  if (!client) throw new Error('PocketBase är inte konfigurerad')

  const downloadFiles = async (filenames) => {
    if (!filenames?.length) return []
    const results = []
    for (const filename of filenames) {
      const url = client.files.getURL(record, filename)
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`Kunde inte ladda ner ${filename}`)
      const blob = await resp.blob()
      results.push(new File([blob], filename))
    }
    return results
  }

  const [xlsFiles, csvFiles] = await Promise.all([
    downloadFiles(record.xls_files),
    downloadFiles(record.csv_files),
  ])

  return { xlsFiles, csvFiles }
}
