import { NEO4J_AUTH_REQUIRED_FIELDS, WrongAuthenticationException } from './const';

export interface AuthData {
  uri: string;
  database: string;
  user: string;
  pwd: string;
}

export function check_auth_data(auth: AuthData | null | undefined): void {
  /**
   * Checks if the required authentication fields are present.
   *
   * @param auth - A dictionary containing authentication data.
   * @throws {Error} If auth is null or undefined.
   * @throws {WrongAuthenticationException} If any of the required authentication fields is missing.
   */
  if (auth == null) {
    throw new Error(
      `Please define the authentication dict. These are the required keys: ${NEO4J_AUTH_REQUIRED_FIELDS.join(', ')}`
    );
  }
  for (const paramName of NEO4J_AUTH_REQUIRED_FIELDS) {
    if (!(paramName in auth)) {
      throw new WrongAuthenticationException(paramName);
    }
    if (!auth[paramName as keyof AuthData]) {
      throw new Error(
        `The key ${paramName} is defined in the authentication dict but the value is empty.`
      );
    }
  }
}
