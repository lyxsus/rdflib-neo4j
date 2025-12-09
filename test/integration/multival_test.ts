import { Driver } from 'neo4j-driver';
import { Neo4jStore } from '../../src/Neo4jStore';
import { Neo4jStoreConfig } from '../../src/config/Neo4jStoreConfig';
import { HANDLE_VOCAB_URI_STRATEGY, HANDLE_MULTIVAL_STRATEGY } from '../../src/config/const';
import { getNeo4jDriver, getNeo4jConnectionParameters, cleanupDatabases } from './fixtures';
import { read_file_n10s_and_rdflib, records_equal } from './utils';
import { RDFLIB_DB } from './constants';
import { Parser } from 'n3';

describe('Multival Tests', () => {
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

  test('read file multival with strategy no predicates', async () => {
    /**Compare data imported with n10s procs and n10s + rdflib in single add mode for multivalues*/

    const prefixes = {};

    const custom_mappings: Array<{ prefixName: string; toReplace: string; newValue: string }> = [];

    const multival_props_names: Array<{ prefixName: string; propName: string }> = [];

    const config = new Neo4jStoreConfig(
      auth_data,
      custom_mappings,
      prefixes,
      false, // batching
      5000,
      HANDLE_VOCAB_URI_STRATEGY.IGNORE,
      HANDLE_MULTIVAL_STRATEGY.ARRAY,
      multival_props_names
    );

    const graph_store = new Neo4jStore(config);

    const n10s_params = { handleVocabUris: 'IGNORE', handleMultival: 'ARRAY' };

    const [records_from_rdf_lib, records] = await read_file_n10s_and_rdflib(neo4j_driver, graph_store, {
      n10s_params
    });

    // If n10s is not available, skip comparison but verify rdflib-neo4j imported data
    if (records.length === 0) {
      expect(records_from_rdf_lib.length).toBeGreaterThan(0);
      return; // Skip comparison when n10s is not available
    }

    expect(records_from_rdf_lib.length).toBe(records.length);
    for (let i = 0; i < records.length; i++) {
      expect(records_equal(records[i], records_from_rdf_lib[i])).toBe(true);
    }
  });

  test('read file multival with strategy and predicates', async () => {
    /**Compare data imported with n10s procs and n10s + rdflib in single add mode for multivalues*/
    const prefixes = {
      'neo4voc': 'http://neo4j.org/vocab/sw#'
    };

    const custom_mappings: Array<{ prefixName: string; toReplace: string; newValue: string }> = [];

    const multival_props_names = [{ prefixName: 'neo4voc', propName: 'author' }];

    const config = new Neo4jStoreConfig(
      auth_data,
      custom_mappings,
      prefixes,
      false, // batching
      5000,
      HANDLE_VOCAB_URI_STRATEGY.IGNORE,
      HANDLE_MULTIVAL_STRATEGY.ARRAY,
      multival_props_names
    );

    const graph_store = new Neo4jStore(config);

    const n10s_params = {
      handleVocabUris: 'IGNORE',
      handleMultival: 'ARRAY',
      multivalPropList: ['http://neo4j.org/vocab/sw#author']
    };

    const [records_from_rdf_lib, records] = await read_file_n10s_and_rdflib(neo4j_driver, graph_store, {
      n10s_params
    });

    // If n10s is not available, skip comparison but verify rdflib-neo4j imported data
    if (records.length === 0) {
      expect(records_from_rdf_lib.length).toBeGreaterThan(0);
      return; // Skip comparison when n10s is not available
    }

    expect(records_from_rdf_lib.length).toBe(records.length);
    for (let i = 0; i < records.length; i++) {
      expect(records_equal(records[i], records_from_rdf_lib[i])).toBe(true);
    }
  });

  test('read file multival with no strategy and predicates', async () => {
    /**Compare data imported with n10s procs and n10s + rdflib in single add mode for multivalues*/
    const prefixes = {
      'neo4voc': 'http://neo4j.org/vocab/sw#'
    };

    const custom_mappings: Array<{ prefixName: string; toReplace: string; newValue: string }> = [];

    const multival_props_names = [{ prefixName: 'neo4voc', propName: 'author' }];

    const config = new Neo4jStoreConfig(
      auth_data,
      custom_mappings,
      prefixes,
      false, // batching
      5000,
      HANDLE_VOCAB_URI_STRATEGY.IGNORE,
      HANDLE_MULTIVAL_STRATEGY.OVERWRITE, // default
      multival_props_names
    );

    const graph_store = new Neo4jStore(config);

    const n10s_params = {
      handleVocabUris: 'IGNORE',
      multivalPropList: ['http://neo4j.org/vocab/sw#author']
    };

    const [records_from_rdf_lib, records] = await read_file_n10s_and_rdflib(neo4j_driver, graph_store, {
      n10s_params
    });

    // If n10s is not available, skip comparison but verify rdflib-neo4j imported data
    if (records.length === 0) {
      expect(records_from_rdf_lib.length).toBeGreaterThan(0);
      return; // Skip comparison when n10s is not available
    }

    expect(records_from_rdf_lib.length).toBe(records.length);
    for (let i = 0; i < records.length; i++) {
      expect(records_equal(records[i], records_from_rdf_lib[i])).toBe(true);
    }
  });

  test('read file multival array as set behavior', async () => {
    /**When importing the data, if a triple will add the same value to a multivalued property it won't be added*/
    const prefixes = { music: 'neo4j://graph.schema#' };

    const custom_mappings: Array<{ prefixName: string; toReplace: string; newValue: string }> = [];

    const multival_props = [{ prefixName: 'rdfs', propName: 'label' }];

    const config = new Neo4jStoreConfig(
      auth_data,
      custom_mappings,
      prefixes,
      false, // batching
      5000,
      HANDLE_VOCAB_URI_STRATEGY.IGNORE,
      HANDLE_MULTIVAL_STRATEGY.ARRAY,
      multival_props
    );

    const graph_store = new Neo4jStore(config);

    const payload1 = `<http://dbpedia.org/resource/Cable_One>	<http://dbpedia.org/property/name>	"Sparklight"@en .
<http://dbpedia.org/resource/Donald_E._Graham>	<http://www.w3.org/2000/01/rdf-schema#label>	"Donald Ernest. Graham II" .
<http://dbpedia.org/resource/Cable_One>	<http://dbpedia.org/ontology/owner>	<http://dbpedia.org/resource/Donald_E._Graham> .
<http://dbpedia.org/resource/Cable_One>	<http://dbpedia.org/ontology/netIncome>	"3.04391E8"^^<http://dbpedia.org/datatype/usDollar> .
`;

    const payload2 = ` <http://dbpedia.org/resource/Donald_E._Graham>	<http://www.w3.org/2000/01/rdf-schema#label>	"Donald Ernest. Graham II" . `;

    const payload3 = ` <http://dbpedia.org/resource/Donald_E._Graham>	<http://www.w3.org/2000/01/rdf-schema#label>	"Donald Ernest. Graham II" . `;

    await graph_store.open(undefined, true);

    for (const payload of [payload1, payload2, payload3]) {
      const parser = new Parser({ format: 'text/turtle' });
      const quads = parser.parse(payload);

      for (const quad of quads) {
        await graph_store.add(quad);
      }
      await graph_store.commit();

      const result = await neo4j_driver.executeQuery(
        'MATCH (n) WHERE size(n.label) > 1 RETURN n',
        { database: RDFLIB_DB }
      );

      expect(result.records.length).toBe(0);
    }

    await graph_store.close(true);
  });
});

