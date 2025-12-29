import DataFactory from '@rdfjs/data-model';
import type { Literal, NamedNode, Quad, Term } from '@rdfjs/types';
import { HANDLE_MULTIVAL_STRATEGY, type HANDLE_VOCAB_URI_STRATEGY } from './config/const';
import { handle_vocab_uri } from './utils';

const RDF_TYPE = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

export class Neo4jTriple {
  uri: Term;
  labels: Set<string>;
  props: Map<string, Literal>;
  multi_props: Map<string, Literal[]>;
  relationships: Map<string, Set<NamedNode>>;
  handle_vocab_uri_strategy: HANDLE_VOCAB_URI_STRATEGY;
  handle_multival_strategy: HANDLE_MULTIVAL_STRATEGY;
  multival_props_names: string[];
  prefixes: Record<string, string>;

  /**
   * Represents a triple extracted from RDF data for use in a Neo4j database.
   *
   * @param uri - The subject URI of the triple.
   * @param handle_vocab_uri_strategy - The strategy to handle vocabulary URIs.
   * @param handle_multival_strategy - The strategy to handle multiple values.
   * @param multival_props_names - A list containing URIs to be treated as multivalued.
   * @param prefixes - A dictionary of namespace prefixes used for vocabulary URI handling.
   */
  constructor(
    uri: Term,
    handle_vocab_uri_strategy: HANDLE_VOCAB_URI_STRATEGY,
    handle_multival_strategy: HANDLE_MULTIVAL_STRATEGY,
    multival_props_names: string[],
    prefixes: Record<string, string>
  ) {
    this.uri = uri;
    this.labels = new Set<string>();
    this.props = new Map<string, Literal>();
    this.multi_props = new Map<string, Literal[]>();
    this.relationships = new Map<string, Set<NamedNode>>();
    this.handle_vocab_uri_strategy = handle_vocab_uri_strategy;
    this.handle_multival_strategy = handle_multival_strategy;
    this.multival_props_names = multival_props_names;
    this.prefixes = prefixes;
  }

  add_label(label: string): void {
    /**
     * Adds a label to the `labels` set of the Neo4jTriple object.
     *
     * @param label - The label to add.
     */
    this.labels.add(label);
  }

  add_prop(prop_name: string, value: Literal, multi: boolean = false): void {
    /**
     * Adds a property to the `props` dictionary of the Neo4jTriple object.
     *
     * @param prop_name - The name of the property.
     * @param value - The value of the property.
     * @param multi - If the property should be treated as multivalued. Default: false
     */
    if (multi) {
      if (!this.multi_props.has(prop_name)) {
        this.multi_props.set(prop_name, []);
      }
      this.multi_props.get(prop_name)!.push(value);
    } else {
      this.props.set(prop_name, value);
    }
  }

  add_rel(rel_type: string, to_resource: NamedNode): void {
    /**
     * Adds a relationship to the `relationships` dictionary of the Neo4jTriple object.
     *
     * @param rel_type - The type of the relationship.
     * @param to_resource - The resource to which the relationship points.
     */
    if (!this.relationships.has(rel_type)) {
      this.relationships.set(rel_type, new Set<NamedNode>());
    }
    this.relationships.get(rel_type)!.add(to_resource);
  }

  extract_label_key(): string {
    /**
     * Extracts a label key from the `labels` set of the Neo4jTriple object.
     *
     * @returns The extracted label key.
     */
    const labelsArray = Array.from(this.labels);
    return labelsArray.length > 0 ? labelsArray.join(',') : 'Resource';
  }

  extract_labels(): string[] {
    /**
     * Extracts the labels from the `labels` set of the Neo4jTriple object.
     *
     * @returns The extracted labels.
     */
    return Array.from(this.labels);
  }

  extract_params(): Record<string, any> {
    /**
     * Extracts the properties from the `props` dictionary of the Neo4jTriple object.
     *
     * @returns The extracted properties.
     */
    const res: Record<string, any> = {};
    for (const [key, value] of this.props) {
      res[key] = this.literalToValue(value);
    }
    res['uri'] = this.termToString(this.uri);
    for (const [key, values] of this.multi_props) {
      res[key] = values.map((v) => this.literalToValue(v));
    }
    return res;
  }

  extract_props_names(multi: boolean = false): Set<string> {
    /**
     * Extracts property names from the Neo4jTriple object.
     *
     * @param multi - If true, extract property names from multi_props, otherwise from props.
     * @returns A set containing the extracted property names.
     */
    if (!multi) {
      return new Set(this.props.keys());
    }
    return new Set(this.multi_props.keys());
  }

  extract_rels(): Record<string, NamedNode[]> {
    /**
     * Extracts the relationships from the `relationships` dictionary of the Neo4jTriple object.
     *
     * @returns The extracted relationships.
     */
    const result: Record<string, NamedNode[]> = {};
    for (const [key, value] of this.relationships) {
      result[key] = Array.from(value);
    }
    return result;
  }

