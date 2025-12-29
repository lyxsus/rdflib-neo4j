import { NamedNode } from '@rdfjs/types';
import {
  DEFAULT_PREFIXES,
  HANDLE_MULTIVAL_STRATEGY,
  HANDLE_VOCAB_URI_STRATEGY,
  PrefixNotFoundException,
} from './const';
import { type AuthData, check_auth_data } from './utils';

export interface CustomMapping {
  prefixName: string;
  toReplace: string;
  newValue: string;
}

export interface MultivalPropName {
  prefixName: string;
  propName: string;
}

export class Neo4jStoreConfig {
  default_prefixes: Record<string, string>;
  auth_data: AuthData | null;
  custom_prefixes: Record<string, string>;
  custom_mappings: Record<string, string>;
  batching: boolean;
  batch_size: number;
  handle_vocab_uri_strategy: HANDLE_VOCAB_URI_STRATEGY;
  handle_multival_strategy: HANDLE_MULTIVAL_STRATEGY;
  multival_props_names: string[];

  /**
   * Configuration class for Neo4j RDF store.
   *
   * @param auth_data - A dictionary containing authentication data (default: null).
   * @param custom_mappings - A list of tuples containing custom mappings for prefixes in the form (prefix, objectToReplace, newObject) (default: empty list).
   * @param custom_prefixes - A dictionary containing custom prefixes (default: empty dictionary).
   * @param batching - A boolean indicating whether batching is enabled (default: true).
   * @param batch_size - An integer representing the batch size (default: 5000).
   * @param handle_vocab_uri_strategy - The strategy to handle vocabulary URIs (default: HANDLE_VOCAB_URI_STRATEGY.SHORTEN).
   * @param handle_multival_strategy - The strategy to handle multivalued properties (default: HANDLE_MULTIVAL_STRATEGY.OVERWRITE).
   * @param multival_props_names - A list of tuples containing the prefix and property names to be treated as multivalued in the form (prefix, property_name)
   */
  constructor(
    auth_data: AuthData | null = null,
    custom_mappings: CustomMapping[] = [],
    custom_prefixes: Record<string, string> = {},
    batching: boolean = true,
    batch_size: number = 5000,
    handle_vocab_uri_strategy: HANDLE_VOCAB_URI_STRATEGY = HANDLE_VOCAB_URI_STRATEGY.SHORTEN,
    handle_multival_strategy: HANDLE_MULTIVAL_STRATEGY = HANDLE_MULTIVAL_STRATEGY.OVERWRITE,
    multival_props_names: MultivalPropName[] = []
  ) {
    this.default_prefixes = { ...DEFAULT_PREFIXES };
    this.auth_data = auth_data;
    this.custom_prefixes = { ...custom_prefixes };
    this.custom_mappings = {};
    for (const mapping of custom_mappings) {
      this.set_custom_mapping(mapping.prefixName, mapping.toReplace, mapping.newValue);
    }
    this.batching = batching;
    this.batch_size = batch_size;
    this.handle_vocab_uri_strategy = handle_vocab_uri_strategy;
    this.handle_multival_strategy = handle_multival_strategy;
    this.multival_props_names = [];
    for (const prop_name of multival_props_names) {
      this.set_multival_prop_name(prop_name.prefixName, prop_name.propName);
    }
  }

  set_handle_vocab_uri_strategy(val: HANDLE_VOCAB_URI_STRATEGY): void {
    /**
     * Set the strategy to handle vocabulary URIs.
     *
     * @param val - The handle_vocab_uri_strategy value to be set.
     */
    this.handle_vocab_uri_strategy = val;
  }

  set_handle_multival_strategy(val: HANDLE_MULTIVAL_STRATEGY): void {
    /**
     * Set the strategy to handle multiple values.
     *
     * @param val - The handle_multival_strategy value to be set.
     */
    this.handle_multival_strategy = val;
  }

  set_default_prefix(name: string, value: string): void {
    /**
     * Set a default prefix.
     *
     * @param name - The name of the prefix.
     * @param value - The value of the prefix (namespace URI).
     */
    this.default_prefixes[name] = value;
  }

