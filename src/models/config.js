export default (sequelize, DataTypes) => {
  return sequelize.define('config', {
    pk: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    screepsToken: { type: DataTypes.STRING },
    screepsPlusToken: { type: DataTypes.STRING },
    method: { type: DataTypes.STRING },
    methodConfig: { type: DataTypes.JSON }
  })
}
