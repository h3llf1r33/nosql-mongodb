# @denis_bruns/nosql-mongodb

> **A MongoDB service for clean architecture projects, featuring filter expressions, pagination, and safe validations.**

[![NPM Version](https://img.shields.io/npm/v/@denis_bruns/nosql-mongodb?style=flat-square&logo=npm)](https://www.npmjs.com/package/@denis_bruns/nosql-mongodb)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub--181717.svg?style=flat-square&logo=github)](https://github.com/h3llf1r33/nosql-mongodb)

---

## Overview

`@denis_bruns/nosql-mongodb` provides a **MongoDB-specific** data service based on clean architecture principles. It extends [`@denis_bruns/database-core`](https://www.npmjs.com/package/@denis_bruns/database-core) to offer:

- **Filter expression** construction (`MongoExpressionBuilder`), converting filters to MongoDB queries
- **Offset-based** pagination and in-memory transformations
- **Type-safe** mapping of `_id` to `id` for convenience
- **Validation** utilities to mitigate NoSQL injection attempts
- Seamless integration with MongoDB’s native `Collection` API

This library aims to simplify the **boilerplate** involved in typical CRUD or query operations on MongoDB while keeping your **business logic** clean and testable.

---

## Key Features

1. **MongoDB-Specific Expression Builder**
    - Converts common filter queries (`IFilterQuery`) into a structured MongoDB `conditions` object.
    - Supports operators like `<`, `<=`, `>`, `>=`, `=`, `!=`, `in`, `not in`, `like`, and `not like`.

2. **Pagination & Sorting**
    - Applies `limit`, `skip` (offset), and `sort` automatically based on your query.
    - Offers page-based and offset-based pagination in one approach.

3. **Type-Safe Results**
    - Converts Mongo’s `_id` to a string `id`, enabling a more consistent domain model.
    - Allows further overrides of `processResults` for custom transformations if desired.

4. **Built-in Validation**
    - Ensures safe field names and values (`validateValue`) to help guard against potential injection patterns.
    - Checks pagination parameters (`validatePagination`) to confirm integer inputs.

5. **Extensible Architecture**
    - Extends the `BaseDatabaseService` so you can override or customize query building, error handling, or result processing.

---

## Installation

With **npm**:

```bash
npm install @denis_bruns/nosql-mongodb
```

Or with **yarn**:

```bash
yarn add @denis_bruns/nosql-mongodb
```

You’ll also need **MongoDB** types and driver:

```bash
npm install mongodb
```

---

## Basic Usage

Below is a **simple** usage example. In a real-world application, you might integrate this into a domain-specific repository or service layer.

```ts
import { MongoClient } from "mongodb";
import { fetchWithFiltersAndPaginationMongoDb, MongoDBService } from "@denis_bruns/nosql-mongodb";
import { IGenericFilterQuery } from "@denis_bruns/core";

interface User {
  id: string;
  name: string;
  email: string;
}

async function example() {
  // 1) Connect to MongoDB
  const client = new MongoClient("mongodb://localhost:27017");
  await client.connect();
  const collection = client.db("my-database").collection("users");

  // 2) Build a filter query
  const query: IGenericFilterQuery = {
    filters: [
      { field: "email", operator: "=", value: "test@example.com" }
    ],
    pagination: { page: 1, limit: 5, sortBy: "name" }
  };

  // 3) Option A: Direct Helper Function
  const directResult = await fetchWithFiltersAndPaginationMongoDb<User>(
    "users", // tableName
    query,
    collection
  );
  console.log("Direct Helper:", directResult.data);

  // 4) Option B: MongoDBService instance
  const service = new MongoDBService("users");
  const serviceResult = await service.fetchWithFiltersAndPagination<User>(query, collection);
  console.log("Service Class:", serviceResult.data);

  client.close();
}

example().catch((err) => console.error("Mongo Example Error:", err));
```

In this snippet:
- **`fetchWithFiltersAndPaginationMongoDb`** is a quick helper if you just need a one-off query.
- **`MongoDBService`** allows for deeper customization or extension in your codebase.

---

## Core Concepts

1. **Filter Expressions**  
   Each filter has `field`, `operator`, and `value`. Operators like `"in"`, `"not in"`, `"like"`, and `"not like"` are mapped to Mongo’s `$in`, `$nin`, `$regex`, and `$not` respectively.
   ```ts
   filters: [
     { field: "status", operator: "=", value: "active" },
     { field: "name", operator: "like", value: "john" }
   ];
   ```
2. **Pagination**
    - `page`, `limit`, `offset` are all supported.
    - `sortBy` and `sortDirection` let you sort on a specific field in ascending or descending order.

3. **Validation**
    - `validateValue` checks for suspicious patterns in strings or objects (to reduce injection attacks).
    - `validatePagination` ensures `page`, `limit`, and `offset` are valid integers.

4. **ID Mapping**
    - If your filters or results use `"id"`, it’s automatically mapped to or from `_id` so you can keep a consistent domain model.

---

## Related Packages

- **@denis_bruns/core**  
  [![NPM](https://img.shields.io/npm/v/@denis_bruns/core?style=flat-square&logo=npm)](https://www.npmjs.com/package/@denis_bruns/core)  
  [![GitHub](https://img.shields.io/badge/GitHub--181717.svg?style=flat-square&logo=github)](https://github.com/h3llf1r33/core)  
  *Contains the fundamental interfaces and types used in this library (e.g., `IFilterQuery`, `IGenericFilterQuery`, etc.).*

- **@denis_bruns/database-core**  
  [![NPM](https://img.shields.io/npm/v/@denis_bruns/database-core?style=flat-square&logo=npm)](https://www.npmjs.com/package/@denis_bruns/database-core)  
  [![GitHub](https://img.shields.io/badge/GitHub--181717.svg?style=flat-square&logo=github)](https://github.com/h3llf1r33/database-core)  
  *The abstract service this library extends to handle common database logic, such as error handling and pagination utilities.*

---

## Contributing

Contributions, bug reports, and feature requests are welcome! Please feel free to open an issue or submit a pull request on [GitHub](https://github.com/h3llf1r33/nosql-mongodb).

---

## License

This project is [MIT licensed](LICENSE).

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/h3llf1r33">h3llf1r33</a>
</p>