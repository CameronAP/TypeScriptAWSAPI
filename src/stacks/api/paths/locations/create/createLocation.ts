import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { StatusCodes } from "http-status-codes"
import { LocationRecord } from "../../../types/types.gen.ts";
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getLatLong } from "../../../services/osm.ts"
const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME


async function createLocationRecord(id: string, name: string, country: string, region: string, city: string) {
    const coords = await getLatLong(city, region, country)
    if (!coords || coords.length !== 2) {
        console.error(`Coordinates found: ${coords}`)
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            body: JSON.stringify({
                code: "INVALID_REQUEST",
                message: "Coordinates for the location provided could not be found"
            })
        }
    }
    const item: LocationRecord = {
        id: id,
        name: name,
        city: city,
        region: region,
        country: country,
        latitude: coords[0],
        longitude: coords[1]
    }
    try {
        const res = await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: item,
                ConditionExpression: "attribute_not_exists(id)",
            })
        )
        if (res.$metadata.httpStatusCode !== StatusCodes.OK) {
            console.error(res)
            throw new Error("Unexpected status code in db response")
        }
    } catch (error) {
        console.error(error)
        if (error instanceof ConditionalCheckFailedException) {
            return {
                statusCode: StatusCodes.CONFLICT,
                body: JSON.stringify({
                    code: "LOCATION_RECORD_ALREADY_EXISTS",
                    message: `Location with id ${id} already exists`
                })
            }
        }
        throw error

    }
    return { statusCode: StatusCodes.CREATED, body: JSON.stringify({ data: [item] }) }

}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { id, name, country, region, city } = JSON.parse(event.body ?? "{}");
    if (!id || !name || !country || !region || !city) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            body: JSON.stringify({
                code: "INVALID_REQUEST",
                message: "Invalid request body"
            })
        }
    }
    try {
        const res = await createLocationRecord(id, name, country, region, city)
        return res
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
