import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { StatusCodes } from "http-status-codes"
import { LocationRecord, LocationData } from "../../../types/types.gen";
import { DynamoDBClient, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, NativeAttributeValue, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME

const MIN_LIMIT = 1
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 10

type Body = LocationData & {
    cursor?: string,
    limit?: number
}

async function getLocationById(id: string): Promise<LocationRecord | null> {
    let record = null
    const res = await db.send(
        new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                id: id
            }
        })
    )
    if (res.$metadata.httpStatusCode !== StatusCodes.OK) {
        console.error(res)
        throw new Error("Unexpected status code in db response")
    }
    if (res.Item) record = res.Item as LocationRecord
    return record
}

async function getLocations(cursor: string, limit: number): Promise<Array<LocationRecord>> {
    const query: ScanCommandInput = {
        TableName: TABLE_NAME,
        Limit: limit,
    }
    if (cursor.length) query.ExclusiveStartKey = { id: cursor } as NativeAttributeValue
    const res = await db.send(
        new ScanCommand(query)
    );
    if (res.$metadata.httpStatusCode !== StatusCodes.OK) {
        console.error(res)
        throw new Error("Unexpected status code in db response")
    }
    const records = res.Items as LocationRecord[] ?? []

    return records
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const id = event.pathParameters?.id
    try {
        const body = { data: [] as LocationRecord[] } as Body
        if (id) {
            const record = await getLocationById(id)
            if (!record) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    body: JSON.stringify({
                        code: "LOCATION_RECORD_NOT_FOUND",
                        message: `Location with id "${id}" not found`
                    })
                }
            }
            body.data.push(record)
        } else {
            const cursor = event.queryStringParameters?.cursor ?? ""
            const queryLimit = Number(event.queryStringParameters?.limit ?? DEFAULT_LIMIT)
            // If the number is not an positive integer 
            if (!Number.isFinite(queryLimit) || queryLimit != Math.round(queryLimit) || queryLimit < MIN_LIMIT) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    body: JSON.stringify({
                        code: "INVALID_REQUEST",
                        message: "Invalid query parameter: Limit must be a positive integer"
                    })
                }
            }
            // Instead of raising an error on a limit too large just truncate to the maximum page size.
            const limit = Math.min(MAX_LIMIT, queryLimit)

            const records = await getLocations(cursor, limit)
            body.data.push(...records)

            if (records.length) body.cursor = records[records.length - 1].id
            body.limit = limit
        }
        return {
            statusCode: StatusCodes.OK,
            body: JSON.stringify(body)
        }
    } catch (error) {
        console.error(error)
        return {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            body: JSON.stringify({
                code: "INTERNAL_SERVER_ERROR",
                message: "Internal Server Error: An unexpected error has occured"
            })
        }
    }
}