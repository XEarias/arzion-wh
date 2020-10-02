module.exports = {
  datastores: {
    default: {
      adapter: 'sails-disk',
      inMemoryOnly: true
    },
  },
  models: {
    migrate: 'drop',
  },
  blueprints: {
    shortcuts: false,
  },
  log: {
    level: 'debug'
  }
};
