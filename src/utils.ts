import type { NamedNode } from '@rdfjs/types';
import {
  HANDLE_VOCAB_URI_STRATEGY,
  NEO4J_DRIVER_DICT_MESSAGE,
  ShortenStrictException,
} from './config/const';

export function getLocalPart(uri: string): string {
  /**
   * Extracts the local part of a URI.
   *
   * @param uri - The URI string.
   * @returns The local part of the URI.
   */
  let pos = uri.lastIndexOf('#');
  if (pos < 0) {
    pos = uri.lastIndexOf('/');
  }
  if (pos < 0) {
    pos = uri.lastIndexOf(':');
  }
  return uri.substring(pos + 1);
}

export function getNamespacePart(uri: string): string {
  /**
   * Extracts the namespace part of a URI.
   *
   * @param uri - The URI string.
   * @returns The namespace part of the URI.
   */
  let pos = uri.lastIndexOf('#');
  if (pos < 0) {
    pos = uri.lastIndexOf('/');
  }
  if (pos < 0) {
    pos = uri.lastIndexOf(':');
  }
  return uri.substring(0, pos + 1);
}

export function handle_vocab_uri_ignore(predicate: string | NamedNode): string {
  /**
   * Shortens a URI by extracting the local part.
   *
   * @param predicate - The URI string or NamedNode.
   * @returns The shortened URI.
   */
  const uriStr = typeof predicate === 'string' ? predicate : predicate.value;
  return getLocalPart(uriStr);
}

export function create_shortened_predicate(namespace: string, local_part: string): string {
  /**
   * Creates a shortened predicate by combining the namespace and local part.
   *
   * @param namespace - The namespace part of the URI.
   * @param local_part - The local part of the URI.
   * @returns The shortened predicate.
   */
  return `${namespace}__${local_part}`;
}

export function handle_vocab_uri_shorten(
  predicate: string | NamedNode,
  prefixes: Record<string, string>
): string {
  /**
   * Shortens a URI by combining the namespace and local part based on provided prefixes.
   *
   * @param predicate - The URI to be shortened.
   * @param prefixes - A dictionary containing namespace prefixes.
   * @returns The shortened URI if the namespace exists in the prefixes, otherwise raises a ShortenStrictException.
   */
  const uriStr = typeof predicate === 'string' ? predicate : predicate.value;
  const ns = getNamespacePart(uriStr);
  const local_part = getLocalPart(uriStr);
  if (ns in prefixes) {
    return create_shortened_predicate(prefixes[ns], local_part);
  }
  throw new ShortenStrictException(ns);
}

export function handle_vocab_uri_map(
  mappings: Record<string, string>,
  predicate: string | NamedNode
): string | NamedNode {
  /**
   * Maps the given predicate URI using the provided mappings dictionary.
   *
   * @param mappings - A dictionary mapping URIs to their mapped values.
   * @param predicate - The predicate URI to be mapped.
   * @returns The mapped predicate URI if it exists in the mappings dictionary, otherwise returns the original predicate URI.
   */
  const uriStr = typeof predicate === 'string' ? predicate : predicate.value;
  if (uriStr in mappings) {
    return mappings[uriStr];
  }
  return predicate;
}

export function handle_vocab_uri(
  mappings: Record<string, string>,
  predicate: string | NamedNode,
  prefixes: Record<string, string>,
  strategy: HANDLE_VOCAB_URI_STRATEGY
): string {
  /**
   * Handles the given predicate URI based on the chosen strategy.
   *
   * @param mappings - A dictionary mapping URIs to their mapped values.
   * @param predicate - The predicate URI to be handled.
   * @param prefixes - A dictionary containing namespace prefixes.
   * @param strategy - The strategy to be used for handling the predicate URI.
   * @returns The handled predicate URI based on the chosen strategy.
   */
  if (strategy === HANDLE_VOCAB_URI_STRATEGY.SHORTEN) {
    return handle_vocab_uri_shorten(predicate, prefixes);
  } else if (strategy === HANDLE_VOCAB_URI_STRATEGY.MAP) {
    const res = handle_vocab_uri_map(mappings, predicate);
    const resStr = typeof res === 'string' ? res : res.value;
    const predStr = typeof predicate === 'string' ? predicate : predicate.value;
    if (resStr === predStr) {
      return handle_vocab_uri_ignore(predicate);
    }
    return resStr;
  } else if (strategy === HANDLE_VOCAB_URI_STRATEGY.KEEP) {
    return typeof predicate === 'string' ? predicate : predicate.value;
  } else if (strategy === HANDLE_VOCAB_URI_STRATEGY.IGNORE) {
    return handle_vocab_uri_ignore(predicate);
  }
  throw new Error(`Strategy ${strategy} not defined.`);
}

export function handle_neo4j_driver_exception(ex: Error): Error {
  /**
   * Handle exceptions raised by the Neo4j driver by providing custom error messages.
   *
   * @param ex - The exception raised by the Neo4j driver.
   * @returns A custom exception or the original exception.
   */
  const errorMessage = ex.message || String(ex);
  const customException = NEO4J_DRIVER_DICT_MESSAGE[errorMessage];
  return customException ? customException() : ex;
}
