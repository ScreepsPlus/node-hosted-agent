import axios from 'axios'
import { Agent } from 'http'

const conn = new TCPConnection(process.env.GRAPHITE_HOST || 'graphite', process.env.GRAPHITE_PORT || '2003')

let http = axios.create({
  baseURL: process.env.INFLUXDB_URL || 'http://influxdb:8086',
  httpAgent: new Agent({ keepAlive: true }),
  auth: {
    username: process.env.INFLUXDB_USERNAME,
    password: process.env.INFLUXDB_PASSWORD
  }
})

export default async function handle ({ username, prefix = '' } = {}, { type, stats }) {
  if (!username) throw new Error('Username required')

  async function query(strings, ...values) {
    let sql = strings.shift()
    for(const v of values) {
      sql += values + strings.shift()
    }
    const { data } = await http.GET('/query', {
      query: {
        db: username,
        q: sql
      }
    })
    return data
  }
  
  const out = []
  if (prefix && !prefix.endsWith('.')) prefix += '.'
  if (type.match(/^text\/influxdb$/)) {
    stats = stats.split("\n").filter(Boolean)
    for (const stat of stats) {
      let [, key, value, time] = stat.match(/^(\S+) (\S+)(?: (\d+))?$/) || []
      if (!key || !value) {
        continue
      }
      time = parseInt(time) || Date.now()
      if (Date.now() / 1000 < time - 1000) {
        time /= 1000
      }
      out.push(`${key} ${value} ${time}`)
    }
  }
  if (type === 'application/json') {
    const ts = Math.round(Date.now() / 1000)
    let pre = prefix
    if(pre.endsWith('.')) pre = pre.slice(0,-1)
    const data = flattenObj({}, pre, stats)
    for(const key in data) {
      const value = Math.round(parseFloat(data[key]) * 1000) / 1000
      const stat = `${key} value=${value} ${ts}`
      out.push(stat)
    }
  }
  console.log(`Writing ${out.length} stats for user ${username} with prefix '${prefix}'`)
  await conn.write(out.join("\n") + "\n")

  await query`CREATE DATABASE ${username} WITH DURATION 1w REPLICATION 1 NAME "1w_stats"`
  await http.post('/write', {
    query: {
      db: username,
      precision: 's',
      rp: '1w_stats',
    },
    data: out.join("\n") + "\n"
  }
}

function flattenObj (ret, path, obj) {
  if (typeof obj == 'object') {
    for (let k in obj) {
      flattenObj(ret, path ? `${path}.${k}` : k, obj[k])
    }
  } else {
    ret[path] = obj
  }
  return ret
}