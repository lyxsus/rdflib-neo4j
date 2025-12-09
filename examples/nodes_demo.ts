import { Neo4jStoreConfig, Neo4jStore, HANDLE_VOCAB_URI_STRATEGY } from '../src/index';
import { DataFactory } from '@rdfjs/data-model';

/**
 * Example: Write to the graph triple by triple
 */

async function main() {
  // Set up your store config
  const auth_data = {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    database: 'neo4j',
    user: process.env.NEO4J_USER || 'neo4j',
    pwd: process.env.NEO4J_PWD || 'password'
  };

  const config = new Neo4jStoreConfig(
    auth_data,
    [],
    {},
    false, // batching
    5000,
    HANDLE_VOCAB_URI_STRATEGY.IGNORE
  );

  // Create the graph and open the store
  const graph_store = new Neo4jStore(config);
  await graph_store.open(true);

  // Define namespaces
  const RDF = {
    type: DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
  };

  const SKOS = {
    Concept: DataFactory.namedNode('http://www.w3.org/2004/02/skos/core#Concept'),
    prefLabel: DataFactory.namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'),
    broader: DataFactory.namedNode('http://www.w3.org/2004/02/skos/core#broader')
  };

  const aura = DataFactory.namedNode('http://neo4j.com/voc/tech#AuraDB');
  const neo4j = DataFactory.namedNode('http://www.wikidata.org/entity/Q1628290');

  // Add triples
  await graph_store.add(DataFactory.quad(aura, RDF.type, SKOS.Concept));
  await graph_store.add(DataFactory.quad(aura, SKOS.prefLabel, DataFactory.literal('AuraDB')));
  await graph_store.add(DataFactory.quad(aura, SKOS.broader, neo4j));

  // Commit the changes
  await graph_store.commit();

  console.log('Triples added successfully!');
  
  await graph_store.close(true);
}

main().catch(console.error);

