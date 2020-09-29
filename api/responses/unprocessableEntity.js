module.exports = function unprocessableEntity({entity, id}) {
  const { res} = this;

  res.status(422).send({message: `The entity '${entity}' with ID '${id}' dont exists`});
};
