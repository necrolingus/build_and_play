const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AppLog = sequelize.define(
  'AppLog',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    level: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  },
  {
    tableName: 'app_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true
  }
);

module.exports = AppLog;
