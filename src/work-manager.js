import { ScreepsAPI } from 'screeps-api'
import drivers from './drivers'

export default class WorkManager {
  constructor () {
    this.workers = {}
    this.output = drivers.output.ScreepsPlus
  }
  async createWorker (config) {
    if (this.workers[config.pk]) {
      await this.destroyWorker(config.pk)
    }
    const api = new ScreepsAPI({ token: config.screepsToken })
    const driver = new drivers.input[config.method](api)
    driver.on('stats', async (stats) => {
      try {
        stats = await this.formatStats(stats)
        await this.output({ token: config.screepsPlusToken }, stats)
      } catch (e) {
        console.error(`Error handling stats for ${config.pk}`, e)
      }
    })
    await driver.start(config.screeps)
    this.workers[config.pk] = {
      api,
      driver,
      config
    }
  }
  async destroyWorker (pk) {
    let { driver } = this.workers[pk]
    await driver.stop()
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
