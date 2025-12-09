export const DEFAULT_PREFIXES: Record<string, string> = {
  "skos": "http://www.w3.org/2004/02/skos/core#",
  "sch": "http://schema.org/",
  "sh": "http://www.w3.org/ns/shacl#",
  "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
  "dc": "http://purl.org/dc/elements/1.1/",
  "dct": "http://purl.org/dc/terms/",
  "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "owl": "http://www.w3.org/2002/07/owl#",
  "xsd": "http://www.w3.org/2001/XMLSchema#",
  "exterms": "http://www.example.org/terms/",
  "ex": "http://www.example.org/indiv/"
};

export const NEO4J_AUTH_REQUIRED_FIELDS = ["uri", "database", "user", "pwd"];
export const NEO4J_DRIVER_USER_AGENT_NAME = "neo4j_labs_n10s_client_lib";

export class PrefixNotFoundException extends Error {
  constructor(public prefixName: string) {
    super(`Prefix ${JSON.stringify(prefixName)} not found inside the configuration. Please add it before adding any related custom mapping.`);
    this.name = "PrefixNotFoundException";
  }
}

export class ShortenStrictException extends Error {
  constructor(public namespace: string) {
    super(`Namespace ${JSON.stringify(namespace)} not found inside the configuration. Please add it if you want to use the SHORTEN mode.`);
    this.name = "ShortenStrictException";
  }
}

export class WrongAuthenticationException extends Error {
  constructor(public paramName: string) {
    super(`Missing ${paramName} key inside the authentication definition. Remember that it should contain the following keys: [uri, database, user, pwd]`);
    this.name = "WrongAuthenticationException";
  }
}

export class CypherMultipleTypesMultiValueException extends Error {
  constructor() {
    super("Values of a multivalued property must have the same datatype.");
    this.name = "CypherMultipleTypesMultiValueException";
  }
}

export const NEO4J_DRIVER_MULTIPLE_TYPE_ERROR_MESSAGE = "{code: Neo.ClientError.Statement.TypeError} {message: Neo4j only supports a subset of Cypher types for storage as singleton or array properties. Please refer to section cypher/syntax/values of the manual for more details.}";

export const NEO4J_DRIVER_DICT_MESSAGE: Record<string, () => Error> = {
  [NEO4J_DRIVER_MULTIPLE_TYPE_ERROR_MESSAGE]: () => new CypherMultipleTypesMultiValueException()
};

export enum HANDLE_VOCAB_URI_STRATEGY {
  /**
   * Strategy to shorten the URIs (Every prefix that you will use must be defined in the config, otherwise Neo4jStore will throw a ShortenStrictException)
   */
  SHORTEN = "SHORTEN",
  /**
   * Strategy to map the URIs using provided mappings
   */
  MAP = "MAP",
  /**
   * Strategy to keep the URIs
   */
  KEEP = "KEEP",
  /**
   * Strategy to ignore the Namespace and get only the local part
   */
  IGNORE = "IGNORE"
}

export enum HANDLE_MULTIVAL_STRATEGY {
  /**
   * Strategy to overwrite multiple values
   */
  OVERWRITE = 1,
  /**
   * Strategy to treat multiple values as an array
   * 
   * TO NOTICE: If the strategy is ARRAY and the Neo4jStoreConfig doesn't contain any predicate marked as multivalued, EVERY field will be treated as multivalued.
   */
  ARRAY = 2
}

