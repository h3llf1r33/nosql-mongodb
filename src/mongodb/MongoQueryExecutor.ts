import {Collection} from 'mongodb';
import {MongoExpression} from './types/MongoExpression';
import {IQueryExecutor} from "@denis_bruns/core";

export class MongoQueryExecutor implements IQueryExecutor<MongoExpression, Collection> {
    async executeQuery(params: MongoExpression, collection: Collection): Promise<any[]> {
        const cursor = collection.find(params.conditions || {});

        if (params.sort) {
            cursor.sort(params.sort);
        }

        if (typeof params.skip === 'number') {
            cursor.skip(params.skip);
        }

        if (typeof params.limit === 'number' && params.limit > 0) {
            cursor.limit(params.limit);
        }

        return cursor.toArray();
    }
}