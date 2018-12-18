import { ScreepsAPI } from 'screeps-api'
import drivers from './drivers'
import { EventEmitter } from 'events'

export class Worker extends EventEmitter {
  constructor() {
    super()
    this.output = drivers.output.Graphite
  }
  async start (config) {
    let conf = config.methodConfig || {}
    const api = new ScreepsAPI(config.screepsAPIConfig)
    const driver = this.driver = new drivers.input[config.method](api, conf)
    driver.on('stats', async (stats) => {
      try {
        if(!stats) {
          let err = 'No stats returned'
          if(config.method === 'memory') {
            if(conf.segment) {
              err += ` for segment ${conf.segment} (Is it empty?)`
            } else {
              err += ` for Memory.${conf.path} (Does it exist?)`
            }
          }
          throw new Error(err)
        }
        stats = await this.formatStats(stats)
        await this.output({ username: config.username, prefix: conf.prefix }, stats)
      } catch (e) {
        console.error(`Error handling stats for ${config.pk}`, e)
        this.emit('error', e)
      }
    })
    driver.on('error', (err) => this.emit('error', err))
    await this.driver.start(conf)
  }
  async stop () {
    await this.driver.stop()
  }
  async formatStats (data) {
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

export default class WorkManager {
  constructor () {
    this.workers = {}
  }
  async createWorker (config) {
    if (this.workers[config.pk]) {
      await this.destroyWorker(config.pk)
    }
    console.log('Starting Worker', config.username, config.methodConfig)
    const worker = new Worker()
    await worker.start(config)
    this.workers[config.pk] = worker
    return worker
  }
  async destroyWorker (pk) {
    const worker = this.workers[pk]
    if (worker)  {
      console.log('Stopping Worker')
      await worker.stop()
      delete this.workers[pk]
    }
  }
}
