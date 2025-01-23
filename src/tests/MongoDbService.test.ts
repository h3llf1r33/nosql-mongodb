import {Collection} from 'mongodb';
import {MongoExpressionBuilder} from "../mongodb/MongoExpressionBuilder";
import {IFilterQuery, IGenericFilterQuery} from "@denis_bruns/core";
import {fetchWithFiltersAndPaginationMongoDb} from "../mongodb/MongoDBService";

const expressionBuilder = new MongoExpressionBuilder("table");

class MockObjectId {
    constructor(private id: string) {}
    toString() {
        return this.id;
    }
}

let skipValue = 0;
let limitValue = 10;


jest.mock('mongodb', () => {
    const mockCollection = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockImplementation((val: number) => {
            skipValue = val;
            return mockCollection;
        }),
        limit: jest.fn().mockImplementation((val: number) => {
            limitValue = val;
            return mockCollection;
        }),
        toArray: jest.fn().mockImplementation(async () => {
            if (skipValue > 100) return [];
            if (limitValue === 0) return [];

            return [{
                _id: new MockObjectId('1'),
                id: 1,
                name: 'Test',
                active: true,
                tags: ['tag1', 'tag2'],
                counts: [1, 2, 3],
                metadata: { key: 'value' },
                list: ['item1', 123],
            }];
        }),
        countDocuments: jest.fn().mockImplementation(async (query = {}) => {
            if (skipValue > 100) return 0;
            if (query.id === '123') return 1;
            if (Object.keys(query).length === 0) return 42;
            return 10;
        })
    };

    return {
        Collection: jest.fn().mockImplementation(() => mockCollection),
        ObjectId: {
            isValid: jest.fn().mockImplementation((val) => {
                return typeof val === 'string' && val.length === 24;
            }),
        },
    };
});


