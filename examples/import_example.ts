import { Neo4jStoreConfig, Neo4jStore, HANDLE_VOCAB_URI_STRATEGY } from '../src/index';
import { Parser } from 'n3';

/**
 * Example: Import RDF data into Neo4j using rdflib-neo4j
 * 
 * Get your Aura Db free instance here: https://neo4j.com/cloud/aura-free/#test-drive-section
 */

async function main() {
  // Set up your Aura DB connection
  const AURA_DB_URI = process.env.AURA_DB_URI || 'your_db_uri';
  const AURA_DB_USERNAME = process.env.AURA_DB_USERNAME || 'neo4j';
  const AURA_DB_PWD = process.env.AURA_DB_PWD || 'your_db_pwd';

  const auth_data = {
    uri: AURA_DB_URI,
    database: 'neo4j',
    user: AURA_DB_USERNAME,
    pwd: AURA_DB_PWD
  };

  // Define your prefixes
  const prefixes = {
    'neo4ind': 'http://neo4j.org/ind#',
    'neo4voc': 'http://neo4j.org/vocab/sw#',
    'nsmntx': 'http://neo4j.org/vocab/NSMNTX#',
    'apoc': 'http://neo4j.org/vocab/APOC#',
    'graphql': 'http://neo4j.org/vocab/GraphQL#'
  };

  // Define your custom mappings
  const config = new Neo4jStoreConfig(
    auth_data,
    [],
    prefixes,
    true, // batching
    5000, // batch_size
    HANDLE_VOCAB_URI_STRATEGY.IGNORE
  );

  // Create the store
  const graph_store = new Neo4jStore(config);
  await graph_store.open(undefined, true);

  // Parse and import RDF data
  // Note: For Node.js < 18, you may need to install node-fetch or use https module
  const file_path = 'https://raw.githubusercontent.com/neo4j-labs/neosemantics/3.5/docs/rdf/nsmntx.ttl';
  
  // Fetch the RDF file
  // Using global fetch (available in Node.js 18+ or with node-fetch package)
  let rdfData: string;
  if (typeof fetch !== 'undefined') {
    const response = await fetch(file_path);
    rdfData = await response.text();
  } else {
    // Fallback for older Node.js versions - you would need to implement HTTP fetch here
    // or install node-fetch: npm install node-fetch @types/node-fetch
    throw new Error('fetch is not available. Please use Node.js 18+ or install node-fetch');
  }
  
  // Parse the RDF data
  const parser = new Parser({ format: 'text/turtle' });
  const quads = parser.parse(rdfData);

  // Add all quads to the store
  for (const quad of quads) {
    await graph_store.add(quad);
  }

  // Close the store (this will commit any pending transactions if batching is enabled)
  await graph_store.close(true);

  console.log('Import completed successfully!');
}

main().catch(console.error);

