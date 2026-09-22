import * as cdk from "aws-cdk-lib";
import { ApiStack } from "./stacks/api/api-stack";
import { DatabaseStack } from "./stacks/database/database-stack";

const app = new cdk.App();


const prefix = app.node.tryGetContext('prefix');
if (!prefix) {
    throw new Error("prefix missing from context variables")
}
console.log(`Deploying with prefix: ${prefix}`)

const dbStack = new DatabaseStack(app,`${prefix}DataBaseStack`, prefix)

new ApiStack(app, `${prefix}ApiStack`, dbStack.table, prefix);