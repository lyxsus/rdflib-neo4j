export class RelationshipQueryComposer {
  rel_type: string;
  props: Set<string>;
  query_params: Array<{ from: string; to: string }>;
  createdAtField: string;
  updatedAtField: string;

  /**
   * Initializes a RelationshipQueryComposer object.
   *
   * @param rel_type - The type of the relationship.
   * @param createdAtField - Property name for creation timestamp (default: "_createdAt").
   * @param updatedAtField - Property name for last-update timestamp (default: "_updatedAt").
   */
  constructor(
    rel_type: string,
    createdAtField: string = '_createdAt',
    updatedAtField: string = '_updatedAt'
  ) {
    this.rel_type = rel_type;
    this.props = new Set<string>();
    this.query_params = [];
    this.createdAtField = createdAtField;
    this.updatedAtField = updatedAtField;
  }

  add_props(props: Set<string>): void {
    /**
     * Adds properties to the set of properties.
     *
     * @param props - The properties to add.
     * @throws {Error} Not implemented - TO WORK ON THIS, WE NEED TEST DATA
     */
    for (const prop of props) {
      this.props.add(prop);
    }
    throw new Error('TO WORK ON THIS, WE NEED TEST DATA');
  }

  add_query_param(from_node: string, to_node: string): void {
    /**
     * Adds a query parameter consisting of 'from' (The URI of the node at the start of the relationship)
     * and 'to' (The URI of the node at the end of the relationship).
     *
     * @param from_node - The 'from' node (The URI of the node at the start of the relationship).
     * @param to_node - The 'to' node (The URI of the node at the end of the relationship).
     */
    this.query_params.push({ from: from_node, to: to_node });
  }

  write_query(): string {
    /**
     * Writes the Neo4j query for creating relationships with properties.
     *
     * @returns The Neo4j query.
     */
    let q = ` UNWIND $params as param 
                 MERGE (from:Resource{ uri : param["from"] }) 
                 MERGE (to:Resource{ uri : param["to"] })
             `;
    q += ` MERGE (from)-[r:\`${this.rel_type}\`]->(to)`;
    q += ` ON CREATE SET r.\`${this.createdAtField}\` = datetime(), r.\`${this.updatedAtField}\` = datetime()`;
    q += ` ON MATCH SET r.\`${this.updatedAtField}\` = datetime()`;
    if (this.props.size > 0) {
      throw new Error('Not implemented');
      // q += `SET ${', '.join([`r.\`${prop}\` = coalesce(param["${prop}"],null)` for prop in this.props])}`;
    }
    return q;
  }

  is_redundant(): boolean {
    /**
     * Checks if the RelationshipQueryComposer is redundant, i.e., if it has no query parameters.
     *
     * @returns True if redundant, False otherwise.
     */
    return this.query_params.length === 0;
  }

  empty_query_params(): void {
    /**
     * Empties the query parameters list.
     */
    this.query_params = [];
  }
}
