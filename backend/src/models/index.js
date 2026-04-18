'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── User ─────────────────────────────────────────────────────
const User = sequelize.define('users', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email:         { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { isEmail: true } },
  username:      { type: DataTypes.STRING(100), allowNull: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  first_name:    { type: DataTypes.STRING(100), allowNull: false },
  last_name:     { type: DataTypes.STRING(100), allowNull: false },
  role:          { type: DataTypes.ENUM('admin', 'technician', 'viewer'), defaultValue: 'technician' },
  is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
  last_login:    { type: DataTypes.DATE },
  refresh_token: { type: DataTypes.TEXT }
});

// ── Device ───────────────────────────────────────────────────
const Device = sequelize.define('devices', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  hostname:      { type: DataTypes.STRING(255), allowNull: false },
  ip_address:    { type: DataTypes.STRING(45) },
  public_ip:     { type: DataTypes.STRING(45) },
  os_type:       { type: DataTypes.ENUM('windows', 'linux', 'macos'), allowNull: false },
  os_version:    { type: DataTypes.STRING(200) },
  agent_version: { type: DataTypes.STRING(20) },
  status:        { type: DataTypes.ENUM('online', 'offline'), defaultValue: 'offline' },
  cpu_usage:     { type: DataTypes.FLOAT },
  memory_usage:  { type: DataTypes.FLOAT },
  disk_usage:    { type: DataTypes.FLOAT },
  active_users:  { type: DataTypes.JSONB, defaultValue: [] },
  last_heartbeat:{ type: DataTypes.DATE },
  socket_id:     { type: DataTypes.STRING(100) },
  tags:          { type: DataTypes.JSONB, defaultValue: [] },
  agent_secret_hash: { type: DataTypes.STRING(255) }
});

// ── CommandLog ───────────────────────────────────────────────
const CommandLog = sequelize.define('command_logs', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  device_id:  { type: DataTypes.UUID, allowNull: false },
  user_id:    { type: DataTypes.UUID },
  type:       { type: DataTypes.ENUM('cmd', 'powershell', 'bash'), allowNull: false },
  command:    { type: DataTypes.TEXT, allowNull: false },
  output:     { type: DataTypes.TEXT },
  exit_code:  { type: DataTypes.INTEGER },
  duration_ms:{ type: DataTypes.INTEGER },
  run_as:     { type: DataTypes.STRING(50), defaultValue: 'current' },
  status:     { type: DataTypes.ENUM('pending', 'running', 'done', 'error'), defaultValue: 'pending' }
});

// ── SystemLog ────────────────────────────────────────────────
const SystemLog = sequelize.define('system_logs', {
  id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  level:     { type: DataTypes.ENUM('info', 'warn', 'error', 'critical'), defaultValue: 'info' },
  source:    { type: DataTypes.ENUM('system', 'agent', 'user', 'command'), defaultValue: 'system' },
  message:   { type: DataTypes.TEXT, allowNull: false },
  details:   { type: DataTypes.JSONB, defaultValue: {} },
  device_id: { type: DataTypes.UUID },
  user_id:   { type: DataTypes.UUID }
});

// ── Associations ─────────────────────────────────────────────
Device.hasMany(CommandLog, { foreignKey: 'device_id', as: 'commands' });
CommandLog.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

User.hasMany(CommandLog, { foreignKey: 'user_id', as: 'commands' });
CommandLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { User, Device, CommandLog, SystemLog, sequelize };
