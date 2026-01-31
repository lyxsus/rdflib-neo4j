import DataFactory from '@rdfjs/data-model';
import { types as neo4jTypes } from 'neo4j-driver';
import {
  HANDLE_MULTIVAL_STRATEGY,
  HANDLE_VOCAB_URI_STRATEGY,
} from '../../src/config/const';
import { Neo4jTriple } from '../../src/Neo4jTriple';

const XSD = {
  date: DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#date'),
  dateTime: DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#dateTime'),
  time: DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#time'),
};

const EX = {
  subject: DataFactory.namedNode('http://example.org/subject'),
  birthDate: DataFactory.namedNode('http://example.org/birthDate'),
  created: DataFactory.namedNode('http://example.org/created'),
  startTime: DataFactory.namedNode('http://example.org/startTime'),
};

function createTriple(): Neo4jTriple {
  const prefixes: Record<string, string> = {
    'http://example.org/': 'ex',
  };
  const mappings: Record<string, string> = {
    'http://example.org/birthDate': 'birthDate',
    'http://example.org/created': 'created',
    'http://example.org/startTime': 'startTime',
  };
  const triple = new Neo4jTriple(
    EX.subject,
    HANDLE_VOCAB_URI_STRATEGY.MAP,
    HANDLE_MULTIVAL_STRATEGY.OVERWRITE,
    [],
    prefixes
  );
  return triple;
}

describe('Neo4jTriple date/time literal conversion', () => {
  describe('xsd:date', () => {
    test('converts xsd:date literal to neo4j.types.Date', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('2025-01-31', XSD.date);
      const quad = DataFactory.quad(EX.subject, EX.birthDate, literal);
      triple.parse_triple(quad, {
        'http://example.org/birthDate': 'birthDate',
        'http://example.org/created': 'created',
        'http://example.org/startTime': 'startTime',
      });

      const params = triple.extract_params();
      expect(params.birthDate).toBeInstanceOf(neo4jTypes.Date);
      expect((params.birthDate as InstanceType<typeof neo4jTypes.Date>).toString()).toBe(
        '2025-01-31'
      );
    });

    test('handles xsd:date with Z timezone', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('2025-06-15Z', XSD.date);
      const quad = DataFactory.quad(EX.subject, EX.birthDate, literal);
      triple.parse_triple(quad, {
        'http://example.org/birthDate': 'birthDate',
      });

      const params = triple.extract_params();
      expect(params.birthDate).toBeInstanceOf(neo4jTypes.Date);
      expect((params.birthDate as InstanceType<typeof neo4jTypes.Date>).toString()).toBe(
        '2025-06-15'
      );
    });

    test('returns original string for invalid xsd:date value', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('not-a-date', XSD.date);
      const quad = DataFactory.quad(EX.subject, EX.birthDate, literal);
      triple.parse_triple(quad, {
        'http://example.org/birthDate': 'birthDate',
      });

      const params = triple.extract_params();
      expect(params.birthDate).toBe('not-a-date');
    });
  });

  describe('xsd:dateTime', () => {
    test('converts xsd:dateTime literal to neo4j.types.DateTime', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('2025-01-31T12:00:00Z', XSD.dateTime);
      const quad = DataFactory.quad(EX.subject, EX.created, literal);
      triple.parse_triple(quad, {
        'http://example.org/created': 'created',
      });

      const params = triple.extract_params();
      expect(params.created).toBeInstanceOf(neo4jTypes.DateTime);
      const dt = params.created as InstanceType<typeof neo4jTypes.DateTime>;
      expect(dt.toString()).toContain('2025-01-31');
      // Time part may be in local timezone, so just assert it looks like a datetime
      expect(dt.toString()).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    test('handles xsd:dateTime without timezone', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('2025-07-01T08:30:00', XSD.dateTime);
      const quad = DataFactory.quad(EX.subject, EX.created, literal);
      triple.parse_triple(quad, {
        'http://example.org/created': 'created',
      });

      const params = triple.extract_params();
      expect(params.created).toBeInstanceOf(neo4jTypes.DateTime);
    });

    test('returns original string for invalid xsd:dateTime value', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('invalid-datetime', XSD.dateTime);
      const quad = DataFactory.quad(EX.subject, EX.created, literal);
      triple.parse_triple(quad, {
        'http://example.org/created': 'created',
      });

      const params = triple.extract_params();
      expect(params.created).toBe('invalid-datetime');
    });
  });

  describe('xsd:time', () => {
    test('converts xsd:time literal to neo4j.types.LocalTime', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('14:30:00', XSD.time);
      const quad = DataFactory.quad(EX.subject, EX.startTime, literal);
      triple.parse_triple(quad, {
        'http://example.org/startTime': 'startTime',
      });

      const params = triple.extract_params();
      expect(params.startTime).toBeInstanceOf(neo4jTypes.LocalTime);
      expect(
        (params.startTime as InstanceType<typeof neo4jTypes.LocalTime>).toString()
      ).toContain('14:30:00');
    });

    test('handles xsd:time with fractional seconds', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('09:15:30.5', XSD.time);
      const quad = DataFactory.quad(EX.subject, EX.startTime, literal);
      triple.parse_triple(quad, {
        'http://example.org/startTime': 'startTime',
      });

      const params = triple.extract_params();
      expect(params.startTime).toBeInstanceOf(neo4jTypes.LocalTime);
      const t = params.startTime as InstanceType<typeof neo4jTypes.LocalTime>;
      expect(t.toString()).toContain('09:15:30');
    });

    test('returns original string for invalid xsd:time value', () => {
      const triple = createTriple();
      const literal = DataFactory.literal('not-a-time', XSD.time);
      const quad = DataFactory.quad(EX.subject, EX.startTime, literal);
      triple.parse_triple(quad, {
        'http://example.org/startTime': 'startTime',
      });

      const params = triple.extract_params();
      expect(params.startTime).toBe('not-a-time');
    });
  });

  describe('datatype URI matching', () => {
    test('matches dateTime before date (order of checks)', () => {
      const triple = createTriple();
      const literal = DataFactory.literal(
        '2025-01-31T00:00:00Z',
        DataFactory.namedNode('http://www.w3.org/2001/XMLSchema#dateTime')
      );
      const quad = DataFactory.quad(EX.subject, EX.created, literal);
      triple.parse_triple(quad, { 'http://example.org/created': 'created' });

      const params = triple.extract_params();
      expect(params.created).toBeInstanceOf(neo4jTypes.DateTime);
      expect(params.created).not.toBeInstanceOf(neo4jTypes.Date);
    });
  });
});
