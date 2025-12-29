export {
  CypherMultipleTypesMultiValueException,
  DEFAULT_PREFIXES,
  HANDLE_MULTIVAL_STRATEGY,
  HANDLE_VOCAB_URI_STRATEGY,
  PrefixNotFoundException,
  ShortenStrictException,
  WrongAuthenticationException,
} from './config/const';
export { Neo4jStoreConfig } from './config/Neo4jStoreConfig';
export type { AuthData } from './config/utils';
export { Neo4jStore } from './Neo4jStore';
