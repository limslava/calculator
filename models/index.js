const { sequelize } = require('../config/database');
const { DataTypes, Op } = require('sequelize');

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

// Модель для истории загрузки данных
const UploadHistory = sequelize.define('UploadHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  dataType: {
    type: DataTypes.ENUM('sea', 'rail', 'direct_sea', 'direct_rail', 'tariff', 'agent_tariff'),
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  userEmail: {
    type: DataTypes.STRING,
    allowNull: false
  },
  recordCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Храним снимок первых нескольких записей для предпросмотра
  previewData: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  uploadedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'upload_history',
  timestamps: true,
  createdAt: 'uploadedAt',
  updatedAt: false,
  indexes: [
    {
      fields: ['dataType']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['uploadedAt']
    }
  ]
});

// Модель для хранения данных каждой загрузки (полные данные)
const UploadData = sequelize.define('UploadData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  uploadHistoryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'upload_history',
      key: 'id'
    }
  },
  dataType: {
    type: DataTypes.ENUM('sea', 'rail', 'direct_sea', 'direct_rail', 'tariff', 'agent_tariff'),
    allowNull: false
  },
  // Полные данные загрузки
  fullData: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  recordCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  uploadedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'upload_data',
  timestamps: true,
  createdAt: 'uploadedAt',
  updatedAt: false,
  indexes: [
    {
      fields: ['uploadHistoryId']
    },
    {
      fields: ['dataType']
    },
    {
      fields: ['uploadedAt']
    }
  ]
});

// Определяем связи между моделями
User.hasMany(UploadHistory, { foreignKey: 'userId', as: 'uploadHistory' });
UploadHistory.belongsTo(User, { foreignKey: 'userId', as: 'user' });
UploadHistory.hasOne(UploadData, { foreignKey: 'uploadHistoryId', as: 'uploadData' });
UploadData.belongsTo(UploadHistory, { foreignKey: 'uploadHistoryId', as: 'uploadHistory' });

// Экспорт всех моделей
module.exports = {
  User,
  SeaData,
  RailData,
  DirectRailData,
  DirectSeaData,
  TariffData,
  AgentTariffData,
  UploadHistory,
  UploadData,
  Op
};