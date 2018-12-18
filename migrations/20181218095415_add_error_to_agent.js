module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('configs', 'lastErrorText', { type: Sequelize.STRING })
    await queryInterface.addColumn('configs', 'lastErrorTime', { type: Sequelize.DATE, defaultValue: Sequelize.NOW })
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('configs', 'lastErrorText')
    await queryInterface.removeColumn('configs', 'lastErrorTime')
  }
}