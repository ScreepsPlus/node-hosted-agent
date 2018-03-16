import { send } from 'micro'
import path from 'path'
import fsRouter from 'fs-router'
import Sequelize from 'sequelize'

import WorkManager from './work-manager'
import ConfigModel from './models/config'

const match = fsRouter(path.join(__dirname, 'routes'))

const sequelize = new Sequelize('agent', 'username', null, {
  operatorsAliases: false,
  dialect: 'sqlite',
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

export default setup(async (req, res) => {
  let matched = match(req)
  if (matched) {
    let ret = await matched(req, res)
    if (ret) send(res, 200, ret)
    return
  }
  send(res, 404, { error: 'Not found' })
})

async function startAll () {
  let configs = Config.findAll()
  configs.forEach(async config => {
    try {
      await workManager.createWorker(config)
    } catch (err) {
      console.error('Cannot create worker', config.pk, err)
    }
  })
}
