import { json } from 'micro'

export async function GET (req, res) {
  if (!req.query.token) {
    return []
  }
  let records = await req.db.Config.findAll({ screepsplusToken: req.token })
  records.forEach(cleanRecord)
  return records
}

export async function POST (req, res) {
  let config = await json(req)
  let record = await req.db.Config.create(config)
  return cleanRecord(record)
}

export async function DELETE (req, res) {
  if (!req.query.token || !req.token.pk) {
    return { error: 'Must provide token and pk' }
  }
}

function cleanRecord (rec) {
  delete rec.screepsplusToken
  delete rec.screepsToken
  return rec
}
