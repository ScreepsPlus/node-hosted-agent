import { EventEmitter } from 'events'

export default class Memory extends EventEmitter {
  constructor (api, config = {}) {
    super()
    this.api = api
  }

  async start ({ shards, path, segment, interval }) {
    await this.stop()
    this.interval = setInterval(() => this.tick(path, shards, segment), interval * 1000)
  }

  async stop () {
    clearInterval(this.interval)
  }

  async tick (path, shards, segment) {
    try {
      let ret
      const rets = await Promise.all(shards.map(shard => {
        if (segment) {
          return this.api.memory.segment.get(segment, shard)
        } else {
          return this.api.memory.get(path, shard)
        }
      }))
      rets.forEach(ret => this.emit('stats', ret.data))
    } catch (e) {
      this.emit('error', e)
    }
  }
}
