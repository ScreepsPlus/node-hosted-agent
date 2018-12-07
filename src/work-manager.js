import { ScreepsAPI } from 'screeps-api'
import drivers from './drivers'

export default class WorkManager {
  constructor () {
    this.workers = {}
    this.output = drivers.output.Graphite
  }
  async createWorker (config) {
    if (this.workers[config.pk]) {
      await this.destroyWorker(config.pk)
    }
    console.log('Starting Worker', config.username, config.methodConfig)
    let conf = config.methodConfig || {}
    const api = new ScreepsAPI(config.screepsAPIConfig)
    const driver = new drivers.input[config.method](api, conf)
    driver.on('stats', async (stats) => {
      try {
        stats = await this.formatStats(stats)
        await this.output({ username: config.username, prefix: conf.prefix }, stats)
      } catch (e) {
        console.error(`Error handling stats for ${config.pk}`, e)
      }
    })
    await driver.start(conf)
    this.workers[config.pk] = {
      api,
      driver,
      config
    }
  }
  async destroyWorker (pk) {
    let { driver } = this.workers[pk] || {}
    if (driver) {
      console.log('Stopping Worker')
      await driver.stop()
      delete this.workers[pk]
    }
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
