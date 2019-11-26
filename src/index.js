import path from 'path'
import Sequelize from 'sequelize'
import Umzug from 'umzug'

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
  storage: process.env.DB_PATH || path.join(__dirname, '../agent.sqlite'),
  logging: process.env.NODE_ENV === 'production' ? () => {} : console.log
})

const Config = ConfigModel(sequelize, Sequelize)

const workManager = new WorkManager()

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
      const worker = await workManager.createWorker(config)
      worker.on('error', e => {
        writeError(config, e).catch(console.error)
      })
    } catch (err) {
      console.error(`Cannot create worker ${config.pk} (${config.username})`, err)
      await writeError(config, err)
    }
  })
}

async function writeError (config, error) {
  await config.update({
    lastErrorText: error.toString(),
    lastErrorTime: Date.now()
  })
}
