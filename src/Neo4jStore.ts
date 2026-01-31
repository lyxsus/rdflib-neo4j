import DataFactory from '@rdfjs/data-model';
import { Literal, type NamedNode, type Quad } from '@rdfjs/types';
import { auth, driver as createDriver, type Driver, Result, type Session } from 'neo4j-driver';
import { NEO4J_DRIVER_USER_AGENT_NAME } from './config/const';
import type { Neo4jStoreConfig } from './config/Neo4jStoreConfig';
import { AuthData, check_auth_data } from './config/utils';
import { Neo4jTriple } from './Neo4jTriple';
import { NodeQueryComposer } from './query_composers/NodeQueryComposer';
import { RelationshipQueryComposer } from './query_composers/RelationshipQueryComposer';
import { handle_neo4j_driver_exception } from './utils';

export class Neo4jStore {
  context_aware: boolean = true;
  private __open: boolean = false;
  private driver: Driver | null = null;
  private session: Session | null = null;
  private driver_owned: boolean = false; // Track if we created the driver (should close it)
  private database: string | null = null; // Database name from auth_data
  config: Neo4jStoreConfig;
  batching: boolean;
  buffer_max_size: number;
  total_triples: number = 0;
  node_buffer_size: number = 0;
  rel_buffer_size: number = 0;
  node_buffer: Map<string, NodeQueryComposer> = new Map();
  rel_buffer: Map<string, RelationshipQueryComposer> = new Map();
  current_subject: Neo4jTriple | null = null;
  mappings: Record<string, string>;
  handle_vocab_uri_strategy: any;
  handle_multival_strategy: any;
  multival_props_predicates: string[];
  createdAtField: string;
  updatedAtField: string;

  /**
   * Initializes a Neo4jStore instance.
   *
   * @param config - The Neo4j store configuration.
   * @param neo4j_driver - Optional Neo4j driver instance. If not provided, will be created from config.
   */
  constructor(config: Neo4jStoreConfig, neo4j_driver?: Driver) {
    this.config = config;
    this.driver = neo4j_driver || null;
    this.driver_owned = !neo4j_driver; // We own the driver if we didn't receive one

    // Check that either driver or credentials are provided
    if (!neo4j_driver) {
      check_auth_data(config.auth_data);
      // Store the database name from auth_data
      this.database = config.auth_data?.database || null;
    } else if (config.auth_data) {
      throw new Error(
        'Either initialize the store with credentials or driver. You cannot do both.'
      );
    }

    this.batching = config.batching;
    this.buffer_max_size = config.batch_size;
    this.mappings = config.custom_mappings;
    this.handle_vocab_uri_strategy = config.handle_vocab_uri_strategy;
    this.handle_multival_strategy = config.handle_multival_strategy;
    this.multival_props_predicates = config.multival_props_names;
    this.createdAtField = config.createdAtField;
    this.updatedAtField = config.updatedAtField;
  }

  /**
   * Opens a connection to the Neo4j database.
   *
   * @param create - Flag indicating whether to create the uniqueness constraint if not found.
   */
  async open(create: boolean = true): Promise<void> {
    this.__create_session();
    await this.__constraint_check(create);
    this.__set_open(true);
  }

  /**
   * Closes the store.
   *
   * @param commit_pending_transaction - Flag indicating whether to commit any pending transaction before closing.
   */
  async close(commit_pending_transaction: boolean = true): Promise<void> {
    if (commit_pending_transaction) {
      await this.commit(true, false);
      await this.commit(false, true);
    }
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
    // Close the driver if we created it (not if it was passed in)
    if (this.driver && this.driver_owned) {
      await this.driver.close();
      this.driver = null;
    }
    this.__set_open(false);
    this.total_triples = 0;
  }

  /**
   * Checks if the store is open.
   *
   * @returns True if the store is open, False otherwise.
   */
  is_open(): boolean {
    return this.__open;
  }

  /**
   * Gets the Neo4j driver instance.
   *
   * @returns The Neo4j driver instance.
   */
  getDriver(): Driver {
    return this.__get_driver();
  }

  /**
   * Adds a quad to the Neo4j store.
   *
   * @param quad - The quad to add.
   * @param context - The context of the quad (default: undefined).
   * @param quoted - Flag indicating whether the quad is quoted (default: false).
   */
  async add(quad: Quad, context?: any, quoted: boolean = false): Promise<void> {
    if (!this.is_open()) {
      throw new Error('The Store must be open.');
    }
    if (context === this) {
      throw new Error('Can not add triple directly to store');
    }

    // Extract subject, predicate, object from quad
    const subject = quad.subject;
    // Only process NamedNode subjects (skip BlankNode and Variable)
    if (subject.termType !== 'NamedNode') {
      return;
    }
    this.__check_current_subject(subject as NamedNode);
    if (this.current_subject) {
      this.current_subject.parse_triple(quad, this.mappings);
    }
    this.total_triples += 1;

    // If batching, we push whenever the buffers are filled with enough data
    try {
      if (this.batching) {
        if (this.node_buffer_size >= this.buffer_max_size) {
          await this.commit(true, false);
        }
        if (this.rel_buffer_size >= this.buffer_max_size) {
          await this.commit(false, true);
        }
      } else {
        await this.commit();
      }
    } catch (e: any) {
      this.__close_on_error();
      throw e;
    }
  }