  get_prefixes(): Record<string, string> {
    /**
     * Get a dictionary containing all prefixes (default and custom).
     *
     * @returns A dictionary containing all prefixes.
     */
    return { ...this.default_prefixes, ...this.custom_prefixes };
  }

  set_multival_prop_name(prefix_name: string, prop_name: string): void {
    /**
     * Set a property name to be treated as multivalued.
     *
     * @param prefix_name - The name of the prefix.
     * @param prop_name - The name of the property to be treated as multivalued.
     * @throws {PrefixNotFoundException} If the prefix is not found in the available prefixes.
     */
    const total_prefixes = this.get_prefixes();
    if (!(prefix_name in total_prefixes)) {
      throw new PrefixNotFoundException(prefix_name);
    }
    const predicate = `${total_prefixes[prefix_name]}${prop_name}`;
    if (!this.multival_props_names.includes(predicate)) {
      this.multival_props_names.push(predicate);
    }
  }

  set_custom_prefix(name: string, value: string): void {
    /**
     * Add a custom prefix to the configuration.
     *
     * @param name - The name of the prefix.
     * @param value - The value of the prefix (namespace URI).
     * @throws {Error} If the namespace is already defined for another prefix.
     */
    if (Object.values(this.custom_prefixes).includes(value)) {
      throw new Error(`Namespace ${value} already defined for another prefix.`);
    }
    this.custom_prefixes[name] = value;
  }

  delete_custom_prefix(name: string): void {
    /**
     * Delete a custom prefix from the 'custom_prefixes' dictionary.
     *
     * @param name - The name of the custom prefix to be deleted.
     */
    if (name in this.custom_prefixes) {
      delete this.custom_prefixes[name];
    }
  }

  set_custom_mapping(prefix_name: string, to_replace: string, new_value: string): void {
    /**
     * Add a custom mapping for a prefix.
     *
     * @param prefix_name - The name of the prefix to be mapped.
     * @param to_replace - The value to be replaced in the namespace URI.
     * @param new_value - The new value for the mapping in the namespace URI.
     * @throws {PrefixNotFoundException} If the prefix is not found in the available prefixes.
     *
     * @remarks It constructs the key by combining the namespace associated with 'prefix_name' and 'to_replace'.
     */
    const total_prefixes = this.get_prefixes();
    if (!(prefix_name in total_prefixes)) {
      throw new PrefixNotFoundException(prefix_name);
    }
    const key = `${total_prefixes[prefix_name]}${to_replace}`;
    this.custom_mappings[key] = new_value;
  }

  delete_custom_mapping(prefix_name: string, to_replace: string): void {
    /**
     * Deletes a custom mapping from the custom_mappings dictionary.
     *
     * @param prefix_name - The name of the prefix to which 'to_replace' is associated.
     * @param to_replace - The value to be replaced within the prefix's namespace.
     * @throws {PrefixNotFoundException} If the prefix is not found in the available prefixes.
     *
     * @remarks This function removes a key-value pair from the 'custom_mappings' dictionary.
     * It constructs the key by combining the namespace associated with 'prefix_name' and 'to_replace'.
     */
    const all_prefixes = this.get_prefixes();
    if (!(prefix_name in all_prefixes)) {
      throw new PrefixNotFoundException(prefix_name);
    }
    const key = `${all_prefixes[prefix_name]}${to_replace}`;
    if (key in this.custom_mappings) {
      delete this.custom_mappings[key];
    }
  }

  set_auth_data(auth: AuthData): void {
    /**
     * Set authentication data.
     *
     * @param auth - A dictionary containing authentication data.
     */
    this.auth_data = auth;
  }

  set_batching(val: boolean): void {
    /**
     * Set batching.
     *
     * @param val - A boolean indicating whether batching is enabled.
     */
    this.batching = val;
  }

  set_batch_size(val: number): void {
    /**
     * Set the batch size.
     *
     * @param val - An integer representing the batch size.
     */
    this.batch_size = val;
  }

  get_config_dict(): Record<string, any> {
    /**
     * Get the configuration dictionary.
     *
     * @returns A dictionary containing the configuration parameters.
     * @throws {Error} If any of the required authentication fields is missing.
     */
    return { ...this };
  }
}
