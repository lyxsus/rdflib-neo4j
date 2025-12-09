import { Driver, Record } from 'neo4j-driver';
import { Neo4jStore } from '../../src/Neo4jStore';
import { Neo4jStoreConfig } from '../../src/config/Neo4jStoreConfig';
import { HANDLE_VOCAB_URI_STRATEGY } from '../../src/config/const';
import { RDFLIB_DB, GET_NODES_PROPS_QUERY, GET_RELS_QUERY } from './constants';
import * as path from 'path';
import * as fs from 'fs';
import { Parser } from 'n3';
import { DataFactory, Store } from '@rdfjs/types';
import { Store as N3Store } from 'n3';

export function records_equal(record1: Record, record2: Record, rels: boolean = false): boolean {
  /**
   * Used because a test is failing because the sorting of the labels is different:
   * Full diff shows labels in different order
   */
  if (!rels) {
    for (const key of record1.keys) {
      if (key === 'props') {
        const props1 = record1.get(key) as Record<string, any>;
        const props2 = record2.get(key) as Record<string, any>;
        for (const prop_name in props1) {
          const val1 = props1[prop_name];
          const val2 = props2[prop_name];
          if (Array.isArray(val1) && Array.isArray(val2)) {
            if (JSON.stringify(val1.sort()) !== JSON.stringify(val2.sort())) {
              return false;
            }
          } else if (val1 !== val2) {
            return false;
          }
        }
      } else if (key === 'labels') {
        const labels1 = (record1.get(key) as string[]).sort();
        const labels2 = (record2.get(key) as string[]).sort();
        if (JSON.stringify(labels1) !== JSON.stringify(labels2)) {
          return false;
        }
      } else {
        if (record1.get(key) !== record2.get(key)) {
          return false;
        }
      }
    }
  } else {
    for (const key of record1.keys) {
      if (record1.get(key) !== record2.get(key)) {
        return false;
      }
    }
  }
  return true;
}

export interface ReadFileOptions {
  batching?: boolean;
  n10s_params?: Record<string, any>;
  n10s_mappings?: Array<[string, string]>;
  get_rels?: boolean;
  file_path?: string;
  n10s_file_format?: string;
  rdflib_file_format?: string;
}

export async function read_file_n10s_and_rdflib(
  neo4j_driver: Driver,
  graph_store: Neo4jStore,
  options: ReadFileOptions = {}
): Promise<[Record[], Record[], Record[] | null, Record[] | null]> {
  /**
   * Compare data imported with n10s procs and n10s + rdflib
   */
  const {
    batching = false,
    n10s_params = { handleVocabUris: 'IGNORE' },
    n10s_mappings = [],
    get_rels = false,
    file_path = '../test_files/n10s_example.ttl',
    n10s_file_format = "'Turtle'",
    rdflib_file_format = 'ttl'
  } = options;

  // Read and parse RDF file
  const testDir = path.dirname(__filename);
  const fullPath = path.join(testDir, file_path);
  const rdf_payload = fs.readFileSync(fullPath, 'utf-8');

  // Import with n10s
  await neo4j_driver.executeQuery('CALL n10s.graphconfig.init($params)', { params: n10s_params });
  for (const [prefix, mapping] of n10s_mappings) {
    await neo4j_driver.executeQuery(prefix);
    await neo4j_driver.executeQuery(mapping);
  }

  const n10sResult = await neo4j_driver.executeQuery(
    `CALL n10s.rdf.import.inline($payload, ${n10s_file_format})`,
    { payload: rdf_payload }
  );
  // Note: n10s result structure may differ, adjust as needed
  // assert records[0][0]["terminationStatus"] == "OK"

  // Import with rdflib-neo4j
  const parser = new Parser({ format: rdflib_file_format });
  const quads = parser.parse(rdf_payload);
  
  await graph_store.open(undefined, true);
  for (const quad of quads) {
    await graph_store.add(quad);
  }
  
  // When batching we need to close the store to check that all the data is flushed
  if (batching) {
    await graph_store.close(true);
  } else {
    await graph_store.commit();
  }

  const recordsResult = await neo4j_driver.executeQuery(GET_NODES_PROPS_QUERY);
  const records_from_rdf_libResult = await neo4j_driver.executeQuery(GET_NODES_PROPS_QUERY, {
    database: RDFLIB_DB
  });
  
  const records = recordsResult.records;
  const records_from_rdf_lib = records_from_rdf_libResult.records;
  
  let n10s_rels: Record[] | null = null;
  let rdflib_rels: Record[] | null = null;
  if (get_rels) {
    const n10sRelsResult = await neo4j_driver.executeQuery(GET_RELS_QUERY);
    const rdflibRelsResult = await neo4j_driver.executeQuery(GET_RELS_QUERY, { database: RDFLIB_DB });
    n10s_rels = n10sRelsResult.records;
    rdflib_rels = rdflibRelsResult.records;
  }
  
  return [records_from_rdf_lib, records, rdflib_rels, n10s_rels];
}
