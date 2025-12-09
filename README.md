<img src="https://raw.githubusercontent.com/RDFLib/rdflib/master/docs/_static/RDFlib.png" height="75">

# rdflib-neo4j
RDF Store backed by neo4j for TypeScript/JavaScript!

This library provides an RDF store implementation that persists RDF data to Neo4j, using the rdf.js ecosystem for RDF handling.

## Migration Notice

This is a TypeScript/JavaScript migration of the original Python [rdflib-neo4j](https://github.com/neo4j-labs/rdflib-neo4j) library developed by Neo4j Labs. The original Python implementation was created by Jesús Barrasa, Aleksandar Simeunovic, and Alfredo Rubin. This TypeScript version maintains the same functionality and API design while using the rdf.js ecosystem instead of Python RDFLib.

## Getting Started
Below are the procedures you should adhere to for both your Neo4j database and your TypeScript/JavaScript code:

### On the Neo4j side
To configure your Neo4j Graph DB, the process is simplified: initialize the database by establishing a uniqueness constraint on Resources' URIs. You can achieve this by executing the following Cypher fragment: 
```cypher
CREATE CONSTRAINT n10s_unique_uri FOR (r:Resource) REQUIRE r.uri IS UNIQUE;
```
This constraint ensures the uniqueness of URIs for Resource nodes, streamlining the integration process. Alternatively, you can simply set `create=true` when attempting to open the store in your TypeScript code, and it will create the constraint for you.

### On the TypeScript/JavaScript side
rdflib-neo4j can be installed with npm or yarn:

    $ npm install rdflib-neo4j
    # or
    $ yarn add rdflib-neo4j

### You're ready to go!
Now, seamlessly import RDF data into your Neo4j On-premise or Aura instance by establishing a store and parsing your RDF data. Each individual triple undergoes transparent persistence within your Neo4j database (whether it is on Aura or on-premise). Here's a step-by-step guide to achieve this integration:

You can import the data from an RDF document (for example [this one serialised using N-Triples](https://github.com/jbarrasa/datasets/blob/master/rdf/music.nt)):

```typescript
import { Neo4jStoreConfig, Neo4jStore, HANDLE_VOCAB_URI_STRATEGY } from 'rdflib-neo4j';
import { Parser } from 'n3';
import { DataFactory } from '@rdfjs/data-model';

// set the configuration to connect to your Aura DB
const AURA_DB_URI = "your_db_uri";
const AURA_DB_USERNAME = "neo4j";
const AURA_DB_PWD = "your_db_pwd";

const auth_data = {
  uri: AURA_DB_URI,
  database: "neo4j",
  user: AURA_DB_USERNAME,
  pwd: AURA_DB_PWD
};

// Define your custom prefixes
const prefixes = {
  'skos': 'http://www.w3.org/2004/02/skos/core#',
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
};

// Define your custom mappings & store config
const config = new Neo4jStoreConfig(
  auth_data,
  [], // custom_mappings
  prefixes,
  true, // batching
  5000, // batch_size
  HANDLE_VOCAB_URI_STRATEGY.IGNORE
);

const file_path = 'https://github.com/jbarrasa/gc-2022/raw/main/search/onto/concept-scheme-skos.ttl';

// Create the RDF Store, parse & ingest the data to Neo4j, and close the store
// (If the field batching is set to true in the Neo4jStoreConfig, remember to close the store to prevent the loss of any uncommitted records.)
const neo4j_aura = new Neo4jStore(config);
await neo4j_aura.open(true);

// Fetch and parse the RDF file
const response = await fetch(file_path);
const rdfData = await response.text();
const parser = new Parser({ format: 'text/turtle' });
const quads = parser.parse(rdfData);

// Add all quads to the store
for (const quad of quads) {
  await neo4j_aura.add(quad);
}

await neo4j_aura.close(true);
```

The imported file contains a taxonomy of technologies extracted from Wikidata and serialised using SKOS.
After running the previous code fragment, your Aura DB/Neo4j DB should be populated with a graph like this one:

<img src="https://raw.githubusercontent.com/neo4j-labs/rdflib-neo4j/master/img/graph-view-aura.png" height="400">

You can also write to the graph triple by triple like this:

```typescript
import { Neo4jStoreConfig, Neo4jStore, HANDLE_VOCAB_URI_STRATEGY } from 'rdflib-neo4j';
import { DataFactory } from '@rdfjs/data-model';

// Set up your store config
const config = new Neo4jStoreConfig(
  auth_data,
  [],
  {},
  false, // batching
  5000,
  HANDLE_VOCAB_URI_STRATEGY.IGNORE
);

// Create the graph and open the store
const neo4j_aura = new Neo4jStore(config);
await neo4j_aura.open(true);

// Define namespaces
const RDF = {
  type: DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')
};

const SKOS = {
  Concept: DataFactory.namedNode('http://www.w3.org/2004/02/skos/core#Concept'),
  prefLabel: DataFactory.namedNode('http://www.w3.org/2004/02/skos/core#prefLabel'),
  broader: DataFactory.namedNode('http://www.w3.org/2004/02/skos/core#broader')
};

const aura = DataFactory.namedNode("http://neo4j.com/voc/tech#AuraDB");
const neo4j = DataFactory.namedNode("http://www.wikidata.org/entity/Q1628290");

await neo4j_aura.add(DataFactory.quad(aura, RDF.type, SKOS.Concept));
await neo4j_aura.add(DataFactory.quad(aura, SKOS.prefLabel, DataFactory.literal("AuraDB")));
await neo4j_aura.add(DataFactory.quad(aura, SKOS.broader, neo4j));

await neo4j_aura.commit();
await neo4j_aura.close(true);
```

The previous fragment would add another node to the graph representing AuraDB as a concept related to Neo4j via `skos:broader`, which in your AuraDB graph would look as follows:

<img src="https://raw.githubusercontent.com/neo4j-labs/rdflib-neo4j/master/img/graph-view-aura-detail.png" height="150">

## Requirements

- Node.js 16+ or TypeScript 4.5+
- Neo4j 5.0+ (with n10s plugin for full compatibility)

## License

Apache 2.0
