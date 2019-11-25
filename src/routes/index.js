import { json, send } from 'micro'
import dispatch from 'micro-route/dispatch'
import fs from 'fs'
import path from 'path'
import { ScreepsAPI } from 'screeps-api'

const AGENT_LIMIT = 5

export default dispatch()
  .dispatch('/username', 'GET', checkAuth)
  .dispatch('/agent', 'GET', getRecord)
  .dispatch('/agent', 'POST', createRecord)
  .dispatch('/agent/test', 'POST', checkRecord)
  .dispatch('/agent/:pk', 'POST', updateRecord)
  .dispatch('/agent/:pk', 'DELETE', deleteRecord)
  .dispatch('/', 'GET', (req, res) => {
    res.setHeader('content-type', 'text/html')
    return fs.createReadStream(path.join(__dirname, '../public/index.html'))
  })
  .dispatch('*', 'OPTIONS', async (req, res) => {
    await cors(res)
    res.end()
  })
  .dispatch('*', '*', (req, res) => send(res, 404, { error: 'Not Found' }))

async function cors (res) {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type,cookie')
  res.setHeader('access-control-allow-methods', 'OPTIONS,POST,GET,DELETE')
}

function checkAuth (req) {
  return (req.headers['token-claim-sub'] || req.headers['token-claim-user'] || '').toLowerCase()
}

async function unauthorized (res) {
  res.statusCode = 403
  return { error: 'unauthorized' }
}

async function getRecord (req, res) {
  await cors(res)
  const username = await checkAuth(req)
  if (!username) {
    return unauthorized(res)
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
  if (config.screepsAPIConfig) {
    if (config.screepsAPIConfig.privateServer) {
      if (config.screepsAPIConfig.password && config.screepsAPIConfig.password.match(/^\*{8}$/)) {
        delete config.screepsAPIConfig
      }
    } else {
      if (config.screepsAPIConfig.token && config.screepsAPIConfig.token.includes('*')) {
        delete config.screepsAPIConfig
      }
    }
  }
  config.lastErrorText = ''
  await req.db.Config.update(config, { where: { pk: config.pk, username } })
  const record = await req.db.Config.findOne({ where: { pk: config.pk, username } })
  await req.workManager.destroyWorker({ pk: config.pk })
  try {
    await req.workManager.createWorker(record)
  } catch (e) {
    await record.update({ lastErrorText: e.toString(), lastErrorTime: Date.now() })
  }
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

async function checkRecord (req, res) {
  await cors(res)
  const username = await checkAuth(req)
  if (!username) return unauthorized(res)
  let { pk, screepsAPIConfig, screepsAPIConfig: { token, username: authUsername, password: authPassword }, method, methodConfig: mc } = await json(req)
  const results = []
  try {
    if (token && token.includes('*')) {
      let record = await req.db.Config.findOne({ where: { pk, username } })
      token = record.screepsAPIConfig.token
      screepsAPIConfig.token = token
      results.push(`Masked token detected, using value from saved config (${token.slice(0, 8)})`)
    }
    if (authPassword && authPassword === '*'.repeat(8)) {
      let record = await req.db.Config.findOne({ where: { pk, username } })
      authPassword = record.screepsAPIConfig.password
      results.push(`Masked password detected, using value from saved config`)
    }
    const api = new ScreepsAPI(screepsAPIConfig)
    if (token) {
      const ti = await api.tokenInfo()
      if (!ti) {
        throw new Error(`Invalid Token (${token.slice(0, 8)})`)
      }
      if (ti.full) {
        results.push(`Full Access Token detected (${token.slice(0, 8)})`)
      } else {
        results.push(`Limited Access Token detected (${token.slice(0, 8)})`)
        const checkPerm = (perm) => {
          if (ti.endpoints.includes(perm)) {
            results.push(`Token has '${perm}' permission`)
          } else {
            throw new Error(`Token must have '${perm}' permission`)
          }
        }
        switch (method) {
          case 'console':
            if (ti.websockets && ti.websockets.includes('console')) {
              results.push(`Token has console permission`)
            } else {
              throw new Error(`Token must have 'console' permission`)
            }
            break
          case 'memory':
            if (mc.useSegment) {
              checkPerm('GET /api/user/memory-segment')
              if (ti.memorySegments) {
                if (ti.memorySegments.includes(mc.segment)) {
                  results.push(`Token has access to segment '${mc.segment}'`)
                } else {
                  throw new Error(`Token must have access to segment '${mc.segment}'`)
                }
              }
            } else {
              checkPerm('GET /api/user/memory')
            }
        }
      }
    } else {
      await api.auth(authUsername, authPassword)
      results.push('Login successful')
    }
    switch (method) {
      case 'memory':
        let from = ''
        let stats = ''
        if (mc.useSegment) {
          from = `Segment #${mc.segment}`
          let { data } = await api.segment.get(mc.segment, mc.shard)
          stats = data
        } else {
          from = `Memory.${mc.path}`
          const { data } = await api.memory.get(mc.path, mc.shard)
          stats = data
        }

        let cnt = 0
        if (typeof stats === 'string') {
          if (stats[0] === '{') {
            stats = JSON.parse(stats)
          } else {
            cnt = Math.max(0, stats.split('\n').length - 3)
          }
        }
        if (typeof stats === 'object') {
          let pre = `screeps.${username}.${mc.prefix}`
          if (pre.endsWith('.')) pre = pre.slice(0, -1)
          const data = flattenObj({}, pre, stats)
          cnt = Object.keys(data).length
        }

        results.push(`Read ${cnt} stats from ${from} on ${mc.shard}`)
    }
  } catch (err) {
    results.push(err.message)
  }
  return results
}

function flattenObj (ret, path, obj) {
  if (typeof obj === 'object') {
    for (let k in obj) {
      flattenObj(ret, `${path}.${k}`, obj[k])
    }
  } else {
    ret[path] = obj
  }
  return ret
}
