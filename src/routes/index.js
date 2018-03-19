import { json, send } from 'micro'
import dispatch from 'micro-route/dispatch'

const AGENT_LIMIT = 5

export default dispatch()
  .dispatch('/agent', 'GET', getRecord)
  .dispatch('/agent', 'POST', createRecord)
  .dispatch('/agent/:pk', 'POST', updateRecord)
  .dispatch('/agent/:pk', 'DELETE', deleteRecord)
  .dispatch('*', '*', (req, res) => send(res, 404, { error: 'Not Found' }))

async function getRecord (req, res, { query: { token: screepsPlusToken } }) {
  if (!screepsPlusToken) {
    return []
  }
  let records = await req.db.Config.findAll({ where: { screepsPlusToken } })
  return records.map(cleanRecord)
}

async function createRecord (req, res) {
  let config = await json(req)
  let cnt = await req.db.Config.count({ where: { screepsPlusToken: config.screepsPlusToken } })
  if (cnt > AGENT_LIMIT) return send(403, { error: 'Agent Limit Reached' })
  let record = await req.db.Config.create(config)
  await req.workManager.createWorker(record)
  return cleanRecord(record)
}

async function updateRecord (req, res) {
  let config = await json(req)
  let record = await req.db.Config.update(config, { where: { pk: config.pk } })
  await req.workManager.destroyWorker({ pk: config.pk })
  await req.workManager.createWorker(config)
  return cleanRecord(record)
}

async function deleteRecord (req, res, { params: { pk } = {} }) {
  if (!pk) {
    return { error: 'Must provide token and pk' }
  }
  await req.workManager.destroyWorker(pk)
  let cnt = await req.db.Config.destroy({ where: { pk } })
  return { deleted: cnt }
}

function cleanRecord (rec) {
  rec.screepsPlusToken = true
  rec.screepsToken = true
  return rec
}
