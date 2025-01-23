import {Collection} from 'mongodb';
import {MongoExpression} from './types/MongoExpression';
import {MongoExpressionBuilder} from './MongoExpressionBuilder';
import {MongoQueryExecutor} from './MongoQueryExecutor';
import {BaseDatabaseService, validatePagination} from "@denis_bruns/database-core";
import {IGenericFilterQuery, IPaginatedResponse, IPaginationQuery} from "@denis_bruns/core";

export class MongoDBService extends BaseDatabaseService<MongoExpression, Collection> {
    constructor(tableName: string, pkName: string = "_id") {
        const expressionBuilder = new MongoExpressionBuilder();
        const queryExecutor = new MongoQueryExecutor();
        super(tableName, pkName, expressionBuilder, queryExecutor);
    }

    async fetchWithFiltersAndPagination<T>(
        query: IGenericFilterQuery,
        client: Collection
    ): Promise<IPaginatedResponse<T>> {
        try {
            const {params, limit, offset, page, pagination} =
                await this.prepareQueryParameters(query);

            const totalBeforeOffset = await client.countDocuments(params.conditions || {});

            const baseOffset = pagination.offset !== undefined ? Number(pagination.offset) : 0;
            const effectiveTotal = Math.max(0, totalBeforeOffset - baseOffset);

            const totalPages = Math.ceil(effectiveTotal / limit);

            const items = await this.queryExecutor.executeQuery(params, client);

            const data = this.processResults<T>(items, limit, offset, pagination);

            return {
                data,
                total: effectiveTotal,
                page: Math.min(page, totalPages),
                limit,
            };
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    protected async prepareQueryParameters(query: IGenericFilterQuery): Promise<{
        params: MongoExpression;
        limit: number;
        offset: number;
        page: number;
        pagination: IPaginationQuery;
    }> {
        const {pagination = {}, filters = []} = query;
        validatePagination(pagination);

        const limit = Number(pagination.limit) || 10;
        const page = Number(pagination.page) || 1;
        const baseOffset = pagination.offset !== undefined ? Number(pagination.offset) : 0;

        const pageOffset = (page - 1) * limit;
        const totalOffset = baseOffset + pageOffset;

        const expr = this.expressionBuilder.buildFilterExpression(filters);

        if (pagination?.sortBy) {
            expr.sort = {
                [pagination.sortBy]: pagination.sortDirection === 'desc' ? -1 : 1
            };
        }

        return {
            params: {
                conditions: expr.conditions,
                sort: expr.sort,
                limit,
                skip: totalOffset
            },
            limit,
            offset: totalOffset,
            page,
            pagination
        };
    }

    protected processResults<T>(
        items: any[],
        limit: number,
        offset: number,
        pagination: IPaginationQuery
    ): T[] {

        return items.map(item => {
            const { _id, ...rest } = item;
            return {
                id: _id.toString(),
                ...rest
            } as T;
        });
    }

    protected handleError(error: any): void {
        console.error("Error in MongoDB operation:", error);
        throw error;
    }
}

export function fetchWithFiltersAndPaginationMongoDb<T>(
    tableName: string,
    query: IGenericFilterQuery,
    collection: Collection,
    pkName = "id",
    _service?: MongoDBService
): Promise<IPaginatedResponse<T>> {
    if(_service) {
        return _service.fetchWithFiltersAndPagination<T>(query, collection);
    }else{
        const service = new MongoDBService(tableName, pkName);
        return service.fetchWithFiltersAndPagination<T>(query, collection);
    }
}