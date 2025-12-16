const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Модель пользователя
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'purchaser', 'sales'),
    allowNull: false,
    defaultValue: 'sales'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

// Модель для данных морских перевозок
const SeaData = sequelize.define('SeaData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  lastUpdate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'sea_data',
  timestamps: false
});

// Модель для данных железнодорожных перевозок
const RailData = sequelize.define('RailData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  lastUpdate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'rail_data',
  timestamps: false
});

// Модель для данных прямых железнодорожных перевозок
const DirectRailData = sequelize.define('DirectRailData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  lastUpdate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'direct_rail_data',
  timestamps: false
});

// Модель для данных прямых морских перевозок
const DirectSeaData = sequelize.define('DirectSeaData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  lastUpdate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'direct_sea_data',
  timestamps: false
});

// Модель для тарифных данных
const TariffData = sequelize.define('TariffData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  lastUpdate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'tariff_data',
  timestamps: false
});

// Модель для тарифных данных агентов
const AgentTariffData = sequelize.define('AgentTariffData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  lastUpdate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'agent_tariff_data',
  timestamps: false
});

// Экспорт всех моделей
module.exports = {
  User,
  SeaData,
  RailData,
  DirectRailData,
  DirectSeaData,
  TariffData,
  AgentTariffData
};