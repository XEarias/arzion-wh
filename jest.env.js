const NodeEnvironment = require('jest-environment-node');
const sails = require('sails');

const sailsAppConfig = {
  port: 1338,
  hooks: {
    session: false,
    sockets: false,
    pubsub: false,
    views: false,
    csrf: false,
    i18n: false
  },
  log: { level: 'warn' },

};

class CustomEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.testPath = context.testPath;
    this.docblockPragmas = context.docblockPragmas;
  }

  async setup() {
    await super.setup();

    const liftPromise = new Promise((resolve, reject) => sails.lift(sailsAppConfig,
      (err) => {
        if (err) {
          reject(err);
        }
        resolve();
      }
    ));

    await liftPromise;

    this.global.sails = sails;
  }

  async teardown() {
    const lowerPromise = new Promise((resolve) => {
      sails.lower(resolve);
    });

    await lowerPromise;
    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }
}

module.exports = CustomEnvironment;
