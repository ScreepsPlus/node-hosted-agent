module.exports = {
  async up (queryInterface, DataTypes) {
    await queryInterface.createTable('configs', {
      pk: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      screepsAPIConfig: { type: DataTypes.JSON },
      username: { type: DataTypes.STRING },
      method: { type: DataTypes.STRING },
      methodConfig: { type: DataTypes.JSON }
    })
  },
  async down (queryInterface, DataTypes) {
    await queryInterface.dropTable('configs')
  }
}