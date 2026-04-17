/**
 * Sequelize Models Index
 * Registers all models and their associations.
 */

const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// ─── User Model ──────────────────────────────────────────────
const User = sequelize.define('users', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'technician', 'viewer'),
    defaultValue: 'technician'
  },
  avatar_url: {
    type: DataTypes.STRING(500)
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_login: {
    type: DataTypes.DATE
  },
  mfa_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  mfa_secret: {
    type: DataTypes.STRING(255)
  },
  refresh_token: {
    type: DataTypes.TEXT
  }
});

// ─── Device Model ────────────────────────────────────────────
const Device = sequelize.define('devices', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  hostname: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  ip_address: {
    type: DataTypes.STRING(45)
  },
  mac_address: {
    type: DataTypes.STRING(17)
  },
  os_type: {
    type: DataTypes.ENUM('windows', 'linux', 'macos'),
    allowNull: false
  },
  os_version: {
    type: DataTypes.STRING(100)
  },
  agent_version: {
    type: DataTypes.STRING(20)
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'maintenance', 'error'),
    defaultValue: 'offline'
  },
  cpu_usage: {
    type: DataTypes.FLOAT
  },
  memory_usage: {
    type: DataTypes.FLOAT
  },
  disk_usage: {
    type: DataTypes.FLOAT
  },
  last_heartbeat: {
    type: DataTypes.DATE
  },
  tags: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  registered_by: {
    type: DataTypes.UUID
  }
});

// ─── Session Model ───────────────────────────────────────────
const Session = sequelize.define('sessions', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  device_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  session_type: {
    type: DataTypes.ENUM('rdp', 'vnc', 'ssh', 'terminal'),
    defaultValue: 'rdp'
  },
  status: {
    type: DataTypes.ENUM('active', 'ended', 'failed', 'timeout'),
    defaultValue: 'active'
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  ended_at: {
    type: DataTypes.DATE
  },
  duration_seconds: {
    type: DataTypes.INTEGER
  },
  guacamole_token: {
    type: DataTypes.STRING(500)
  },
  notes: {
    type: DataTypes.TEXT
  }
});

// ─── Log Model ───────────────────────────────────────────────
const Log = sequelize.define('logs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  level: {
    type: DataTypes.ENUM('info', 'warn', 'error', 'critical'),
    defaultValue: 'info'
  },
  source: {
    type: DataTypes.ENUM('system', 'agent', 'user', 'ai', 'session'),
    defaultValue: 'system'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  details: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  device_id: {
    type: DataTypes.UUID
  },
  user_id: {
    type: DataTypes.UUID
  }
});

// ─── Script Model ────────────────────────────────────────────
const Script = sequelize.define('scripts', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  script_type: {
    type: DataTypes.ENUM('powershell', 'bash', 'python'),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    defaultValue: 'general'
  },
  is_safe: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  requires_approval: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_by: {
    type: DataTypes.UUID
  },
  execution_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

// ─── AI Interaction Model ────────────────────────────────────
const AIInteraction = sequelize.define('ai_interactions', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID
  },
  device_id: {
    type: DataTypes.UUID
  },
  prompt: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  response: {
    type: DataTypes.TEXT
  },
  model_used: {
    type: DataTypes.STRING(50),
    defaultValue: 'gpt-4'
  },
  tokens_used: {
    type: DataTypes.INTEGER
  },
  category: {
    type: DataTypes.STRING(100)
  },
  resolution_status: {
    type: DataTypes.ENUM('pending', 'resolved', 'failed', 'escalated'),
    defaultValue: 'pending'
  },
  feedback_rating: {
    type: DataTypes.INTEGER,
    validate: { min: 1, max: 5 }
  },
  suggested_script_id: {
    type: DataTypes.UUID
  }
});

// ─── Associations ────────────────────────────────────────────

// User <-> Session
User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Device <-> Session
Device.hasMany(Session, { foreignKey: 'device_id', as: 'sessions' });
Session.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

// User <-> Device
User.hasMany(Device, { foreignKey: 'registered_by', as: 'devices' });
Device.belongsTo(User, { foreignKey: 'registered_by', as: 'registeredBy' });

// User <-> Log
User.hasMany(Log, { foreignKey: 'user_id', as: 'logs' });
Log.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Device <-> Log
Device.hasMany(Log, { foreignKey: 'device_id', as: 'logs' });
Log.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

// User <-> Script
User.hasMany(Script, { foreignKey: 'created_by', as: 'scripts' });
Script.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// User <-> AI Interaction
User.hasMany(AIInteraction, { foreignKey: 'user_id', as: 'aiInteractions' });
AIInteraction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Device <-> AI Interaction
Device.hasMany(AIInteraction, { foreignKey: 'device_id', as: 'aiInteractions' });
AIInteraction.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

module.exports = {
  sequelize,
  User,
  Device,
  Session,
  Log,
  Script,
  AIInteraction
};
