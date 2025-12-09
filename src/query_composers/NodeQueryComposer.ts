import { HANDLE_MULTIVAL_STRATEGY } from '../config/const';

function prop_query_append(prop: string): string {
  return `n.\`${prop}\` = CASE WHEN COALESCE(param.\`${prop}\`, NULL) IS NULL THEN n.\`${prop}\` ELSE REDUCE(i=COALESCE(n.\`${prop}\`,[]), val IN param.\`${prop}\` | CASE WHEN val IN i THEN i ELSE i+val END) END `;
}

function prop_query_single(prop: string): string {
  return `n.\`${prop}\` = COALESCE(param.\`${prop}\`, n.\`${prop}\`)`;
}

export class NodeQueryComposer {
  labels: Set<string>;
  props: Set<string>;
  multi_props: Set<string>;
  query_params: Record<string, any>[];
  handle_multival_strategy: HANDLE_MULTIVAL_STRATEGY;
  multival_props_predicates: string[];

  /**
   * Initializes a NodeQueryComposer object.
   *
   * @param labels - The labels to assign to the nodes.
   * @param handle_multival_strategy - The strategy to handle multivalued properties.
   * @param multival_props_predicates - List of predicates to be treated as multivalued.
   */
  constructor(
    labels: Set<string>,
    handle_multival_strategy: HANDLE_MULTIVAL_STRATEGY,
    multival_props_predicates: string[]
  ) {
    this.labels = labels;
    this.props = new Set<string>();
    this.multi_props = new Set<string>();
    this.query_params = [];
    this.handle_multival_strategy = handle_multival_strategy;
    this.multival_props_predicates = multival_props_predicates;
  }

  add_props(props: Set<string>, multi: boolean = false): void {
    /**
     * Adds properties to the set of properties.
     *
     * @param props - The properties to add.
     * @param multi - If the property should be treated as multivalued. Default: false
     */
    if (!multi) {
      for (const prop of props) {
        this.props.add(prop);
      }
    } else {
      for (const prop of props) {
        this.multi_props.add(prop);
      }
    }
  }

  add_query_param(param: Record<string, any>): void {
    /**
     * Adds a query parameter.
     *
     * @param param - The query parameter to add.
     */
    this.query_params.push(param);
  }

  write_query(): string {
    /**
     * Writes the Neo4j query for creating nodes with labels and properties.
     *
     * @returns The Neo4j query.
     */
    let q = ` UNWIND $params as param MERGE (n:Resource{ uri : param.uri }) `;
    if (this.labels.size > 0) {
      const labelParts = Array.from(this.labels).map(label => `n:\`${label}\``);
      q += `SET ${labelParts.join(', ')} `;
    }
    if (this.props.size > 0 || this.multi_props.size > 0) {
      q += this.write_prop_query();
    }
    return q;
  }

  write_prop_query(): string {
    /**
     * Generates a Cypher query to handle property updates based on the chosen strategy.
     *
     * @returns The generated Cypher query.
     */
    if (this.handle_multival_strategy === HANDLE_MULTIVAL_STRATEGY.ARRAY) {
      // Strategy to treat multiple values as an array
      if (this.multival_props_predicates.length > 0) {
        // If there are properties treated as multivalued, use SET query for each property
        // and SET query for each property to append to the array
        let q = this.props.size > 0
          ? `SET ${Array.from(this.props).map(prop_query_single).join(', ')}`
          : '';
        if (this.multi_props.size > 0) {
          q += ` SET ${Array.from(this.multi_props).map(prop_query_append).join(', ')}`;
        }
        return q;
      } else {
        // If all properties are treated as multivalued, use SET query to append to the array
        return `SET ${Array.from(this.multi_props).map(prop_query_append).join(', ')}`;
      }
    } else {
      // Strategy to overwrite multiple values
      // Use SET query for each property
      return `SET ${Array.from(this.props).map(prop_query_single).join(', ')}`;
    }
  }

  is_redundant(): boolean {
    /**
     * Checks if the NodeQueryComposer is redundant, i.e., if it has no properties, labels and query parameters.
     *
     * @returns True if redundant, False otherwise.
     */
    return this.props.size === 0 && this.labels.size === 0 && this.query_params.length === 0;
  }

  empty_query_params(): void {
    /**
     * Empties the query parameters list.
     */
    this.query_params = [];
  }
}

