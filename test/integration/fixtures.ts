import { Driver, driver as createDriver, auth } from 'neo4j-driver';
import { Neo4jContainer, StartedNeo4jContainer } from '@testcontainers/neo4j';
import { Neo4jStore } from '../../src/Neo4jStore';
import { Neo4jStoreConfig } from '../../src/config/Neo4jStoreConfig';
import { HANDLE_VOCAB_URI_STRATEGY } from '../../src/config/const';
import { LOCAL, N10S_CONSTRAINT_QUERY, RDFLIB_DB } from './constants';
import { AuthData } from '../../src/config/utils';

let neo4jContainer: StartedNeo4jContainer | null = null;

export async function setupNeo4jContainer(): Promise<StartedNeo4jContainer> {
  if (!LOCAL && !neo4jContainer) {
    const { Neo4jPlugin } = await import('@testcontainers/neo4j');
    neo4jContainer = await new Neo4jContainer('neo4j:5.7.0-enterprise')
      .withPlugins([Neo4jPlugin.NEO_SEMANTICS])
      .start();
  }
  return neo4jContainer!;
}

export async function teardownNeo4jContainer(): Promise<void> {
  if (neo4jContainer) {
    try {
      await neo4jContainer.stop();
    } catch (e) {
      // Ignore errors during teardown
    }
    neo4jContainer = null;
  }
}

export async function getNeo4jDriver(): Promise<Driver> {
  let driver: Driver;
  
  if (!LOCAL) {
    const container = await setupNeo4jContainer();
    const uri = container.getBoltUri();
    const password = container.getPassword();
    driver = createDriver(uri, auth.basic('neo4j', password));
  } else {
    // If in local development environment, use a local Neo4j instance
    const auth_data: AuthData = {
      uri: process.env.NEO4J_URI_LOCAL || 'bolt://localhost:7687',
      database: RDFLIB_DB,
      user: process.env.NEO4J_USER_LOCAL || 'neo4j',
      pwd: process.env.NEO4J_PWD_LOCAL || 'password'
    };
    driver = createDriver(auth_data.uri, auth.basic(auth_data.user, auth_data.pwd));
  }

  // Initialize n10s procs - try to create database, ignore if it already exists or if multi-database is not supported
  try {
    await driver.executeQuery(`CREATE DATABASE ${RDFLIB_DB} IF NOT EXISTS WAIT`, {
      database: 'system'
    });
    // If database creation succeeded, use the created database
    await driver.executeQuery(N10S_CONSTRAINT_QUERY, { database: RDFLIB_DB });
  } catch (e: any) {
    // If database creation fails (e.g., Community Edition doesn't support it), use default database
    if (e.message?.includes('Unsupported administration command') || e.code?.includes('Neo.ClientError.Statement')) {
      console.log('Multi-database not supported, using default database');
    } else if (!e.message?.includes('already exists') && !e.code?.includes('42N11')) {
      throw e;
    }
  }
  
  // Always create constraint in default database
  await driver.executeQuery(N10S_CONSTRAINT_QUERY);

  return driver;
}

export async function cleanupDatabases(driver: Driver): Promise<void> {
  /**Executed before each test*/
  // Clean both databases to ensure no leftover data
  try {
    await driver.executeQuery('MATCH (n) DETACH DELETE n');
  } catch (e) {
    // Ignore errors
  }
  try {
    await driver.executeQuery('MATCH (n) DETACH DELETE n', { database: RDFLIB_DB });
  } catch (e) {
    // Ignore errors if database doesn't exist or isn't accessible
  }
}

export function config_graph_store(
  auth_data: AuthData,
  batching: boolean = false
): Neo4jStore {
  const config = new Neo4jStoreConfig(
    auth_data,
    [],
    {},
    batching,
    5000,
    HANDLE_VOCAB_URI_STRATEGY.IGNORE
  );

  return new Neo4jStore(config);
}

export async function getNeo4jConnectionParameters(): Promise<AuthData> {
  if (LOCAL) {
    return {
      uri: process.env.NEO4J_URI_LOCAL || 'bolt://localhost:7687',
      database: RDFLIB_DB,
      user: process.env.NEO4J_USER_LOCAL || 'neo4j',
      pwd: process.env.NEO4J_PWD_LOCAL || 'password'
    };
  } else {
    const container = await setupNeo4jContainer();
    return {
      uri: container.getBoltUri(),
      database: RDFLIB_DB,
      user: 'neo4j',
      pwd: container.getPassword()
    };
  }
}
