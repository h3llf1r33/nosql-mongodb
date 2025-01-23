import {IDatabaseExpression} from "@denis_bruns/core";

export interface MongoExpression extends IDatabaseExpression {
    conditions: Record<string, any>;
    sort?: Record<string, 1 | -1>;
    limit?: number;
    skip?: number;
}