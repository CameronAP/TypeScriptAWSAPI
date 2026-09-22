import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { StatusCodes } from "http-status-codes"
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME

async function deleteRecord(id: string) {
    try {
        const res = await db.send(
            new DeleteCommand({
                TableName: TABLE_NAME,
                Key: {
                    id: id,
                },
                ConditionExpression: "attribute_exists(id)",
            })
        );
        if (res.$metadata.httpStatusCode !== StatusCodes.OK) {
            console.error(res)
            throw new Error("Unexpected status code in db response")
        }
    } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
            return {
                statusCode: StatusCodes.NOT_FOUND,
                body: JSON.stringify({
                    code: "LOCATION_RECORD_NOT_FOUND",
                    message: `Location with id "${id}" not found`
                })
            }
        }
        throw error
    }
    return {
        statusCode: StatusCodes.NO_CONTENT,
        body: ""
    }
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
    try {
        return await deleteRecord(id)
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
