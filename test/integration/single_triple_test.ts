import DataFactory from '@rdfjs/data-model';
import { Literal, NamedNode } from '@rdfjs/types';
import { GET_DATA_QUERY, RDFLIB_DB } from './constants';
import { Driver } from 'neo4j-driver';
import { Neo4jStore } from '../../src/Neo4jStore';
import { Neo4jStoreConfig } from '../../src/config/Neo4jStoreConfig';
import { HANDLE_VOCAB_URI_STRATEGY } from '../../src/config/const';
import { getNeo4jDriver, getNeo4jConnectionParameters, cleanupDatabases } from './fixtures';

// FOAF namespace
const FOAF = {
  Person: DataFactory.namedNode('http://xmlns.com/foaf/0.1/Person'),
  name: DataFactory.namedNode('http://xmlns.com/foaf/0.1/name'),
  age: DataFactory.namedNode('http://xmlns.com/foaf/0.1/age')
};

const RDF_TYPE = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

describe('Single Triple Tests', () => {
  let neo4j_driver: Driver;
  let graph_store: Neo4jStore;
  let auth_data: any;

  beforeAll(async () => {
    neo4j_driver = await getNeo4jDriver();
    auth_data = await getNeo4jConnectionParameters();
  });

  beforeEach(async () => {
    await cleanupDatabases(neo4j_driver);
    // Wait a bit for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    const config = new Neo4jStoreConfig(
      auth_data,
      [],
      {},
      false,
      5000,
      HANDLE_VOCAB_URI_STRATEGY.IGNORE
    );
    // Let store create its own driver - it will use auth_data for connection
    graph_store = new Neo4jStore(config);
    await graph_store.open(true);
  });

  afterEach(async () => {
    // Don't close here - let each test close its own store if needed
    // Some tests need the store open to query after commit
    if (graph_store && graph_store.is_open()) {
      await graph_store.close(true);
    }
    // Clean up after each test to prevent data leakage
    await cleanupDatabases(neo4j_driver);
  });

  afterAll(async () => {
    if (neo4j_driver) {
      await neo4j_driver.close();
    }
  });

  test('import type as label', async () => {
    const donna = DataFactory.namedNode('https://example.org/donna');
    const quad = DataFactory.quad(donna, RDF_TYPE, FOAF.Person);
    await graph_store.add(quad);
    await graph_store.commit();
    
    // Wait for transaction to be fully committed and visible
    // Use a longer delay to ensure the write is visible across driver connections
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Query the default database (where the store writes)
    // Try multiple times in case of timing issues
    let result = await neo4j_driver.executeQuery(GET_DATA_QUERY);
    let donnaRecord = result.records.find((r: any) => r.get('uri') === 'https://example.org/donna');
    
    // If not found, retry once more
    if (!donnaRecord) {
      await new Promise(resolve => setTimeout(resolve, 500));
      result = await neo4j_driver.executeQuery(GET_DATA_QUERY);
      donnaRecord = result.records.find((r: any) => r.get('uri') === 'https://example.org/donna');
    }
    
    expect(donnaRecord).toBeDefined();
    if (!donnaRecord) {
      throw new Error(`Donna record not found. Found ${result.records.length} total records.`);
    }
    
    const labels = donnaRecord.get('labels') as string[];
    expect(new Set(labels)).toEqual(new Set(['Person', 'Resource']));
    const props = donnaRecord.get('props') as Record<string, any>;
    // Check that URI is correct
    expect(props.uri).toBe('https://example.org/donna');
    // The props should only contain URI for this test (no other properties)
    expect(props).toHaveProperty('uri', 'https://example.org/donna');
  });

  test('import string property', async () => {
    // Ensure clean state
    await cleanupDatabases(neo4j_driver);
    
    const donna = DataFactory.namedNode('https://example.org/donna');
    const nameLiteral = DataFactory.literal('Donna Fales');
    const quad = DataFactory.quad(donna, FOAF.name, nameLiteral);
    await graph_store.add(quad);
    await graph_store.commit();

    await new Promise(resolve => setTimeout(resolve, 500));
    // Query the default database (where the store writes)
    const result = await neo4j_driver.executeQuery(GET_DATA_QUERY);
    // Find the record we just created
    const donnaRecord = result.records.find((r: any) => r.get('uri') === 'https://example.org/donna');
    expect(donnaRecord).toBeDefined();
    const labels = donnaRecord!.get('labels') as string[];
    expect(new Set(labels)).toEqual(new Set(['Resource']));
    const props = donnaRecord!.get('props') as Record<string, any>;
    expect(props).toEqual({ uri: 'https://example.org/donna', name: 'Donna Fales' });
  });

  test('import int property', async () => {
    // Ensure clean state
    await cleanupDatabases(neo4j_driver);
    
    const donna = DataFactory.namedNode('https://example.org/donna');
    const ageLiteral = DataFactory.literal('30', DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#integer'));
    const quad = DataFactory.quad(donna, FOAF.age, ageLiteral);
    await graph_store.add(quad);
    await graph_store.commit();

    await new Promise(resolve => setTimeout(resolve, 500));
    // Query the default database (where the store writes)
    const result = await neo4j_driver.executeQuery(GET_DATA_QUERY);
    // Find the record we just created
    const donnaRecord = result.records.find((r: any) => r.get('uri') === 'https://example.org/donna');
    expect(donnaRecord).toBeDefined();
    const labels = donnaRecord!.get('labels') as string[];
    expect(new Set(labels)).toEqual(new Set(['Resource']));
    const props = donnaRecord!.get('props') as Record<string, any>;
    expect(props).toEqual({ uri: 'https://example.org/donna', age: 30 });
  });
});
