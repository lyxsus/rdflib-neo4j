import DataFactory from '@rdfjs/data-model';
import type { Driver } from 'neo4j-driver';
import { HANDLE_VOCAB_URI_STRATEGY } from '../../src/config/const';
import { Neo4jStoreConfig } from '../../src/config/Neo4jStoreConfig';
import { Neo4jStore } from '../../src/Neo4jStore';
import { GET_DATA_QUERY, RDFLIB_DB } from './constants';
import { cleanupDatabases, getNeo4jConnectionParameters, getNeo4jDriver } from './fixtures';

const FOAF = {
  name: DataFactory.namedNode('http://xmlns.com/foaf/0.1/name'),
};

describe('Store Initialization Tests', () => {
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

  test('initialize store with credentials', async () => {
    const config = new Neo4jStoreConfig(
      auth_data,
      [],
      {},
      false,
      5000,
      HANDLE_VOCAB_URI_STRATEGY.MAP
    );

    const graph_store = new Neo4jStore(config);
    await graph_store.open(true);

    try {
      const donna = DataFactory.namedNode('https://example.org/donna');
      const nameLiteral = DataFactory.literal('Donna Fales');
      const quad = DataFactory.quad(donna, FOAF.name, nameLiteral);
      await graph_store.add(quad);
      await graph_store.commit();

      // Wait a bit for the data to be committed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Query the default database (where the store writes)
      const result = await neo4j_driver.executeQuery(GET_DATA_QUERY);
      expect(result.records.length).toBe(1);
    } finally {
      await graph_store.close(true);
    }
  });

  test('initialize store with driver', async () => {
    const config = new Neo4jStoreConfig(null, [], {}, false, 5000, HANDLE_VOCAB_URI_STRATEGY.MAP);

    const graph_store = new Neo4jStore(config, neo4j_driver);
    // When using a driver, we need to specify the database in the session
    // For now, we'll use the default database and query it
    await graph_store.open(true);

    const donna = DataFactory.namedNode('https://example.org/donna');
    const nameLiteral = DataFactory.literal('Donna Fales');
    const quad = DataFactory.quad(donna, FOAF.name, nameLiteral);
    await graph_store.add(quad);
    await graph_store.commit();

    // Query the default database since we're using a driver without auth_data
    const result = await neo4j_driver.executeQuery(GET_DATA_QUERY);
    expect(result.records.length).toBe(1);

    await graph_store.close(true);
  });

  test('initialize with both credentials and driver should fail', () => {
    const config = new Neo4jStoreConfig(
      auth_data,
      [],
      {},
      false,
      5000,
      HANDLE_VOCAB_URI_STRATEGY.MAP
    );

    expect(() => {
      new Neo4jStore(config, neo4j_driver);
    }).toThrow('Either initialize the store with credentials or driver. You cannot do both.');
  });
});
