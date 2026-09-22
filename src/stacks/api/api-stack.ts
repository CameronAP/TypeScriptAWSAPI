import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class ApiStack extends cdk.Stack {
  PATH: string = "src/stacks/api/"
  prefix: string
  locationsTable: dynamodb.Table
  constructor(scope: Construct, id: string, locationsTable: dynamodb.Table, prefix: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.prefix = prefix
    this.locationsTable = locationsTable
    const api = this.createApi()

    const locations = api.root.addResource("locations");
    const locationbyId = locations.addResource("{id}");

    const createLocationLambda = this.createTableReadWriteLambda(
      `${this.prefix}CreateLocationLambda`,
      `${this.PATH}paths/locations/create/createLocation.ts`
    )
    this.addMethod(locations, createLocationLambda, "POST")

    const deleteLocationLambda = this.createTableWriteOnlyLambda(
      `${this.prefix}DeleteLocationLambda`,
      `${this.PATH}paths/locations/delete/deleteLocation.ts`
    )
    this.addMethod(locationbyId, deleteLocationLambda, "DELETE")

    const getLocationLambda = this.createTableReadOnlyLambda(
      `${this.prefix}GetLocationLambda`,
      `${this.PATH}paths/locations/get/getLocation.ts`
    )
    this.addMethod(locations, getLocationLambda, "GET")
    this.addMethod(locationbyId, getLocationLambda, "GET")

    const updateLocationLambda = this.createTableReadWriteLambda(
      `${this.prefix}UpdateLocationLambda`,
      `${this.PATH}paths/locations/update/updateLocation.ts`
    )
    this.addMethod(locationbyId, updateLocationLambda, "PATCH")
  }

  createApi(): apigateway.RestApi {
    const apiName = `${this.prefix}LocationAPI`
    const api = new apigateway.RestApi(this, apiName, {
      restApiName: `${this.prefix}LocationAPI`,
    });
    const apiKey = api.addApiKey(`${apiName}Key`, {
      apiKeyName: `${apiName}Key`,
    });

    const usagePlan = api.addUsagePlan("LocationsUsagePlan", {
      name: "LocationsUsagePlan",
    });
    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({
      stage: api.deploymentStage,
    });
    return api
  }

  addMethod(resouce: cdk.aws_apigateway.Resource, lambda: cdk.aws_lambda_nodejs.NodejsFunction, method: string) {
    resouce.addMethod(
      method,
      new apigateway.LambdaIntegration(lambda),
      { apiKeyRequired: true }
    );
  }

  createTableReadWriteLambda(name: string, entry: string): cdk.aws_lambda_nodejs.NodejsFunction {
    const createLambda = new NodejsFunction(this, name, {
      entry: entry,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        TABLE_NAME: this.locationsTable.tableName
      }
    });
    this.locationsTable.grantReadWriteData(createLambda)
    return createLambda
  }
  createTableReadOnlyLambda(name: string, entry: string): cdk.aws_lambda_nodejs.NodejsFunction {
    const createLambda = new NodejsFunction(this, name, {
      entry: entry,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        TABLE_NAME: this.locationsTable.tableName
      }
    });
    this.locationsTable.grantReadData(createLambda)
    return createLambda
  }
  createTableWriteOnlyLambda(name: string, entry: string): cdk.aws_lambda_nodejs.NodejsFunction {
    const createLambda = new NodejsFunction(this, name, {
      entry: entry,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        TABLE_NAME: this.locationsTable.tableName
      }
    });
    this.locationsTable.grantWriteData(createLambda)
    return createLambda
  }
}