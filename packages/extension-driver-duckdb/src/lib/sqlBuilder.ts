import { Parameterized, SQLClauseOperation } from '@vulcan-sql/core';
import { isNull, isUndefined } from 'lodash';

const isNullOrUndefine = (value: any) => isUndefined(value) || isNull(value);

export const removeEndingSemiColon = (sql: string) => {
  return sql.replace(/;([ \n]+)?$/, '');
};

export const addLimit = (sql: string, limit?: string | null) => {
  if (isNullOrUndefine(limit)) return sql;
  return [sql, `LIMIT`, limit].join(' ');
};

export const addOffset = (sql: string, offset?: string | null) => {
  if (isNullOrUndefine(offset)) return sql;
  return [sql, `OFFSET`, offset].join(' ');
};

// Check if there is no operations
export const isNoOP = (
  operations: Partial<Parameterized<SQLClauseOperation>>
): boolean => {
  if (!isNullOrUndefine(operations.limit)) return false;
  if (!isNullOrUndefine(operations.offset)) return false;
  return true;
};

const duckdbExecuteChunkSize =
  process.env['DUCKDB_EXECUTE_CHUNK_SIZE'] || '2000';

export const chunkSize = Number(duckdbExecuteChunkSize);

export const buildSQL = (
  sql: string,
  operations: Partial<Parameterized<SQLClauseOperation>>
): string[] => {
  if (isNoOP(operations) && !/^select/.test(sql.toLowerCase()))
    return [sql, ''];
  let builtSQL = '';
  builtSQL += `SELECT * FROM (${removeEndingSemiColon(sql)})`;
  builtSQL = addLimit(builtSQL, operations.limit);
  builtSQL = addOffset(builtSQL, operations.offset);

  const firstDataSql = `SELECT * FROM (${builtSQL}) LIMIT ${chunkSize};`;
  const restDataSql = `SELECT * FROM (${builtSQL}) OFFSET ${chunkSize};`;
  return [firstDataSql, restDataSql];
};
