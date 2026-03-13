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

const COLLECTION = 'shared_analyses'

// Fields to fetch for list view (metadata + summary KPIs, no heavy JSON)
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
