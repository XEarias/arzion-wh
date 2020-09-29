module.exports = function dataNotLoaded({entity}) {
  const { res } = this;

  res.status(503).send({message: `Entity ${entity} is not loaded, maybe down for maintenance`});
};