  handle_vocab_uri(mappings: Record<string, string>, predicate: NamedNode | string): string {
    /**
     * Handles a vocabulary URI according to the specified strategy, defined using the HANDLE_VOCAB_URI_STRATEGY Enum.
     *
     * @param mappings - A dictionary mapping URIs to their mapped values.
     * @param predicate - The predicate URI to be handled.
     * @returns The handled predicate URI based on the specified strategy.
     */
    const predicateNode =
      typeof predicate === 'string' ? DataFactory.namedNode(predicate) : predicate;
    return handle_vocab_uri(mappings, predicateNode, this.prefixes, this.handle_vocab_uri_strategy);
  }

  parse_triple(quad: Quad, mappings: Record<string, string>): void {
    /**
     * Parses a triple and updates the Neo4jTriple object accordingly.
     *
     * @param quad - The quad to parse (subject, predicate, object).
     * @param mappings - A dictionary of mappings for predicate URIs.
     */
    const subject = quad.subject;
    const predicate = quad.predicate;
    const object = quad.object;

    // Only process NamedNode predicates (skip Variable)
    if (predicate.termType !== 'NamedNode') {
      return;
    }
    const namedPredicate = predicate as NamedNode;

    // Getting a property
    if (object.termType === 'Literal') {
      const literal = object as Literal;
      // Convert literal value to appropriate JavaScript type
      let value: any = literal.value;

      // Handle numeric types - check datatype if available
      if (literal.datatype) {
        const datatypeUri =
          typeof literal.datatype === 'string' ? literal.datatype : literal.datatype.value;
        if (datatypeUri.includes('integer') || datatypeUri.includes('int')) {
          value = parseInt(String(value), 10);
        } else if (
          datatypeUri.includes('float') ||
          datatypeUri.includes('double') ||
          datatypeUri.includes('decimal')
        ) {
          value = parseFloat(String(value));
        } else if (datatypeUri.includes('boolean')) {
          value = value === 'true' || value === true || value === 1;
        }
      } else if (typeof value === 'string') {
        // If no explicit datatype, try to infer from string value
        const numValue = Number(value);
        if (
          !isNaN(numValue) &&
          isFinite(numValue) &&
          value.trim() !== '' &&
          !isNaN(parseInt(value, 10))
        ) {
          // Check if it's an integer or float
          if (Number.isInteger(numValue) && !value.includes('.')) {
            value = parseInt(value, 10);
          } else {
            value = numValue;
          }
        }
      }

      const prop_name = this.handle_vocab_uri(mappings, namedPredicate);

      // If at least a name is defined and the predicate is one of the properties defined by the user
      if (
        this.handle_multival_strategy === HANDLE_MULTIVAL_STRATEGY.ARRAY &&
        this.multival_props_names.includes(namedPredicate.value)
      ) {
        // Create a new literal with the converted value
        const convertedLiteral = DataFactory.literal(value, literal.datatype);
        this.add_prop(prop_name, convertedLiteral, true);
      }
      // If the user doesn't define any predicate to manage as an array, then everything is an array
      else if (
        this.handle_multival_strategy === HANDLE_MULTIVAL_STRATEGY.ARRAY &&
        this.multival_props_names.length === 0
      ) {
        const convertedLiteral = DataFactory.literal(value, literal.datatype);
        this.add_prop(prop_name, convertedLiteral, true);
      } else {
        const convertedLiteral = DataFactory.literal(value, literal.datatype);
        this.add_prop(prop_name, convertedLiteral);
      }
    }
    // Getting a label
    else if (namedPredicate.value === RDF_TYPE.value || namedPredicate.equals(RDF_TYPE)) {
      if (object.termType === 'NamedNode') {
        const label = this.handle_vocab_uri(mappings, object as NamedNode);
        this.add_label(label);
      }
    }
    // Getting its relationships
    else {
      if (object.termType === 'NamedNode') {
        const rel_type = this.handle_vocab_uri(mappings, namedPredicate);
        this.add_rel(rel_type, object as NamedNode);
      }
    }
  }

  private literalToValue(literal: Literal): any {
    /**
     * Converts an RDF Literal to a JavaScript value.
     * Handles type conversion for numeric and boolean types.
     */
    const value: any = literal.value;

    // Handle numeric types based on datatype
    if (literal.datatype) {
      const datatypeUri =
        typeof literal.datatype === 'string' ? literal.datatype : literal.datatype.value;
      if (datatypeUri.includes('integer') || datatypeUri.includes('int')) {
        return parseInt(String(value), 10);
      } else if (
        datatypeUri.includes('float') ||
        datatypeUri.includes('double') ||
        datatypeUri.includes('decimal')
      ) {
        return parseFloat(String(value));
      } else if (datatypeUri.includes('boolean')) {
        return value === 'true' || value === true || value === 1;
      }
    }

    // If it's a string that looks like a number, try to parse it
    if (typeof value === 'string') {
      const numValue = Number(value);
      if (!isNaN(numValue) && isFinite(numValue) && value.trim() !== '') {
        if (Number.isInteger(numValue) && !value.includes('.')) {
          return parseInt(value, 10);
        }
        return numValue;
      }
    }

    return value;
  }

  private termToString(term: Term): string {
    /**
     * Converts an RDF Term to a string.
     */
    if (term.termType === 'NamedNode' || term.termType === 'BlankNode') {
      return term.value;
    }
    if (term.termType === 'Literal') {
      return (term as Literal).value;
    }
    return String(term);
  }
}