  /**
   * Commits the changes to the Neo4j database.
   *
   * @param commit_nodes - Flag indicating whether to commit the nodes in the buffer.
   * @param commit_rels - Flag indicating whether to commit the relationships in the buffer.
   */
  async commit(commit_nodes: boolean = false, commit_rels: boolean = false): Promise<void> {
    // To prevent edge cases for the last declaration in the file.
    if (this.current_subject) {
      this.__store_current_subject();
      this.current_subject = null;
    }
    // If both are false, commit both (default behavior)
    if (!commit_nodes && !commit_rels) {
      await this.__flushBuffer(false, false);
    } else {
      await this.__flushBuffer(commit_nodes, commit_rels);
    }
  }

  /**
   * Removes a quad from the store.
   * Not implemented - this is a streamer so it doesn't preserve the state.
   *
   * @param quad - The quad to remove.
   * @param context - The context of the quad.
   * @param txn - Transaction (not used).
   */
  async remove(quad: Quad, context?: any, txn?: any): Promise<void> {
    throw new Error(
      "This is a streamer so it doesn't preserve the state, there is no removal feature."
    );
  }

  private __close_on_error(): void {
    /**
     * Empties the query buffers in case of an error.
     *
     * This method empties the query parameters in the node and relationship buffers.
     */
    for (const node_buffer of this.node_buffer.values()) {
      node_buffer.empty_query_params();
    }
    for (const rel_buffer of this.rel_buffer.values()) {
      rel_buffer.empty_query_params();
    }
  }

  private __set_open(val: boolean): void {
    /**
     * Sets the 'open' status of the store.
     *
     * @param val - The value to set for the 'open' status.
     */
    this.__open = val;
  }

  private __get_driver(): Driver {
    if (!this.driver) {
      const auth_data = this.config.auth_data!;
      this.driver = createDriver(auth_data.uri, auth.basic(auth_data.user, auth_data.pwd), {
        userAgent: NEO4J_DRIVER_USER_AGENT_NAME,
      });
    }
    return this.driver;
  }

  private __create_session(): void {
    /**
     * Creates the Neo4j session and driver.
     *
     * This function initializes the driver and session based on the provided configuration.
     */
    const sessionConfig: any = {
      defaultAccessMode: 'WRITE',
    };

    // Use default database for session - write operations use driver.executeQuery which handles database
    // Some Neo4j setups have issues with session-level database configuration
    // The database will be specified in executeQuery calls instead

    this.session = this.__get_driver().session(sessionConfig);
  }

  private async __constraint_check(create: boolean): Promise<void> {
    /**
     * Checks the existence of a uniqueness constraint on the `Resource` node with the `uri` property.
     *
     * @param create - Flag indicating whether to create the constraint if not found.
     */
    // Test connectivity to backend and check that constraint on :Resource(uri) is present
    const constraint_check = `
       SHOW CONSTRAINTS YIELD * 
       WHERE type = "UNIQUENESS" 
           AND entityType = "NODE" 
           AND labelsOrTypes = ["Resource"] 
           AND properties = ["uri"] 
       RETURN COUNT(*) = 1 AS constraint_found
       `;

    const driver = this.__get_driver();
    const queryConfig: any = {};
    if (this.database) {
      queryConfig.database = this.database;
    }

    const result = await driver.executeQuery(constraint_check, queryConfig);
    const constraint_found =
      result.records.length > 0 && result.records[0].get('constraint_found') === true;

    if (!constraint_found && create) {
      try {
        // Create the uniqueness constraint
        const create_constraint = `
           CREATE CONSTRAINT n10s_unique_uri IF NOT EXISTS FOR (r:Resource) REQUIRE r.uri IS UNIQUE
           `;
        await driver.executeQuery(create_constraint, queryConfig);
      } catch (e: any) {
        // Silently fail - constraint creation may not be allowed
      }
    }
  }

  private __store_current_subject_props(): void {
    /**
     * Stores the properties of the current subject in the respective node buffer.
     *
     * This function adds the properties of the current subject to the node buffer for later insertion into the Neo4j database.
     */
    if (!this.current_subject) return;

    const label_key = this.current_subject.extract_label_key();
    if (!this.node_buffer.has(label_key)) {
      this.node_buffer.set(
        label_key,
        new NodeQueryComposer(
          new Set(this.current_subject.extract_labels()),
          this.handle_multival_strategy,
          this.multival_props_predicates,
          this.createdAtField,
          this.updatedAtField
        )
      );
    }

    const composer = this.node_buffer.get(label_key)!;
    composer.add_props(this.current_subject.extract_props_names());
    composer.add_props(this.current_subject.extract_props_names(true), true);
    const query_params = this.current_subject.extract_params();
    composer.add_query_param(query_params);
    this.node_buffer_size += 1;
  }

