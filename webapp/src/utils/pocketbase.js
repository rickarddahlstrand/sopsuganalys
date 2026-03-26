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

// --- Legacy shared_analyses (kept for backwards compatibility) ---

const COLLECTION = 'shared_analyses'

const LIST_FIELDS =
  'id,created,facility_name,schema_version,date_range_start,date_range_end,file_count,summary_kpi'

export async function uploadAnalysis(payload) {
  const client = getPb()
  if (!client) throw new Error('PocketBase är inte konfigurerad')
  return client.collection(COLLECTION).create(payload)
}

export async function listAnalyses({ page = 1, perPage = 12, sort = '-created' } = {}) {
  const client = getPb()
  if (!client) throw new Error('PocketBase är inte konfigurerad')
  return client.collection(COLLECTION).getList(page, perPage, {
    sort,
    fields: LIST_FIELDS,
  })
}

export async function getAnalysis(id) {
  const client = getPb()
  if (!client) throw new Error('PocketBase är inte konfigurerad')
  return client.collection(COLLECTION).getOne(id)
}

// --- New facility_uploads collection ---

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

  const downloadFiles = async (filenames, fieldName) => {
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
    downloadFiles(record.xls_files, 'xls_files'),
    downloadFiles(record.csv_files, 'csv_files'),
  ])

  return { xlsFiles, csvFiles }
}
