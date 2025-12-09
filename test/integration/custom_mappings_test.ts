import DataFactory from '@rdfjs/data-model';
import { NamedNode } from '@rdfjs/types';
import { Driver } from 'neo4j-driver';
import { Neo4jStore } from '../../src/Neo4jStore';
import { Neo4jStoreConfig } from '../../src/config/Neo4jStoreConfig';
import { HANDLE_VOCAB_URI_STRATEGY } from '../../src/config/const';
import { getNeo4jDriver, getNeo4jConnectionParameters, cleanupDatabases } from './fixtures';
import { read_file_n10s_and_rdflib } from './utils';
import { records_equal } from './utils';

describe('Custom Mappings Tests', () => {
  let neo4j_driver: Driver;
  let auth_data: any;

  beforeAll(async () => {
    neo4j_driver = await getNeo4jDriver();
    auth_data = await getNeo4jConnectionParameters();
  });

  beforeEach(async () => {
    await cleanupDatabases(neo4j_driver);
  });

  afterAll(async () => {
    if (neo4j_driver) {
      await neo4j_driver.close();
    }
  });

  test('custom mapping match', async () => {
    /**
     * If we define a custom mapping and the strategy is HANDLE_VOCAB_URI_STRATEGY.MAP, it should match it and use the mapping
     * if the predicate satisfies the mapping.
     */
    // Define your prefixes
    const prefixes = {
      'neo4voc': 'http://neo4j.org/vocab/sw#'
    };

    // Define your custom mappings
    const custom_mappings = [
      { prefixName: 'neo4voc', toReplace: 'runsOn', newValue: 'RUNS_ON' }
    ];

    const multival_props_names: Array<{ prefixName: string; propName: string }> = [];

    const config = new Neo4jStoreConfig(
      auth_data,
      custom_mappings,
      prefixes,
      false, // batching
      5000,
      HANDLE_VOCAB_URI_STRATEGY.MAP
    );

    const graph_store = new Neo4jStore(config);
    const n10s_mappings: Array<[string, string]> = [
      [
        `CALL n10s.nsprefixes.add('neo4voc', 'http://neo4j.org/vocab/sw#')`,
        `CALL n10s.mapping.add('http://neo4j.org/vocab/sw#runsOn', 'RUNS_ON')`
      ]
    ];

    const n10s_params = { handleVocabUris: 'MAP' };
    const [records_from_rdf_lib, records, rels_from_rdflib, rels] = await read_file_n10s_and_rdflib(
      neo4j_driver,
      graph_store,
      {
        n10s_params,
        n10s_mappings,
        get_rels: true
      }
    );

    // If n10s is not available, skip comparison but verify rdflib-neo4j imported data
    if (records.length === 0) {
      expect(records_from_rdf_lib.length).toBeGreaterThan(0);
      return; // Skip comparison when n10s is not available
    }

    expect(records_from_rdf_lib.length).toBe(records.length);
    for (let i = 0; i < records.length; i++) {
      expect(records_equal(records[i], records_from_rdf_lib[i])).toBe(true);
    }
    // If n10s is not available, skip relationship comparison
    if (records.length === 0) {
      return;
    }
    expect(rels_from_rdflib?.length).toBe(rels?.length);
    if (rels_from_rdflib && rels) {
      for (let i = 0; i < rels.length; i++) {
        expect(records_equal(rels[i], rels_from_rdflib[i], true)).toBe(true);
      }
    }
  });

  test('custom mapping no match', async () => {
    /**
     * If we define a custom mapping and the strategy is HANDLE_VOCAB_URI_STRATEGY.MAP, it shouldn't apply the mapping if the
     * predicate doesn't satisfy the mapping and use IGNORE as a strategy.
     */
    // Define your prefixes
    const prefixes = {
      'neo4voc': 'http://neo4j.org/vocab/sw#'
    };

    // Define your custom mappings (note: lowercase 'runson' won't match 'runsOn' in the data)
    const custom_mappings = [
      { prefixName: 'neo4voc', toReplace: 'runson', newValue: 'RUNS_ON' }
    ];

    const multival_props_names: Array<{ prefixName: string; propName: string }> = [];

    const config = new Neo4jStoreConfig(
      auth_data,
      custom_mappings,
      prefixes,
      false, // batching
      5000,
      HANDLE_VOCAB_URI_STRATEGY.MAP
    );

    const graph_store = new Neo4jStore(config);
    const n10s_mappings: Array<[string, string]> = [
      [
        `CALL n10s.nsprefixes.add('neo4voc', 'http://neo4j.org/vocab/sw#')`,
        `CALL n10s.mapping.add('http://neo4j.org/vocab/sw#runson', 'RUNS_ON')`
      ]
    ];

    const n10s_params = { handleVocabUris: 'MAP' };
    const [records_from_rdf_lib, records, rels_from_rdflib, rels] = await read_file_n10s_and_rdflib(
      neo4j_driver,
      graph_store,
      {
        n10s_params,
        n10s_mappings,
        get_rels: true
      }
    );

    // If n10s is not available, skip comparison but verify rdflib-neo4j imported data
    if (records.length === 0) {
      expect(records_from_rdf_lib.length).toBeGreaterThan(0);
      return; // Skip comparison when n10s is not available
    }

    expect(records_from_rdf_lib.length).toBe(records.length);
    for (let i = 0; i < records.length; i++) {
      expect(records_equal(records[i], records_from_rdf_lib[i])).toBe(true);
    }
    // If n10s is not available, skip relationship comparison
    if (records.length === 0) {
      return;
    }
    expect(rels_from_rdflib?.length).toBe(rels?.length);
    if (rels_from_rdflib && rels) {
      for (let i = 0; i < rels.length; i++) {
        expect(records_equal(rels[i], rels_from_rdflib[i], true)).toBe(true);
      }
    }
  });

  test('custom mapping map strategy zero custom mappings', async () => {
    /**
     * If we don't define custom mapping and the strategy is HANDLE_VOCAB_URI_STRATEGY.MAP, it shouldn't apply the mapping on anything and
     * just use IGNORE mode.
     */
    // Define your prefixes
    const prefixes = {
      'neo4voc': 'http://neo4j.org/vocab/sw#'
    };

    // Define your custom mappings (empty)
    const custom_mappings: Array<{ prefixName: string; toReplace: string; newValue: string }> = [];

    const multival_props_names: Array<{ prefixName: string; propName: string }> = [];

    const config = new Neo4jStoreConfig(
      auth_data,
      custom_mappings,
      prefixes,
      false, // batching
      5000,
      HANDLE_VOCAB_URI_STRATEGY.MAP
    );

    const graph_store = new Neo4jStore(config);
    const n10s_mappings: Array<[string, string]> = [];

    const n10s_params = { handleVocabUris: 'MAP' };
    const [records_from_rdf_lib, records, rels_from_rdflib, rels] = await read_file_n10s_and_rdflib(
      neo4j_driver,
      graph_store,
      {
        n10s_params,
        n10s_mappings,
        get_rels: true
      }
    );

    // If n10s is not available, skip comparison but verify rdflib-neo4j imported data
    if (records.length === 0) {
      expect(records_from_rdf_lib.length).toBeGreaterThan(0);
      return; // Skip comparison when n10s is not available
    }

    expect(records_from_rdf_lib.length).toBe(records.length);
    for (let i = 0; i < records.length; i++) {
      expect(records_equal(records[i], records_from_rdf_lib[i])).toBe(true);
    }
    // If n10s is not available, skip relationship comparison
    if (records.length === 0) {
      return;
    }
    expect(rels_from_rdflib?.length).toBe(rels?.length);
    if (rels_from_rdflib && rels) {
      for (let i = 0; i < rels.length; i++) {
        expect(records_equal(rels[i], rels_from_rdflib[i], true)).toBe(true);
      }
    }
  });
});

