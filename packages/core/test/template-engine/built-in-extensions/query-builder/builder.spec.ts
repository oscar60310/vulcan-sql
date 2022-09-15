import { arrayToStream, streamToArray } from '@vulcan-sql/core';
import { CURRENT_PROFILE_NAME } from '@vulcan-sql/core/template-engine/built-in-extensions/query-builder/constants';
import { createTestCompiler } from '../../testCompiler';

it('Extension should execute correct query and set/export the variable', async () => {
  // Arrange
  const { compiler, loader, builder, executor } = await createTestCompiler();
  const { compiledData } = await compiler.compile(`
{% req userCount main %}
select count(*) as count from user where user.id = {{ params.userId }};
{% endreq %}
  `);
  builder.value.onFirstCall().resolves({
    getColumns: () => [],
    getData: () => arrayToStream([{ count: 1 }]),
  });
  // Action
  loader.setSource('test', compiledData);
  const result = await compiler.execute('test', {
    params: { userId: 'user-id' },
    [CURRENT_PROFILE_NAME]: 'mocked-profile',
  });
  const resultData = await streamToArray(result.getData());
  // Assert
  expect(executor.createBuilder.firstCall.args[0]).toBe('mocked-profile');
  expect(executor.createBuilder.firstCall.args[1]).toBe(
    `select count(*) as count from user where user.id = $1;`
  );
  expect(executor.createBuilder.firstCall.args[2].get('$1')).toBe(`user-id`);
  expect(resultData).toEqual([{ count: 1 }]);
});

it('If argument is not a symbol, extension should throw', async () => {
  // Arrange
  const { compiler } = await createTestCompiler();

  // Action, Assert
  await expect(
    compiler.compile(`
{% req "userCount" %}
select count(*) as count from user where user.id = '{{ params.userId }}';
{% endreq %}
  `)
  ).rejects.toThrow(`Expected a symbol, but got string`);
});

it('If argument is missing, extension should throw', async () => {
  // Arrange
  const { compiler } = await createTestCompiler();

  // Action, Assert
  await expect(
    compiler.compile(`
{% req %}
select count(*) as count from user where user.id = '{{ params.userId }}';
{% endreq %}
  `)
  ).rejects.toThrow(`Expected a variable`);
});

it('If the main denotation is replaces other keywords than "main", extension should throw an error', async () => {
  // Arrange
  const { compiler } = await createTestCompiler();

  // Action, Assert
  await expect(
    compiler.compile(`
{% req user super %}
some statement
{% endreq %}
  `)
  ).rejects.toThrow(`Expected a symbol "main"`);
});

it('If argument have too many elements, extension should throw an error', async () => {
  // Arrange
  const { compiler } = await createTestCompiler();

  // Action, Assert
  await expect(
    compiler.compile(`
{% req user main more %}
select count(*) as count from user where user.id = '{{ params.userId }}';
{% endreq %}
  `)
  ).rejects.toThrow(`Expected a block end, but got symbol`);
});

it('The main denotation should be parsed into the second args node', async () => {
  // Arrange
  const { compiler } = await createTestCompiler();

  // Action
  const { ast: astWithMainBuilder } = compiler.generateAst(
    `{% req user main %} some statement {% endreq %}`
  );

  // Assert
  expect((astWithMainBuilder as any).children[0].args.children[1].value).toBe(
    'true'
  );
});

it('Extension should throw an error if there are tow main builders', async () => {
  // Arrange
  const { compiler } = await createTestCompiler();
  // Act, Arrange
  await expect(
    compiler.compile(
      `
    {% req user main %} select * from users; {% endreq %}
    {% req user2 main %} select * from users; {% endreq %}
    `
    )
  ).rejects.toThrowError(`Only one main builder is allowed.`);
});

it('Extension should throw an error if there are multiple builders using same name', async () => {
  // Arrange
  const { compiler } = await createTestCompiler();
  // Act, Arrange
  await expect(
    compiler.compile(
      `
{% req user %} select * from users; {% endreq %}
{% req user %} select * from users; {% endreq %}
    `
    )
  ).rejects.toThrowError(
    `We can't declare multiple builder with same name. Duplicated name: user (declared at 1:7 and 2:7)`
  );
});

it('Extension should reset after compiled each template', async () => {
  // Arrange
  const { compiler } = await createTestCompiler();
  compiler.compile(
    `
  {% req user main %} select * from users; {% endreq %}
  `
  );
  // Act, Arrange
  await expect(
    compiler.compile(
      `
    {% req user main %} select * from users; {% endreq %}
    `
    )
  ).resolves.not.toThrow();
});