describe('MongoDB Service Tests', () => {
    let mockCollection: jest.Mocked<Collection>;


    beforeEach(() => {
        skipValue = 0;
        limitValue = 10;

        mockCollection = {
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            skip: jest.fn().mockImplementation((val: number) => {
                skipValue = val;
                return mockCollection;
            }),
            limit: jest.fn().mockImplementation((val: number) => {
                limitValue = val;
                return mockCollection;
            }),
            toArray: jest.fn().mockImplementation(async () => {
                if (skipValue > 100) return [];
                if (limitValue === 0) return [];

                return [{
                    _id: new MockObjectId('1'),
                    id: 1,
                    name: 'Test',
                    active: true,
                    tags: ['tag1', 'tag2'],
                    counts: [1, 2, 3],
                    metadata: { key: 'value' },
                    list: ['item1', 123],
                }];
            }),
            countDocuments: jest.fn().mockImplementation(async (query = {}) => {
                if (skipValue > 100) return 0;
                if (query.id === '123') return 1;
                if (Object.keys(query).length === 0) return 42;
                return 10;
            })
        } as unknown as jest.Mocked<Collection>;

        jest.clearAllMocks();
    });

    describe('NoSQL Injection Prevention', () => {
        it('should prevent NoSQL injection in values', () => {
            const maliciousValues = [
                {$where: 'malicious'} as any,
                Object.defineProperty({}, '__proto__', {value: {evil: true}, enumerable: true}),
                Object.defineProperty({}, 'constructor.prototype', {value: {evil: true}, enumerable: true}),
                {$regex: '.*'},
                {nested: {$ne: null}}
            ];

            maliciousValues.forEach(value => {
                expect(() => expressionBuilder.buildFilterExpression([{
                    field: 'validField',
                    operator: '=',
                    value
                }])).toThrow(Error);
            });
        });
    });

    describe('Data Type Handling', () => {
        it('should handle mixed array types', () => {
            const filter: IFilterQuery = {
                field: 'data',
                operator: '=',
                value: [1, 'text', true]
            };

            const result = expressionBuilder.buildFilterExpression([filter]);
            expect(result.conditions['data']).toHaveProperty('$eq');
        });

        it('should handle nested objects', () => {
            const filter: IFilterQuery = {
                field: 'data',
                operator: '=',
                value: {nested: {deep: {value: 123}}}
            };

            const result = expressionBuilder.buildFilterExpression([filter]);
            expect(result.conditions['data']).toHaveProperty('$eq');
        });

        it('should handle unrecognized types', async () => {
            const mockCollectionWithBadType = {
                find: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                countDocuments: jest.fn().mockResolvedValue(1),
                toArray: jest.fn().mockResolvedValue([{
                    _id: new MockObjectId('1'),
                    id: 1,
                    weird: Symbol(),
                    normal: 'test'
                }])
            } as unknown as jest.Mocked<Collection>;

            const result = await fetchWithFiltersAndPaginationMongoDb(
                'table',
                {filters: [], pagination: {}},
                mockCollectionWithBadType
            );

            expect(result.data[0]).toMatchObject({
                id: 1,
                normal: 'test'
            });
        });
    });

    describe('Pagination Handling', () => {

        it('should handle concurrent pagination requests', async () => {
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(fetchWithFiltersAndPaginationMongoDb(
                    'table',
                    {
                        filters: [],
                        pagination: { page: i + 1, limit: 10 }
                    },
                    mockCollection
                ));
            }
            const results = await Promise.all(promises);
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result.data).toBeDefined();
                expect(result.total).toBeDefined();
            });
        });

        it('should handle offset larger than result set', async () => {
            const result = await fetchWithFiltersAndPaginationMongoDb(
                'table',
                {
                    filters: [],
                    pagination: {offset: 1000}
                },
                mockCollection
            );

            expect(result.data).toEqual([]);
        });

        it('should handle missing pagination object', async () => {
            const result = await fetchWithFiltersAndPaginationMongoDb(
                'table',
                {filters: []} as unknown as IGenericFilterQuery,
                mockCollection
            );

            expect(Array.isArray(result.data)).toBe(true);
        });

        it('should handle float values in pagination', async () => {
            const query: IGenericFilterQuery = {
                filters: [],
                pagination: {
                    page: 1.5,
                    limit: 3.14,
                    offset: 4.2
                }
            };

            await expect(fetchWithFiltersAndPaginationMongoDb(
                'table',
                query,
                mockCollection
            )).rejects.toThrow(/must be an integer/);
        });

        it('should handle string values in pagination', async () => {
            const query: IGenericFilterQuery = {
                filters: [],
                pagination: {
                    page: '1' as any,
                    limit: 'invalid' as any,
                    offset: '0' as any
                }
            };

            await expect(fetchWithFiltersAndPaginationMongoDb(
                'table',
                query,
                mockCollection
            )).rejects.toThrow(/must be an integer/);
        });
    });

    describe('Filter Expression Building', () => {
        it('should return empty object for empty filters', () => {
            const result = expressionBuilder.buildFilterExpression([]);
            expect(result.conditions).toEqual({});
        });

        it('should handle basic field filtering', () => {
            const filters: IFilterQuery[] = [{
                field: 'validField',
                operator: '=',
                value: 'Test'
            }];

            const result = expressionBuilder.buildFilterExpression(filters);
            expect(result.conditions['validField']).toHaveProperty('$eq', 'Test');
        });

        const operators = ['<', '>', '<=', '>=', '=', '!=', 'in', 'not in', 'like', 'not like'];
        operators.forEach(operator => {
            it(`should handle ${operator} operator`, () => {
                const filter: IFilterQuery = {
                    field: 'validField',
                    operator: operator as any,
                    value: operator === 'in' || operator === 'not in' ? ['value'] : 'value'
                };

                const result = expressionBuilder.buildFilterExpression([filter]);
                expect(result.conditions['validField']).toBeDefined();
            });
        });
    });

    describe('Query Operations', () => {
        it('should handle filtering on partition key', async () => {
            const query: IGenericFilterQuery = {
                filters: [{
                    field: 'id',
                    operator: '=',
                    value: '123'
                }],
                pagination: {limit: 10}
            };

            await fetchWithFiltersAndPaginationMongoDb('table', query, mockCollection);
            expect(mockCollection.find).toHaveBeenCalled();
        });

        it('should handle non-key filters', async () => {
            const query: IGenericFilterQuery = {
                filters: [{
                    field: 'validField',
                    operator: '=',
                    value: 'test'
                }],
                pagination: {limit: 10}
            };

            await fetchWithFiltersAndPaginationMongoDb('table', query, mockCollection);
            expect(mockCollection.find).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors appropriately', async () => {
            const errorMock = {
                find: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                countDocuments: jest.fn().mockRejectedValue(new Error('MongoDB Error')),
                toArray: jest.fn().mockRejectedValue(new Error('MongoDB Error'))
            } as unknown as jest.Mocked<Collection>;

            await expect(fetchWithFiltersAndPaginationMongoDb(
                'table',
                {filters: [], pagination: {limit: 10}},
                errorMock
            )).rejects.toThrow('MongoDB Error');
        });

        it('should handle validation errors separately', async () => {
            const query: IGenericFilterQuery = {
                filters: [{
                    field: 'test',
                    operator: 'invalid' as any,
                    value: 'test'
                }],
                pagination: {limit: 10}
            };

            await expect(fetchWithFiltersAndPaginationMongoDb(
                'table',
                query,
                mockCollection
            )).rejects.toThrow('Unsupported operator: invalid');
        });
    });
});