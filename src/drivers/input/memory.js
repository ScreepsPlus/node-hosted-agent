import { EventEmitter } from 'events'

export default class Memory extends EventEmitter {
  constructor (api, config = {}) {
    super()
    this.api = api
  }

  async start ({ shard, path, segment, interval }) {
    await this.stop()
    this.interval = setInterval(() => this.tick(path, shard, segment), interval * 1000)
  }

  async stop () {
    clearInterval(this.interval)
  }

  async tick (path, shard, segment) {
    try {
      let ret
      if (segment) {
        ret = await this.api.memory.segment.get(segment, shard)
      } else {
        ret = await this.api.memory.get(path, shard)
      }
      this.emit('stats', ret.data)
    } catch (e) {
      this.emit('error', e)
    }
  }
}
