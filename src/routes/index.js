import { json, send } from 'micro'
import dispatch from 'micro-route/dispatch'
import fs from 'fs'
import path from 'path'

const AGENT_LIMIT = 5

export default dispatch()
  .dispatch('/username', 'GET', checkAuth)
  .dispatch('/agent', 'GET', getRecord)
  .dispatch('/agent', 'POST', createRecord)
  .dispatch('/agent/:pk', 'POST', updateRecord)
  .dispatch('/agent/:pk', 'DELETE', deleteRecord)
  .dispatch('/', 'GET', (req, res) => {
    res.setHeader('content-type','text/html')
    return fs.createReadStream(path.join(__dirname, '../public/index.html'))
  })
  .dispatch('*','OPTIONS', async (req, res) => {
    await cors(res)
    res.end()
  })
  .dispatch('*', '*', (req, res) => send(res, 404, { error: 'Not Found' }))

async function cors(res) {
  res.setHeader('access-control-allow-origin','*')
  res.setHeader('access-control-allow-headers','content-type,cookie')
  res.setHeader('access-control-allow-methods','OPTIONS,POST,GET,DELETE')
}

function checkAuth(req) {
  return req.headers['token-claim-sub'] || req.headers['token-claim-user'] || false
}

async function unauthorized(res) {
  res.statusCode = 403
  return { error: 'unauthorized' }
}

async function getRecord (req, res) {
  await cors(res)
  const username = await checkAuth(req)
  if (!username) {
    return []
  }
  let records = await req.db.Config.findAll({ where: { username } })
  return records.map(cleanRecord)
}

async function createRecord (req, res) {
  await cors(res)
  const username = await checkAuth(req)
  if (!username) return unauthorized(res)
  let config = await json(req)
  config.username = username
  let cnt = await req.db.Config.count({ where: { username } })
  if (cnt >= AGENT_LIMIT) return send(403, { error: 'Agent Limit Reached' })
  let record = await req.db.Config.create(config)
  await req.workManager.createWorker(record)
  return cleanRecord(record)
}

async function updateRecord (req, res) {
  await cors(res)
  const username = await checkAuth(req)
  if (!username) return unauthorized(res)
  let config = await json(req)
  if (config.screepsAPIConfig && config.screepsAPIConfig.token && config.screepsAPIConfig.token.includes('*')) {
    delete config.screepsAPIConfig
  }
  if (config.screepsAPIConfig && config.screepsAPIConfig.password && config.screepsAPIConfig.password.match(/^\*{8}$/)) {
    delete config.screepsAPIConfig
  }
  await req.db.Config.update(config, { where: { pk: config.pk, username } })
  const record = await req.db.Config.find({ where: { pk: config.pk, username } })
  await req.workManager.destroyWorker({ pk: config.pk })
  await req.workManager.createWorker(record)
  return cleanRecord(record)
}

async function deleteRecord (req, res, { params: { pk } = {} }) {
  await cors(res)
  const username = await checkAuth(req)
  if (!username) return unauthorized(res)
  if (!pk) {
    return { error: 'Must provide pk' }
  }
  await req.workManager.destroyWorker(pk)
  const cnt = await req.db.Config.destroy({ where: { pk, username } })
  return { deleted: cnt }
}

function cleanRecord (rec) {
  const data = rec.toJSON()
  if (data.screepsAPIConfig.password) {
    data.screepsAPIConfig.password = '*'.repeat(8)
  }
  if (data.screepsAPIConfig.token) {
    data.screepsAPIConfig.token = data.screepsAPIConfig.token.replace(/^(.{8}).*$/, '$1-****-****-****-************')
  }
  return data
}
