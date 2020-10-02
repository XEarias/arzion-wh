module.exports = function dataConflict({entity, id, conflict}) {
  const { res } = this;

  return res.status(409).send({
    entity,
    id,
    conflict
  });
};
