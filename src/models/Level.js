const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/database');

const Level = sequelize.define(
  'Level',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    statusToken: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true,
      defaultValue: () => crypto.randomUUID(),
      field: 'status_token'
    },
    name: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    description: {
      type: DataTypes.STRING(250),
      allowNull: false
    },
    username: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'Anonymous'
    },
    country: {
      type: DataTypes.STRING(80),
      allowNull: true,
      defaultValue: 'Unspecified'
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'DECLINED'),
      allowNull: false,
      defaultValue: 'PENDING'
    },
    declineReason: {
      type: DataTypes.STRING(300),
      allowNull: true,
      defaultValue: null,
      field: 'decline_reason'
    },
    parameters: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    levelData: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: 'level_data'
    },
    playsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'plays_count'
    },
    winsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'wins_count'
    }
  },
  {
    tableName: 'levels',
    timestamps: true,
    underscored: true
  }
);

module.exports = Level;
