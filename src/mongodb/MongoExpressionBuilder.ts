import { MongoExpression } from './types/MongoExpression';
import { ObjectId } from 'mongodb';
import {
    BaseExpressionBuilder,
    validateValue
} from "@denis_bruns/database-core";
import {IFilterQuery} from "@denis_bruns/core";

export class MongoExpressionBuilder extends BaseExpressionBuilder<MongoExpression> {
    private readonly operatorMap: Record<string, string> = {
        "<": "$lt",
        ">": "$gt",
        "<=": "$lte",
        ">=": "$gte",
        "=": "$eq",
        "!=": "$ne",
        "in": "$in",
        "not in": "$nin",
        "like": "$regex",
        "not like": "$not"
    };

    buildFilterExpression(filters: IFilterQuery[]): MongoExpression {

        if (!filters.length) return {conditions: {}};

        filters.forEach(filter => {
            validateValue(filter.value);
        });

        const expression: MongoExpression = {
            conditions: {}
        };

        const {pkFilter, remainingFilters} = this.extractPartitionKeyFilter(filters);

        if (pkFilter) {
            if (pkFilter.field.includes('$')) {
                throw new Error('Invalid field name: Field names cannot contain "$"');
            }
            // Convert string ID to ObjectId if it matches ObjectId format
            let pkValue = pkFilter.value;
            if (typeof pkValue === 'string' && pkFilter.field === 'id' && ObjectId.isValid(pkValue)) {
                pkValue = new ObjectId(pkValue);
                expression.conditions['_id'] = pkValue;
            } else {
                expression.conditions[this.pkName] = pkValue;
            }
        }

        remainingFilters.forEach((filter, index) => {
            if (filter.field.includes('$')) {
                throw new Error('Invalid field name: Field names cannot contain "$"');
            }
            if (filter.field === 'id' && typeof filter.value === 'string' && ObjectId.isValid(filter.value)) {
                filter = {
                    ...filter,
                    field: '_id',
                    value: new ObjectId(filter.value)
                };
            }

            const condition = this.buildSubExpression(
                expression,
                filter.field,
                filter.operator,
                filter.value,
                index
            );
            if (condition) {
                expression.conditions[filter.field] = condition;
            }
        });

        return expression;
    }

    protected buildSubExpression(
        expr: MongoExpression,
        field: string,
        operator: string,
        value: any,
        index: number
    ): any {
        const mongoOp = this.operatorMap[operator];
        if (!mongoOp) {
            throw new Error(`Unsupported operator: ${operator}`);
        }

        if (operator === 'like' || operator === 'not like') {
            const pattern = this.buildRegexPattern(value);
            return operator === 'like' ?
                {[mongoOp]: pattern} :
                {[mongoOp]: {[mongoOp]: pattern}};
        }

        return {[mongoOp]: value};
    }

    private buildRegexPattern(value: string): RegExp {
        const escaped = value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        return new RegExp(escaped, 'i');
    }
}