  private __store_current_subject_rels(): void {
    /**
     * Stores the relationships of the current subject in the respective relationship buffer.
     *
     * This function adds the relationships of the current subject to the relationship buffer for later insertion into the Neo4j database.
     */
    if (!this.current_subject) return;

    const rel_types_and_relationships = this.current_subject.extract_rels();
    if (Object.keys(rel_types_and_relationships).length > 0) {
      for (const rel_type in rel_types_and_relationships) {
        if (!this.rel_buffer.has(rel_type)) {
          this.rel_buffer.set(
            rel_type,
            new RelationshipQueryComposer(rel_type, this.createdAtField, this.updatedAtField)
          );
        }
        const composer = this.rel_buffer.get(rel_type)!;
        for (const to_node of rel_types_and_relationships[rel_type]) {
          const fromUri = this.termToString(this.current_subject.uri);
          const toUri = this.termToString(to_node);
          composer.add_query_param(fromUri, toUri);
          this.rel_buffer_size += 1;
        }
      }
    }
  }

  private __store_current_subject(): void {
    /**
     * Stores the current subject in the respective buffers.
     *
     * This function stores the current subject's properties and relationships in the respective buffers.
     */
    this.__store_current_subject_props();
    this.__store_current_subject_rels();
  }

  private __create_current_subject(subject: NamedNode): Neo4jTriple {
    const reversedPrefixes: Record<string, string> = {};
    const prefixes = this.config.get_prefixes();
    for (const [key, value] of Object.entries(prefixes)) {
      reversedPrefixes[value] = key;
    }
    return new Neo4jTriple(
      subject,
      this.handle_vocab_uri_strategy,
      this.handle_multival_strategy,
      this.multival_props_predicates,
      reversedPrefixes
    );
  }

  private __check_current_subject(subject: NamedNode): void {
    /**
     * Checks the current subject and stores the previous subject if it has changed.
     *
     * This function checks if the provided subject is the same as the current subject.
     * If the current subject is different, it stores the properties and relationships of the previous subject.
     *
     * @param subject - The subject to check.
     */
    if (this.current_subject === null) {
      this.current_subject = this.__create_current_subject(subject);
    } else {
      const currentUri = this.termToString(this.current_subject.uri);
      const newUri = this.termToString(subject);
      if (currentUri !== newUri) {
        this.__store_current_subject();
        this.current_subject = this.__create_current_subject(subject);
      }
    }
  }

  private termToString(term: any): string {
    if (term && typeof term === 'object' && 'value' in term) {
      return term.value;
    }
    return String(term);
  }

  private async __flushBuffer(only_nodes: boolean, only_rels: boolean): Promise<void> {
    /**
     * Flushes the buffer by committing the changes to the Neo4j database.
     *
     * @param only_nodes - Flag indicating whether to flush only nodes.
     * @param only_rels - Flag indicating whether to flush only relationships.
     */
    if (!this.is_open()) {
      throw new Error('The Store must be open.');
    }
    // If only_nodes is true, flush only nodes (and don't flush rels)
    // If only_rels is true, flush only rels (and don't flush nodes)
    // If both are false, flush both
    if (!only_rels) {
      await this.__flushNodeBuffer();
    }
    if (!only_nodes) {
      await this.__flushRelBuffer();
    }
  }

  private async __flushNodeBuffer(): Promise<void> {
    /**
     * Flushes the node buffer by committing the changes to the Neo4j database.
     */
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    for (const [key, cur] of this.node_buffer) {
      if (!cur.is_redundant() && cur.query_params.length > 0) {
        const query = cur.write_query();
        const params = cur.query_params;
        await this.__query_database(query, { params });
        cur.empty_query_params();
      }
    }
    this.node_buffer_size = 0;
  }

  private async __flushRelBuffer(): Promise<void> {
    /**
     * Flushes the relationship buffer by committing the changes to the Neo4j database.
     */
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    for (const [key, cur] of this.rel_buffer) {
      if (!cur.is_redundant()) {
        const query = cur.write_query();
        const params = cur.query_params;
        await this.__query_database(query, { params });
        cur.empty_query_params();
      }
    }
    this.rel_buffer_size = 0;
  }

  private async __query_database(query: string, params: any): Promise<void> {
    /**
     * Executes a Cypher query on the Neo4j database.
     *
     * @param query - The Cypher query to execute.
     * @param params - The parameters to pass to the query.
     */
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    try {
      // Use driver.executeQuery directly for reliable write operations
      // Use the database from auth_data if specified
      const driver = this.__get_driver();
      // Merge database config into params object (params is typically { params: [...] })
      const queryConfig: any = { ...params };
      if (this.database) {
        queryConfig.database = this.database;
      }
      await driver.executeQuery(query, queryConfig);
    } catch (e: any) {
      const error = handle_neo4j_driver_exception(e);
      console.error(error);
      throw error;
    }
  }
}
