import { json } from 'micro'
import dispatch from 'micro-route/dispatch'

export default dispatch()
  .dispatch('/agent', 'GET', getRecord)
  .dispatch('/agent', 'POST', createRecord)
  .dispatch('/agent/Lud', 'DELETE', deleteRecord)

async function getRecord (req, res, { query }) {
  if (!query.token) {
    return []
  }
  let records = await req.db.Config.findAll({ screepsplusToken: req.token })
  records.forEach(cleanRecord)
  return records
}

async function createRecord (req, res) {
  let config = await json(req)
  let record = await req.db.Config.create(config)
  return cleanRecord(record)
}

async function deleteRecord (req, res, { query, params }) {
  if (!query.token || !params.pk) {
    return { error: 'Must provide token and pk' }
  }
}

function cleanRecord (rec) {
  delete rec.screepsplusToken
  delete rec.screepsToken
  return rec
}
