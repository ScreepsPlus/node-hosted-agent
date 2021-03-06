import net from 'net'

class TCPConnection {
  constructor (host, port) {
    this.port = port
    this.host = host
    this.connecting = null
  }
  get connected () {
    return !!this.socket
  }
  async connect () {
    if (this.socket) return this.socket
    if (this.connecting) return this.connecting
    this.connecting = new Promise((resolve, reject) => {
      const sock = net.connect(this.port, this.host)
      sock.once('error', reject)
      sock.once('connect', () => {
        this.socket = sock
        sock.on('error', (e) => {
          this.socket = null
          console.error(e)
        })
        this.connecting = null
        resolve(sock)
      })
    })
    return this.connecting
  }
  async write (data) {
    const sock = await this.connect()
    sock.write(data)
  }
}

const conn = new TCPConnection(process.env.GRAPHITE_HOST || 'graphite', process.env.GRAPHITE_PORT || '2003')

export default async function handle ({ username, prefix = '' } = {}, { type, stats }) {
  if (!username) throw new Error('Username required')
  const out = []
  if (prefix && !prefix.endsWith('.')) prefix += '.'
  if (type.match(/^text\/gra(phite|fana)$/)) {
    stats = stats.split('\n').filter(Boolean)
    for (const stat of stats) {
      let [, key, value, time] = stat.match(/^(\S+) ([\d.-]+) (\d+)$/) || []
      if (!key || !value || !time) {
        continue
      }
      time = parseInt(time)
      if (Date.now() / 1000 < time - 1000) {
        time /= 1000
      }
      value = parseFloat(value)
      value = Math.round(value * 1000) / 1000
      out.push(`screeps.${username}.${prefix}${key} ${value} ${time}`)
    }
  }
  if (type === 'application/json') {
    const ts = Math.round(Date.now() / 1000)
    let pre = `screeps.${username}.${prefix}`
    if (pre.endsWith('.')) pre = pre.slice(0, -1)
    const data = flattenObj({}, pre, stats)
    for (const key in data) {
      const value = Math.round(parseFloat(data[key]) * 1000) / 1000
      const stat = `${key} ${value} ${ts}`
      out.push(stat)
    }
  }
  console.log(`Writing ${out.length} stats for user ${username} with prefix '${prefix}'`)
  await conn.write(out.join('\n') + '\n')
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
