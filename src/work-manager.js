import { ScreepsAPI } from 'screeps-api'
import drivers from './drivers'

export default class WorkManager {
  constructor () {
    this.configs = []
    this.slowModes = {}
    this.lastRuns = {}
    this.queue = []
    this.output = drivers.output.Graphite
    setInterval(() => this.loop(), 5000)
    setInterval(() => this.processQueue(), 10)
  }
  
  async loop() {
    const now = Date.now()
    for (const config of this.configs) {
      const lastRun = this.lastRuns[config.pk] || 0
      const slowMode = this.slowModes[config.pk] || false
      const nextRun = lastRun + ((slowMode ? 300 : config.methodConfig.interval) * 1000)
      // console.log(`${config.pk}: ${lastRun} ${slowMode?'Slow':''} ${nextRun}`)
      if (nextRun < now) {
        this.lastRuns[config.pk] = now
        this.queue.push(config)
      }
    }
    console.log(`Queue: ${this.queue.length}`)
  }

  async processQueue() {
    const config = this.queue.shift()
    if (!config) return
    const conf = config.methodConfig || {}
    if (!conf.shards) {
      conf.shards = ['shard0']
      if (conf.shard) conf.shards = conf.shard.split(' ')
    }
    config.screepsAPIConfig.experimentalRetry429 = true
    const api = new ScreepsAPI(config.screepsAPIConfig)
    try {
      if (config.screepsAPIConfig.privateServer) {
        try {
          await api.auth(config.screepsAPIConfig.username, config.screepsAPIConfig.password)
        } catch (e) {
          this.slowModes[config.pk] = true
          throw e
        }
      }

      const { shards, segment, path } = conf
      const rets = await Promise.all(shards.map(shard => {
        if (segment) {
          return api.memory.segment.get(segment, shard)
        } else {
          return api.memory.get(path, shard)
        }
      }))
      if (!rets.filter(r => r.data).length) {
        let err = 'No stats returned'
        if (config.method === 'memory') {
          if (conf.segment) {
            err += ` for segment ${conf.segment} (Is it empty?)`
          } else {
            err += ` for Memory.${conf.path} (Does it exist?)`
          }
        }
        this.slowModes[config.pk] = true
        throw new Error(err)
      }
      for (const { data: stats } of rets) {
        const output = await this.formatStats(stats)
        try {
          await this.output({ username: config.username, prefix: conf.prefix }, output)
        } catch(e) {
          console.error('Error writing stats: ', e)
          throw new Error('Internal Server Error')
        }
      }
      this.slowModes[config.pk] = false
    } catch(err) {
      if (err.toString().includes('Not Authorized')) {
        this.slowModes[config.pk] = true
      }
      if (err.toString().includes('Rate limit exceeded')) {
        this.slowModes[config.pk] = true
      }
      console.log(`Error: ${config.pk} (${config.username}) ${err.toString()}`, err.stack)
      config.update({
        lastErrorText: err.toString(),
        lastErrorTime: Date.now()
      }).catch(() => process.exit(1)) // Hack: Force exit to restart
    }
  }

  formatStats (data) {
    if (data[0] === '{') data = JSON.parse(data)
    if (typeof data === 'object') {
      return {
        type: 'application/json',
        stats: data
      }
    }
    let [type, tick, time, ...stats] = data.split('\n')
    if (type.startsWith('text')) {
      stats = stats.map(s => `${s} ${time}`).join('\n') + '\n'
    }
    return { type, tick, time, stats }
  }
}