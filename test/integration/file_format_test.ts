import { Driver } from 'neo4j-driver';
import { Neo4jStore } from '../../src/Neo4jStore';
import { getNeo4jDriver, config_graph_store, cleanupDatabases, getNeo4jConnectionParameters } from './fixtures';
import { read_file_n10s_and_rdflib, records_equal } from './utils';

describe('File Format Tests', () => {
  let neo4j_driver: Driver;
  let graph_store: Neo4jStore;
  let auth_data: any;

  beforeAll(async () => {
    neo4j_driver = await getNeo4jDriver();
    auth_data = await getNeo4jConnectionParameters();
  });

  beforeEach(async () => {
    await cleanupDatabases(neo4j_driver);
    graph_store = config_graph_store(auth_data, false);
  });

  afterEach(async () => {
    if (graph_store && graph_store.is_open()) {
      await graph_store.close(true);
    }
  });

  afterAll(async () => {
    if (neo4j_driver) {
      await neo4j_driver.close();
    }
  });

  test('read json-ld file', async () => {
    /**Compare data imported with n10s procs and n10s + rdflib in single add mode*/
    const [records_from_rdf_lib, records] = await read_file_n10s_and_rdflib(neo4j_driver, graph_store, {
      file_path: 'test_files/n10s_example.json',
      n10s_file_format: "'JSON-LD'",
      rdflib_file_format: 'application/ld+json'
    });

    expect(records_from_rdf_lib.length).toBe(records.length);
    for (let i = 0; i < records.length; i++) {
      expect(records_equal(records[i], records_from_rdf_lib[i])).toBe(true);
    }
  });
});

