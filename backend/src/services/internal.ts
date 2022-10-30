export const createSQLColumnList = <T>(props: { [P in keyof T]: unknown }) =>
  Object.keys(props).join(", ");
