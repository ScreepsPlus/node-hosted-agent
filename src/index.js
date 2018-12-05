import path from 'path'
import Sequelize from 'sequelize'

import routes from './routes'

import WorkManager from './work-manager'
import ConfigModel from './models/config'

const sequelize = new Sequelize(process.env.DB_DATABASE || 'agent', process.env.DB_USER || 'username', process.env.DB_PASS || 'password', {
  operatorsAliases: false,
  host: process.env.DB_HOST || 'localhost',
  dialect: process.env.DB_DIALECT || 'sqlite',
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  storage: process.env.DB_PATH || path.join(__dirname, '../agent.sqlite')
})

const Config = ConfigModel(sequelize, Sequelize)

const workManager = new WorkManager()

async function setup (fn) {
  await Config.sync()
  await startAll()
  return function (req, res) {
    req.db = { Config }
    req.workManager = workManager
    return fn(req, res)
  }
}
module.exports = setup(routes)

async function startAll () {
  let configs = await Config.findAll()
  configs.forEach(async config => {
    try {
      await workManager.createWorker(config)
    } catch (err) {
      console.error('Cannot create worker', config.pk, err)
    }
  })
}
