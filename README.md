# ECE 461 Group 11 - Package Registry

A web-based Node.js package registry system with modern UI and comprehensive package management capabilities.

## Features

### Package Management
- Upload packages via ZIP file or URL (NPM/GitHub)
- Search packages by name and version
- Download packages
- Version control support

### Package Analysis
- Package ratings with multiple metrics
- Cost analysis
- Installation size evaluation
- Maintenance metrics

## Technologies
- TypeScript
- Node.js
- AWS Lambda
- DynamoDB
- S3 Storage

## UI Features
- Responsive design with mobile support
- Modern typography using Google Fonts (Roboto, Poppins)
- Clean color scheme (#3498db, #2c3e50)
- Interactive loading states
- Clear error handling
- Intuitive form layouts

## Contributors
- Rishab Pangal
- Shrijan Swaminathan
- Aarav Patel

## How to Use the Repository

### REST API
- All REST API code is contained inside of src/api
    - index.ts: This is the main handler for the API Gateway endpoint.
    - All other .ts files are for each endpoint
- To compile to .js, run:
  ```bash
    tsc --project tsconfig.api.json
- This will deposit it inside of ./dist in the root directory
- Run "npm i ... --save" or "npm i ... --save-dev" in the lambda_deploy directory to ensure that all dependencies are pushed to Lambda
- Adjust deploy_lambda.yaml to include the Lambda Function for your REST API files

### Metrics Function
- The metrics functions are all contained inside of src/metrics/src
    - index.ts: This is the main handler to fetch URL's and return metrics
- To compile to .js, run:
  ```bash
    tsc --project tsconfig.metrics.json
- This will deposit it inside of ./dist_metrics in the root directory
- Run "npm i ... --save" or "npm i ... --save-dev" in the lambda_deploy_metrics directory to ensure that all dependencies are pushed to Lambda
- Adjust deploy_lambda.yaml to include the Lambda Function for your Metric files

### Frontend
- All frontend code is contained inside of src/frontend
    - css:
        - Houses styles.css for styling
    - html:
        - Houses index.html for html
    - scripts
        - Houses index.ts (compiled to index.js during CD) for functions
    - testing
        - Houses testfrontend.py, which uses Selenium to test frontend

## Endpoints
- Web Interface: http://3.140.252.124/
- API URL: https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage
    - POST /package: Upload a new package (either via URL or Zip)
    - GET /package/{id}: Download a specific package
    - POST /packages: Search packages with version filtering
    - GET /package/{id}/rate: Get package ratings
    - POST /package/byRegEx: Search packages using regex
    - POST /package/{id}: Update package