import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { StatusCodes } from "http-status-codes"
import { LocationRecord } from "../../../types/types.gen.ts";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getLatLong } from "../../../services/osm.ts"
const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME

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

async function updateRecord(id: string, attsToUpdate: object): Promise<LocationRecord> {
    const  updateExpressions = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, string | number> = {}
    for (const item of Object.entries(attsToUpdate)) {
        const key = item[0]
        const val = item[1]
        if (typeof val === "string" || typeof val === "number") {
            const keyHash = `#${key}`
            const keyColon = `:${key}`
            updateExpressions.push(`${keyHash} = ${keyColon}`)
            expressionAttributeNames[keyHash] = key
            expressionAttributeValues[keyColon] = val
        }
    }
    const res = await db.send(
        new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: id },
            // Slice to remove trailing ", "
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,

            ExpressionAttributeNames: expressionAttributeNames,

            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: "ALL_NEW",
            ConditionExpression: "attribute_exists(id)"
        })
    );
    if (res.$metadata.httpStatusCode !== StatusCodes.OK) {
        console.error(res)
        throw new Error("Unexpected status code in db response")
    }
    if (!res.Attributes) {
        console.error("No attributes returned")
    }
    return res.Attributes as LocationRecord
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const id = event.pathParameters?.id
    if (!id) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            body: JSON.stringify({
                code: "INVALID_REQUEST",
                message: "Missing id in path parameters"
            })
        }
    }
    const { name, country, region, city } = JSON.parse(event.body ?? "{}");
    if (!name && !country && !region && !city) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            body: JSON.stringify({
                code: "INVALID_REQUEST",
                message: "Invalid request body"
            })
        }
    }
    try {
        let latitude = undefined
        let longitude = undefined
        if (country || region || city) {
            // If we have been provided with all 3 there is no need to read the existing location record
            const record = country && region && city ? { country, region, city } : await getLocationById(id)
            if (!record) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    body: JSON.stringify({
                        code: "LOCATION_RECORD_NOT_FOUND",
                        message: `Location with id "${id}" not found`
                    })
                }
            }

            const coords = await getLatLong(city ?? record.city, region ?? record.region, country ?? record.country)
            if (!coords || coords.length !== 2) {
                console.error(`Coordinates found: ${coords}`)
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    body: JSON.stringify({
                        code: "INTERNAL_SERVER_ERROR",
                        message: "Coordinates for the updated location provided could not be found"
                    })
                }
            }
            latitude = coords[0]
            longitude = coords[1]
        }
        const updateAttributes = { name, country, region, city, latitude, longitude }
        const record = await updateRecord(id, updateAttributes)
        return {
            statusCode: StatusCodes.OK,
            body: JSON.stringify({ data: [record] })
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