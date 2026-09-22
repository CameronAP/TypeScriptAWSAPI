import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from "@jest/globals";
import { mockClient } from "aws-sdk-client-mock";
import { StatusCodes } from "http-status-codes";
import { APIGatewayProxyEvent } from "aws-lambda";

// Must be done before imports
const TABLE_NAME = "test-locations-table";
process.env.TABLE_NAME = TABLE_NAME;
import { handler as createHandler } from "../../paths/locations/create/createLocation"
import { handler as deleteHandler } from "../../paths/locations/delete/deleteLocation"
import { handler as getHandler } from "../../paths/locations/get/getLocation"
import { handler as updateHandler } from "../../paths/locations/update/updateLocation"
import * as osm from "../../services/osm";

const ddbMock = mockClient(DynamoDBDocumentClient);

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: "GET",
    isBase64Encoded: false,
    path: "/locations",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "/locations",
    ...overrides,
});

const dbResponse = (statusCode: number, payload: object = {}) => ({
    $metadata: { httpStatusCode: statusCode },
    ...payload,
});

afterAll(() => {
    ddbMock.restore();
});

beforeEach(() => {
    ddbMock.reset();
});
afterEach(() => {
    jest.restoreAllMocks();
});

describe("Createlocation", () => {
    it("Should return OK on successful creation", async () => {
        const latLong = [1, 2]
        jest.spyOn(osm, "getLatLong").mockResolvedValue(latLong);
        ddbMock.on(PutCommand).resolves(dbResponse(StatusCodes.OK))
        const body = {
            id: "TestID",
            name: "TestName",
            city: "Town",
            region: "Region",
            country: "Country"
        }
        const event = makeEvent({
            body: JSON.stringify(body)
        })
        const res = await createHandler(event)

        expect(res.statusCode).toBe(StatusCodes.CREATED)
        expect(JSON.parse(res.body)).toEqual({ data: [{ latitude: latLong[0], longitude: latLong[1], ...body }] })
    })
    it("Should return Bad Request when a value is missing from the body", async () => {
        const body = {
            id: "TestID",
            name: "TestName",
            region: "Region",
            country: "Country"
        }
        const event = makeEvent({
            body: JSON.stringify(body)
        })
        const res = await createHandler(event)

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
        expect(JSON.parse(res.body).message).toEqual("Invalid request body")
    })
    it("Should return Internal Server Error when an error occurs within createLocationRecord", async () => {
        const latLong = [1, 2]
        jest.spyOn(osm, "getLatLong").mockResolvedValue(latLong);
        ddbMock.on(PutCommand).rejects({})
        const body = {
            id: "TestID",
            name: "TestName",
            city: "Town",
            region: "Region",
            country: "Country"
        }
        const event = makeEvent({
            body: JSON.stringify(body)
        })
        const res = await createHandler(event)

        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
    })
    it("Should return Bad Request when no coordinates can be found", async () => {
        jest.spyOn(osm, "getLatLong").mockResolvedValue(null);
        ddbMock.on(PutCommand).resolves(dbResponse(StatusCodes.OK))
        const body = {
            id: "TestID",
            name: "TestName",
            city: "Town",
            region: "Region",
            country: "Country"
        }
        const event = makeEvent({
            body: JSON.stringify(body)
        })
        const res = await createHandler(event)

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
        expect(JSON.parse(res.body).message).toEqual("Coordinates for the location provided could not be found")
    })
    it("Should return Conflict when a record with the same id exists", async () => {
        const latLong = [1, 2]
        jest.spyOn(osm, "getLatLong").mockResolvedValue(latLong);
        ddbMock.on(PutCommand).rejects(new ConditionalCheckFailedException({ message: "", $metadata: {} }))
        const body = {
            id: "TestID",
            name: "TestName",
            city: "Town",
            region: "Region",
            country: "Country"
        }
        const event = makeEvent({
            body: JSON.stringify(body)
        })
        const res = await createHandler(event)

        expect(res.statusCode).toBe(StatusCodes.CONFLICT)
    })
})
describe("DeleteLocation", () => {
    it("Should return No Content on successful delete", async () => {
        ddbMock.on(DeleteCommand).resolves(dbResponse(StatusCodes.OK))
        const event = makeEvent({
            pathParameters: { id: "testID" }
        })
        const res = await deleteHandler(event)

        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT)
    })
    it("Should return Bad Request when no id is in the path", async () => {
        ddbMock.on(DeleteCommand).resolves(dbResponse(StatusCodes.OK))
        const event = makeEvent({})
        const res = await deleteHandler(event)

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
    })
    it("Should return Internal Server Error when an error occurs within deleteRecord", async () => {
        ddbMock.on(DeleteCommand).rejects()
        const event = makeEvent({
            pathParameters: { id: "testID" }
        })
        const res = await deleteHandler(event)

        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
    })
    it("Should return Not Found when provided id doesnt exist in the table", async () => {
        ddbMock.on(DeleteCommand).rejects(new ConditionalCheckFailedException({ message: "", $metadata: {} }))
        const event = makeEvent({
            pathParameters: { id: "testID" }
        })
        const res = await deleteHandler(event)

        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND)
    })
})
describe("GetLocation", () => {
    describe("ById", () => {
        it("Should return OK with target record on successful get", async () => {
            const item = {
                id: "TestID",
                name: "TestName",
                city: "Town",
                region: "Region",
                country: "Country",
                latitude: 1.1,
                longitude: -1.1
            }
            ddbMock.on(GetCommand).resolves(dbResponse(StatusCodes.OK, { Item: item }))
            const event = makeEvent({
                pathParameters: { id: "testID" }
            })
            const res = await getHandler(event)
            expect(res.statusCode).toBe(StatusCodes.OK)
            expect(JSON.parse(res.body)).toEqual({ data: [item] })
        })
        it("Should return Not Found when no Item is returned", async () => {
            ddbMock.on(GetCommand).resolves(dbResponse(StatusCodes.OK))
            const event = makeEvent({
                pathParameters: { id: "testID" }
            })
            const res = await getHandler(event)
            
            expect(res.statusCode).toBe(StatusCodes.NOT_FOUND)
        })
        it("Should return Internal Server Error when an error occurs in getLocationById", async () => {
            ddbMock.on(GetCommand).rejects()
            const event = makeEvent({
                pathParameters: { id: "testID" }
            })
            const res = await getHandler(event)
            
            expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
        })
    })
    it("Should return OK with records on successful get", async () => {
        const items = [{
            id: "TestID",
            name: "TestName",
            city: "Town",
            region: "Region",
            country: "Country",
            latitude: 1.1,
            longitude: -1.1
        },
        {
            id: "TestID2",
            name: "TestName",
            city: "Town",
            region: "Region",
            country: "Country",
            latitude: 1.1,
            longitude: -1.1
        }]
        ddbMock.on(ScanCommand).resolves(dbResponse(StatusCodes.OK, { Items: items }))
        const event = makeEvent()
        const res = await getHandler(event)
        expect(res.statusCode).toBe(StatusCodes.OK)
        expect(JSON.parse(res.body)).toEqual({ data: items, limit: 10, cursor: items[1].id })
    })
    it("Should return OK and an empty array when the database is empty", async () => {
        ddbMock.on(ScanCommand).resolves(dbResponse(StatusCodes.OK))
        const event = makeEvent()
        const res = await getHandler(event)
        expect(res.statusCode).toBe(StatusCodes.OK)
        expect(JSON.parse(res.body)).toEqual({ data: [], limit: 10 })
    })
    it("Should return OK with records on when providing a cursor and limit", async () => {
        const items = [{
            id: "TestID",
            name: "TestName",
            city: "Town",
            region: "Region",
            country: "Country",
            latitude: 1.1,
            longitude: -1.1
        },
        {
            id: "TestID2",
            name: "TestName",
            city: "Town",
            region: "Region",
            country: "Country",
            latitude: 1.1,
            longitude: -1.1
        }]
        ddbMock.on(ScanCommand).resolves(dbResponse(StatusCodes.OK, { Items: items }))
        const event = makeEvent({
            queryStringParameters: { cursor: "TestID", limit: "15" }
        })
        const res = await getHandler(event)
        expect(res.statusCode).toBe(StatusCodes.OK)
        expect(JSON.parse(res.body)).toEqual({ data: items, limit: 15, cursor: items[1].id })
    })
    it("Should return Bad Request limit is invalid: String", async () => {
        const event = makeEvent({
            queryStringParameters: { cursor: "TestID", limit: "abs" }
        })
        const res = await getHandler(event)
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
    })
    it("Should return Bad Request limit is invalid: Float", async () => {
        const event = makeEvent({
            queryStringParameters: { cursor: "TestID", limit: "1.1" }
        })
        const res = await getHandler(event)
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
    })
    it("Should return Bad Request limit is invalid: less than 1", async () => {
        const event = makeEvent({
            queryStringParameters: { cursor: "TestID", limit: "0" }
        })
        const res = await getHandler(event)
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
    })
    it("Should return Internal Server Error when an error occurs in getLocationById", async () => {
        ddbMock.on(ScanCommand).rejects()
        const event = makeEvent({
            pathParameters: { id: "testID" }
        })
        const res = await getHandler(event)
        
        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
    })
})
describe("UpdateLocation", () => {
    it("Should return OK on successful update when providing only name", async () => {
        const body = {
            name: "Test Name",
        }
        const expectedRecord = {
            ...body,
            id: "testID",
            city: "Town2",
            region: "Region",
            country: "Country",
            latitude: 1,
            longitude: 2
        }
        ddbMock.on(UpdateCommand).resolves(dbResponse(StatusCodes.OK, { Attributes: expectedRecord }))
        const event = makeEvent({
            pathParameters: { id: expectedRecord.id },
            body: JSON.stringify(body)
        })
        const res = await updateHandler(event)
        
        expect(res.statusCode).toBe(StatusCodes.OK)
        expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
            TableName: TABLE_NAME,
            Key: { id: expectedRecord.id },
            UpdateExpression: "SET #name = :name",
            ExpressionAttributeNames: { "#name": "name" },
            ExpressionAttributeValues: { ":name": body.name },
            ReturnValues: "ALL_NEW"
        })
        expect(ddbMock).not.toHaveReceivedCommand(GetCommand)
        expect(JSON.parse(res.body)).toEqual({ data: [expectedRecord] })
    })
    it("Should return Bad Request on providing no body", async () => {
        const event = makeEvent({
            pathParameters: { id: "test" },
        })
        const res = await updateHandler(event)
        
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
    })
    it("Should return Bad Request on providing no id", async () => {
        const body = {
            name: "Test Name",
        }
        const event = makeEvent({
            body: JSON.stringify(body)
        })
        const res = await updateHandler(event)
        
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
    })
    it("Should return Internal Server when an error occurs in updateRecord", async () => {
        const body = {
            name: "Test Name",
        }
        const expectedRecord = {
            ...body,
            id: "testID",
            city: "Town2",
            region: "Region",
            country: "Country",
            latitude: 1,
            longitude: 2
        }
        ddbMock.on(UpdateCommand).rejects()
        const event = makeEvent({
            pathParameters: { id: expectedRecord.id },
            body: JSON.stringify(body)
        })
        const res = await updateHandler(event)
        
        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
    })
    it("Should return OK on successful update when providing city, region, country", async () => {
        const body = {
            city: "Town2",
            region: "Region",
            country: "Country",
        }
        const latLong = [1, 2]
        const expectedRecord = {
            ...body,
            id: "testID",
            name: "Test Name",
            latitude: latLong[0],
            longitude: latLong[1]
        }
        jest.spyOn(osm, "getLatLong").mockResolvedValue(latLong);
        ddbMock.on(UpdateCommand).resolves(dbResponse(StatusCodes.OK, { Attributes: expectedRecord }))
        const event = makeEvent({
            pathParameters: { id: expectedRecord.id },
            body: JSON.stringify(body)
        })
        const res = await updateHandler(event)
        
        expect(res.statusCode).toBe(StatusCodes.OK)
        expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
            TableName: TABLE_NAME,
            Key: { id: expectedRecord.id },
            UpdateExpression: 'SET #country = :country, #region = :region, #city = :city, #latitude = :latitude, #longitude = :longitude',
            ExpressionAttributeNames: {
                '#country': 'country',
                '#region': 'region',
                '#city': 'city',
                '#latitude': 'latitude',
                '#longitude': 'longitude'
            },
            ExpressionAttributeValues: {
                ':country': body.country,
                ':region': body.region,
                ':city': body.city,
                ':latitude': latLong[0],
                ':longitude': latLong[1]
            },
            ReturnValues: 'ALL_NEW'
        })
        expect(ddbMock).not.toHaveReceivedCommand(GetCommand)
        expect(JSON.parse(res.body)).toEqual({ data: [expectedRecord] })
    })
    it("Should return Bad Request when no coordinates can be found", async () => {
        const body = {
            city: "Town2",
            region: "Region",
            country: "Country",
        }
        jest.spyOn(osm, "getLatLong").mockResolvedValue(null);
        const event = makeEvent({
            pathParameters: { id: "testId" },
            body: JSON.stringify(body)
        })
        const res = await updateHandler(event)

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST)
        expect(JSON.parse(res.body).message).toEqual("Coordinates for the updated location provided could not be found")
    })
    it("Should return OK on successful update when providing only city", async () => {
        const body = {
            city: "Town2",
        }
        const latLong = [1, 2]
        const oldRecord = {
            id: "testID",
            city: "old City",
            region: "Region",
            country: "Country",
            name: "Test Name",
            latitude: latLong[0],
            longitude: latLong[1]
        }
        const expectedRecord = {
            ...oldRecord,
            ...body,
        }
        jest.spyOn(osm, "getLatLong").mockResolvedValue(latLong);
        ddbMock.on(GetCommand).resolves(dbResponse(StatusCodes.OK, { Item: oldRecord }))
        ddbMock.on(UpdateCommand).resolves(dbResponse(StatusCodes.OK, { Attributes: expectedRecord }))
        const event = makeEvent({
            pathParameters: { id: expectedRecord.id },
            body: JSON.stringify(body)
        })
        const res = await updateHandler(event)
        
        expect(res.statusCode).toBe(StatusCodes.OK)
        expect(ddbMock).toHaveReceivedCommand(GetCommand)
        expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
            TableName: TABLE_NAME,
            Key: { id: expectedRecord.id },
            UpdateExpression: 'SET #city = :city, #latitude = :latitude, #longitude = :longitude',
            ExpressionAttributeNames: {
                '#city': 'city',
                '#latitude': 'latitude',
                '#longitude': 'longitude'
            },
            ExpressionAttributeValues: {
                ':city': body.city,
                ':latitude': latLong[0],
                ':longitude': latLong[1]
            },
            ReturnValues: 'ALL_NEW'
        })
        expect(JSON.parse(res.body)).toEqual({ data: [expectedRecord] })
    })
    it("Should return Not Found when providing only country", async () => {
        const body = {
            country: "Country",
            city: "Town2",
        }
        const latLong = [1, 2]
        jest.spyOn(osm, "getLatLong").mockResolvedValue(latLong);
        ddbMock.on(GetCommand).resolves(dbResponse(StatusCodes.OK))
        const event = makeEvent({
            pathParameters: { id: "TestID" },
            body: JSON.stringify(body)
        })
        const res = await updateHandler(event)
        
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND)
        expect(ddbMock).toHaveReceivedCommand(GetCommand)
    })
})