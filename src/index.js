import path from 'path'
import Sequelize from 'sequelize'
import Umzug from 'umzug'

import routes from './routes'

import WorkManager from './work-manager'
import ConfigModel from './models/config'

const sequelize = new Sequelize(process.env.DB_DATABASE || 'agent', process.env.DB_USER || 'username', process.env.DB_PASS || 'password', {
  host: process.env.DB_HOST || 'localhost',
  dialect: process.env.DB_DIALECT || 'sqlite',
  pool: {
    max: 40,
    min: 5,
    acquire: 20000,
    idle: 20000,
    evict: 30000
  },
  storage: process.env.DB_PATH || path.join(__dirname, '../agent.sqlite'),
  logging: process.env.NODE_ENV === 'production' ? () => {} : console.log
})

const Config = ConfigModel(sequelize, Sequelize)

const workManager = new WorkManager()

const slowModes = {}
const lastRuns = {}
const queue = []

async function setup (fn) {
  const umzug = new Umzug({
    storage: 'sequelize',
    storageOptions: { sequelize },
    migrations: {
      params: [
        sequelize.getQueryInterface(),
        Sequelize
      ],
      path: path.join(__dirname, '../migrations')
    }
  })
  console.log('Running Migrations')
  await umzug.up()
  syncConfigs()
  setInterval(() => {
    syncConfigs()
  }, 5000);
  return function (req, res) {
    req.db = { Config }
    req.workManager = workManager
    return fn(req, res)
  }
}

module.exports = setup(routes)
async function syncConfigs() {
  workManager.configs = await Config.findAll()
  console.log(`Synced ${workManager.configs.length} agents`)
}
